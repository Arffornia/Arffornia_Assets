// Smelter Mk3, tier 8 (particles era): the Mk1 rotary kiln chassis with a plasma power module. Ore drops
// from the hopper into the high (west) end of the drum; the middle of the drum is a contained plasma section,
// a cage of graphite bars between two orange ceramic containment rings round a violet-white core that turns
// against the drum. The motor still drives the drum through a pinion and the ring gear. Violet-white metal
// leaves the low (east) end and pours into the ingot crate. Field emitter pylons stand on both hoods, fed by
// a violet energy conduit along the south side.
import { addRamp, hsh } from '../pix.mjs';
import { pipe, teeth } from '../parts.mjs';

// polished graphite: few streaks, no grime; ceramic: almost no grain, no chips
addRamp('gph', ['#181514', '#292423', '#3b3533', '#564e4b', '#837873'], { clusters: 0.02, streaks: 0.03 });
addRamp('cer', ['#5a1f0b', '#b0441a', '#e36826', '#f88c3e', '#ffc581'], { clusters: 0.012 });
addRamp('trm', ['#25252a', '#43444b', '#65666e', '#8b8c94', '#b9bac0']);
addRamp('vio', ['#1a0833', '#40157f', '#7a2ee0', '#a866ff', '#e4cfff'], null, { glow: true });
addRamp('pls', ['#260a52', '#5518b8', '#8a3cf5', '#c895ff', '#fdf8ff'], null, { glow: true });
addRamp('vd', ['#08080c', '#121219', '#1c1c26', '#292937', '#3c3c50']);

const TILT = -3, AX = [0, 22, 0];
const sa = Math.sin(TILT * Math.PI / 180), ca = Math.cos(TILT * Math.PI / 180);
const worldY = (x, y) => AX[1] + x * sa + (y - AX[1]) * ca;

const DRUM_R = 10, TYRE_R = 12, ROLLER_R = 4, GEAR_R = 15, PINION_R = 5;
const RING_R = 12, CORE_R = 7, WIN = [-9.5, 7.5];
const GEAR_X = -25, TYRES = [['w', -16], ['e', 14]];
const PIN = [GEAR_X, AX[1] - (GEAR_R + PINION_R) * Math.sin(Math.PI / 6), (GEAR_R + PINION_R) * Math.cos(Math.PI / 6)];
const RA = 35 * Math.PI / 180, RC = TYRE_R + ROLLER_R;
const ROLL_Y = AX[1] - RC * Math.cos(RA), ROLL_Z = RC * Math.sin(RA);

export const meta = {
  title: 'Smelter Mk3 (plasma kiln)', note: 'Ore to ingots in a turning kiln round a contained plasma core. Tier 8.', footprint: [5, 3], height: 3, tier: 8,
  ports: [{ id: 'in', kind: 'item', face: 'up', cell: [0, 1] }, { id: 'out', kind: 'item', face: 'east', cell: [1, 0] }],
  joints: {
    pylon_w: { type: 'revolute', axis: 'x' }, pylon_e: { type: 'revolute', axis: 'x' },
    drum: { type: 'revolute', axis: 'x' }, plasma: { type: 'revolute', axis: 'x' }, pinion: { type: 'revolute', axis: 'x' },
    roller_wn: { type: 'revolute', axis: 'x' }, roller_ws: { type: 'revolute', axis: 'x' },
    roller_en: { type: 'revolute', axis: 'x' }, roller_es: { type: 'revolute', axis: 'x' },
  },
  gears: [
    { a: 'ring_gear', b: 'pinion', ra: GEAR_R, rb: PINION_R },
    ...TYRES.flatMap(([t]) => ['n', 's'].map((s) => ({ a: `tyre_${t}`, b: `roller_${t}${s}`, ra: TYRE_R, rb: ROLLER_R }))),
  ],
  lint: { allow: [
    { a: 'tyre_*', b: 'shell_*', check: 'overlap', why: 'riding tyres are shrunk onto the shell' },
    { a: 'ring_gear#*', b: 'shell_*', check: 'overlap', why: 'the girth gear is bolted round the shell' },
    { a: 'pylon_*#1', b: 'pylon_*_hinge', check: 'overlap', why: 'the pylon foot turns round the hinge pin inside its knuckle' },
    { a: 'feed_spout', b: 'shell_*', check: 'overlap', why: 'the stationary feed spout enters the drum along its axis' },
  ] },
};
export const look = { glow: 1.3 };

const range = (n) => [...Array(n).keys()];
const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

// smooth bevelled panel: lit top and left edge, shaded bottom and right, a soft vertical light map inside
function bevel(d, x, y, w, h, ramp, o = {}) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let k = j < h * 0.35 ? 3 : 2;
    if (j === 0) k = 4; else if (i === 0) k = 3; else if (j === h - 1) k = 1; else if (i === w - 1) k = 1;
    if (o.seam && (i === w - 1 && j === h - 1)) k = 0;
    d.px(x + i, y + j, ramp, k);
  }
}

