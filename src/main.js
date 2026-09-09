import { drawPony } from './pony.js';
import { sfxAim, sfxFlap, sfxHit, sfxLevelUp, sfxMiss, sfxBird, sfxThunder, sfxGust, sfxLava, startWindSound, updateWindSound, stopWindSound, startMusic, toggleMute } from './sound.js';

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let W, H, DPR;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  groundY = H * 0.82;
}
window.addEventListener('resize', resize);

let groundY = 0;
const G = 1400; // gravity px/s^2
const FLAP_IMPULSE = 480;
const MAX_FLAPS = 3;

// Approximate local offset (pre-rotation, pre-scale) from the pony's
// anchor to its muzzle tip, taken from the muzzle-bump rect in pony.js's
// SHAPES ([22,-12,26,-10]) shifted by GROUND_Y and scaled by
// CELL*PONY_SCALE (2*1.9=3.8) -- used by the target-hit capsule check
// below so the collision shape actually follows the visible sprite.
const PONY_NOSE_LX = 91, PONY_NOSE_LY = -68;

// Closest distance from point (px,py) to the segment (ax,ay)-(bx,by).
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}
const stops = ['#ff3b3b', '#ff9d3b', '#ffe23b', '#3bff6e', '#3bb3ff', '#5b3bff', '#c23bff'];

const LEVEL_HITS_REQUIRED = 3;

// One location per level, cycling every LOCATIONS.length levels. Each has
// a sky gradient, a ground color, and its own pair of parallax layers
// (drawn in screen space with their own camX * parallax offset -- not the
// world ctx.translate other drawing uses). Declared early (not down with
// the rest of the drawing code) because placeTarget() needs
// LOCATIONS.length at module-load time, before resetLaunch() runs.
const LOCATIONS = [
  { sky: ['#ffe3c2', '#fff6ea'], ground: '#ffe9c7' }, // 0 heavens
  { sky: ['#7ec8ff', '#dff3ff'], ground: '#bfe8b8' }, // 1 mountains
  { sky: ['#93a3c9', '#e6dcd2'], ground: '#9a9a9a' }, // 2 city
  { sky: ['#6fc7ff', '#eafcff'], ground: '#f0d9a0' }, // 3 beach
  { sky: ['#141833', '#33395c'], ground: '#4a4038' }, // 4 caves
];

const state = {
  mode: 'aim', // aim | flight | result
  originX: 0, originY: 0,
  aimActive: false,
  aimIsMouse: false, // true if this aim gesture is a mouse drag (see computeAim)
  aimDX: 0, aimDY: 0, // drag vector, used for power+angle
  power: 0, // 0..1
  angle: -Math.PI / 4,
  pony: { x: 0, y: 0, vx: 0, vy: 0, rot: 0 },
  flapsLeft: MAX_FLAPS,
  trail: [],
  hearts: [],
  target: { x: 0, y: 0, r: 46 },
  tries: 0,
  resultTimer: 0,
  won: false,
  level: 0, // 0-indexed; level 0 gets the on-screen -> blind tutorial ramp
  levelHits: 0, // successful hits so far in the current level (0..LEVEL_HITS_REQUIRED)
  leveledUp: false, // this hit was the level's 3rd, level just advanced
  bgLevel: 0, // location actually shown -- lags state.level until the next
              // resetLaunch(), so the background only switches when the
              // player taps to start the next attempt, not mid-result-screen
};

let camX = 0; // world-space camera offset (screen_x = world_x - camX)

// Mountains-only weather hazard: rain is pure atmosphere (see drawRain),
// lightning is a timed strike -- flying through the strike's x-column
// during its brief active window is an instant miss, the same role a
// bird/wind/lava hazard plays for the other locations. Each location keeps
// exactly one hazard type (rain+lightning together count as Mountains').
// Runs off state.bgLevel (the location actually on screen), not state.level.
// The countdown itself carries over between attempts rather than resetting
// (see updateWeather for why it only ticks during an actual flight).
function isMountains() { return state.bgLevel % LOCATIONS.length === 1; }
let lightningTimer = 2 + Math.random() * 2;
let lightningX = 0;
let lightningFlash = 0; // 0..1, visual bolt/flash brightness, decays after a strike
let lightningActive = false; // true only during the brief hazardous window
let lightningActiveT = 0;

function updateWeather(dt) {
  if (!isMountains()) return;
  // The timer only counts down during an actual flight (not while aiming),
  // and a fresh strike is aimed just ahead of the pony's *current* position
  // rather than anywhere in the whole reachable range. The first version
  // free-ran on the wall clock and picked an x anywhere across ~1400px, so
  // most strikes fired while the player was still aiming (wasted -- nothing
  // could be hit) or landed far outside that flight's actual path (user
  // report: "lightning and birds don't seem to affect the flight at all").
  // Gating to flight-time plus aiming ahead of the pony makes a strike
  // during a flight both frequent and reachable.
  if (state.mode === 'flight') lightningTimer -= dt;
  if (lightningTimer <= 0) {
    lightningX = state.pony.x + 150 + Math.random() * 350;
    lightningFlash = 1;
    lightningActive = true;
    lightningActiveT = 0.4;
    lightningTimer = 1.6 + Math.random() * 1.6;
    sfxThunder();
  }
  if (lightningActive) {
    lightningActiveT -= dt;
    if (lightningActiveT <= 0) lightningActive = false;
  }
  lightningFlash = Math.max(0, lightningFlash - dt * 2.2);

  if (lightningActive && state.mode === 'flight') {
    const p = state.pony;
    if (Math.abs(p.x - lightningX) < 60 && p.y < groundY) endFlight(false);
  }
}

