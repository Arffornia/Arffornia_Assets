// Smelter x2, tier 1 (lineage: scale, from smelter_kiln_v2). Two identical v2 kiln drums on one shared frame.
// A shared hopper drops ore into a manifold that splits it into both feed hoods; one motor turns one pinion
// set between the two girth gears, so both drums turn in step. Each firing hood pours onto one shared
// ingot conveyor that carries the ingots to the south output port. One burner line feeds both hoods.
// Why scale: the kiln principle does not change at tier 1, the player should read "twice the kiln".
import { addRamp, hsh } from '../pix.mjs';
import { pipe, teeth } from '../parts.mjs';

addRamp('gun', ['#16130f', '#27221d', '#39332c', '#524a41', '#736a5c'], { clusters: 0.035, streaks: 0.05, chips: 0.1, grime: 0.5 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.03, chips: 0.12, grime: 0.5 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { clusters: 0.05, streaks: 0.04, chips: 0.1 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });
addRamp('heat', ['#1c0f0a', '#3d1c10', '#6a2e14', '#93451c', '#c98a3e']);
addRamp('brickish', ['#24120c', '#4a2216', '#6e3220', '#8e472c', '#b0623e']);

const TILT = -3, AX = [0, 22, 0];
const sa = Math.sin(TILT * Math.PI / 180), ca = Math.cos(TILT * Math.PI / 180);
const worldY = (x, y) => AX[1] + x * sa + (y - AX[1]) * ca;

const DRUM_R = 10, TYRE_R = 12, ROLLER_R = 4, GEAR_R = 15, PINION_R = 5;
const GEAR_X = -25, TYRES = [['w', -16], ['e', 14]];
// the shared pinion sits between the two girth gears, on the plane of both drum axes
const UNITS = [['n', -(GEAR_R + PINION_R)], ['s', GEAR_R + PINION_R]];
const PIN = [GEAR_X, AX[1], 0];
const RA = 35 * Math.PI / 180, RC = TYRE_R + ROLLER_R;
const ROLL_Y = AX[1] - RC * Math.cos(RA), ROLL_Z = RC * Math.sin(RA);
const ROLLERS = UNITS.flatMap(([u]) => TYRES.flatMap(([t]) => ['n', 's'].map((s) => `roller_${t}${s}_${u}`)));

export const meta = {
  title: 'Smelter x2 (twin rotary kiln)', note: 'Two kiln drums on one frame and one drive. Tier 1.', footprint: [5, 5], height: 3, tier: 1,
  ports: [{ id: 'in', kind: 'item', face: 'up', cell: [0, 2] }, { id: 'out', kind: 'item', face: 'south', cell: [4, 0] }],
  joints: {
    drum_n: { type: 'revolute', axis: 'x' }, drum_s: { type: 'revolute', axis: 'x' }, pinion: { type: 'revolute', axis: 'x' },
    ...Object.fromEntries(ROLLERS.map((r) => [r, { type: 'revolute', axis: 'x' }])),
  },
  gears: [
    ...UNITS.map(([u]) => ({ a: `ring_gear_${u}`, b: 'pinion', ra: GEAR_R, rb: PINION_R })),
    ...UNITS.flatMap(([u]) => TYRES.flatMap(([t]) => ['n', 's'].map((s) => ({ a: `tyre_${t}_${u}`, b: `roller_${t}${s}_${u}`, ra: TYRE_R, rb: ROLLER_R })))),
  ],
  lint: { allow: [
    { a: 'tyre_*', b: 'shell_*', check: 'overlap', why: 'riding tyres are shrunk onto the shell' },
    { a: 'ring_gear_*', b: 'shell_*', check: 'overlap', why: 'the girth gear is bolted round the shell' },
    { a: 'feed_spout_*', b: 'shell_*', check: 'overlap', why: 'the stationary feed spout enters the drum along its axis' },
  ] },
};
export const look = { glow: 1.3 };

const range = (n) => [...Array(n).keys()];
const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

// 3x5 glyphs for the nameplate
const FONT = {
  K: ['#.#', '##.', '#..', '##.', '#.#'], I: ['#', '#', '#', '#', '#'], L: ['#..', '#..', '#..', '#..', '###'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'], 2: ['##.', '..#', '.#.', '#..', '###'], ' ': ['', '', '', '', ''],
};
const lettering = (d, x, y, text, ramp, k) => {
  for (const ch of text) { const g = FONT[ch]; g.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') d.px(x + i, y + j, ramp, typeof k === 'function' ? k(j) : k); })); x += g[0].length + 1; }
};

function materials(mat) {
  // plinth: tread plate deck framed by a riveted rim; the long sides carry cast feet and bolt heads
  const plinth = mat('gun', {
    side(d) {
      d.fill((x, y) => ['gun', y === 0 ? (x % 6 === 5 ? 2 : 4) : (x % 6 === 5 ? 0 : 1)]);
      for (let x = 2; x < d.w; x += 6) d.px(x, 1, 'gun', 3);
      for (let x = 0; x < d.w; x += 24) d.rect(x + 9, 0, 3, 2, 'sig', x % 48 ? 2 : 3);
    },
    top(d) {
      d.fill((x, y) => { const i = x % 5, j = y % 5, off = ((x / 5 | 0) + (y / 5 | 0)) & 1; if (j < 1 || j > 2) return null; const on = off ? i === j + 1 : i === 3 - j; return on ? ['gun', 3] : (off ? i === j + 2 : i === 4 - j) ? ['gun', 1] : null; });
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      for (let x = 12; x < d.w - 4; x += 14) d.weld(x, 1, d.h - 2, 'gun', { dir: 'v' });
      d.rivets(2, 2, d.w - 4, 'gun', { step: 5 }); d.rivets(2, d.h - 4, d.w - 4, 'gun', { step: 5, phase: 2 });
    },
  });
  // piers: anthracite frame round an orange web, broken key strokes, a copper data plate
  const pier = mat('gun', {
    side(d) {
      d.rings(1, 2, d.w - 2, d.h - 3, [['gun', 0], ['gun', 3], ['gun', 1]]);
      d.rect(3, 4, d.w - 6, Math.max(1, d.h - 8), 'sig', 2); d.hline(3, 4, d.w - 6, 'sig', 3);
      d.brokenRings(3, 5, d.w - 6, Math.max(3, d.h - 9), [[1, 'sig', 1], [3, 'sig', 3]], { breaks: 0.3 });
      d.bolt(2, 1, 'gun'); d.bolt(d.w - 4, 1, 'gun');
      d.hline(1, d.h - 1, d.w - 2, 'gun', 0);
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); d.rivets(2, 2, d.w - 4, 'gun', { step: 4 }); d.rivets(2, d.h - 4, d.w - 4, 'gun', { step: 4 }); },
  });
  const bed = mat('gun', {
    side(d) { d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 2; x < d.w - 1; x += 5) d.bolt(x, 0, 'gun'); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.weld(2, Math.floor(d.h / 2), d.w - 4, 'gun'); for (const x of [1, d.w - 2]) d.px(x, 1, 'cu', 4); },
  });
  const bearing = mat('gun', {
    side(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.px(Math.floor(d.w / 2), 1, 'cu', 4); d.hline(1, Math.floor(d.h / 2), d.w - 2, 'gun', 0); d.px(1, d.h - 2, 'gun', 4); },
    top(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.px(1, 1, 'cu', 4); d.px(d.w - 2, d.h - 2, 'cu', 3); d.vline(Math.floor(d.w / 2), 1, d.h - 2, 'gun', 0); },
    east(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.rect(1, 1, d.w - 2, d.h - 2, 'cu', 2); d.px(1, 1, 'cu', 4); d.px(d.w - 2, d.h - 2, 'cu', 1); },
    west(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.rect(1, 1, d.w - 2, d.h - 2, 'cu', 2); d.px(1, 1, 'cu', 4); d.px(d.w - 2, d.h - 2, 'gun', 0); },
  });

  // Drum facets (u along the drum, v across one 5 texel facet): rolled plates joined by circumferential
  // weld beads, rivet rows where the tyres and the gear sit, paint chips on the facet edges, and the
  // paint scorched to soot over the last 10 px before the firing hood. Slab variants carry what shows
  // the turn: a longitudinal lap seam with rivets, a bolted stiffener bar.
  const SEAMS = [9, 24, 33, 51], RIVETS = [2, 8, 17, 40];
  // ordered dither between zones so the scorch reads as a gradient, not as noise
  const heatAt = (x, y) => { const dth = ((x + 2 * y) % 4) / 4, t = x - 46; return t < 0 ? null : t < 1.5 ? 'temper' : t < 2.5 || (t < 4.5 && dth >= (t - 2.5) / 2) ? 'heat' : 'soot'; };
  const shellFace = (variant) => (d) => {
    d.fill((x, y) => {
      const plate = SEAMS.filter((sx) => sx <= x).length, r = hsh(x >> 2, y, d.seed);
      let k = (plate & 1) && y === 2 && x % 7 < 3 ? 3 : 2;
      if (r < 0.04) k = Math.max(1, k - 1);
      const h = heatAt(x, y);
      if (h === 'temper') return ['heat', 4];
      if (h === 'heat') return ['heat', k];
      if (h === 'soot') return ['heat', Math.max(0, k - 2)];
      return ['sig', k];
    });
    for (const x of SEAMS) d.weld(x, 0, d.h, x > 47 ? 'heat' : 'sig', { dir: 'v' });
    for (const x of RIVETS) d.rivets(x, 0, d.h - 1, 'sig', { dir: 'v', step: 2, phase: x & 1 });
    if (variant !== 'bar') d.rivets(52, 0, d.h - 1, 'heat', { dir: 'v', step: 2 });
    if (variant === 'lap') { d.hline(10, d.h - 1, 32, 'sig', 0); d.rivets(11, d.h - 2, 30, 'sig', { step: 4 }); }
    if (variant === 'bar') {
      d.rect(18, 1, 22, 3, 'gun', 2); d.hline(18, 1, 22, 'gun', 3); d.hline(18, 3, 22, 'gun', 1);
      for (let x = 19; x < 40; x += 4) { d.px(x, 2, 'cu', 4); d.px(x + 1, 2, 'gun', 0); }
    }
    for (let x = 3; x < 46; x++) if (hsh(x, 1, d.seed + 5) < 0.08) d.px(x, 0, 'gun', 2);
    d.rect(0, 0, 2, d.h, 'gun', 1); d.rect(d.w - 2, 0, 2, d.h, 'slag', 1);
  };
  // drum caps sit in the hoods: refractory brick lining round a slag core
  const shellCap = (d) => d.radial((r, a) => (r > DRUM_R - 0.8 ? ['gun', 1] : r > DRUM_R - 3 ? ['brickish', near(a, 15) < 2 || Math.abs(r - (DRUM_R - 2)) < 0.4 ? 0 : 2] : ['slag', (r * 3 | 0) % 3 === 0 ? 0 : 2]));
  const shellMat = (v) => mat('sig', { top: shellFace(v), side: shellCap }, { clean: true });
  const shellMats = ['plain', 'lap', 'bar', 'plain', 'lap', 'plain'].map(shellMat);

  // riding tyre: a chamfered tread with a wear line, cap with a ring of copper chair bolts
  const tyre = (k) => mat('gun', {
    top(d) {
      d.fill((x, y) => ['gun', [0, 4, 3, 2, 1][Math.min(4, x)] ?? 1]);
      d.px(2, k % 3, 'gun', 1); if (k % 2) d.px(3, d.h - 2, 'gun', 4);
    },
    side(d) {
      d.radial((r, a) => {
        if (r > TYRE_R - 0.6) return ['gun', a < 180 ? 4 : 3];
        if (r > TYRE_R - 1.2) return ['gun', 0];
        if (Math.abs(r - (TYRE_R - 1.7)) < 0.6 && near(a, 30) < 6) return ['cu', a < 180 ? 4 : 3];
        if (r > DRUM_R - 0.5) return ['gun', 2];
        return ['gun', near(a, 30) < 4 ? 0 : (r | 0) % 3 === 0 ? 3 : 1];
      });
    },
  }, { clean: true });
  const tyreMats = range(6).map(tyre);

  // girth gear: orange web with a bolt circle and lightening holes between a dark root and a lit rim
  const gearBody = mat('gun', {
    top(d) { d.fill((x, y) => ['gun', x === 0 ? 4 : x === d.w - 1 ? 0 : y % 4 === 0 ? 1 : 2]); },
    side(d) {
      d.radial((r, a) => {
        if (r > GEAR_R - 1.6) return ['gun', a < 180 ? 4 : 3];
        if (r > GEAR_R - 2.4) return ['gun', 0];
        if (Math.abs(r - 11.4) < 1 && near(a, 30, 15) < 7) return ['gun', 0];
        if (Math.abs(r - 11.4) < 1.4 && near(a, 30, 15) < 10) return ['sig', 1];
        if (Math.abs(r - 10.4) < 0.5 && near(a, 15) < 3) return ['cu', 4];
        if (r > DRUM_R - 0.2) return ['sig', a < 180 ? 3 : 2];
        return ['gun', near(a, 30) < 3 ? 3 : (r | 0) % 4 === 0 ? 0 : 1];
      });
    },
  });
  // a tooth bar: lit tip land, dark root at the body, and its hidden middle keeps the web rhythm
  const toothMat = (ramp) => mat(ramp, { all(d) {
    d.fill((x, y) => {
      const L = Math.max(d.w, d.h), t = d.h >= d.w ? y : x, e = Math.min(t, L - 1 - t), across = d.h >= d.w ? x : y;
      if (e < 1) return [ramp, 4]; if (e < 2) return [ramp, across === 0 ? 4 : 3]; if (e < 3) return ['gun', 0];
      return [ramp, t % 4 === 0 ? 0 : t % 4 === 2 ? 4 : 2];
    });
  } }, { clean: true });
  const tooth = toothMat('gun'), pinionTooth = toothMat('cu');

  // drum manway hatch: bolted frame, orange cover with a lit lip, copper hinge and dog bolts
  const hatch = mat('gun', {
    top(d) {
      d.plate(0, 0, d.w, d.h, 'gun');
      d.rect(1, 1, d.w - 2, d.h - 2, 'sig', 2); d.hline(1, 1, d.w - 2, 'sig', 4); d.vline(1, 1, d.h - 2, 'sig', 3); d.hline(2, d.h - 2, d.w - 3, 'sig', 1);
      for (const x of [0, d.w - 1]) for (const y of [0, d.h - 1]) d.px(x, y, 'cu', 4);
      d.rect(Math.floor(d.w / 2) - 1, 2, 2, d.h - 4, 'gun', 1);
    },
    side(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); d.hline(0, 0, d.w, 'gun', 4); d.px(1, 0, 'cu', 3); d.px(d.w - 2, 0, 'cu', 3); },
  }, { clean: true });
  const handle = mat('cu', { all(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.hline(0, 0, d.w, 'cu', 4); d.px(d.w - 1, d.h - 1, 'cu', 1); } }, { clean: true });

  // support rollers: crowned tread, cap with a copper hub, four spokes and a dark rim
  const rollerTread = (d) => d.fill((x, y) => ['gun', [1, 3, 4, 3, 2, 3, 0][Math.min(6, x)] - (y === 2 && x % 3 === 1 ? 1 : 0)]);
  const rollerCap = (d) => d.radial((r, a) => (r > ROLLER_R - 0.7 ? ['gun', 3] : r > ROLLER_R - 1.3 ? ['gun', 0] : r < 0.8 ? ['gun', 0] : near(a, 90, 45) < 18 ? ['cu', 4] : ['cu', 1]));
  const roller = mat('gun', { top: rollerTread, side: rollerCap }, { clean: true });
  const rollerB = mat('gun', { top(d) { rollerTread(d); d.px(3, 1, 'cu', 4); }, side: rollerCap }, { clean: true });
  const axle = mat('gun', { all(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); } }, { clean: true });

  const pinionBody = mat('cu', {
    top(d) { d.fill((x) => ['cu', x === 0 ? 4 : x === d.w - 1 ? 1 : 3]); d.px(1, 1, 'gun', 0); },
    side(d) { d.radial((r, a) => (r < 1.2 ? ['gun', 0] : r < 2.2 ? ['cu', 4] : near(a, 45) < 10 ? ['cu', 1] : r > 3.3 ? ['cu', 3] : ['cu', 2])); },
  });
  const coupling = mat('gun', { side(d) { d.fill((x, y) => ['gun', x % 2 ? 1 : 3]); d.hline(0, 0, d.w, 'cu', 4); d.px(1, d.h - 1, 'gun', 0); } });

  // motor: anthracite can with cooling fins, orange end bell with a fan grille
  const motorFins = mat('gun', {
    top(d) { d.fill((x, y) => ['gun', [4, 2, 0, 3, 1][y % 5]]); d.vline(1, 0, d.h, 'gun', 0); d.vline(d.w - 2, 0, d.h, 'gun', 0); },
    side(d) { d.radial((r, a) => (r > 4.6 ? ['gun', 3] : r > 3.8 ? ['gun', 0] : r > 2 ? (near(a, 60) < 12 ? ['sig', 3] : ['sig', 1]) : r > 1 ? ['cu', 4] : ['gun', 0])); },
  });
  const bell = mat('sig', {
    west(d) { d.rings(0, 0, d.w, d.h, [['sig', 1], ['sig', 3]]); d.vent(2, 2, d.w - 4, d.h - 4, 'gun'); },
    side(d) { d.hline(0, 0, d.w, 'sig', 4); d.px(1, d.h - 1, 'gun', 0); },
  });
  const termBox = mat('sig', {
    side(d) { d.rings(0, 0, d.w, d.h, [['sig', 0], ['sig', 3]]); d.px(1, 1, 'cu', 4); d.px(d.w - 2, 1, 'cu', 4); },
    top(d) { d.plate(0, 0, d.w, d.h, 'sig'); d.px(1, 1, 'gun', 0); d.px(2, 2, 'cu', 4); },
  });

  // feed hood: orange casing with anthracite bands and key strokes; copper seal ring where the drum enters
  // feed hood: anthracite casing; the house colour is kept for its door, which carries the hex mark
  const feedHood = mat('gun', {
    side(d) { d.hline(0, 0, d.w, 'gun', 4); d.rect(0, d.h - 4, d.w, 4, 'gun', 1); d.hline(0, d.h - 4, d.w, 'gun', 3); d.rivets(1, d.h - 3, d.w - 2, 'gun', { step: 3 }); },
    west(d) {
      d.plate(2, 3, d.w - 4, 18, 'sig');
      d.rings(4, 5, d.w - 8, 14, [['sig', 1], ['sig', 3]]);
      d.brokenRings(6, 7, d.w - 12, 10, [[0, 'gun', 0], [2, 'sig', 4]], { breaks: 0.3 });
      for (const y of [5, 17]) { d.px(3, y, 'cu', 4); d.px(d.w - 4, y, 'cu', 4); }
      d.rect(6, 23, d.w - 12, 2, 'gun', 0); d.hline(7, 23, d.w - 14, 'cu', 3);
      d.vent(4, 26, d.w - 8, 5, 'gun');
    },
    south(d) { d.window(1, 8, d.w - 2, 7, 'gun', 'amber'); d.brokenRings(1, 17, d.w - 2, d.h - 22, [[0, 'gun', 3], [2, 'sig', 2]]); },
    north(d) { d.inset(1, 6, d.w - 2, 14, 'gun'); d.rect(3, 8, d.w - 6, 10, 'sig', 2); d.vline(Math.floor(d.w / 2), 8, 10, 'sig', 0); d.hline(3, 8, d.w - 6, 'sig', 4); d.brokenRings(1, 21, d.w - 2, d.h - 26, [[0, 'gun', 3], [2, 'gun', 0]]); },
    east(d) {
      d.brokenRings(0, 0, d.w, d.h, [[1, 'gun', 3], [3, 'sig', 2], [5, 'gun', 0]]);
      const cx = (d.w - 1) / 2, cy = d.h - 1 - (AX[1] - 2);
      d.radial((r, a) => (r < DRUM_R + 0.6 ? ['slag', 1] : r < DRUM_R + 2 ? ['cu', a < 180 ? 4 : 2] : r < DRUM_R + 3 && near(a, 30) < 5 ? ['cu', 3] : null), { cx, cy });
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); d.rivets(2, 2, d.w - 4, 'gun', { step: 4 }); },
  });
  const termBoxJ = mat('gun', { south(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.px(1, 1, 'amber', 3); d.px(2, 1, 'cu', 4); } });
  const hopperNeck = mat('gun', { side(d) { d.fill((x, y) => ['gun', x % 4 === 0 ? 1 : y === 0 ? 4 : 2]); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'cu', 3); }, top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.px(1, 1, 'cu', 4); d.px(d.w - 2, d.h - 2, 'gun', 4); } });
  const hopperBin = mat('sig', {
    side(d) {
      d.rect(0, 0, 1, d.h, 'gun', 2); d.rect(d.w - 1, 0, 1, d.h, 'gun', 1);
      d.hline(0, d.h - 1, d.w, 'gun', 0);
      d.rings(2, 1, d.w - 4, d.h - 3, [['sig', 1], ['sig', 3]]);
      d.hline(3, 3, d.w - 6, 'gun', 1);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.rivets(1, 1, d.w - 2, 'gun', { step: 3 }); },
    down(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); d.inset(2, 2, d.w - 4, d.h - 4, 'gun'); },
  });
  const portIn = mat('gun', {
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let x = 1; x < d.w; x += 3) d.px(x, 1, 'gun', 0); },
    up(d) {
      d.rect(0, 0, d.w, d.h, 'cu', 3); d.hline(0, 0, d.w, 'cu', 4);
      d.rect(1, 1, d.w - 2, d.h - 2, 'slag', 0);
      for (const [x, y, k] of [[2, 2, 3], [3, 3, 4], [6, 2, 2], [7, 4, 3], [4, 6, 3], [8, 7, 2], [2, 8, 4], [5, 9, 3], [9, 3, 3], [3, 5, 2]]) if (x < d.w - 1 && y < d.h - 1) { d.px(x, y, 'slag', k); d.px(x + 1, y, 'slag', k - 1); }
      d.px(6, 6, 'cu', 4); d.px(3, 9, 'cu', 3);
    },
  }, { clean: true });

  // firing hood: heavy anthracite casing, orange door frame, glowing mouth, the Arffornia hex mark
  const capStripes = (d) => d.stripes(1, d.h - 3, d.w - 2, 2, ['gun', 0], ['sig', 3]);
  const fireHood = mat('gun', {
    side(d) { d.hline(0, 0, d.w, 'gun', 4); },
    east(d) {
      d.rings(1, 1, d.w - 2, d.h - 2, [['sig', 1], ['sig', 3], ['sig', 2], ['gun', 0]]);
      const cx = (d.w - 1) / 2, top = 6, bot = d.h - 5, hw = 5;
      d.fill((x, y) => {
        if (y < top || y > bot) return null; const dx = Math.abs(x - cx);
        const arch = y < top + hw ? Math.hypot(dx, top + hw - y) : dx;
        if (arch > hw + 1.2) return null; if (arch > hw) return ['gun', y < top + hw ? 0 : 1];
        const t = (y - top) / (bot - top);
        if (t < 0.3) return ['slag', 0];
        if (t < 0.45) return ['slag', 1];
        if (t < 0.55) return ['amber', 0];
        if (t < 0.75) return ['amber', (x + y) % 3 === 0 ? 2 : 1];
        return ['amber', y === bot - 1 ? 4 : 3];
      });
      d.hline(Math.ceil(cx - hw), bot + 1, 2 * hw, 'cu', 3);
      for (const y of [6, 11, 16]) { d.bolt(2, y, 'gun'); d.bolt(d.w - 4, y, 'gun'); }
    },
    south(d) {
      d.rings(1, 2, d.w - 2, 13, [['gun', 0], ['sig', 3], ['sig', 2]]);
      d.window(2, 4, d.w - 4, 6, 'gun', 'amber');
      d.brokenRings(1, 15, d.w - 2, 6, [[0, 'sig', 2], [1, 'gun', 3]]);
      d.vent(1, 22, d.w - 2, d.h - 24, 'gun');
    },
    north(d) {
      d.rings(1, 2, d.w - 2, d.h - 6, [['gun', 0], ['sig', 3], ['sig', 2]]);
      d.brokenRings(3, 4, d.w - 6, d.h - 10, [[0, 'sig', 1], [2, 'sig', 3], [4, 'gun', 1]]);
      d.bolt(2, 3, 'sig'); d.bolt(d.w - 4, d.h - 7, 'sig');
    },
    west(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      d.brokenRings(1, 1, d.w - 2, d.h - 2, [[1, 'gun', 1], [3, 'gun', 3]]);
      const cx = (d.w - 1) / 2, cy = d.h - 1 - (AX[1] - 10.5);
      d.radial((r) => (r < DRUM_R + 0.6 ? ['slag', 0] : r < DRUM_R + 2 ? ['amber', r < DRUM_R + 1.3 ? 2 : 1] : null), { cx, cy });
    },
    up(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); capStripes(d); d.rivets(2, 2, d.w - 4, 'gun', { step: 4 }); },
    down(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); },
  });
  const hoodLeg = mat('gun', { side(d) { d.fill((x, y) => ['gun', x === 0 ? 3 : x === d.w - 1 ? 0 : y % 5 === 0 ? 1 : 2]); d.px(1, 1, 'cu', 4); }, top(d) { d.inset(0, 0, d.w, d.h, 'gun'); } });
  const flue = mat('gun', { side(d) { for (const y of [1, 4]) { d.hline(0, y, d.w, 'gun', 0); d.hline(0, y + 1, d.w, 'gun', 4); } }, up(d) { d.rect(0, 0, d.w, d.h, 'slag', 0); d.px(1, 1, 'amber', 1); } });
  const flueCap = mat('cu', { side(d) { d.hline(0, 0, d.w, 'cu', 4); d.hline(0, d.h - 1, d.w, 'cu', 1); }, up(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.rect(1, 1, d.w - 2, d.h - 2, 'slag', 0); d.px(2, 2, 'amber', 1); } });
  const chute = mat('gun', {
    up(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); d.rect(0, 1, d.w, d.h - 2, 'amber', 2); d.hline(0, Math.floor(d.h / 2), d.w, 'amber', 3); d.px(1, 2, 'amber', 4); },
    side(d) { d.hline(0, 0, d.w, 'cu', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); d.px(1, 1, 'cu', 2); },
  });
  const stream = mat('amber', { all(d) { d.fill((x, y) => ['amber', x === 0 ? 2 : (y + x) % 4 === 0 ? 4 : 3]); } }, { clean: true });
  const crateWall = mat('gun', {
    side(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 5 === 0 ? 1 : y > d.h - 2 ? 0 : 2]); for (const x of [0, d.w - 1]) d.vline(x, 0, d.h, 'cu', 2); for (let x = 2; x < d.w - 1; x += 5) d.px(x, 1, 'cu', 4); },
    top(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.hline(0, 0, d.w, 'cu', 4); d.px(1, d.h - 1, 'cu', 1); },
  }, { clean: true });
  const melt = mat('amber', {
    up(d) {
      d.fill((x, y) => ['amber', (x % 5 === 4 || y % 6 === 5) ? 1 : (x + y * 2) % 7 === 0 ? 4 : 3]);
      for (let x = 4; x < d.w; x += 5) d.vline(x, 0, d.h, 'gun', 1);
    },
  }, { clean: true });
  const portOut = mat('gun', {
    east(d) { d.rings(0, 0, d.w, d.h, [['cu', 3], ['gun', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'slag', 1); d.hline(2, 2, d.w - 4, 'slag', 0); d.px(2, d.h - 3, 'amber', 1); },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) d.px(0, y, 'gun', 0); },
  });

  // copper line: lit crown, dark belly, a weld ring every 6 px and a stamped band between them
  const pipeMat = mat('cu', { all(d) {
    const along = d.w >= d.h, L = along ? d.w : d.h, A = along ? d.h : d.w;
    d.fill((x, y) => {
      const t = along ? x : y, c = along ? y : x;
      const k = c === 0 ? 3 : c === A - 1 ? 1 : 2;
      if (t % 8 === 4) return ['cu', c === 0 ? 4 : 0];
      return ['cu', k];
    });
  } }, { clean: true });
  const flange = mat('cu', { all(d) { d.rect(0, 0, d.w, d.h, 'cu', 2); d.hline(0, 0, d.w, 'cu', 4); d.hline(0, d.h - 1, d.w, 'cu', 1); for (let i = 1; i < Math.max(d.w, d.h) - 1; i += 2) d.px(d.w > d.h ? i : 0, d.w > d.h ? 0 : i, 'gun', 0); } }, { clean: true });
  const bracket = mat('gun', { side(d) { d.fill((x, y) => ['gun', x === 0 ? 3 : x === d.w - 1 ? 0 : y === 0 ? 4 : y % 3 === 0 ? 1 : 2]); d.px(1, d.h - 2, 'cu', 3); }, top(d) { d.inset(0, 0, d.w, d.h, 'gun'); } }, { clean: true });
  const valveBody = mat('gun', {
    side(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.px(1, 1, 'cu', 4); d.px(d.w - 2, 1, 'cu', 4); d.rect(1, d.h - 2, d.w - 2, 1, 'sig', 3); },
    top(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.px(1, 1, 'cu', 4); d.px(d.w - 2, d.h - 2, 'cu', 3); },
  }, { clean: true });
  const wheel = mat('sig', {
    top(d) { const c = (d.w - 1) / 2; d.fill((x, y) => (x === 0 || y === 0 ? ['sig', 4] : x === d.w - 1 || y === d.h - 1 ? ['sig', 1] : x === c && y === c ? ['cu', 4] : x === c || y === c ? ['sig', 2] : ['gun', 0])); },
    side(d) { d.fill((x) => ['sig', x % 2 ? 1 : 3]); },
  }, { clean: true });
  const lamp = mat('amber', { side(d) { d.rect(0, 0, d.w, d.h, 'amber', 3); d.px(0, 0, 'amber', 4); }, up(d) { d.rect(0, 0, d.w, d.h, 'amber', 4); } }, { flat: true });
  const gauge = mat('gun', { south(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.rect(1, 1, d.w - 2, d.h - 2, 'gun', 4); d.px(1, 1, 'slag', 0); d.px(2, 2, 'amber', 2); } });
  return { plinth, pier, bed, bearing, shellMats, tyreMats, gearBody, tooth, pinionTooth, hatch, handle, roller, rollerB, axle, pinionBody, coupling, motorFins, bell, termBox, feedHood, hopperNeck, hopperBin, portIn, capStripes, fireHood, hoodLeg, flue, flueCap, chute, stream, crateWall, melt, portOut, pipeMat, flange, bracket, valveBody, wheel, lamp, gauge };
}

