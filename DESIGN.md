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
- While held — a power indicator grows (a linear bar at the bottom of the
  screen with a rainbow gradient fill)
- Throw angle is clamped to a sane range (-0.92π to -0.08π, i.e. almost
  straight up to almost horizontal-forward, never backward/down)
- Too short a gesture (< 8% of max radius) — aiming is cancelled, nothing
  happens

### Phase 2 — Release
- Releasing the finger converts the accumulated power into launch speed:
  `speed = BASE_SPEED + power * POWER_MULT` (600 + power*900)
- Initial vx/vy are computed from angle and speed
- From there it's ballistics: gravity constantly pulls down (G=1400 px/s²)

### Phase 3 — Flight (with correction)
- The player can tap the screen for a "mane flap" — gives an upward vertical
  impulse (`FLAP_IMPULSE = 480`)
- **Limited flap budget — 3 per attempt** (important for balance: full
  control kills the significance of a precise launch, zero correction makes
  the game purely random)
- The camera follows the unicorn horizontally (the world scrolls, the unicorn
  is held at roughly 30% of screen width from the left edge)
- A rainbow trail follows the unicorn (semi-transparent trail from position
  history, colors cycled from the ROYGBIV palette)

### Phase 4 — Result
- **Hitting the target** (collision radius ~46px to match the enlarged pony
  size) → success, heart particles around the target, positive text feedback
- **Miss** (fell to the ground or flew past a reasonable zone) → the pony
  "vanishes," replaced by a burst of hearts (10-14 of them, scattered at
  random angles with gravity), negative text feedback
- Tapping the screen in this phase → reset and a new attempt (attempt counter
  in the HUD increases)

---

## 3. Unicorn visual design

Fully drawn with canvas primitives, no sprites/images:
- Body — ellipse
- Neck — smaller rotated ellipse
- Head — ellipse + separate muzzle
- Ear — triangle
- Horn — triangle with a linear gradient (light yellow → gold)
- Eye — dot
- Mane — a set of colored lines along the neck (ROYGBIV palette)
- Tail — several colored curved lines (quadraticCurveTo), with a light sway
  animation from `sin(time)`
- Legs — 4 rounded rectangles (roundRect) with a time offset for a "gallop"
  effect in flight

Scale is increased via `PONY_SCALE` (2.3x from the original hand-drawn size)
— the unicorn should read as a large, "main" object on screen, not a small
detail.

---

## 4. Camera and world

- The game scrolls horizontally: `camX` is the world camera offset
- During flight the camera smoothly (`lerp`, coefficient ~6*dt) adjusts to
  keep the unicorn at ~30% of screen width
- The target (cloud) is placed in world coordinates 0.9-1.8 screens ahead of
  the start point — deliberately requires scrolling, doesn't fit in the
  starting frame
- In the aim/result phases the camera doesn't move (aim and result are static
  screens)

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
| `PONY_SCALE` | 2.3 | unicorn size multiplier |

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
  expensive in bytes for a jam game. Level advance happens on hitting the
  target; persistence (localStorage, last cleared level) is optional and can
  be cut if space runs short.
- **Obstacles** (clouds/wind): yes, introduced gradually as part of level
  progression (difficulty ramps as you advance), not as a separate system
  from the start.
- **Sound**: yes, but in a later iteration (not in current scope). WebAudio
  synth events (charge, flap, hit, crash) — when we get to it.
- **Power indicator**: keeping it as-is — the linear bar at the bottom of the
  screen with a rainbow gradient. Not moving it onto the tail (added
  complexity for polish isn't justified right now).

## 8. Open questions for the next session

- Level design: how many levels in the first version, difficulty curve
  (distance step, when the first obstacles appear)?
- Level data format: minimal structure (`targetDist`, `obstacles[]`, what
  else?) and where it lives in the code
- Do we need progress persistence (localStorage) in the first version, or is
  clearing all levels in a single session without saving enough?
- What happens after the last level (loop back to the first, an "end"
  screen, just repeat)?
