// Smelter Mk2, tier 4 (lineage: rethink, from the tier-0 bloomery and the Mk1 kiln). An electric arc furnace:
// a round enamelled vessel on a rocker cradle, an open mouth under a water-cooled roof, three graphite
// electrodes on current-carrying arms that slide on a crosshead, fed by copper bus bars from a transformer
// house. Why rethink: smelting has distinct real technologies per era; the arc furnace is the electric one.
// Family signature: in/out port collars, the hex mark (transformer door), a nameplate (crosshead), orange enamel.
import { addRamp, hsh } from '../pix.mjs';
import { dial, leds, slabMats, tween, steps } from '../arc_helpers.mjs';

addRamp('bs', ['#20262e', '#46505b', '#717b85', '#9da5ab', '#d4d3cc'], { streaks: 0.12, clusters: 0.015 });
addRamp('bg', ['#191d24', '#2c3440', '#434d5a', '#606b78', '#8a94a0'], { clusters: 0.03, streaks: 0.03 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.02 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { streaks: 0.03 });
addRamp('ink', ['#0c0e12', '#171a20', '#22262d', '#30353e', '#454b55'], { clusters: 0.06 });
addRamp('gr', ['#101215', '#1e2226', '#2d3237', '#424850', '#646c75'], { streaks: 0.1 });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('arc', ['#0a1640', '#1838a8', '#2f6bff', '#6fa6ff', '#cfe2ff'], null, { glow: true });
addRamp('led', ['#3a3f46', '#8a939c', '#d8e0e6', '#f2f6f8', '#ffffff'], null, { glow: true });

const V = [-6, 8];                      // vessel axis (x, z)
const PIVOT = [6, 5, -2.5];             // tilt pin, tap side, in the north bearing
const MELT = 29, TIP = 33, EL_TOP = 60;  // melt surface, electrode tips and tops at rest
const SHELL_R = 16, BAND_R = 17.2, HEARTH_R = 12.5, ROOF_R = 14.5, DELTA_R = 10.5, EL_R = 3.5;
const ROOF_Y = 48, ROOF_H = 4, CLAMP_Y = 55;
const EL = [[1, -11.63, 11.25], [2, -0.37, 11.25], [3, -6, 1.5]];
const BANDS = [[9.5, 12], [18.5, 21], [26.2, 28.8]];
const LIFT = 4, PACK = -7, PACK_LIFT = 4, TILT = -4;

export const meta = {
  title: 'Smelter Mk2 (electric arc furnace)', note: 'Ore to ingots in a tilting arc furnace: three graphite electrodes strike arcs into the melt. Tier 4.',
  footprint: [4, 4], height: 4, tier: 4,
  ports: [{ id: 'in', kind: 'item', face: 'west', cell: [2, 2] }, { id: 'out', kind: 'item', face: 'east', cell: [2, 0] }],
  joints: {
    vessel: { type: 'revolute', axis: 'z', min: TILT, max: 0 },
    gantry: { type: 'prismatic', axis: 'y', min: PACK, max: 0 },
    ...Object.fromEntries(EL.map(([i]) => [`electrode_${i}`, { type: 'prismatic', axis: 'y', min: -3, max: PACK_LIFT }])),
    ...Object.fromEntries(EL.map(([i]) => [`arc_${i}`, { type: 'free', why: 'electric arc: light that stretches and flickers' }])),
    stream: { type: 'free', why: 'molten metal stream, shown only while pouring' },
  },
  lint: { allow: [
    { a: 'band_*', b: 'shell#*', check: 'overlap', why: 'stiffening bands are shrunk round the shell' },
    { a: 'electrode_*', b: 'roof#*', check: 'overlap', why: 'electrodes pass through the roof glands' },
    { a: 'electrode_*', b: 'delta#*', check: 'overlap', why: 'electrodes pass through the delta' },
    { a: 'gantry#*', b: 'sleeve_*', check: 'overlap', why: 'the telescoping mast slides in its sleeve' },
    { a: 'spout#*', b: 'band_*', check: 'overlap', why: 'the tap spout is welded through the top band' },
    { a: 'pin_bearing_*', b: 'hearth#*', check: 'overlap', why: 'the tilt pin turns in its bearings' },
    { a: 'ladle#*', b: 'ladle_rim#*', check: 'overlap', why: 'rim band welded round the ladle' },
  ] },
};
export const look = { glow: 1.3 };

const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

export function build(b, { mat }) {
  // ---------------------------------------------------------------- materials
  const plinth = mat('bg', {
    side(d) {
      d.fill((x, y) => ['bg', y === 0 ? (x % 8 === 7 ? 2 : 4) : (x % 8 === 7 ? 0 : 1)]);
      for (let x = 3; x < d.w; x += 8) d.px(x, 1, 'bs', 3);
      for (let x = 6; x < d.w - 4; x += 20) d.rect(x, 0, 4, 2, 'sig', 3);
    },
    top(d) {
      d.fill((x, y) => { const i = x % 6, j = y % 6, off = ((x / 6 | 0) + (y / 6 | 0)) & 1; if (off ? j !== 2 || i > 3 : i !== 2 || j > 3) return null; return ['bs', off ? 3 : 2]; });
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      for (let x = 8; x < d.w - 4; x += 12) { d.bolt(x, 2, 'bs'); d.bolt(x, d.h - 4, 'bs'); }
    },
  });
  const rocker = mat('bg', {
    side(d) {
      d.fill((x, y) => ['bg', y === 0 ? 4 : x % 6 === 0 ? 1 : 2]);
      d.hline(0, d.h - 1, d.w, 'bg', 0);
      for (let x = 3; x < d.w - 1; x += 6) d.bolt(x, 1, 'bs');
      d.rect(Math.floor(d.w / 2) - 3, 1, 6, 1, 'sig', 3);
    },
    top(d) { d.fill((x) => ['bs', x % 4 === 0 ? 2 : 3]); d.hline(0, 0, d.w, 'bs', 4); },
  });
  const bearing = mat('bs', {
    side(d) { d.plate(0, 0, d.w, d.h, 'bs'); d.rect(2, 1, d.w - 4, 1, 'bg', 1); d.px(Math.floor(d.w / 2), 1, 'cu', 4); },
    top(d) { d.plate(0, 0, d.w, d.h, 'bs'); d.vline(Math.floor(d.w / 2), 1, d.h - 2, 'bg', 1); },
  });

  // vessel shell staves (9 wide, 23 tall, top = melt line): water-cooled tube panels above the middle band,
  // orange enamel below with bolted inset panels; per stave a variant (gauge, LED strip, hose, slag door)
  const shellStave = (i, face) => (d) => {
    const k = i * 2 + (face === 'east' ? 0 : 1);
    const band = (y) => BANDS.find(([a, c]) => { const t0 = MELT - c, t1 = MELT - a; return y >= Math.floor(t0) && y < Math.ceil(t1); });
    d.fill((x, y) => {
      if (band(y)) return null;
      if (y < 8 && k % 2) return ['sig', y === 3 ? 4 : y === 7 ? 1 : (x + y + k) % 7 === 0 ? 3 : 2];
      if (y < 8) {                                   // tube panel
        if (x === 0) return ['bg', 1];
        return y % 2 ? ['bs', x === 1 ? 2 : (x + k) % 5 === 0 ? 3 : 1] : ['bs', x === 1 ? 3 : 4];
      }
      if (y >= 11 && y < 17) return ['sig', y === 11 ? 4 : y === 16 ? 1 : 2];
      return ['bg', y === d.h - 1 ? 0 : 2];
    });
    // the tube panel's header pipe and a coolant hose stub
    if (k % 2 === 0) { d.vline(0, 3, 5, 'bg', 1); d.px(0, 3, 'bs', 4); if (k % 3 === 0) { d.vline(d.w - 2, 3, 5, 'cu', 2); d.px(d.w - 2, 3, 'cu', 4); } }
    else { d.vline(0, 3, 5, 'sig', 1); d.rect(2, 4, d.w - 4, 3, 'bs', 3); d.hline(2, 4, d.w - 4, 'bs', 4); d.hline(3, 5, d.w - 6, 'ink', 1); if (k % 3 === 1) d.px(d.w - 3, 6, 'led', 4); }
    // the enamel panel: inset frame with corner bolts, a different insert per stave
    d.rings(1, 11, d.w - 2, 6, [['sig', 1]]); d.px(1, 11, 'bs', 4); d.px(d.w - 2, 16, 'bs', 4);
    if (k % 4 === 0) { d.rect(3, 13, d.w - 6, 2, 'sig', 3); d.hline(3, 13, d.w - 6, 'sig', 4); }
    else if (k % 4 === 1) leds(d, 3, 14, 2, (q) => q !== (k & 1));
    else if (k % 4 === 2) { d.vent(2, 12, d.w - 4, 4, 'bg'); }
    else { d.rect(3, 12, 3, 4, 'bg', 1); d.hline(3, 12, 3, 'bs', 4); d.px(4, 14, 'bs', 3); }
    d.hline(0, d.h - 1, d.w, 'bg', 0); d.px(2, d.h - 2, 'bs', 3); d.px(d.w - 3, d.h - 2, 'bs', 3);
  };
  // melt cap: steel lip, refractory ring, an amber bath with crust and blue-white arc spots under the electrodes
  const meltCap = (rot) => (d) => d.radial((r, a) => {
    if (r > SHELL_R - 0.8) return ['bs', a < 180 ? 4 : 2];
    if (r > SHELL_R - 1.6) return ['bg', near(a, 30) < 3 ? 3 : 0];
    if (r > SHELL_R - 3.4) return ['slag', near(a, 15) < 1.5 ? 0 : (r * 2 | 0) % 2 ? 3 : 2];
    const dr = Math.abs(r - 6.5), da = near(a, 120, 90);
    if (dr < 1.1 && da < 8) return ['arc', 4];
    if (dr < 2 && da < 15) return ['arc', 3];
    if (dr < 3 && da < 24) return ['amber', 4];
    if (r > SHELL_R - 4.2) return ['amber', 2];
    // crust plates on the bath, amber showing in the cracks between them
    const crack = near(a + r * 9, 40) < 3.5 || Math.abs(r - 10.5) < 0.5 || Math.abs(r - 3) < 0.5;
    if (crack) return ['amber', hsh(Math.round(r), Math.round(a / 15), 3) < 0.4 ? 2 : 3];
    return ['slag', hsh(Math.round(r * 1.3), Math.round(a / 12), 7) < 0.25 ? 4 : r < 3 ? 3 : 2];
  }, { rot });
  const shellMats = slabMats(12, (i, rot) => mat('sig', { east: shellStave(i, 'east'), west: shellStave(i, 'west'), up: meltCap(rot) }, { clean: true }));

  const bandMat = (i) => mat('bg', {
    side(d) {
      d.fill((x, y) => ['bg', y === 0 ? 4 : y === d.h - 1 ? 0 : (x + i) % 3 === 0 ? 1 : 3]);
      d.hline(0, 0, d.w, 'bs', 3); d.px((i * 3) % d.w, 0, 'bs', 4);
      d.rivets(1, 1, d.w - 2, 'bs', { step: 3, phase: i % 2 });
      d.hline(0, d.h - 1, d.w, 'bg', 0); d.px((i * 5 + 2) % d.w, d.h - 1, 'bs', 3);
      if (i % 3 === 1) d.px(Math.floor(d.w / 2), 1, 'led', 4);
      if (i % 3 === 2) d.rect(Math.floor(d.w / 2) - 1, 1, 3, 1, 'sig', 3);
    },
    up(d) { d.radial((r, a) => (r > BAND_R - 0.7 ? ['bs', near(a, 15) < 2 ? 2 : 4] : r > SHELL_R - 0.2 ? ['bg', near(a, 30) < 4 ? 1 : 3] : null)); },
  }, { clean: true });
  const bandMats = [0, 1, 2, 3, 4, 5].map(bandMat);

  const hearthMat = mat('bg', {
    side(d) {
      d.fill((x, y) => ['bg', y === 0 ? 4 : y === d.h - 1 ? 0 : x === 0 ? 3 : (x + y) % 3 === 0 ? 1 : 2]);
      d.vline(Math.floor(d.w / 2), 1, d.h - 2, 'ink', 1); d.px(2, 1, 'bs', 4); d.px(d.w - 3, 1, 'bs', 4); d.px(1, d.h - 2, 'cu', 2);
      d.px(Math.floor(d.w / 2) + 1, 2, 'sig', 3);
    },
  }, { clean: true });
  const terminal = mat('bg', {
    side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.rect(1, 2, d.w - 2, 3, 'cu', 2); d.hline(1, 2, d.w - 2, 'cu', 4); d.px(1, d.h - 3, 'led', 4); d.vent(1, 6, d.w - 2, 4, 'bg'); },
    east(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); for (let x = 1; x < d.w - 1; x += 2) d.px(x, 2, 'cu', 4); d.rect(1, 4, d.w - 2, 4, 'sig', 2); d.hline(1, 4, d.w - 2, 'sig', 4); d.vent(1, 9, d.w - 2, 2, 'bg'); },
    top(d) { d.inset(0, 0, d.w, d.h, 'bg'); d.px(1, 1, 'bs', 4); },
  });

  // tap spout: brushed trough lined with refractory, an amber channel
  const spout = mat('bs', {
    side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x % 4 === 0 ? 1 : 2]); d.hline(0, d.h - 1, d.w, 'bg', 0); d.px(2, 1, 'bg', 0); d.px(d.w - 3, 1, 'bg', 0); },
    up(d) { d.fill((x, y) => (y === 0 || y === d.h - 1 ? ['bs', 3] : y === 1 || y === d.h - 2 ? ['slag', 2] : ['amber', x % 5 === 0 ? 2 : x > d.w - 4 ? 4 : 3])); },
    down(d) { d.rect(0, 0, d.w, d.h, 'bg', 1); },
  }, { clean: true });
  const spoutWall = mat('bs', { side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); d.px(1, d.h - 1, 'bg', 0); }, top(d) { d.fill((x) => ['bs', x % 3 ? 3 : 4]); } }, { clean: true });

  // roof: water-cooled steel panel (concentric tubes), orange enamel rim with trim; delta of refractory
  const roofStave = (i) => (d) => {
    d.fill((x, y) => ['sig', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]);
    d.hline(0, 0, d.w, 'bg', 3); d.hline(0, d.h - 1, d.w, 'bg', 1);
    d.px(1, 1, 'bs', 4); d.px(d.w - 2, 1, 'bs', 4);
    if (i % 2) d.px(Math.floor(d.w / 2), 2, 'led', 4); else d.rect(Math.floor(d.w / 2) - 1, 1, 3, 2, 'bg', 1);
  };
  const roofCap = (rot) => (d) => d.radial((r, a) => {
    if (r > ROOF_R - 0.7) return ['bg', 3];
    if (r > ROOF_R - 1.4) return ['bg', 0];
    if (near(a, 30, 15) < 2.5 && r > DELTA_R) return ['bg', 1];
    if (r > DELTA_R - 0.5) return ['bs', (r | 0) % 2 ? 4 : 2];
    return ['bs', 2];
  }, { rot });
  const roofMats = slabMats(12, (i, rot) => mat('bs', { east: roofStave(i), west: roofStave(i + 1), up: roofCap(rot), down(d) { d.radial((r) => ['bg', (r | 0) % 3 ? 1 : 2]); } }, { clean: true }));
  const deltaCap = (rot) => (d) => d.radial((r, a) => {
    if (r > DELTA_R - 0.7) return ['bs', 4];
    if (Math.abs(r - 6.5) < 3.8 && near(a, 120, 90) < 30) return Math.abs(r - 6.5) < 3.4 && near(a, 120, 90) < 26 ? ['cu', 3] : ['bg', 0];
    return ['slag', (Math.round(r) + Math.round(a / 30)) % 2 ? 3 : 2];
  }, { rot });
  const deltaMats = slabMats(12, (i, rot) => mat('bg', { side(d) { d.fill((x, y) => ['bg', y === 0 ? 4 : y === d.h - 1 ? 0 : x % 3 === 0 ? 1 : 2]); d.px(i % d.w, 0, 'cu', 3); if (i % 2) d.px(d.w - 2, 1, 'led', 4); }, up: deltaCap(rot) }, { clean: true }));

  // graphite electrode: column joints every 9 px, a white-hot tip
  const electrodeMat = mat('gr', {
    side(d) {
      d.fill((x, y) => {
        const t = d.h - 1 - y;
        if (t < 1) return ['arc', 3];
        if (t < 3) return ['arc', 1];
        if (t < 5) return ['gr', 4];
        return ['gr', (y % 9 === 0) ? 4 : (y % 9 === 1) ? 0 : x === 0 ? 3 : 2];
      });
    },
    up(d) { d.rect(0, 0, d.w, d.h, 'gr', 3); d.px(0, 0, 'cu', 3); },
  }, { clean: true });
  // electrode holder: brushed clamp with copper contact shoes and bolts
  const clamp = mat('bs', {
    side(d) { d.plate(0, 0, d.w, d.h, 'bs'); d.rect(2, 1, d.w - 4, d.h - 2, 'cu', 2); d.hline(2, 1, d.w - 4, 'cu', 4); d.px(1, 1, 'bs', 4); d.px(d.w - 2, d.h - 2, 'bg', 0); d.px(Math.floor(d.w / 2), d.h - 2, 'cu', 1); },
    top(d) { d.inset(0, 0, d.w, d.h, 'bs'); d.rings(2, 2, d.w - 4, d.h - 4, [['cu', 2]]); d.bolt(1, 1, 'bs'); d.bolt(d.w - 3, d.h - 3, 'bs'); },
  }, { clean: true });
  // current-conducting arm: blue-grey box girder clad in copper on top, a coolant line, bolts every 6 px
  const arm = mat('bg', {
    side(d) {
      d.fill((x, y) => (y === 0 ? ['cu', x % 6 === 0 ? 2 : 4] : y === d.h - 1 ? ['bg', 0] : ['bg', x % 6 === 0 ? 1 : 2]));
      for (let x = 3; x < d.w - 1; x += 6) d.px(x, 1, 'bs', 4);
      d.hline(1, d.h - 2, d.w - 2, 'ink', 2);
    },
    top(d) { d.fill((x, y) => ['cu', y % 6 === 0 ? 1 : x === 0 ? 4 : 3]); },
    north(d) { d.rect(0, 0, d.w, d.h, 'bs', 3); d.px(1, 1, 'bg', 0); },
  }, { clean: true });

  // crosshead beam: orange enamel panels, the nameplate in the middle, LEDs
  const beam = mat('bg', {
    south(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      const m = Math.floor(d.w / 2);
      for (const x0 of [2, m + 6]) { d.rect(x0, 2, m - 8, d.h - 4, 'sig', 2); d.hline(x0, 2, m - 8, 'sig', 4); }
      d.rect(m - 5, 1, 10, d.h - 2, 'bs', 3); d.rings(m - 5, 1, 10, d.h - 2, [['bs', 1]]); d.hline(m - 3, 2, 6, 'ink', 1); d.hline(m - 3, 4, 4, 'ink', 1); d.px(m + 2, 4, 'sig', 2);
      leds(d, 3, 1, 3, (i) => i !== 1);
    },
    north(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.vent(2, 1, d.w - 4, d.h - 2, 'bg', 'v'); },
    side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.rect(2, 2, d.w - 4, d.h - 4, 'sig', 2); },
    top(d) { d.inset(0, 0, d.w, d.h, 'bg'); for (let x = 2; x < d.w - 2; x += 4) d.bolt(x, 2, 'bs'); d.stripes(1, d.h - 3, d.w - 2, 2, ['bg', 1], ['sig', 3]); },
  });
  const guide = mat('bs', {
    side(d) { d.fill((x, y) => ['bs', x === 0 || x === d.w - 1 ? 1 : y % 3 === 0 ? 4 : 2]); for (let y = 2; y < d.h; y += 6) d.px(0, y, 'sig', 3); },
    top(d) { d.inset(0, 0, d.w, d.h, 'bs'); },
  }, { clean: true });
  const cableMat = mat('ink', { all(d) {
    const along = d.h >= d.w;
    d.fill((x, y) => { const t = along ? y : x, c = along ? x : y, A = along ? d.w : d.h; return t % 7 === 3 ? ['cu', c === 0 ? 4 : 2] : ['ink', c === 0 ? 4 : c === A - 1 ? 1 : t % 2 ? 2 : 3]; });
  } }, { clean: true });
  const cableLug = mat('cu', { all(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : x % 2 ? 2 : 3]); d.px(0, d.h - 1, 'bs', 4); } }, { clean: true });
  const guideBar = mat('bg', { side(d) { d.fill((x, y) => ['bg', y === 0 ? 4 : x % 4 === 0 ? 1 : 2]); for (let x = 2; x < d.w; x += 6) d.px(x, 0, 'sig', 3); }, top(d) { d.fill((x) => ['bs', x % 4 ? 3 : 1]); d.px(1, 0, 'led', 4); } });
  const hanger = mat('bg', {
    side(d) { d.fill((x, y) => ['bg', y === 0 ? 4 : y === d.h - 1 ? 0 : x % 5 === 0 ? 1 : 2]); for (let x = 2; x < d.w; x += 5) d.px(x, 1, 'bs', 4); },
    top(d) { d.fill((x, y) => (x === 0 || x === d.w - 1 ? ['bs', 3] : ['ink', y % 4 === 0 ? 3 : 1])); for (let y = 2; y < d.h; y += 4) d.px(3, y, 'cu', 3); },
  });
  const column = mat('bs', {
    side(d) { d.fill((x, y) => ['bs', x === 0 ? 4 : x === d.w - 1 ? 1 : y % 2 ? 2 : 3]); for (let y = 1; y < d.h; y += 4) d.px(1, y, 'bg', 0); },
  }, { clean: true });
  const sleeve = mat('bg', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      d.rect(1, 6, d.w - 2, 12, 'sig', 2); d.hline(1, 6, d.w - 2, 'sig', 4); d.hline(1, 17, d.w - 2, 'sig', 1);
      d.vent(1, 20, d.w - 2, 6, 'bg');
      d.px(2, 2, 'led', 4); d.px(3, 2, 'bg', 1);
      d.stripes(1, d.h - 5, d.w - 2, 3, ['bg', 1], ['sig', 3]);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'bg'); d.rect(1, 1, d.w - 2, d.h - 2, 'ink', 0); },
  });

  // transformer house: blue-grey shell, orange door with the hex mark, gauges, LEDs; radiator fins east
  const house = mat('bg', {
    south(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      d.plate(2, 3, 11, 18, 'sig'); d.rings(3, 4, 9, 16, [['sig', 1]]);
      d.rect(3, 6, 11, 10, 'bg', 0); d.hexMark(4, 7, { rim: ['bs', 4] });
      d.vline(11, 10, 3, 'bs', 4);
      dial(d, 15, 4, 5, { angle: 70 }); dial(d, 21, 4, 5, { angle: 140 }); dial(d, 27, 4, 5, { angle: 30 });
      d.rect(15, 11, 17, 7, 'ink', 1); leds(d, 17, 13, 7, (i) => i !== 4); d.hline(16, 16, 15, 'cu', 3);
      d.vent(15, 19, d.w - 17, 4, 'bg');
    },
    east(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.rect(2, 2, d.w - 4, 3, 'sig', 2); d.hline(2, 2, d.w - 4, 'sig', 4); d.vent(2, 7, d.w - 4, d.h - 9, 'bg', 'v'); },
    west(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      d.rect(2, 3, d.w - 4, 8, 'sig', 2); d.rings(2, 3, d.w - 4, 8, [['sig', 3]]); d.rect(Math.floor(d.w / 2) - 4, 5, 8, 4, 'bs', 3); d.hline(Math.floor(d.w / 2) - 3, 6, 6, 'ink', 1); d.hline(Math.floor(d.w / 2) - 3, 7, 4, 'ink', 1);
      d.vent(2, 13, d.w - 4, 6, 'bg'); leds(d, 3, d.h - 4, 4, (i) => i % 2 === 0);
    },
    north(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.vent(2, 2, d.w - 4, d.h - 4, 'bg'); },
  });
  const houseCap = mat('bs', {
    side(d) { d.hline(0, 0, d.w, 'bs', 4); d.hline(0, d.h - 1, d.w, 'bg', 0); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'bg', 1); },
    top(d) { d.inset(0, 0, d.w, d.h, 'bs'); d.rings(2, 2, d.w - 4, d.h - 4, [['bs', 2]]); for (let x = 4; x < d.w - 3; x += 5) { d.bolt(x, 3, 'bs'); d.bolt(x, d.h - 5, 'bs'); } d.stripes(4, Math.floor(d.h / 2) - 1, d.w - 8, 2, ['sig', 3], ['bg', 1]); d.inset(d.w - 7, d.h - 8, 5, 5, 'bg'); d.px(d.w - 5, d.h - 6, 'led', 4); d.vline(2, 4, d.h - 8, 'cu', 2); },
  });
  // radiator fin: pressed corrugations, a stiffener strap every 6 px, oil drain at the foot
  const fin = mat('bg', {
    side(d) {
      d.fill((x, y) => ['bg', y === 0 ? 4 : y === d.h - 1 ? 0 : y % 6 === 3 ? (x % 2 ? 2 : 4) : x % 2 ? 1 : 3]);
      d.px(0, d.h - 3, 'cu', 3); d.px(d.w - 1, 2, 'bs', 4);
    },
    top(d) { d.fill((x) => ['bs', x % 3 ? 3 : 1]); },
  }, { clean: true });
  const bushing = mat('bs', {
    side(d) { d.fill((x, y) => (y < 1 ? ['cu', 4] : y === d.h - 1 ? ['bg', 0] : y % 2 ? ['bs', x === 0 ? 4 : 3] : ['bg', x === d.w - 1 ? 0 : 1])); d.px(1, 0, 'cu', 2); },
    up(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.px(1, 1, 'cu', 4); },
  }, { clean: true });
  // copper bus bar: bright edge, clamps every 5 px
  const busMat = mat('cu', { all(d) {
    const along = d.w >= d.h, L = along ? d.w : d.h;
    d.fill((x, y) => { const t = along ? x : y, c = along ? y : x; if (t % 6 === 3 && L > 4) return ['bs', c === 0 ? 4 : 2]; return ['cu', c === 0 ? 4 : t % 6 === 4 ? 1 : 3]; });
  } }, { clean: true });

  // ladle: blue-grey shell, an orange enamel band, weld seams; molten bath on top
  const ladleStave = mat('bg', {
    side(d) {
      d.fill((x, y) => ['bg', y === 0 ? 4 : y > d.h - 3 ? 1 : x === 0 ? 3 : 2]);
      d.rect(0, 3, d.w, 3, 'sig', 2); d.hline(0, 3, d.w, 'sig', 4);
      d.weld(Math.floor(d.w / 2), 6, d.h - 7, 'bs', { dir: 'v' });
    },
    up(d) { d.radial((r, a) => (r > 5.3 ? ['bs', 3] : r > 4.6 ? ['slag', 1] : r < 1.6 ? ['amber', 4] : near(a + r * 20, 60) < 9 ? ['amber', 3] : ['slag', hsh(Math.round(r), Math.round(a / 30), 3) < 0.3 ? 4 : 2])); },
  }, { clean: true });
  const ladleRim = mat('bs', { side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); d.hline(0, d.h - 1, d.w, 'bg', 0); d.px(1, 0, 'sig', 3); d.px(d.w - 2, 1, 'bs', 4); }, up(d) { d.radial((r) => (r > 6.1 ? ['bs', 4] : null)); } }, { clean: true });
  const car = mat('bg', {
    side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.stripes(2, 1, d.w - 4, d.h - 2, ['sig', 3], ['bg', 1], { width: 2 }); },
    top(d) { d.inset(0, 0, d.w, d.h, 'bg'); for (let x = 2; x < d.w - 1; x += 4) { d.px(x, 1, 'bs', 4); d.px(x, d.h - 2, 'bs', 4); } },
  });
  const wheel = mat('bs', { side(d) { d.fill((x, y) => ['bs', Math.hypot(x - (d.w - 1) / 2, y - (d.h - 1) / 2) < 1 ? 0 : y === 0 ? 4 : 2]); } }, { clean: true });
  const bracketMat = mat('bg', { side(d) { d.fill((x, y) => ['bg', x === 0 ? 3 : x === d.w - 1 ? 0 : y % 3 === 0 ? 1 : 2]); for (let y = 1; y < d.h; y += 3) d.px(1, y, 'bs', 4); d.px(Math.floor(d.w / 2), 0, 'cu', 3); }, top(d) { d.inset(0, 0, d.w, d.h, 'bg'); } }, { clean: true });
  const pin = mat('bs', { all(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x === 0 ? 3 : 1]); } }, { clean: true });
  const mould = mat('bs', {
    side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); d.hline(0, d.h - 1, d.w, 'bg', 0); },
    up(d) { d.fill((x, y) => (y % 3 === 2 ? ['bs', 1] : ['amber', x === 0 ? 1 : 3])); },
  }, { clean: true });
  const portOut = mat('bg', {
    east(d) { d.rings(0, 0, d.w, d.h, [['bs', 3], ['bg', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'ink', 1); d.hline(2, 2, d.w - 4, 'ink', 0); d.px(2, d.h - 3, 'amber', 1); d.px(d.w - 3, 2, 'bs', 4); },
    side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) { d.px(0, y, 'bg', 0); d.px(d.w - 1, y + 1, 'sig', 3); } d.px(0, d.h - 1, 'bg', 0); },
    top(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x % 3 === 0 ? 1 : 3]); d.px(0, 1, 'sig', 3); },
  });
  const portIn = mat('bg', {
    west(d) {
      d.rings(0, 0, d.w, d.h, [['sig', 3], ['bg', 0], ['bs', 3]]);
      d.fill((x, y) => (x > 2 && y > 2 && x < d.w - 3 && y < d.h - 3 ? ((x - 3) % 3 === 2 ? ['bs', y === 3 ? 4 : 2] : ['slag', (x * 7 + y * 5) % 6 === 0 ? 4 : (x + y) % 4 === 0 ? 3 : 1]) : null));
      d.px(1, 1, 'bs', 4); d.px(d.w - 2, d.h - 2, 'bs', 4); d.px(d.w - 2, 1, 'led', 4);
    },
    side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) d.px(0, y, 'bg', 0); },
  });
  // charging hopper: orange enamel bin in a steel frame, ore heaped inside
  const hopper = mat('sig', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 1], ['bs', 3]]);
      d.rings(2, 2, d.w - 4, d.h - 5, [['sig', 3]]); d.hline(3, 3, d.w - 6, 'sig', 4);
      d.stripes(1, d.h - 3, d.w - 2, 2, ['sig', 3], ['bg', 1]);
      d.bolt(1, 1, 'bs'); d.bolt(d.w - 3, 1, 'bs');
    },
    up(d) { d.rings(0, 0, d.w, d.h, [['bs', 4], ['bg', 0]]); d.fill((x, y) => (x > 1 && y > 1 && x < d.w - 2 && y < d.h - 2 ? ['slag', (x * 5 + y * 3) % 7 === 0 ? 4 : (x + y) % 3 === 0 ? 3 : 1] : null)); },
  });
  const funnel = mat('bg', {
    side(d) { d.fill((x, y) => ['bg', y === 0 ? 4 : y === d.h - 1 ? 0 : x % 3 === 0 ? 1 : 2]); d.hline(1, 1, d.w - 2, 'sig', 3); d.px(1, d.h - 2, 'bs', 4); d.px(d.w - 2, d.h - 2, 'bs', 4); },
    down(d) { d.inset(0, 0, d.w, d.h, 'bg'); },
  });
  const desk = mat('bg', {
    side(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.rect(1, 2, d.w - 2, 2, 'sig', 2); d.hline(1, 2, d.w - 2, 'sig', 4); d.vent(1, 5, d.w - 2, d.h - 6, 'bg'); },
    south(d) { d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]); d.rect(1, 1, d.w - 2, 2, 'sig', 3); d.rect(2, 4, d.w - 4, d.h - 5, 'bg', 1); d.px(3, 4, 'bs', 4); d.px(d.w - 4, 4, 'bs', 4); d.hline(3, d.h - 2, d.w - 6, 'bs', 3); },
    top(d) { d.inset(0, 0, d.w, d.h, 'bg'); },
  });
  const deskPanel = mat('bs', {
    up(d) {
      d.rings(0, 0, d.w, d.h, [['bg', 0], ['bs', 3]]);
      d.rect(1, 1, 4, d.h - 2, 'ink', 1); for (let y = 2; y < d.h - 1; y += 1) d.hline(2, y, 1 + ((y * 3) % 3), 'led', y % 2 ? 2 : 3);
      dial(d, 5, 1, 3, { angle: 120 }); leds(d, 6, d.h - 2, 1, () => true);
      d.px(d.w - 2, 1, 'sig', 3); d.px(d.w - 2, 3, 'sig', 2);
    },
    side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : 2]); d.hline(0, d.h - 1, d.w, 'bg', 0); },
  }, { clean: true });
  const lampMat = mat('led', { side(d) { d.rect(0, 0, d.w, d.h, 'led', 3); d.px(0, 0, 'led', 4); }, up(d) { d.rect(0, 0, d.w, d.h, 'led', 4); } }, { flat: true });
  const chute = mat('bs', {
    side(d) { d.fill((x, y) => ['bs', y === 0 ? 4 : x % 4 === 0 ? 1 : 2]); d.hline(0, d.h - 1, d.w, 'bg', 0); },
    up(d) { d.fill((x, y) => ['slag', (x + 2 * y) % 5 === 0 ? 3 : (x * 3 + y) % 7 === 0 ? 0 : 2]); },
  });
  const chuteWall = mat('sig', { side(d) { d.fill((x, y) => ['sig', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); d.hline(0, 0, d.w, 'bg', 3); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'bs', 4); }, top(d) { d.fill((x) => ['bs', x % 3 ? 3 : 4]); } });
  const post = mat('bg', { side(d) { d.fill((x, y) => ['bg', x === 0 ? 3 : x === d.w - 1 ? 0 : y % 5 === 0 ? 1 : 2]); for (let y = 4; y < d.h; y += 10) d.px(1, y, 'bs', 4); d.stripes(0, d.h - 4, d.w, 3, ['sig', 3], ['bg', 1]); }, top(d) { d.inset(0, 0, d.w, d.h, 'bg'); } });
  const arcCore = mat('arc', { all(d) { d.fill((x, y) => ['arc', x === 0 || x === d.w - 1 ? 3 : 4]); } }, { flat: true });
  const arcFlash = mat('arc', { all(d) { d.radial((r) => ['arc', r < 1 ? 4 : r < 1.8 ? 3 : 2]); } }, { flat: true });
  const streamMat = mat('amber', { all(d) { d.fill((x, y) => ['amber', x === 0 ? 2 : (y + x) % 4 === 0 ? 4 : 3]); } }, { clean: true });

  // ---------------------------------------------------------------- static base
  b.box('plinth', [-26, 0, -14], [12, 2, 30], plinth);
  b.box('rocker_n', [-18, 2, -1], [4, 5, 2], rocker);
  b.box('rocker_s', [-18, 2, 14], [4, 5, 17], rocker);
  b.box('pin_bearing_n', [3, 2, -7], [9, 8.5, -0.5], bearing);
  b.box('pin_bearing_s', [3, 2, 16.5], [9, 8.5, 23], bearing);

  // ---------------------------------------------------------------- vessel on its tilt pin
  b.group('vessel', PIVOT, () => {
    b.prism('hearth', [V[0], 7, V[1]], HEARTH_R, 4, 'y', hearthMat, 12, { hide: ['up'] });
    b.box('hearth#7', [4, 3, -6.5], [8, 7, 22.5], pin);
    b.prism('shell', [V[0], (9 + MELT) / 2, V[1]], SHELL_R, MELT - 9, 'y', shellMats[0], 12, { mats: shellMats });
    BANDS.forEach(([y0, y1], i) => b.prism(`band_${i + 1}`, [V[0], (y0 + y1) / 2, V[1]], BAND_R, y1 - y0, 'y', bandMats[0], 12, { mats: bandMats }));
    b.box('spout#1', [9, 24, 5], [19, 25.5, 11], spout);
    b.box('spout#2', [9, 25.5, 5], [19, 28, 6.5], spoutWall);
    b.box('spout#3', [9, 25.5, 9.5], [19, 28, 11], spoutWall);
    b.box('spout#4', [9.5, 21, 6.5], [12, 24, 9.5], spoutWall);
    for (const [i, x, z] of EL) {
      b.group(`arc_${i}`, [x, MELT - 0.5, z], () => {
        b.box(`arc_${i}#1`, [x - 0.7, MELT - 0.5, z - 0.7], [x + 0.7, TIP + 0.4, z + 0.7], arcCore);
        b.box(`arc_${i}#2`, [x - 2.2, MELT + 0.05, z - 2.2], [x + 2.2, MELT + 0.5, z + 2.2], arcFlash);
        b.box(`arc_${i}#3`, [x + 0.7, MELT + 0.6, z - 0.4], [x + 1.5, TIP - 0.8, z + 0.4], arcCore, { origin: [x + 0.7, MELT + 0.6, z], rotation: [0, 0, i === 2 ? -20 : 20] });
      });
    }
    b.group('stream', [18.25, 24.4, 8], () => b.box('stream', [17.5, 23.9, 7.25], [19, 24.4, 8.75], streamMat));
  });

  // ---------------------------------------------------------------- mast, crosshead, roof, electrodes
  const BEAM_Y = ROOF_Y + 3;
  for (const [s, x0] of [['w', -21], ['e', 3]]) b.box(`sleeve_${s}`, [x0, 0, -28.5], [x0 + 6, 36, -22.5], sleeve);
  b.group('gantry', [-6, BEAM_Y, -25.5], () => {
    b.box('gantry#1', [-22, BEAM_Y, -29], [10, BEAM_Y + 6, -22], beam);
    for (const [k, x0] of [[2, -20], [3, 4]]) b.box(`gantry#${k}`, [x0, 26, -27.5], [x0 + 4, BEAM_Y + 0.5, -23.5], column);
    b.box('gantry#4', [-14, ROOF_Y, -22], [2, ROOF_Y + 3, -6.5], hanger);
    b.prism('roof', [V[0], ROOF_Y + ROOF_H / 2, V[1]], ROOF_R, ROOF_H, 'y', roofMats[0], 12, { mats: roofMats });
    b.prism('delta', [V[0], ROOF_Y + ROOF_H + 1, V[1]], DELTA_R, 2, 'y', deltaMats[0], 12, { mats: deltaMats, hide: ['down'] });
    for (const [i, x] of EL) b.box(`guide_${i}`, [x - 2, BEAM_Y + 0.01, -22], [x + 2, 63, -20.5], guide);
    b.box('gantry#5', [-14.5, 62.5, -22.5], [2.5, 64, -20.4], guideBar);
    // flexible secondary cables from the bus terminal up to the crosshead (they ride with the mast)
    b.box('gantry#6', [9.6, 31, -21.99], [11, BEAM_Y + 0.5, -20.5], cableMat, { hide: ['down'] });
    b.box('gantry#7', [8, 33, -21.99], [9.4, BEAM_Y + 0.5, -20.5], cableMat);
    b.box('gantry#8', [7.8, 31, -22.2], [11.2, 33, -20.3], cableLug);
    for (const [i, x, z] of EL) {
      b.group(`electrode_${i}`, [x, CLAMP_Y + 2, z], () => {
        b.prism(`electrode_${i}`, [x, (TIP + EL_TOP) / 2, z], EL_R, EL_TOP - TIP, 'y', electrodeMat, 8, { spin: 11.25 });
        b.box(`electrode_${i}#5`, [x - 4, CLAMP_Y, z - 4], [x + 4, CLAMP_Y + 4, z + 4], clamp);
        b.box(`electrode_${i}#6`, [x - 1.5, CLAMP_Y + 0.8, -20.5], [x + 1.5, CLAMP_Y + 3.8, z - 4], arm);
      });
    }
  });

  // ---------------------------------------------------------------- transformer and bus bars
  b.box('pad', [12, 0, -32], [31, 3, -10], plinth);
  b.box('house', [13, 3, -31], [28, 28, -12], house);
  b.box('house_cap', [12.5, 28, -31.5], [28.5, 29.5, -11.5], houseCap);
  [-29, -25, -21, -17].forEach((z, i) => b.box(`fin_${i + 1}`, [28, 6, z], [31, 25, z + 1.5], fin));
  [[16.5, -27.5], [21, -25.5], [25.5, -23.5]].forEach(([x, z], i) => {
    b.box(`bushing_${i + 1}`, [x - 1.5, 29.5, z - 1.5], [x + 1.5, 34.5, z + 1.5], bushing);
    b.box(`bus_${i + 1}#1`, [x - 0.8, 34.5, z - 0.8], [x + 0.8, 39, z + 0.8], busMat);
    b.box(`bus_${i + 1}#2`, [11, 37.4, z - 0.8], [x - 0.8, 39, z + 0.8], busMat);
  });
  b.box('bus_terminal', [9, 29, -29], [11, 41, -22], terminal);
  b.box('bus_bracket', [12.6, 29.5, -28.8], [14.2, 37.4, -22.2], bracketMat);

  // ---------------------------------------------------------------- ladle, mould, out port
  b.box('ladle_car', [14, 0.5, 0], [30, 4, 16], car);
  for (const [x, z] of [[15, -0.5], [25, -0.5], [15, 16], [25, 16]]) b.box(`wheel_${x}_${z < 0 ? 'n' : 's'}`, [x, 0, z], [x + 4, 3.5, z + 0.5], wheel);
  b.prism('ladle', [22, 8.75, 8], 6, 9.5, 'y', ladleStave, 8);
  b.prism('ladle_rim', [22, 12.5, 8], 6.8, 1.8, 'y', ladleRim, 8);
  b.box('ladle_pin_n', [21, 8, 1.2], [23, 10, 2.2], pin);
  b.box('ladle_pin_s', [21, 8, 13.8], [23, 10, 14.8], pin);
  b.box('mould', [28, 4, 4], [30, 9, 12], mould);
  b.box('port_out', [30, 2, 2], [32, 14, 14], portOut);

  // ---------------------------------------------------------------- charging chute, in port
  b.box('port_in', [-32, 34, 2], [-30.5, 46, 14], portIn);
  b.box('hopper', [-30.5, 35, 2.5], [-25, 44.5, 13.5], hopper);
  b.box('hopper_rim', [-30.5, 44.5, 0.5], [-23.5, 47, 15.5], hopper);
  const CH = { origin: [-23.25, 37.5, 8], rotation: [0, 0, -18] };
  b.box('chute#1', [-25.5, 36, 4], [-21, 37.5, 12], chute, CH);
  b.box('chute#2', [-25.5, 37.5, 4], [-21, 39.5, 5.5], chuteWall, CH);
  b.box('chute#3', [-25.5, 37.5, 10.5], [-21, 39.5, 12], chuteWall, CH);
  b.box('hopper_funnel', [-29.5, 32, 4.5], [-25.5, 35, 11.5], funnel);
  b.box('chute_post', [-29, 0, 6.5], [-26, 32, 9.5], post);

  // ---------------------------------------------------------------- operator desk on the south-west corner
  b.box('desk', [-26, 2, 23], [-17, 9, 29], desk);
  b.box('desk_panel', [-25.8, 8.9, 23.5], [-17.2, 10.5, 28.5], deskPanel, { origin: [-21.5, 9.5, 26], rotation: [18, 0, 0] });
  b.box('beacon_post', [-25.5, 9, 28], [-24.5, 15, 29], pin);
  b.box('beacon', [-26, 15, 27.5], [-24, 17, 29.5], lampMat);
  // ---------------------------------------------------------------- animation
  const L = 6;
  const y = (v) => [0, v, 0];
  // each electrode regulates its own arc length in small steps, then all lift clear for the pour
  const plan = [
    [[0, 0], [0.6, -1], [1.4, -2], [2.3, -1], [3.1, -2.5], [3.8, -2.5], [4.4, LIFT, 0.55], [5.4, LIFT], [6, 0, 0.55]],
    [[0, 0], [0.9, -2], [1.7, -1], [2.6, -3], [3.3, -2], [3.8, -2], [4.4, LIFT, 0.55], [5.4, LIFT], [6, 0, 0.55]],
    [[0, 0], [0.4, -1.5], [1.2, -0.5], [2.0, -2], [2.9, -1], [3.8, -1], [4.4, LIFT, 0.55], [5.4, LIFT], [6, 0, 0.55]],
  ];
  const ARC = TIP + 0.4 - (MELT - 0.5);
  const tracks = {};
  plan.forEach((p, q) => {
    const i = EL[q][0], pos = steps(p, y);
    tracks[`electrode_${i}`] = { position: pos };
    const at = (t) => { const k = pos.findIndex(([a]) => a >= t); if (k <= 0) return pos[Math.max(0, k)][1][1]; const [a0, v0] = pos[k - 1], [a1, v1] = pos[k]; return v0[1] + (v1[1] - v0[1]) * (t - a0) / (a1 - a0); };
    // the arc follows the tip and flickers across; it breaks as soon as the electrode lifts
    const keys = [];
    for (let s = 0; s <= L * 20; s++) {
      const t = s / 20, o = at(t);
      const w = s === 0 || s === L * 20 ? 1 : 0.55 + 0.9 * hsh(s, q, 5);
      keys.push([t, [w, o > 0.05 ? 0.04 : (ARC + o) / ARC, w]]);
    }
    tracks[`arc_${i}`] = { scale: keys };
  });
  tracks.vessel = { rotation: [[0, [0, 0, 0]], ...tween(4.5, 4.9, 0, TILT, (v) => [0, 0, v], 8), ...tween(5.2, 5.6, TILT, 0, (v) => [0, 0, v], 8).slice(1), [L, [0, 0, 0]]] };
  const STREAM = (24.4 - 14.5) / 0.5;
  tracks.stream = { scale: [[0, [1, 1, 1]], [4.75, [1, 1, 1]], [4.95, [1, STREAM, 1]], [5.2, [1, STREAM, 1]], [5.4, [1, 1, 1]], [L, [1, 1, 1]]] };
  b.anim('working', L, tracks);

  // packaged: crosshead and roof lowered on the telescoping mast, electrodes drawn up, arcs off;
  // deploy raises the mast, then lowers the electrodes and strikes the arcs
  const D = 4, off = [1, 0.04, 1], on = [1, 1, 1];
  const pk = { gantry: { position: [[0, y(PACK)]] } };
  for (const [i] of EL) { pk[`electrode_${i}`] = { position: [[0, y(PACK_LIFT)]] }; pk[`arc_${i}`] = { scale: [[0, off]] }; }
  b.anim('packaged', 0.5, pk);
  b.anims[b.anims.length - 1].loop = 'hold';
  const dp = { gantry: { position: tween(0, 2.4, PACK, 0, y, 16).concat([[D, y(0)]]) } };
  for (const [i] of EL) {
    dp[`electrode_${i}`] = { position: [[0, y(PACK_LIFT)], ...tween(2.5, 3.6, PACK_LIFT, 0, y, 10), [D, y(0)]] };
    dp[`arc_${i}`] = { scale: [[0, off], [3.6, off], [3.8, on], [D, on]] };
  }
  b.anim('deploy', D, dp);
  b.anims[b.anims.length - 1].loop = 'hold';
}