// City-only obstacle: a flock of birds sitting at a world x that relocates
// every few seconds. Unlike lightning's instant miss, this is a headwind --
// flying through the flock's zone bleeds off forward speed continuously
// for as long as the pony is inside it, rather than ending the flight
// outright (each of the four locations' hazards does something different:
// Mountains = instant-miss hazard, City = continuous drag, Beach = a one-
// off vertical nudge below, Caves = instant-miss hazard again but themed
// and shaped differently -- low altitude only, not any altitude).
function isCity() { return state.bgLevel % LOCATIONS.length === 2; }
const BIRD_ZONE = 90; // half-width of the headwind zone, world px
let birdX = 0, birdTimer = 1 + Math.random() * 2, birdInside = false;

function updateBirds(dt) {
  if (!isCity()) { birdInside = false; return; }
  // Same fix as Mountains' lightning: relocate relative to the pony's
  // current position during an actual flight, not anywhere across the
  // whole reachable range on a free-running clock -- otherwise the flock
  // usually sits somewhere a given flight never reaches.
  if (state.mode === 'flight') birdTimer -= dt;
  if (birdTimer <= 0) {
    birdX = state.pony.x + 150 + Math.random() * 400;
    birdTimer = 2.4 + Math.random() * 2;
  }
  if (state.mode === 'flight') {
    const p = state.pony;
    const inside = Math.abs(p.x - birdX) < BIRD_ZONE && p.y < groundY;
    if (inside) {
      if (!birdInside) sfxBird();
      p.vx -= p.vx * 1.4 * dt;
    }
    birdInside = inside;
  } else {
    birdInside = false;
  }
}

// Beach-only obstacle: a gust zone that relocates like the flock/lightning
// above, but instead of a continuous drag or an instant miss, it's a one-
// off vertical nudge -- flying through it while it's active gives the pony
// a single up or down kick (sign picked per-gust), simulating a crosswind
// shoving it off its arc without ending the flight. `gustHit` (like
// `birdInside`) makes sure the kick applies once per pass, not every frame.
function isBeach() { return state.bgLevel % LOCATIONS.length === 3; }
const GUST_ZONE = 80;
let gustX = 0, gustTimer = 1 + Math.random() * 2, gustActive = false, gustActiveT = 0, gustSign = 1, gustHit = false;

function updateWind(dt) {
  if (!isBeach()) { gustActive = false; gustHit = false; return; }
  if (state.mode === 'flight') gustTimer -= dt;
  if (gustTimer <= 0) {
    gustX = state.pony.x + 150 + Math.random() * 350;
    gustSign = Math.random() < 0.5 ? -1 : 1;
    gustActive = true;
    gustActiveT = 0.6;
    gustHit = false;
    gustTimer = 1.8 + Math.random() * 1.8;
    sfxGust();
  }
  if (gustActive) {
    gustActiveT -= dt;
    if (gustActiveT <= 0) gustActive = false;
  }
  if (gustActive && !gustHit && state.mode === 'flight') {
    const p = state.pony;
    if (Math.abs(p.x - gustX) < GUST_ZONE && p.y < groundY) {
      p.vy += gustSign * 420;
      gustHit = true;
    }
  }
}

// Caves-only obstacle: a lava column erupting from the ground at a
// relocating x. Same instant-miss shape as Mountains' lightning, but
// themed and triggered differently -- it only matters at low altitude
// (near the ground, where the lava actually reaches), so flying high
// through Caves dodges it entirely rather than needing to dodge every
// altitude the way a lightning bolt (sky to ground) does.
function isCaves() { return state.bgLevel % LOCATIONS.length === 4; }
const LAVA_ZONE = 55;
const LAVA_HEIGHT = 160; // how far up from the ground the column reaches
let lavaX = 0, lavaTimer = 1 + Math.random() * 2, lavaActive = false, lavaActiveT = 0;

function updateVolcano(dt) {
  if (!isCaves()) { lavaActive = false; return; }
  if (state.mode === 'flight') lavaTimer -= dt;
  if (lavaTimer <= 0) {
    lavaX = state.pony.x + 150 + Math.random() * 350;
    lavaActive = true;
    lavaActiveT = 0.5;
    lavaTimer = 2 + Math.random() * 2;
    sfxLava();
  }
  if (lavaActive) {
    lavaActiveT -= dt;
    if (lavaActiveT <= 0) lavaActive = false;
  }
  if (lavaActive && state.mode === 'flight') {
    const p = state.pony;
    if (Math.abs(p.x - lavaX) < LAVA_ZONE && p.y > groundY - LAVA_HEIGHT) endFlight(false);
  }
}

