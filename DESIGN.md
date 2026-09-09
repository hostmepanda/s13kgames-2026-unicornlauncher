# Unicorn Launch — Design

**js13kgames candidate** (theme: **Unicorns and Rainbows**), hard 13KB zip
limit — every scope decision is made with the byte budget in mind.

Genre: **launch game / hold-to-charge** (references: Learn to Fly, Toss the
Turtle, slingshot mechanic from Angry Birds). Mobile-first, touch controls.

> **Project rule: code, in-code comments, all documentation, and git commit
> messages — English only, no exceptions.**

For repo structure and the build pipeline, see [README.md](README.md).

---

## 1. Concept

The unicorn charges up on rainbow power (a "fuel" analog — visually the tail
builds up a rainbow charge), launches on a parabolic arc toward a target
(cloud), and its trajectory can be nudged slightly mid-flight via mane flaps.
A miss = the unicorn crashes, but instead of blood — hearts burst out
(cartoonish, non-dark tone).

No text/story — all feedback is through visuals and particles, same as in
Rainbow Elevator.

---

## 2. Game loop (4 phases)

### Phase 1 — Aim
- The player presses and drags a finger away from the unicorn, in the
  direction opposite to the throw (slingshot logic: pull back-down → flies
  forward-up)
- The drag vector is measured from the pony's on-screen position (same
  anchor `drawAimUI()` draws the arrow from), not from wherever the finger
  first touched down (`aimVectorFrom(e)` in `src/main.js`, fixed
  2026-08-24). Anchoring to the touch-down point instead — the original
  implementation — meant a finger that landed even slightly off the pony
  computed its pull relative to that arbitrary point instead of the visible
  pony, which read as "nothing happens" or "the angle doesn't respond."
  Matches how slingshot games usually work (Angry Birds etc.): the pull is
  relative to the fixed anchor, not the touch start
- While held — a power indicator grows (a linear bar at the bottom of the
  screen with a rainbow gradient fill)
- Also while held — a "ball pit" builds up under the unicorn (see revision
  below for the current design; originally a power-scaled poop mound)
- **Revision 1 (2026-09-09, "супер красивыми," pile should look more like
  actual poop and bury the pony up to the neck)**: a poop-swirl mound
  (outline+fill+highlight, same trick `pony.js` uses), wide at the base and
  narrowing toward the top, scaled by drag power.
- **Revision 2 (2026-09-09, same day, user: "не не, давай сделаем что это
  шарики" — make them balls instead, filling continuously over ~7s up to
  the neck and no further, "похожее на типа феерверк")**: replaced the
  poop mound with a **ball pit**, and switched the fill trigger from drag
  *power* to hold *time* — `state.aimHoldTime` accumulates while
  `state.mode === 'aim' && state.aimActive` (reset on each new aim
  gesture), and `drawChargePile()` reveals a growing prefix of a fixed
  pyramid of resting spots (`BALL_SLOTS`, built once at module load: rows
  bottom-heavy, narrowing upward) based on `min(1, aimHoldTime /
  FILL_TIME)` (`FILL_TIME = 7`). Height caps at `NECK_H = 52px` (matching
  the sprite's own neck height, same anchor math as `PONY_NOSE_LX/LY`
  above) regardless of how much longer the hold continues — already-placed
  balls never move or reshuffle, so the pile visibly stops growing rather
  than the mound's old power-based instant resize. `drawBallShape()` is the
  same outline+fill+highlight trick, just a glossy sphere instead of a
  poop swirl. Still drawn *after* the pony in `render()` (unchanged from
  revision 1) so it occludes/buries the lower body as it fills.
- The "фейерверк" (firework) feel once capped: `updateFirework()` spawns a
  couple of small plus-shaped "spark" glints (`drawSparkShape()`, reusing
  the heart/poop particle array with a new `type:'spark'`) every ~0.12s at
  the pile's current fill height, for as long as the aim is held --
  including well past the cap, since the pile itself can't visually convey
  "still pouring in" once it stops growing.
- **Revision 3 (2026-09-10, user: "выглядит не очень," wants the cartoon
  "unicorn riding a solid rainbow" reference, in the game's own blocky
  pixel-art style rather than the reference's smooth curves, applied to
  both charging *and* flight)**: replaced the ball pit with a **solid
  striped rainbow ribbon**. `RIBBON_SPINE` is a fixed wavy path (built once
  at module load, a sine-wave sway from the ground up to `NECK_H`);
  `drawChargePile()` still reveals a growing prefix of it exactly as the
  ball pit did (same `aimHoldTime`/`FILL_TIME` timing, same cap logic), but
  hands the revealed points to a new `drawRibbon(points, thickness)` that
  draws all 7 ROYGBIV bands as parallel perpendicular-offset strokes along
  the path -- a flat, striped ribbon instead of a pile of separate shapes.
  `drawTrail()` (Phase 3 below) got the same band-offset treatment so the
  flight trail is now the same solid ribbon instead of a single
  cycling-color line -- the pony visibly "rides" a rainbow exactly like the
  reference, just rendered as flat pixel-art stripes instead of smooth
  cartoon curves, consistent with the rest of the game's look. Both share
  the perpendicular-offset technique but stayed as two separate functions
  since `drawTrail()` needs a per-segment taper (alpha/width) `drawRibbon()`
  doesn't.