// The v2 kiln unit, unchanged, around the drum axis at z = zc: rollers on their beds, then the drum with its
// shell, tyres, girth gear and hatches. Called inside the tilted 'kiln' group.
function kilnUnit(b, M, u, zc) {
  for (const [t, xt] of TYRES) {
    for (const [s, sz] of [['n', zc - ROLL_Z], ['s', zc + ROLL_Z]]) {
      b.box(`bed_${t}${s}_${u}`, [xt - 8, ROLL_Y - 5.5, sz - 3], [xt + 8, ROLL_Y - 3.5, sz + 3], M.bed);
      for (const dx of [-1, 1]) b.box(`bearing_${t}${s}${dx > 0 ? 'e' : 'w'}_${u}`, [xt + dx * 5 - (dx > 0 ? 0 : 3), ROLL_Y - 3.5, sz - 2.5], [xt + dx * 5 + (dx > 0 ? 3 : 0), ROLL_Y + 2.5, sz + 2.5], M.bearing);
      b.group(`roller_${t}${s}_${u}`, [xt + 5, ROLL_Y, sz], () => {
        b.prism(`roller_${t}${s}_${u}`, [xt, ROLL_Y, sz], ROLLER_R, 7, 'x', M.roller, 8, { mats: [M.rollerB] });
        b.box(`roller_${t}${s}_${u}#5`, [xt - 5, ROLL_Y - 1, sz - 1], [xt + 5, ROLL_Y + 1, sz + 1], M.axle);
      });
    }
  }
  b.group(`drum_${u}`, [-29, AX[1], zc], () => {
    b.prism(`shell_${u}`, [-2, AX[1], zc], DRUM_R, 56, 'x', M.shellMats[0], 12, { mats: M.shellMats });
    for (const [t, xt] of TYRES) b.prism(`tyre_${t}_${u}`, [xt, AX[1], zc], TYRE_R, 5, 'x', M.tyreMats[0], 12, { mats: M.tyreMats });
    b.prism(`ring_gear_${u}`, [GEAR_X, AX[1], zc], GEAR_R - 1, 3, 'x', M.gearBody, 12);
    teeth(b, `ring_gear_${u}`, [GEAR_X, AX[1], zc], 'x', GEAR_R + 1, 12, 2.5, 2, M.tooth, { start: 7 });
    for (const [i, x0, ang] of [[1, -10, 0], [2, 3, 150], [3, 0, 270]]) {
      const top = AX[1] + DRUM_R, o = { origin: [x0 + 3.5, AX[1], zc], rotation: [ang, 0, 0] };
      b.box(`hatch_${i}_${u}`, [x0, top - 0.5, zc - 2.5], [x0 + 7, top + 1, zc + 2.5], M.hatch, o);
      b.box(`hatch_${i}_grip_${u}`, [x0 + 2.5, top + 1, zc - 1], [x0 + 4.5, top + 2, zc + 1], M.handle, o);
    }
  });
}