export function build(b, { mat }) {
  // ---------------------------------------------------------------- materials
  // plinth: polished deck panels with flush seams and violet guide lights, graphite skirt with ceramic tabs
  const plinth = mat('gph', {
    side(d) {
      d.fill((x, y) => ['gph', y === 0 ? 4 : x % 12 === 11 ? 0 : 1]);
      for (let x = 4; x < d.w; x += 12) d.rect(x, 1, 4, 1, x % 24 === 4 ? 'cer' : 'gph', 3);
      for (let x = 10; x < d.w; x += 24) d.px(x, 1, 'trm', 4);
    },
    top(d) {
      d.courses(0, 0, d.w, d.h, 'gph', 13, 17);
      d.rings(0, 0, d.w, d.h, [['gph', 0], ['gph', 4]]);
      for (let x = 6; x < d.w - 4; x += 17) { d.px(x, 2, 'vio', 3); d.px(x, d.h - 3, 'vio', 2); }
      for (let x = 3; x < d.w - 3; x += 9) d.px(x, Math.floor(d.h / 2), 'trm', 3);
    },
  });
  // piers: graphite frame round a bevelled ceramic web with a glowing field slot
  const pier = mat('gph', {
    side(d) {
      d.rings(1, 2, d.w - 2, d.h - 3, [['gph', 0], ['gph', 4], ['gph', 1]]);
      bevel(d, 3, 4, d.w - 6, Math.max(2, d.h - 8), 'cer');
      d.rect(5, d.h - 6, d.w - 10, 1, 'gph', 0); d.rect(6, d.h - 6, d.w - 12, 1, 'vio', 3);
      d.hline(4, 6, d.w - 8, 'cer', 4);
      d.px(2, 1, 'trm', 4); d.px(d.w - 3, 1, 'trm', 4);
      d.hline(1, d.h - 1, d.w - 2, 'gph', 0);
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gph'); d.hline(2, Math.floor(d.h / 2), d.w - 4, 'gph', 4); d.px(2, 2, 'vio', 3); d.px(d.w - 3, d.h - 3, 'vio', 3); },
  });
  const bed = mat('gph', {
    side(d) { d.hline(0, 0, d.w, 'gph', 4); d.hline(0, d.h - 1, d.w, 'gph', 0); for (let x = 3; x < d.w - 1; x += 6) d.px(x, 0, 'trm', 4); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gph'); d.hline(2, Math.floor(d.h / 2), d.w - 4, 'cer', 3); d.px(1, 1, 'trm', 3); d.px(d.w - 2, d.h - 2, 'trm', 4); },
  });
  const bearing = mat('gph', {
    side(d) { d.plate(0, 0, d.w, d.h, 'gph'); d.px(Math.floor(d.w / 2), 1, 'trm', 4); d.hline(1, Math.floor(d.h / 2), d.w - 2, 'gph', 0); d.px(1, d.h - 2, 'cer', 3); },
    top(d) { d.plate(0, 0, d.w, d.h, 'gph'); d.px(1, 1, 'trm', 4); d.vline(Math.floor(d.w / 2), 1, d.h - 2, 'gph', 0); },
    east(d) { d.plate(0, 0, d.w, d.h, 'gph'); d.rect(1, 1, d.w - 2, d.h - 2, 'cer', 2); d.px(1, 1, 'cer', 4); d.px(d.w - 2, d.h - 2, 'cer', 1); },
    west(d) { d.plate(0, 0, d.w, d.h, 'gph'); d.rect(1, 1, d.w - 2, d.h - 2, 'cer', 2); d.px(1, 1, 'cer', 4); d.px(d.w - 2, d.h - 2, 'gph', 0); },
  });

  // Ceramic drum sections (u along the drum, v across one 5 texel facet): long bevelled tiles, one flush seam
  // per section, graphite end bands, and on some facets a violet conduit held by graphite clamps.
  const shellFace = (variant) => (d) => {
    const seam = Math.floor(d.w / 2) + (variant === 'node' ? 2 : 0);
    d.fill((x, y) => {
      const t = x < seam ? x : x - seam - 1, len = x < seam ? seam : d.w - seam - 1;
      if (x === seam) return ['cer', 0];
      if (t === 0) return ['cer', 4];
      if (t === len - 1) return ['cer', 1];
      return ['cer', y === 0 ? 4 : y === d.h - 1 ? 1 : y === 1 && hsh(x >> 2, 0, d.seed) < 0.5 ? 3 : 2];
    });
    d.rect(0, 0, 2, d.h, 'gph', 2); d.vline(0, 0, d.h, 'gph', 4);
    d.rect(d.w - 2, 0, 2, d.h, 'gph', 1);
    if (variant === 'conduit') {
      d.hline(2, 2, d.w - 4, 'gph', 0); d.hline(3, 2, d.w - 6, 'vio', 2);
      for (let x = 4; x < d.w - 3; x += 5) d.px(x, 2, 'vio', 4);
      for (let x = 6; x < d.w - 3; x += 9) d.rect(x, 1, 2, 3, 'gph', 3);
    }
    if (variant === 'node') { d.rect(seam + 3, 1, 3, 3, 'gph', 1); d.px(seam + 4, 2, 'vio', 4); d.px(seam + 3, 1, 'trm', 4); }
    if (variant === 'plain') for (let x = 4; x < d.w - 3; x += 6) d.px(x, 2, 'cer', 3);
  };
  const shellCap = (d) => d.radial((r, a) => (r > DRUM_R - 0.8 ? ['gph', 3] : r > DRUM_R - 3 ? ['cer', near(a, 30) < 3 ? 1 : 2] : r > 3 ? ['gph', near(a, 60) < 6 ? 3 : 1] : ['vio', r < 1.5 ? 4 : 2]));
  const shellMat = (v) => mat('cer', { top: shellFace(v), side: shellCap }, { clean: true });
  const shellMats = ['plain', 'conduit', 'node', 'plain', 'conduit', 'plain'].map(shellMat);

  // containment rings: bevelled ceramic tread with graphite pins, caps carry a violet emitter ring round the core
  const ringFace = (k) => (d) => {
    d.fill((x, y) => ['cer', x === 0 ? 4 : x === d.w - 1 ? 1 : y === 0 ? 4 : y === d.h - 1 ? 1 : 3 - (x & 1)]);
    d.px(1, 2 + (k % 3), 'gph', 0); d.px(1, 1 + (k % 3), 'trm', 4);
  };
  const ringCap = (d) => d.radial((r, a) => {
    if (r > RING_R - 0.7) return ['cer', a < 180 ? 4 : 3];
    if (r > RING_R - 1.4) return ['cer', 1];
    if (r > RING_R - 3.2) return ['cer', near(a, 30) < 2 ? 1 : a < 180 ? 3 : 2];
    if (r > RING_R - 3.9) return ['gph', 0];
    if (r > CORE_R + 1.8) return ['gph', near(a, 30) < 4 ? 4 : 2];
    if (r > CORE_R + 0.6) return ['vio', near(a, 30) < 5 ? 4 : 3];
    return ['gph', 0];
  });
  const ringMats = range(6).map((k) => mat('cer', { top: ringFace(k), side: ringCap }, { clean: true }));

  // cage bars: polished graphite with a lit chamfer and a violet inner edge facing the plasma
  const bar = mat('gph', {
    up(d) { d.fill((x, y) => ['gph', y === 0 ? 4 : y === d.h - 1 ? 1 : x % 6 === 0 ? 1 : 3]); for (let x = 3; x < d.w; x += 6) d.px(x, 1, 'trm', 4); },
    down(d) { d.fill((x, y) => ['vio', x % 4 === 0 ? 4 : y === 1 ? 3 : 1]); },
    side(d) { d.fill((x, y) => ['gph', y === 0 ? 4 : y === d.h - 1 ? 0 : x % 6 === 0 ? 1 : 2]); d.hline(0, d.h - 1, d.w, 'vio', 2); },
  }, { clean: true });

  // plasma core: violet-white bands that spiral; facets alternate bright and dim so the turn reads as a pulse
  const core = (k) => mat('pls', { all(d) {
    const bright = k % 2 === 0, c = (d.h - 1) / 2;
    d.fill((x, y) => {
      const s = (x + y * 3 + k * 4) % 8, e = Math.abs(y - c) / Math.max(1, c);
      if (e < 0.4 && (bright || s < 4)) return ['pls', s === 0 ? 3 : 4];
      if (s === 0) return ['pls', 3];
      if (e > 0.8) return ['pls', bright ? 1 : 0];
      return ['pls', bright ? 2 : s < 4 ? 2 : 1];
    });
  } }, { clean: true });
  const coreMats = range(6).map(core);

  // riding tyre: polished graphite tread, cap with a ceramic band and trim bolts
  const tyre = (k) => mat('gph', {
    top(d) { d.fill((x, y) => ['gph', [0, 4, 3, 2, 1][Math.min(4, x)] ?? 1]); d.px(2, k % 3, 'trm', 4); },
    side(d) {
      d.radial((r, a) => {
        if (r > TYRE_R - 0.6) return ['gph', a < 180 ? 4 : 3];
        if (r > TYRE_R - 1.2) return ['gph', 0];
        if (Math.abs(r - (TYRE_R - 1.7)) < 0.6 && near(a, 30) < 6) return ['trm', a < 180 ? 4 : 3];
        if (r > DRUM_R - 0.5) return ['cer', a < 180 ? 3 : 2];
        if (r > DRUM_R - 2.5) return ['cer', near(a, 30) < 3 ? 1 : 2];
        return ['gph', near(a, 30) < 4 ? 0 : (r | 0) % 3 === 0 ? 3 : 1];
      });
    },
  }, { clean: true });
  const tyreMats = range(6).map(tyre);

  const gearBody = mat('gph', {
    top(d) { d.fill((x, y) => ['gph', x === 0 ? 4 : x === d.w - 1 ? 0 : y % 4 === 0 ? 1 : 2]); },
    side(d) {
      d.radial((r, a) => {
        if (r > GEAR_R - 1.6) return ['gph', a < 180 ? 4 : 3];
        if (r > GEAR_R - 2.4) return ['gph', 0];
        if (Math.abs(r - 11.4) < 1 && near(a, 30, 15) < 7) return ['gph', 0];
        if (Math.abs(r - 11.4) < 1.4 && near(a, 30, 15) < 10) return ['cer', 2];
        if (Math.abs(r - 10.4) < 0.5 && near(a, 15) < 3) return ['vio', 3];
        if (r > DRUM_R - 0.2) return ['cer', a < 180 ? 3 : 2];
        return ['gph', near(a, 30) < 3 ? 3 : (r | 0) % 4 === 0 ? 0 : 1];
      });
    },
  });
  const toothMat = (ramp) => mat(ramp, { all(d) {
    d.fill((x, y) => {
      const L = Math.max(d.w, d.h), t = d.h >= d.w ? y : x, e = Math.min(t, L - 1 - t), across = d.h >= d.w ? x : y;
      if (e < 1) return [ramp, 4]; if (e < 2) return [ramp, across === 0 ? 4 : 3]; if (e < 3) return ['gph', 0];
      return [ramp, t % 4 === 0 ? 0 : t % 4 === 2 ? 4 : 2];
    });
  } }, { clean: true });
  const tooth = toothMat('gph'), pinionTooth = toothMat('cer');

  // sensor pods on the drum: graphite housing, ceramic lid, a violet lens
  const pod = mat('gph', {
    top(d) { d.plate(0, 0, d.w, d.h, 'gph'); bevel(d, 1, 1, d.w - 2, d.h - 2, 'cer'); d.rect(Math.floor(d.w / 2) - 1, 1, 2, d.h - 2, 'gph', 0); d.px(Math.floor(d.w / 2), 2, 'vio', 4); d.px(Math.floor(d.w / 2) - 1, d.h - 3, 'vio', 2); },
    side(d) { d.rect(0, 0, d.w, d.h, 'gph', 1); d.hline(0, 0, d.w, 'gph', 4); d.px(1, 0, 'trm', 4); },
  }, { clean: true });
  const lens = mat('vio', { all(d) { d.rect(0, 0, d.w, d.h, 'vio', 3); d.px(0, 0, 'vio', 4); } }, { clean: true });

  const rollerTread = (d) => d.fill((x, y) => ['gph', [1, 3, 4, 3, 2, 3, 0][Math.min(6, x)] - (y === 2 && x % 3 === 1 ? 1 : 0)]);
  const rollerCap = (d) => d.radial((r, a) => (r > ROLLER_R - 0.7 ? ['gph', 3] : r > ROLLER_R - 1.3 ? ['gph', 0] : r < 0.8 ? ['gph', 0] : near(a, 90, 45) < 18 ? ['cer', 3] : ['cer', 1]));
  const roller = mat('gph', { top: rollerTread, side: rollerCap }, { clean: true });
  const rollerB = mat('gph', { top(d) { rollerTread(d); d.px(3, 1, 'trm', 4); }, side: rollerCap }, { clean: true });
  const axle = mat('trm', { all(d) { d.fill((x, y) => ['trm', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); } }, { clean: true });

  const pinionBody = mat('gph', {
    top(d) { d.fill((x) => ['trm', x === 0 ? 4 : x === d.w - 1 ? 1 : 3]); d.px(1, 1, 'gph', 0); },
    side(d) { d.radial((r, a) => (r < 1.2 ? ['vio', 3] : r < 2.2 ? ['trm', 4] : near(a, 45) < 10 ? ['gph', 1] : r > 3.3 ? ['trm', 3] : ['trm', 2])); },
  });
  const coupling = mat('gph', { side(d) { d.fill((x, y) => ['gph', x % 2 ? 1 : 3]); d.hline(0, 0, d.w, 'trm', 4); d.px(1, d.h - 1, 'gph', 0); } });

  // drive motor: graphite can with flush cooling slots and a violet status ring, ceramic end bell
  const motorFins = mat('gph', {
    top(d) { d.fill((x, y) => ['gph', [4, 2, 2, 0, 3][y % 5]]); d.vline(1, 0, d.h, 'cer', 2); d.vline(d.w - 2, 0, d.h, 'vio', 2); },
    side(d) { d.radial((r, a) => (r > 4.6 ? ['gph', 3] : r > 3.8 ? ['gph', 0] : r > 2 ? (near(a, 60) < 12 ? ['cer', 3] : ['cer', 1]) : r > 1 ? ['vio', 3] : ['gph', 0])); },
  });
  const bell = mat('cer', {
    west(d) { bevel(d, 0, 0, d.w, d.h, 'cer'); d.vent(2, 2, d.w - 4, d.h - 4, 'gph'); },
    side(d) { d.hline(0, 0, d.w, 'cer', 4); d.px(1, d.h - 1, 'gph', 0); },
  }, { clean: true });
  const termBox = mat('cer', {
    side(d) { bevel(d, 0, 0, d.w, d.h, 'cer'); d.px(1, 1, 'vio', 3); d.px(d.w - 2, 1, 'trm', 4); },
    top(d) { bevel(d, 0, 0, d.w, d.h, 'cer'); d.px(1, 1, 'gph', 0); d.px(2, 2, 'trm', 4); },
  }, { clean: true });

  // feed hood: graphite casing with a bevelled ceramic door carrying the hex mark, a violet sight window
  const feedHood = mat('gph', {
    side(d) { d.hline(0, 0, d.w, 'gph', 4); d.rect(0, d.h - 4, d.w, 4, 'gph', 1); d.hline(0, d.h - 4, d.w, 'gph', 3); d.hline(1, d.h - 2, d.w - 2, 'vio', 2); },
    west(d) {
      bevel(d, 2, 3, d.w - 4, 18, 'cer');
      d.rings(4, 5, d.w - 8, 14, [['cer', 1], ['cer', 4]]);
      d.rect(Math.floor(d.w / 2) - 5, 7, 11, 10, 'gph', 0);
      d.hexMark(Math.floor(d.w / 2) - 4, 8, { rim: ['vio', 3], faces: [['cer', 4], ['cer', 2], ['cer', 1]] });
      d.rect(6, 23, d.w - 12, 2, 'gph', 0); d.hline(7, 23, d.w - 14, 'vio', 2);
      d.vent(4, 26, d.w - 8, 5, 'gph');
    },
    south(d) {
      d.inset(1, 7, d.w - 2, 9, 'gph'); d.rect(2, 9, d.w - 4, 5, 'vio', 2); d.hline(2, 9, d.w - 4, 'vio', 1); d.hline(3, 12, d.w - 6, 'vio', 4);
      bevel(d, 1, 17, d.w - 2, d.h - 22, 'cer'); d.hline(2, 20, d.w - 4, 'cer', 0); d.hline(2, 21, d.w - 4, 'cer', 4);
    },
    north(d) { d.inset(1, 6, d.w - 2, 14, 'gph'); bevel(d, 3, 8, d.w - 6, 10, 'cer'); d.vline(Math.floor(d.w / 2), 8, 10, 'cer', 0); d.brokenRings(1, 21, d.w - 2, d.h - 26, [[0, 'gph', 3], [2, 'gph', 0]]); },
    east(d) {
      d.brokenRings(0, 0, d.w, d.h, [[1, 'gph', 3], [3, 'cer', 2], [5, 'gph', 0]]);
      const cx = (d.w - 1) / 2, cy = d.h - 1 - (AX[1] - 2);
      d.radial((r, a) => (r < DRUM_R + 0.6 ? ['vd', 1] : r < DRUM_R + 2 ? ['vio', a < 180 ? 3 : 2] : r < DRUM_R + 3 && near(a, 30) < 5 ? ['trm', 3] : null), { cx, cy });
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gph'); d.hline(2, Math.floor(d.h / 2), d.w - 4, 'gph', 4); },
  });
  const hoodBand = mat('gph', { side(d) { d.hline(0, 0, d.w, 'gph', 4); d.hline(0, 1, d.w, 'gph', 1); for (let x = 3; x < d.w; x += 6) d.px(x, 1, 'vio', 3); } });
  const hopperNeck = mat('gph', { side(d) { d.fill((x, y) => ['gph', x % 4 === 0 ? 1 : y === 0 ? 4 : 2]); d.hline(0, d.h - 1, d.w, 'gph', 0); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'trm', 3); }, top(d) { d.inset(0, 0, d.w, d.h, 'gph'); d.px(1, 1, 'trm', 4); } });
  const hopperBin = mat('gph', {
    side(d) {
      d.rect(0, 0, 1, d.h, 'gph', 3); d.rect(d.w - 1, 0, 1, d.h, 'gph', 1);
      d.hline(0, d.h - 1, d.w, 'gph', 0);
      bevel(d, 2, 1, d.w - 4, d.h - 2, 'cer');
      d.hline(3, 2, d.w - 6, 'cer', 0);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gph'); d.hline(1, 1, d.w - 2, 'gph', 4); },
    down(d) { d.rect(0, 0, d.w, d.h, 'gph', 1); d.inset(2, 2, d.w - 4, d.h - 4, 'gph'); },
  });
  const portIn = mat('gph', {
    side(d) { d.fill((x, y) => ['trm', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let x = 1; x < d.w; x += 3) d.px(x, 1, 'gph', 0); },
    up(d) {
      d.rect(0, 0, d.w, d.h, 'trm', 3); d.hline(0, 0, d.w, 'trm', 4);
      d.rect(1, 1, d.w - 2, d.h - 2, 'vd', 0);
      for (const [x, y, k] of [[2, 2, 3], [3, 3, 4], [6, 2, 2], [7, 4, 3], [4, 6, 3], [8, 7, 2], [2, 8, 4], [5, 9, 3], [9, 3, 3], [3, 5, 2]]) if (x < d.w - 1 && y < d.h - 1) { d.px(x, y, 'vd', k); d.px(x + 1, y, 'vd', k - 1); }
      d.px(6, 6, 'vio', 2); d.px(3, 9, 'trm', 3);
    },
  }, { clean: true });

  // discharge hood: graphite casing, ceramic door frame, arched mouth glowing violet-white
  const fireHood = mat('gph', {
    side(d) { d.hline(0, 0, d.w, 'gph', 4); },
    east(d) {
      bevel(d, 1, 1, d.w - 2, d.h - 2, 'cer'); d.rings(3, 3, d.w - 6, d.h - 6, [['cer', 1], ['gph', 0]]);
      const cx = (d.w - 1) / 2, top = 6, bot = d.h - 5, hw = 5;
      d.fill((x, y) => {
        if (y < top || y > bot) return null; const dx = Math.abs(x - cx);
        const arch = y < top + hw ? Math.hypot(dx, top + hw - y) : dx;
        if (arch > hw + 1.2) return null; if (arch > hw) return ['gph', y < top + hw ? 0 : 1];
        const t = (y - top) / (bot - top);
        if (t < 0.3) return ['vd', 0];
        if (t < 0.45) return ['vd', 2];
        if (t < 0.55) return ['pls', 0];
        if (t < 0.75) return ['pls', (x + y) % 3 === 0 ? 2 : 1];
        return ['pls', y === bot - 1 ? 4 : 3];
      });
      d.hline(Math.ceil(cx - hw), bot + 1, 2 * hw, 'vio', 3);
      for (const y of [6, 13]) { d.px(2, y, 'trm', 4); d.px(d.w - 3, y, 'trm', 4); }
    },
    south(d) {
      d.rings(1, 2, d.w - 2, 13, [['gph', 0], ['gph', 4], ['gph', 2]]);
      d.inset(2, 4, d.w - 4, 7, 'gph'); d.rect(3, 6, d.w - 6, 3, 'vio', 2); d.hline(3, 7, d.w - 6, 'vio', 4);
      bevel(d, 1, 15, d.w - 2, 6, 'cer');
      d.vent(1, 22, d.w - 2, d.h - 24, 'gph');
    },
    north(d) {
      bevel(d, 1, 2, d.w - 2, d.h - 6, 'cer');
      d.rings(3, 4, d.w - 6, d.h - 10, [['cer', 1], ['gph', 1]]);
      d.inset(5, 6, d.w - 10, d.h - 14, 'gph'); d.vline(Math.floor(d.w / 2), 7, d.h - 16, 'vio', 3);
    },
    west(d) {
      d.rings(0, 0, d.w, d.h, [['gph', 0], ['gph', 3]]);
      d.brokenRings(1, 1, d.w - 2, d.h - 2, [[1, 'gph', 1], [3, 'gph', 3]]);
      const cx = (d.w - 1) / 2, cy = d.h - 1 - (AX[1] - 10.5);
      d.radial((r) => (r < DRUM_R + 0.6 ? ['vd', 0] : r < DRUM_R + 2 ? ['vio', r < DRUM_R + 1.3 ? 3 : 1] : null), { cx, cy });
    },
    up(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gph'); d.hline(2, 3, d.w - 4, 'gph', 4); },
    down(d) { d.rect(0, 0, d.w, d.h, 'gph', 1); },
  });
  const capMat = mat('gph', {
    side(d) { d.hline(0, 0, d.w, 'gph', 4); d.hline(0, d.h - 1, d.w, 'gph', 0); for (let x = 3; x < d.w - 1; x += 8) d.rect(x, 1, 3, 1, 'cer', 3); },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gph'); d.hline(2, 2, d.w - 4, 'gph', 4); d.rect(2, d.h - 3, d.w - 4, 1, 'cer', 2); },
  });
  const hoodLeg = mat('gph', { side(d) { d.fill((x, y) => ['gph', x === 0 ? 4 : x === d.w - 1 ? 0 : y % 5 === 0 ? 1 : 2]); d.px(1, 1, 'trm', 4); }, top(d) { d.inset(0, 0, d.w, d.h, 'gph'); } });
  const chute = mat('gph', {
    up(d) { d.rect(0, 0, d.w, d.h, 'gph', 1); d.rect(0, 1, d.w, d.h - 2, 'pls', 2); d.hline(0, Math.floor(d.h / 2), d.w, 'pls', 4); d.px(1, 2, 'pls', 3); },
    side(d) { d.hline(0, 0, d.w, 'trm', 4); d.hline(0, d.h - 1, d.w, 'gph', 0); d.px(1, 1, 'vio', 2); },
  });
  const stream = mat('pls', { all(d) { d.fill((x, y) => ['pls', x === 0 ? 3 : (y + x) % 4 === 0 ? 4 : 3]); } }, { clean: true });
  const crateWall = mat('gph', {
    side(d) { d.fill((x, y) => ['gph', y === 0 ? 4 : x % 5 === 0 ? 1 : y > d.h - 2 ? 0 : 2]); for (const x of [0, d.w - 1]) d.vline(x, 0, d.h, 'cer', 2); for (let x = 2; x < d.w - 1; x += 5) d.px(x, 1, 'trm', 3); },
    top(d) { d.rect(0, 0, d.w, d.h, 'cer', 3); d.hline(0, 0, d.w, 'cer', 4); d.px(1, d.h - 1, 'cer', 1); },
  }, { clean: true });
  const melt = mat('pls', {
    up(d) {
      d.fill((x, y) => ['pls', (x % 5 === 4 || y % 6 === 5) ? 1 : (x + y * 2) % 7 === 0 ? 4 : 3]);
      for (let x = 4; x < d.w; x += 5) d.vline(x, 0, d.h, 'gph', 1);
    },
  }, { clean: true });
  const portOut = mat('gph', {
    east(d) { d.rings(0, 0, d.w, d.h, [['trm', 3], ['gph', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'vd', 1); d.hline(2, 2, d.w - 4, 'vd', 0); d.px(2, d.h - 3, 'vio', 2); },
    side(d) { d.fill((x, y) => ['trm', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) d.px(0, y, 'gph', 0); },
  });

  // energy conduit: graphite sheath, a violet field line along its crown, ceramic collars as flanges
  const conduitMat = mat('gph', { all(d) {
    const along = d.w >= d.h, A = along ? d.h : d.w;
    d.fill((x, y) => {
      const t = along ? x : y, c = along ? y : x;
      if (A <= 2) return c === 0 ? (t % 6 === 3 ? ['vio', 4] : ['vio', t % 2 ? 2 : 3]) : ['gph', t % 3 === 0 ? 0 : 3];
      if (c === 0) return ['gph', 4];
      if (c === A - 1) return ['gph', 1];
      return t % 6 === 3 ? ['vio', 4] : ['vio', 2];
    });
  } }, { clean: true });
  const collar = mat('cer', { all(d) { d.rect(0, 0, d.w, d.h, 'cer', 2); d.hline(0, 0, d.w, 'cer', 4); d.hline(0, d.h - 1, d.w, 'cer', 1); d.vline(0, 0, d.h, 'cer', 3); for (let i = 1; i < Math.max(d.w, d.h) - 1; i += 3) d.px(d.w > d.h ? i : 0, d.w > d.h ? 0 : i, 'gph', 0); } }, { clean: true });
  const bracket = mat('gph', { side(d) { d.fill((x, y) => ['gph', x === 0 ? 4 : x === d.w - 1 ? 0 : y === 0 ? 4 : y % 3 === 0 ? 1 : 2]); d.px(1, d.h - 2, 'trm', 3); }, top(d) { d.inset(0, 0, d.w, d.h, 'gph'); } }, { clean: true });
  const regulator = mat('gph', {
    side(d) { d.plate(0, 0, d.w, d.h, 'gph'); d.px(1, 1, 'vio', 4); d.px(d.w - 2, 1, 'trm', 4); d.rect(1, d.h - 2, d.w - 2, 1, 'cer', 3); },
    top(d) { d.plate(0, 0, d.w, d.h, 'gph'); d.px(1, 1, 'trm', 4); d.rect(2, 1, d.w - 4, d.h - 2, 'vio', 2); },
  }, { clean: true });
  const capacitor = mat('cer', {
    top(d) { bevel(d, 0, 0, d.w, d.h, 'cer'); d.px(Math.floor(d.w / 2), Math.floor(d.h / 2), 'vio', 4); },
    side(d) { d.fill((x) => ['cer', x % 2 ? 1 : 3]); d.hline(0, 0, d.w, 'cer', 4); },
  }, { clean: true });

  // field emitter pylon: graphite mast with ceramic collar, violet field crystal on top
  const mast = mat('gph', {
    side(d) { d.fill((x, y) => ['gph', x === 0 ? 4 : x === d.w - 1 ? 0 : y % 4 === 0 ? 1 : 2]); d.vline(Math.floor(d.w / 2), 1, d.h - 2, 'vio', 2); d.px(Math.floor(d.w / 2), 2, 'vio', 4); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gph'); },
  }, { clean: true });
  const crystal = mat('vio', { side(d) { d.fill((x, y) => ['vio', x === 0 ? 4 : y === 0 ? 4 : (x + y) % 3 === 0 ? 4 : 3]); }, top(d) { d.rect(0, 0, d.w, d.h, 'pls', 4); } }, { clean: true });
  const lamp = mat('vio', { side(d) { d.rect(0, 0, d.w, d.h, 'vio', 3); d.px(0, 0, 'vio', 4); }, up(d) { d.rect(0, 0, d.w, d.h, 'vio', 4); } }, { flat: true });
  const gauge = mat('gph', { south(d) { d.rect(0, 0, d.w, d.h, 'trm', 3); d.rect(1, 1, d.w - 2, d.h - 2, 'vd', 1); d.px(1, 1, 'vio', 4); d.px(2, 2, 'vio', 2); } });
  const handle = mat('trm', { all(d) { d.rect(0, 0, d.w, d.h, 'trm', 3); d.hline(0, 0, d.w, 'trm', 4); d.px(d.w - 1, d.h - 1, 'trm', 1); } }, { clean: true });
  const termBoxJ = mat('gph', { south(d) { d.plate(0, 0, d.w, d.h, 'gph'); d.px(1, 1, 'vio', 3); d.px(2, 1, 'trm', 4); } });
  const spout = mat('trm', { all(d) { d.fill((x, y) => ['trm', y === 0 ? 4 : y === d.h - 1 ? 1 : x % 4 === 0 ? 1 : 2]); } }, { clean: true });

  // ---------------------------------------------------------------- static base (world frame)
  b.box('plinth', [-38, 0, -13], [30, 2, 13], plinth);
  const bedBottom = (x) => worldY(x, ROLL_Y - 5.5);
  for (const [t, xt] of TYRES) b.box(`pier_${t}`, [xt - 7, 2, -12], [xt + 7, bedBottom(xt) + 0.2, 12], pier);

  const rail = mat('gph', {
    side(d) {
      d.hline(0, 0, d.w, 'gph', 4); d.hline(0, d.h - 1, d.w, 'gph', 0);
      for (let x = 2; x + 9 < d.w; x += 12) { bevel(d, x, 1, 9, d.h - 2, 'cer'); d.px(x + 7, 2, 'vio', 3); }
    },
    top(d) { d.rect(0, 0, d.w, d.h, 'gph', 3); d.hline(0, 0, d.w, 'gph', 4); for (let x = 2; x < d.w; x += 5) d.px(x, 1, 'gph', 0); },
  });
  for (const [i, x0, x1] of [[1, -30, -23], [2, -9, 7], [3, 21, 26]]) {
    b.box(`rail_n${i}`, [x0, 2.01, -13], [x1, 6.5, -11.5], rail);
    b.box(`rail_s${i}`, [x0, 2.01, 11.5], [x1, 6.5, 13], rail);
  }
  b.box('junction', [-6, 2.5, 13], [-2, 6.5, 14], termBoxJ);

  // feed end: hood, hopper and its port, a field emitter pylon
  b.box('feed_hood#1', [-38, 2, -11.5], [-30, 36, 11.5], feedHood);
  b.box('feed_hood#2', [-38.5, 30, -12], [-29.5, 32, 12], hoodBand);
  b.box('feed_hood#3', [-38.6, 34.5, -12.1], [-29.4, 36.2, 12.1], capMat);
  b.box('door_handle', [-39, 12, -3], [-38, 13, 3], handle);
  b.box('feed_spout', [-31, AX[1] - 2, -2], [-27, AX[1] + 2, 2], spout);
  b.box('hopper_neck', [-35, 36, -4], [-29, 39, 4], hopperNeck);
  b.box('hopper_mid', [-37, 39, -6.5], [-27, 42, 6.5], hopperNeck);
  b.box('hopper_bin', [-38.5, 42, -8], [-25.5, 46, 8], hopperBin);
  b.box('port_in', [-37, 46, -5], [-27, 48, 5], portIn);
  // emitter pylons fold flat for transport, on a hinge at the hood edge
  const hinge = mat('gph', { all(d) { d.fill((x, y) => ['gph', y === 0 ? 4 : (x + y) % 3 === 0 ? 1 : 3]); d.px(0, 0, 'trm', 4); } }, { clean: true });
  b.box('pylon_w_hinge', [-37, 35.5, 10], [-32, 37.5, 13], hinge);
  b.box('pylon_e_hinge', [27.5, 33.4, -7.5], [32.5, 35.4, -4.5], hinge);
  b.group('pylon_w', [-34.5, 36.5, 11.5], () => {
    b.box('pylon_w#1', [-36, 36.5, 8.5], [-33, 42, 11.5], mast);
    b.box('pylon_w#2', [-36.5, 39, 8], [-32.5, 40, 12], collar);
    b.box('pylon_w#3', [-35.5, 42, 9], [-33.5, 45, 11], crystal);
  });

  // discharge end: hood on legs, emitter pylon, chute, violet-white stream, ingot crate with the output port
  b.box('fire_hood#1', [26, 10.5, -12], [34, 34, 12], fireHood);
  b.box('fire_hood#2', [25.6, 32.6, -12.4], [34.4, 34.1, 12.4], capMat);
  b.box('fire_hood#3', [25.6, 10.4, -12.4], [34.4, 12, 12.4], capMat);
  b.box('hood_leg_n', [26, 2, -12], [29, 10.5, -8], hoodLeg);
  b.box('hood_leg_s', [26, 2, 8], [29, 10.5, 12], hoodLeg);
  b.group('pylon_e', [30, 34.4, -6], () => {
    b.box('pylon_e#1', [28.5, 34.4, -6], [31.5, 41, -3], mast);
    b.box('pylon_e#2', [28, 37, -6.5], [32, 38, -2.5], collar);
    b.box('pylon_e#3', [29, 41, -5.5], [31, 44, -3.5], crystal);
  });
  b.box('lamp', [31, 34.1, 8], [33, 36, 10], lamp);
  b.box('chute', [34, 13, -2.5], [37.5, 15.5, 2.5], chute);
  b.box('chute_lip', [36.5, 12, -2.5], [37.5, 13, 2.5], mat('trm'));
  b.box('stream', [35.5, 8.5, -1], [36.5, 12, 1], stream);
  b.box('crate_base', [30, 2, -7], [39, 4, 7], crateWall);
  b.box('crate_n', [30, 4, -7], [39, 9, -6], crateWall);
  b.box('crate_s', [30, 4, 6], [39, 9, 7], crateWall);
  b.box('crate_w', [30, 4, -6], [31, 9, 6], crateWall);
  b.box('melt', [31, 4, -6], [39, 8.5, 6], melt);
  b.box('port_out', [39, 2, -6], [40, 14, 6], portOut);
  b.box('gauge', [30, 26, 12], [33, 29, 13], gauge);

  // energy conduit: a riser from the ground, a collared run on two stands with a field regulator, a riser at
  // the discharge end and an elbow into the hood
  const PZ = 14, PY = 4;
  pipe(b, 'conduit_in', [-18, 0, PZ], 'y', PY, 2, conduitMat, { flange: collar, ends: true });
  pipe(b, 'conduit_run', [-18, PY, PZ], 'x', 45, 2, conduitMat, { flange: collar, every: 10, first: 9 });
  b.box('conduit_run#6', [3, PY - 0.5, PZ - 0.5], [7, PY + 2.5, PZ + 2.5], regulator);
  b.box('conduit_run#7', [4, PY + 2.5, PZ], [6, PY + 4, PZ + 2], capacitor);
  pipe(b, 'conduit_rise', [27, PY, PZ], 'y', 16, 2, conduitMat, { flange: collar, every: 10, first: 7 });
  pipe(b, 'conduit_elbow', [27, 18, PZ], 'z', -2, 2, conduitMat, { flange: collar, ends: true });
  for (const x of [-14, 15]) b.box(`conduit_stand_${x < 0 ? 'w' : 'e'}`, [x, 0, PZ - 0.5], [x + 1.5, PY, PZ + 2.5], bracket);

  const motorBottom = worldY(-34, PIN[1] - 5.5);
  b.box('motor_bed', [-39, 0, 12], [-29, motorBottom + 0.3, 23], mat('gph', { side(d) { d.hline(0, 0, d.w, 'gph', 4); d.rect(1, d.h - 3, d.w - 2, 1, 'cer', 3); d.px(1, 1, 'vio', 3); }, top(d) { d.inset(0, 0, d.w, d.h, 'gph'); d.hline(1, 2, d.w - 2, 'gph', 4); } }));
  b.box('pinion_stand', [-23, 0, 14], [-19, worldY(-21, PIN[1] - 2.5) + 0.3, 20.5], pier);

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
    b.prism('motor', [-34, py, pz], 5.5, 8, 'x', motorFins, 8);
    b.box('motor_bell', [-39.3, py - 4, pz - 4], [-38, py + 4, pz + 4], bell);
    b.box('motor_term', [-35, py + 5, pz - 2.5], [-32, py + 8, pz + 1], termBox);
    b.box('motor_feed', [-34, py + 6, pz + 1], [-33, py + 7, pz + 4.5], conduitMat);
    b.box('pinion_block', [-23, py - 2.5, pz - 2.5], [-19, py + 2.5, pz + 2.5], bearing);
    b.group('pinion', [-23, py, pz], () => {
      b.prism('pinion', [px, py, pz], PINION_R - 1, 3, 'x', pinionBody, 8);
      teeth(b, 'pinion', [px, py, pz], 'x', PINION_R + 1, 4, 2.5, 2, pinionTooth, { start: 5, phase: 7.5 });
      b.box('pinion#9', [-30, py - 1, pz - 1], [px - 1.5, py + 1, pz + 1], axle);
      b.box('pinion#10', [-29.5, py - 2, pz - 2], [-27.5, py + 2, pz + 2], coupling);
      b.box('pinion#11', [px + 1.5, py - 1, pz - 1], [-23, py + 1, pz + 1], axle);
    });

    // the drum: two ceramic sections, riding tyres, girth gear, containment rings, the plasma cage and core
    b.group('drum', [-29, AX[1], 0], () => {
      const RL = 2.5, west = WIN[0] - RL, east = WIN[1] + RL;
      b.prism('shell_w', [(-30 + west) / 2, AX[1], 0], DRUM_R, west + 30, 'x', shellMats[0], 12, { mats: shellMats });
      b.prism('shell_e', [(east + 26) / 2, AX[1], 0], DRUM_R, 26 - east, 'x', shellMats[3], 12, { mats: shellMats.slice(3).concat(shellMats.slice(0, 3)) });
      b.prism('cring_w', [WIN[0] - RL / 2, AX[1], 0], RING_R, RL, 'x', ringMats[0], 12, { mats: ringMats });
      b.prism('cring_e', [WIN[1] + RL / 2, AX[1], 0], RING_R, RL, 'x', ringMats[1], 12, { mats: ringMats });
      for (const [t, xt] of TYRES) b.prism(`tyre_${t}`, [xt, AX[1], 0], TYRE_R, 5, 'x', tyreMats[0], 12, { mats: tyreMats });
      b.prism('ring_gear', [GEAR_X, AX[1], 0], GEAR_R - 1, 3, 'x', gearBody, 12);
      teeth(b, 'ring_gear', [GEAR_X, AX[1], 0], 'x', GEAR_R + 1, 12, 2.5, 2, tooth, { start: 7 });
      for (const [i, ang] of range(6).map((k) => [k + 1, k * 60 + 30])) {
        b.box(`cage_${i}`, [WIN[0] - 0.2, AX[1] + DRUM_R - 1.5, -1.5], [WIN[1] + 0.2, AX[1] + DRUM_R + 0.5, 1.5], bar, { origin: [WIN[0], AX[1], 0], rotation: [ang, 0, 0], hide: ['east', 'west'] });
      }
      for (const [i, ang] of [[1, 0], [2, 120], [3, 240]]) {
        const top = AX[1] + DRUM_R, x0 = 18.5;
        b.box(`pod_${i}`, [x0, top - 0.5, -2.5], [x0 + 5, top + 1.2, 2.5], pod, { origin: [x0 + 2.5, AX[1], 0], rotation: [ang, 0, 0] });
        b.box(`pod_${i}_lens`, [x0 + 1.5, top + 1.2, -0.5], [x0 + 3.5, top + 2, 0.5], lens, { origin: [x0 + 2.5, AX[1], 0], rotation: [ang, 0, 0] });
      }
      b.group('plasma', [WIN[0], AX[1], 0], () => {
        b.prism('core', [(WIN[0] + WIN[1]) / 2, AX[1], 0], CORE_R, WIN[1] - WIN[0] + 0.3, 'x', coreMats[0], 12, { mats: coreMats });
      });
    });
  }, [0, 0, TILT]);

  const L = 8, turn = (k) => ({ rotation: range(4 * L + 1).map((q) => [q / 4, [k * 90 * q / L, 0, 0]]) });
  const drive = (fn) => ({
    drum: fn(1), plasma: fn(-3), pinion: fn(-GEAR_R / PINION_R),
    ...Object.fromEntries(TYRES.flatMap(([t]) => ['n', 's'].map((s) => [`roller_${t}${s}`, fn(-TYRE_R / ROLLER_R)]))),
  });
  b.anim('working', L, drive(turn));

  // packaged: pylons folded flat, drum parked a quarter turn back; deploy unfolds the pylons one after the
  // other, then rolls the drum home
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const D = 5, PARK = -90, FOLD = { pylon_w: 90, pylon_e: -90 };
  const hold = (deg) => ({ rotation: [[0, [deg, 0, 0]]] });
  b.anim('packaged', 0.5, { ...Object.fromEntries(Object.entries(FOLD).map(([n, a]) => [n, hold(a)])), ...drive((k) => hold(k * PARK)) });
  b.anims[b.anims.length - 1].loop = 'hold';
  const move = (from, t0, t1) => ({ rotation: range(21).map((q) => { const t = t0 + (t1 - t0) * q / 20; return [+t.toFixed(3), [from * (1 - ease(q / 20)), 0, 0]]; }).concat(t0 > 0 ? [[0, [from, 0, 0]]] : []).concat(t1 < D ? [[D, [0, 0, 0]]] : []).sort((a, b) => a[0] - b[0]) });
  b.anim('deploy', D, { pylon_e: move(FOLD.pylon_e, 0, 2.2), pylon_w: move(FOLD.pylon_w, 0.8, 3), ...drive((k) => move(k * PARK, 2.4, 4.8)) });
  b.anims[b.anims.length - 1].loop = 'hold';
}
