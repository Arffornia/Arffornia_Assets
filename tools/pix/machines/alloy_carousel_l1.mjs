// Alloy furnace, tier 2: crucible carousel (r5 concept L1, process sheet alloy_carousel_l1.process.md).
// A vertical shaft from the power port on top of the corner tower turns a pinion on the turntable's ring gear;
// the table indexes a quarter turn every two seconds. Each crucible takes copper ore under the north hopper,
// tin ore under the east hopper, melts under the coal-fired brick hood (south), then tilts on its trunnions at
// the west station and pours the bronze into the mold; the ingot leaves by the west port.
import { addRamp, hsh } from '../pix.mjs';
import { teeth } from '../parts.mjs';

addRamp('gun', ['#16130f', '#27221d', '#39332c', '#524a41', '#736a5c'], { clusters: 0.035, streaks: 0.05, chips: 0.1, grime: 0.5 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.03, chips: 0.12, grime: 0.5 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { clusters: 0.05, streaks: 0.04, chips: 0.1 });
addRamp('tin', ['#25282c', '#4a5057', '#757d86', '#a2a9b0', '#d0d5da'], { clusters: 0.06 });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });
addRamp('brickish', ['#24120c', '#4a2216', '#6e3220', '#8e472c', '#b0623e']);
addRamp('ceramic', ['#3a3633', '#625c56', '#8c847b', '#b2aa9f', '#d8d2c8'], { clusters: 0.05 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('bronze', ['#4a2a06', '#8a5612', '#d08a22', '#f2b84a', '#fff0b0'], null, { glow: true });

const RING_T = 32, PIN_T = 8, PITCH = 3.555, RING = (RING_T * PITCH) / (2 * Math.PI), PIN = (PIN_T * PITCH) / (2 * Math.PI);
const PIN_AT = [16, -16]; // under the power tower, at RING + PIN from the centre (22.63)
const CR = 10, CRUC_R = 3, CRUC_Y0 = 7, CRUC_H = 6, PIV_Y = 10;
const POS = [[0, -CR], [CR, 0], [0, CR], [-CR, 0]]; // N, E, S, W at bind
const STEP = 90, L = 8;

export const meta = {
  title: 'Alloy furnace (crucible carousel)', note: 'Copper and tin to bronze: crucibles index under two hoppers, a coal hood, and pour. Tier 2.', footprint: [3, 3], height: 2, tier: 2,
  ports: [
    { id: 'in_a', kind: 'item', face: 'up', cell: [1, 0] }, { id: 'in_b', kind: 'item', face: 'up', cell: [2, 1] },
    { id: 'fuel', kind: 'item', face: 'south', cell: [1, 0] }, { id: 'out', kind: 'item', face: 'west', cell: [1, 0] },
    { id: 'power', kind: 'rotation', face: 'up', cell: [2, 0], bone: 'pinion' },
  ],
  joints: {
    carousel: { type: 'revolute', axis: 'y' }, pinion: { type: 'revolute', axis: 'y' },
    crucible_1: { type: 'revolute', axis: 'x' }, crucible_2: { type: 'revolute', axis: 'z' }, crucible_3: { type: 'revolute', axis: 'x' }, crucible_4: { type: 'revolute', axis: 'z' },
    hood_door: { type: 'prismatic', axis: 'y', min: 0, max: 6 },
    flames: { type: 'free', light: true, why: 'flames under the hood: light that flickers' },
    stream: { type: 'free', why: 'molten bronze stream, only while pouring' },
    ingot: { type: 'free', respawn: true, why: 'the work piece: the ingot sets in the mold, leaves by the port, the next one is cast' },
  },
  gears: [{ a: 'ring', b: 'pin', ra: RING, rb: PIN, ta: RING_T, tb: PIN_T }],
  lint: { allow: [
    { a: 'pinion#*', b: 'tower#*', check: 'overlap', why: 'the shaft runs in the tower bearings' },
    { a: 'crucible_*', b: 'fork_*', check: 'overlap', why: 'the trunnions sit in the forks' },
  ] },
};
meta.fx = [
  { id: 'hood_smoke', kind: 'smoke', at: [0, 31, 15], anims: ['working'], rise: 30, spread: 3, drift: 4, size: 1 },
  { id: 'pour_sparks', kind: 'ember', at: [-15, 8, 0], anims: ['working'], rise: 6, spread: 6, life: 0.6, count: 8 },
];
export const look = { glow: 1.3 };

const range = (n) => [...Array(n).keys()];
const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

export function build(b, { mat: plainMat }) {
  const mat = (ramp, design, o = {}) => plainMat(ramp, design, { weather: 1, ...o });

  // ---------------------------------------------------------------- materials (tier 2: riveted anthracite, chipped orange)
  const capStripes = (d) => d.stripes(1, d.h - 3, d.w - 2, 2, ['gun', 0], ['sig', 3]);
  const deck = mat('gun', {
    top(d) { d.fill((x, y) => { const i = x % 4, j = y % 4, off = ((x >> 2) + (y >> 2)) & 1; return (off ? i === j : i === 3 - j) ? ['gun', 3] : (off ? i === j + 1 : i === 2 - j) ? ['gun', 0] : null; }); for (let x = 15; x < d.w; x += 16) d.vline(x, 0, d.h, 'gun', 0); d.rings(0, 0, d.w, d.h, [['gun', 0], ['sig', 2]]); },
    side(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 6 === 5 ? 0 : 1]); for (let x = 9; x < d.w; x += 16) d.rect(x, 0, 3, 2, 'sig', 3); },
  });
  const frame = mat('gun', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]); for (let y = 3; y < d.h - 2; y += 5) d.bolt(1, y, 'gun');
      if (d.h > 14 && d.w >= 6) { d.plate(2, 3, d.w - 4, d.h - 10, 'sig'); d.brokenRings(3, 4, d.w - 6, d.h - 12, [[0, 'sig', 1], [2, 'sig', 3]], { breaks: 0.35 }); d.stripes(1, d.h - 6, d.w - 2, 3, ['gun', 0], ['sig', 3]); }
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.rivets(1, 1, d.w - 2, 'gun', { step: 3 }); },
  });
  const disk = mat('gun', {
    top(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : y === d.h - 1 ? 0 : (x % 6 === 0 ? 1 : 2)]); },
    side(d) { d.radial((r, a) => (r < 2 ? ['cu', 4] : r < 3 ? ['gun', 0] : r > RING - 2.5 ? ['gun', r > RING - 1.2 ? 4 : 3] : near(a, 90, 45) < 6 ? ['sig', 2] : ['gun', (r | 0) % 4 === 0 ? 1 : 2])); },
  });
  const toothMat = mat('gun', { all(d) { d.fill((x, y) => ['gun', x === 0 || y === 0 ? 4 : 2]); } }, { clean: true });
  const crucMat = mat('ceramic', {
    top(d) { d.fill((x, y) => ['ceramic', y < 1 ? 4 : y > d.h - 2 ? 1 : (x + y) % 5 === 0 ? 2 : 3]); for (const y of [2, d.h - 3]) d.hline(0, y, d.w, 'gun', 2); d.fill((x, y) => (y > d.h - 3 && hsh(x, y, 3) < 0.4 ? ['slag', 2] : null)); },
    side(d) { d.radial((r) => (r < CRUC_R - 0.9 ? ['bronze', r < 1 ? 4 : 3] : ['ceramic', 4])); },
  });
  const brick = mat('brickish', {
    all(d) { d.courses(0, 0, d.w, d.h, 'brickish', 3, 6); d.rect(0, 0, d.w, 1, 'gun', 3); d.fill((x, y) => { const row = (y / 3) | 0, xx = x + (row & 1 ? 3 : 0), h = hsh((xx / 6) | 0, row, d.seed); if (y % 3 === 2 || xx % 6 === 5) return null; return h < 0.12 ? ['slag', 2] : h > 0.9 ? ['brickish', 4] : null; }); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); capStripes(d); },
  });
  const hopperMat = (ore) => mat('gun', {
    side(d) { d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]); if (d.w > 6 && d.h > 6) { d.plate(2, 2, d.w - 4, d.h - 4, 'sig'); d.brokenRings(3, 3, d.w - 6, d.h - 6, [[0, 'sig', 1], [2, 'sig', 3]], { breaks: 0.3 }); } },
    top(d) { d.rect(0, 0, d.w, d.h, 'slag', 1); d.fill((x, y) => { const h = hsh(x >> 1, y >> 1, 4); return h < 0.35 ? [ore, h < 0.15 ? 4 : 3] : h < 0.55 ? [ore, 1] : null; }); d.rings(0, 0, d.w, d.h, [['gun', 3]]); },
  });
  const portMat = (face) => mat('gun', {
    [face](d) { d.rings(0, 0, d.w, d.h, [['cu', 3], ['gun', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'slag', 1); d.hline(2, 2, d.w - 4, 'slag', 0); },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); },
  });
  const shaftMat = mat('gun', { top(d) { d.fill((x, y) => ['gun', x === 0 ? 4 : y % 4 === 0 ? 1 : 2]); }, side(d) { d.radial((r, a) => (r < 0.6 ? ['cu', 4] : near(a, 90) < 15 ? ['gun', 4] : ['gun', 2])); } }, { clean: true });
  const fireMat = mat('amber', { all(d) { d.fill((x, y) => { const t = (d.h - 1 - y) / Math.max(1, d.h - 1); return ['amber', t < 0.3 ? 4 : t < 0.65 ? (hsh(x, y >> 1, 3) < 0.5 ? 4 : 3) : (hsh(x, y, 4) < 0.5 ? 2 : 1)]; }); } }, { clean: true });
  const doorMat = mat('sig', { all(d) { d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]); if (d.w > 4 && d.h > 3) { d.rect(1, 1, d.w - 2, d.h - 2, 'sig', 2); d.hline(1, 1, d.w - 2, 'sig', 4); d.rivets(1, d.h - 2, d.w - 2, 'gun', { step: 2 }); } } });
  const tray = mat('gun', { side(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : 1]); d.hline(0, d.h - 1, d.w, 'gun', 0); }, top(d) { d.rect(0, 0, d.w, d.h, 'gun', 2); for (let x = 1; x < d.w; x += 3) d.vline(x, 0, d.h, 'cu', 2); } });
  const moldMat = mat('slag', { all(d) { d.fill((x, y) => ['slag', y === 0 ? 4 : 2]); d.rings(0, 0, d.w, d.h, [['gun', 3]]); } });
  const metal = mat('bronze', { all(d) { d.fill((x, y) => ['bronze', y === 0 ? 4 : (x + y) % 4 === 0 ? 2 : 3]); } }, { clean: true });

  // ---------------------------------------------------------------- deck and power tower (vertical shaft from the up port)
  b.box('deck', [-24, 0, -24], [24, 3, 24], deck);
  // three legs outside the ring gear's reach, a frame on top carrying the port and the shaft bearings
  b.box('tower#1', [11, 3, -22], [13, 30, -20], frame);
  b.box('tower#2', [19.5, 3, -22], [21.5, 30, -20], frame);
  b.box('tower#3', [19.5, 3, -12.5], [21.5, 30, -10.5], frame);
  b.box('tower#5', [11.5, 27, -20.5], [20.5, 30, -11.5], frame);
  b.box('tower#6', [11.5, 12, -20.5], [20.5, 14, -11.5], frame);
  b.box('port_power', [12, 30, -20], [20, 32, -12], portMat('up'));
  b.group('pinion', [PIN_AT[0], 3, PIN_AT[1]], () => {
    b.prism('pinion', [PIN_AT[0], 18, PIN_AT[1]], 1.2, 26, 'y', shaftMat, 8);
    b.prism('pin', [PIN_AT[0], 4, PIN_AT[1]], PIN - 1, 2, 'y', disk, 8);
    teeth(b, 'pin', [PIN_AT[0], 4, PIN_AT[1]], 'y', PIN + 1, PIN_T / 2, 1.8, 1.4, toothMat, { start: 5, phase: 22.5 }); // gap toward the ring (225°)
  });

  // ---------------------------------------------------------------- turntable with ring gear and four crucibles
  // ring tooth on the line to the pinion (angle 45°), pinion gap toward the ring
  const lineDeg = (Math.atan2(16, 16) * 180) / Math.PI; // direction (x, -z) used by the teeth helper about y
  b.group('carousel', [0, 3, 0], () => {
    b.prism('ring', [0, 4, 0], RING - 1, 2, 'y', disk, 16);
    teeth(b, 'ring', [0, 4, 0], 'y', RING + 1, RING_T / 2, 1.8, 1.4, toothMat, { start: 9, phase: lineDeg });
    b.prism('hub', [0, 7, 0], 3, 4, 'y', frame, 8);
    POS.forEach(([x, z], i) => {
      const o = [x / CR, z / CR], tg = [-o[1], o[0]], P = [x + tg[0] * (CRUC_R + 0.9), PIV_Y, z + tg[1] * (CRUC_R + 0.9)];
      for (const s of [-1, 1]) {
        const fx = x + s * tg[0] * (CRUC_R + 0.9), fz = z + s * tg[1] * (CRUC_R + 0.9);
        b.box(`fork_${i + 1}${s > 0 ? 'a' : 'b'}`, [fx - 1, 4.7, fz - 1], [fx + 1, PIV_Y + 0.8, fz + 1], frame);
      }
      b.group(`crucible_${i + 1}`, P, () => {
        b.prism(`crucible_${i + 1}`, [x, CRUC_Y0 + 0.01 + CRUC_H / 2, z], CRUC_R, CRUC_H, 'y', crucMat, 8);
        const e = CRUC_R + 1.2, w = 0.8;
        b.box(`crucible_${i + 1}#9`, [x - Math.abs(tg[0]) * e - Math.abs(tg[1]) * w, PIV_Y - 1, z - Math.abs(tg[1]) * e - Math.abs(tg[0]) * w], [x + Math.abs(tg[0]) * e + Math.abs(tg[1]) * w, PIV_Y + 1, z + Math.abs(tg[1]) * e + Math.abs(tg[0]) * w], frame);
      });
    });
  });

  // ---------------------------------------------------------------- ore hoppers: copper (north), tin (east), on legs outside the table
  b.box('hopper_a', [-4, 17, -20], [4, 31, -7], hopperMat('cu'));
  b.box('hopper_a#2', [-1.5, 14, -11.5], [1.5, 17, -8.5], frame);
  b.box('port_in_a', [-4, 31, -20], [4, 32, -12], portMat('up'));
  b.box('hopper_a_beam', [-4.5, 15, -21.5], [4.5, 17, -15.5], frame);
  for (const x of [-4.5, 1.5]) b.box(`hopper_a_leg_${x < 0 ? 'w' : 'e'}`, [x, 3, -21.5], [x + 3, 15.01, -18.5], frame);
  b.box('hopper_b', [7, 17, -4], [20, 31, 4], hopperMat('tin'));
  b.box('hopper_b#2', [8.5, 14, -1.5], [11.5, 17, 1.5], frame);
  b.box('port_in_b', [12, 31, -4], [20, 32, 4], portMat('up'));
  b.box('hopper_b_beam', [15.5, 15, -4.5], [21.5, 17, 4.5], frame);
  for (const z of [-4.5, 1.5]) b.box(`hopper_b_leg_${z < 0 ? 'n' : 's'}`, [18.5, 3, z], [21.5, 15.01, z + 3], frame);

  // ---------------------------------------------------------------- coal hood (south): brick shell over the station, fire, coal port
  b.box('hood#1', [-7, 5.5, 15.5], [7, 24, 22], brick);
  b.box('hood#6', [-7, 3, 19.8], [7, 5.5, 22], brick);
  b.box('hood#2', [-7, 14, 4], [-5, 24, 15.5], brick);
  b.box('hood#3', [5, 14, 4], [7, 24, 15.5], brick);
  b.box('hood#4', [-7, 24, 4], [7, 27, 22], brick);
  b.box('hood#5', [-2, 27, 13], [2, 31, 17], brick);
  // burners in the hood's side walls throw their flames over the crucible
  b.group('flames', [0, 13.5, 10], () => b.box('flames', [-5, 13.5, 6], [5, 15.5, 14], fireMat));
  b.group('hood_door', [0, 14, 4], () => b.box('hood_door', [-5, 14, 3.5], [5, 24, 4.5], doorMat));
  b.box('port_fuel', [-4, 4, 23], [4, 12, 24], portMat('south'));
  b.box('coal_box', [-5, 3, 22], [5, 10, 23], hopperMat('slag'));

  // ---------------------------------------------------------------- pour station (west): mold tray over the ring edge, port
  const MX = -16.5, TY = 6.5, MY = TY + 1.5;
  b.box('mold_tray', [-23, TY - 1.5, -6], [MX + 3, TY, 4], tray);
  for (const z of [-6, 2]) b.box(`tray_leg_${z < 0 ? 'n' : 's'}`, [-22, 3, z], [-20, TY - 1.5, z + 2], frame);
  b.box('mold#1', [MX - 2.5, TY, -4.5], [MX + 2.5, MY, -3.5], moldMat);
  b.box('mold#2', [MX - 2.5, TY, 1.5], [MX + 2.5, MY, 2.5], moldMat);
  b.box('mold#3', [MX + 1.5, TY, -3.5], [MX + 2.5, MY, 1.5], moldMat);
  b.box('port_out', [-24, 4, -4], [-23, 12, 4], portMat('west'));
  b.group('stream', [MX + 1.75, MY, -1], () => b.box('stream', [MX + 1, MY, -1.75], [MX + 2.5, MY + 0.1, -0.25], metal));
  b.group('ingot', [MX, TY + 0.01, -1], () => b.box('ingot', [MX - 2, TY + 0.01, -3.4], [MX + 1.4, MY - 0.1, 1.4], metal));

  // ---------------------------------------------------------------- animation
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const SEG = L / 4, MOVE = 0.6;
  const turnAt = (t) => { const k = Math.floor(t / SEG), u = Math.min(1, (t - k * SEG) / MOVE); return STEP * (k + ease(u)); };
  const samples = range(L * 20 + 1).map((q) => q / 20);
  const carousel = { rotation: samples.map((t) => [t, [0, t >= L ? STEP * 4 : turnAt(t), 0]]) };
  const pinion = { rotation: samples.map((t) => [t, [0, -(RING_T / PIN_T) * (t >= L ? STEP * 4 : turnAt(t)), 0]]) };
  const rotY = ([x, z], deg) => { const a = (deg * Math.PI) / 180; return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; };
  const atWest = (k) => POS.findIndex((p) => { const [x, z] = rotY(p, STEP * k); return x < -1 && Math.abs(z) < 0.5; });
  // outward tilt: N (-z) about x negative, E (+x) about z negative, S (+z) about x positive, W (-x) about z positive
  const tiltSign = [-1, -1, 1, 1];
  const crucibles = Object.fromEntries(POS.map((_, i) => [`crucible_${i + 1}`, { rotation: [[0, [0, 0, 0]], [L, [0, 0, 0]]] }]));
  const TILT = 65;
  for (let k = 0; k < 4; k++) {
    const i = atWest(k + 1); if (i < 0) continue;
    const t0 = k * SEG + MOVE + 0.15, ax = i % 2 === 0 ? 0 : 2, v = (deg) => { const r = [0, 0, 0]; r[ax] = deg * tiltSign[i]; return r; };
    crucibles[`crucible_${i + 1}`].rotation.push([t0, v(0)], [t0 + 0.35, v(TILT)], [t0 + 0.75, v(TILT)], [t0 + 1.1, v(0)]);
  }
  for (const c of Object.values(crucibles)) c.rotation.sort((a, z) => a[0] - z[0]);
  const off = [0.02, 0.02, 0.02], on = [1, 1, 1], SON = [1, (11 - MY) / 0.1, 1];
  const stream = { scale: [[0, on]] }, ingot = { scale: [[0, off]], position: [[0, [0, 0, 0]]] };
  const door = { position: [[0, [0, 0, 0]]] };
  for (let k = 0; k < 4; k++) {
    const t0 = k * SEG + MOVE + 0.15;
    stream.scale.push([t0 + 0.3, on], [t0 + 0.4, SON], [t0 + 0.75, SON], [t0 + 0.85, on]);
    ingot.scale.push([t0 + 0.35, [1, 0.05, 1]], [t0 + 0.8, on], [t0 + 1.35, on], [t0 + 1.4, off]);
    ingot.position.push([t0 + 1.0, [0, 0, 0]], [t0 + 1.35, [-4, 0, 0]], [t0 + 1.41, [0, 0, 0]]);
    // the hood door lifts while the table turns and closes for the melt
    door.position.push([k * SEG, [0, 0, 0]], [k * SEG + 0.15, [0, 6, 0]], [k * SEG + MOVE, [0, 6, 0]], [k * SEG + MOVE + 0.25, [0, 0, 0]]);
  }
  stream.scale.push([L, on]); ingot.scale.push([L, off]); ingot.position.push([L, [0, 0, 0]]); door.position.push([L, [0, 0, 0]]);
  for (const tr of [stream.scale, ingot.scale, ingot.position, door.position]) tr.sort((a, z) => a[0] - z[0]);
  const flames = { scale: samples.filter((_, q) => q % 4 === 0).map((t) => [t, t === 0 || t >= L ? on : [1, 0.7 + 0.6 * hsh(Math.round(t * 5), 1, 9), 1]]) };
  b.anim('working', L, { carousel, pinion, ...crucibles, stream, ingot, hood_door: door, flames });

  // packaged: hood door down, fire out, no ingot; deploy lights the fire and casts the first ingot
  const D = 4;
  const fOff = [1, 0.05, 1]; // the burners stay touching the walls
  b.anim('packaged', 0.5, { flames: { scale: [[0, fOff]] }, ingot: { scale: [[0, off]] } });
  b.anims[b.anims.length - 1].loop = 'hold';
  b.anim('deploy', D, { flames: { scale: [[0, fOff], [1.5, fOff], [2.5, on], [D, on]] }, ingot: { scale: [[0, off], [3.2, off], [D, on]] } });
  b.anims[b.anims.length - 1].loop = 'hold';
}