// The static parts of one unit: piers, feed hood, firing hood with its flue, chute and molten stream.
function unitHoods(b, M, u, zc, capMat, bandMat) {
  const bedBottom = (x) => worldY(x, ROLL_Y - 5.5);
  for (const [t, xt] of TYRES) b.box(`pier_${t}_${u}`, [xt - 7, 2, zc - 12], [xt + 7, bedBottom(xt) + 0.2, zc + 12], M.pier);
  b.box(`feed_hood_${u}#1`, [-38, 2, zc - 11.5], [-30, 36, zc + 11.5], M.feedHood);
  b.box(`feed_hood_${u}#2`, [-38.5, 30, zc - 12], [-29.5, 32, zc + 12], bandMat);
  b.box(`feed_hood_${u}#3`, [-38.6, 34.5, zc - 12.1], [-29.4, 36.2, zc + 12.1], capMat);
  b.box(`door_handle_${u}`, [-39, 12, zc - 3], [-38, 13, zc + 3], M.handle);
  b.box(`feed_spout_${u}`, [-31, AX[1] - 2, zc - 2], [-27, AX[1] + 2, zc + 2], M.pipeMat);
  b.box(`fire_hood_${u}#1`, [26, 10.5, zc - 12], [34, 34, zc + 12], M.fireHood);
  b.box(`fire_hood_${u}#2`, [25.6, 32.6, zc - 12.4], [34.4, 34.1, zc + 12.4], capMat);
  b.box(`fire_hood_${u}#3`, [25.6, 10.4, zc - 12.4], [34.4, 12, zc + 12.4], capMat);
  b.box(`hood_leg_${u}n`, [26, 2, zc - 12], [28, 10.5, zc - 8], M.hoodLeg);
  b.box(`hood_leg_${u}s`, [26, 2, zc + 8], [28, 10.5, zc + 12], M.hoodLeg);
  b.box(`flue_${u}`, [28, 34, zc - 6], [32, 41, zc - 2], M.flue);
  b.box(`flue_cap_${u}`, [27.5, 41, zc - 6.5], [32.5, 42.5, zc - 1.5], M.flueCap);
  b.box(`chute_${u}`, [34, 13, zc - 2.5], [37.5, 15.5, zc + 2.5], M.chute);
  b.box(`chute_lip_${u}`, [36.5, 12, zc - 2.5], [37.5, 13, zc + 2.5], M.flange);
  b.box(`stream_${u}`, [35.2, 8, zc - 1], [36.2, 12, zc + 1], M.stream);
}

