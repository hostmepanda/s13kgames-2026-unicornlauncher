// Pixel-art grass tuft: same rect-list + auto-outline technique as the
// pony sprite (src/pony.js) -- a light-green mound with a few darker spiky
// blades, outlined by drawing every rect inflated by 1 unit first.
const OUTLINE = '#0d0d0d';
const COL = {
  l: '#8fd15b', // light green mound
  d: '#4f9a3a', // dark green blades
};

const SHAPES = [
  [-3, 0, 3, 1, 'l'],
  [-2, -1, 2, 0, 'l'],
  [-3, -3, -2, -1, 'd'],
  [-1, -4, 0, -1, 'd'],
  [1, -4, 2, -1, 'd'],
  [2, -2, 3, -1, 'd'],
];

const CELL = 2; // local unit -> pre-scale px

export function drawGrass(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = OUTLINE;
  for (const [x0, y0, x1, y1] of SHAPES) {
    ctx.fillRect((x0 - 1) * CELL, (y0 - 1) * CELL, (x1 - x0 + 3) * CELL, (y1 - y0 + 3) * CELL);
  }
  for (const [x0, y0, x1, y1, color] of SHAPES) {
    ctx.fillStyle = COL[color];
    ctx.fillRect(x0 * CELL, y0 * CELL, (x1 - x0 + 1) * CELL, (y1 - y0 + 1) * CELL);
  }

  ctx.restore();
}
