// Smelter mark 1, tier 0: a medieval bloomery (lineage `rethink`: bloomery -> blast furnace -> arc furnace).
// In: ore and charcoal, charged through the hatch in the shaft (west). Out: the bloom, raked from the tap arch
// into the stone runnel and the ingot pit (south). What happens: an overshot water wheel turns a shaft; a
// two-lobe cam on it lifts a tappet rod that raises the weighted top board of a leather bellows, then lets it
// drop: each drop blasts air through the iron tuyere into the shaft and the fire flares at the tap hole.
import { addRamp, hsh } from '../pix.mjs';
import { teeth } from '../parts.mjs';
import { masonry, planks, endGrain, wicker, clayDaub, cracks, strap, rim, radial, camSupport } from '../medieval.mjs';

// family ramps (shared values with the smelter kiln marks)
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.03, chips: 0.12, grime: 0.5 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { clusters: 0.05, streaks: 0.04, chips: 0.1 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
// tier 0 materials: warm field stone, ochre clay, oak, dark wrought iron, oxblood leather, river water
addRamp('stone', ['#1e1b19', '#3b3632', '#5a524b', '#7a7067', '#a0958a'], { clusters: 0.06, grime: 0.5 });
addRamp('clay', ['#2b130b', '#5a2a17', '#874427', '#ad6239', '#cf8a58'], { clusters: 0.05, chips: 0.08, grime: 0.4 });
addRamp('oak', ['#1d130b', '#3b2716', '#5b3e23', '#7c5631', '#a17643'], { streaks: 0.05, chips: 0.1, grime: 0.5 });
addRamp('wet', ['#16110d', '#2b231c', '#43382c', '#5c4e3d', '#7d6b53'], { streaks: 0.06, clusters: 0.03 });
addRamp('wi', ['#121214', '#26262a', '#3c3c41', '#58585e', '#83838a'], { clusters: 0.04, streaks: 0.05, chips: 0.08 });
addRamp('hide', ['#170d08', '#2e1d15', '#4a2f22', '#674431', '#8d6346']);
addRamp('straw', ['#2a1c0e', '#4e371d', '#74552d', '#98743f', '#c19c5d']);
addRamp('char', ['#0a0a0b', '#161618', '#232326', '#33333a', '#4c4c55']);
addRamp('water', ['#0d1a22', '#173244', '#225168', '#33789a', '#7db8d2']);
addRamp('ore', ['#1f0f0a', '#4a2014', '#73341d', '#9b4e2c', '#c27448']);

// wheel and cam shaft: along x at (y 20, z 6); the overshot wheel stands on the west edge
const AXY = 20, AXZ = 6, WX = -20.5;
// cam: a two-lobe bar on a hexagonal hub, overhung on the shaft end; the tappet rests on its outline
const HUB_R = 2.5, LOBE = 5.2, LOBE_W = 1.6, CAM_X = [-11, -8];
const CAM = [[0, 0, LOBE_W, LOBE, 0], ...[0, 1, 2].map((i) => [0, 0, HUB_R, HUB_R * Math.tan(Math.PI / 6), i * 60])];
const REST = camSupport(CAM, 0);
const lift = (deg) => camSupport(CAM, deg) - REST;
// bellows: lies along z, nozzle north into the furnace; boards hinge on the head at z = -3, the rod lifts
// the top board at z = 6 (over the shaft line)
// at rest the bellows is a wedge (each of the 3 folds tilted FOLD0 deg); the rod sits on the board top at ROD_Z
const HINGE_Z = -3, ROD_Z = AXZ, FOLD0 = 4, ARM = ROD_Z - HINGE_Z, RAD = Math.PI / 180;
// the board top's height at z = ROD_Z when each fold is turned by `fold` deg (the three hinges are nested:
// fold_a at y 8.5 carries fold_b at 10.5, which carries the board at 12.5, all on the head at z = HINGE_Z)
const turn = ([y, z], [py, pz], deg) => { const a = -deg * RAD, c = Math.cos(a), s = Math.sin(a), dy = y - py, dz = z - pz; return [py + dy * c - dz * s, pz + dy * s + dz * c]; };
const boardTopAt = (fold) => {
  const [p, q] = [[14, HINGE_Z], [14, 8.5]].map((pt) => [12.5, 10.5, 8.5].reduce((acc, py) => turn(acc, [py, HINGE_Z], fold), pt));
  return p[0] + ((ROD_Z - p[1]) / (q[1] - p[1])) * (q[0] - p[0]);
};
const ROD_BASE = boardTopAt(FOLD0);
// extra turn per fold that raises the board top under the rod by the cam lift
const boardAngle = (deg) => {
  const want = ROD_BASE + lift(deg); let lo = FOLD0, hi = FOLD0 + 20;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (boardTopAt(m) < want) lo = m; else hi = m; }
  return 3 * (lo - FOLD0);
};
const MAX_LIFT = Math.max(...Array.from({ length: 361 }, (_, a) => lift(a)));

export const meta = {
  title: 'Smelter (bloomery)', note: 'Ore to iron blooms in a water-blown shaft furnace. Tier 0, mark 1.',
  footprint: [3, 3], height: 3, tier: 0,
  ports: [{ id: 'in', kind: 'item', face: 'north', cell: [1, 1] }, { id: 'out', kind: 'item', face: 'east', cell: [0, 0] }],
  joints: {
    wheel: { type: 'revolute', axis: 'x' },
    lifter: { type: 'prismatic', axis: 'y', min: 0, max: +MAX_LIFT.toFixed(2) },
    fold_a: { type: 'revolute', axis: 'x', min: 0, max: 10 },
    fold_b: { type: 'revolute', axis: 'x', min: 0, max: 10 },
    board: { type: 'revolute', axis: 'x', min: 0, max: 10 },
    flame: { type: 'free', why: 'fire tongue at the tap hole: flickers in size, light only' },
    flame_top: { type: 'free', why: 'flames over the charge: flicker in size, light only' },
  },
  lint: { allow: [
    { a: 'wheel*', b: 'wheel*', check: 'overlap', why: 'shaft, cam, hub, spokes, rim and paddles are one pegged timber assembly' },
    { a: 'board', b: 'pleat#*', check: 'overlap', why: 'the hide is nailed up under the top board' },
  ] },
};
export const look = { glow: 1.4 };

