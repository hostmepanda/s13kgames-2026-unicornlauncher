import { drawPony } from './pony.js';
import { drawGrass } from './grass.js';

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
const stops = ['#ff3b3b', '#ff9d3b', '#ffe23b', '#3bff6e', '#3bb3ff', '#5b3bff', '#c23bff'];

const state = {
  mode: 'aim', // aim | flight | result
  originX: 0, originY: 0,
  aimActive: false,
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
};

let camX = 0; // world-space camera offset (screen_x = world_x - camX)

function resetLaunch() {
  state.mode = 'aim';
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

function placeTarget() {
  // target is placed further out in world space now that we scroll
  state.target.x = state.originX + W * (0.9 + Math.random() * 0.9);
  state.target.y = groundY - (50 + Math.random() * H * 0.4);
}

resize();
resetLaunch();

// ---------- input ----------
let pointerId = null;
cv.addEventListener('pointerdown', e => {
  if (state.mode === 'aim') {
    pointerId = e.pointerId;
    state.aimActive = true;
    state.aimStartX = e.clientX; state.aimStartY = e.clientY;
    state.aimDX = 0; state.aimDY = 0;
  } else if (state.mode === 'flight') {
    doFlap();
  } else if (state.mode === 'result') {
    document.getElementById('tries').textContent = ++state.tries;
    resetLaunch();
  }
});
cv.addEventListener('pointermove', e => {
  if (state.mode === 'aim' && state.aimActive && e.pointerId === pointerId) {
    state.aimDX = e.clientX - state.aimStartX;
    state.aimDY = e.clientY - state.aimStartY;
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
  // drag down-back = power+angle. Clamp drag vector.
  let dx = state.aimDX, dy = state.aimDY;
  // we want dragging DOWN-LEFT (away from throw direction) to build power,
  // similar to slingshot: throw direction is opposite drag.
  let dist = Math.hypot(dx, dy);
  const MAXD = Math.min(W, H) * 0.28;
  dist = Math.min(dist, MAXD);
  state.power = dist / MAXD;
  if (state.power < 0.08) { // too small, cancel
    state.aimActive = false;
    return;
  }
  let ang = Math.atan2(-dy, -dx); // opposite of drag direction
  // clamp angle to sensible launch range (mostly upward-forward)
  ang = Math.max(-Math.PI * 0.92, Math.min(-Math.PI * 0.08, ang));
  state.angle = ang;

  const SPEED = 600 + state.power * 900;
  state.pony.vx = Math.cos(ang) * SPEED;
  state.pony.vy = Math.sin(ang) * SPEED;
  state.mode = 'flight';
  state.aimActive = false;
}

// ---------- update ----------
let last = performance.now();
function update(dt) {
  if (state.mode === 'flight') {
    const p = state.pony;
    p.vy += G * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot = Math.atan2(p.vy, p.vx);

    state.trail.push({ x: p.x, y: p.y });
    if (state.trail.length > 200) state.trail.shift();

    // camera keeps pony roughly at 30% of screen width while moving forward
    const desiredCamX = p.x - W * 0.3;
    camX += (desiredCamX - camX) * Math.min(1, dt * 6);
    if (camX < 0) camX = 0;

    // check target hit
    const dTgt = Math.hypot(p.x - state.target.x, p.y - state.target.y);
    if (dTgt < state.target.r) {
      endFlight(true);
    } else if (p.y > groundY + 20 || p.x < -60 || p.x > state.target.x + W) {
      endFlight(false);
    }
  }

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

// Mountains: a back parallax layer, drawn in screen space using its own
// camX * MOUNTAIN_PARALLAX offset (not the world ctx.translate other
// drawing uses), so it scrolls slower than the foreground.
const MOUNTAIN_PARALLAX = 0.3;
const MOUNTAIN_SPACING = 180;
const MOUNTAIN_COLORS = ['#a9b0d6', '#9199c9'];

function drawMountain(x, baseY, h, color) {
  const layers = 5;
  ctx.fillStyle = color;
  for (let i = 0; i < layers; i++) {
    const w = (layers - i) * 24;
    const lh = h / layers;
    ctx.fillRect(x - w / 2, baseY - lh * (i + 1), w, lh + 1);
  }
}

function drawMountains() {
  const px = camX * MOUNTAIN_PARALLAX;
  const baseY = groundY + 4;
  const startI = Math.floor((px - W) / MOUNTAIN_SPACING);
  const endI = Math.ceil((px + W) / MOUNTAIN_SPACING);
  for (let i = startI; i <= endI; i++) {
    const screenX = i * MOUNTAIN_SPACING - px;
    const h = 90 + 40 * Math.abs(Math.sin(i * 12.9898));
    drawMountain(screenX, baseY, h, MOUNTAIN_COLORS[i & 1]);
  }
}

function drawGround() {
  ctx.fillStyle = '#bfe8b8';
  ctx.fillRect(camX, groundY, W, H - groundY);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(camX, groundY); ctx.lineTo(camX + W, groundY); ctx.stroke();

  // grass tufts so scrolling motion reads clearly
  const spacing = 34;
  const startX = Math.floor(camX / spacing) * spacing;
  for (let gx = startX; gx < camX + W + spacing; gx += spacing) {
    const scale = 1.3 + 0.5 * Math.abs(Math.sin(gx * 0.37));
    drawGrass(ctx, gx, groundY + 2, scale);
  }
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
  for (let i = 1; i < state.trail.length; i++) {
    const a = state.trail[i - 1], b = state.trail[i];
    const c = stops[i % stops.length];
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.15 + 0.55 * (i / state.trail.length);
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawHearts() {
  for (const h of state.hearts) {
    const t = h.age / h.life;
    if (t > 1) continue;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.translate(h.x, h.y);
    const s = h.small ? 6 : 11;
    drawHeartShape(s);
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

function drawAimUI() {
  if (state.mode !== 'aim' || !state.aimActive) return;
  const p = { x: state.pony.x - camX, y: state.pony.y };
  let dx = state.aimDX, dy = state.aimDY;
  const dist = Math.min(Math.hypot(dx, dy), Math.min(W, H) * 0.28);
  const ang = Math.atan2(-dy, -dx);
  const clampedAng = Math.max(-Math.PI * 0.92, Math.min(-Math.PI * 0.08, ang));
  const pow = dist / (Math.min(W, H) * 0.28);

  // predicted arrow
  ctx.strokeStyle = 'rgba(80,60,120,0.55)';
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(clampedAng) * 80 * (0.4 + pow), p.y + Math.sin(clampedAng) * 80 * (0.4 + pow));
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

function drawResultText() {
  if (state.mode !== 'result') return;
  ctx.fillStyle = state.won ? '#2a9d4a' : '#c23b5b';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.won ? 'Made it! 🌈' : 'Missed…', W / 2, H * 0.3);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(40,40,60,0.6)';
  ctx.fillText('tap to try again', W / 2, H * 0.3 + 26);
  ctx.textAlign = 'left';
}

let animT = 0;

function render(dt) {
  animT += dt;
  ctx.clearRect(0, 0, W, H);

  drawMountains();

  ctx.save();
  ctx.translate(-camX, 0);
  drawGround();
  drawTarget();
  drawTrail();
  drawHearts();
  if (!(state.mode === 'result' && !state.won)) {
    drawPony(ctx, state.pony.x, state.pony.y, state.mode === 'flight' ? state.pony.rot : 0, animT);
  }
  ctx.restore();

  // screen-space UI (power bar, arrow, result text)
  drawAimUI();
  drawResultText();
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.032);
  last = now;
  update(dt);
  render(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