- Throw angle is clamped to a sane range (-0.92π to -0.08π, i.e. almost
  straight up to almost horizontal-forward, never backward/down)
- Too short a gesture (< 8% of max radius) — aiming is cancelled, nothing
  happens
- **Mouse aims at the cursor, touch/pen keeps the slingshot pull (2026-09-09)**:
  `computeAim(dx, dy, isMouse)` branches the angle calc — `isMouse` (from
  `e.pointerType === 'mouse'`, stored as `state.aimIsMouse` on
  `pointerdown`) uses `atan2(dy, dx)` (angle toward the drag vector, i.e.
  toward the cursor), everything else keeps `atan2(-dy, -dx)` (opposite of
  drag, the slingshot pull described above). Power is unaffected either
  way — still drag distance from the anchor. User feedback: with a mouse,
  people approached this like a reticle (moving the cursor above/in front
  of the pony) rather than pulling back-and-down: since that's outside the
  slingshot's assumed drag direction, the angle read as clamped/stuck
  instead of tracking the cursor. Deliberately scoped to mouse only —
  touch/pen keep the already-tested-and-confirmed slingshot feel. Shared
  between `launch()` and `drawAimUI()`'s preview arrow so they can't drift
  apart.

### Phase 2 — Release
- Releasing the finger converts the accumulated power into launch speed:
  `speed = BASE_SPEED + power * POWER_MULT` (600 + power*900)
- Initial vx/vy are computed from angle and speed
- The rainbow ribbon bursts into confetti on release: however much of
  `RIBBON_SPINE` had actually been revealed (`fillFrac`, not a flat count)
  scatters as small blocky chips (`type:'confetti'`, `drawConfettiShape()`,
  each with a fixed random `rot` set at spawn so they don't jitter frame to
  frame), reusing the same particle array/physics as the heart bursts
- From there it's ballistics: gravity constantly pulls down (G=1400 px/s²)

### Phase 3 — Flight (with correction)
- The player can tap the screen for a "mane flap" — gives an upward vertical
  impulse (`FLAP_IMPULSE = 480`)
- **Limited flap budget — 3 per attempt** (important for balance: full
  control kills the significance of a precise launch, zero correction makes
  the game purely random)
- The camera follows the unicorn horizontally (the world scrolls, the unicorn
  is held at roughly 30% of screen width from the left edge)
- A solid multi-band rainbow ribbon follows the unicorn (`drawTrail()`, all
  7 ROYGBIV bands drawn as parallel perpendicular-offset strokes per
  segment along `state.trail`'s position history -- see Phase 1's revision
  3 above), thick as the body right behind the pony and tapering
  thinner/fainter toward the older end. Originally a single cycling-color
  line; upgraded alongside the charge-up ribbon so the pony visibly rides
  one continuous rainbow from charge-up through flight.

### Phase 4 — Result
- **Hitting the target**: history of this check, in order --
  1. A fixed offset toward the body's visual center: fixed misses near the
     head but broke obvious hits near the legs/anchor, and drifted further
     off as the sprite rotated since the offset didn't rotate with it.
  2. A rotation-independent radius fudge from the raw anchor point
     (2026-08-24), `target.r + PONY_HIT_RADIUS`. Started at 55, tightened
     to 35 the same day (max combined radius ~101px → ~81px) since 55 read
     as "hit registers when clearly far away" against a ~46px cloud icon.
  3. **Rendering bug, not a collision bug (2026-09-09, user report:
     "единорог хитит облако реально не касаясь его")**: the result-screen
     render forced the pony's rotation to 0 instead of its actual rotation
     at impact, so a steep-angle hit froze upright and visually moved the
     horn/head away from the target -- the hitbox was fine, only the
     frozen pose was wrong. Fixed by always using `state.pony.rot`.
  4. **Still reported after (3) (2026-09-09, second screenshot, `tries: 14`
     -- an experienced run, not a fluke)**: a single generous circle from
     the anchor is inherently loose toward anything near the *legs* end
     even when the visible body clearly doesn't reach the target -- the
     anchor-radius model can't distinguish "target near the hooves" from
     "target near the hooves but the rest of the body points away from
     it." Replaced with a **capsule**: the segment from the anchor to the
     sprite's approximate muzzle point (`PONY_NOSE_LX/LY = 91,-68`, read
     off the muzzle-bump rect in `pony.js`'s `SHAPES`, rotated by the same
     `rot*0.28` `drawPony` uses to tilt the sprite) via `distToSegment()`,
     with a tighter `PONY_HIT_RADIUS = 22`. This covers legs-end and
     head-end contact the way the anchor-only version did (verified: the
     steep-rotation legs-near-target regression test from step 2 still
     hits) without a same-size blind circle extending past whichever end
     of the body isn't actually near the target. Verified with a battery
     of synthetic scenarios (Node script mimicking the exact math, not
     just eyeballing screenshots): the reported far-gap case now misses,
     the old near-legs regression still hits, a target at the muzzle tip
     hits, a target perpendicular to the body axis misses.
  → success, heart particles around the target, positive text feedback,
  and the level's hit counter (`level N · hits/3` in the HUD) increments.
  On the 3rd hit the level advances (`state.level++`, hits reset to 0,
  result text reads "Level up!" instead of "Made it!")
