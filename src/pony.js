// Pixel-art unicorn sprite: a small list of rectangles (region fills,
// local-unit coordinates) plus a renderer that auto-generates the dark
// outline by drawing every rect inflated by 1 unit in outline color first,
// then the real fills on top. Horse silhouette modeled on a simple 3-tone
// pixel-horse icon reference, mirrored to face RIGHT (head/muzzle toward
// positive x) to match the forward flight direction, then recolored white
// with a rainbow mane/tail/wing-tip per the "Unicorns and Rainbows" theme.
const OUTLINE = '#1a2036';

const COL = {
  w: '#ffffff', // white base
  b: '#bfe0ff', // light blue shade (belly, muzzle tip, ear, shadow)
  h: '#ff6fa5', // hoof, pink
  k: '#1a2036', // eye
  g: '#ffe066', // horn, light gold (tip)
  o: '#e8a33d', // horn, dark gold (base)
  // mane/tail/wing-tip: rainbow
  p: '#ff6fa5',
  r: '#ff9d3b',
  y: '#ffe23b',
  e: '#4ade80',
  c: '#38bdf8',
  u: '#a78bfa',
};

// [x0, y0, x1, y1, color, legGroup?] rects in local units, inclusive.
// legGroup 'F'/'B' rects get a small alternating vertical bob in flight.
const SHAPES = [
  // tail (rear/left, zigzag flick, rainbow, drawn behind the body) --
  // thicker than the rest of the mane so it reads as the "source"
  [-2, -5, 2, -2, 'p'],
  [-4, -3, 0, 0, 'r'],
  [-5, -1, -1, 2, 'y'],
  [-4, 1, 0, 3, 'e'],

  // wing (arc over the back, from withers up and over toward the rump,
  // tapering to a rainbow-tipped point)
  [8, -6, 10, -4, 'w'],
  [5, -8, 9, -6, 'w'],
  [1, -10, 6, -8, 'w'],
  [-3, -9, 2, -7, 'c'],
  [-6, -7, -2, -5, 'u'],
  [-7, -5, -5, -3, 'p'],

  // body barrel
  [0, -3, 16, 3, 'w'],
  [6, 0, 11, 2, 'b'],

  // neck (rises from the body toward the head)
  [13, -8, 16, -3, 'w'],
  [13, -8, 14, -6, 'p'], // mane stripe along the back edge, rainbow
  [13, -6, 14, -3, 'r'],

  // head + tapered, slightly rounded muzzle
  [15, -12, 21, -8, 'w'],
  [19, -11, 23, -9, 'w'],
  [22, -10, 24, -9, 'b'],
  [18, -11, 19, -10, 'k'],
  [15, -16, 16, -12, 'b'], // ear
  [14, -13, 15, -12, 'b'], // ear-base shadow

  // horn (curved hook, sweeping up then curling back toward the head)
  [16, -19, 17, -16, 'o'],
  [17, -21, 18, -19, 'o'],
  [16, -23, 18, -21, 'g'],

  // legs: front pair (near the neck)
  [13, 3, 15, 8, 'w', 'F'], [13, 8, 15, 9, 'h', 'F'],
  [10, 3, 12, 8, 'w', 'F'], [10, 8, 12, 9, 'h', 'F'],
  // legs: back pair (near the tail)
  [6, 3, 8, 8, 'w', 'B'], [6, 8, 8, 9, 'h', 'B'],
  [1, 3, 3, 8, 'w', 'B'], [1, 8, 3, 9, 'h', 'B'],
];

const CELL = 2; // local unit -> pre-scale px
const GROUND_Y = 9; // shift shapes up so hoof-bottom (y=9) sits near y=0
export const PONY_SCALE = 1.9;

export function drawPony(ctx, x, y, rot, t) {
  const bobF = Math.round(Math.sin(t * 10) * 1) * CELL;
  const bobB = Math.round(Math.sin(t * 10 + Math.PI) * 1) * CELL;
  const bobOf = group => (group === 'F' ? bobF : group === 'B' ? bobB : 0);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(PONY_SCALE, PONY_SCALE);
  ctx.rotate(rot * 0.28);

  ctx.fillStyle = OUTLINE;
  for (const [x0, y0, x1, y1, , group] of SHAPES) {
    const by = bobOf(group);
    ctx.fillRect((x0 - 1) * CELL, (y0 - 1 - GROUND_Y) * CELL + by, (x1 - x0 + 3) * CELL, (y1 - y0 + 3) * CELL);
  }
  for (const [x0, y0, x1, y1, color, group] of SHAPES) {
    const by = bobOf(group);
    ctx.fillStyle = COL[color];
    ctx.fillRect(x0 * CELL, (y0 - GROUND_Y) * CELL + by, (x1 - x0 + 1) * CELL, (y1 - y0 + 1) * CELL);
  }

  ctx.restore();
}
