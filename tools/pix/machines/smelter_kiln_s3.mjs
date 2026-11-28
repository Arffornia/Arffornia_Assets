// Smelter, tier 2: indirect-fired rotary kiln (r5 concept S3, built on smelter_kiln_v2).
// Process: a mechanical shaft (west port) drives a reduction gearbox, the pinion and the girth gear, so the
// tilted drum turns. Ore enters the hopper (up port) and tumbles down the drum. Coal (north port) slides down
// an inclined chute by gravity onto the grate of a firebrick trough under the drum, and the flames heat the
// shell from below, as in a real indirect-fired kiln. Hot metal leaves the low end through the
// discharge hood and pours into the ingot crate (east port). Flue gas leaves by the hood flue.
import { addRamp, hsh } from '../pix.mjs';
import { teeth } from '../parts.mjs';
import { PALETTES } from '../palettes.mjs';

addRamp('gun', ['#16130f', '#27221d', '#39332c', '#524a41', '#736a5c'], { clusters: 0.035, streaks: 0.05, chips: 0.1, grime: 0.5 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.03, chips: 0.12, grime: 0.5 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { clusters: 0.05, streaks: 0.04, chips: 0.1 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });
// scorched paint near the fire end: burnt orange to soot, a straw temper line where it starts
addRamp('heat', ['#1c0f0a', '#3d1c10', '#6a2e14', '#93451c', '#c98a3e']);
addRamp('brickish', ['#24120c', '#4a2216', '#6e3220', '#8e472c', '#b0623e']);
// colour studies (Brian, 2026-11-07, undecided): KILN_PALETTE=oxyde|vert|ocre, see tools/pix/palettes.mjs
for (const [ramp, shades] of Object.entries(PALETTES[process.env.KILN_PALETTE] || {})) addRamp(ramp, shades);

const TILT = -3, AX = [0, 22, 0];
const sa = Math.sin(TILT * Math.PI / 180), ca = Math.cos(TILT * Math.PI / 180);
const worldY = (x, y) => AX[1] + x * sa + (y - AX[1]) * ca;

const DRUM_R = 10, TYRE_R = 12, ROLLER_R = 4, GEAR_R = 15, PINION_R = 5;
const GEAR_X = -25, TYRES = [['w', -16], ['e', 14]];
const PIN = [GEAR_X, AX[1] - (GEAR_R + PINION_R) * Math.sin(Math.PI / 6), (GEAR_R + PINION_R) * Math.cos(Math.PI / 6)];
const RA = 35 * Math.PI / 180, RC = TYRE_R + ROLLER_R;
const ROLL_Y = AX[1] - RC * Math.cos(RA), ROLL_Z = RC * Math.sin(RA);

export const meta = {
  title: 'Smelter (indirect-fired rotary kiln)', note: 'Ore to ingots in a turning kiln fired from below. Tier 2.', footprint: [5, 3], height: 3, tier: 2,
  ports: [
    { id: 'in', kind: 'item', face: 'up', cell: [0, 1] }, { id: 'out', kind: 'item', face: 'east', cell: [1, 0] },
    { id: 'fuel', kind: 'item', face: 'north', cell: [2, 0] }, { id: 'power', kind: 'rotation', face: 'west', cell: [2, 0], bone: 'shaft_in' },
  ],
  joints: {
    drum: { type: 'revolute', axis: 'x' }, pinion: { type: 'revolute', axis: 'x' },
    shaft_in: { type: 'revolute', axis: 'x' },
    chute: { type: 'revolute', axis: 'z' }, stream: { type: 'free', why: 'molten metal stream, only while pouring' },
    ...Object.fromEntries([1, 2, 3, 4].map((i) => [`flame_${i}`, { type: 'free', light: true, why: 'flame: light that flickers and lights up' }])),
    roller_wn: { type: 'revolute', axis: 'x' }, roller_ws: { type: 'revolute', axis: 'x' },
    roller_en: { type: 'revolute', axis: 'x' }, roller_es: { type: 'revolute', axis: 'x' },
  },
  drives: [{ a: 'shaft_in', b: 'pinion', ratio: -0.5, via: 'reduction gearbox' }],
  gears: [
    { a: 'ring_gear', b: 'pinion', ra: GEAR_R, rb: PINION_R, ta: 24, tb: 8 },
    ...TYRES.flatMap(([t]) => ['n', 's'].map((s) => ({ a: `tyre_${t}`, b: `roller_${t}${s}`, ra: TYRE_R, rb: ROLLER_R }))),
  ],
  lint: { allow: [
    { a: 'tyre_*', b: 'shell#*', check: 'overlap', why: 'riding tyres are shrunk onto the shell' },
    { a: 'ring_gear#*', b: 'shell#*', check: 'overlap', why: 'the girth gear is bolted round the shell' },
    { a: 'feed_spout', b: 'shell#*', check: 'overlap', why: 'the stationary feed spout enters the drum along its axis' },
    { a: 'firebed#*', b: 'pier_*', check: 'overlap', why: 'the fire trough is built into the pier masonry' },
    { a: 'flame_*', b: 'hatch_*', check: 'sweep', why: 'flames are light: the drum hatches pass through them' },
  ] },
};
export const look = { glow: 1.3 };
// particle emitters for the mod (and the preview): smoke from the hood flue and the feed-end vent, sparks over the grate
meta.fx = [
  { id: 'flue_smoke', kind: 'smoke', at: [30, 43, -4], anims: ['working'], rise: 44, spread: 3, drift: 6, size: 1.2 },
  { id: 'vent_smoke', kind: 'smoke', at: [-31.5, 41.5, 8], anims: ['working'], rise: 30, spread: 2, drift: 4, size: 0.8, count: 8 },
  ...[-18, -7, 3, 18].map((x, i) => ({ id: `sparks_${i + 1}`, kind: 'ember', at: [x, 4, 0], anims: ['working'], rise: 8, spread: 8, life: 0.8 + 0.1 * i })),
];

const range = (n) => [...Array(n).keys()];
// angular distance to the nearest multiple of `step` degrees
const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

export function build(b, { mat: plainMat }) {
  // every face gets the weathering pass (Brian: the drum was not rich enough)
  const mat = (ramp, design, o = {}) => plainMat(ramp, design, { weather: 1, ...o });
  // ---------------------------------------------------------------- materials
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

  const feedHood = mat('gun', {
    side(d) { d.hline(0, 0, d.w, 'gun', 4); d.rect(0, d.h - 4, d.w, 4, 'gun', 1); d.hline(0, d.h - 4, d.w, 'gun', 3); d.rivets(1, d.h - 3, d.w - 2, 'gun', { step: 3 }); },
    west(d) {
      d.plate(2, 3, d.w - 4, 18, 'sig');
      d.rings(4, 5, d.w - 8, 14, [['sig', 1], ['sig', 3]]);
      d.rect(Math.floor(d.w / 2) - 5, 7, 11, 10, 'gun', 0); d.hexMark(Math.floor(d.w / 2) - 4, 8);
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
  const lamp = mat('amber', { side(d) { d.rect(0, 0, d.w, d.h, 'amber', 3); d.px(0, 0, 'amber', 4); }, up(d) { d.rect(0, 0, d.w, d.h, 'amber', 4); } }, { flat: true });
  const gauge = mat('gun', { south(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.rect(1, 1, d.w - 2, d.h - 2, 'gun', 4); d.px(1, 1, 'slag', 0); d.px(2, 2, 'amber', 2); } });

  // ---------------------------------------------------------------- static base (world frame)
  b.box('plinth', [-38, 0, -13], [30, 2, 13], plinth);
  const bedBottom = (x) => worldY(x, ROLL_Y - 5.5);
  for (const [t, xt] of TYRES) b.box(`pier_${t}`, [xt - 7, 2, -12], [xt + 7, bedBottom(xt) + 0.2, 12], pier);

  const rail = mat('gun', {
    side(d) {
      d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0);
      for (let x = 2; x + 9 < d.w; x += 12) { d.inset(x, 1, 9, d.h - 2, 'sig'); d.px(x + 1, 2, 'sig', 4); }
      for (let x = 0; x < d.w; x += 12) d.bolt(x, 1, 'gun');
    },
    top(d) { d.rect(0, 0, d.w, d.h, 'gun', 3); for (let x = 1; x < d.w; x += 4) { d.px(x, 0, 'gun', 4); d.px(x + 1, 1, 'gun', 0); } },
  });
  for (const [i, x0, x1] of [[1, -30, -23], [3, 21, 26]]) {
    b.box(`rail_n${i}`, [x0, 2.01, -13], [x1, 6.5, -11.5], rail);
    b.box(`rail_s${i}`, [x0, 2.01, 11.5], [x1, 6.5, 13], rail);
  }
  b.box('vent_pipe', [-32.5, 36, 7], [-30.5, 40, 9], pipeMat);
  b.box('vent_cap', [-33, 40, 6.5], [-30, 41, 9.5], flange);

  // feed end: hood, hopper and its port
  b.box('feed_hood#1', [-38, 2, -11.5], [-30, 36, 11.5], feedHood);
  b.box('feed_hood#2', [-38.5, 30, -12], [-29.5, 32, 12], mat('gun', { side(d) { d.hline(0, 0, d.w, 'gun', 4); d.hline(0, 1, d.w, 'gun', 1); for (let x = 2; x < d.w; x += 4) { d.px(x, 1, 'cu', 3); d.px(x + 2, 0, 'gun', 0); } } }));
  const capMat = mat('gun', { side(d) { d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 3; x < d.w - 1; x += 6) d.px(x, 1, 'cu', 3); }, top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); for (let x = 3; x < d.w - 2; x += 5) d.px(x, 2, 'gun', 4); capStripes(d); } });
  b.box('feed_hood#3', [-38.6, 34.5, -12.1], [-29.4, 36.2, 12.1], capMat);
  b.box('door_handle', [-39, 12, -3], [-38, 13, 3], handle);
  b.box('feed_spout', [-31, AX[1] - 2, -2], [-27, AX[1] + 2, 2], pipeMat);
  b.box('hopper_neck', [-35, 36, -4], [-29, 39, 4], hopperNeck);
  b.box('hopper_mid', [-37, 39, -6.5], [-27, 42, 6.5], hopperNeck);
  b.box('hopper_bin', [-38.5, 42, -8], [-25.5, 46, 8], hopperBin);
  b.box('port_in', [-37, 46, -5], [-27, 48, 5], portIn);

  // discharge end: firing hood on legs, flue, chute, molten stream, ingot crate with the output port
  b.box('fire_hood#1', [26, 10.5, -12], [34, 34, 12], fireHood);
  b.box('fire_hood#2', [25.6, 32.6, -12.4], [34.4, 34.1, 12.4], capMat);
  b.box('fire_hood#3', [25.6, 10.4, -12.4], [34.4, 12, 12.4], capMat);
  b.box('hood_leg_n', [26, 2, -12], [29, 10.5, -8], hoodLeg);
  b.box('hood_leg_s', [26, 2, 8], [29, 10.5, 12], hoodLeg);
  b.box('flue', [28, 34, -6], [32, 41, -2], flue);
  b.box('flue_cap', [27.5, 41, -6.5], [32.5, 42.5, -1.5], flueCap);
  b.box('lamp', [31, 34, 8], [33, 36, 10], lamp);
  // the discharge chute folds up against the hood for transport; the stream only runs while pouring
  for (const [n, z0] of [['n', -3.5], ['s', 2]]) b.box(`chute_hinge_${n}`, [33.99, 13.5, z0], [35.5, 16.5, z0 + 1.5], hoodLeg);
  b.group('chute', [34, 15.5, 0], () => {
    b.box('chute', [34, 13, -2.5], [37.5, 15.5, 2.5], chute);
    b.box('chute#2', [36.5, 12, -2.5], [37.5, 13, 2.5], mat('cu'));
    b.group('stream', [36, 12, 0], () => b.box('stream', [35.5, 8.5, -1], [36.5, 12, 1], stream));
  });
  b.box('crate_base', [30, 2, -7], [39, 4, 7], crateWall);
  b.box('crate_n', [30, 4, -7], [39, 9, -6], crateWall);
  b.box('crate_s', [30, 4, 6], [39, 9, 7], crateWall);
  b.box('crate_w', [30, 4, -6], [31, 9, 6], crateWall);
  b.box('melt', [31, 4, -6], [39, 8.5, 6], melt);
  b.box('port_out', [39, 2, -6], [40, 14, 6], portOut);
  b.box('gauge', [30, 26, 12], [33, 29, 13], gauge);

  // ---------------------------------------------------------------- drive: shaft port, reduction gearbox, pinion stand
  const gearCase = mat('gun', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      for (let x = 2; x < d.w - 1; x += 3) d.vline(x, 2, d.h - 4, 'gun', 1);
      d.hline(1, d.h - 2, d.w - 2, 'gun', 0); d.bolt(1, 1, 'gun'); d.bolt(d.w - 3, 1, 'gun');
    },
    south(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      d.plate(1, 2, d.w - 2, d.h - 8, 'sig'); d.rings(2, 3, d.w - 4, d.h - 10, [['sig', 1], ['sig', 3]]);
      d.rect(3, d.h - 5, 3, 3, 'cu', 3); d.px(4, d.h - 4, 'amber', 3); d.px(3, d.h - 5, 'cu', 4);
      for (let x = 7; x < d.w - 1; x += 3) d.bolt(x, d.h - 4, 'gun');
    },
    west(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      d.radial((r, a) => (r < 2.6 ? ['gun', 0] : r < 3.6 ? ['cu', a < 180 ? 4 : 2] : r < 4.6 && near(a, 45) < 8 ? ['cu', 3] : null), { cx: d.w - 1 - 4.5, cy: d.h - 1 - 7.5 });
      d.plate(2, 2, d.w - 4, 5, 'sig'); d.hline(3, 4, d.w - 6, 'gun', 0);
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); d.rivets(2, 2, d.w - 4, 'gun', { step: 3 }); d.rivets(2, d.h - 3, d.w - 4, 'gun', { step: 3 }); },
  });
  const portPower = mat('gun', {
    west(d) {
      d.rings(0, 0, d.w, d.h, [['cu', 3], ['gun', 0]]);
      d.radial((r, a) => (r < 1.7 ? ['gun', 0] : r < 2.7 ? ['gun', 2] : near(a, 90, 45) < 12 ? ['cu', 4] : null));
    },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) d.px(0, y, 'gun', 0); },
  });
  const shaftMat = mat('gun', {
    top(d) { d.fill((x, y) => ['gun', y === 1 ? 4 : x % 2 ? 2 : 1]); d.px(0, 0, 'cu', 4); },
    side(d) { d.radial((r, a) => (r < 0.6 ? ['gun', 0] : near(a, 90) < 15 ? ['cu', 4] : ['gun', 2])); },
  }, { clean: true });
  b.box('port_power', [-40, 4, 12], [-39, 12, 20], portPower);
  b.group('shaft_in', [-39, 8, 16], () => {
    b.prism('shaft_in', [-38, 8, 16], 1.5, 2, 'x', shaftMat, 8);
    b.box('shaft_in#9', [-37.6, 6, 15.6], [-37.1, 10, 16.4], coupling);
  });
  b.box('gearbox', [-37, 0, 12], [-30, 20, 23], gearCase);
  b.box('gearbox#2', [-36.5, 20, 12.5], [-30.5, 21, 22.5], capMat);
  b.box('gearbox_breather', [-34, 21, 15], [-33, 23, 16], handle);
  b.box('pinion_stand', [-23, 0, 14], [-19, worldY(-21, PIN[1] - 2.5) + 0.3, 20.5], pier);

  // ---------------------------------------------------------------- fire trough under the drum
  // a long firebrick trough runs under the whole drum between the roller beds; a row of flames licks the
  // shell from below, which is how an indirect-fired kiln is heated
  const curb = mat('brickish', {
    all(d) { d.courses(0, 0, d.w, d.h, 'brickish', 3, 6); d.hline(0, 0, d.w, 'brickish', 4); for (let x = 0; x < d.w; x++) if (hsh(x, 0, d.seed) < 0.25) d.px(x, 0, 'slag', 2); },
    up(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 6 === 5 ? 0 : 2]); },
  });
  const grate = mat('slag', {
    up(d) {
      d.fill((x, y) => { const h = hsh(x >> 1, y >> 1, d.seed); return x % 4 === 3 ? ['gun', 0] : h < 0.35 ? ['amber', h < 0.12 ? 4 : 3] : h < 0.6 ? ['amber', 1] : ['slag', 2]; });
    },
    side(d) { d.fill((x) => ['gun', x % 3 ? 1 : 3]); },
  }, { clean: true });
  b.box('firebed#1', [-22, 2.01, -5.5], [22, 3.6, 5.5], grate);
  b.box('firebed#2', [-22, 2.01, -6.5], [22, 4.5, -5.5], curb);
  b.box('firebed#3', [-22, 2.01, 5.5], [22, 3.9, 6.5], curb);
  b.box('firebed#4', [-22.5, 2.01, -6.5], [-22, 5, 6.5], curb);
  b.box('firebed#5', [22, 2.01, -6.5], [22.5, 5, 6.5], curb);

  // flames: white-hot at the grate, orange tongues, dark red tips just under the shell; grouped in four
  // bones so they flicker out of step
  const flameMat = (i) => mat('amber', { all(d) {
    d.fill((x, y) => {
      const t = (d.h - 1 - y) / Math.max(1, d.h - 1), tongue = hsh(x, (y + i * 3) >> 1, 77 + i) < 0.25 + 0.5 * (1 - t);
      if (t < 0.2) return ['amber', 4]; if (t < 0.45) return ['amber', tongue ? 4 : 3];
      if (t < 0.75) return ['amber', tongue ? 3 : 2]; return ['amber', tongue ? 2 : 1];
    });
  } }, { clean: true });
  const drumBottom = (x) => worldY(x, AX[1] - DRUM_R * Math.cos(Math.PI / 12));
  const FLAME_X = [-21.5, -11.5, -8.5, -5.5, -2.5, 0.5, 3.5, 6.5, 8.8, 18.5];
  const FLAMES = [1, 2, 3, 4].map((g) => [g, FLAME_X.filter((_, k) => k % 4 === g - 1)]);
  for (const [g, xs] of FLAMES) {
    b.group(`flame_${g}`, [0, 3.6, 0], () => {
      xs.forEach((x0, k) => {
        const top = (Math.min(drumBottom(x0), drumBottom(x0 + 2.4)) - 0.7 - 3.6) / 1.08 + 3.6;
        const under = x0 > -19 && x0 < -12 || x0 > 11 && x0 < 17;
        const h = (under ? 9.5 : top) - 3.6 - (k % 2) * 0.8;
        b.box(`flame_${g}#${k + 1}`, [x0, 3.6, -5 + (k % 2)], [x0 + 2.4, 3.6 + h, 5 - (k % 2)], flameMat(g * 3 + k));
      });
    });
  }

  const coalBin = mat('sig', {
    side(d) {
      d.rect(0, 0, 1, d.h, 'gun', 2); d.rect(d.w - 1, 0, 1, d.h, 'gun', 1); d.hline(0, d.h - 1, d.w, 'gun', 0);
      d.rings(2, 1, d.w - 4, d.h - 3, [['sig', 1], ['sig', 3]]); d.hline(0, 0, d.w, 'gun', 4);
    },
    up(d) { d.rect(0, 0, d.w, d.h, 'slag', 0); d.fill((x, y) => ['slag', [0, 1, 2, 3, 1, 0][Math.floor(hsh(x >> 1, y >> 1, 9) * 6)]]); },
    down(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); },
  });
  const portFuel = mat('gun', {
    south(d) { d.rings(0, 0, d.w, d.h, [['cu', 3], ['gun', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'slag', 0); for (const [x, y] of [[3, 3], [5, 4], [4, 5]]) d.px(x, y, 'slag', 3); },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); },
  });
  const troughMat = mat('gun', {
    side(d) { d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 2; x < d.w; x += 4) d.bolt(x, Math.min(1, d.h - 1), 'gun'); },
    top(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : 1]); },
    up(d) { d.fill((x, y) => ['slag', hsh(x, y, 4) < 0.3 ? 2 : 0]); },
  });
  // coal intake: an open throat at the back (fuel port on its north face); coal slides down an inclined
  // chute by gravity and drops over the curb onto the grate
  const SLOPE = 13.6, mid = [0, 7, -14.75], tilt = { origin: mid, rotation: [SLOPE, 0, 0] };
  b.box('trough#4', [-4, 9.5, -23], [4, 12.5, -18], coalBin);
  b.box('port_fuel', [-4, 4, -24], [4, 12, -23], portFuel);
  b.box('trough#1', [-2.5, 6.5, -23.25], [2.5, 7.5, -6.25], troughMat, tilt);
  b.box('trough#2', [-2.5, 7.5, -23.25], [-1.8, 9.5, -6.25], troughMat, tilt);
  b.box('trough#3', [1.8, 7.5, -23.25], [2.5, 9.5, -6.25], troughMat, tilt);
  b.box('trough_leg_n', [-1.5, 0, -22], [1.5, 8.1, -20.5], hoodLeg);
  b.box('trough_leg_s', [-1.5, 2, -12], [1.5, 5.7, -10.5], hoodLeg);

  // ---------------------------------------------------------------- tilted drive and drum
  b.group('kiln', AX, () => {
    for (const [t, xt] of TYRES) {
      for (const [s, sz] of [['n', -ROLL_Z], ['s', ROLL_Z]]) {
        b.box(`bed_${t}${s}`, [xt - 8, ROLL_Y - 5.5, sz - 3], [xt + 8, ROLL_Y - 3.5, sz + 3], bed);
        for (const dx of [-1, 1]) b.box(`bearing_${t}${s}${dx > 0 ? 'e' : 'w'}`, [xt + dx * 5 - (dx > 0 ? 0 : 3), ROLL_Y - 3.5, sz - 2.5], [xt + dx * 5 + (dx > 0 ? 3 : 0), ROLL_Y + 2.5, sz + 2.5], bearing);
        b.group(`roller_${t}${s}`, [xt + 5, ROLL_Y, sz], () => {
          b.prism(`roller_${t}${s}`, [xt, ROLL_Y, sz], ROLLER_R, 7, 'x', roller, 8, { mats: [rollerB] });
          b.box(`roller_${t}${s}#5`, [xt - 5, ROLL_Y - 1, sz - 1], [xt + 5, ROLL_Y + 1, sz + 1], axle);
        });
      }
    }

    const [px, py, pz] = PIN;
    b.box('pinion_block', [-23, py - 2.5, pz - 2.5], [-19, py + 2.5, pz + 2.5], bearing);
    b.group('pinion', [-23, py, pz], () => {
      b.prism('pinion', [px, py, pz], PINION_R - 1, 3, 'x', pinionBody, 8);
      teeth(b, 'pinion', [px, py, pz], 'x', PINION_R + 1, 4, 2.5, 2, pinionTooth, { start: 5, phase: 7.5 });
      b.box('pinion#9', [-30, py - 1, pz - 1], [px - 1.5, py + 1, pz + 1], axle);
      b.box('pinion#10', [-29.5, py - 2, pz - 2], [-27.5, py + 2, pz + 2], coupling);
      b.box('pinion#11', [px + 1.5, py - 1, pz - 1], [-23, py + 1, pz + 1], axle);
    });

    // the drum: shell, two riding tyres, girth gear, manway hatches
    b.group('drum', [-29, AX[1], 0], () => {
      b.prism('shell', [-2, AX[1], 0], DRUM_R, 56, 'x', shellMats[0], 12, { mats: shellMats });
      for (const [t, xt] of TYRES) b.prism(`tyre_${t}`, [xt, AX[1], 0], TYRE_R, 5, 'x', tyreMats[0], 12, { mats: tyreMats });
      b.prism('ring_gear', [GEAR_X, AX[1], 0], GEAR_R - 1, 3, 'x', gearBody, 12);
      teeth(b, 'ring_gear', [GEAR_X, AX[1], 0], 'x', GEAR_R + 1, 12, 2.5, 2, tooth, { start: 7 });
      for (const [i, x0, ang] of [[1, -10, 0], [2, 3, 150], [3, 0, 270]]) {
        const top = AX[1] + DRUM_R;
        b.box(`hatch_${i}`, [x0, top - 0.5, -2.5], [x0 + 7, top + 1, 2.5], hatch, { origin: [x0 + 3.5, AX[1], 0], rotation: [ang, 0, 0] });
        b.box(`hatch_${i}_grip`, [x0 + 2.5, top + 1, -1], [x0 + 4.5, top + 2, 1], handle, { origin: [x0 + 3.5, AX[1], 0], rotation: [ang, 0, 0] });
      }
    });
  }, [0, 0, TILT]);

  const L = 8, turn = (k) => ({ rotation: range(4 * L + 1).map((q) => [q / 4, [k * 90 * q / L, 0, 0]]) });
  const drive = (fn) => ({
    drum: fn(1), pinion: fn(-GEAR_R / PINION_R), shaft_in: fn(6),
    ...Object.fromEntries(TYRES.flatMap(([t]) => ['n', 's'].map((s) => [`roller_${t}${s}`, fn(-TYRE_R / ROLLER_R)]))),
  });
  const flicker = (i) => ({ scale: range(17).map((q) => {
    const t = q * L / 16, h = q === 16 ? 0 : hsh(q, i, 31);
    return [t, q === 0 || q === 16 ? [1, 1, 1] : [1, 0.8 + 0.27 * h, 0.9 + 0.12 * hsh(q, i, 5)]];
  }) });
  b.anim('working', L, { ...drive(turn), ...Object.fromEntries(FLAMES.map(([i]) => [`flame_${i}`, flicker(i)])) });

  // packaged: chute folded up, no stream, fire out, drum parked a quarter turn back; deploy lowers the
  // chute, lights the grate, rolls the drum home, then the metal starts to pour
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const D = 5, PARK = -90, CHUTE = 90, OFF = [1, 0.05, 1];
  const axisOf = { chute: 2 };
  const rot = (n, deg) => { const r = [0, 0, 0]; r[axisOf[n] ?? 0] = deg; return r; };
  const hold = (n) => (deg) => ({ rotation: [[0, rot(n, deg)]] });
  const move = (n, from, t0, t1) => ({ rotation: range(21).map((q) => { const t = t0 + (t1 - t0) * q / 20; return [+t.toFixed(3), rot(n, from * (1 - ease(q / 20)))]; }).concat(t0 > 0 ? [[0, rot(n, from)]] : []).concat(t1 < D ? [[D, rot(n, 0)]] : []).sort((a, b) => a[0] - b[0]) });
  const fire = (on) => Object.fromEntries(FLAMES.map(([i]) => [`flame_${i}`, on]));
  b.anim('packaged', 0.5, { chute: hold('chute')(CHUTE), stream: { scale: [[0, OFF]] }, ...fire({ scale: [[0, OFF]] }), ...drive((k) => hold('drum')(k * PARK)) });
  b.anims[b.anims.length - 1].loop = 'hold';
  b.anim('deploy', D, {
    chute: move('chute', CHUTE, 0, 1.8), stream: { scale: [[0, OFF], [4.8, OFF], [5, [1, 1, 1]]] },
    ...Object.fromEntries(FLAMES.map(([i]) => [`flame_${i}`, { scale: [[0, OFF], [1.8 + 0.15 * i, OFF], [2.6 + 0.15 * i, [1, 1, 1]], [D, [1, 1, 1]]] }])),
    ...drive((k) => move('drum', k * PARK, 2.4, 4.8)),
  });
  b.anims[b.anims.length - 1].loop = 'hold';
}