function resetLaunch() {
  state.mode = 'aim';
  state.bgLevel = state.level;
  state.originX = W * 0.22;
  state.originY = groundY;
  state.aimActive = false;
  state.aimDX = 0; state.aimDY = 0;
  state.power = 0;
  state.pony.x = state.originX; state.pony.y = state.originY;
  state.pony.vx = 0; state.pony.vy = 0; state.pony.rot = 0;
  state.flapsLeft = MAX_FLAPS;
  state.trail = [];
  state.hearts = [];
  camX = 0;
  placeTarget();
}

// Target distance is capped at what's actually reachable (simulated: ~1605px
// at full power/best angle with no flaps), so a target never asks for more
// than the physics can deliver, regardless of viewport size.
const TARGET_DIST_ABS_MIN = 300;
const TARGET_DIST_ACHIEVABLE_MAX = 1400;
const TARGET_HEIGHT_MIN = 50, TARGET_HEIGHT_MAX = 320;
const PONY_W = 140; // approx rendered pony width (world px), for "N pony-widths away" spacing

function placeTarget() {
  // visible world-span from the launch point to the right edge of screen
  const screenSpan = W - state.originX;
  // every full trip through all 5 locations ramps difficulty further --
  // targets sit farther past the screen edge and the target itself shrinks
  const cycle = Math.floor(state.level / LOCATIONS.length);

  let dist;
  let heightMax = TARGET_HEIGHT_MAX;
  if (state.level === 0 && state.levelHits < 3) {
    // level 1 tutorial ramp: target starts clearly on screen, then edges
    // off screen over the 3 hits needed to clear the level, teaching the
    // player that later levels require aiming beyond what's visible.
    // No ABS_MIN floor here -- short distances are always trivially
    // reachable, and enforcing it would push tier 0 off screen on narrow
    // viewports, defeating the point.
    const tier = state.levelHits; // 0, 1, 2
    heightMax = [130, 200, TARGET_HEIGHT_MAX][tier];
    if (tier === 0) {
      // "clearly on screen and close" as an absolute ~2 pony-widths away,
      // not a screenSpan fraction -- on narrow mobile viewports a fraction
      // like 0.35 put the target right on top of the pony (reported bug),
      // since screenSpan itself is small there
      dist = Math.min(screenSpan * 0.85, PONY_W * 2 + Math.random() * 40);
    } else {
      const distFrac = [null, 0.8, 1.05][tier] + Math.random() * 0.15;
      dist = Math.min(TARGET_DIST_ACHIEVABLE_MAX, screenSpan * distFrac);
    }
  } else {
    // blind aim: target sits just past the visible screen edge, and each
    // full cycle through all 5 locations pushes it further out
    const distFrac = 1.05 + Math.random() * 0.35 + cycle * 0.15;
    dist = Math.min(TARGET_DIST_ACHIEVABLE_MAX, Math.max(TARGET_DIST_ABS_MIN, screenSpan * distFrac));
  }
  state.target.x = state.originX + dist;
  state.target.y = groundY - (TARGET_HEIGHT_MIN + Math.random() * (heightMax - TARGET_HEIGHT_MIN));
  state.target.r = Math.max(30, 46 - cycle * 4);
}

resize();
resetLaunch();

// start screen: a couple lines of instructions, dismissed on first tap
// (sits above the canvas, so this tap doesn't also reach the aim logic)
let introVisible = true;
document.getElementById('intro').addEventListener('pointerdown', e => {
  e.currentTarget.remove();
  introVisible = false;
});

// ---------- HUD buttons ----------
function resetGame() {
  state.tries = 0;
  state.level = 0;
  state.levelHits = 0;
  state.bgLevel = 0;
  stopWindSound();
  resetLaunch();
  document.getElementById('tries').textContent = 0;
  document.getElementById('level').textContent = 1;
  document.getElementById('hits').textContent = 0;
  document.getElementById('flaps').textContent = 0;
}
document.getElementById('restart').addEventListener('pointerdown', resetGame);

const muteBtn = document.getElementById('mute');
muteBtn.addEventListener('pointerdown', () => {
  muteBtn.textContent = toggleMute() ? '🔇' : '🔊';
});

// ---------- input ----------
let pointerId = null;
// Drag vector is measured from the pony's on-screen position (same anchor
// drawAimUI draws the arrow from), not from wherever the finger first
// touched down. Anchoring to the touch-down point instead (tried
// previously) meant a finger placed slightly off the pony read as "nothing
// happens" until you dragged far enough to build a vector from that
// arbitrary point -- confusing, since the visible pull is relative to the
// pony on screen. This matches how slingshot games usually work (Angry
// Birds etc.): pull is measured from the fixed anchor, not the touch start.
function aimVectorFrom(e) {
  return [e.clientX - (state.pony.x - camX), e.clientY - state.pony.y];
}

