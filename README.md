# Unicorn Launch

A slingshot/hold-to-charge launch game, built as a [js13kgames](https://js13kgames.com/)
2026 entry (theme: Unicorns and Rainbows). Plain HTML5 canvas + vanilla JS,
no framework, bundled to fit a 13KB zip.

Game design, mechanics, and open decisions live in [DESIGN.md](DESIGN.md).

Play: https://hostmepanda.github.io/s13kgames-2026-unicornlauncher/

---

## Repo structure

- `src/index.html` — HTML shell (head, canvas, HUD markup), with
  `<!--CSS-->`/`<!--JS-->` placeholders the build script fills in
- `src/style.css` — HUD/page styles
- `src/main.js` — the game loop and state (aim/launch/flight/result, lap
  progression, scrolling camera, per-location backgrounds and obstacles,
  particles, rainbow trail)
- `src/pony.js` — the unicorn's pixel-art sprite (rect-list + renderer)
- `src/sound.js` — procedural WebAudio SFX and the background music
  sequencer, no audio samples
- `src/grass.js` — a grass-tuft renderer, currently unused (kept for a
  possible later ground-detail pass, see DESIGN.md)
- `build/build.mjs` — build script, `dist/` and `*.zip` are build output
  (gitignored)

### Mobile input

- Pointer Events only (`pointerdown`/`pointermove`/`pointerup`), works for
  both touch and mouse — not tied to touch-events specifically
- `touch-action: none` on the canvas to avoid page scroll/zoom during
  gestures
- Viewport meta with `user-scalable=no`
- One active `pointerId` tracked at a time (protects against multitouch
  conflicts)
- Canvas resizes based on `devicePixelRatio` (capped at 2x for performance);
  sizing prefers `window.visualViewport` over `innerWidth`/`innerHeight`
  where available, and listens for both `window` and `visualViewport`
  resize events, since mobile browsers' address-bar collapse/expand can
  otherwise leave fixed UI positioned against a stale height

## Build pipeline

`npm install` then `npm run build` produces a single `dist/index.html`:

1. esbuild bundles + minifies `main.js`, terser runs a second aggressive
   pass on top
2. esbuild minifies `style.css`
3. The JS is also packed with [Roadroller](https://github.com/lifthrasiir/roadroller)
   as an alternative
4. Both variants (plain-minified vs Roadroller) get assembled into full HTML
   and zipped; whichever produces the smaller zip wins and becomes
   `dist/index.html` — this keeps Roadroller from being used when it would
   actually hurt (it only pays off once the JS is large/repetitive enough
   that its packing beats plain DEFLATE)

## CI/CD

`.github/workflows/deploy.yml` runs the build on every push to `main`, in
two independent jobs:

- `deploy-pages` — always deploys `dist/` to GitHub Pages, regardless of the
  zip size check below
- `build-zip` — zips `dist/index.html`, fails the job if it exceeds the
  js13k 13KB limit, and otherwise publishes `game.zip` as a GitHub Release
  asset (tag `latest-build`)
