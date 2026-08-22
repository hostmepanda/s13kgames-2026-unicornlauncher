// Pixel-art unicorn sprite: a small ASCII grid (region fills only) plus a
// renderer that auto-generates the dark outline by stamping outline pixels
// around every filled cell before the fill pass. Facing RIGHT (muzzle/horn
// on the right side of the grid) to match the forward flight direction.
export const PONY_PALETTE = {
  w: '#ffffff', // white body
  b: '#bfe0ff', // light blue shade
  g: '#ffd23b', // gold horn, light
  o: '#f5a623', // gold horn, dark
  k: '#1a2036', // eye
  n: '#1a2036', // nostril
  p: '#ff6fa5', // mane/tail: pink
  r: '#ff9d3b', // mane/tail: orange
  y: '#ffe23b', // mane/tail: yellow
  e: '#4ade80', // mane/tail: green
  c: '#38bdf8', // mane/tail: cyan
  u: '#a78bfa', // mane/tail: purple
  h: '#ff6fa5', // hoof
};
const OUTLINE = '#1a2036';

export const PONY_GRID = [
  '........................gg.....',
  '.....................w.ggg.....',
  '..............pp....ww.oggo....',
  '.............pprr.....ooo......',
  '............rrryy..............',
  '...........ryyyee.........www..',
  '..........yyeeecc.......wwwwww.',
  '.........eeccccuu.....wwwkwwww.',
  '........ccuuuu.......wwwwwwwwwwwww',
  '.......uuuu..........wwwwwwwwwwwwwwwn',
  '......pp.............wwwwwwwwww',
  '.....pp....bwwwwwwwwwwwwwwwwwww',
  '....ee....bbwwwwwwwwwwwwww.....',
  '...ee....bbbwwwwwwwwwwwww......',
  '..cc....bbbbwwwwwwwwwwww.......',
  '..c....bbbb..wwwwwwwww.........',
  '.......bb....wwwwwww...........',
  '.........wwwwwwwwwwwwwwwwwwww',
  '..........ww..ww......ww..ww',
  '..........ww..ww......ww..ww',
  '.........ww....ww....ww....ww',
  '.........ww....ww....ww....ww',
  '.........hh....hh....hh....hh',
];

// Anchor point (in grid cells) that lands on the pony's world (x,y).
const ANCHOR_COL = 16;
const ANCHOR_ROW = 21;

// Leg columns get a small alternating vertical bob for a simple gallop
// (back pair vs. front pair move in opposite phase).
const LEG_ROWS = [18, 19, 20, 21, 22];
const LEFT_LEG_COLS = [9, 16]; // back legs
const RIGHT_LEG_COLS = [21, 28]; // front legs

const PS = 2; // local pixel unit (pre ctx.scale)
export const PONY_SCALE = 2.4;

function cellAt(x, y) {
  if (y < 0 || y >= PONY_GRID.length) return '.';
  const row = PONY_GRID[y];
  return x >= 0 && x < row.length ? row[x] : '.';
}

function legBob(x, y, t) {
  if (!LEG_ROWS.includes(y)) return 0;
  if (x >= LEFT_LEG_COLS[0] && x <= LEFT_LEG_COLS[1]) return Math.round(Math.sin(t * 10) * 1);
  if (x >= RIGHT_LEG_COLS[0] && x <= RIGHT_LEG_COLS[1]) return Math.round(Math.sin(t * 10 + Math.PI) * 1);
  return 0;
}

export function drawPony(ctx, x, y, rot, t) {
  const h = PONY_GRID.length;
  const w = Math.max(...PONY_GRID.map(r => r.length));

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(PONY_SCALE, PONY_SCALE);
  ctx.rotate(rot * 0.28);

  // outline pass: any filled cell with an empty neighbor gets an outline pixel
  ctx.fillStyle = OUTLINE;
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      if (cellAt(gx, gy) === '.') continue;
      const bob = legBob(gx, gy, t);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (cellAt(gx + dx, gy + dy) === '.') {
          const px = (gx + dx - ANCHOR_COL) * PS;
          const py = (gy + dy - ANCHOR_ROW) * PS + bob * PS;
          ctx.fillRect(px, py, PS, PS);
        }
      }
    }
  }

  // fill pass
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const ch = cellAt(gx, gy);
      const color = PONY_PALETTE[ch];
      if (!color) continue;
      const bob = legBob(gx, gy, t);
      const px = (gx - ANCHOR_COL) * PS;
      const py = (gy - ANCHOR_ROW) * PS + bob * PS;
      ctx.fillStyle = color;
      ctx.fillRect(px, py, PS, PS);
    }
  }

  ctx.restore();
}
