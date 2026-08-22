// Pixel-art horse sprite: a small list of rectangles (region fills,
// local-unit coordinates) plus a renderer that auto-generates the dark
// outline by drawing every rect inflated by 1 unit in outline color first,
// then the real fills on top. Modeled closely on a simple 3-tone pixel
// horse icon reference, mirrored to face RIGHT (head/muzzle toward
// positive x) to match the forward flight direction. Unicorn horn / wings
// / rainbow mane are a later pass on top of this base.
const OUTLINE = '#0d0d0d';

const COL = {
  w: '#c9915c', // tan base
  W: '#e8c39a', // light cream (highlights, hooves, muzzle tip)
  d: '#6b6259', // gray-brown (mane, tail, shadow accents)
  k: '#0d0d0d', // eye
  g: '#ffe066', // horn, light gold (tip)
  o: '#e8a33d', // horn, dark gold (base)
  F: '#ffffff', // wing, white
  q: '#dce8f5', // wing, shade
};

// [x0, y0, x1, y1, color, legGroup?] rects in local units, inclusive.
// legGroup 'F'/'B' rects get a small alternating vertical bob in flight.
const SHAPES = [
  // tail (rear/left, zigzag flick, drawn behind the body)
  [-1, -4, 1, -2, 'd'],
  [-3, -3, -1, -1, 'd'],
  [-4, -1, -2, 1, 'd'],
  [-3, 0, -1, 2, 'd'],

  // wing (arc over the back, from withers up and over toward the rump,
  // tapering to a point like a swept feather tip)
  [8, -6, 10, -4, 'F'],
  [5, -8, 9, -6, 'F'],
  [1, -10, 6, -8, 'F'],
  [-3, -9, 2, -7, 'q'],
  [-6, -7, -2, -5, 'q'],
  [-7, -5, -5, -3, 'q'],

  // body barrel
  [0, -3, 16, 3, 'w'],
  [6, 0, 11, 2, 'W'],

  // neck (rises from the body toward the head)
  [13, -8, 16, -3, 'w'],
  [13, -8, 14, -3, 'd'], // mane stripe along the back edge

  // head + tapered, slightly rounded muzzle
  [15, -12, 21, -8, 'w'],
  [19, -11, 24, -9, 'w'],
  [23, -10, 26, -9, 'w'],
  [25, -10, 27, -9, 'W'],
  [18, -11, 19, -10, 'k'],
  [15, -16, 16, -12, 'W'], // ear
  [14, -13, 15, -12, 'd'], // ear-base shadow

  // horn (curved hook, sweeping up then curling back toward the head)
  [16, -19, 17, -16, 'o'],
  [17, -21, 18, -19, 'o'],
  [16, -23, 18, -21, 'g'],

  // legs: front pair (near the neck)
  [13, 3, 15, 8, 'w', 'F'], [13, 8, 15, 9, 'W', 'F'],
  [10, 3, 12, 8, 'w', 'F'], [10, 8, 12, 9, 'W', 'F'],
  // legs: back pair (near the tail)
  [6, 3, 8, 8, 'w', 'B'], [6, 8, 8, 9, 'W', 'B'],
  [1, 3, 3, 8, 'w', 'B'], [1, 8, 3, 9, 'W', 'B'],
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
