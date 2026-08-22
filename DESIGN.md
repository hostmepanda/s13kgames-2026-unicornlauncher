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

Pixel-art style (`src/pony.js`), not smooth vector shapes: the sprite is a
small list of rectangles (`[x0,y0,x1,y1,color]`, local-unit coordinates)
rendered with `fillRect` blocks. A dark outline is auto-generated at render
time — every rect is first drawn inflated by 1 unit in outline color, then
the real fills go on top — so the shape list itself only needs region
colors, not hand-drawn edges.

The sprite is a close recreation of a simple 3-tone pixel-horse icon
reference (tan body, gray-brown mane/tail/shadow, cream highlights, black
outline), mirrored to face **right** (head/muzzle toward positive x) to
match the forward flight direction, with a horn and wing added on top.
Earlier iterations (chibi-rainbow-icon style, then a tan running pegasus
with horn+wings, more elaborate) were replaced/reworked after feedback that
they read as "hamster", "dragon", and "dog" respectively rather than a
horse — the lesson was to nail a recognizable horse silhouette first, then
layer fantasy elements on top, rather than design them simultaneously.

- Head — tapered muzzle (narrowing steps toward the nose tip, light-blue tip
  highlight, softened vs. the original single hard step), single eye, small
  ear, light-blue shadow patch at the ear base
- Horn — curved hook shape (a few offset segments sweeping up then curling
  back toward the head), two-tone gold
- Wing — a tapered arc over the back, from the withers up and over toward
  the rump, white base with a rainbow-colored tip (cyan→purple→pink)
- Neck — rises from the body to the head, two-tone rainbow mane stripe
  along its back edge
- Body — white barrel with a light-blue belly patch
- Tail — small rainbow zigzag flick (pink→orange→yellow→green) at the
  rear, drawn behind the body
- Legs — 4 straight legs (front pair + back pair) with pink hoof tips
- Animation — front leg pair and back leg pair bob in opposite phase during
  flight (`Math.sin(t*10)`, rounded to whole pixels to stay crisp)

Recolored white + rainbow (mane, tail, wing tip) per the original
"Unicorns and Rainbows" concept — the base horse reference used tan/gray
tones, kept only for the horn's gold and the pink hoof/shading accents.

Overall scale is controlled by `PONY_SCALE` in `src/pony.js` — the unicorn
should read as a large, "main" object on screen, not a small detail.

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
- [ ] (later) Location system: support swapping in a different
  mountains+trees set per location; only building one location's assets now
- [ ] (later, separate pass) Obstacles: headwind birds, wind gusts, a
  volcano eruption — not part of this parallax pass

## 9. Open questions for the next session

- Level design: how many levels in the first version, difficulty curve
  (distance step, when the first obstacles appear)?
- Level data format: minimal structure (`targetDist`, `obstacles[]`, what
  else?) and where it lives in the code
- Do we need progress persistence (localStorage) in the first version, or is
  clearing all levels in a single session without saving enough?
- What happens after the last level (loop back to the first, an "end"
  screen, just repeat)?