export function build(b, { mat }) {
  const M = materials(mat);
  const capMat = mat('gun', { side(d) { d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 3; x < d.w - 1; x += 6) d.px(x, 1, 'cu', 3); }, top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); for (let x = 3; x < d.w - 2; x += 5) d.px(x, 2, 'gun', 4); M.capStripes(d); } });
  const bandMat = mat('gun', { side(d) { d.hline(0, 0, d.w, 'gun', 4); d.hline(0, 1, d.w, 'gun', 1); for (let x = 2; x < d.w; x += 4) { d.px(x, 1, 'cu', 3); d.px(x + 2, 0, 'gun', 0); } } });
  const rail = mat('gun', {
    side(d) {
      d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0);
      for (let x = 2; x + 9 < d.w; x += 12) { d.inset(x, 1, 9, d.h - 2, 'sig'); d.px(x + 1, 2, 'sig', 4); }
      for (let x = 0; x < d.w; x += 12) d.bolt(x, 1, 'gun');
    },
    top(d) { d.rect(0, 0, d.w, d.h, 'gun', 3); for (let x = 1; x < d.w; x += 4) { d.px(x, 0, 'gun', 4); d.px(x + 1, 1, 'gun', 0); } },
  });
  // nameplate: copper plate, riveted corners, stamped lettering
  const nameplate = mat('cu', {
    south(d) {
      d.fill((x, y) => ['gun', y === 0 ? 3 : y === d.h - 1 ? 0 : (x + y) % 5 === 0 ? 2 : 1]);
      lettering(d, 0, 1, 'KILN X2', 'cu', (j) => (j < 2 ? 4 : j < 4 ? 3 : 2));
    },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : 2]); },
    top(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.hline(0, 0, d.w, 'cu', 4); },
  }, { clean: true });
  // central spine between the two units: tread plate deck, orange insets on the sides
  const spine = mat('gun', {
    side(d) { d.hline(0, 0, d.w, 'gun', 4); for (let x = 2; x + 6 < d.w; x += 9) { d.inset(x, 1, 6, d.h - 1, 'sig'); d.px(x + 1, 1, 'sig', 4); } },
    top(d) {
      d.fill((x, y) => { const i = x % 5, j = y % 5, off = ((x / 5 | 0) + (y / 5 | 0)) & 1; if (j < 1 || j > 2) return null; const on = off ? i === j + 1 : i === 3 - j; return on ? ['gun', 3] : null; });
      d.rings(0, 0, d.w, d.h, [['gun', 0]]); for (let x = 10; x < d.w - 4; x += 11) d.weld(x, 1, d.h - 2, 'gun', { dir: 'v' });
    },
  });
  // feed manifold: orange casing with the Arffornia mark, splits the ore into both feed hoods
  const manifold = mat('sig', {
    west(d) {
      d.rect(0, 0, 2, d.h, 'gun', 1); d.rect(d.w - 2, 0, 2, d.h, 'gun', 1);
      const x = Math.floor((d.w - 9) / 2); d.rect(x - 1, 0, 11, d.h, 'gun', 0); d.hexMark(x, Math.floor((d.h - 8) / 2));
      d.rivets(2, 1, x - 3, 'gun', { step: 2, dir: 'v' }); d.rivets(d.w - 3, 1, d.h - 2, 'gun', { step: 2, dir: 'v' });
    },
    side(d) { d.rings(0, 0, d.w, d.h, [['gun', 1], ['sig', 3]]); d.brokenRings(2, 2, d.w - 4, d.h - 4, [[0, 'sig', 1]]); d.bolt(1, 1, 'gun'); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.rivets(1, 1, d.w - 2, 'gun', { step: 3 }); },
    down(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); },
  });
  const duct = mat('gun', {
    side(d) { d.fill((x, y) => ['gun', x % 4 === 0 ? 1 : y === 0 ? 4 : 2]); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'cu', 3); d.rect(1, 2, d.w - 2, 1, 'sig', 2); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.rivets(1, 1, d.w - 2, 'gun', { step: 3 }); d.hline(1, Math.floor(d.h / 2), d.w - 2, 'sig', 2); },
  });
  // ingot conveyor: dark slatted belt with copper edge, steel side rails with orange insets
  const belt = mat('gun', {
    up(d) { d.fill((x, y) => ['gun', x === 0 || x === d.w - 1 ? 3 : y % 4 === 0 ? 0 : y % 4 === 1 ? 3 : 1]); for (let y = 2; y < d.h; y += 8) { d.px(1, y, 'cu', 4); d.px(d.w - 2, y + 4, 'cu', 3); } },
    side(d) { d.hline(0, 0, d.w, 'gun', 4); for (let x = 0; x < d.w; x += 4) d.px(x, 1, 'gun', 0); },
    north(d) { d.radial((r) => (r < 1 ? ['cu', 4] : ['gun', r < 2 ? 1 : 3])); },
  });
  const ingot = mat('cu', {
    up(d) { d.rect(0, 0, d.w, d.h, 'amber', 2); d.rings(0, 0, d.w, d.h, [['cu', 3]]); d.px(1, 1, 'amber', 4); },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : 2]); d.px(0, d.h - 1, 'amber', 1); },
  }, { clean: true });

  const portOutS = mat('gun', {
    south(d) { d.rings(0, 0, d.w, d.h, [['cu', 3], ['gun', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'slag', 1); d.hline(2, 2, d.w - 4, 'slag', 0); d.rect(3, d.h - 6, d.w - 6, 3, 'gun', 2); d.hline(3, d.h - 6, d.w - 6, 'cu', 3); d.px(4, d.h - 5, 'amber', 2); d.px(7, d.h - 5, 'amber', 1); },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) d.px(0, y, 'gun', 0); },
  });
  // ---------------------------------------------------------------- shared frame
  b.box('plinth', [-38, 0, -34], [30, 2, 34], M.plinth);
  b.box('spine', [-19, 2, -7], [25, 5, 7], spine);
  for (const [i, x0, x1] of [[1, -30, -23], [2, -9, 7], [3, 21, 26]]) {
    b.box(`rail_n${i}`, [x0, 2.01, -34], [x1, 6.5, -32.5], rail);
    if (i !== 2) b.box(`rail_s${i}`, [x0, 2.01, 32.5], [x1, 6.5, 34], rail);
  }
  b.box('nameplate', [-12, 2.01, 32.5], [10, 9, 34], nameplate);

  for (const [u, zc] of UNITS) unitHoods(b, M, u, zc, capMat, bandMat);

  // shared feed: one hopper, a manifold between the hoods, a duct into each feed hood
  b.box('manifold', [-38, 34, -8.9], [-28, 42, 8.9], manifold);
  for (const [u, s] of [['n', -1], ['s', 1]]) {
    const z = (a, c) => (s < 0 ? [-c, -a] : [a, c]);
    const [z0, z1] = z(8.9, 18), [f0, f1] = z(15, 16), [l0, l1] = z(11, 12);
    b.box(`duct_${u}#1`, [-36, 36.2, z0], [-31, 40, z1], duct);
    b.box(`duct_${u}#2`, [-36.6, 36.21, f0], [-30.4, 40.6, f1], M.flange);
    // diverter flap lever: one per branch, the operator can shut a drum off
    b.box(`diverter_${u}`, [-34, 40, l0], [-33, 42.5, l1], M.handle);
    b.box(`diverter_${u}_knob`, [-34.5, 42.5, l0 - 0.5], [-32.5, 43.5, l1 + 0.5], mat('sig', { all(d) { d.rect(0, 0, d.w, d.h, 'sig', 3); d.px(0, 0, 'sig', 4); d.px(d.w - 1, d.h - 1, 'sig', 1); } }, { clean: true }));
  }
  b.box('hopper_bin', [-38.5, 42, -8], [-25.5, 46, 8], M.hopperBin);
  b.box('port_in', [-37, 46, -5], [-27, 48, 5], M.portIn);

  // shared output: one ingot conveyor under both pours, out through the south port
  b.box('conveyor#1', [28.5, 3.5, -38], [37, 8, 39], belt);
  b.box('conveyor#2', [27.5, 3.5, -38], [28.5, 9, 39], rail);
  b.box('conveyor#3', [37, 3.5, -38], [38, 9, 39], rail);
  for (const z of [-37, -2, 34]) b.box(`conveyor_leg_${z}`, [30, 0, z], [37.5, 3.5, z + 4], M.hoodLeg);
  b.box('port_out', [26, 2, 39], [38, 14, 40], portOutS);
  for (const z of [-13, -4, 5, 28, 35]) b.box(`ingot_${z + 20}`, [33.5, 7.99, z - 2], [36.5, 9.5, z + 2], ingot);
  b.box('lamp', [31, 34, 28], [33, 36, 30], M.lamp);
  b.box('gauge', [30, 26, 32], [33, 29, 33], M.gauge);

  // shared burner line along the spine, a riser and a tee into both firing hoods
  pipe(b, 'burner_run', [-19, 5, -1], 'x', 44, 2, M.pipeMat, { flange: M.flange, every: 10, first: 9 });
  b.box('burner_run#6', [3, 4.5, -1.5], [7, 7.5, 1.5], M.valveBody);
  b.box('burner_run#7', [4.5, 7.5, -0.5], [5.5, 9, 0.5], M.axle);
  b.box('burner_run#8', [2.5, 9, -2.5], [7.5, 9.5, 2.5], M.wheel);
  pipe(b, 'burner_rise', [25, 2, -1], 'y', 16, 2, M.pipeMat, { flange: M.flange, every: 10, first: 7 });
  pipe(b, 'burner_tee', [25, 18, -8], 'z', 16, 2, M.pipeMat, { flange: M.flange, ends: true });

  // shared drive pedestals
  const motorBottom = worldY(-34, PIN[1] - 5.5);
  b.box('motor_bed', [-39, 2, -6], [-29, motorBottom + 0.3, 6], mat('gun', { side(d) { d.hline(0, 0, d.w, 'gun', 4); M.capStripes(d); d.bolt(1, 1, 'gun'); d.inset(2, 3, d.w - 4, d.h - 7, 'sig'); }, top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.rivets(1, 1, d.w - 2, 'gun', { step: 3 }); } }));
  b.box('pinion_stand', [-23, 2, -2.4], [-19, worldY(-21, PIN[1] - 2.5) + 0.3, 2.4], M.pier);

  // ---------------------------------------------------------------- tilted drive and drums
  b.group('kiln', AX, () => {
    for (const [u, zc] of UNITS) kilnUnit(b, M, u, zc);
    const [px, py, pz] = PIN;
    b.prism('motor', [-34, py, pz], 5.5, 8, 'x', M.motorFins, 8);
    b.box('motor_bell', [-39.3, py - 4, pz - 4], [-38, py + 4, pz + 4], M.bell);
    b.box('motor_term', [-35, py + 5, pz - 2.5], [-32, py + 8, pz + 1], M.termBox);
    b.box('pinion_block', [-23, py - 2.5, pz - 2.5], [-19, py + 2.5, pz + 2.5], M.bearing);
    b.group('pinion', [-23, py, pz], () => {
      b.prism('pinion', [px, py, pz], PINION_R - 1, 3, 'x', M.pinionBody, 8);
      teeth(b, 'pinion', [px, py, pz], 'x', PINION_R + 1, 4, 2.5, 2, M.pinionTooth, { start: 5, phase: 22.5 });
      b.box('pinion#9', [-30, py - 1, pz - 1], [px - 1.5, py + 1, pz + 1], M.axle);
      b.box('pinion#10', [-29.5, py - 2, pz - 2], [-27.5, py + 2, pz + 2], M.coupling);
      b.box('pinion#11', [px + 1.5, py - 1, pz - 1], [-23, py + 1, pz + 1], M.axle);
    });
  }, [0, 0, TILT]);

  const L = 8, turn = (k) => ({ rotation: range(4 * L + 1).map((q) => [q / 4, [k * 90 * q / L, 0, 0]]) });
  b.anim('working', L, {
    drum_n: turn(1), drum_s: turn(1), pinion: turn(-GEAR_R / PINION_R),
    ...Object.fromEntries(ROLLERS.map((r) => [r, turn(-TYRE_R / ROLLER_R)])),
  });
}
