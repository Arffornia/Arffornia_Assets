// Smelter Mk2, tier 4: the Mk1 rotary kiln (smelter_kiln_v2), same chassis, drum, gearing and rollers,
// re-powered by induction. Copper coil bands wrap the drum between brushed-steel clamp bands and a collar;
// the firing hood becomes an induction head fed by a power cabinet through a ladder cable tray. Hot metal
// still glows amber at the pour; the coils and the head's insulators glow blue-white. Clean enamel, no soot.
import { addRamp, hsh } from '../pix.mjs';
import { teeth } from '../parts.mjs';

// brushed steel: cool shadows, warm lights, long streaks; no chips or grime at this tier
addRamp('bs', ['#20262e', '#46505b', '#717b85', '#9da5ab', '#d4d3cc'], { streaks: 0.12, clusters: 0.015 });
addRamp('bg', ['#191d24', '#2c3440', '#434d5a', '#606b78', '#8a94a0'], { clusters: 0.03, streaks: 0.03 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.02 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { streaks: 0.03 });
addRamp('ink', ['#0c0e12', '#171a20', '#22262d', '#30353e', '#454b55'], { clusters: 0.06 });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('arc', ['#0a1640', '#1838a8', '#2f6bff', '#6fa6ff', '#cfe2ff'], null, { glow: true });
addRamp('led', ['#3a3f46', '#8a939c', '#d8e0e6', '#f2f6f8', '#ffffff'], null, { glow: true });

const TILT = -3, AX = [0, 22, 0];
const sa = Math.sin(TILT * Math.PI / 180), ca = Math.cos(TILT * Math.PI / 180);
const worldY = (x, y) => AX[1] + x * sa + (y - AX[1]) * ca;

const DRUM_R = 10, TYRE_R = 12, ROLLER_R = 4, GEAR_R = 15, PINION_R = 5, COLLAR_R = 11.5;
const GEAR_X = -25, TYRES = [['w', -16], ['e', 14]];
const PIN = [GEAR_X, AX[1] - (GEAR_R + PINION_R) * Math.sin(Math.PI / 6), (GEAR_R + PINION_R) * Math.cos(Math.PI / 6)];
const RA = 35 * Math.PI / 180, RC = TYRE_R + ROLLER_R;
const ROLL_Y = AX[1] - RC * Math.cos(RA), ROLL_Z = RC * Math.sin(RA);

export const meta = {
  title: 'Smelter Mk2 (induction kiln)', note: 'Ore to ingots in a turning kiln heated by induction coils. Tier 4.', footprint: [5, 3], height: 3, tier: 4,
  ports: [{ id: 'in', kind: 'item', face: 'up', cell: [0, 1] }, { id: 'out', kind: 'item', face: 'east', cell: [1, 0] }],
  joints: {
    drum: { type: 'revolute', axis: 'x' }, pinion: { type: 'revolute', axis: 'x' },
    roller_wn: { type: 'revolute', axis: 'x' }, roller_ws: { type: 'revolute', axis: 'x' },
    roller_en: { type: 'revolute', axis: 'x' }, roller_es: { type: 'revolute', axis: 'x' },
    mast: { type: 'revolute', axis: 'x' }, insulators: { type: 'revolute', axis: 'z' },
  },
  gears: [
    { a: 'ring_gear', b: 'pinion', ra: GEAR_R, rb: PINION_R },
    ...TYRES.flatMap(([t]) => ['n', 's'].map((s) => ({ a: `tyre_${t}`, b: `roller_${t}${s}`, ra: TYRE_R, rb: ROLLER_R }))),
  ],
  lint: { allow: [
    { a: 'tyre_*', b: 'shell#*', check: 'overlap', why: 'riding tyres are shrunk onto the shell' },
    { a: 'collar#*', b: 'shell#*', check: 'overlap', why: 'the coil collar is clamped round the shell' },
    { a: 'ring_gear#*', b: 'shell#*', check: 'overlap', why: 'the girth gear is bolted round the shell' },
    { a: 'feed_spout', b: 'shell#*', check: 'overlap', why: 'the stationary feed spout enters the drum along its axis' },
  ] },
};
export const look = { glow: 1.3 };

const range = (n) => [...Array(n).keys()];
const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

// round gauge: steel bezel, pale face with tick marks, a dark needle; s = diameter in texels (>= 4)
function dial(d, x, y, s, o = {}) {
  const c = (s - 1) / 2, ang = (o.angle ?? 40) * Math.PI / 180;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const r = Math.hypot(i - c, j - c); if (r > c + 0.5) continue;
    if (r > c - 0.6) d.px(x + i, y + j, 'bs', j < c ? 4 : 1);
    else d.px(x + i, y + j, 'bs', j > c + 0.5 ? 3 : 4);
  }
  for (let t = 0; t < c - 0.6; t += 0.5) d.px(x + Math.round(c + Math.cos(ang) * t), y + Math.round(c - Math.sin(ang) * t), o.needle || 'ink', 0);
  if (s >= 5) d.px(x + Math.round(c - c * 0.6), y + Math.round(c + c * 0.3), 'sig', 2);
}
// a row of status LEDs in a dark bezel: `on` decides each LED (white glow) or a dim one
function leds(d, x, y, n, on = () => true, o = {}) {
  const v = o.dir === 'v';
  d.rect(x - 1, y - 1, v ? 3 : 2 * n + 1, v ? 2 * n + 1 : 3, 'ink', 1);
  for (let i = 0; i < n; i++) { const [px, py] = v ? [x, y + 2 * i] : [x + 2 * i, y]; if (on(i)) d.px(px, py, 'led', i % 3 === 2 ? 3 : 4); else d.px(px, py, 'bg', 2); }
}

