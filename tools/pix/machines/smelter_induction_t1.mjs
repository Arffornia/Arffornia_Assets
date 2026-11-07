// Smelter, tier 4: induction carousel (r5 concept T1, process sheet smelter_induction_t1.process.md).
// Four crucibles ride an indexing turntable, a quarter turn every two seconds: under the ore hopper (north),
// between the induction coils (east), to the pour station (south) where the crucible tilts on its trunnions
// and pours into the mold, then back past the motor (west). An electric motor, fed by the energy port, turns
// the turntable through a pinion on its ring gear; the cast ingot leaves through the south port.
import { addRamp, hsh } from '../pix.mjs';
import { teeth } from '../parts.mjs';

addRamp('bs', ['#20262e', '#46505b', '#717b85', '#9da5ab', '#d4d3cc'], { streaks: 0.12, clusters: 0.015 });
addRamp('bg', ['#191d24', '#2c3440', '#434d5a', '#606b78', '#8a94a0'], { clusters: 0.03, streaks: 0.03 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.02 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { streaks: 0.03 });
addRamp('ink', ['#0c0e12', '#171a20', '#22262d', '#30353e', '#454b55'], { clusters: 0.06 });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });
addRamp('ceramic', ['#3a3633', '#625c56', '#8c847b', '#b2aa9f', '#d8d2c8'], { clusters: 0.05 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('field', ['#3a1a08', '#8a3e10', '#e07a20', '#ffb04a', '#ffe7b0'], null, { glow: true });
addRamp('led', ['#3a3f46', '#8a939c', '#d8e0e6', '#f2f6f8', '#ffffff'], null, { glow: true });

const C = [-6, 0];              // turntable centre (x, z)
const RING = 16, PIN = 4, PIN_AT = [C[0] - RING - PIN, 0];
const CR = 10, CRUC_R = 3, CRUC_Y0 = 7, CRUC_H = 6, PIV_Y = 10;
const POS = [[0, -CR], [CR, 0], [0, CR], [-CR, 0]].map(([dx, dz]) => [C[0] + dx, dz]); // N, E, S, W at bind
const STEP = -90, L = 8;        // quarter turns, one every L / 4 s

export const meta = {
  title: 'Smelter Mk (induction carousel)', note: 'Ore to ingots: crucibles index through induction coils and pour. Tier 4.', footprint: [4, 3], height: 2, tier: 4,
  ports: [
    { id: 'in', kind: 'item', face: 'up', cell: [1, 0] }, { id: 'out', kind: 'item', face: 'south', cell: [1, 0] },
    { id: 'power', kind: 'energy', face: 'north', cell: [0, 0] },
  ],
  sources: [{ bone: 'pinion', why: 'electric motor fed by the energy port (cable tray to the motor housing)' }],
  joints: {
    carousel: { type: 'revolute', axis: 'y' }, pinion: { type: 'revolute', axis: 'y' },
    crucible_1: { type: 'revolute', axis: 'x' }, crucible_2: { type: 'revolute', axis: 'z' }, crucible_3: { type: 'revolute', axis: 'x' }, crucible_4: { type: 'revolute', axis: 'z' },
    coil_arm: { type: 'revolute', axis: 'y' },
    field: { type: 'free', light: true, why: 'induction field glow: light that pulses' },
    stream: { type: 'free', why: 'molten metal stream, only while pouring' },
    ingot: { type: 'free', respawn: true, why: 'the work piece: the ingot sets in the mold, leaves by the port, the next one is cast' },
  },
  gears: [{ a: 'ring', b: 'pin', ra: RING, rb: PIN, ta: 32, tb: 8 }],
  lint: { allow: [
    { a: 'crucible_*', b: 'fork_*', check: 'overlap', why: 'the trunnions sit in the forks' },
    { a: 'coil_arm#*', b: 'pillar', check: 'overlap', why: 'the arm turns on a pin in the pillar' },
    { a: 'tank#*', b: 'tank#*', check: 'overlap', why: 'the tank stands in its saddle' },
    { a: 'coil_arm#*', b: 'pillar', check: 'sweep', why: 'the arm turns on a pin in the pillar' },
    { a: 'pin#*', b: 'pinion#*', check: 'overlap', why: 'the pinion is keyed on its shaft' },
  ] },
};
meta.fx = [{ id: 'pour_sparks', kind: 'ember', at: [C[0], 8, 14], anims: ['working'], rise: 6, spread: 6, life: 0.6, count: 8 }];
export const look = { glow: 1.4 };

const range = (n) => [...Array(n).keys()];
const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

export function build(b, { mat: plainMat }) {
  const mat = (ramp, design, o = {}) => plainMat(ramp, design, { weather: 1, ...o });

  // ---------------------------------------------------------------- materials (tier 4: brushed steel, clean enamel)
  const deck = mat('bg', {
    top(d) { d.checker(0, 0, d.w, d.h, 'bg', 8, 1, 2); for (let x = 7; x < d.w; x += 8) d.vline(x, 0, d.h, 'bg', 0); for (let y = 7; y < d.h; y += 8) d.hline(0, y, d.w, 'bg', 0); d.fill((x, y) => (x % 8 === 1 && y % 8 === 1 ? ['bs', 4] : null)); d.rings(0, 0, d.w, d.h, [['bg', 0], ['sig', 2]]); },
    side(d) { d.fill((x, y) => ['bg', y === 0 ? 4 : x % 8 === 7 ? 0 : 1]); for (let x = 3; x < d.w; x += 16) d.rect(x, 1, 4, 1, 'sig', 3); },
  });
  const housing = mat('bs', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      if (d.w > 6 && d.h > 6) { d.plate(2, 2, d.w - 4, d.h - 4, 'sig'); d.rings(3, 3, d.w - 6, d.h - 6, [['sig', 1], ['sig', 3]]); d.vent(4, d.h - 5, d.w - 8, 2, 'bg'); }
      d.px(1, 1, 'led', 3); for (const y of [1, d.h - 2]) d.px(d.w - 2, y, 'bg', 4);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'bs'); d.rivets(1, 1, d.w - 2, 'bg', { step: 3 }); },
  });
  const steel = mat('bs', { side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); for (let y = 2; y < d.h - 1; y += 4) d.bolt(1, y, 'bg'); }, top(d) { d.inset(0, 0, d.w, d.h, 'bs'); } });
  const disk = mat('bg', {
    top(d) { d.fill((x, y) => ['bg', y === 0 ? 4 : y === d.h - 1 ? 0 : (x % 6 === 0 ? 1 : 2)]); },
    side(d) { d.radial((r, a) => (r < 2 ? ['sig', 3] : r < 3 ? ['bg', 0] : r > RING - 2.5 ? ['bs', r > RING - 1.2 ? 4 : 2] : near(a, 90, 45) < 6 ? ['sig', 2] : ['bg', (r | 0) % 4 === 0 ? 1 : 2])); },
  });
  const toothMat = mat('bs', { all(d) { d.fill((x, y) => ['bs', x === 0 || y === 0 ? 4 : 2]); } }, { clean: true });
  const crucMat = mat('ceramic', {
    top(d) { d.fill((x, y) => ['ceramic', y < 1 ? 4 : y > d.h - 2 ? 1 : (x + y) % 5 === 0 ? 2 : 3]); for (const y of [2, d.h - 3]) d.hline(0, y, d.w, 'bs', 2); },
    side(d) { d.radial((r) => (r < CRUC_R - 0.9 ? ['amber', r < 1 ? 4 : 3] : ['ceramic', 4])); },
  });
  const coilMat = mat('cu', {
    all(d) { d.fill((x, y) => (y % 3 === 2 ? ['ink', 1] : ['cu', y % 3 === 0 ? 4 : 2])); d.rings(0, 0, d.w, d.h, [['bg', 0]]); },
  });
  const fieldMat = mat('field', { all(d) { d.fill((x, y) => ['field', (x + y) % 3 === 0 ? 3 : 2]); } }, { clean: true });
  const screen = mat('bs', {
    side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); if (d.w >= 8 && d.h >= 8) { d.rect(2, 2, d.w - 4, 4, 'ink', 0); for (let x = 3; x < d.w - 3; x += 2) d.px(x, 3 + (hsh(x, 1, 3) * 2 | 0), 'led', 2); d.px(2, d.h - 3, 'led', 4); d.px(4, d.h - 3, 'amber', 3); d.px(6, d.h - 3, 'led', 2); } },
    top(d) { d.inset(0, 0, d.w, d.h, 'bs'); },
  });
  const tray = mat('bg', { side(d) { d.fill((x, y) => ['bg', y === 0 ? 4 : 1]); d.hline(0, d.h - 1, d.w, 'bg', 0); }, top(d) { d.rect(0, 0, d.w, d.h, 'bg', 2); for (let x = 1; x < d.w; x += 3) d.vline(x, 0, d.h, 'cu', 2); } });
  const moldMat = mat('ink', { up(d) { d.rings(0, 0, d.w, d.h, [['bs', 3], ['ink', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'ink', 1); }, side(d) { d.fill((x, y) => ['ink', y === 0 ? 4 : 2]); } });
  const hopperMat = mat('bs', {
    side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); if (d.w > 6) { d.plate(2, 2, d.w - 4, Math.min(8, d.h - 4), 'sig'); d.hexMark(Math.floor(d.w / 2) - 4, 2 + Math.max(0, (Math.min(8, d.h - 4) - 8) >> 1)); } },
    top(d) { d.rect(0, 0, d.w, d.h, 'slag', 1); d.fill((x, y) => (hsh(x >> 1, y >> 1, 4) < 0.3 ? ['slag', 3] : hsh(x, y, 5) < 0.1 ? ['sig', 1] : null)); d.rings(0, 0, d.w, d.h, [['bs', 3]]); },
  });
  const portMat = (face) => mat('bs', {
    [face](d) { d.rings(0, 0, d.w, d.h, [['sig', 3], ['bg', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'ink', 1); d.px(2, 2, 'led', 3); },
    side(d) { d.fill((x, y) => ['sig', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); },
  });
  const cable = mat('ink', { all(d) { d.fill((x, y) => ['ink', (x + y) % 4 === 0 ? 3 : 1]); } }, { clean: true });
  const ingotMat = mat('amber', { all(d) { d.fill((x, y) => ['amber', y === 0 ? 4 : (x + y) % 4 === 0 ? 2 : 3]); } }, { clean: true });

  // ---------------------------------------------------------------- deck, motor, power
  b.box('deck', [-32, 0, -24], [32, 3, 24], deck);
  b.box('motor#1', [-31, 5.5, -6.5], [-21.5, 14, 6.5], housing);
  for (const [n, x, z] of [['a', -31, -6.5], ['b', -31, 5], ['c', -23, -6.5], ['d', -23, 5]]) b.box(`motor_leg_${n}`, [x, 3, z], [x + 1.5, 5.5, z + 1.5], steel);
  b.box('port_power', [-28, 4, -24], [-20, 12, -23], portMat('north'));
  b.box('cable_1', [-25, 3, -23], [-23, 5, -5], cable);
  b.box('cable_2', [-23, 3, -23], [16, 5, -21], cable);
  b.box('cable_3', [14, 3, -21], [16, 5, -3], cable);
  b.group('pinion', [PIN_AT[0], 3, 0], () => {
    b.prism('pin', [PIN_AT[0], 4, 0], PIN - 1, 2, 'y', disk, 8);
    teeth(b, 'pin', [PIN_AT[0], 4, 0], 'y', PIN + 1, 4, 1.8, 1.4, toothMat, { start: 5, phase: 22.5 });
    b.box('pinion#1', [PIN_AT[0] - 1, 3.2, -1], [PIN_AT[0] + 1, 6.5, 1], steel);
  });

  // ---------------------------------------------------------------- turntable with ring gear and four crucibles
  b.group('carousel', [C[0], 3, 0], () => {
    b.prism('ring', [C[0], 4, 0], RING - 1, 2, 'y', disk, 16);
    teeth(b, 'ring', [C[0], 4, 0], 'y', RING + 1, 16, 1.8, 1.4, toothMat, { start: 9, phase: 0 });
    b.prism('hub', [C[0], 7, 0], 3, 4, 'y', steel, 8);
    POS.forEach(([x, z], i) => {
      // each crucible hangs on trunnions at mid height and tilts on them; forks at both ends
      const o = [(x - C[0]) / CR, z / CR], tg = [-o[1], o[0]], P = [x + tg[0] * (CRUC_R + 0.9), PIV_Y, z + tg[1] * (CRUC_R + 0.9)]; // pivot on the fork pin
      for (const s of [-1, 1]) {
        const fx = x + s * tg[0] * (CRUC_R + 0.9), fz = z + s * tg[1] * (CRUC_R + 0.9);
        b.box(`fork_${i + 1}${s > 0 ? 'a' : 'b'}`, [fx - 0.9, 4.7, fz - 0.9], [fx + 0.9, P[1] + 0.8, fz + 0.9], steel);
      }
      b.group(`crucible_${i + 1}`, P, () => {
        b.prism(`crucible_${i + 1}`, [x, CRUC_Y0 + 0.01 + CRUC_H / 2, z], CRUC_R, CRUC_H, 'y', crucMat, 8);
        const e = CRUC_R + 1.2, w = 0.7;
        b.box(`crucible_${i + 1}#9`, [x - Math.abs(tg[0]) * e - Math.abs(tg[1]) * w, PIV_Y - 0.7, z - Math.abs(tg[1]) * e - Math.abs(tg[0]) * w], [x + Math.abs(tg[0]) * e + Math.abs(tg[1]) * w, PIV_Y + 0.7, z + Math.abs(tg[1]) * e + Math.abs(tg[0]) * w], steel);
      });
    });
  });

  // ---------------------------------------------------------------- load station (north): hopper on legs, up port
  b.box('hopper', [-10, 16, -20], [-2, 31, -6], hopperMat);
  b.box('hopper#2', [-7.5, 12.5, -11.5], [-4.5, 16, -8.5], steel);
  b.box('port_in', [-12, 31, -20], [-4, 32, -12], portMat('up'));
  for (const x of [-10.5, -4.5]) b.box(`hopper_leg_${x < -5 ? 'w' : 'e'}`, [x, 3, -21], [x + 3, 16.01, -17], steel);

  // ---------------------------------------------------------------- heat station (east): side coil, overhead coil on a swing arm
  const HX = C[0] + CR;
  b.box('coil_side#1', [HX + 5, 5.5, -5], [HX + 8, 13, 5], coilMat);
  b.box('pillar', [HX + 11.5, 3, -3], [HX + 15.5, 23, 3], housing);
  b.box('coil_side#2', [HX + 8, 3, -2], [HX + 11.5, 12, 2], steel);
  b.group('coil_arm', [HX + 11.5, 20, 0], () => {
    b.box('coil_arm#1', [HX - 0.5, 19, -2], [HX + 10, 21.5, 2], steel);
    b.prism('coil_arm#3', [HX + 11.5, 20.25, 0], 1.6, 3.5, 'y', steel, 8);
    b.box('coil_arm#2', [HX - 3.5, 15.5, -3.5], [HX + 3.5, 19, 3.5], coilMat);
    b.group('field', [HX, 15.5, 0], () => b.box('field', [HX - 2.5, 13.4, -2.5], [HX + 2.5, 15.5, 2.5], fieldMat));
  });
  b.box('cabinet', [21, 3, -10.5], [29, 18, -3.5], screen);
  // coil cooling: induction coils are water-cooled; a tank in the south-east corner, pipes to the side coil
  const tankMat = mat('bs', {
    top(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : y % 7 === 6 ? 1 : x % 9 === 0 ? 2 : 3]); for (let y = 3; y < d.h; y += 7) d.rivets(0, y, d.w, 'bg', { step: 3 }); d.rect(1, 4, 2, d.h - 8, 'ink', 0); d.fill((x, y) => (x >= 1 && x < 3 && y > d.h / 2 && y < d.h - 4 ? ['led', 1] : null)); },
    side(d) { d.radial((r, a) => (r < 1 ? ['bg', 0] : r < 2 ? ['sig', 3] : near(a, 60) < 6 ? ['bg', 4] : ['bs', 2])); },
  });
  const pipeMat = mat('cu', { all(d) { const along = d.w >= d.h; d.fill((x, y) => ['cu', (along ? x : y) % 8 === 4 ? 4 : (along ? y : x) === 0 ? 3 : 2]); } });
  b.prism('tank', [24, 12.51, 15], 5, 19, 'y', tankMat, 12);
  b.box('tank#13', [19, 3, 10], [29, 4, 20], steel);
  b.box('pipe_a#1', [HX + 6, 9, 5], [HX + 7.5, 10.5, 15], pipeMat);
  b.box('pipe_a#2', [HX + 6, 9, 13.5], [19.6, 10.5, 15], pipeMat);
  b.box('pipe_b#1', [HX + 7.5, 7, 5], [HX + 9, 8.5, 17], pipeMat);
  b.box('pipe_b#2', [HX + 7.5, 7, 15.5], [19.6, 8.5, 17], pipeMat);
  for (const z of [11, 15.5]) b.box(`pipe_stand_${z}`, [HX + 6.25, 3, z], [HX + 8.75, 7, z + 1.5], steel);
  // transformer on the north-east corner, fed by the cable tray, with ceramic bushings
  b.box('transformer', [16, 3, -22], [29, 16, -12], housing);
  for (const [i, x] of [[1, 18.5], [2, 22.5], [3, 26.5]]) {
    b.prism(`bushing_${i}`, [x, 18, -17], 1.4, 4, 'y', crucMat, 8);
    b.box(`bushing_${i}#9`, [x - 0.6, 20, -17.6], [x + 0.6, 21.5, -16.4], pipeMat);
  }


  // ---------------------------------------------------------------- pour station (south): mold tray, stream, ingot, port
  // the mold tray stands outside the ring gear and reaches over it to the pour point
  const SX = C[0], MZ = 16.5, TY = 6.5, MY = TY + 1.5;
  b.box('mold_tray', [SX - 6, TY - 1.5, MZ - 3], [SX + 4, TY, 23], tray);
  for (const x of [SX - 6, SX + 2]) b.box(`tray_leg_${x < SX ? 'w' : 'e'}`, [x, 3, 19], [x + 2, TY - 1.5, 21], steel);
  b.box('mold#1', [SX - 4.5, TY, MZ - 2.5], [SX + 2.5, MY, MZ - 1.5], moldMat);
  b.box('mold#2', [SX + 1.5, TY, MZ - 1.5], [SX + 2.5, MY, MZ + 2.5], moldMat);
  b.box('mold#3', [SX - 4.5, TY, MZ - 1.5], [SX - 3.5, MY, MZ + 1.5], moldMat);
  b.box('port_out', [-12, 4, 23], [-4, 12, 24], portMat('south'));
  // the stream is a stub at rest (bind pose) and stretches up to the lip while pouring
  b.group('stream', [SX, MY, MZ - 1.75], () => b.box('stream', [SX - 0.75, MY, MZ - 2.5], [SX + 0.75, MY + 0.1, MZ - 1], ingotMat));
  b.group('ingot', [SX - 1, TY + 0.01, MZ], () => b.box('ingot', [SX - 3.5, TY + 0.01, MZ - 1.5], [SX + 1.5, MY - 0.1, MZ + 1.5], ingotMat));

  // ---------------------------------------------------------------- animation
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const SEG = L / 4, MOVE = 0.6;
  const turnAt = (t) => { const k = Math.floor(t / SEG), u = Math.min(1, (t - k * SEG) / MOVE); return STEP * (k + ease(u)); };
  const samples = range(L * 20 + 1).map((q) => q / 20);
  const carousel = { rotation: samples.map((t) => [t, [0, t >= L ? STEP * 4 : turnAt(t), 0]]) };
  const pinion = { rotation: samples.map((t) => [t, [0, -(RING / PIN) * (t >= L ? STEP * 4 : turnAt(t)), 0]]) };
  // which crucible sits at the pour station (south, +z) during dwell k: rotate the bind positions by k steps
  const rotY = ([x, z], deg) => { const a = (deg * Math.PI) / 180, dx = x - C[0]; return [C[0] + dx * Math.cos(a) + z * Math.sin(a), -dx * Math.sin(a) + z * Math.cos(a)]; };
  const atSouth = (k) => POS.findIndex((p) => { const [x, z] = rotY(p, STEP * k); return Math.abs(x - C[0]) < 0.5 && z > 0; });
  // tilt outward: bind north/south crucibles tilt about x, east/west about z; sign so the lip goes to the outside
  const tiltSign = (i) => (i === 0 ? -1 : i === 1 ? -1 : i === 2 ? 1 : 1);
  const crucibles = Object.fromEntries(POS.map((_, i) => [`crucible_${i + 1}`, { rotation: [[0, [0, 0, 0]], [L, [0, 0, 0]]] }]));
  const TILT = 65;
  for (let k = 0; k < 4; k++) {
    const i = atSouth(k + 1); if (i < 0) continue;
    const t0 = k * SEG + MOVE + 0.15, ax = i % 2 === 0 ? 0 : 2, v = (deg) => { const r = [0, 0, 0]; r[ax] = deg * tiltSign(i); return r; };
    crucibles[`crucible_${i + 1}`].rotation.push([t0, v(0)], [t0 + 0.35, v(TILT)], [t0 + 0.75, v(TILT)], [t0 + 1.1, v(0)]);
  }
  for (const c of Object.values(crucibles)) c.rotation.sort((a, z) => a[0] - z[0]);
  const off = [0.02, 0.02, 0.02], on = [1, 1, 1];
  const SON = [1, (10.5 - MY) / 0.1, 1], SOFF = [1, 1, 1];
  const stream = { scale: [[0, SOFF]] }, ingot = { scale: [[0, off]], position: [[0, [0, 0, 0]]] };
  for (let k = 0; k < 4; k++) {
    const t0 = k * SEG + MOVE + 0.15;
    stream.scale.push([t0 + 0.3, SOFF], [t0 + 0.4, SON], [t0 + 0.75, SON], [t0 + 0.85, SOFF]);
    ingot.scale.push([t0 + 0.35, [1, 0.05, 1]], [t0 + 0.8, on], [t0 + 1.35, on], [t0 + 1.4, off]);
    ingot.position.push([t0 + 1.0, [0, 0, 0]], [t0 + 1.35, [0, 0, 4.5]], [t0 + 1.41, [0, 0, 0]]);
  }
  stream.scale.push([L, SOFF]); ingot.scale.push([L, off]); ingot.position.push([L, [0, 0, 0]]);
  for (const tr of [stream.scale, ingot.scale, ingot.position]) tr.sort((a, z) => a[0] - z[0]);
  const field = { scale: samples.filter((_, q) => q % 4 === 0).map((t) => [t, t === 0 || t >= L ? on : [1, 0.7 + 0.5 * Math.abs(Math.sin(t * 9)), 1]]) };
  b.anim('working', L, { carousel, pinion, ...crucibles, stream, ingot, field });

  // packaged: coil arm swung out over the deck edge, no field; deploy swings it in over the heat station
  const D = 4, ARM = -90; // the arm swings out over the north deck
  b.anim('packaged', 0.5, { coil_arm: { rotation: [[0, [0, ARM, 0]]] }, field: { scale: [[0, off]] }, ingot: { scale: [[0, off]] } });
  b.anims[b.anims.length - 1].loop = 'hold';
  b.anim('deploy', D, {
    coil_arm: { rotation: range(21).map((q) => [+(0.4 + 2.4 * q / 20).toFixed(3), [0, ARM * (1 - ease(q / 20)), 0]]).concat([[0, [0, ARM, 0]], [D, [0, 0, 0]]]).sort((a, z) => a[0] - z[0]) },
    field: { scale: [[0, off], [3.0, off], [3.4, on], [D, on]] }, ingot: { scale: [[0, off], [3.6, off], [D, on]] },
  });
  b.anims[b.anims.length - 1].loop = 'hold';
}