// Angle+power from the raw drag vector. Touch/pen keep the slingshot feel
// (pull away from the throw direction, angle = opposite of the drag) --
// tested and confirmed to work well. Mouse instead always points at the
// cursor itself (angle = toward the drag vector, not away from it): with a
// mouse, users kept approaching this like a reticle -- moving the cursor
// above/in front of the pony instead of pulling back-and-down -- and since
// that's outside the slingshot's assumed drag direction, the angle read as
// "stuck" (clamped to the same edge value) instead of tracking the cursor.
// Power still comes from drag distance either way, unchanged.
const MAXD_FRAC = 0.28;
function computeAim(dx, dy, isMouse) {
  const MAXD = Math.min(W, H) * MAXD_FRAC;
  const dist = Math.min(Math.hypot(dx, dy), MAXD);
  const pow = dist / MAXD;
  let ang = isMouse ? Math.atan2(dy, dx) : Math.atan2(-dy, -dx);
  ang = Math.max(-Math.PI * 0.92, Math.min(-Math.PI * 0.08, ang));
  return [ang, pow];
}

cv.addEventListener('pointerdown', e => {
  startMusic();
  if (state.mode === 'aim') {
    pointerId = e.pointerId;
    state.aimActive = true;
    state.aimIsMouse = e.pointerType === 'mouse';
    [state.aimDX, state.aimDY] = aimVectorFrom(e);
    sfxAim();
  } else if (state.mode === 'flight') {
    doFlap();
  } else if (state.mode === 'result') {
    document.getElementById('tries').textContent = ++state.tries;
    resetLaunch();
  }
});
cv.addEventListener('pointermove', e => {
  if (state.mode === 'aim' && state.aimActive && e.pointerId === pointerId) {
    [state.aimDX, state.aimDY] = aimVectorFrom(e);
  }
});
cv.addEventListener('pointerup', e => {
  if (state.mode === 'aim' && state.aimActive && e.pointerId === pointerId) {
    launch();
  }
});

function doFlap() {
  if (state.flapsLeft <= 0) return;
  state.flapsLeft--;
  document.getElementById('flaps').textContent = MAX_FLAPS - state.flapsLeft;
  state.pony.vy -= FLAP_IMPULSE;
  sfxFlap();
  // little heart puff on flap, purely cosmetic
  for (let i = 0; i < 4; i++) {
    state.hearts.push({
      x: state.pony.x, y: state.pony.y,
      vx: (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 80,
      life: 0.6, age: 0, small: true
    });
  }
}

function launch() {
  const [ang, pow] = computeAim(state.aimDX, state.aimDY, state.aimIsMouse);
  state.power = pow;
  if (state.power < 0.08) { // too small, cancel
    state.aimActive = false;
    return;
  }
  state.angle = ang;

  const SPEED = 600 + state.power * 900;
  state.pony.vx = Math.cos(ang) * SPEED;
  state.pony.vy = Math.sin(ang) * SPEED;
  state.mode = 'flight';
  state.aimActive = false;
  startWindSound();

  // the charge pile scatters into rainbow poops on release
  const pileX = state.pony.x - 34, pileY = groundY;
  const n = 8 + Math.round(state.power * 10);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 100 + Math.random() * 220;
    state.hearts.push({
      x: pileX, y: pileY,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
      life: 0.9, age: 0, small: false, type: 'poop',
      color: stops[i % stops.length],
    });
  }
}

// ---------- update ----------
let last = performance.now();
function update(dt) {
  if (state.mode === 'flight') {
    const p = state.pony;
    p.vy += G * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    updateWindSound(Math.hypot(p.vx, p.vy));
    p.rot = Math.atan2(p.vy, p.vx);

    state.trail.push({ x: p.x, y: p.y });
    if (state.trail.length > 200) state.trail.shift();

    // camera keeps pony roughly at 30% of screen width while moving forward
    const desiredCamX = p.x - W * 0.3;
    camX += (desiredCamX - camX) * Math.min(1, dt * 6);
    if (camX < 0) camX = 0;

    // check target hit -- p.x/p.y is only the sprite's anchor point
    // (roughly the hooves); the visible body/neck/head/horn extend well
    // forward and above it. History: a fixed offset toward the "body
    // center" caught hits near the head but missed obvious ones near the
    // legs/anchor, and drifted further off as the sprite rotated (the
    // offset didn't rotate with it) -- replaced with a plain radius fudge
    // from the anchor (35px, target.r + 35 <= 81px), which fixed both of
    // those but was still reported as "hits without touching": a big
    // circle from a single point (the hooves) is generous toward anything
    // near the LEGS even when the visible body clearly doesn't reach that
    // far (2026-09-09 report, screenshot showing a real gap). Replaced with
    // a capsule: the segment from the anchor to the sprite's approximate
    // nose/muzzle point (PONY_NOSE_LX/LY, matching pony.js's SHAPES data,
    // rotated by the same rot*0.28 drawPony uses to tilt the sprite) plus a
    // tighter radius -- covers legs-end and head-end genuinely touching
    // the target without a same-size blind circle floating past the body.
    const bodyAngle = p.rot * 0.28;
    const noseX = p.x + PONY_NOSE_LX * Math.cos(bodyAngle) - PONY_NOSE_LY * Math.sin(bodyAngle);
    const noseY = p.y + PONY_NOSE_LX * Math.sin(bodyAngle) + PONY_NOSE_LY * Math.cos(bodyAngle);
    const PONY_HIT_RADIUS = 22;
    const dTgt = distToSegment(state.target.x, state.target.y, p.x, p.y, noseX, noseY);
    if (dTgt < state.target.r + PONY_HIT_RADIUS) {
      endFlight(true);
    } else if (p.y > groundY + 20 || p.x < -60 || p.x > state.target.x + W) {
      endFlight(false);
    }
  }

  updateWeather(dt);
  updateBirds(dt);
  updateWind(dt);
  updateVolcano(dt);

  // hearts physics (always update, used in result burst + flap puffs)
  for (const h of state.hearts) {
    h.age += dt;
    h.vy += G * 0.35 * dt;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
  }
  state.hearts = state.hearts.filter(h => h.age < h.life + 0.5);

  if (state.mode === 'result') {
    state.resultTimer += dt;
  }
}

