// Bench: Oritech Foundry from reference renders. Two ingots go in the end ports, melt in the blue
// heating core, and the press on top squeezes them into an alloy ingot.
import { RAMPS } from '../pix.mjs';

// Oritech palette: rusty orange paint, blue-grey steel, neutral grey stone-like towers, navy core.
Object.assign(RAMPS, {
  rust: ['#5a1d0d', '#8e331b', '#b3522a', '#cd7238', '#e2a25c'],
  slate: ['#1a1f2b', '#2e3749', '#45516a', '#5f6d88', '#8696b0'],
  stone: ['#24262c', '#36383f', '#4b4e56', '#62656e', '#80838c'],
  navy: ['#0e1a44', '#1a2f74', '#22449a', '#2f63b6', '#4c84cc'],
  ice: ['#2d5d6c', '#4b97a8', '#6fc0d0', '#99dbe6', '#cdf1f6'],
  lime: ['#2a5a18', '#3f8a25', '#5cbf38', '#7fdc55', '#b8f590'],
});

export const meta = {
  title: 'Foundry (bench c1)', note: 'Alloy furnace, Oritech bench reproduction.', footprint: [2, 1], height: 2, tier: 1,
  joints: { press: { type: 'prismatic', axis: 'y' } },
};

const hsh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// 5x5 key-shaped strokes; Oritech paint and stone carry these mazes instead of outlines
const KEYS = [
  ['####.', '...#.', '.#.#.', '.###.', '.....'],
  ['#....', '#.###', '#.#..', '###..', '.....'],
  ['.###.', '.#...', '.#.##', '.#..#', '.####'],
  ['##.##', '.#.#.', '.###.', '.....', '#####'],
  ['#.###', '#...#', '###.#', '....#', '.....'],
];

