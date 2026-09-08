// Pixel-art unicorn sprite: a small list of rectangles (region fills,
// local-unit coordinates) plus a renderer that auto-generates the dark
// outline by drawing every rect inflated by 1 unit in outline color first,
// then the real fills on top. Chibi/chunky silhouette modeled on a hand
// drawn sketch reference (rounded body, blocky muzzle, big rounded mane
// blob, curled tail, lavender leg/belly shading), mirrored to face RIGHT
// (head/horn toward positive x) to match the forward flight direction,
// with a wing and rainbow mane/tail/tip kept from the previous design per
// the "Unicorns and Rainbows" theme (the sketch itself has neither).
const OUTLINE = '#1a2036';

const COL = {
  w: '#ffffff', // white base
  b: '#c9c3f0', // lavender shade (belly, socks, ear)
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
};

// [x0, y0, x1, y1, color, legGroup?] rects in local units, inclusive.
// legGroup 'F'/'B' rects get a small alternating vertical bob in flight.
const SHAPES = [
  // wing: base flush against the body's back edge so it reads as
  // attached, swept up and back, clear of the mane/tail cluster
  [2, -8, 8, -4, 'w'],
  [-4, -11, 3, -8, 'w'],

  // tail: curled hook, rainbow
  [-2, -6, 2, -3, 'p'],
  [-6, -4, -2, -1, 'r'],
  [-8, -2, -4, 1, 'y'],
  [-7, 0, -3, 3, 'e'],
  [-4, 2, 0, 4, 'c'],

  // body barrel (rounded/chunky), big lavender belly/hip patch
  [-1, -4, 17, 3, 'w'],
  [2, 0, 14, 3, 'b'],

  // neck (short, compact -- chibi proportions, not an elongated horse neck)
  [13, -9, 17, -4, 'w'],

  // mane: big rounded blob, fat rainbow bands
  [11, -10, 16, -7, 'p'],
  [13, -14, 18, -10, 'r'],
  [15, -17, 19, -14, 'y'],

  // head + blocky muzzle bump
  [17, -15, 23, -10, 'w'],
  [22, -12, 26, -10, 'w'],
  [21, -10, 25, -9, 'w'],
  [19, -13, 20, -12, 'k'], // eye
  [16, -19, 18, -16, 'b'], // ear
  [15, -17, 16, -16, 'b'], // ear-base shadow

  // horn: pink collar cap + two-tone horn
  [18, -17, 20, -16, 'p'],
  [19, -19, 21, -17, 'o'],
  [19, -22, 21, -19, 'g'],

  // legs: front pair (near head), white
  [13, 1, 16, 6, 'w', 'F'], [13, 6, 16, 7, 'h', 'F'],
  [10, 1, 13, 6, 'w', 'F'], [10, 6, 13, 7, 'h', 'F'],
  // legs: back pair (near tail), lavender socks
  [4, 1, 7, 6, 'b', 'B'], [4, 6, 7, 7, 'h', 'B'],
  [1, 1, 4, 6, 'b', 'B'], [1, 6, 4, 7, 'h', 'B'],
];

const CELL = 2; // local unit -> pre-scale px
const GROUND_Y = 7; // shift shapes up so hoof-bottom (y=7) sits near y=0
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