function endFlight(won) {
  state.mode = 'result';
  state.won = won;
  state.resultTimer = 0;
  state.leveledUp = false;
  stopWindSound();
  if (won) {
    state.levelHits++;
    if (state.levelHits >= LEVEL_HITS_REQUIRED) {
      state.level++;
      state.levelHits = 0;
      state.leveledUp = true;
    }
    document.getElementById('level').textContent = state.level + 1;
    document.getElementById('hits').textContent = state.levelHits;
    if (state.leveledUp) sfxLevelUp(); else sfxHit();
  } else {
    sfxMiss();
  }
  if (!won) {
    // heart burst at crash point
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 260;
      state.hearts.push({
        x: state.pony.x, y: state.pony.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100,
        life: 1.1, age: 0, small: false
      });
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 160;
      state.hearts.push({
        x: state.target.x, y: state.target.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.9, age: 0, small: false
      });
    }
  }
}

// ---------- draw ----------
function currentLocation() { return LOCATIONS[state.bgLevel % LOCATIONS.length]; }

function drawSky() {
  const [top, bottom] = currentLocation().sky;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Generic ground-rising parallax layer: tiles shapeFn(screenX, baseY, h, i)
// every `spacing` world px, offset by camX * parallax so it scrolls at its
// own rate, with a per-tile height variation.
function drawLayer(parallax, spacing, hBase, hVar, baseYOffset, shapeFn) {
  const px = camX * parallax;
  const baseY = groundY + baseYOffset;
  const startI = Math.floor((px - W) / spacing);
  const endI = Math.ceil((px + W) / spacing);
  for (let i = startI; i <= endI; i++) {
    const screenX = i * spacing - px;
    const h = hBase + hVar * Math.abs(Math.sin(i * 12.9898 + parallax * 97));
    shapeFn(screenX, baseY, h, i);
  }
}

// -- location 1: mountains + trees --
const MOUNTAIN_LAYERS = [
  { parallax: 0.12, spacing: 260, hBase: 220, hVar: 60, color: '#c3c7e8' },
  { parallax: 0.20, spacing: 200, hBase: 190, hVar: 60, color: '#a9aede' },
  { parallax: 0.30, spacing: 160, hBase: 160, hVar: 50, color: '#8f96cf' },
];
function drawMountainShape(x, baseY, h, color) {
  const layers = 6;
  ctx.fillStyle = color;
  for (let i = 0; i < layers; i++) {
    const w = (layers - i) * 22;
    const lh = h / layers;
    ctx.fillRect(x - w / 2, baseY - lh * (i + 1), w, lh + 1);
  }
}
function drawMountains() {
  for (const layer of MOUNTAIN_LAYERS) {
    drawLayer(layer.parallax, layer.spacing, layer.hBase, layer.hVar, 4,
      (x, baseY, h) => drawMountainShape(x, baseY, h, layer.color));
  }
}
const TREE_COLORS = ['#4f9a3a', '#3f8a2f'];
function drawTreeShape(x, baseY, h, i) {
  const trunkW = 6, trunkH = 14;
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
  const layers = 3;
  ctx.fillStyle = TREE_COLORS[i & 1];
  for (let j = 0; j < layers; j++) {
    const w = (layers - j) * 16;
    const lh = h / layers;
    ctx.fillRect(x - w / 2, baseY - trunkH - lh * j - lh + 4, w, lh + 2);
  }
}
function drawTrees() { drawLayer(0.6, 70, 34, 14, 6, drawTreeShape); }

// Mountains' rain: pure atmosphere, no physics effect -- deterministic
// streaks driven by animT so no per-particle state is needed (same trick
// the parallax layers use, just screen-space instead of world-space).
function drawRain() {
  ctx.strokeStyle = 'rgba(210,225,255,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 36; i++) {
    const x = ((i * 53.7 + animT * 90) % (W + 60)) - 30;
    const y = ((i * 71.3 + animT * 620) % (H + 40)) - 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 10, y + 22);
    ctx.stroke();
  }
}