- **Miss** (fell to the ground or flew past a reasonable zone) → the pony
  "vanishes," replaced by a burst of hearts (10-14 of them, scattered at
  random angles with gravity), negative text feedback, hit counter unchanged
- Tapping the screen in this phase → reset and a new attempt (attempt counter
  in the HUD increases)

---

## 3. Unicorn visual design

Pixel-art style (`src/pony.js`), not smooth vector shapes: the sprite is a
small list of rectangles (`[x0,y0,x1,y1,color]`, local-unit coordinates)
rendered with `fillRect` blocks. A dark outline is auto-generated at render
time — every rect is first drawn inflated by 1 unit in outline color, then
the real fills go on top — so the shape list itself only needs region
colors, not hand-drawn edges.

The sprite (as of 2026-08-25) is modeled on a hand-drawn chibi unicorn
sketch — rounded/chunky body, blocky muzzle, a big rounded mane blob
(rather than thin bands), a curled hook-shaped tail, lavender leg/belly
shading — mirrored to face **right** (head/horn toward positive x) to
match the forward flight direction. The sketch itself has no wings; wings
were kept from the previous design per explicit direction (the "Unicorns
and Rainbows" rainbow mane/tail/tip was also kept rather than the sketch's
single-color pink, for the same reason).

Earlier iterations, for context: a chibi-rainbow-icon style, then a
faithful tan horse-icon recreation with horn+wings added on top, were each
replaced/reworked after feedback that they read as "hamster", "dragon",
and "dog" respectively — the lesson from that round was to nail a
recognizable horse silhouette first, then layer fantasy elements on top.
This chibi-sketch pass is a deliberate style pivot away from "realistic
horse silhouette" back toward "cute icon," matching the reference the user
provided directly rather than a from-scratch horse study.

- Head — rounded main mass + a distinct blocky muzzle bump (stepped, not
  tapered), single eye, small lavender ear with a shadow patch at its base
- Horn — short two-tone gold horn with a pink "collar" cap where it meets
  the head
- Wing — two clean white blocks, base flush against the body's back edge
  (a busier multi-segment rainbow-tipped version, tried first, read as
  visual noise crammed next to the mane/tail cluster at this scale)
- Mane — a big rounded rainbow blob (3 fat bands, not thin diagonal
  stripes) draping from the top of the head down the back of the short,
  compact neck
- Body — rounded white barrel with a large lavender belly/hip patch
- Tail — curled rainbow hook (5 segments sweeping down then back up),
  drawn behind the body
- Legs — front pair white, back pair lavender-socked, pink hoof tips —
  each pair's two legs sit flush against each other (no gap), reading as
  one wide leg-mass per side rather than 4 separate thin legs
- Animation — front leg pair and back leg pair bob in opposite phase during
  flight (`Math.sin(t*10)`, rounded to whole pixels to stay crisp)

Overall scale is controlled by `PONY_SCALE` in `src/pony.js` — the unicorn
should read as a large, "main" object on screen, not a small detail.

---

## 4. Camera and world

- The game scrolls horizontally: `camX` is the world camera offset
- During flight the camera smoothly (`lerp`, coefficient ~6*dt) adjusts to
  keep the unicorn at ~30% of screen width
- The target (cloud) is placed by `placeTarget()` in `src/main.js`
  (updated 2026-08-23), capped at a physics-achievable distance
  (`TARGET_DIST_ACHIEVABLE_MAX = 1400px`, comfortably under the simulated
  max range of ~1605px at full power/no flaps, ~2991px with 3 well-timed
  flaps) so a target is never physically out of reach regardless of
  viewport. Two placement modes:
  - **Blind aim** (default, all levels once past the level-1 tutorial):
    distance is `screenSpan * (1.05-1.4)` where `screenSpan = W -
    originX` — i.e. always just past the visible screen edge, requiring
    the player to aim without seeing the target (helped by the minimap).
    This intentionally scales with viewport (unlike the old flat range,
    which was a bug — see git history) because "off screen" is inherently
    a viewport-relative concept, while the achievable-distance cap keeps
    it from becoming impossible on very wide windows.
  - **Level-1 tutorial ramp**: the first level's 3 required hits (with a
    lower max height for the first two) — target starts clearly on screen,
    edges to the border, then just past it, teaching the blind-aim
    mechanic before the rest of the game relies on it every time. Tier 0
    ("clearly on screen and close") is `PONY_W*2 + rand(0,40)` — an
    absolute ~2 pony-widths (`PONY_W = 140`), clamped to `screenSpan*0.85`
    so it still fits on narrow phones. Originally this was a `screenSpan`
    fraction (0.35-0.5) like the other two tiers, which put the target
    right on top of the pony on narrow mobile viewports (reported bug,
    fixed 2026-08-24) since screenSpan itself is small there — a fraction
    of a small number stays small, while "2 pony-widths" doesn't. Tiers 1
    and 2 stayed screenSpan fractions (0.8-0.95, 1.05-1.2) since "near the
    edge" / "just past it" are inherently screen-relative concepts.
- In the aim/result phases the camera doesn't move (aim and result are static
  screens)
- The ground is lined with pixel-art grass tufts (`src/grass.js`, same
  rect-list + auto-outline technique as the pony), spaced ~34 world px
  apart with a per-tuft scale jitter so the scroll reads clearly instead of
  a flat fill

---

## 5. Tuning parameters