export function build(b, { mat }) {
  // ---------------------------------------------------------------- materials
  // plinth: blue-grey deck with a brushed tread pattern, steel edge strips, orange position marks
  const plinth = mat('bg', {
    side(d) {
      d.fill((x, y) => ['bg', y === 0 ? (x % 8 === 7 ? 2 : 4) : (x % 8 === 7 ? 0 : 1)]);
      for (let x = 3; x < d.w; x += 8) d.px(x, 1, 'bs', 3);
      for (let x = 0; x < d.w; x += 24) d.rect(x + 10, 0, 4, 2, 'sig', x % 48 ? 2 : 3);
    },
    top(d) {
      d.fill((x, y) => { const i = x % 6, j = y % 6, off = ((x / 6 | 0) + (y / 6 | 0)) & 1; if (off ? j !== 2 || i > 3 : i !== 2 || j > 3) return null; return ['bs', off ? 3 : 2]; });
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      for (let x = 16; x < d.w - 4; x += 16) d.vline(x, 1, d.h - 2, 'bg', 1);
      for (let x = 8; x < d.w - 4; x += 16) { d.bolt(x, 2, 'bs'); d.bolt(x, d.h - 4, 'bs'); }
    },
  });
  // piers: blue-grey frame round a clean orange enamel panel with a steel data plate
  const pier = mat('bg', {
    side(d) {
      d.rings(1, 2, d.w - 2, d.h - 3, [['bg', 0], ['bs', 3], ['bg', 1]]);
      d.rect(3, 4, d.w - 6, Math.max(1, d.h - 8), 'sig', 2); d.hline(3, 4, d.w - 6, 'sig', 4); d.hline(3, d.h - 5, d.w - 6, 'sig', 1);
      d.rings(5, 6, d.w - 10, Math.max(3, d.h - 12), [['sig', 3]]);
      if (d.w >= 12 && d.h >= 14) { d.rect(Math.floor(d.w / 2) - 2, 8, 5, 3, 'bs', 3); d.hline(Math.floor(d.w / 2) - 1, 9, 3, 'bg', 1); }
      d.bolt(2, 1, 'bs'); d.bolt(d.w - 4, 1, 'bs');
      d.hline(1, d.h - 1, d.w - 2, 'bg', 0);
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'bg'); for (let x = 2; x < d.w - 2; x += 4) { d.bolt(x, 2, 'bs'); d.bolt(x, d.h - 4, 'bs'); } },
  });
  const bed = mat('bg', {
    side(d) { d.hline(0, 0, d.w, 'bs', 4); d.hline(0, d.h - 1, d.w, 'bg', 0); for (let x = 2; x < d.w - 1; x += 5) d.bolt(x, 0, 'bs'); },
    top(d) { d.inset(0, 0, d.w, d.h, 'bg'); d.hline(2, Math.floor(d.h / 2), d.w - 4, 'bs', 3); for (const x of [1, d.w - 2]) d.px(x, 1, 'bs', 4); },
  });
  const bearing = mat('bs', {
    side(d) { d.plate(0, 0, d.w, d.h, 'bs'); d.px(Math.floor(d.w / 2), 1, 'bg', 1); d.hline(1, Math.floor(d.h / 2), d.w - 2, 'bg', 2); d.px(1, d.h - 2, 'bs', 4); },
    top(d) { d.plate(0, 0, d.w, d.h, 'bs'); d.px(1, 1, 'bg', 3); d.px(d.w - 2, d.h - 2, 'bg', 1); d.vline(Math.floor(d.w / 2), 1, d.h - 2, 'bg', 2); },
    east(d) { d.plate(0, 0, d.w, d.h, 'bs'); d.rect(1, 1, d.w - 2, d.h - 2, 'bg', 2); d.px(1, 1, 'bg', 4); d.px(d.w - 2, d.h - 2, 'bg', 0); },
    west(d) { d.plate(0, 0, d.w, d.h, 'bs'); d.rect(1, 1, d.w - 2, d.h - 2, 'bg', 2); d.px(1, 1, 'bg', 4); d.px(d.w - 2, d.h - 2, 'bg', 0); },
  });

  // Drum facets (u along the drum, v across one 5 texel facet). From the feed end: a blue-grey end ring,
  // an orange enamel section under the girth gear and the west tyre, then the induction section: two copper
  // coil bands (windings across the facet, a dark spacer every 5 turns) held by brushed clamp bands, with a
  // collar between them; a blue-white glow where each band starts. Then the east tyre and an enamel section
  // before the induction head. Slab variants: a lap seam, a stencilled trim bar.
  const COILS = [[18, 28], [32, 41]], CLAMPS = [[16, 18], [28, 32], [41, 43]];
  const within = (list, x) => list.find(([a, b2]) => x >= a && x < b2);
  const shellFace = (variant, n) => (d) => {
    d.fill((x, y) => {
      if (x < 2) return ['bg', x === 0 ? 1 : 3];
      if (x >= d.w - 2) return ['ink', 1];
      const coil = within(COILS, x);
      if (coil) {
        const t = x - coil[0];
        if (t === 0 || t === coil[1] - coil[0] - 1) return ['cu', y === 0 ? 3 : 1];
        if (t === 5) return ['bg', y === 0 ? 3 : 1];
        return ['cu', y === 0 ? (x & 1 ? 4 : 3) : y === d.h - 1 ? (x & 1 ? 1 : 2) : (x & 1 ? 3 : 2)];
      }
      if (within(CLAMPS, x)) return ['bs', y === 0 ? 4 : x % 2 ? 2 : 3];
      const r = hsh(x >> 2, y, d.seed); let k = y === 0 ? 3 : 2; if (r < 0.05) k = 1;
      return ['sig', k];
    });
    // enamel panel seams, bolts at the seams, a blue-grey trim line
    for (const x of [9, 50]) { d.vline(x, 0, d.h, 'sig', 1); d.px(x - 1, 1, 'bs', 4); d.px(x + 1, d.h - 2, 'bs', 4); }
    d.vline(47, 0, d.h, 'bg', 2); d.vline(53, 0, d.h, 'bg', 3);
    for (const [a] of CLAMPS) d.px(a, 2, 'bg', 0);
    // electric glow where the coils start: one bright texel per facet, a dim one on every other
    for (const [a, b2] of COILS) { d.vline(a - 1, 1, d.h - 2, 'arc', 2); d.px(a - 1, 2, 'arc', 3); d.vline(b2, 1, d.h - 2, 'arc', n % 2 ? 2 : 1); }
    if (variant === 'lap') { d.hline(2, d.h - 1, 14, 'sig', 1); d.hline(43, d.h - 1, 11, 'sig', 1); }
    if (variant === 'bar') { d.rect(48, 1, 5, 3, 'bs', 3); d.hline(48, 1, 5, 'bs', 4); d.px(49, 2, 'bg', 0); d.px(51, 2, 'bg', 0); }
  };
  // drum caps sit in the hoods: a steel liner ring round a dark ceramic core
  const shellCap = (d) => d.radial((r, a) => (r > DRUM_R - 0.8 ? ['bg', 1] : r > DRUM_R - 3 ? ['bs', near(a, 30) < 3 ? 1 : Math.abs(r - (DRUM_R - 2)) < 0.4 ? 4 : 2] : ['ink', (r * 3 | 0) % 3 === 0 ? 0 : 2]));
  const shellMats = ['plain', 'lap', 'bar', 'plain', 'lap', 'plain'].map((v, i) => mat('sig', { top: shellFace(v, i), side: shellCap }, { clean: true }));

  // riding tyre: brushed tread with a chamfer, blue-grey cap with a ring of steel chair bolts
  const tyre = (k) => mat('bs', {
    top(d) {
      d.fill((x, y) => [x === 1 ? 'bs' : 'bg', [0, 3, 3, 2, 1][Math.min(4, x)] ?? 1]);
      d.px(2, k % 3, 'bg', 1); if (k % 2) d.px(3, d.h - 2, 'bg', 4);
    },
    side(d) {
      d.radial((r, a) => {
        if (r > TYRE_R - 0.6) return ['bs', a < 180 ? 3 : 2];
        if (r > TYRE_R - 1.2) return ['bg', 0];
        if (Math.abs(r - (TYRE_R - 1.7)) < 0.6 && near(a, 30) < 6) return ['bs', a < 180 ? 4 : 3];
        if (Math.abs(r - (TYRE_R - 1.7)) < 0.8) return ['bg', 2];
        if (r > DRUM_R - 0.5) return ['bg', 3];
        return ['bg', near(a, 30) < 4 ? 0 : (r | 0) % 3 === 0 ? 3 : 1];
      });
    },
  }, { clean: true });
  const tyreMats = range(6).map(tyre);

  // coil collar: brushed band with blue-grey edges and a bolt per facet; cap ring with glowing contacts
  const collar = (k) => mat('bs', {
    top(d) { d.fill((x, y) => ['bs', x === 0 || x === d.w - 1 ? 1 : y === 0 ? 4 : 3]); d.vline(1, 0, d.h, 'bg', 3); d.vline(d.w - 2, 0, d.h, 'bg', 2); d.px(2, 2, 'bg', 0); if (k % 2) d.px(2, 1, 'arc', 3); },
    side(d) { d.radial((r, a) => (r > COLLAR_R - 0.6 ? ['bs', a < 180 ? 4 : 2] : r > COLLAR_R - 1.2 ? ['bg', 0] : r > DRUM_R ? (near(a, 60) < 6 ? ['arc', 3] : ['bg', 3]) : ['bg', 1])); },
  }, { clean: true });
  const collarMats = range(6).map(collar);

  // girth gear: blue-grey body, an orange enamel web with lightening holes, steel bolt circle
  const gearBody = mat('bg', {
    top(d) { d.fill((x, y) => ['bg', x === 0 ? 4 : x === d.w - 1 ? 0 : y % 4 === 0 ? 1 : 2]); },
    side(d) {
      d.radial((r, a) => {
        if (r > GEAR_R - 1.6) return ['bs', a < 180 ? 4 : 3];
        if (r > GEAR_R - 2.4) return ['bg', 0];
        if (Math.abs(r - 11.4) < 1 && near(a, 30, 15) < 7) return ['ink', 0];
        if (Math.abs(r - 11.4) < 1.4 && near(a, 30, 15) < 10) return ['sig', 1];
        if (Math.abs(r - 10.4) < 0.5 && near(a, 15) < 3) return ['bs', 4];
        if (r > DRUM_R - 0.2) return ['sig', a < 180 ? 3 : 2];
        return ['bg', near(a, 30) < 3 ? 3 : (r | 0) % 4 === 0 ? 0 : 1];
      });
    },
  });
  const toothMat = (ramp) => mat(ramp, { all(d) {
    d.fill((x, y) => {
      const L = Math.max(d.w, d.h), t = d.h >= d.w ? y : x, e = Math.min(t, L - 1 - t), across = d.h >= d.w ? x : y;
      if (e < 1) return [ramp, 4]; if (e < 2) return [ramp, across === 0 ? 4 : 3]; if (e < 3) return ['bg', 0];
      return [ramp, t % 4 === 0 ? 0 : t % 4 === 2 ? 4 : 2];
    });
  } }, { clean: true });
  const tooth = toothMat('bg'), pinionTooth = toothMat('bs');

  // coil cover: bolted brushed plate with a slot showing the windings and a status LED
  const cover = mat('bs', {
    top(d) {
      d.plate(0, 0, d.w, d.h, 'bs');
      d.rect(2, 1, d.w - 4, d.h - 2, 'bg', 2); d.hline(2, 1, d.w - 4, 'bg', 4);
      for (let x = 2; x < d.w - 2; x++) d.px(x, 2, 'cu', x & 1 ? 4 : 2);
      for (const x of [0, d.w - 1]) for (const y of [0, d.h - 1]) d.px(x, y, 'bs', 4);
      d.px(d.w - 2, 1, 'bg', 0);
    },
    side(d) { d.rect(0, 0, d.w, d.h, 'bg', 1); d.hline(0, 0, d.w, 'bs', 4); d.px(1, 0, 'bs', 2); d.px(d.w - 2, 0, 'bs', 2); },
  }, { clean: true });
  const handle = mat('bs', { all(d) { d.rect(0, 0, d.w, d.h, 'bs', 3); d.hline(0, 0, d.w, 'bs', 4); d.px(d.w - 1, d.h - 1, 'bg', 1); } }, { clean: true });

  // support rollers: crowned brushed tread, blue-grey cap with a copper hub and four spokes
  const rollerTread = (d) => d.fill((x, y) => ['bs', [1, 3, 4, 3, 2, 3, 0][Math.min(6, x)] - (y === 2 && x % 3 === 1 ? 1 : 0)]);
  const rollerCap = (d) => d.radial((r, a) => (r > ROLLER_R - 0.7 ? ['bs', 3] : r > ROLLER_R - 1.3 ? ['bg', 0] : r < 0.8 ? ['bg', 0] : near(a, 90, 45) < 18 ? ['bs', 4] : ['bg', 2]));
  const roller = mat('bs', { top: rollerTread, side: rollerCap }, { clean: true });
  const rollerB = mat('bs', { top(d) { rollerTread(d); d.px(3, 1, 'bg', 1); }, side: rollerCap }, { clean: true });
  const axle = mat('bs', { all(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); } }, { clean: true });

  const pinionBody = mat('bs', {
    top(d) { d.fill((x) => ['bs', x === 0 ? 4 : x === d.w - 1 ? 1 : 3]); d.px(1, 1, 'bg', 0); },
    side(d) { d.radial((r, a) => (r < 1.2 ? ['bg', 0] : r < 2.2 ? ['bs', 4] : near(a, 45) < 10 ? ['bg', 1] : r > 3.3 ? ['bs', 3] : ['bs', 2])); },
  });
  const coupling = mat('bg', { side(d) { d.fill((x, y) => ['bg', x % 2 ? 1 : 3]); d.hline(0, 0, d.w, 'bs', 4); d.px(1, d.h - 1, 'bg', 0); } });

  // motor: brushed can with cooling fins, orange enamel end bell with a grille
  const motorFins = mat('bs', {
    top(d) { d.fill((x, y) => ['bs', [4, 2, 0, 3, 1][y % 5]]); d.vline(1, 0, d.h, 'bg', 1); d.vline(d.w - 2, 0, d.h, 'bg', 1); },
    side(d) { d.radial((r, a) => (r > 4.6 ? ['bs', 3] : r > 3.8 ? ['bg', 0] : r > 2 ? (near(a, 60) < 12 ? ['sig', 3] : ['sig', 1]) : r > 1 ? ['bs', 4] : ['bg', 0])); },
  });
  const bell = mat('sig', {
    west(d) { d.rings(0, 0, d.w, d.h, [['sig', 1], ['sig', 3]]); d.vent(2, 2, d.w - 4, d.h - 4, 'bg'); },
    side(d) { d.hline(0, 0, d.w, 'sig', 4); d.px(1, d.h - 1, 'bg', 0); },
  });
  const termBox = mat('bg', {
    side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.px(1, 1, 'led', 4); d.px(d.w - 2, 1, 'bs', 4); },
    top(d) { d.plate(0, 0, d.w, d.h, 'bg'); d.px(1, 1, 'bs', 4); d.px(2, 2, 'bs', 2); },
  });
  const cableMat = mat('ink', { all(d) {
    const along = d.w >= d.h, A = along ? d.h : d.w;
    d.fill((x, y) => { const t = along ? x : y, c = along ? y : x; return t % 9 === 4 ? ['bs', 3] : ['ink', c === 0 ? 4 : c === A - 1 ? 1 : 2]; });
  } }, { clean: true });

  // feed hood: blue-grey casing, steel bands; the orange door carries the hex mark; a status panel faces south
  const feedHood = mat('bg', {
    side(d) { d.hline(0, 0, d.w, 'bs', 4); d.rect(0, d.h - 4, d.w, 4, 'bg', 1); d.hline(0, d.h - 4, d.w, 'bs', 3); for (let x = 1; x < d.w - 1; x += 3) d.bolt(x, d.h - 3, 'bs'); },
    west(d) {
      d.plate(2, 3, d.w - 4, 18, 'sig');
      d.rings(4, 5, d.w - 8, 14, [['sig', 1], ['sig', 3]]);
      d.rect(Math.floor(d.w / 2) - 5, 7, 11, 10, 'bg', 0); d.hexMark(Math.floor(d.w / 2) - 4, 8, { rim: ['bs', 4] });
      for (const y of [5, 17]) { d.px(3, y, 'bs', 4); d.px(d.w - 4, y, 'bs', 4); }
      d.rect(6, 23, d.w - 12, 2, 'bg', 0); d.hline(7, 23, d.w - 14, 'bs', 3);
      d.vent(4, 26, d.w - 8, 5, 'bg');
    },
    south(d) {
      d.rings(1, 6, d.w - 2, 13, [['bs', 3], ['bg', 0]]);
      d.rect(2, 7, d.w - 4, 11, 'bg', 1);
      dial(d, 3, 9, 5, { angle: 60 }); dial(d, 9, 9, 5, { angle: 130 }); dial(d, 15, 9, 5, { angle: 20 });
      leds(d, 4, 16, 8, (i) => i !== 5);
      d.rect(1, 21, d.w - 2, d.h - 26, 'bg', 2);
      d.rings(1, 21, d.w - 2, d.h - 26, [['bs', 3], ['bg', 0]]);
      d.stripes(3, 23, d.w - 6, d.h - 30, ['sig', 2], ['bg', 1], { width: 3 });
    },
    north(d) { d.inset(1, 6, d.w - 2, 14, 'bg'); d.rect(3, 8, d.w - 6, 10, 'sig', 2); d.vline(Math.floor(d.w / 2), 8, 10, 'sig', 1); d.hline(3, 8, d.w - 6, 'sig', 4); d.rings(1, 21, d.w - 2, d.h - 26, [['bs', 3], ['bg', 0]]); d.vent(3, 23, d.w - 6, d.h - 30, 'bg'); },
    east(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      const cx = (d.w - 1) / 2, cy = d.h - 1 - (AX[1] - 2);
      d.radial((r, a) => (r < DRUM_R + 0.6 ? ['ink', 1] : r < DRUM_R + 2 ? ['bs', a < 180 ? 4 : 2] : r < DRUM_R + 3 && near(a, 30) < 5 ? ['bs', 3] : null), { cx, cy });
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'bg'); for (let x = 2; x < d.w - 2; x += 4) d.bolt(x, 2, 'bs'); },
  });
  const hopperNeck = mat('bg', { side(d) { d.fill((x, y) => ['bg', x % 4 === 0 ? 1 : y === 0 ? 4 : 2]); d.hline(0, d.h - 1, d.w, 'bg', 0); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'bs', 4); }, top(d) { d.inset(0, 0, d.w, d.h, 'bg'); d.px(1, 1, 'bs', 4); d.px(d.w - 2, d.h - 2, 'bs', 4); } });
  const hopperBin = mat('sig', {
    side(d) {
      d.rect(0, 0, 1, d.h, 'bs', 3); d.rect(d.w - 1, 0, 1, d.h, 'bs', 1);
      d.hline(0, d.h - 1, d.w, 'bg', 0);
      d.rings(2, 1, d.w - 4, d.h - 3, [['sig', 1], ['sig', 3]]);
      d.hline(3, 3, d.w - 6, 'bs', 3);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'bg'); for (let x = 1; x < d.w - 1; x += 3) d.px(x, 1, 'bs', 4); },
    down(d) { d.rect(0, 0, d.w, d.h, 'bg', 1); d.inset(2, 2, d.w - 4, d.h - 4, 'bg'); },
  });
  const portIn = mat('bs', {
    side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : y === d.h - 1 ? 1 : 3]); for (let x = 1; x < d.w; x += 3) d.px(x, 1, 'bg', 0); },
    up(d) {
      d.rect(0, 0, d.w, d.h, 'bs', 3); d.hline(0, 0, d.w, 'bs', 4);
      d.rect(1, 1, d.w - 2, d.h - 2, 'slag', 0);
      for (const [x, y, k] of [[2, 2, 3], [3, 3, 4], [6, 2, 2], [7, 4, 3], [4, 6, 3], [8, 7, 2], [2, 8, 4], [5, 9, 3], [9, 3, 3], [3, 5, 2]]) if (x < d.w - 1 && y < d.h - 1) { d.px(x, y, 'slag', k); d.px(x + 1, y, 'slag', k - 1); }
      d.px(6, 6, 'cu', 4); d.px(3, 9, 'cu', 3);
    },
  }, { clean: true });

  // induction head: brushed casing with blue-grey trims; the pour mouth glows amber inside a copper work
  // coil; status LEDs, gauges and an orange enamel service door
  const capStripes = (d) => d.stripes(1, d.h - 3, d.w - 2, 2, ['bg', 1], ['sig', 3]);
  const head = mat('bs', {
    side(d) { d.hline(0, 0, d.w, 'bs', 4); },
    east(d) {
      d.rings(1, 1, d.w - 2, d.h - 2, [['bg', 1], ['sig', 3], ['sig', 2], ['bg', 0]]);
      const cx = (d.w - 1) / 2, top = 6, bot = d.h - 5, hw = 5;
      d.fill((x, y) => {
        if (y < top - 2 || y > bot) return null; const dx = Math.abs(x - cx);
        const arch = y < top + hw ? Math.hypot(dx, top + hw - y) : dx;
        if (arch > hw + 2.2) return null;
        if (arch > hw + 1.2) return ['cu', (y & 1) ? 4 : 2];
        if (arch > hw) return ['ink', 0];
        const t = (y - top) / (bot - top);
        if (t < 0.3) return ['ink', 0];
        if (t < 0.45) return ['ink', 2];
        if (t < 0.55) return ['amber', 0];
        if (t < 0.75) return ['amber', (x + y) % 3 === 0 ? 2 : 1];
        return ['amber', y === bot - 1 ? 4 : 3];
      });
      d.hline(Math.ceil(cx - hw), bot + 1, 2 * hw, 'bs', 4);
      d.px(Math.round(cx - hw - 2), top + 1, 'arc', 4); d.px(Math.round(cx + hw + 2), top + 3, 'arc', 3);
      for (const y of [6, 12, 18]) { d.bolt(2, y, 'bs'); d.bolt(d.w - 4, y, 'bs'); }
      leds(d, Math.round(cx) - 2, 3, 3, (i) => i !== 1);
    },
    south(d) {
      d.rings(1, 2, d.w - 2, 13, [['bg', 0], ['bs', 3], ['bg', 2]]);
      d.rect(3, 4, d.w - 6, 9, 'bg', 1);
      dial(d, 3, 5, 5, { angle: 150 }); leds(d, 2 + 7, 6, 2, () => true, { dir: 'v' });
      d.rings(1, 15, d.w - 2, d.h - 17, [['bg', 0], ['sig', 3]]);
      d.rect(2, 16, d.w - 4, d.h - 19, 'sig', 2); d.hline(2, 16, d.w - 4, 'sig', 4);
      d.vent(3, 18, d.w - 6, 4, 'bg');
    },
    north(d) {
      d.rings(1, 2, d.w - 2, d.h - 6, [['bg', 0], ['sig', 3], ['sig', 2]]);
      d.rect(3, 4, d.w - 6, d.h - 10, 'sig', 2);
      d.rings(4, 5, d.w - 8, d.h - 12, [['sig', 1]]);
      d.rect(5, 7, d.w - 10, 3, 'bs', 3); d.hline(5, 7, d.w - 10, 'bs', 4); d.hline(6, 8, d.w - 12, 'bg', 1);
      d.vent(5, 12, d.w - 10, 5, 'bg');
      d.bolt(2, 3, 'bs'); d.bolt(d.w - 4, d.h - 7, 'bs');
    },
    west(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      d.rings(2, 2, d.w - 4, d.h - 4, [['bg', 2]]);
      const cx = (d.w - 1) / 2, cy = d.h - 1 - (AX[1] - 10.5);
      d.radial((r, a) => (r < DRUM_R + 0.6 ? ['ink', 0] : r < DRUM_R + 2 ? ['cu', near(a, 15) < 4 ? 4 : 2] : r < DRUM_R + 3 && near(a, 45) < 4 ? ['arc', 3] : null), { cx, cy });
    },
    up(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'bs'); capStripes(d); for (let x = 2; x < d.w - 2; x += 4) d.bolt(x, 2, 'bs'); },
    down(d) { d.rect(0, 0, d.w, d.h, 'bg', 1); },
  });
  const capMat = mat('bg', { side(d) { d.hline(0, 0, d.w, 'bs', 4); d.hline(0, d.h - 1, d.w, 'bg', 0); for (let x = 3; x < d.w - 1; x += 6) d.px(x, 1, 'bs', 4); }, top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'bg'); for (let x = 3; x < d.w - 2; x += 5) d.bolt(x, 2, 'bs'); capStripes(d); } });
  const hoodLeg = mat('bg', { side(d) { d.fill((x, y) => ['bg', x === 0 ? 3 : x === d.w - 1 ? 0 : y % 5 === 0 ? 1 : 2]); d.px(1, 1, 'bs', 4); }, top(d) { d.inset(0, 0, d.w, d.h, 'bg'); } });
  // bus box on the head with two insulators; their tips carry a blue-white arc
  const busBox = mat('bg', {
    side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.hline(1, 1, d.w - 2, 'bs', 4); d.px(2, d.h - 2, 'led', 4); d.vent(Math.max(3, d.w - 5), 1, 3, d.h - 2, 'bg', 'v'); },
    up(d) { d.inset(0, 0, d.w, d.h, 'bg'); d.px(1, 1, 'bs', 4); d.px(d.w - 2, d.h - 2, 'bs', 4); },
  });
  const insulator = mat('bs', {
    side(d) { d.fill((x, y) => (y % 2 ? ['bs', 4] : ['bg', 1])); d.hline(0, 0, d.w, 'arc', 3); },
    up(d) { d.rect(0, 0, d.w, d.h, 'arc', 4); },
  }, { clean: true });
  const chute = mat('bs', {
    up(d) { d.rect(0, 0, d.w, d.h, 'bs', 1); d.rect(0, 1, d.w, d.h - 2, 'amber', 2); d.hline(0, Math.floor(d.h / 2), d.w, 'amber', 3); d.px(1, 2, 'amber', 4); },
    side(d) { d.hline(0, 0, d.w, 'bs', 4); d.hline(0, d.h - 1, d.w, 'bg', 0); d.px(1, 1, 'bg', 2); },
  });
  const stream = mat('amber', { all(d) { d.fill((x, y) => ['amber', x === 0 ? 2 : (y + x) % 4 === 0 ? 4 : 3]); } }, { clean: true });
  // ingot mould: brushed walls with blue-grey corner posts, a bolted rim
  const crateWall = mat('bs', {
    side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x % 5 === 0 ? 1 : y > d.h - 2 ? 0 : 2]); for (const x of [0, d.w - 1]) d.vline(x, 0, d.h, 'bg', 2); for (let x = 2; x < d.w - 1; x += 5) d.px(x, 1, 'bg', 0); },
    top(d) { d.rect(0, 0, d.w, d.h, 'bs', 3); d.hline(0, 0, d.w, 'bs', 4); d.px(1, d.h - 1, 'bg', 1); },
  }, { clean: true });
  const melt = mat('amber', {
    up(d) {
      d.fill((x, y) => ['amber', (x % 5 === 4 || y % 6 === 5) ? 1 : (x + y * 2) % 7 === 0 ? 4 : 3]);
      for (let x = 4; x < d.w; x += 5) d.vline(x, 0, d.h, 'bs', 1);
    },
  }, { clean: true });
  const portOut = mat('bg', {
    east(d) { d.rings(0, 0, d.w, d.h, [['bs', 3], ['bg', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'ink', 1); d.hline(2, 2, d.w - 4, 'ink', 0); d.px(2, d.h - 3, 'amber', 1); d.px(d.w - 3, 2, 'bs', 4); },
    side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) d.px(0, y, 'bg', 0); },
  });

  // power cabinet: blue-grey body, two doors with gauges, an LED column and a louvred foot
  const cabinet = mat('bs', {
    south(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 4]]);
      const m = 7; d.vline(m, 1, d.h - 2, 'bg', 1);
      d.rect(1, 2, m - 1, 7, 'bg', 1); dial(d, 1, 2, 6, { angle: 60 }); dial(d, 2, 9, 4, { angle: 120 });
      d.rect(m + 1, 2, d.w - m - 3, 9, 'ink', 1); leds(d, m + 2, 3, 4, (i) => i !== 2, { dir: 'v' }); d.vline(m + 4, 3, 7, 'bg', 2); d.px(m + 4, 4, 'sig', 3);
      d.stripes(1, 12, d.w - 2, 2, ['sig', 3], ['bg', 1], { width: 2 });
      d.vent(2, d.h - 5, d.w - 4, 4, 'bg');
    },
    east(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.rect(1, 2, d.w - 2, 4, 'sig', 2); d.hline(1, 2, d.w - 2, 'sig', 4); d.px(2, 4, 'bs', 4); d.px(d.w - 3, 4, 'bs', 4); d.inset(2, d.h - 6, d.w - 4, 4, 'bg'); },
    west(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.vent(2, 2, d.w - 4, d.h - 4, 'bg'); },
    north(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.rect(2, 2, d.w - 4, 4, 'sig', 2); d.vent(2, 7, d.w - 4, d.h - 9, 'bg'); },
  });
  const cabCap = mat('bs', { side(d) { d.hline(0, 0, d.w, 'bs', 4); d.hline(0, d.h - 1, d.w, 'bg', 0); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'bg', 1); }, top(d) { d.inset(0, 0, d.w, d.h, 'bs'); d.px(2, 2, 'sig', 3); for (let x = 4; x < d.w - 2; x += 4) d.bolt(x, d.h - 3, 'bs'); } });
  // ladder cable tray: steel rungs on the floor, lips with a bolt every 6 px
  const trayFloor = mat('bs', { top(d) { d.fill((x, y) => (x % 4 === 0 ? ['bs', 4] : x % 4 === 1 ? ['bg', 1] : ['ink', 1])); }, side(d) { d.hline(0, 0, d.w, 'bs', 4); } }, { clean: true });
  const trayLip = mat('bs', { side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x % 12 === 0 ? 1 : 2]); for (let x = 3; x < d.w; x += 6) d.px(x, 1, 'bg', 0); }, top(d) { d.fill((x) => ['bs', x % 6 === 0 ? 2 : 4]); } }, { clean: true });
  const riser = mat('bs', {
    side(d) {
      d.fill((x, y) => ['bs', x === 0 || x === d.w - 1 ? 3 : y % 6 === 0 ? 4 : 2]);
      for (let x = 1; x < d.w - 1; x += 2) for (let y = 0; y < d.h; y++) if (y % 6) d.px(x, y, 'ink', x % 4 === 1 ? 2 : 3);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'bs'); },
  }, { clean: true });
  const cableBox = mat('bg', {
    side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.px(1, 1, 'bs', 4); d.px(d.w - 2, d.h - 2, 'bs', 4); d.px(d.w - 2, 1, 'led', 4); d.hline(1, Math.floor(d.h / 2), d.w - 2, 'sig', 3); },
    top(d) { d.inset(0, 0, d.w, d.h, 'bg'); d.px(1, 1, 'bs', 4); },
  });
  const bracket = mat('bg', { side(d) { d.fill((x, y) => ['bg', x === 0 ? 3 : x === d.w - 1 ? 0 : y === 0 ? 4 : y % 3 === 0 ? 1 : 2]); d.px(1, d.h - 2, 'bs', 4); }, top(d) { d.inset(0, 0, d.w, d.h, 'bg'); } }, { clean: true });
  const lamp = mat('led', { side(d) { d.rect(0, 0, d.w, d.h, 'led', 3); d.px(0, 0, 'led', 4); }, up(d) { d.rect(0, 0, d.w, d.h, 'led', 4); } }, { flat: true });
  const mast = mat('bs', { all(d) { d.fill((x, y) => ['bs', y % 3 === 0 ? 4 : x === 0 ? 3 : 1]); } }, { clean: true });
  const gauge = mat('bs', { south(d) { d.rect(0, 0, d.w, d.h, 'bg', 1); dial(d, 0, 0, Math.min(d.w, d.h), { angle: 100 }); } });

  // ---------------------------------------------------------------- static base (world frame)
  b.box('plinth', [-38, 0, -13], [30, 2, 13], plinth);
  const bedBottom = (x) => worldY(x, ROLL_Y - 5.5);
  for (const [t, xt] of TYRES) b.box(`pier_${t}`, [xt - 7, 2, -12], [xt + 7, bedBottom(xt) + 0.2, 12], pier);

  const rail = mat('bg', {
    side(d) {
      d.hline(0, 0, d.w, 'bs', 4); d.hline(0, d.h - 1, d.w, 'bg', 0);
      for (let x = 2; x + 9 < d.w; x += 12) { d.inset(x, 1, 9, d.h - 2, 'sig'); d.px(x + 1, 2, 'sig', 4); }
      for (let x = 0; x < d.w; x += 12) d.bolt(x, 1, 'bs');
    },
    top(d) { d.rect(0, 0, d.w, d.h, 'bs', 3); for (let x = 1; x < d.w; x += 4) { d.px(x, 0, 'bs', 4); d.px(x + 1, 1, 'bg', 1); } },
  });
  for (const [i, x0, x1] of [[1, -30, -23], [2, -9, 7], [3, 21, 26]]) {
    b.box(`rail_n${i}`, [x0, 2.01, -13], [x1, 6.5, -11.5], rail);
    b.box(`rail_s${i}`, [x0, 2.01, 11.5], [x1, 6.5, 13], rail);
  }
  // status mast on the feed hood
  b.box('mast_lug_w', [-33.75, 36.2, 7.5], [-32.75, 38, 9.5], bracket);
  b.box('mast_lug_e', [-30.75, 36.2, 7.5], [-29.75, 38, 9.5], bracket);
  b.group('mast', [-31.75, 37, 8.5], () => {
    b.box('mast#1', [-32.5, 37.75, 7], [-31, 40, 8.5], mast);
    b.box('mast#2', [-33, 40, 6.5], [-30.5, 41.5, 9], lamp);
    b.box('mast#3', [-32.75, 36.25, 7.75], [-30.75, 37.75, 9.25], axle);
  });

  // feed end: hood, hopper and its port
  b.box('feed_hood#1', [-38, 2, -11.5], [-30, 36, 11.5], feedHood);
  b.box('feed_hood#2', [-38.5, 30, -12], [-29.5, 32, 12], mat('bg', { side(d) { d.hline(0, 0, d.w, 'bs', 4); d.hline(0, 1, d.w, 'bs', 2); for (let x = 2; x < d.w; x += 4) { d.px(x, 1, 'bg', 0); d.px(x + 2, 0, 'bs', 3); } } }));
  b.box('feed_hood#3', [-38.6, 34.5, -12.1], [-29.4, 36.2, 12.1], capMat);
  b.box('door_handle', [-39, 12, -3], [-38, 13, 3], handle);
  b.box('feed_spout', [-31, AX[1] - 2, -2], [-27, AX[1] + 2, 2], axle);
  b.box('hopper_neck', [-35, 36, -4], [-29, 39, 4], hopperNeck);
  b.box('hopper_mid', [-37, 39, -6.5], [-27, 42, 6.5], hopperNeck);
  b.box('hopper_bin', [-38.5, 42, -8], [-25.5, 46, 8], hopperBin);
  b.box('port_in', [-37, 46, -5], [-27, 48, 5], portIn);

  // discharge end: induction head on legs, bus box with insulators, chute, molten stream, ingot mould
  b.box('head#1', [26, 10.5, -12], [34, 34, 12], head);
  b.box('head#2', [25.6, 32.6, -12.4], [34.4, 34.1, 12.4], capMat);
  b.box('head#3', [25.6, 10.4, -12.4], [34.4, 12, 12.4], capMat);
  b.box('hood_leg_n', [26, 2, -12], [29, 10.5, -8], hoodLeg);
  b.box('hood_leg_s', [26, 2, 8], [29, 10.5, 12], hoodLeg);
  b.box('bus_box', [27.5, 34.1, -8], [32.5, 37, -1], busBox);
  b.box('ins_lug_n', [31.5, 37, -7.25], [33.5, 39, -6.25], bracket);
  b.box('ins_lug_s', [31.5, 37, -2.25], [33.5, 39, -1.25], bracket);
  b.group('insulators', [32.5, 38, -4.25], () => {
    b.box('insulators#1', [28.5, 36.9, -6], [30, 40, -4.5], insulator);
    b.box('insulators#2', [30.5, 36.9, -4], [31.7, 40, -2.5], insulator);
    b.box('insulators#3', [28, 37, -5], [31.75, 37.6, -3.5], axle);
    b.box('insulators#4', [31.75, 37.25, -6.25], [33.25, 38.75, -2.25], axle);
  });
  b.box('lamp', [31, 34.1, 8], [33, 36, 10], lamp);
  b.box('chute', [34, 13, -2.5], [37.5, 15.5, 2.5], chute);
  b.box('chute_lip', [36.5, 12, -2.5], [37.5, 13, 2.5], mat('bs'));
  b.box('stream', [35.5, 8.5, -1], [36.5, 12, 1], stream);
  b.box('crate_base', [30, 2, -7], [39, 4, 7], crateWall);
  b.box('crate_n', [30, 4, -7], [39, 9, -6], crateWall);
  b.box('crate_s', [30, 4, 6], [39, 9, 7], crateWall);
  b.box('crate_w', [30, 4, -6], [31, 9, 6], crateWall);
  b.box('melt', [31, 4, -6], [39, 8.5, 6], melt);
  b.box('port_out', [39, 2, -6], [40, 14, 6], portOut);
  b.box('gauge', [30.5, 26, 12], [33.5, 29, 13], gauge);

  // power: cabinet at the feed end, ladder tray with three cables, a riser and a junction into the head
  b.box('cabinet', [-19, 0, 15], [-8, 16, 23], cabinet);
  b.box('cabinet_cap', [-19.3, 16, 14.6], [-7.7, 17, 23.4], cabCap);
  b.box('cabinet_handle', [-12.5, 7, 23], [-11.5, 10, 23.8], handle);
  b.box('tray#1', [-8, 3, 15.5], [27, 3.5, 18.5], trayFloor);
  b.box('tray#2', [-8, 3, 15], [27, 5, 15.5], trayLip);
  b.box('tray#3', [-8, 3, 18.5], [27, 5, 19], trayLip);
  for (const [i, z0, z1, top] of [[1, 15.7, 16.5, 4.5], [2, 16.6, 17.4, 4.8], [3, 17.5, 18.3, 4.4]]) b.box(`cable_${i}`, [-8, 3.5, z0], [27, top, z1], cableMat);
  for (const x of [-1, 15]) b.box(`tray_stand_${x < 0 ? 'w' : 'e'}`, [x, 0, 15.5], [x + 1.5, 3, 18.5], bracket);
  b.box('tray_rise', [27, 3, 15], [30, 18, 19], riser);
  b.box('cable_box', [26.5, 17, 12], [30.5, 23, 15.5], cableBox);

  // motor bed and pinion pedestal, under the tilted drive
  const motorBottom = worldY(-34, PIN[1] - 5.5);
  b.box('motor_bed', [-39, 0, 12], [-29, motorBottom + 0.3, 23], mat('bg', { side(d) { d.hline(0, 0, d.w, 'bs', 4); capStripes(d); d.bolt(1, 1, 'bs'); }, top(d) { d.inset(0, 0, d.w, d.h, 'bg'); for (let x = 1; x < d.w - 1; x += 3) d.bolt(x, 1, 'bs'); } }));
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
    b.box('conduit', [-34, py + 6, pz + 1], [-33, py + 7, pz + 4.5], cableMat);
    b.box('pinion_block', [-23, py - 2.5, pz - 2.5], [-19, py + 2.5, pz + 2.5], bearing);
    b.group('pinion', [-23, py, pz], () => {
      b.prism('pinion', [px, py, pz], PINION_R - 1, 3, 'x', pinionBody, 8);
      teeth(b, 'pinion', [px, py, pz], 'x', PINION_R + 1, 4, 2.5, 2, pinionTooth, { start: 5, phase: 7.5 });
      b.box('pinion#9', [-30, py - 1, pz - 1], [px - 1.5, py + 1, pz + 1], axle);
      b.box('pinion#10', [-29.5, py - 2, pz - 2], [-27.5, py + 2, pz + 2], coupling);
      b.box('pinion#11', [px + 1.5, py - 1, pz - 1], [-23, py + 1, pz + 1], axle);
    });

    // the drum: shell with coil bands, two riding tyres, coil collar, girth gear, coil covers
    b.group('drum', [-29, AX[1], 0], () => {
      b.prism('shell', [-2, AX[1], 0], DRUM_R, 56, 'x', shellMats[0], 12, { mats: shellMats });
      for (const [t, xt] of TYRES) b.prism(`tyre_${t}`, [xt, AX[1], 0], TYRE_R, 5, 'x', tyreMats[0], 12, { mats: tyreMats });
      b.prism('collar', [0, AX[1], 0], COLLAR_R, 4, 'x', collarMats[0], 12, { mats: collarMats });
      b.prism('ring_gear', [GEAR_X, AX[1], 0], GEAR_R - 1, 3, 'x', gearBody, 12);
      teeth(b, 'ring_gear', [GEAR_X, AX[1], 0], 'x', GEAR_R + 1, 12, 2.5, 2, tooth, { start: 7 });
      for (const [i, x0, ang] of [[1, -10, 0], [2, 3, 150], [3, 4, 270]]) {
        const top = AX[1] + DRUM_R;
        b.box(`cover_${i}`, [x0, top - 0.5, -2.5], [x0 + 7, top + 1, 2.5], cover, { origin: [x0 + 3.5, AX[1], 0], rotation: [ang, 0, 0] });
        b.box(`cover_${i}_grip`, [x0 + 2.5, top + 1, -1], [x0 + 4.5, top + 2, 1], handle, { origin: [x0 + 3.5, AX[1], 0], rotation: [ang, 0, 0] });
      }
    });
  }, [0, 0, TILT]);

  const L = 8, turn = (k) => ({ rotation: range(4 * L + 1).map((q) => [q / 4, [k * 90 * q / L, 0, 0]]) });
  const drive = (fn) => ({
    drum: fn(1), pinion: fn(-GEAR_R / PINION_R),
    ...Object.fromEntries(TYRES.flatMap(([t]) => ['n', 's'].map((s) => [`roller_${t}${s}`, fn(-TYRE_R / ROLLER_R)]))),
  });
  b.anim('working', L, drive(turn));

  // packaged: status mast and insulators folded flat, drum parked a quarter turn back; deploy raises the
  // insulators, then the mast, then rolls the drum home
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const D = 5, PARK = -90;
  const axisOf = { mast: 0, insulators: 2 }, FOLD = { mast: 90, insulators: -90 };
  const rot = (n, deg) => { const r = [0, 0, 0]; r[axisOf[n] ?? 0] = deg; return r; };
  const hold = (n) => (deg) => ({ rotation: [[0, rot(n, deg)]] });
  const move = (n, from, t0, t1) => ({ rotation: range(21).map((q) => { const t = t0 + (t1 - t0) * q / 20; return [+t.toFixed(3), rot(n, from * (1 - ease(q / 20)))]; }).concat(t0 > 0 ? [[0, rot(n, from)]] : []).concat(t1 < D ? [[D, rot(n, 0)]] : []).sort((a, b) => a[0] - b[0]) });
  b.anim('packaged', 0.5, { mast: hold('mast')(FOLD.mast), insulators: hold('insulators')(FOLD.insulators), ...drive((k) => hold('drum')(k * PARK)) });
  b.anims[b.anims.length - 1].loop = 'hold';
  b.anim('deploy', D, { insulators: move('insulators', FOLD.insulators, 0, 2), mast: move('mast', FOLD.mast, 0.8, 2.8), ...drive((k) => move('drum', k * PARK, 2.4, 4.8)) });
  b.anims[b.anims.length - 1].loop = 'hold';
}