// Mountains' lightning bolt: a jagged line from sky to ground at the active
// strike's world x, in world space so it scrolls with the camera like the
// pony/target/trail do (drawn inside the same translate(-camX,0) block).
function drawLightningBolt() {
  if (!isMountains() || lightningFlash <= 0) return;
  ctx.strokeStyle = `rgba(255,255,180,${Math.min(1, lightningFlash * 1.5)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lightningX, 0);
  const segments = 6;
  for (let i = 1; i <= segments; i++) {
    const cy = (groundY / segments) * i;
    const cx = lightningX + Math.sin(i * 12.9898 + lightningX) * 18;
    ctx.lineTo(cx, cy);
  }
  ctx.stroke();
}

// -- location 0: heavens (soft cloud blobs instead of ground scenery) --
function drawCloudBgShape(x, baseY, h, color) {
  const r = h * 0.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, baseY - r, r * 1.3, r * 0.85, 0, 0, Math.PI * 2);
  ctx.ellipse(x - r * 0.85, baseY - r * 0.6, r * 0.8, r * 0.6, 0, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.85, baseY - r * 0.6, r * 0.8, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}
function drawHeavens() {
  drawLayer(0.15, 260, 70, 30, -220, (x, baseY, h) => drawCloudBgShape(x, baseY, h, 'rgba(255,255,255,0.85)'));
  drawLayer(0.32, 170, 46, 20, -90, (x, baseY, h) => drawCloudBgShape(x, baseY, h, 'rgba(255,240,218,0.95)'));
}

// -- location 2: city (building silhouettes) --
function drawBuildingShape(x, baseY, h, color) {
  const w = 30;
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, baseY - h, w, h);
  ctx.fillStyle = 'rgba(255,240,200,0.5)';
  for (let wy = baseY - h + 10; wy < baseY - 8; wy += 16) {
    ctx.fillRect(x - w / 2 + 6, wy, 4, 6);
    ctx.fillRect(x + w / 2 - 10, wy, 4, 6);
  }
}
function drawCity() {
  drawLayer(0.18, 90, 140, 90, 4, (x, baseY, h) => drawBuildingShape(x, baseY, h, '#8f97ad'));
  drawLayer(0.40, 60, 110, 70, 4, (x, baseY, h) => drawBuildingShape(x, baseY, h, '#6d7690'));
}

// City's bird flock: drawn in world space (inside the pony's own
// translate(-camX,0) block, not here) since birdX has to line up 1:1 with
// the real physics world x used for the headwind check.
// Flat filled pixel-art bird -- outline-then-fill rects, same technique
// pony.js uses, rather than thin stroked chevrons (looked out of place next
// to the unicorn's flat 2D style per user feedback).
function drawBirdShape(bx, by, flap) {
  ctx.fillStyle = '#20222c';
  ctx.fillRect(bx - 5, by - 4, 10, 8);
  ctx.fillRect(bx - 15, by - 4 - flap, 12, 6);
  ctx.fillRect(bx + 3, by - 4 - flap, 12, 6);
  ctx.fillStyle = '#5a5f6e';
  ctx.fillRect(bx - 4, by - 3, 8, 6);
  ctx.fillStyle = '#3f4350';
  ctx.fillRect(bx - 14, by - 3 - flap, 10, 4);
  ctx.fillRect(bx + 4, by - 3 - flap, 10, 4);
}
function drawBirds() {
  if (!isCity()) return;
  const y = groundY - 220;
  for (let i = 0; i < 4; i++) {
    const bx = birdX + (i - 1.5) * 26;
    const by = y + Math.sin(animT * 2 + i) * 10 + i * 6;
    const flap = Math.sin(animT * 10 + i) * 6;
    drawBirdShape(bx, by, flap);
  }
}

// Beach's wind gust: a few curved streaks at gustX, bowed in the direction
// the kick pushes (gustSign), in world space like the bird/lightning
// markers so it lines up with the real physics zone.
function drawWindGust() {
  if (!isBeach() || !gustActive) return;
  const y = groundY - 180;
  ctx.strokeStyle = 'rgba(90,170,220,0.85)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const gx = gustX + (i - 1) * 24;
    const gy = y + i * 12;
    ctx.beginPath();
    ctx.moveTo(gx - 14, gy + gustSign * 16);
    ctx.quadraticCurveTo(gx, gy, gx + 14, gy - gustSign * 16);
    ctx.stroke();
  }
}

// Caves' lava column: rises from the ground at lavaX while active; only
// dangerous near the ground (LAVA_HEIGHT), so it reads as a hazard to fly
// over rather than through, unlike lightning's full-height strike.
function drawLava() {
  if (!isCaves() || !lavaActive) return;
  const top = groundY - LAVA_HEIGHT;
  const grad = ctx.createLinearGradient(0, top, 0, groundY);
  grad.addColorStop(0, 'rgba(255,190,70,0.9)');
  grad.addColorStop(1, 'rgba(255,70,40,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(lavaX - 18, top, 36, groundY - top);
}

// -- location 3: beach (sea swell + palm trees) --
function drawSwellShape(x, baseY, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, baseY, 55, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}
function drawPalmShape(x, baseY, h) {
  const trunkW = 6;
  ctx.fillStyle = '#8a6a3a';
  ctx.fillRect(x - trunkW / 2, baseY - h, trunkW, h);
  ctx.fillStyle = '#3fae5c';
  for (const [dx, dy] of [[-14, -4], [14, -4], [0, -10], [-10, -12], [10, -12]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, baseY - h + dy, 14, 6, Math.atan2(dy, dx), 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawBeach() {
  drawLayer(0.2, 140, 34, 8, -18, (x, baseY, h) => drawSwellShape(x, baseY, h, '#8fd8ff'));
  drawLayer(0.5, 130, 60, 20, 4, (x, baseY, h) => drawPalmShape(x, baseY, h));
}

// -- location 4: caves (stalactites hanging from the ceiling) --
function drawStalactiteShape(x, topY, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 16, topY); ctx.lineTo(x + 16, topY); ctx.lineTo(x, topY + h);
  ctx.closePath(); ctx.fill();
}
function drawCavesCeilingLayer(parallax, spacing, hBase, hVar, color) {
  const px = camX * parallax;
  const startI = Math.floor((px - W) / spacing);
  const endI = Math.ceil((px + W) / spacing);
  for (let i = startI; i <= endI; i++) {
    const screenX = i * spacing - px;
    const h = hBase + hVar * Math.abs(Math.sin(i * 12.9898 + parallax * 97));
    drawStalactiteShape(screenX, 0, h, color);
  }
}
function drawCaves() {
  drawCavesCeilingLayer(0.15, 150, 70, 40, '#2b2b33');
  drawCavesCeilingLayer(0.35, 100, 50, 30, '#3c3c46');
}

function drawBackgroundLayers() {
  const idx = state.bgLevel % LOCATIONS.length;
  if (idx === 0) drawHeavens();
  else if (idx === 1) { drawMountains(); drawTrees(); drawRain(); }
  else if (idx === 2) drawCity();
  else if (idx === 3) drawBeach();
  else drawCaves();
}

function drawGround() {
  ctx.fillStyle = currentLocation().ground;
  ctx.fillRect(camX, groundY, W, H - groundY);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(camX, groundY); ctx.lineTo(camX + W, groundY); ctx.stroke();
}

function drawTarget() {
  const t = state.target;
  ctx.save();
  ctx.translate(t.x, t.y);
  // cloud puff target
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = 'rgba(120,150,190,0.6)';
  ctx.lineWidth = 2;
  for (const [ox, oy, r] of [[-18, 5, 20], [0, -8, 26], [20, 5, 20], [0, 13, 23]]) {
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawTrail() {
  if (state.trail.length < 2) return;
  ctx.lineCap = 'round';
  for (let i = 1; i < state.trail.length; i++) {
    const a = state.trail[i - 1], b = state.trail[i];
    const c = stops[i % stops.length];
    ctx.strokeStyle = c;
    const tail = i / state.trail.length; // 0 at the old end .. 1 near the pony
    ctx.globalAlpha = 0.15 + 0.55 * tail;
    ctx.lineWidth = 6 + 22 * tail; // thick as the body right behind the pony
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
}

function drawHearts() {
  for (const h of state.hearts) {
    const t = h.age / h.life;
    if (t > 1) continue;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.translate(h.x, h.y);
    const s = h.small ? 6 : 11;
    if (h.type === 'poop') drawPoopShape(s, h.color);
    else drawHeartShape(s);
    ctx.restore();
  }
}
function drawHeartShape(s) {
  ctx.fillStyle = '#ff5b8a';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.bezierCurveTo(-s, -s * 0.6, -s * 1.6, s * 0.5, 0, s * 1.4);
  ctx.bezierCurveTo(s * 1.6, s * 0.5, s, -s * 0.6, 0, s * 0.3);
  ctx.fill();
}
function drawPoopShape(s, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, s * 0.6, s * 0.9, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.7, s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -s * 0.55, s * 0.45, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
}

// charge pile: builds up under the tail while aiming, scatters on release
function drawChargePile() {
  if (state.mode !== 'aim' || !state.aimActive) return;
  const dist = Math.min(Math.hypot(state.aimDX, state.aimDY), Math.min(W, H) * 0.28);
  const pow = dist / (Math.min(W, H) * 0.28);
  if (pow <= 0) return;
  const px = state.pony.x - 34, py = groundY;
  const n = Math.max(1, Math.ceil(pow * 6));
  for (let i = 0; i < n; i++) {
    const w = 15 - i * 1.4;
    ctx.fillStyle = stops[i % stops.length];
    ctx.beginPath();
    ctx.ellipse(px, py - i * 6, Math.max(w, 4), 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Start-screen illustration: a hand pulling a demo pony back, plus a dashed
// arc showing the launch trajectory into a target cloud -- drawn at a fixed
// spot right under the intro text (not at the real pony's game position,
// which sits low/left on screen and read as unrelated background clutter)
// so the whole thing reads as one connected diagram, with word labels since
// the arrow-only version still wasn't clear enough per user testing.
function drawIntroDemo() {
  const px = W * 0.5, py = H * 0.56;
  const hx = px - 60, hy = py + 45;

  ctx.strokeStyle = 'rgba(80,60,120,0.7)';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx, hy); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.quadraticCurveTo(px + 80, py - 120, px + 170, py - 40);
  ctx.stroke();
  ctx.setLineDash([]);

  // arrowhead at the trajectory's end
  ctx.fillStyle = 'rgba(80,60,120,0.7)';
  ctx.beginPath();
  ctx.moveTo(px + 170, py - 40);
  ctx.lineTo(px + 156, py - 46);
  ctx.lineTo(px + 162, py - 30);
  ctx.closePath(); ctx.fill();

  // target cloud at the arrow's tip
  ctx.beginPath();
  ctx.arc(px + 178, py - 52, 12, 0, Math.PI * 2);
  ctx.arc(px + 190, py - 46, 9, 0, Math.PI * 2);
  ctx.arc(px + 168, py - 44, 9, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();

  // demo pony held at the pull point
  drawPony(ctx, px, py, -0.5, 0);

  // hand: a simple fist + thumb, pulling from behind
  ctx.fillStyle = '#f0b088';
  ctx.beginPath(); ctx.arc(hx, hy, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + 10, hy - 6, 7, 5, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(hx, hy, 16, 0, Math.PI * 2); ctx.stroke();

  // word labels so the mechanic is unmistakable, not just implied by arrows
  ctx.fillStyle = 'rgba(42,42,58,0.85)';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1. pull back', hx, hy + 30);
  ctx.fillText('2. let go', px + 172, py + 16);
}

function drawAimUI() {
  if (state.mode !== 'aim' || !state.aimActive) return;
  const p = { x: state.pony.x - camX, y: state.pony.y };
  const [ang, pow] = computeAim(state.aimDX, state.aimDY, state.aimIsMouse);

  // predicted arrow
  ctx.strokeStyle = 'rgba(80,60,120,0.55)';
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(ang) * 80 * (0.4 + pow), p.y + Math.sin(ang) * 80 * (0.4 + pow));
  ctx.stroke();
  ctx.setLineDash([]);

  // power bar
  const bw = 140, bh = 14, bx = W / 2 - bw / 2, by = H - 70;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  roundRect(bx, by, bw, bh, 7); ctx.fill();
  const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = grad;
  roundRect(bx, by, bw * pow, bh, 7); ctx.fill();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMinimap() {
  const mapW = 100, mapH = 60, pad = 10;
  const mx0 = W - mapW - pad, my0 = H - mapH - pad;

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  roundRect(mx0, my0, mapW, mapH, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(80,60,120,0.4)';
  ctx.lineWidth = 1.5;
  roundRect(mx0, my0, mapW, mapH, 6); ctx.stroke();

  const xMin = state.originX - 60;
  const xMax = state.target.x + 60;
  const yMin = Math.min(state.target.y, groundY - H * 0.9) - 40;
  const yMax = groundY + 10;
  const toMap = (wx, wy) => [
    mx0 + ((wx - xMin) / (xMax - xMin)) * mapW,
    my0 + ((wy - yMin) / (yMax - yMin)) * mapH,
  ];

  const [tx, ty] = toMap(state.target.x, state.target.y);
  ctx.fillStyle = '#5b8fd6';
  ctx.beginPath(); ctx.arc(tx, ty, 3, 0, 7); ctx.fill();

  const [px, py] = toMap(state.pony.x, state.pony.y);
  const cx = Math.max(mx0 + 3, Math.min(mx0 + mapW - 3, px));
  const cy = Math.max(my0 + 3, Math.min(my0 + mapH - 3, py));
  ctx.fillStyle = '#ff5b8a';
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
}

function drawResultText() {
  if (state.mode !== 'result') return;
  ctx.fillStyle = state.won ? '#2a9d4a' : '#c23b5b';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  const label = state.leveledUp ? 'Level up! 🌈' : state.won ? 'Made it!' : 'Missed…';
  ctx.fillText(label, W / 2, H * 0.3);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(40,40,60,0.6)';
  ctx.fillText('tap to try again', W / 2, H * 0.3 + 26);
  ctx.textAlign = 'left';
}

let animT = 0;

function render(dt) {
  animT += dt;
  drawSky();
  drawBackgroundLayers();

  ctx.save();
  ctx.translate(-camX, 0);
  drawGround();
  drawLightningBolt();
  drawBirds();
  drawWindGust();
  drawLava();
  drawTarget();
  drawTrail();
  drawHearts();
  drawChargePile();
  if (introVisible) {
    // hide the real (idle, off to the side) pony while the intro's own demo
    // pony is on screen -- two unicorns at once read as confusing, not helpful
    drawIntroDemo();
  } else if (!(state.mode === 'result' && !state.won)) {
    // Always use the pony's actual rotation, not just during 'flight'.
    // Forcing it upright (0) on the result screen looked like a false-
    // positive hit: the sprite froze level while the trail showed a steep
    // climb, so the horn/head that actually reached the target visually
    // wasn't where the target was anymore (user report: "юникорн реально
    // хитит облако не касаясь его"). state.pony.rot is already 0 during
    // 'aim' (reset in resetLaunch()), so this needs no special-casing.
    drawPony(ctx, state.pony.x, state.pony.y, state.pony.rot, animT);
  }
  ctx.restore();

  // screen-space flash from a lightning strike, on top of everything
  if (lightningFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${lightningFlash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }

  // screen-space UI (power bar, arrow, result text, minimap)
  drawAimUI();
  drawResultText();
  drawMinimap();
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.032);
  last = now;
  update(dt);
  render(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