| Parameter | Value | Description |
|---|---|---|
| `G` | 1400 px/s² | gravity |
| `FLAP_IMPULSE` | 480 | impulse of one upward flap (instant px/s added to vy) |
| `MAX_FLAPS` | 3 | correction limit per attempt |
| `BASE_SPEED` | 600 | minimum launch speed |
| `POWER_MULT` | 900 | extra speed from fully charged power |
| `MAXD` (aim) | min(W,H)*0.28 | max gesture radius for 100% power |
| Throw angle | -0.92π..-0.08π | launch direction clamping |
| Target radius | 46px | matching the enlarged pony scale |
| `PONY_SCALE` | 2.4 | unicorn size multiplier (in `src/pony.js`) |

All constants are candidates for balance tuning during playtesting, not final
numbers. Source of truth is `src/main.js`; this table is a quick-reference
for design discussions, keep it in sync when values change.

---

## 6. Tone and style (important to preserve)

- **No story text**, minimal UI text (counters, short result text)
- **Miss ≠ violence** — hearts instead of blood/wreckage, the tone stays cute
  even in a "failure" moment
- All emotion comes through particles and color, not text

---

## 7. Resolved decisions (session 2026-08-20)

- **Platform**: js13k candidate, not a standalone game. All technical
  decisions are made with the 13KB zip budget in mind.
- **Progression**: **levels**, not an infinite arcade loop and not
  meta-progression with upgrades/currency. Reasoning: from a js13k budget
  perspective, levels cost almost no extra code — it's a data array (distance
  to target, obstacle set per level) reusing all the existing
  aim/flight/result code. Meta-progression would require a separate upgrade
  UI screen, currency tracking, and persistent save/load — disproportionately
  expensive in bytes for a jam game. Level advance requires **3 hits per
  level** (`LEVEL_HITS_REQUIRED` in `src/main.js`), tracked in the HUD and
  persisting across misses/retries within the level; persistence
  (localStorage, last cleared level) is optional and can be cut if space
  runs short.
- **Obstacles** (clouds/wind): yes, introduced gradually as part of level
  progression (difficulty ramps as you advance), not as a separate system
  from the start.
- **Sound effects**: done (2026-08-23), see section 12. Background music is
  a separate, later step (deliberately split so each can be reasoned about
  and byte-costed on its own).
