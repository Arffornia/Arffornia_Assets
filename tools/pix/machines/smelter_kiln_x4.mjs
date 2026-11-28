// Smelter x4, tier 2 (lineage: scale of smelter_kiln_v2). Four scaled-down v2 kiln drums, two over two, in one
// riveted steel rack. Ore drops from one hopper into a manifold and two flanged downpipes that feed the four
// drums axially at their west ends. One big motor drives a sun gear through a chain; the sun meshes the
// four girth gears at once, so every drum turns the same way at the same speed. Molten metal leaves the
// east ends through one shared discharge housing and pours from four chutes into one collecting trough.
import { addRamp, hsh } from '../pix.mjs';
import { pipe, teeth } from '../parts.mjs';

addRamp('gun', ['#16130f', '#27221d', '#39332c', '#524a41', '#736a5c'], { clusters: 0.035, streaks: 0.05, chips: 0.1, grime: 0.5 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.03, chips: 0.12, grime: 0.5 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { clusters: 0.05, streaks: 0.04, chips: 0.1 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });
addRamp('heat', ['#1c0f0a', '#3d1c10', '#6a2e14', '#93451c', '#c98a3e']);
addRamp('brickish', ['#24120c', '#4a2216', '#6e3220', '#8e472c', '#b0623e']);

// drum axes: rows at z = ±Z, levels YL and YH; the sun gear sits in the middle of the square they form
const Z = 12, YL = 22, YH = 46, GX = -26, SY = 34;
const DRUM_R = 6.5, TYRE_R = 8, DRUM_X0 = -28.5, DRUM_LEN = 50, TYRES = [['w', -17], ['e', 10]];
// sun to drum axis = 12·√2; pitch radii split it 1.5 : 1 so the drums turn at 2/3 of the sun's speed
const RR = 10.18, RS = 6.79, RING_BODY = 9.2, RING_TIP = 11.2, SUN_BODY = 5.8, SUN_TIP = 7.8;
const SPR_R = 4.244, CHAIN_R = 4.75, CX = -39.25, MY = 10, MOTOR_R = 8;
const DRUMS = [['ln', YL, -Z], ['ls', YL, Z], ['hn', YH, -Z], ['hs', YH, Z]];

// two drum turns per loop: the sun makes three, so every bone closes on a whole turn
const L = 16, CHAIN_PITCH = 2, CHAIN_CYCLES = 45;

export const meta = {
  title: 'Smelter x4 (rotary kilns)', note: 'Four kiln drums on one rack, one drive. Tier 2.', footprint: [5, 3], height: 5, tier: 2,
  ports: [{ id: 'in', kind: 'item', face: 'up', cell: [0, 1] }, { id: 'out', kind: 'item', face: 'east', cell: [1, 0] }],
  joints: {
    ...Object.fromEntries(DRUMS.map(([k]) => [`drum_${k}`, { type: 'revolute', axis: 'x' }])),
    sun_shaft: { type: 'revolute', axis: 'x' }, drive: { type: 'revolute', axis: 'x' },
    sign: { type: 'revolute', axis: 'x', min: 0, max: 90 },
    ...Object.fromEntries(['hs', 'hn', 'ls', 'ln'].map((k) => [`pour_${k}`, { type: 'free', why: 'molten metal starts to pour' }])),
    chain_s: { type: 'prismatic', axis: 'y', min: 0, max: CHAIN_PITCH }, chain_n: { type: 'prismatic', axis: 'y', min: -CHAIN_PITCH, max: 0 },
  },
  gears: DRUMS.map(([k]) => ({ a: `ring_${k}`, b: 'sun', ra: RR, rb: RS })),
  belts: [{ id: 'chain', pulleys: [{ part: 'sprk_top', r: CHAIN_R }, { part: 'sprk_bot', r: CHAIN_R }], segments: ['chain_s', 'chain_n'] }],
  lint: { allow: [
    { a: 'tyre_*', b: 'shell_*', check: 'overlap', why: 'riding tyres are shrunk onto the shell' },
    { a: 'ring_*', b: 'shell_*', check: 'overlap', why: 'the girth gear is bolted round the shell' },
    { a: 'spout_*', b: 'shell_*', check: 'overlap', why: 'the stationary feed spout enters the drum along its axis' },
    { a: 'sprk_top#*', b: 'xbeam_w', check: 'overlap', why: 'the sun shaft runs in the crossbeam bearing' },
  ] },
};
export const look = { glow: 1.3 };

const range = (n) => [...Array(n).keys()];
const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

// 3x5 stencil glyphs for the nameplate
const GLYPH = { S: '111100111001111', M: '1000111011101011000110001', E: '111100110100111', L: '100100100100111', T: '111010010010010', R: '110101110101101', X: '101101010101101', 4: '101101111001001', ' ': '000000000000000' };
function stencilText(d, txt, x, y, ink, shadow) {
  const each = (fn) => { let cx = x; for (const ch of txt) { const g = GLYPH[ch] || GLYPH[' '], gw = g.length / 5; for (let j = 0; j < 5; j++) for (let i = 0; i < gw; i++) if (g[j * gw + i] === '1') fn(cx + i, y + j); cx += gw + 1; } };
  if (shadow) each((i, j) => d.px(i + 1, j + 1, ...shadow));
  each((i, j) => d.px(i, j, ...ink));
}

// Structural member, any orientation: lit and shadowed long edges, a seam and a bolt every 8 texels along,
// a house-colour web between them when the member is at least 3 texels thick.
function memberFace(d, o = {}) {
  const along = d.w >= d.h, Ln = along ? d.w : d.h, A = along ? d.h : d.w, ph = o.phase || 0;
  d.fill((x, y) => {
    const t = (along ? x : y) + ph, c = along ? y : x, m = ((t % 8) + 8) % 8;
    if (m === 0) return ['gun', 0];
    if (m === 1) return ['gun', 4];
    if (c === 0) return ['gun', 3];
    if (c === A - 1) return ['gun', 1];
    if (A >= 3 && m >= 3 && m <= 5 && o.web !== false) return ['gun', m === 3 ? 3 : 1];
    if (m === 6 && c === Math.floor(A / 2)) return ['cu', 4];
    return ['gun', 2];
  });
  void Ln;
}

export function build(b, { mat }) {
  // ---------------------------------------------------------------- materials
  const plinth = mat('gun', {
    side(d) {
      d.fill((x, y) => ['gun', y === 0 ? (x % 6 === 5 ? 2 : 4) : (x % 6 === 5 ? 0 : 1)]);
      for (let x = 2; x < d.w; x += 6) d.px(x, 1, 'gun', 3);
    },
    top(d) {
      d.fill((x, y) => { const i = x % 5, j = y % 5, off = ((x / 5 | 0) + (y / 5 | 0)) & 1; if (j < 1 || j > 2) return null; const on = off ? i === j + 1 : i === 3 - j; return on ? ['gun', 3] : (off ? i === j + 2 : i === 4 - j) ? ['gun', 1] : null; });
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      for (let x = 12; x < d.w - 4; x += 14) d.weld(x, 1, d.h - 2, 'gun', { dir: 'v' });
      d.rivets(2, 2, d.w - 4, 'gun', { step: 5 }); d.rivets(2, d.h - 4, d.w - 4, 'gun', { step: 5, phase: 2 });
    },
  });
  const pier = mat('gun', {
    side(d) {
      d.rings(1, 1, d.w - 2, d.h - 2, [['gun', 0], ['gun', 3]]);
      d.rect(3, 3, d.w - 6, Math.max(1, d.h - 6), 'sig', 2); d.hline(3, 3, d.w - 6, 'sig', 3);
      d.brokenRings(3, 3, d.w - 6, Math.max(3, d.h - 6), [[1, 'sig', 1], [3, 'sig', 3]], { breaks: 0.3 });
      for (let x = 2; x < d.w - 1; x += 6) d.bolt(x, 0, 'gun');
      d.hline(1, d.h - 1, d.w - 2, 'gun', 0);
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); d.rivets(2, 2, d.w - 4, 'gun', { step: 4 }); d.rivets(2, d.h - 4, d.w - 4, 'gun', { step: 4 }); },
  });
  const member = mat('gun', { all: (d) => memberFace(d) }, { clean: true });
  const memberB = mat('gun', { all: (d) => memberFace(d, { phase: 4 }) }, { clean: true });
  const post = mat('gun', {
    all(d) {
      memberFace(d, { web: false });
      for (let y = 6; y < 12 && y < d.h - 2; y += 16) if (d.w >= 3) { d.rect(0, y, d.w, 3, 'sig', 2); d.hline(0, y, d.w, 'sig', 4); d.hline(0, y + 2, d.w, 'sig', 1); }
    },
  }, { clean: true });
  // tyre cradle: a cast saddle with two copper roller ends showing on its sides
  const cradle = mat('gun', {
    side(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); d.px(1, d.h - 1, 'cu', 4); d.px(d.w - 2, d.h - 1, 'cu', 3); d.hline(0, d.h - 1, d.w, 'gun', 0); },
    top(d) { d.fill((x, y) => ['gun', y === 0 || y === d.h - 1 ? 3 : x % 4 === 0 ? 0 : 1]); d.vline(1, 1, d.h - 2, 'cu', 4); d.vline(d.w - 2, 1, d.h - 2, 'cu', 3); },
  }, { clean: true });

  // Drum facets, the v2 shell shrunk to a 50 px drum: rolled plates joined by weld beads, rivet rows,
  // a lap seam or a stiffener on some facets, and the paint scorched to soot at the discharge end.
  const SEAMS = [5, 19, 33, 46], RIVETS = [10, 26, 39];
  const heatAt = (x, y) => { const dth = ((x + 2 * y) % 4) / 4, t = x - 41; return t < 0 ? null : t < 1.5 ? 'temper' : t < 2.5 || (t < 4.5 && dth >= (t - 2.5) / 2) ? 'heat' : 'soot'; };
  const shellFace = (variant) => (d) => {
    d.fill((x, y) => {
      const plate = SEAMS.filter((sx) => sx <= x).length, r = hsh(x >> 2, y, d.seed);
      let k = (plate & 1) && y === 0 && x % 6 < 3 ? 3 : 2;
      if (r < 0.05) k = Math.max(1, k - 1);
      const h = heatAt(x, y);
      if (h === 'temper') return ['heat', 4];
      if (h === 'heat') return ['heat', k];
      if (h === 'soot') return ['heat', Math.max(0, k - 2)];
      return ['sig', k];
    });
    for (const x of SEAMS) d.weld(x, 0, d.h, x > 41 ? 'heat' : 'sig', { dir: 'v' });
    for (const x of RIVETS) d.rivets(x, 0, d.h - 1, x > 41 ? 'heat' : 'sig', { dir: 'v', step: 2, phase: x & 1 });
    if (variant === 'lap') { d.hline(6, d.h - 1, 12, 'sig', 0); d.rivets(7, d.h - 2, 11, 'sig', { step: 3 }); }
    if (variant === 'bar') { d.hline(21, 1, 10, 'gun', 2); for (let x = 22; x < 31; x += 3) d.px(x, 1, 'cu', 4); }
    d.rect(0, 0, 2, d.h, 'gun', 1); d.rect(d.w - 2, 0, 2, d.h, 'slag', 1);
  };
  const shellCap = (d) => d.radial((r, a) => (r > DRUM_R - 0.8 ? ['gun', 1] : r > DRUM_R - 2.4 ? ['brickish', near(a, 30) < 4 ? 0 : 2] : ['slag', (r * 3 | 0) % 3 === 0 ? 0 : 2]));
  const shellMats = ['plain', 'lap', 'bar', 'plain', 'lap', 'plain'].map((v) => mat('sig', { top: shellFace(v), side: shellCap }, { clean: true }));

  const tyreMats = range(6).map((k) => mat('gun', {
    top(d) { d.fill((x) => ['gun', [0, 4, 3, 1][Math.min(3, x)]]); d.px(2, k % 3, 'gun', 0); if (k % 2) d.px(1, d.h - 2, 'cu', 3); },
    side(d) {
      d.radial((r, a) => {
        if (r > TYRE_R - 0.6) return ['gun', a < 180 ? 4 : 3];
        if (r > TYRE_R - 1.2) return ['gun', 0];
        if (r > DRUM_R - 0.3) return ['cu', near(a, 30) < 6 ? 4 : 1];
        return ['gun', near(a, 30) < 4 ? 0 : 2];
      });
    },
  }, { clean: true }));

  const gearBody = mat('gun', {
    top(d) { d.fill((x, y) => ['gun', x === 0 ? 4 : x === d.w - 1 ? 0 : y % 3 === 0 ? 1 : 2]); },
    side(d) {
      d.radial((r, a) => {
        if (r > RING_BODY - 1.2) return ['gun', a < 180 ? 4 : 3];
        if (r > RING_BODY - 1.8) return ['gun', 0];
        if (Math.abs(r - 7.6) < 0.5 && near(a, 30, 15) < 7) return ['cu', 4];
        if (r > DRUM_R + 0.2) return ['sig', near(a, 30) < 5 ? 1 : 2];
        return ['gun', near(a, 30) < 3 ? 3 : 1];
      });
    },
  });
  const toothMat = (ramp) => mat(ramp, { all(d) {
    d.fill((x, y) => {
      const Ln = Math.max(d.w, d.h), t = d.h >= d.w ? y : x, e = Math.min(t, Ln - 1 - t), across = d.h >= d.w ? x : y;
      if (e < 1) return [ramp, 4]; if (e < 2) return [ramp, across === 0 ? 4 : 3]; if (e < 3) return ['gun', 0];
      return [ramp, t % 4 === 0 ? 0 : t % 4 === 2 ? 4 : 2];
    });
  } }, { clean: true });
  const tooth = toothMat('gun'), sunTooth = toothMat('cu');
  const sunBody = mat('cu', {
    top(d) { d.fill((x) => ['cu', x === 0 ? 4 : x === d.w - 1 ? 1 : 3]); d.px(1, 1, 'gun', 0); },
    side(d) { d.radial((r, a) => (r < 1.2 ? ['gun', 0] : r < 2.2 ? ['cu', 4] : near(a, 45) < 10 ? ['gun', 1] : r > SUN_BODY - 1 ? ['cu', 3] : ['cu', 2])); },
  });
  // sprocket: a copper disc with teeth painted round the rim and a dark hub
  const sprocket = mat('cu', {
    top(d) { d.fill((x, y) => ['cu', y % 2 ? 1 : x === 0 ? 4 : 3]); },
    side(d) { d.radial((r, a) => (r > SPR_R - 1 ? ['cu', near(a, 22.5) < 6 ? 4 : 0] : r < 1.3 ? ['gun', 0] : near(a, 45) < 9 ? ['cu', 1] : ['cu', 3])); },
  }, { clean: true });
  const axle = mat('gun', { all(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); } }, { clean: true });
  // roller chain: plates and pins on a 2 texel pitch, so a slide of one pitch reads as continuous motion
  const chain = mat('gun', { all(d) { const along = d.h >= d.w; d.fill((x, y) => { const t = along ? y : x, c = along ? x : y; return t % 2 ? ['gun', 0] : ['gun', c === 0 ? 4 : 3]; }); for (let t = 0; t < Math.max(d.w, d.h); t += 4) d.px(d.h >= d.w ? 0 : t, d.h >= d.w ? t : 0, 'cu', 3); } }, { clean: true });

  const hatch = mat('gun', {
    top(d) {
      d.plate(0, 0, d.w, d.h, 'gun');
      d.rect(1, 1, d.w - 2, d.h - 2, 'sig', 2); d.hline(1, 1, d.w - 2, 'sig', 4); d.hline(2, d.h - 2, d.w - 3, 'sig', 1);
      for (const x of [0, d.w - 1]) for (const y of [0, d.h - 1]) d.px(x, y, 'cu', 4);
      d.vline(Math.floor(d.w / 2), 1, d.h - 2, 'gun', 1);
    },
    side(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); d.hline(0, 0, d.w, 'gun', 4); d.px(1, 0, 'cu', 3); },
  }, { clean: true });

  // motor: anthracite can with fins, orange end bell with a fan grille, copper terminal box
  const motorFins = mat('gun', {
    top(d) { d.fill((x, y) => (x % 3 === 2 ? ['gun', y % 4 === 0 ? 1 : 0] : ['sig', x % 3 === 0 ? 4 : 2])); d.hline(0, 0, d.w, 'gun', 3); d.hline(0, d.h - 1, d.w, 'gun', 1); d.vline(1, 0, d.h, 'gun', 0); d.vline(d.w - 2, 0, d.h, 'gun', 0); },
    side(d) { d.radial((r, a) => (r > MOTOR_R - 0.8 ? ['gun', 3] : r > MOTOR_R - 1.6 ? ['gun', 0] : r > 2.4 ? (near(a, 45) < 9 ? ['sig', 3] : ['sig', 1]) : r > 1.2 ? ['cu', 4] : ['gun', 0])); },
  });
  const bell = mat('sig', {
    east(d) { d.rings(0, 0, d.w, d.h, [['sig', 1], ['sig', 3]]); d.vent(2, 2, d.w - 4, d.h - 4, 'gun'); d.px(1, 1, 'cu', 4); d.px(d.w - 2, d.h - 2, 'cu', 3); },
    side(d) { d.hline(0, 0, d.w, 'sig', 4); d.px(0, d.h - 1, 'gun', 0); },
  });
  const termBox = mat('sig', {
    side(d) { d.rings(0, 0, d.w, d.h, [['sig', 0], ['sig', 3]]); d.px(1, 1, 'cu', 4); },
    top(d) { d.plate(0, 0, d.w, d.h, 'sig'); d.px(1, 1, 'gun', 0); d.px(2, 2, 'cu', 4); },
  });

  // feed: copper pipe with stamped weld rings, flanges, a riveted manifold and the v2 hopper
  const pipeMat = mat('cu', { all(d) {
    const along = d.w >= d.h, A = along ? d.h : d.w;
    d.fill((x, y) => { const t = along ? x : y, c = along ? y : x; if (t % 6 === 3) return ['cu', c === 0 ? 4 : 0]; return ['cu', c === 0 ? 3 : c === A - 1 ? 1 : 2]; });
  } }, { clean: true });
  const flange = mat('cu', { all(d) { d.rect(0, 0, d.w, d.h, 'cu', 2); d.hline(0, 0, d.w, 'cu', 4); d.hline(0, d.h - 1, d.w, 'cu', 1); for (let i = 1; i < Math.max(d.w, d.h) - 1; i += 2) d.px(d.w > d.h ? i : 0, d.w > d.h ? 0 : i, 'gun', 0); } }, { clean: true });
  const spout = mat('gun', {
    side(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : y === d.h - 1 ? 0 : x % 3 === 0 ? 1 : 2]); d.vline(0, 0, d.h, 'cu', 3); d.px(2, 1, 'cu', 4); },
    top(d) { d.fill((x, y) => ['gun', x % 3 === 0 ? 1 : y === 0 ? 4 : 2]); d.vline(0, 0, d.h, 'cu', 4); },
  }, { clean: true });
  const manifold = mat('gun', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      d.rect(1, 1, d.w - 2, d.h - 2, 'sig', 2); d.hline(1, 1, d.w - 2, 'sig', 4);
      d.rivets(1, d.h - 2, d.w - 2, 'gun', { step: 3 });
      for (let x = 4; x < d.w - 2; x += 8) d.vline(x, 1, d.h - 2, 'gun', 1);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.rivets(1, 1, d.w - 2, 'gun', { step: 3 }); d.weld(2, Math.floor(d.h / 2), d.w - 4, 'gun'); },
  });
  const hopperNeck = mat('gun', { side(d) { d.fill((x, y) => ['gun', x % 4 === 0 ? 1 : y === 0 ? 4 : 2]); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'cu', 3); }, top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.px(1, 1, 'cu', 4); d.px(d.w - 2, d.h - 2, 'gun', 4); } });
  const hopperBin = mat('sig', {
    side(d) {
      d.rect(0, 0, 1, d.h, 'gun', 2); d.rect(d.w - 1, 0, 1, d.h, 'gun', 1);
      d.hline(0, d.h - 1, d.w, 'gun', 0); d.hline(0, 0, d.w, 'gun', 3);
      d.hline(1, 1, d.w - 2, 'sig', 4);
      for (let x = 3; x < d.w - 2; x += 4) { d.vline(x, 2, d.h - 4, 'sig', 3); d.vline(x + 1, 2, d.h - 4, 'sig', 1); d.px(x, 2, 'cu', 4); }
      d.hline(1, d.h - 3, d.w - 2, 'gun', 1); d.rivets(1, d.h - 3, d.w - 2, 'gun', { step: 3 });
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.rivets(1, 1, d.w - 2, 'gun', { step: 3 }); },
    down(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); d.inset(2, 2, d.w - 4, d.h - 4, 'gun'); },
  });
  const hopperFunnel = mat('sig', {
    side(d) { d.fill((x, y) => ['sig', y === 0 ? 4 : (x + y) % 4 === 0 ? 1 : 2]); d.hline(0, d.h - 1, d.w, 'gun', 0); d.rivets(1, 1, d.w - 2, 'gun', { step: 3 }); },
    top(d) { d.inset(0, 0, d.w, d.h, 'sig'); d.rings(1, 1, d.w - 2, d.h - 2, [['gun', 1]]); },
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

  // discharge housing: anthracite casing, orange panels, four glowing mouths, the hex mark
  const mouth = (d, cx, top, bot, hw) => {
    d.fill((x, y) => {
      if (y < top - 1 || y > bot + 1) return null; const dx = Math.abs(x - cx);
      const arch = y < top + hw ? Math.hypot(dx, top + hw - y) : dx;
      if (arch > hw + 1.4) return null; if (arch > hw) return ['sig', y < top + hw ? 3 : 1];
      if (y > bot) return null;
      const t = (y - top) / (bot - top);
      if (t < 0.3) return ['slag', 0]; if (t < 0.45) return ['slag', 1]; if (t < 0.55) return ['amber', 0];
      if (t < 0.8) return ['amber', (x + y) % 3 === 0 ? 2 : 1];
      return ['amber', 3];
    });
    d.hline(cx - hw, bot + 1, 2 * hw + 1, 'cu', 3);
  };
  const capStripes = (d) => d.stripes(1, d.h - 3, d.w - 2, 2, ['gun', 0], ['sig', 3]);
  const housing = mat('gun', {
    east(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      // orange upper band carrying the hex mark between the upper mouths
      d.plate(11, 3, d.w - 22, 15, 'sig');
      d.rings(13, 5, d.w - 26, 11, [['sig', 1], ['sig', 3]]);
      const hx = Math.floor(d.w / 2) - 5; d.rect(hx, 6, 11, 9, 'gun', 0); d.hexMark(hx + 1, 6);
      for (const cx of [5, d.w - 6]) { d.rings(cx - 5, 3, 11, 15, [['gun', 0], ['gun', 4]]); mouth(d, cx, 6, 14, 3); }
      d.weld(1, 19, d.w - 2, 'gun');
      d.brokenRings(1, 21, d.w - 2, 8, [[0, 'sig', 2], [2, 'gun', 3]], { breaks: 0.25 });
      for (const cx of [13, d.w - 14]) { d.rect(cx - 5, 29, 11, 13, 'sig', 2); d.rings(cx - 5, 29, 11, 13, [['sig', 1], ['sig', 3]]); mouth(d, cx, 31, 38, 3); }
      d.brokenRings(19, 29, d.w - 38, 13, [[0, 'gun', 3], [2, 'sig', 2]], { breaks: 0.2 });
      d.weld(1, 42, d.w - 2, 'gun');
      d.vent(2, 44, d.w - 4, 6, 'gun');
      for (let x = 3; x < d.w - 3; x += 6) d.bolt(x, 51, 'gun');
      d.rivets(2, 1, d.w - 4, 'gun', { step: 4 });
    },
    south(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      d.window(1, 4, d.w - 2, 8, 'gun', 'amber');
      d.plate(1, 13, d.w - 2, 12, 'sig'); d.rings(2, 14, d.w - 4, 10, [['sig', 1], ['sig', 3]]); d.px(3, 16, 'cu', 4); d.px(d.w - 4, 21, 'cu', 4);
      d.brokenRings(1, 26, d.w - 2, 10, [[0, 'gun', 3], [2, 'gun', 0]], { breaks: 0.25 });
      d.window(1, 37, d.w - 2, 7, 'gun', 'amber');
      d.vent(1, 45, d.w - 2, 6, 'gun');
      d.rivets(1, d.h - 3, d.w - 2, 'gun', { step: 3 });
    },
    north(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      for (let y = 3; y < d.h - 4; y += 9) { d.inset(1, y, d.w - 2, 7, 'gun'); d.rect(2, y + 2, d.w - 4, 3, 'sig', 2); d.hline(2, y + 2, d.w - 4, 'sig', 4); d.px(3, y + 3, 'cu', 4); }
      d.rivets(1, d.h - 3, d.w - 2, 'gun', { step: 3 });
    },
    west(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      d.brokenRings(1, 1, d.w - 2, d.h - 2, [[1, 'gun', 1], [3, 'gun', 3], [6, 'sig', 1]], { breaks: 0.3 });
      for (const [, y, z] of DRUMS) d.radial((r) => (r < DRUM_R + 0.6 ? ['slag', 0] : r < DRUM_R + 2 ? ['amber', r < DRUM_R + 1.3 ? 2 : 1] : null), { cx: z + 21 - 0.5, cy: 58 - y - 0.5 });
    },
    up(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); d.rivets(2, 2, d.w - 4, 'gun', { step: 4 }); for (let y = 6; y < d.h - 4; y += 8) d.weld(2, y, d.w - 4, 'gun'); },
  });
  const capMat = mat('gun', {
    side(d) { d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 3; x < d.w - 1; x += 6) d.px(x, 1, 'cu', 3); },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); for (let x = 3; x < d.w - 2; x += 5) d.px(x, 2, 'gun', 4); capStripes(d); for (let y = 6; y < d.h - 4; y += 8) d.weld(2, y, d.w - 4, 'gun'); },
  });
  const flue = mat('gun', { side(d) { for (const y of [1, 4]) { d.hline(0, y, d.w, 'gun', 0); d.hline(0, y + 1, d.w, 'gun', 4); } d.px(1, 7, 'cu', 3); }, up(d) { d.rect(0, 0, d.w, d.h, 'slag', 0); d.px(1, 1, 'amber', 1); } });
  const flueCap = mat('cu', { side(d) { d.hline(0, 0, d.w, 'cu', 4); d.hline(0, d.h - 1, d.w, 'cu', 1); }, up(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.rect(1, 1, d.w - 2, d.h - 2, 'slag', 0); d.px(2, 2, 'amber', 1); } });
  const lamp = mat('amber', { side(d) { d.rect(0, 0, d.w, d.h, 'amber', 3); d.px(0, 0, 'amber', 4); }, up(d) { d.rect(0, 0, d.w, d.h, 'amber', 4); } }, { flat: true });
  const gauge = mat('gun', { south(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.rect(1, 1, d.w - 2, d.h - 2, 'gun', 4); d.px(1, 1, 'slag', 0); d.px(2, 2, 'amber', 2); } });
  const chute = mat('gun', {
    up(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); d.rect(0, 1, d.w, d.h - 2, 'amber', 2); d.hline(0, Math.floor(d.h / 2), d.w, 'amber', 3); d.px(1, 2, 'amber', 4); },
    side(d) { d.hline(0, 0, d.w, 'cu', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); d.px(1, 1, 'cu', 2); },
  });
  const stream = mat('amber', { all(d) { d.fill((x, y) => ['amber', x === 0 ? 2 : (y + x) % 4 === 0 ? 4 : 3]); } }, { clean: true });
  const crateWall = mat('gun', {
    side(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 5 === 0 ? 1 : y > d.h - 2 ? 0 : 2]); for (const x of [0, d.w - 1]) d.vline(x, 0, d.h, 'cu', 2); for (let x = 2; x < d.w - 1; x += 5) d.px(x, 1, 'cu', 4); for (let x = 4; x < d.w - 4; x += 10) d.rect(x, 2, 3, Math.max(1, d.h - 3), 'sig', 2); },
    top(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : x % 4 === 0 ? 1 : 3]); },
  }, { clean: true });
  const melt = mat('amber', {
    up(d) {
      d.fill((x, y) => ['amber', (x % 5 === 4 || y % 6 === 5) ? 1 : (x + y * 2) % 7 === 0 ? 4 : 3]);
      for (let x = 4; x < d.w; x += 5) d.vline(x, 0, d.h, 'slag', 2);
    },
  }, { clean: true });
  const portOut = mat('gun', {
    east(d) { d.rings(0, 0, d.w, d.h, [['cu', 3], ['gun', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'slag', 1); d.hline(2, 2, d.w - 4, 'slag', 0); d.px(2, d.h - 3, 'amber', 1); },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) d.px(0, y, 'gun', 0); },
  });
  const sign = mat('gun', {
    south(d) {
      d.rect(0, 0, d.w, d.h, 'gun', 0); d.rings(0, 0, d.w, d.h, [['sig', 3]]); d.hline(1, d.h - 1, d.w - 2, 'sig', 1);
      stencilText(d, 'SMELTER X4', Math.floor((d.w - 41) / 2), 1, ['sig', 4]);
    },
    north(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 8 === 0 ? 0 : (x + y) % 6 === 0 ? 1 : 2]); d.rivets(2, 2, d.w - 4, 'gun', { step: 4 }); d.weld(1, d.h - 2, d.w - 2, 'gun'); },
    side(d) { d.fill((x, y) => ['sig', y === 0 ? 4 : 2]); },
    up(d) { d.fill((x) => ['sig', x % 4 === 0 ? 1 : 3]); },
  }, { clean: true });

  // ---------------------------------------------------------------- static frame
  b.box('plinth', [-40, 0, -24], [40, 2, 24], plinth);
  for (const [i, x0, x1] of [[1, -32, -29], [2, -4, -1], [3, 18, 21]]) for (const s of [-1, 1]) {
    b.box(`post_${i}${s > 0 ? 's' : 'n'}`, [x0, 2, s > 0 ? 21 : -24], [x1, 60, s > 0 ? 24 : -21], post);
  }
  for (const [s, z0, z1] of [['s', 21, 23], ['n', -23, -21]]) {
    for (const [i, x0, x1] of [[1, -29, -4], [2, -1, 18]]) {
      b.box(`rail_${s}${i}`, [x0, 31, z0], [x1, 33.5, z1], i & 1 ? member : memberB);
      b.box(`base_${s}${i}`, [x0, 10, z0], [x1, 13, z1], i & 1 ? memberB : member);
      b.box(`top_${s}${i}`, [x0, 57, z0], [x1, 60, z1], i & 1 ? memberB : member);
    }
  }
  b.box('xbeam_w', [-32, 31.5, -21], [-29, 36.5, 21], member);
  b.box('xtop_w', [-32, 57, -21], [-29, 60, 21], memberB);
  b.box('xtop_m', [-4, 57, -21], [-1, 60, 21], member);
  for (const [t, xt] of TYRES) {
    b.box(`pier_${t}`, [xt - 3, 2, -20], [xt + 3, 12, 20], pier);
    b.box(`xbeam_${t}`, [xt - 3, 33.5, -23], [xt + 3, 35.75, 23], memberB);
    for (const z of [-Z, Z]) {
      b.box(`cradle_l${t}${z > 0 ? 's' : 'n'}`, [xt - 3, 12, z - 4], [xt + 3, 13.75, z + 4], cradle);
      b.box(`cradle_h${t}${z > 0 ? 's' : 'n'}`, [xt - 3, 35.75, z - 4], [xt + 3, 37.7, z + 4], cradle);
    }
  }
  b.group('sign', [-4, 60, 21.2], () => b.box('sign', [-26, 59, 21.2], [17.99, 67, 22.8], sign));

  // feed: hopper, manifold, two flanged downpipes, four axial spouts
  b.box('manifold', [-37, 56, -15], [-32, 60, 15], manifold);
  for (const [s, z] of [['n', -Z], ['s', Z]]) {
    pipe(b, `downpipe_${s}`, [-35.5, 20, z - 1.5], 'y', 36, 3, pipeMat, { flange, every: 9, first: 7 });
    for (const [lv, y] of [['l', YL], ['h', YH]]) b.box(`spout_${lv}${s}`, [-32.5, y - 2, z - 2], [-26.5, y + 2, z + 2], spout);
  }
  b.box('hopper_neck', [-35, 60, -3], [-29, 62.5, 3], hopperNeck);
  b.box('hopper_mid', [-37, 62.5, -5], [-27, 65.5, 5], hopperNeck);
  b.box('hopper_funnel', [-38.5, 65.5, -6.5], [-25.5, 69, 6.5], hopperFunnel);
  b.box('hopper_bin', [-39.5, 69, -8], [-24.5, 78, 8], hopperBin);
  b.box('port_in', [-37, 78, -5], [-27, 80, 5], portIn);

  // drive: the motor on the plinth, a pillow block, the chain up to the sun shaft
  b.prism('motor', [-34.25, MY, 0], MOTOR_R, 8.5, 'x', motorFins, 8);
  b.box('motor_bell', [-30, MY - 5, -5], [-29, MY + 5, 5], bell);
  b.box('motor_term', [-36, MY + 8, -2.5], [-32, MY + 11, 1.5], termBox);
  b.box('conduit#1', [-35, MY + 9, 1.5], [-34, MY + 10, 9.5], pipeMat);
  b.box('conduit#2', [-35, 2, 8.5], [-34, MY + 9, 9.5], pipeMat);

  // ---------------------------------------------------------------- discharge housing and trough
  b.box('housing#1', [21, 2, -21], [29, 58, 21], housing, { hide: ['down'] });
  b.box('housing#2', [20.6, 56, -21.4], [29.4, 58.5, 21.4], capMat);
  b.box('housing#3', [20.6, 2, -21.4], [29.4, 5, 21.4], capMat);
  b.box('flue', [23, 58.5, -4], [27, 66, 0], flue);
  b.box('flue_cap', [22.5, 66, -4.5], [27.5, 67.5, 0.5], flueCap);
  b.box('lamp', [26, 58.5, 14], [28, 60.5, 16], lamp);
  b.box('gauge', [23, 28, 21], [26, 31, 22], gauge);
  for (const [s, z, y] of [['hs', 16, YH], ['hn', -16, YH], ['ls', 8, YL], ['ln', -8, YL]]) {
    b.box(`chute_${s}`, [29, y - 2.5, z - 2.5], [33.5, y, z + 2.5], chute);
    b.group(`pour_${s}`, [32, y - 2.5, z], () => b.box(`stream_${s}`, [31.5, 7.5, z - 1], [32.5, y - 2.5, z + 1], stream));
  }
  b.box('trough_base', [29.4, 2, -22], [39, 3, 22], crateWall);
  b.box('trough_n', [29.4, 3, -22], [39, 8, -21], crateWall);
  b.box('trough_s', [29.4, 3, 21], [39, 8, 22], crateWall);
  b.box('trough_en', [39, 2, -22], [40, 8, -6], crateWall);
  b.box('trough_es', [39, 2, 6], [40, 8, 22], crateWall);
  b.box('melt', [29.4, 3, -21], [39, 7.5, 21], melt);
  b.box('port_out', [39, 2, -6], [40, 14, 6], portOut);

  // ---------------------------------------------------------------- moving parts
  b.group('drive', [-38.5, MY, 0], () => {
    b.prism('sprk_bot', [CX, MY, 0], SPR_R, 1.5, 'x', sprocket, 8);
    b.box('sprk_bot#5', [-39.9, MY - 1, -1], [-37.6, MY + 1, 1], axle);
  });
  b.group('sun_shaft', [-30.5, SY, 0], () => {
    b.prism('sprk_top', [CX, SY, 0], SPR_R, 1.5, 'x', sprocket, 8);
    b.box('sprk_top#5', [-39.9, SY - 1, -1], [GX - 1.25, SY + 1, 1], axle);
    b.prism('sun', [GX, SY, 0], SUN_BODY, 2.5, 'x', sunBody, 8);
    teeth(b, 'sun', [GX, SY, 0], 'x', SUN_TIP, 4, 2.0, 2, sunTooth, { start: 5, phase: 0 });
  });
  for (const [s, zs] of [['s', 1], ['n', -1]]) {
    b.group(`chain_${s}`, [CX, MY, zs * CHAIN_R], () => {
      b.box(`chain_${s}`, [CX - 0.55, MY, zs > 0 ? SPR_R + 0.01 : -SPR_R - 1.01], [CX + 0.55, SY, zs > 0 ? SPR_R + 1.01 : -SPR_R - 0.01], chain);
    });
  }

  const HATCH = { ln: [-6, 0], ls: [1, 120], hn: [-10, 240], hs: [-2, 60] };
  for (const [k, y, z] of DRUMS) {
    b.group(`drum_${k}`, [-28, y, z], () => {
      b.prism(`shell_${k}`, [DRUM_X0 + DRUM_LEN / 2, y, z], DRUM_R, DRUM_LEN, 'x', shellMats[0], 12, { mats: shellMats });
      for (const [t, xt] of TYRES) b.prism(`tyre_${k}${t}`, [xt, y, z], TYRE_R, 4, 'x', tyreMats[0], 12, { mats: tyreMats });
      b.prism(`ring_${k}`, [GX, y, z], RING_BODY, 2.5, 'x', gearBody, 12);
      teeth(b, `ring_${k}`, [GX, y, z], 'x', RING_TIP, 6, 2.2, 2, tooth, { start: 7, phase: 0 });
      const [x0, ang] = HATCH[k], top = y + DRUM_R;
      b.box(`hatch_${k}`, [x0, top - 0.3, z - 1.6], [x0 + 6, top + 1.2, z + 1.6], hatch, { origin: [x0 + 3, y, z], rotation: [ang, 0, 0] });
    });
  }

  const turn = (k) => ({ rotation: range(4 * L + 1).map((q) => [q / 4, [k * 180 * q / L, 0, 0]]) });
  const P = L / CHAIN_CYCLES;
  const slide = (dir) => ({ position: range(CHAIN_CYCLES).flatMap((i) => [[i * P, [0, 0, 0]], [(i + 1) * P - 0.0125, [0, dir * CHAIN_PITCH * (1 - 0.0125 / P), 0]]]).concat([[L, [0, 0, 0]]]) });
  b.anim('working', L, {
    ...Object.fromEntries(DRUMS.map(([k]) => [`drum_${k}`, turn(1)])),
    sun_shaft: turn(-RR / RS), drive: turn(-RR / RS),
    chain_s: slide(1), chain_n: slide(-1),
  });

  // packaged: the nameplate folded flat on the top rail, the drums parked a quarter turn back, no pour;
  // deploy raises the plate, rolls the drums home through the drive, then the four pours start
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const D = 5, PARK = -90, FOLD = -90, POURS = ['hs', 'hn', 'ls', 'ln'];
  const drive = (fn) => ({ ...Object.fromEntries(DRUMS.map(([k]) => [`drum_${k}`, fn(1)])), sun_shaft: fn(-RR / RS), drive: fn(-RR / RS) });
  const hold = (deg) => ({ rotation: [[0, [deg, 0, 0]]] });
  const dry = { scale: [[0, [1, 0.02, 1]]] };
  b.anim('packaged', 0.5, { sign: hold(FOLD), ...drive((k) => hold(k * PARK)), ...Object.fromEntries(POURS.map((k) => [`pour_${k}`, dry])) });
  b.anims[b.anims.length - 1].loop = 'hold';
  const curve = (t0, t1, f) => range(21).map((q) => { const t = t0 + (t1 - t0) * q / 20; return [+t.toFixed(3), f(ease(q / 20))]; }).concat(t0 > 0 ? [[0, f(0)]] : []).concat(t1 < D ? [[D, f(1)]] : []).sort((a, c) => a[0] - c[0]);
  const move = (from, t0, t1) => ({ rotation: curve(t0, t1, (e) => [from * (1 - e), 0, 0]) });
  b.anim('deploy', D, {
    sign: move(FOLD, 0, 1.8), ...drive((k) => move(k * PARK, 1.2, 3.8)),
    ...Object.fromEntries(POURS.map((k, i) => [`pour_${k}`, { scale: curve(3.6 + i * 0.2, 4.6 + i * 0.1, (e) => [1, 0.02 + 0.98 * e, 1]) }])),
  });
  b.anims[b.anims.length - 1].loop = 'hold';
}
