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
- `src/main.js` — the whole game (aim/launch/flight/result, scrolling
  camera, unicorn rendering, heart particles, rainbow trail)
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
- Canvas resizes based on `devicePixelRatio` (capped at 2x for performance)
  and on `window.resize`

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