export function build(b, { mat }) {
  let seed = 1;
  // fill + texel jitter, then maze strokes, cell by cell; rows get darker towards the bottom
  const surface = (d, ramp, o = {}) => {
    const s = seed++, side = d.face !== 'up' && d.face !== 'down';
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      const t = side ? y / Math.max(1, d.h - 1) : 0.5;
      let k = o.flat ? 2 : t < 0.25 ? 3 : t < 0.75 ? 2 : 1;
      const r = hsh(x >> 1, y, s); if (r < 0.1) k = Math.max(1, k - 1); else if (r > 0.93) k = Math.min(3, k + 1);
      d.px(x, y, ramp, k);
    }
    const cell = o.cell || 6, rowK = (Y) => { const t = side ? Y / Math.max(1, d.h - 1) : 0.5; return o.flat ? 2 : t < 0.25 ? 3 : t < 0.75 ? 2 : 1; };
    for (let cy = 0; cy * cell < d.h; cy++) for (let cx = 0; cx * cell < d.w; cx++) {
      if (hsh(cx, cy, s + 5) < (o.skip ?? 0.35)) continue;
      const key = KEYS[Math.floor(hsh(cx, cy, s + 9) * KEYS.length)], fx = hsh(cx, cy, s + 3) < 0.5, fy = hsh(cx, cy, s + 4) < 0.5;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
        if (key[fy ? 4 - j : j][fx ? 4 - i : i] !== '#') continue;
        const X = cx * cell + i + (o.ox || 0), Y = cy * cell + j + (o.oy || 0);
        if (X < 0 || Y < 0 || X >= d.w || Y >= d.h) continue;
        d.px(X, Y, ramp, o.line ?? Math.min(4, rowK(Y) + 1));
      }
    }
  };
  const rust = (o) => (d) => surface(d, 'rust', o);
  const stoneFace = (d) => surface(d, 'stone', { line: 0, cell: 6, skip: 0.05 });
  const stripes = (d) => { for (let y = 0; y < d.h; y++) d.hline(0, y, d.w, 'stone', [1, 3, 2, 2][y % 4]); for (let y = 2; y < d.h; y += 4) for (let x = (y >> 2) & 1; x < d.w; x += 3) d.px(x, y, 'stone', 4); };
  const port = (d, x, y, s) => { d.rect(x, y, s, s, 'rust', 4); d.hline(x, y + s - 1, s, 'rust', 3); d.vline(x + s - 1, y, s, 'rust', 3); d.rect(x + 1, y + 1, s - 2, s - 2, 'coal', 1); d.rect(x + 2, y + 2, s - 4, s - 4, 'coal', 0); };
  const checker = (d) => { for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) d.px(x, y, 'slate', (((x >> 1) + (y >> 1)) & 1) ? 1 : (hsh(x >> 1, y >> 1, 77) < 0.3 ? 3 : 2)); };
  const icePanel = (d) => {
    d.rect(2, 2, d.w - 4, d.h - 4, 'slate', 1); d.rect(2, 2, d.w - 4, 1, 'slate', 0); d.vline(2, 2, d.h - 4, 'slate', 0);
    const m = Math.floor(d.w / 2) - 1; d.rect(m, 3, 2, d.h - 6, 'ice', 3); d.vline(m, 3, d.h - 6, 'ice', 4);
    d.rect(3, 4, m - 4, 3, 'coal', 0); d.rect(m + 3, 4, d.w - m - 6, 3, 'coal', 0);
  };

  const C = { clean: true };
  const plinth = mat('slate', { all: checker }, C);
  const lowBody = mat('rust', { all: rust({ cell: 6 }), up(d) { surface(d, 'rust', { flat: true }); d.inset(1, 1, d.w - 2, d.h - 2, 'rust'); } }, C);
  const endBlock = mat('rust', { all: rust({ cell: 5 }) }, C);
  const icePort = mat('ice', {
    all(d) { d.rect(0, 0, d.w, d.h, 'ice', 3); d.hline(0, 0, d.w, 'ice', 4); d.vline(0, 0, d.h, 'ice', 4); d.hline(0, d.h - 1, d.w, 'ice', 1); d.vline(d.w - 1, 0, d.h, 'ice', 1); },
    west: icePanel, east: icePanel,
  }, C);
  const westTower = mat('stone', {
    all: stripes,
    west: stoneFace, east: stoneFace,
    south(d) { for (let y = 0; y < d.h; y++) d.hline(0, y, d.w, 'slate', [1, 3, 2, 2][y % 4]); port(d, 0, 0, d.w); port(d, 0, d.h - d.w - 3, d.w); },
    north(d) { surface(d, 'rust', { skip: 0.6 }); d.rect(1, 4, d.w - 2, 2, 'rust', 4); d.rect(d.w - 2, 4, 2, 2, 'lime', 3); d.px(d.w - 2, 4, 'lime', 4); },
  }, C);
  const capBand = mat('slate', { all(d) { d.rect(0, 0, d.w, d.h, 'slate', 1); d.hline(0, 0, d.w, 'slate', 0); } }, C);
  const westCap = mat('rust', {
    all: rust({ cell: 6 }),
    east(d) {
      // drip streaks over a heat-sink comb above the core
      for (let x = 0; x < d.w; x++) for (let y = 0; y < d.h; y++) d.px(x, y, 'rust', y < 2 ? 2 : ((x + (y >> 2)) % 3 === 0 ? 4 : (x % 3 === 1 ? 2 : 1)));
      for (let x = 2; x < d.w - 1; x += 4) { d.rect(x, d.h - 2, 1, 2, 'coal', 0); d.px(x, d.h - 3, 'coal', 1); }
    },
  }, C);
  const core = mat('navy', {
    side(d) {
      const rows = ['s', 'S', 'n', 'b', 'B', 'b', 'n', 's', 'S', 'n', 'b', 'B'];
      for (let y = 0; y < d.h; y++) {
        const r = rows[y % rows.length];
        for (let x = 0; x < d.w; x++) {
          if (r === 's') d.px(x, y, 'slate', 2);
          else if (r === 'S') d.px(x, y, ...((x + y) % 4 === 0 ? ['slate', 4] : (x + y) % 4 === 2 ? ['navy', 0] : ['slate', 3]));
          else if (r === 'n') d.px(x, y, 'navy', 0);
          else d.px(x, y, 'navy', r === 'B' ? (hsh(x >> 2, y, 3) < 0.5 ? 3 : 4) : (hsh(x >> 1, y, 4) < 0.3 ? 1 : 2));
        }
      }
      d.vline(0, 0, d.h, 'navy', 0); d.vline(d.w - 1, 0, d.h, 'navy', 0);
    },
  }, C);
  const coreSkirt = mat('rust', { all: rust({ cell: 4, skip: 0.3 }) }, C);
  const coreTop = mat('rust', {
    side(d) { surface(d, 'rust', { skip: 0.5 }); d.hline(0, 0, d.w, 'rust', 4); },
    up(d) {
      surface(d, 'rust', { cell: 5 });
      for (let x = d.w - 7; x < d.w - 1; x++) for (const y of [1, 2]) d.px(x, y, (x + y) & 1 ? 'ice' : 'coal', (x + y) & 1 ? 4 : 0);
      for (let x = 2; x < 8; x++) for (const y of [3, 4]) d.px(x, y, 'slate', (x + y) & 1 ? 3 : 2);
    },
  }, C);
  const press = mat('rust', {
    all: rust({ cell: 5 }),
    north(d) { surface(d, 'rust', { cell: 5 }); d.rect(1, 2, d.w - 2, 2, 'coal', 0); d.hline(1, 4, d.w - 2, 'rust', 1); },
  }, C);
  const eastCap = mat('rust', { all: rust({ cell: 6, ox: 1, oy: 1 }) }, C);
  const steelPart = mat('slate', { all(d) { for (let y = 0; y < d.h; y++) d.hline(0, y, d.w, 'slate', y === 0 ? 4 : y === d.h - 1 ? 1 : (y & 1 ? 2 : 3)); } }, C);
  const connector = mat('slate', { all(d) { d.rect(0, 0, d.w, d.h, 'slate', 1); for (let x = 1; x < d.w; x += 2) d.vline(x, 1, d.h - 2, 'slate', 3); } }, C);
  const eastTower = mat('stone', { all: stripes, east: stoneFace, south: stoneFace }, C);
  const nozzle = mat('slate', { all(d) { d.rect(0, 0, d.w, d.h, 'slate', 2); d.inset(1, 1, d.w - 2, d.h - 2, 'slate'); d.rect(2, 2, d.w - 4, d.h - 4, 'stone', 4); d.rect(3, 3, Math.max(1, d.w - 6), Math.max(1, d.h - 6), 'stone', 3); } }, C);
  const chute = mat('rust', { all(d) { for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) d.px(x, y, 'rust', ((x >> 1) + (y >> 1)) & 1 ? 3 : (y > d.h / 2 ? 1 : 2)); } }, C);
  const hopper = mat('slate', { all(d) { for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) d.px(x, y, 'slate', ((x >> 1) + (y >> 1)) & 1 ? 3 : 2); }, up(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'slate'); } }, C);

  // masses and structure
  b.box('plinth', [-16, 0, -8], [16, 1, 8], plinth);
  b.box('plinth_top', [-15, 1, -7.5], [15, 2, 7.5], plinth);
  b.box('low_body', [-9, 2, -7], [9, 6, 7], lowBody);
  b.box('trough', [-7, 2, 7], [7, 4, 8], mat('rust', { all: rust({ cell: 4 }) }, C));
  b.box('west_block', [-15, 2, -7.5], [-9, 6, 7.5], endBlock);
  b.box('east_block', [9, 2, -7.5], [15, 7, 7.5], endBlock);
  b.box('port_in_w', [-16, 2, -0.5], [-15, 12, 7.5], icePort);
  b.box('port_in_e', [15, 2, -0.5], [16, 12, 7.5], icePort);
  // west tower and its heavy cap
  b.box('west_tower', [-15, 6, -7], [-10, 22, 7], westTower);
  b.box('west_band', [-15.5, 22, -7.5], [-7, 23, 7.5], capBand);
  b.box('west_cap', [-16, 23, -8], [-6, 31, 8], westCap);
  // blue heating core
  b.box('core_skirt', [-8, 6, -7], [8, 8, 7], coreSkirt);
  b.box('core', [-7, 8, -6], [7, 20, 6], core);
  b.box('core_top', [-8, 20, -7], [8, 22, 7], coreTop);
  b.box('knob', [7, 19.5, 4.5], [10, 22.5, 7.5], eastCap);
  // east column and cap, joined to the press by a beam
  b.box('east_tower', [10, 7, 0], [14, 21, 4.5], eastTower);
  b.box('east_cap', [8.5, 21, -3.5], [16, 28.5, 4], eastCap);
  b.box('beam', [3.5, 24, -2], [8.5, 27, 2], connector);
  // press head on top of the core
  b.box('press_guide', [-2, 22, -2], [2, 23, 2], steelPart);
  b.group('press', [0, 23, 0], () => {
    b.box('press_rod', [-1.5, 23, -1.5], [1.5, 24, 1.5], steelPart);
    b.box('press_head', [-3.5, 24, -4], [3.5, 30, 3], press);
  });
  // south: tilted output nozzle; north: input chute with hopper
  b.box('nozzle', [-9.5, 8.5, 5.5], [-2.5, 14.5, 8], nozzle, { origin: [-6, 11.5, 6.75], rotation: [0, 0, 15] });
  b.box('chute', [-9, 7.5, -7.9], [-4, 16, -6], chute, { origin: [-6.5, 11.5, -7], rotation: [0, 0, -14] });
  b.box('hopper', [-9.5, 16.5, -8], [-3, 18.5, -6], hopper, { origin: [-6.25, 17.5, -7], rotation: [0, 0, -14] });
  b.box('shelf', [-9, 6, -8], [-3, 7, -7], steelPart);
  b.box('bracket_e', [10.5, 14, -1.5], [13.5, 16, 0], steelPart);
  b.box('bolt_block', [10, 7, -5], [13, 10, -2], steelPart);

  b.anim('working', 2, { press: { position: [[0, [0, 0, 0]], [1, [0, -1, 0]], [2, [0, 0, 0]]] } });
}
