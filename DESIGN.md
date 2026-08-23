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
- Also while held — a rainbow charge pile builds up under the unicorn's
  tail, growing taller with power (`drawChargePile()` in `src/main.js`,
  reusing the live drag-vector power calculation rather than `state.power`,
  which is only set on release)
- Throw angle is clamped to a sane range (-0.92π to -0.08π, i.e. almost
  straight up to almost horizontal-forward, never backward/down)
- Too short a gesture (< 8% of max radius) — aiming is cancelled, nothing
  happens

### Phase 2 — Release
- Releasing the finger converts the accumulated power into launch speed:
  `speed = BASE_SPEED + power * POWER_MULT` (600 + power*900)
- Initial vx/vy are computed from angle and speed
- The charge pile scatters into 8-18 rainbow-colored poop particles (count
  scales with power), reusing the same particle array/physics as the
  heart bursts (tagged `type:'poop'`, rendered as a 3-blob stack instead of
  a heart shape)
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
  history, colors cycled from the ROYGBIV palette), thick as the body right
  behind the pony and tapering thinner toward the older/faded end

### Phase 4 — Result
- **Hitting the target** (collision radius ~46px, checked against a point
  offset from the pony's anchor toward its visual body center — the anchor
  itself sits near the hooves, ~45px below the body/neck, so checking the
  raw anchor let the top of the pony pass clean through the target without
  registering a hit; fixed 2026-08-23) → success, heart particles around
  the target, positive text feedback,
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
  - **Level-1 tutorial ramp**: the first level's 3 required hits use
    `screenSpan` fractions of `[0.35-0.5, 0.8-0.95, 1.05-1.2]` (with a
    lower max height for the first two) — target starts clearly on
    screen, edges to the border, then just past it, teaching the blind-aim
    mechanic before the rest of the game relies on it every time
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
| 2 | Mountains | background built (3-layer parallax + trees) | none |
| 3 | City | background built 2026-08-23 (building silhouettes, tiny window highlights) | headwind birds |
| 4 | Beach | background built 2026-08-23 (palm trees, sea swell, sand ground) | wind gusts (sideways drift in flight) |
| 5 | Caves | background built 2026-08-23 (ceiling stalactites, dark sky, rock ground), finale | volcano eruption (lava/underground) |

All 5 backgrounds are visual-only so far — no per-location obstacles yet
(those are still tracked separately, see section 8).

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

Obstacle-to-location pairing stays fixed regardless of order (wind=Beach,
birds=City, volcano=Caves) — only the sequence changed, not which obstacle
belongs to which location. Heavens and Mountains have no obstacle, so
difficulty still ramps up over the run even though it's no longer a flat
none→one→one→one→combo curve.

Not yet decided: exact distance/difficulty curve per level, and whether
obstacles from earlier levels also reappear (harder) in later ones or each
location keeps its own single obstacle type.

**Byte budget check** (measured by building actual past commits, not
guessed): a simple procedural parallax layer (silhouette tiling, no
sprites) costs roughly **80-150 bytes zipped** each; a location built from
2-3 such layers costs **~250-450 bytes**. Stateful obstacles (particle/physics
systems like the existing heart/poop bursts) cost more, roughly **350-400
bytes** each based on the charge-pile feature. Rough total for the
remaining 4 locations + their obstacles: **~3000-5000 bytes**. Current
build is **4109 bytes zipped** of the 13312 limit, so there's comfortable
headroom (~9200 bytes) even on the pessimistic end of that estimate.

## 12. Open questions for the next session

- Level advance (3 hits, blind aim after level 1) is implemented; still
  open: per-location target distance/difficulty tuning once locations 2-5
  actually exist (right now every level past 1 uses the same blind-aim
  distance formula, location is visual only so far), and whether obstacles
  stack/reappear across later levels or stay one-per-location
- Do we need progress persistence (localStorage) in the first version, or is
  clearing all levels in a single session without saving enough?
- What happens after the last level (loop back to the first, an "end"
  screen, just repeat)?