export function build(b, { mat }) {
  // ---------------------------------------------------------------- materials
  // yard: flagstones, charcoal dust by the baskets, a slag spill by the runnel, the tail race under the wheel
  const yard = mat('stone', {
    up(d) {
      masonry(d, 'stone', { ch: 7, min: 7, max: 13, crack: 0.3, seed: 3 });
      // tail race under the wheel: wet timber banks round running water (x -24..-17, z -13..24)
      d.fill((x, y) => (x <= 7 && y >= 11 ? (x === 7 || y === 11 ? ['wet', (x + y) % 4 === 0 ? 0 : 3] : ['water', (x + y * 3) % 7 === 0 ? 4 : (y + (x & 1)) % 5 === 0 ? 3 : 2]) : null));
      // charcoal dust round the baskets, dithered out
      for (const [cx, cy, rr] of [[36, 21, 7], [34, 42, 6], [27, 39, 5]]) d.fill((x, y) => { const r = Math.hypot(x - cx, y - cy); return r < rr && ((x + y) & 1) === 0 && r < rr * (0.6 + 0.4 * ((x * 7 + y * 3) % 5) / 5) ? ['char', 2] : null; });
      // slag drips along the runnel
      for (const [x, y] of [[31, 12], [36, 13], [41, 12], [44, 4]]) { d.px(x, y, 'char', 3); d.px(x + 1, y, 'char', 1); d.px(x, y + 1, 'amber', 1); }
    },
  }, { clean: true });

  // furnace footing: big rough field stones; hearth: coursed stone with daubed (house colour) patches
  // footing: rough boulders bedded in clay, soot splashed up from the yard
  const footing = mat('stone', {
    side(d) { masonry(d, 'stone', { ch: 3, min: 3, max: 8, crack: 0.3, mortar: ['clay', 1], alt: ['stone', 0.2], lip: true, seed: 1 }); d.fill((x, y) => (y === d.h - 1 && (x * 3) % 5 === 0 ? ['char', 2] : null)); },
    top(d) { masonry(d, 'stone', { ch: 5, min: 5, max: 9 }); },
  }, { clean: true });
  const hearth = mat('stone', {
    side(d) { masonry(d, 'stone', { ch: 4, min: 4, max: 8, alt: ['sig', 0.18], lip: true }); },
    east(d) {
      // firelight on the stones round the tap arch (u 3..11)
      d.fill((x, y) => (y > 4 && ((x + y) & 1) && Math.abs(x - 7) + (d.h - y) * 0.6 < 9 ? ['clay', 4] : null));
    },
    south(d) { d.fill((x, y) => (Math.hypot(x - 16, y - 8) < 4.5 && ((x + y) & 1) ? ['char', 1] : null)); },
  }, { clean: true });
  // cap course: long slabs with a lit lip, iron cramps across the joints; on top, soot round the shaft
  const ledge = mat('stone', {
    side(d) { d.fill((x, y) => ['stone', y === 0 ? ((x + 3) % 9 === 0 ? 1 : 4) : (x + 3) % 9 === 0 ? 0 : 2]); for (let x = 1; x < d.w - 2; x += 9) { d.px(x + 2, 1, 'wi', 3); d.px(x + 3, 1, 'wi', 1); } },
    up(d) {
      masonry(d, 'stone', { ch: 6, min: 6, max: 11, crack: 0.15, seed: 2 });
      d.fill((x, y) => { const e = Math.min(x - 3, d.w - 4 - x, y - 3, d.h - 4 - y); return e >= -1 && e < 1 ? ['char', (x + y) & 1 ? 2 : 1] : null; });
      for (const [x, y] of [[1, 6], [d.w - 2, 14], [9, 1], [14, d.h - 2]]) { d.px(x, y, 'wi', 3); d.px(x, y + 1, 'wi', 1); }
    },
  }, { clean: true });
  // shaft: clay built up in rings, smeared and cracked, soot at the top, the house panel with the hex mark south
  const shaft = mat('clay', {
    side(d) {
      // small stones bedded in clay: clay mortar, some stones daubed over, soot under the collar
      masonry(d, 'stone', { ch: 3, min: 3, max: 6, alt: ['clay', 0.3], mortar: ['clay', 1], crack: 0.15, seed: 14 });
      cracks(d, 'clay', 2, { seed: 9 });
      d.fill((x, y) => (y < 2 && ((x + y) & 1) === 0 ? ['char', 2] : null));
    },
    south(d) {
      // the daubed house panel: orange lime-clay, cracked, the hex mark pressed in on a dark clay ground
      d.rect(1, 4, d.w - 2, 8, 'sig', 2);
      d.hline(1, 4, d.w - 2, 'sig', 3); d.hline(1, 11, d.w - 2, 'sig', 1);
      cracks(d.sub(1, 4, 3, 8), 'sig', 1, { seed: 4 }); cracks(d.sub(d.w - 4, 4, 3, 8), 'sig', 1, { seed: 6 });
      d.rect(Math.floor(d.w / 2) - 5, 4, 11, 8, 'clay', 0);
      d.hexMark(Math.floor(d.w / 2) - 4, 4);
    },
    north(d) { d.rect(5, 6, 6, 5, 'clay', 0); d.rect(6, 7, 4, 3, 'char', 1); d.px(7, 8, 'amber', 1); d.hline(5, 5, 6, 'clay', 4); },
  }, { clean: true, grain: { clusters: 0 } });
  const band = mat('wi', { all(d) { d.fill((x, y) => ['wi', y === 0 ? 3 : y === d.h - 1 ? 0 : 2]); for (let x = 2; x < d.w; x += 4) { d.px(x, 0, 'wi', 4); d.px(x + 1, d.h - 1, 'wi', 1); } } }, { clean: true });
  // charge: charcoal lumps over ore, glowing between the lumps, hotter at the centre
  const charge = mat('char', {
    up(d) {
      const cx = (d.w - 1) / 2, cy = (d.h - 1) / 2;
      d.fill((x, y) => {
        const r = Math.hypot(x - cx, y - cy), lump = hsh(x >> 1, y >> 1, d.seed), e = (x & 1) + (y & 1);
        if (lump < 0.3 + r * 0.04) return ['amber', r < 3 ? 3 : r < 5 ? 2 : 1];
        return lump > 0.8 ? ['ore', e ? 3 : 2] : ['char', e === 2 ? 1 : e ? 2 : 4];
      });
    },
  }, { clean: true });
  // collar stones round the throat: soot inside, amber glints on the inner lip
  const rimOf = (inner, seed) => mat('stone', {
    side(d) { masonry(d, 'stone', { ch: 3, min: 4, max: 7, crack: 0.1, seed }); },
    [inner](d) { d.fill((x, y) => ['char', y === d.h - 1 ? 3 : (x + y) % 3 ? 1 : 2]); for (let x = 1; x < d.w; x += 3) d.px(x, d.h - 1, 'amber', 2); },
    up(d) { masonry(d, 'stone', { ch: 3, min: 3, max: 6, seed: seed + 1 }); d.fill((x, y) => (hsh2(x * 3, y) ? ['char', 2] : null)); },
  }, { clean: true });
  const rimN = rimOf('south', 5), rimS = rimOf('north', 7), rimW = rimOf('east', 9), rimE = rimOf('west', 11);

  // tap arch: voussoirs round the glowing mouth, a clay plug ledge under it
  const tapArch = mat('stone', {
    south(d) {
      masonry(d, 'stone', { ch: 3, min: 3, max: 5, seed: 11 });
      const cx = (d.w - 1) / 2, top = 2, bot = d.h - 2, hw = 2.5;
      d.fill((x, y) => {
        if (y < top || y > bot) return null; const dx = Math.abs(x - cx);
        const arch = y < top + hw ? Math.hypot(dx, top + hw - y) : dx;
        if (arch > hw + 1.4) return null;
        if (arch > hw) return ['stone', y < top + hw ? 4 : 3];
        const t = (y - top) / (bot - top);
        return t < 0.25 ? ['amber', 1] : t < 0.6 ? ['amber', (x + y) & 1 ? 3 : 2] : ['amber', 4];
      });
      d.hline(1, d.h - 1, d.w - 2, 'clay', 3);
    },
    side(d) { masonry(d, 'stone', { ch: 3, min: 2, max: 3, seed: 12 }); },
    up(d) { d.fill((x, y) => ['stone', x % 3 === 2 ? 0 : y === 0 ? 4 : 2]); },
  }, { clean: true });
  const flame = mat('amber', { all(d) { d.fill((x, y) => ['amber', y < d.h * 0.35 ? ((x + y) & 1 ? 4 : 3) : y < d.h * 0.7 ? ((x * 3 + y) % 4 ? 3 : 2) : (x & 1 ? 2 : 1)]); } }, { clean: true });
  // runnel: stone channel with a crusted glowing slag run down its middle
  const trough = mat('stone', {
    up(d) {
      d.fill((x, y) => {
        if (x === 0 || x === d.w - 1) return ['stone', y % 4 === 3 ? 0 : 4];
        if (x === 1 || x === d.w - 2) return ['stone', 1];
        const crust = hsh(x, y >> 1, d.seed) < 0.3 + y * 0.04;
        return crust ? ['char', (x + y) & 1 ? 3 : 2] : ['amber', y < 3 ? 3 : y < 6 ? 2 : 1];
      });
    },
    side(d) { masonry(d, 'stone', { ch: 2, min: 3, max: 6, mortar: ['char', 1], seed: 13 }); for (let x = 2; x < d.w; x += 5) { d.px(x, 0, 'amber', 1); d.px(x, 1, 'char', 3); } },
  }, { clean: true });
  // ingot mould: a stone block with three cavities, the nearest just poured (glowing), the far ones cooling
  const mould = mat('stone', {
    up(d) {
      masonry(d, 'stone', { ch: 3, min: 3, max: 5, seed: 17 });
      for (const [i, z] of [[0, 1], [1, 4], [2, 7]]) {
        d.rect(1, z, d.w - 2, 2, 'char', 0);
        const hot = i === 2 ? 'amber' : i === 1 ? 'ore' : 'wi';
        d.rect(2, z, d.w - 4, 1, hot, i === 2 ? 3 : 3); d.rect(2, z + 1, d.w - 4, 1, hot, i === 2 ? 2 : 1); d.px(2, z, hot, 4);
      }
    },
    side(d) { masonry(d, 'stone', { ch: 2, min: 3, max: 5, seed: 18 }); d.hline(0, 0, d.w, 'stone', 4); },
    west(d) { masonry(d, 'stone', { ch: 2, min: 3, max: 5, seed: 19 }); d.rect(Math.floor(d.w / 2) - 2, 0, 4, 1, 'amber', 2); d.hline(0, d.h - 1, d.w, 'char', 1); },
  }, { clean: true });
  // ingot pit collar (port out): orange painted oak frame, iron corner plates, a glowing bloom on the rake
  const portOut = mat('oak', {
    east(d) {
      d.rings(0, 0, d.w, d.h, [['sig', 1], ['sig', 3], ['sig', 2]]);
      d.rect(3, 3, d.w - 6, d.h - 5, 'char', 0);
      d.hline(3, 3, d.w - 6, 'oak', 1);
      for (let x = 3; x < d.w - 3; x++) d.px(x, d.h - 3, 'char', x & 1 ? 2 : 3);
      d.rect(3, d.h - 6, 2, 3, 'amber', 2); d.px(3, d.h - 6, 'amber', 4); d.px(4, d.h - 4, 'amber', 3);
      d.rect(5, d.h - 5, 2, 2, 'ore', 3); d.px(5, d.h - 5, 'ore', 4);
      for (const [x, y] of [[0, 0], [d.w - 2, 0], [0, d.h - 2], [d.w - 2, d.h - 2]]) { d.rect(x, y, 2, 2, 'wi', 2); d.px(x, y, 'wi', 4); }
      d.vline(Math.floor(d.w / 2), 1, 2, 'sig', 0);
    },
    side(d) { planks(d, 'oak', { dir: 'v', pw: 3, seed: 2 }); d.vline(0, 0, d.h, 'sig', 2); d.vline(d.w - 1, 0, d.h, 'sig', 1); d.px(0, 2, 'wi', 4); d.px(0, d.h - 3, 'wi', 4); },
    up(d) { d.fill((x, y) => ['sig', x === 0 ? 4 : x === d.w - 1 ? 1 : y === 0 ? 3 : 2]); d.px(1, 1, 'wi', 4); d.px(d.w - 2, 1, 'wi', 4); d.rect(3, 0, 2, d.h, 'sig', 0); },
  }, { clean: true });
  // charge hatch (port in): orange collar, an oak lid propped open over a throat full of ore
  const portIn = mat('oak', {
    west(d) {
      d.rings(0, 0, d.w, d.h, [['sig', 1], ['sig', 3]]);
      d.fill((x, y) => (x >= 2 && x < d.w - 2 && y >= 2 && y < d.h - 2 ? (hsh(x >> 1, y, d.seed) < 0.45 ? ['ore', (x + y) & 1 ? 3 : 2] : ['char', y === 2 ? 0 : 2]) : null));
      d.px(1, 1, 'wi', 4); d.px(d.w - 2, 1, 'wi', 4); d.px(1, d.h - 2, 'wi', 4); d.px(d.w - 2, d.h - 2, 'wi', 4);
    },
    side(d) { d.fill((x, y) => ['sig', y === 0 ? 4 : y === d.h - 1 ? 1 : x % 3 === 0 ? 1 : 2]); d.vline(d.w - 1, 0, d.h, 'clay', 1); d.px(1, 1, 'wi', 4); },
    up(d) { planks(d, 'oak', { dir: 'h', pw: 3 }); d.hline(0, 0, d.w, 'sig', 3); d.px(1, 1, 'wi', 4); },
  }, { clean: true });

  // nameplate: orange board, scorched letters, two hand-forged nails
  const nameplate = mat('sig', {
    south(d) {
      d.fill((x, y) => ['sig', y === 0 ? 4 : y === d.h - 1 ? 1 : (x * 5 + y) % 9 === 0 ? 1 : 2]);
      for (const x of [2, 3, 5, 7, 8, 10, 11, 13, 14]) if (x < d.w - 1) d.px(x, 2, 'oak', x % 3 ? 0 : 1);
      d.px(1, 1, 'wi', 4); d.px(d.w - 2, 1, 'wi', 4);
    },
  }, { clean: true });

  // bellows: oak bench with orange aprons, oak boards, oxblood leather pleats, iron nozzle and straps
  const bench = mat('oak', { up(d) { planks(d, 'oak', { dir: 'h', pw: 4, joint: 14, nail: ['wi', 4] }); }, side(d) { planks(d, 'oak', { dir: 'h', pw: 2 }); } }, { clean: true });
  const leg = mat('oak', { side(d) { planks(d, 'oak', { dir: 'v', pw: 3, seams: false }); d.hline(0, 0, d.w, 'oak', 4); }, up(d) { endGrain(d, 'oak'); } }, { clean: true });
  const apron = mat('sig', {
    side(d) { planks(d, 'sig', { dir: 'h', pw: 2, joint: 7, nail: ['wi', 4] }); d.hline(0, 0, d.w, 'sig', 4); },
    up(d) { d.fill((x) => ['sig', x % 5 === 4 ? 1 : 3]); },
  }, { clean: true });
  // lower board: oak edge with the hide nailed along it (a row of iron nails over a dark leather lip)
  const boardLo = mat('oak', { side(d) { planks(d, 'oak', { dir: 'h', pw: 3, seams: false }); d.hline(0, 0, d.w, 'hide', 1); for (let x = 1; x < d.w; x += 3) { d.px(x, 0, 'wi', 4); d.px(x + 1, 1, 'oak', 0); } } }, { clean: true });
  const head = mat('oak', {
    side(d) { planks(d, 'oak', { dir: 'v', pw: 3, seed: 4 }); strap(d, 0, 1, d.w, 'wi', { step: 3 }); strap(d, 0, d.h - 3, d.w, 'wi', { step: 3, phase: 2 }); },
    west(d) {
      planks(d, 'oak', { dir: 'v', pw: 4, seed: 5 });
      d.rect(1, 2, d.w - 2, 6, 'wi', 2); d.rings(1, 2, d.w - 2, 6, [['wi', 3]]); d.rect(Math.floor(d.w / 2) - 1, 4, 2, 2, 'wi', 0);
      for (const [x, y] of [[1, 2], [d.w - 2, 2], [1, 7], [d.w - 2, 7]]) d.px(x, y, 'wi', 4);
    },
    up(d) { endGrain(d, 'oak', { seed: 3 }); d.hline(0, 1, d.w, 'wi', 2); },
  }, { clean: true });
  // one pleat of hide: a lit bulge, a sheen line, wrinkles crowding at the head end, a dark fold under it
  // the bag inside the pleats, seen in the gaps when the board rises: crumpled hide in shadow
  const bag = mat('hide', { all(d) { d.fill((x, y) => { const f = (x + 2 * y) % 6; return ['hide', f === 0 ? 3 : f === 1 ? 2 : f === 5 ? 0 : 1]; }); } }, { clean: true });
  const pleats = mat('hide', {
    side(d) {
      const toHead = (x) => (d.face === 'east' ? d.w - 1 - x : d.face === 'west' ? x : 99);
      d.fill((x, y) => {
        const t = y / Math.max(1, d.h - 1), near = toHead(x);
        let k = t < 0.2 ? 3 : t < 0.55 ? 2 : t < 0.85 ? 1 : 0;
        if (near < 3 && y < d.h - 1 && (x + y) % 2 === 0) k = 1;
        if (y === 0 && (x * 5) % 7 === 3) k = 4;
        if (near >= 3 && y > 0 && y < d.h - 1 && (x + 2 * y) % 7 === 0) k = 1;
        return ['hide', k];
      });
      for (let x = 2; x < d.w; x += 4) d.px(x, 0, 'wi', 3);
    },
    south(d) { d.fill((x, y) => ['hide', y === d.h - 1 ? 0 : y === 0 ? 3 : x === 0 || x === d.w - 1 ? 1 : 2]); for (let x = 2; x < d.w - 1; x += 3) d.px(x, 1, 'hide', 4); },
    up(d) { d.fill((x, y) => ['hide', (x + y) % 5 === 0 ? 1 : 2]); },
  }, { clean: true });
  // top board: orange painted (house colour), two iron straps across, a staple where the rod hooks on
  const boardTop = mat('sig', {
    up(d) {
      planks(d, 'sig', { dir: 'h', pw: 4, joint: 0 });
      for (const x of [3, d.w - 6]) strap(d, x, 0, d.h, 'wi', { dir: 'v', step: 3 });
      d.rect(Math.floor(d.w / 2) - 2, 1, 4, 1, 'oak', 1);
    },
    side(d) { d.fill((x, y) => ['sig', y === 0 ? (x % 7 === 2 ? 2 : 4) : x % 6 === 5 ? 0 : (x * 3) % 7 === 1 ? 1 : 3]); for (let x = 3; x < d.w; x += 6) { d.px(x, 1, 'wi', 4); d.px(x, 0, 'wi', 2); } },
  }, { clean: true });
  const weight = mat('stone', { side(d) { masonry(d, 'stone', { ch: 3, min: 3, max: 5, seed: 21 }); d.hline(0, 0, d.w, 'wi', 3); }, up(d) { d.fill((x, y) => ['stone', x === 0 || y === 0 ? 4 : (x * y) % 5 === 1 ? 1 : 3]); d.rect(1, Math.floor(d.h / 2), d.w - 2, 1, 'wi', 2); } }, { clean: true });
  const stirrup = mat('wi', { all(d) { d.fill((x, y) => ['wi', x === 0 || y === 0 ? 3 : x === d.w - 1 || y === d.h - 1 ? 0 : 2]); d.px(1, 1, 'wi', 4); d.px(d.w - 2, d.h - 2, 'wi', 4); } }, { clean: true });
  const iron = mat('wi', { all(d) { d.fill((x, y) => ['wi', y === 0 ? 4 : y === d.h - 1 ? 0 : x % 4 === 3 ? 1 : 2]); } }, { clean: true });
  const tuyere = mat('clay', { east(d) { d.fill((x, y) => ['clay', x === 0 || y === 0 ? 4 : 2]); d.rect(1, 1, d.w - 2, d.h - 2, 'char', 0); d.px(2, 2, 'amber', 3); }, side(d) { clayDaub(d, 'clay', { smears: 1, cracks: 1 }); d.hline(0, 0, d.w, 'clay', 4); } }, { clean: true });

  // lifter: a squared oak rod and its tappet, iron shoe where the cam strikes
  const rod = mat('oak', { side(d) { planks(d, 'oak', { dir: 'v', pw: 9, seams: false, seed: 7 }); strap(d, 0, d.h - 3, d.w, 'wi', { step: 9 }); d.px(0, 1, 'wi', 4); } }, { clean: true });
  const tappet = mat('oak', {
    side(d) { planks(d, 'oak', { dir: 'h', pw: 9, seams: false, seed: 8 }); d.hline(0, d.h - 1, d.w, 'wi', 2); for (let x = 2; x < d.w; x += 5) d.px(x, d.h - 1, 'wi', 4); },
    up(d) { planks(d, 'oak', { dir: 'v', pw: 9, seams: false }); d.rect(0, d.h - 4, d.w, 1, 'wi', 2); },
    down(d) { d.rect(0, 0, d.w, d.h, 'wi', 2); },
  }, { clean: true });

  // frame posts: adzed oak with an iron bearing strap and pegs
  const post = mat('oak', {
    side(d) {
      planks(d, 'oak', { dir: 'v', pw: Math.max(2, d.w), seams: false, seed: 9 });
      // adze facets: a lit stroke over a dark one every 5 texels, staggered across the post
      for (let y = 3; y < d.h - 1; y += 5) { const x = (y * 3) % Math.max(1, d.w - 1); d.px(x, y, 'oak', 4); d.px(x, y + 1, 'oak', 1); }
      for (let y = 8; y < d.h; y += 12) { d.px(0, y, 'oak', 0); d.px(d.w - 1, y, 'wi', 3); }
      strap(d, 0, 1, d.w, 'wi', { step: 3 }); d.hline(0, d.h - 1, d.w, 'wet', 1);
    },
    up(d) { endGrain(d, 'oak', { seed: 5 }); },
  }, { clean: true });
  const flume = mat('oak', {
    side(d) { planks(d, 'oak', { dir: 'h', pw: 3, joint: 12, nail: ['wi', 3] }); d.hline(0, d.h - 1, d.w, 'wet', 1); },
    up(d) {
      d.fill((x, y) => (x === 0 || x === d.w - 1 ? ['oak', y % 6 === 0 ? 0 : 3] : ['water', (y + x * 2) % 6 === 0 ? 4 : (y + x) % 4 === 0 ? 3 : 2]));
    },
    down(d) { planks(d, 'wet', { dir: 'h', pw: 3 }); },
  }, { clean: true });
  const spill = mat('water', { all(d) { d.fill((x, y) => ['water', (y + x * 2) % 4 === 0 ? 4 : x % 2 ? 3 : 2]); } }, { clean: true });

  // water wheel: wet oak, iron hub bands; rim plank faces with nails, paddles with their grain
  const rimSeg = mat('wet', {
    side(d) { planks(d, 'wet', { dir: 'h', pw: d.h, seams: false }); d.px(1, 0, 'wi', 4); d.px(d.w - 2, d.h - 1, 'wi', 3); },
    up(d) { d.fill((x, y) => ['wet', y === 0 || y === d.h - 1 ? 1 : x % 3 === 0 ? 4 : 3]); d.rect(0, Math.floor(d.h / 2), d.w, 1, 'wi', 2); },
    down(d) { d.fill((x) => ['wet', x % 3 ? 1 : 0]); },
  }, { clean: true });
  const rimSegB = mat('wet', {
    side(d) { planks(d, 'wet', { dir: 'h', pw: d.h, seams: false, seed: 3 }); strap(d, 3, 0, d.h, 'wi', { dir: 'v', step: 9 }); },
    up(d) { d.fill((x, y) => ['wet', y === 0 || y === d.h - 1 ? 1 : x % 3 === 1 ? 4 : 3]); },
    down(d) { d.fill((x) => ['wet', x % 3 ? 1 : 0]); },
  }, { clean: true });
  const paddle = mat('wet', {
    all(d) { planks(d, 'wet', { dir: d.h > d.w ? 'v' : 'h', pw: 2 }); },
    up(d) { d.fill((x, y) => ['wet', x === 0 ? 4 : y % 2 ? 1 : 3]); },
  }, { clean: true });
  const spoke = mat('wet', { all(d) { const v = d.h > d.w; d.fill((x, y) => { const t = v ? y : x, c = v ? x : y; return ['wet', c === 0 ? 3 : (t % 7 === 3 ? 0 : (t * 3 + c) % 5 === 0 ? 4 : 2)]; }); } }, { clean: true });
  const hub = mat('wet', {
    top(d) { planks(d, 'wet', { dir: 'h', pw: d.h, seams: false }); d.vline(0, 0, d.h, 'wi', 3); d.vline(d.w - 1, 0, d.h, 'wi', 1); },
    side(d) { d.radial((r, a) => (r < 1.2 ? ['wi', 0] : r < 2.2 ? ['wi', a < 180 ? 4 : 2] : ((a / 45) | 0) % 2 ? ['wet', 3] : ['wet', 1])); },
  }, { clean: true });
  // squared oak shaft: grain streaks, iron hoops every 6 texels with a lit edge, a peg between them
  const axle = mat('oak', { all(d) {
    const v = d.h > d.w;
    d.fill((x, y) => { const t = v ? y : x, c = v ? x : y, A = v ? d.w : d.h; if (t % 6 === 0) return ['wi', c === 0 ? 4 : 2]; if (t % 6 === 1) return ['wi', 0]; return ['oak', c === 0 ? 4 : c === A - 1 ? 1 : (t + c * 3) % 5 === 0 ? 1 : 3]; });
    for (let t = 3; t < Math.max(d.w, d.h); t += 6) d.px(v ? 1 : t, v ? t : 1, 'oak', 0);
  } }, { clean: true });
  const camHub = mat('wi', { top(d) { d.fill((x, y) => ['wi', x === 0 ? 4 : x === d.w - 1 ? 0 : y % 3 === 0 ? 3 : 1]); d.px(1, 1, 'wi', 4); }, side(d) { d.radial((r) => (r < 1 ? ['oak', 1] : r < 1.8 ? ['wi', 4] : ['wi', 2])); } }, { clean: true });
  const camBar = mat('oak', {
    side(d) { planks(d, 'oak', { dir: d.h > d.w ? 'v' : 'h', pw: 9, seams: false, seed: 6 }); d.hline(0, 0, d.w, 'wi', 3); d.hline(0, d.h - 1, d.w, 'wi', 1); },
    top(d) { d.fill((x, y) => ['wi', y === 0 ? 4 : (x + y) % 3 === 0 ? 1 : 3]); },
  }, { clean: true });

  // props: wicker charcoal baskets with heaped coal, an oak stump and the anvil
  const basket = mat('straw', { side(d) { wicker(d, 'straw'); d.hline(0, 0, d.w, 'straw', 4); }, up(d) { d.rings(0, 0, d.w, d.h, [['straw', 3], ['straw', 1]]); d.rect(2, 2, d.w - 4, d.h - 4, 'char', 1); } }, { clean: true });
  const coal = mat('char', {
    all(d) { d.fill((x, y) => { const l = hsh(x >> 1, y >> 1, d.seed); const e = (x & 1) + (y & 1); return ['char', l < 0.15 ? 0 : e === 0 ? 4 : e === 1 ? 3 : l < 0.5 ? 1 : 2]; }); },
  }, { clean: true });
  const oreHeap = mat('ore', { all(d) { d.fill((x, y) => { const l = hsh(x >> 1, y >> 1, d.seed), e = (x & 1) + (y & 1); return l < 0.2 ? ['char', 2] : l > 0.85 ? ['wi', e ? 2 : 4] : ['ore', e === 0 ? 4 : e === 1 ? 3 : l < 0.5 ? 1 : 2]; }); } }, { clean: true });
  const stump = mat('oak', { side(d) { d.fill((x, y) => ['oak', x % 3 === 0 ? 1 : (y * 7 + x) % 5 === 0 ? 0 : x % 3 === 1 ? 3 : 2]); d.hline(0, 0, d.w, 'oak', 4); }, up(d) { endGrain(d, 'oak', { seed: 11 }); } }, { clean: true });
  const anvil = mat('wi', {
    side(d) { d.fill((x, y) => ['wi', y === 0 ? 4 : y === d.h - 1 ? 0 : (x * 3 + y) % 7 === 0 ? 3 : 2]); },
    up(d) { d.fill((x, y) => ['wi', x === 0 || y === 0 ? 4 : (x + y * 2) % 6 === 0 ? 2 : 3]); d.px(d.w - 3, 1, 'wi', 0); d.px(d.w - 3, 2, 'wi', 0); },
  }, { clean: true });

  // ---------------------------------------------------------------- static: yard and furnace
  const D = ['down'];
  b.box('yard', [-24, 0, -24], [24, 1, 24], yard, { hide: D });
  b.box('footing', [-17, 1, -23], [5, 4, -8], footing, { hide: D });
  b.box('hearth', [-16, 4, -22], [4, 18, -9], hearth, { hide: ['up', 'down'] });
  b.box('ledge', [-17, 18, -23], [5, 20, -8], ledge, { hide: D });
  b.box('shaft#1', [-14, 20, -20.5], [2, 35, -10.5], shaft, { hide: D });
  b.box('shaft#2', [-14.5, 22, -21], [2.5, 23, -10], band, { hide: D });
  b.box('shaft#3', [-14.5, 32, -21], [2.5, 33, -10], band, { hide: D });
  b.box('charge', [-12, 35, -18.5], [0, 35.5, -12.5], charge, { hide: D });
  b.box('collar_n', [-15, 35, -21.5], [3, 38, -18.5], rimN, { hide: D });
  b.box('collar_s', [-15, 35, -12.5], [3, 38, -9.5], rimS, { hide: D });
  b.box('collar_w', [-15, 35, -18.5], [-12, 38, -12.5], rimW, { hide: D });
  b.box('collar_e', [0, 35, -18.5], [3, 38, -12.5], rimE, { hide: D });
  b.group('flame_top', [-6, 35.5, -15.5], () => {
    b.box('flame_top#1', [-8, 35.5, -17.5], [-4, 37.5, -13.5], flame, { hide: D });
    b.box('flame_top#2', [-6.5, 35.51, -16.5], [-2.5, 36.5, -14], flame, { hide: D });
  });
  b.box('tap_arch', [4, 4, -20], [6, 13, -12], tapArch, { hide: D });
  b.group('flame', [6, 5, -16], () => { b.box('flame', [6, 5, -17.5], [6.8, 8, -14.5], flame, { hide: D }); });
  b.box('runnel', [6, 1, -19], [17, 3, -13], trough, { hide: D });
  b.box('mould', [17, 1, -20.5], [21.5, 4.5, -11.5], mould, { hide: D });
  b.box('sill', [21.5, 1, -20.5], [24, 4, -11.5], mould, { hide: D });
  b.box('port_out', [22, 4, -20], [24, 12, -12], portOut, { hide: D });
  b.box('port_in', [-4, 20, -24], [4, 28, -20.5], portIn, { hide: D });
  b.box('nameplate', [-15, 12, -9], [-9, 16, -8.5], nameplate);
  b.box('tuyere', [-2.5, 7.5, -9], [2.5, 12.5, -8], tuyere);

  // ---------------------------------------------------------------- bellows on its bench
  b.box('bench', [-7, 4, -6.5], [7, 5, 9.5], bench);
  for (const [n, x, z] of [['nw', -7, -6.5], ['ne', 5, -6.5], ['sw', -7, 7.5], ['se', 5, 7.5]]) b.box(`bench_leg_${n}`, [x, 1, z], [x + 2, 4, z + 2], leg, { hide: D });
  b.box('apron_s', [-6, 2, 9], [6, 4, 9.49], apron, { hide: D });
  b.box('apron_e', [6.5, 2, -5.5], [6.99, 4, 8.5], apron, { hide: D });
  b.box('board_lo', [-6, 5, HINGE_Z], [6, 6.5, 8.5], boardLo, { hide: D });
  b.box('head', [-4, 5, -6.5], [4, 12.4, HINGE_Z - 1], head, { hide: D });
  b.box('nozzle', [-1, 9, -8.8], [1, 11, -6], iron);
  // hide pleats inset under the overhanging boards (the middle one bulges); each fold carries a dark core
  // that stands up into the next fold, so the gaps that open at the tail show leather, not daylight
  const core = (y0, y1, w) => [[-w, y0, HINGE_Z + 0.4], [w, y1, ROD_Z + 1.2 - (4.1 - w)]];
  b.box('pleat#1', [-4.3, 6.5, HINGE_Z + 0.3], [4.3, 9.6, 7.4], pleats, { hide: D });
  b.box('pleat#4', ...core(6.5, 11, 4.1), bag, { hide: D });
  b.group('fold_a', [0, 8.5, HINGE_Z], () => {
    b.box('pleat#2', [-5.7, 8.5, HINGE_Z], [5.7, 11.6, 8.3], pleats, { hide: D });
    b.box('pleat#5', ...core(8.5, 13, 4.0), bag, { hide: D });
    b.group('fold_b', [0, 10.5, HINGE_Z], () => {
      b.box('pleat#3', [-4.3, 10.5, HINGE_Z + 0.3], [4.3, 13.4, 7.4], pleats, { hide: D });
      b.box('pleat#6', ...core(10.5, 14, 3.9), bag, { hide: D });
      b.group('board', [0, 12.5, HINGE_Z], () => {
        b.box('board', [-6, 12.5, HINGE_Z], [6, 14, 8.5], boardTop);
        b.box('weight', [-3, 14, -1], [3, 16.5, 4], weight, { hide: D });
      }, [-FOLD0, 0, 0]);
    }, [-FOLD0, 0, 0]);
  }, [-FOLD0, 0, 0]);
  const TOP = AXY + REST;
  b.group('lifter', [-6.5, ROD_BASE, ROD_Z], () => {
    // an iron stirrup clasps the side of the board: it carries the board up and lets it fall
    b.box('lifter#1', [-7, ROD_BASE - 3, ROD_Z - 2], [-6, ROD_BASE + 1, ROD_Z + 2], stirrup);
    b.box('lifter#2', [-7.5, ROD_BASE + 1, ROD_Z - 1], [-5.5, TOP, ROD_Z + 1], rod, { hide: ['up', 'down'] });
    b.box('lifter#3', [CAM_X[0], TOP, ROD_Z - 1.5], [-5.5, TOP + 2, ROD_Z + 1.5], tappet);
  });

  // ---------------------------------------------------------------- frame, flume and the wheel
  b.box('post_w', [-24, 1, 4], [-22.5, 39, 8], post, { hide: D });
  b.box('post_m', [-16, 1, 4.5], [-14, AXY - 1.5, 7.5], post, { hide: D });
  b.box('flume_post', [-23, 1, -24], [-20, 39, -21], post, { hide: D });
  b.box('flume', [-23.5, 39, -24], [-17.5, 42, 10.5], flume);
  b.box('spill', [-22, 37.5, 9.5], [-19, 39, 10.5], spill);

  b.group('wheel', [-23, AXY, AXZ], () => {
    const C = [WX, AXY, AXZ];
    b.box('wheelaxle', [-22.9, AXY - 1.5, AXZ - 1.5], [CAM_X[1] - 0.1, AXY + 1.5, AXZ + 1.5], axle);
    b.prism('wheelcam', [(CAM_X[0] + CAM_X[1]) / 2, AXY, AXZ], HUB_R, CAM_X[1] - CAM_X[0], 'x', camHub, 6);
    b.box('wheelcam#4', [CAM_X[0] + 0.05, AXY - LOBE_W, AXZ - LOBE], [CAM_X[1] - 0.05, AXY + LOBE_W, AXZ + LOBE], camBar);
    b.prism('wheelhub', C, 3, 5, 'x', hub, 8);
    teeth(b, 'wheelspoke', C, 'x', 14.5, 4, 2, 2, spoke);
    rim(b, 'wheelrim', C, 'x', 14, 16, 12, 4, rimSeg, { phase: 15, mats: [rimSeg, rimSegB] });
    radial(b, 'wheelpaddle', C, 'x', 13.5, 17.8, 12, 1.5, 3.6, paddle);
  });

  // ---------------------------------------------------------------- props
  b.box('basket_e', [8, 1, -6], [16, 7, 1], basket, { hide: D });
  b.box('coal_e', [9, 7, -5], [15, 8.5, 0], coal, { hide: D });
  b.box('basket_s', [6, 1, 15], [14, 7, 22], basket, { hide: D });
  b.box('coal_s', [7, 7, 16], [13, 8.5, 21], coal, { hide: D });
  b.box('ore#1', [-17, 1, 12], [-11, 3.5, 19], oreHeap, { hide: D });
  b.box('ore#2', [-16, 3.5, 13], [-12, 5, 17], oreHeap, { hide: D });
  b.box('stump', [13, 1, 5], [19, 6, 11], stump, { hide: D });
  b.box('anvil#1', [13.5, 6, 6.5], [18.5, 7.5, 9.5], anvil, { hide: D });
  b.box('anvil#2', [14.5, 7.5, 7], [17.5, 9.5, 9], anvil, { hide: D });
  b.box('anvil#3', [12.5, 9.5, 6.5], [19.5, 11.5, 9.5], anvil, { hide: D });
  b.box('anvil#4', [19.5, 10, 7.3], [22, 11.2, 8.7], anvil, { hide: D });

  // ---------------------------------------------------------------- working: 2 strokes per wheel turn
  const L = 4, N = 80, keys = (f) => Array.from({ length: N + 1 }, (_, i) => [(i / N) * L, f((i / N) * 360, i / N)]);
  // fire: flares just after each drop of the board (the blast), with a small irregular flicker on top
  const blast = (deg) => { const ph = ((deg % 180) + 180) % 180; return ph > 95 && ph < 150 ? Math.sin(((ph - 95) / 55) * Math.PI) : 0; };
  const flick = (u) => 0.08 * Math.sin(u * 2 * Math.PI * 7) + 0.05 * Math.sin(u * 2 * Math.PI * 11 + 1);
  b.anim('working', L, {
    wheel: { rotation: keys((a) => [a, 0, 0]) },
    lifter: { position: keys((a) => [0, lift(a), 0]) },
    board: { rotation: keys((a) => [-boardAngle(a) / 3, 0, 0]) },
    fold_b: { rotation: keys((a) => [-boardAngle(a) / 3, 0, 0]) },
    fold_a: { rotation: keys((a) => [-boardAngle(a) / 3, 0, 0]) },
    flame: { scale: keys((a, u) => { const s = 1 + 0.5 * blast(a) + flick(u); return [1 + 0.15 * blast(a), s, 1 + 0.4 * blast(a)]; }) },
    flame_top: { scale: keys((a, u) => { const s = 1 + 0.6 * blast(a) + flick(u + 0.3); return [1, s, 1]; }) },
  });
}

function hsh2(x, y) { return ((x * 7 + y * 13) % 5) === 0; }