- **Power indicator**: keeping it as-is — the linear bar at the bottom of the
  screen with a rainbow gradient. Not moving it onto the tail (added
  complexity for polish isn't justified right now).

## 8. Parallax background checklist (session 2026-08-22, in progress)

Building incrementally, one item at a time, not all at once:

- [ ] Sun — arcs across the sky over elapsed attempt time (not tied to
  camera/distance scrolled), so a long hang time in flight visibly moves it
  further than a short one
- [x] Parallax layer: mountains — now **3 layers** (`MOUNTAIN_LAYERS` in
  src/main.js), tall, with close parallax factors (0.12/0.20/0.30) so they
  drift slowly relative to each other; each drawn in screen space with its
  own `camX * parallax` offset (not inside the world `ctx.translate`)
- [x] Parallax layer: trees — faster-scrolling than the mountain layers
  (`TREE_PARALLAX = 0.6`), front layer (behind the pony/ground, in front of
  mountains)
- [ ] Grass tufts (`src/grass.js`) — temporarily removed from the ground
  while tuning the mountain/tree layers; module still exists, just unused
  in `drawGround()` for now, re-add later
- [x] Location system (2026-08-23): all 5 locations built (`LOCATIONS` in
  `src/main.js`), cycling by `state.level % LOCATIONS.length`. Each has a
  sky gradient, a ground color, and its own pair of parallax layers via a
  shared `drawLayer(parallax, spacing, hBase, hVar, baseYOffset, shapeFn)`
  helper (mountains/city/beach reuse it; caves' ceiling-hung stalactites
  anchor from the top of screen instead, so they use their own small loop).
  Zip cost for all 4 new locations: ~1600 bytes (4331 -> 4908), in line
  with the section-11 estimate.
- [ ] (later, separate pass) Obstacles: headwind birds, wind gusts, a
  volcano eruption — not part of this parallax pass, see section 11 for
  which location each one belongs to

## 9. Minimap

Bottom-right corner HUD panel (`drawMinimap()` in `src/main.js`, screen
space, drawn every frame alongside the other UI so it's always visible in
every phase): a rounded rect panel with two dots — pink for the pony, blue
for the target cloud. World coordinates are mapped into panel space each
frame from `state.originX`/`state.target.x` (horizontal bounds) and
`state.target.y`/a fixed high-altitude bound (vertical bounds, generous
enough to cover a near-vertical launch), clamped to stay inside the panel.
Since it just re-reads live state every frame, pony motion during flight
shows up automatically, no separate animation/trail logic needed.

## 10. Sound effects (session 2026-08-23)

`src/sound.js` — procedural WebAudio SFX, no samples/files. A single
`tone(freq, dur, type, vol, freqEnd)` helper creates one oscillator +
gain-envelope (exponential decay) per call; each named SFX is just a
couple of `tone()` calls with different parameters:

- `sfxAim()` — pointerdown in aim mode (drag start)
- `sfxFlap()` — each mane flap in flight
- `sfxHit()` — target hit (not the level's 3rd)
- `sfxLevelUp()` — target hit that completes the level (two ascending
  tones instead of one)
- `sfxMiss()` — crash

Plus a continuous **wind whoosh** for the flight phase: a looping 1-second
noise `AudioBuffer` through a bandpass filter, gain ramped in/out
(`startWindSound()`/`stopWindSound()`) to avoid clicks, filter cutoff
tracking current speed each frame (`updateWindSound(speed)` called from
`update()`) so faster/steeper launches sound windier.

`AudioContext` is created lazily on the first call, always from within a
user-gesture handler (pointerdown), so it never hits autoplay-policy
issues. Total cost: ~250 bytes zipped for the 5 one-shot SFX, ~260 more
for the wind loop — sound effects turned out to be one of the cheapest
features added so far, in line with the pre-implementation estimate in
the "how much can we spend on sound" discussion.

**Background music** (2026-08-23, split from SFX as planned; extended
2026-08-24 per feedback -- liked the melody, asked for it longer/more
complex): a looping step sequencer in the same file. Notes are semitone
offsets from middle C run through `NOTE(n) = 261.63 * 2^(n/12)` rather than
a stored frequency table (cheaper). One 32-step pattern, C major,
I-V-vi-IV-IV-I-ii-V (8 chords, doubled from the original 4-chord/16-step
loop) -- three voices, all built from `tone()`:
- `MELODY` (triangle) -- more contour/passing tones than the original
  arpeggio-only version
- `BASS` (sine) -- root note pulsing twice per chord instead of once
- `SPARKLE` (sine, quiet) -- sparse high off-beat accents for shimmer

`playMusicStep()` fires on a `setInterval(..., STEP*1000)` (150ms per
16th note); no lookahead scheduler, which can drift slightly under heavy
load but is fine for a casual game and much cheaper in bytes.
`startMusic()` is called from the same `pointerdown` handler as the other
SFX (guarded so it only starts once) so it always begins within a user
gesture, then loops forever -- there's no stop/mute control yet. Cost:
~146 bytes zipped for the original version, +~57 more for the
longer/3-voice version -- array-driven note data compresses well, so
"twice as long, 3 voices instead of 2" was still cheap.

## 11. Levels / locations plan (session 2026-08-23)

**5 levels, each a distinct location** (not an infinite arcade loop, not
meta-progression — see section 7). Order (session 2026-08-23, updated from
the original easy→hard draft):

| # | Location | Notes | Obstacle introduced |
|---|---|---|---|
| 1 | Heavens | clouds/glow instead of ground scenery — intro level. Background built 2026-08-23 (floating cloud-blob layers, warm gold sky) | none |
| 2 | Mountains | background built (3-layer parallax + trees) | rain + lightning |
| 3 | City | background built 2026-08-23 (building silhouettes, tiny window highlights) | headwind birds |
| 4 | Beach | background built 2026-08-23 (palm trees, sea swell, sand ground) | wind gusts (sideways drift in flight) |
| 5 | Caves | background built 2026-08-23 (ceiling stalactites, dark sky, rock ground), finale | volcano eruption (lava/underground) |

All four non-Heavens locations now have their obstacle implemented (see
the per-location write-ups below); Heavens stays obstacle-free by design.

**Difficulty ramps per full cycle** (2026-08-23): looping back to Heavens
after Caves isn't a flat repeat. `placeTarget()` computes
`cycle = Math.floor(state.level / LOCATIONS.length)` and uses it to push
blind-aim targets farther out (`+ cycle * 0.15` on the distance fraction,
still capped at `TARGET_DIST_ACHIEVABLE_MAX`) and shrink the target radius
(`46 - cycle * 4`, floored at 30). The level-1-style tutorial ramp only
ever applies at `state.level === 0` (the very first time through), not on
later cycles.

**Background switch timing** (2026-08-23): the location shown while
playing is `state.bgLevel`, not `state.level` directly. `state.level`
advances the instant the 3rd hit lands (so the HUD's "level N" updates
immediately), but `state.bgLevel` only syncs to it inside `resetLaunch()`
— i.e. when the player taps to start the next attempt. This was a
deliberate fix: previously the background swapped mid-result-screen, right
when the hit registered, which read as jarring. Now the just-cleared
location's scenery stays visible through the "Level up!" result screen,
and the new location only appears once the next attempt actually starts.

Obstacle-to-location pairing stays fixed regardless of order (rain+lightning
=Mountains, wind=Beach, birds=City, volcano=Caves) — only the sequence
changed, not which obstacle belongs to which location. Heavens has no
obstacle, so difficulty still ramps up over the run even though it's no
longer a flat none→one→one→one→combo curve.

**Resolved (2026-09-08): each location keeps exactly one obstacle type** —
they don't stack or reappear across later levels/cycles. Difficulty still
ramps per full cycle through `placeTarget()`'s existing `cycle` factor
(farther/smaller targets), not by adding more hazards.

### Mountains: rain + lightning (implemented 2026-09-08)

First obstacle actually built (birds/wind/volcano are still just planned).
Split into two parts per explicit user direction (asked which of three
options: pure atmosphere / drag-like wind resistance / hazard-that-misses —
user picked hazard):

- **Rain** — pure atmosphere, no physics effect. `drawRain()` in `main.js`,
  called from `drawBackgroundLayers()` for the Mountains index only.
  Diagonal streaks positioned deterministically from `i` and `animT` (same
  trick the parallax layers already use for tiling) rather than a stored
  particle array — cheaper and avoids adding another array to `state`.
- **Lightning** — an actual hazard, the same role headwind birds / wind
  gusts / volcano lava are meant to play for their own locations: a bolt
  strikes down at a random world x every ~2.6-5s (`updateWeather(dt)`,
  called from `update()`); for a brief ~0.18s window
  (`lightningActive`/`lightningActiveT`), flying through that x-column
  (`|pony.x - lightningX| < 42`, pony still airborne) is an instant miss
  via the existing `endFlight(false)` — no new result state needed. A
  `sfxThunder()` cue plays at the strike, plus a decaying full-screen white
  flash (`lightningFlash`, screen-space, drawn after the world-space
  `ctx.restore()` so it isn't shifted by the camera) and a jagged bolt
  drawn in world space (`drawLightningBolt()`, inside the same
  `translate(-camX,0)` block as the pony/target, so it scrolls correctly
  with the camera) for both warning and payoff.
- Both are keyed off `state.bgLevel` (the location actually on screen, not
  `state.level`), consistent with how the background switch itself is
  deferred — see the background-switch-timing note above.
- `sfxThunder()` added to `sound.js`: a low sawtooth rumble plus a short
  delayed square-wave crack.
- QA note: automated (headless Chrome) testing showed `requestAnimationFrame`
  doesn't keep ticking between tool calls unless something forces a repaint
  (e.g. a screenshot) — real browsers don't have this issue, it only
  affected how the fix was verified (via a temporary `window.__dbg` hook
  with a `testHit()` that force-set the pony into the strike zone, and
  screenshots to pump frames), not the shipped code.

### City: headwind birds (implemented 2026-09-09)

Deliberately a different kind of hazard than Mountains' instant-miss
lightning — the original plan already called these "headwind birds", i.e.
drag rather than a hard fail, so each location's obstacle does something
distinct (rain+lightning = instant-miss hazard, birds = continuous drag,
wind gusts/volcano = still to design).

- A single flock sits at a world x (`birdX`) that relocates every 4-7s
  (`updateBirds(dt)` in `main.js`, called from `update()` right after
  `updateWeather(dt)`), gated on `isCity()` (`state.bgLevel % 5 === 2`)
  the same way Mountains' weather is gated on `isMountains()`.
- While the pony is in flight and within `BIRD_ZONE` (90px either side of
  `birdX`) and still airborne, its horizontal speed bleeds off
  continuously (`p.vx -= p.vx * 1.4 * dt`, an exponential decay rather than
  a flat subtraction so it can't go negative/reverse the pony). A
  `birdInside` edge flag plays `sfxBird()` once on entry instead of every
  frame.
- Drawn as 4 birds clustered around `birdX` with a per-bird flap animation
  from `animT` (`drawBirds()`), inside the same `translate(-camX,0)`
  world-space block as the pony/target/lightning bolt so it lines up with
  the real physics `birdX` used for the drag check (the background city
  buildings themselves use a separate screen-space parallax scheme via
  `drawLayer()`, which wouldn't match).
  - Revision (2026-09-09): the first version drew each bird as a plain
    stroked chevron (thin outlined "V" line) — visually it read as
    unrelated line art next to the unicorn's flat, filled pixel-art style.
    `drawBirdShape()` now uses the same outline-then-fill rect technique
    `pony.js` uses (dark outline rects, then flat-colored fill rects on
    top) for a small blocky bird silhouette, so it reads as part of the
    same visual language instead of a decoration bolted on.
- QA note: same headless-Chrome rAF-throttling caveat as the lightning
  writeup above — verified via a temporary debug hook that force-set the
  pony's position/velocity near the flock and dumped `vx` across a few
  forced repaints, confirming it decayed while inside the zone and stopped
  once outside it, then removed before commit.

### Fix: both obstacles felt like they did nothing (2026-09-09)

User report: "похоже молния и птицы никак не влияют на полёт юникорна"
(lightning and birds don't seem to affect the flight at all). Root cause
in both `updateWeather()` and `updateBirds()`: the relocation timer
free-ran on the wall clock regardless of `state.mode`, and the new
`lightningX`/`birdX` was picked anywhere across the whole reachable range
(~1400px) independent of where the pony actually was. Two compounding
effects: (1) since aiming (choosing a shot) usually takes longer than a
~1-2s flight, most strikes/relocations fired *while the player was still
aiming* and had already expired (or, for birds, drifted stale) by the time
a flight actually happened; (2) even during a flight, a uniformly-random x
across the full range was usually farther than that flight's actual reach.
Net effect: an obstacle only mattered on a small fraction of flights,
reading as "doesn't do anything."

Fix, same shape for both:
- The countdown (`lightningTimer` / `birdTimer`) now only decrements while
  `state.mode === 'flight'` — every second it counts down is a second an
  obstacle could actually matter, instead of being spent waiting on the
  aim screen.
- The new position is picked relative to `state.pony.x` *at the moment of
  relocation* (which now only happens mid-flight) rather than relative to
  `state.originX` across the whole range: `pony.x + 150..500` for
  lightning, `pony.x + 150..550` for birds. Since relocation now always
  happens while a flight is already moving, "ahead of the pony right now"
  is also "ahead of the pony for the rest of this flight," which the old
  origin-relative version wasn't.
- Lightning's active window and hit radius were also widened (0.18s → 0.4s,
  42px → 60px) and its interval shortened (2.6-5s → 1.6-3.2s) so a strike
  that does land in a flight's path has a realistic chance of actually
  overlapping the pony's position, not just its x-column at one instant.
- Verified via a temporary debug hook (`forceLightning()`/`forceBirds()`
  to zero the timer, `fly()` to force `state.mode='flight'` with a known
  velocity) confirming a strike now reliably lands within ~150-500px of
  the pony's position at the moment of triggering, and reproducing an
  actual lightning-caused miss end-to-end; removed before commit.

### Beach: wind gusts (implemented 2026-09-09)

A third distinct hazard shape (Mountains = instant-miss, City = continuous
drag, Beach = one-off nudge): a gust zone relocates the same way as the
lightning/bird fix (`state.pony.x + 150..500`, only while `state.mode ===
'flight'`), and flying through it while active (`gustActiveT`, 0.6s window)
gives the pony a single vertical kick (`p.vy += gustSign * 420`, sign
randomized per gust) rather than a continuous force or an instant fail. A
`gustHit` edge flag (same pattern as `birdInside`) makes sure the kick
applies once per pass through the zone, not every frame while inside it.
Drawn as three curved streaks bowed in the push direction
(`drawWindGust()`), world-space alongside the pony/target/lightning/birds.
`sfxGust()` (a short sine sweep) plays on relocation, not on the actual
kick, so it also works as a heads-up.

### Caves: volcano eruption (implemented 2026-09-09)

A second instant-miss hazard (same shape as Mountains' lightning:
`endFlight(false)` if the pony is inside the zone while active), but
themed and triggered differently. A lava column (`lavaX`, same
relocate-relative-to-pony pattern) rises from the ground and is only
dangerous within `LAVA_HEIGHT` (160px) of the ground -- `p.y > groundY -
LAVA_HEIGHT`, not any altitude the way lightning's `p.y < groundY` is.
Flying high through Caves dodges it entirely, which reads as intentional
("fly over the lava") rather than arbitrary. Drawn as a gradient rect
(`drawLava()`, orange-to-red) rising from the ground at `lavaX` while
`lavaActive`. `sfxLava()` is a low sawtooth rumble, distinct from
`sfxThunder()`'s higher-pitched crack.

Both verified the same way as the Mountains/City fix: a temporary debug
hook forcing the timer to near-zero and the pony into a flight with a
known velocity, confirming the gust's `vy` kick and the lava's
`endFlight(false)` both fire when the pony is in range; removed before
commit.

**Byte budget check** (measured by building actual past commits, not
guessed): a simple procedural parallax layer (silhouette tiling, no
sprites) costs roughly **80-150 bytes zipped** each; a location built from
2-3 such layers costs **~250-450 bytes**. Stateful obstacles (particle/physics
systems like the existing heart/poop bursts) cost more, roughly **350-400
bytes** each based on the charge-pile feature. All 4 non-Heavens obstacles
are now implemented; current build is **~7000 bytes zipped** of the 13312
limit, still comfortable headroom (~6300 bytes) for anything left.

## 12. Start screen (2026-08-24)

A plain HTML overlay (`#intro` in `src/index.html`/`style.css`), not a
canvas-drawn screen or a game mode -- deliberately just two lines: the
title and one instruction ("Drag back, release to launch — hit the
cloud!"), plus a small "tap to start" hint. Sits above the canvas and is
removed on its own `pointerdown` listener, so the dismiss-tap never also
reaches the canvas's aim logic underneath. Rationale (explicitly the
user's): js13k players don't read, so anything beyond 1-2 lines is wasted
— the existing `#hint` bar (visible during aim) already covers the rest of
the controls. Cost: ~182 bytes zipped.

Added a canvas illustration while the intro is up (`drawIntroDemo()` in
`src/main.js`, gated on the `introVisible` flag the intro's dismiss handler
flips): a hand icon pulled back from a pony with a dashed line, plus a
dashed arc + arrowhead into a target cloud — so the slingshot mechanic
reads visually even for someone who skips the text.

Revision (user feedback: "ничего не понятно как играть и какая механика" —
looked like an unrelated start screen, not clear how to play): the first
version anchored the demo to the real pony's actual game position (bottom
left, per `state.originX`/`groundY`), while the HTML title/text sat
CSS-centered — on most viewports these landed far apart on screen, so the
diagram read as disconnected background clutter rather than a labeled
instruction. Fixed by (1) drawing a dedicated demo pony at a fixed
screen-fraction anchor (`W*0.5, H*0.56`) directly under the intro text
instead of tied to the real pony, (2) hiding the real idle pony while the
intro is up so there's only ever one unicorn on screen, (3) moving the
`#intro` text block up (`padding-top:16vh` instead of vertical-centered) so
it sits right above the diagram, and (4) adding short word labels ("1. pull
back", "2. let go") on the canvas next to the hand/arrow, since the
arrows-only version still wasn't unambiguous.

## 13a. HUD consolidation, mute/restart, bigger text (2026-09-08)

User feedback: all text (HUD stats, the bottom control hint, the intro) read
as "super mелко" (tiny) on both mobile and desktop, and the control hint was
stuck at the very bottom of the screen where it's easy to miss/get covered.
Also wanted: one place for all stats plus a music mute toggle and a restart
button.

- `#hud` now holds tries/level/hits/flaps *and* two `<button>`s (🔊/🔇 mute,
  ↺ restart) in one wrapping flex row, centered instead of
  `space-between` (space-between only worked with 3 items; 5 needs to be
  able to wrap to two lines on narrow phones without going edge-to-edge).
- The control hint (`#hint`) moved from `bottom:18px` to `top:64px` (right
  under the HUD row) — same fixed/always-visible bar, just relocated so it's
  not competing with the bottom of the viewport (home indicator / gesture
  bar / on-screen keyboard area on mobile).
- Font sizes bumped across the board: HUD 19px → 23px, hint 13px → 17px
  (+bold), intro body 20px → 24px, intro title 28px → 32px.
- Mute: `sound.js` now routes every sound (SFX, wind, music) through one
  shared `master` GainNode instead of connecting straight to
  `ac.destination`; `toggleMute()` just ramps that gain to 0/1, so a single
  toggle mutes everything without tracking per-sound state.
- Restart: `resetGame()` in `main.js` zeroes `tries`/`level`/`levelHits`/
  `bgLevel`, stops any in-flight wind sound, and calls the existing
  `resetLaunch()` — works from any mode (aim/flight/result), verified by
  hitting it mid-flight and confirming the pony snaps back to the start
  with flaps/level/tries all cleared.

## 13. Open questions for the next session

- Level advance (3 hits, blind aim after level 1) is implemented; all 4
  non-Heavens obstacles are now implemented too (resolved: they don't
  stack/reappear, each location keeps exactly its one type). Still open:
  per-location target distance/difficulty tuning (every level past 1 uses
  the same blind-aim distance formula regardless of location/obstacle)
- Do we need progress persistence (localStorage) in the first version, or is
  clearing all levels in a single session without saving enough? (Lap
  history below is in-memory only, lost on reload -- same answer either way
  for now.)
- **Resolved (2026-09-09): lap-end and game-end screens, see section 14.**

## 14. Lap-end and game-end screens (2026-09-09)

User: after finishing a lap (all 5 locations), show a proper "you cleared
lap N" screen with a score, and stack every previous lap's score on it too
(so lap 2's screen also shows how lap 1 went). Separately: cap the game at
`MAX_LAPS = 10` and show a distinct "master" screen the one time that's
reached, then just keep going.

- **Score = tries taken that lap**, not hits (hits per lap are always
  exactly `LEVEL_HITS_REQUIRED * LOCATIONS.length` = 15, since clearing a
  location always takes exactly 3 hits — the number that actually varies,
  and the one already tracked, is how many attempts it took). Tracked via
  `state.triesAtCycleStart` (a snapshot of `state.tries` at the lap's
  start) and `state.cycleStats` (an array, index 0 = lap 1, appended to
  every time a lap closes).
- A lap closes exactly when a level-up's `state.level` lands on a fresh
  multiple of `LOCATIONS.length` (`endFlight()`, right after the existing
  `state.level++`/`leveledUp` logic) — that's precisely "the level-up was
  also Caves' 3rd hit," the last location in the cycle. At that point the
  flight's terminal mode is overridden from `'result'` to either
  `'cycleEnd'` (lap < MAX_LAPS) or `'gameEnd'` (lap === MAX_LAPS, which by
  construction can only be true once — `state.level` never revisits that
  exact value). Both new modes reuse the existing "tap to continue"
  pointerdown branch (extended alongside `'result'`) to call `resetLaunch()`
  and carry on.
- `drawCycleEndScreen()` / `drawGameEndScreen()` (in `main.js`, called from
  `render()` next to `drawResultText()`) both lean on a shared
  `drawLapStats(startY, fontSize)` helper that prints `state.cycleStats` as
  a stacked "Lap N: X tries" list — the actual "show lap 1 and lap 2
  together" ask is just this array growing by one element per lap, printed
  in full every time. Verified at `lap=10` that all ten lines still fit
  the screen without overflow.
- Past `MAX_LAPS`, the game doesn't hard-stop -- tapping through the
  "Unicorn Master!" screen just calls `resetLaunch()` like any other
  continue, and `state.level` keeps climbing past `MAX_LAPS *
  LOCATIONS.length` (the existing per-cycle difficulty ramp in
  `placeTarget()` already plateaus around cycle 4, so this isn't a
  balancing concern -- it's just endless mode with no further screens).
  `resetGame()` (the restart button) clears `cycleStats`/
  `triesAtCycleStart` along with the rest of the run state.
- Also added, same request batch: a small "a js13kgames 2026 entry" credit
  line on the start screen (`#intro small` in `style.css`/`index.html`),
  absolutely positioned at the bottom of the intro overlay rather than
  inline in its text flow -- inline it pushed the intro's flex layout tall
  enough to visually collide with the canvas-drawn demo illustration below
  it (which sits at a fixed `H*0.56`, unaware of the HTML content's actual
  height).
- QA: same debug-hook-plus-screenshot approach as the obstacle work --
  `forceLapEnd(lap)` fabricated a plausible `cycleStats` history and jumped
  straight to lap 2's and lap 10's screens without having to actually play
  50 attempts; removed before commit.
