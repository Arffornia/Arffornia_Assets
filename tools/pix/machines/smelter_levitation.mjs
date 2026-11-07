// Smelter Mk3, tier 7 (control era), lineage `rethink`: electromagnetic levitation melting. Ore enters on the
// west face, rides a lift tube up the wall and drops through the roof into a segmented, water-cooled copper
// "cold crucible" set in a stack of induction coils. The field holds the charge off the copper fingers: an
// amber-white ball of molten metal floats and turns in mid-air, watched by an optical pyrometer. Cut the
// field and it drops into the mould below; a robot arm takes the cooled ingot off the ejection tray and
// drops it into the east output chute. A chiller on the east side feeds the coolant lines.
import { addRamp } from '../pix.mjs';
import { pipe } from '../parts.mjs';
import { armAngles, track, ringOfBoxes, voxelBall, unwrapPoses } from '../lev_helpers.mjs';

addRamp('gph', ['#181514', '#292423', '#3b3533', '#564e4b', '#837873'], { clusters: 0.02, streaks: 0.03 });
addRamp('ora', ['#4a1a0a', '#a8421a', '#d9652a', '#f0863e', '#ffb36e'], { clusters: 0.02 });
addRamp('cu', ['#2c1010', '#6b2a1c', '#9e4a2c', '#c86c40', '#eba071'], { clusters: 0.04, streaks: 0.03 });
addRamp('trm', ['#25252a', '#43444b', '#65666e', '#8b8c94', '#b9bac0']);
addRamp('mol', ['#7a2400', '#d9560a', '#ff8a1f', '#ffc861', '#fff6d6'], null, { glow: true });
addRamp('gls', ['#173238', '#24474f', '#3c6b74', '#6aa3a8', '#bfeeee']);
addRamp('vd', ['#08080c', '#121219', '#1c1c26', '#292937', '#3c3c50']);

const CX = -3, CZ = 0;             // crucible axis
const BALL = [CX, 37, CZ], BALL_R = 4.5;
const S = [17, 12], L1 = 11, L2 = 11; // arm plane z: upper 16..19, forearm 19..21.5
const ZU = [16, 19], ZF = [19, 21.5];
const PICK = [8, 15.5], LIFT = [8, 22], OVER = [0, 22], DROP = [0, 20.5];
const FOLD = { shoulder: 60, elbow: -210, wrist: -210 }; // forearm folded back over the upper arm, gripper hanging
const SHIELD_UP = 18;

export const meta = {
  title: 'Smelter Mk3 (levitation melter)', note: 'Ore to ingots: an induction field melts the charge in mid-air above a cold copper crucible. Tier 7.',
  footprint: [3, 3], height: 4, tier: 7, lineage: 'rethink',
  ports: [{ id: 'in', kind: 'item', face: 'west', cell: [1, 0] }, { id: 'out', kind: 'item', face: 'south', cell: [1, 0] }],
  joints: {
    charge: { type: 'free', why: 'the molten charge is held by the induction field, not by a mechanical joint' },
    flow_1: { type: 'free', why: 'a glow pulse: the coolant flow lamp swells, light not matter' },
    flow_2: { type: 'free', why: 'a glow pulse: the coolant flow lamp swells, light not matter' },
    shield: { type: 'prismatic', axis: 'y', min: 0, max: SHIELD_UP },
    shoulder: { type: 'revolute', axis: 'z', min: -70, max: 70 },
    elbow: { type: 'revolute', axis: 'z', min: -240, max: 60 },
    wrist: { type: 'revolute', axis: 'z', min: -240, max: 90 },
  },
  lint: { allow: [
    { a: 'coil_*', b: 'core#*', check: 'overlap', why: 'the induction turns are wound round the coil former' },
    { a: 'charge#*', b: 'pyro_beam', check: 'overlap', why: 'the pyrometer beam is light aimed at the molten charge' },
    { a: 'upper#*', b: 'yoke#2', check: 'overlap', why: 'the shoulder pin passes through the hub of the upper arm' },
    { a: 'fore#2', b: 'wrist#1', check: 'overlap', why: 'the wrist knuckle turns on the end pin of the forearm' },
    { a: 'pyro*', check: 'cantilever', why: 'the pyrometer beam is light and carries no load' },
    { a: 'charge*', check: 'cantilever', why: 'the charge is held up by the induction field, not by the beam' },
  ] },
};
export const look = { glow: 1.4 };

const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

// smooth enamel panel: lit top edge and left, shaded bottom and right, a soft light map inside
function bevel(d, x, y, w, h, ramp) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let k = j < h * 0.3 ? 3 : 2;
    if (j === 0) k = 4; else if (i === 0) k = 3; else if (j === h - 1 || i === w - 1) k = 1;
    d.px(x + i, y + j, ramp, k);
  }
}
// glass insert painted on a panel: teal-grey pane with a diagonal glint, framed in graphite
function insert(d, x, y, w, h) {
  d.rect(x, y, w, h, 'gph', 0);
  d.fill((i, j) => {
    if (i <= x || j <= y || i >= x + w - 1 || j >= y + h - 1) return null;
    const g = (i - x + (j - y)) % 9;
    return ['gls', g === 0 ? 4 : g === 1 ? 3 : j === y + 1 ? 1 : 2];
  });
}

export function build(b, { mat }) {
  // ---------------------------------------------------------------- materials
  const plinth = mat('gph', {
    side(d) { d.fill((x, y) => ['gph', y === 0 ? 4 : x % 16 === 15 ? 0 : x % 16 > 4 && x % 16 < 10 && y === 1 ? 0 : 2]); for (let x = 2; x < d.w; x += 16) d.px(x, 1, 'trm', 4); for (let x = 11; x < d.w; x += 32) d.px(x, 1, 'teal', 3); },
    top(d) { d.rings(0, 0, d.w, d.h, [['gph', 0], ['gph', 3]]); },
  });
  const deck = mat('gph', {
    side(d) { d.hline(0, 0, d.w, 'gph', 4); d.hline(0, d.h - 1, d.w, 'gph', 0); for (let x = 4; x < d.w; x += 8) d.rect(x, 0, 3, 1, x % 16 === 4 ? 'ora' : 'gph', 3); },
    top(d) {
      d.courses(0, 0, d.w, d.h, 'gph', 8, 16);
      d.rings(0, 0, d.w, d.h, [['gph', 4], ['gph', 1]]);
      for (let x = 5; x < d.w - 4; x += 12) { d.px(x, 3, 'trm', 4); d.px(x, d.h - 4, 'trm', 3); }
      // hatched walkway stripe along the south edge, in house colours
      d.stripes(2, d.h - 3, d.w - 4, 1, ['ora', 2], ['gph', 0]);
    },
  });

  // lower housing: orange enamel panels with glass inserts, graphite frame and louvres
  const housing = mat('ora', {
    side(d) {
      d.rect(0, 0, d.w, d.h, 'gph', 2); d.hline(0, 0, d.w, 'gph', 4); d.hline(0, d.h - 1, d.w, 'gph', 0);
      const n = Math.max(1, Math.round(d.w / 16)), pw = d.w / n;
      for (let k = 0; k < n; k++) {
        const x0 = Math.round(k * pw) + 1, w = Math.round(pw) - 2;
        bevel(d, x0, 2, w, d.h - 4, 'ora');
        if (k % 2 === 0) insert(d, x0 + 2, 4, w - 4, 4);
        else d.vent(x0 + 2, 4, w - 4, 5, 'gph');
        d.px(x0 + 1, d.h - 3, 'gph', 0); d.px(x0 + w - 2, d.h - 3, 'gph', 0);
      }
    },
    up(d) {
      // chamber floor: graphite plate with radial drain grooves round the crucible seat
      d.rect(0, 0, d.w, d.h, 'gph', 1);
      d.rings(0, 0, d.w, d.h, [['gph', 4], ['gph', 0]]);
      d.radial((r, a) => (r > 15 ? (near(a, 45) < 2 ? ['gph', 0] : null) : r > 12 ? ['gph', near(a, 30) < 5 ? 0 : 3] : null), { cx: CX + 20, cy: CZ + 18 });
    },
  });
  const post = mat('gph', {
    side(d) {
      d.fill((x, y) => ['gph', x === 0 ? 4 : x === d.w - 1 ? 0 : y % 8 === 0 ? 1 : y % 8 === 1 ? 3 : 2]);
      for (let y = 4; y < d.h; y += 8) d.px(1, y, 'trm', 4);
      d.px(Math.floor(d.w / 2), 3, 'ora', 3); d.px(Math.floor(d.w / 2), 4, 'gph', 0);
      d.rect(1, d.h - 3, d.w - 2, 1, 'ora', 2);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gph'); },
  });
  const glass = mat('gls', { all(d) {
    d.fill((x, y) => { const g = (x + y) % 13; return ['gls', g === 0 ? 4 : g === 1 || g === 6 ? 3 : y % 16 === 15 ? 1 : 2]; });
    d.hline(0, 0, d.w, 'gls', 4); d.hline(0, d.h - 1, d.w, 'gls', 0);
  } }, { clean: true });
  const wall = mat('ora', {
    side(d) {
      d.rect(0, 0, d.w, d.h, 'gph', 1);
      bevel(d, 1, 1, d.w - 2, d.h - 2, 'ora');
      d.brokenRings(2, 2, d.w - 4, d.h - 4, [[0, 'ora', 1], [2, 'ora', 3]], { breaks: 0.3 });
      insert(d, 5, 6, d.w - 10, 6);
      d.vent(5, d.h - 9, d.w - 10, 5, 'gph');
      d.px(3, 3, 'teal', 4); d.px(d.w - 4, 3, 'gph', 0);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gph'); },
  });
  const cap = mat('gph', {
    side(d) { d.hline(0, 0, d.w, 'gph', 4); d.hline(0, d.h - 1, d.w, 'gph', 0); for (let x = 3; x < d.w - 2; x += 8) d.rect(x, 1, 3, 1, x % 16 === 3 ? 'ora' : 'trm', 3); d.px(Math.floor(d.w / 2), 1, 'teal', 3); },
    up(d) {
      d.courses(0, 0, d.w, d.h, 'gph', 11, 17);
      d.rings(0, 0, d.w, d.h, [['gph', 4], ['gph', 1]]);
      for (const [x, y] of [[2, 2], [d.w - 3, 2], [2, d.h - 3], [d.w - 3, d.h - 3]]) d.bolt(x, y, 'trm');
      // service walkway: a grille along the south edge and a cable trench from the riser to the crown
      d.vent(3, d.h - 6, 14, 3, 'gph', 'v');
      d.stripes(1, d.h - 2, d.w - 2, 1, ['ora', 2], ['gph', 0], { width: 3 });
      d.rect(1, Math.floor(d.h / 2) - 1, 8, 2, 'gph', 0); d.hline(1, Math.floor(d.h / 2) - 1, 8, 'trm', 2);
      d.brokenRings(d.w - 12, 3, 9, 9, [[0, 'gph', 3], [2, 'gph', 0]]);
    },
    down(d) { d.rect(0, 0, d.w, d.h, 'gph', 1); d.rings(4, 4, d.w - 8, d.h - 8, [['teal', 1], ['gph', 0]]); },
  });
  const crown = mat('ora', {
    side(d) { bevel(d, 0, 0, d.w, d.h, 'ora'); d.vent(2, 2, d.w - 4, d.h - 4, 'gph'); d.px(1, 1, 'teal', 4); },
    south(d) {
      bevel(d, 0, 0, d.w, d.h, 'ora');
      d.rect(0, 0, 11, d.h, 'gph', 0);
      d.hexMark(1, 0, { rim: ['teal', 3], faces: [['ora', 4], ['ora', 2], ['ora', 1]] });
      d.rect(12, 2, d.w - 14, 1, 'teal', 3); d.rect(12, 4, d.w - 16, 1, 'teal', 2); d.px(d.w - 2, d.h - 2, 'gph', 0);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'ora'); },
  });
  const lid = mat('gph', {
    side(d) { d.hline(0, 0, d.w, 'gph', 4); d.hline(0, d.h - 1, d.w, 'gph', 0); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'trm', 3); },
    up(d) { d.inset(0, 0, d.w, d.h, 'gph'); d.checker(3, 3, d.w - 6, d.h - 6, 'gph', 2, 1, 3); },
  });
  const bank = mat('gph', {
    side(d) { d.rect(0, 0, d.w, d.h, 'gph', 2); d.hline(0, 0, d.w, 'gph', 4); bevel(d, 1, 1, d.w - 2, 2, 'ora'); d.fill((x, y) => (y > 3 && y < d.h - 1 && x % 2 === 1 ? ['gph', 0] : null)); d.px(d.w - 2, 1, 'teal', 4); },
    up(d) { d.inset(0, 0, d.w, d.h, 'gph'); for (let x = 1; x < d.w - 1; x += 2) for (let y = 1; y < d.h - 1; y += 2) d.bolt(x, y, 'trm'); },
  });
  const beacon = mat('teal', { side(d) { d.rect(0, 0, d.w, d.h, 'teal', 3); d.px(0, 0, 'teal', 4); }, up(d) { d.rect(0, 0, d.w, d.h, 'teal', 4); } }, { flat: true });

  // coil former and turns: wrap faces are the y-prism's sides, caps are top/down
  const core = mat('gph', {
    side(d) { d.fill((x, y) => ['gph', y % 4 === 3 ? 0 : x === 0 ? 3 : 1]); d.vline(Math.floor(d.w / 2), 0, d.h, 'trm', 3); },
    top(d) { d.radial((r, a) => (r > 7 ? ['gph', 3] : r > 5 ? ['cu', near(a, 30) < 4 ? 1 : 2] : ['gph', 0])); },
  }, { clean: true });
  const coil = (k) => mat('cu', {
    side(d) {
      d.fill((x, y) => ['cu', y === 0 ? ((x + k) % 6 === 2 ? 3 : 4) : y === d.h - 1 ? ((x + k) % 4 === 0 ? 0 : 1) : (x + k * 3) % 7 === 0 ? 1 : (x + k) % 5 === 1 ? 2 : 3]);
      d.rect((k * 5) % Math.max(1, d.w - 2), 0, 1, d.h, 'gph', 1);
      if (k % 3 === 1) d.rect(Math.floor(d.w / 2) - 1, 0, 2, d.h, 'gph', 2);
      if (k % 2 === 0) d.px(Math.floor(d.w / 2), 1, 'cu', 4);
    },
    top(d) { d.radial((r, a) => (r > 10.4 ? ['cu', 4] : r > 9.6 ? ['cu', 1] : r > 8.6 ? ['cu', near(a, 30) < 3 ? 1 : 3] : ['gph', near(a, 60) < 8 ? 0 : 2])); },
  }, { clean: true });
  const coilMats = [0, 1, 2, 3, 4, 5].map(coil);
  const lead = mat('cu', { all(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : x % 3 === 0 ? 1 : 3]); } }, { clean: true });
  const crucible = mat('cu', {
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : y === d.h - 1 ? 0 : 2]); d.px(1, 0, 'teal', 3); },
    top(d) { d.radial((r, a) => (r > 7 ? ['cu', 4] : r > 6 ? ['cu', 1] : r > 3 ? ['cu', near(a, 45, 22.5) < 6 ? 0 : 3] : ['mol', r < 1.5 ? 3 : 1])); },
  }, { clean: true });
  // cold-crucible fingers: copper segments split by dark slits, a water channel in each
  const finger = mat('cu', {
    side(d) { d.fill((x, y) => ['cu', x === 0 ? 4 : x === d.w - 1 ? 0 : y === 0 ? 4 : y % 3 === 0 ? 2 : 3]); },
    west(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : x === 0 ? 3 : 2]); d.vline(Math.floor(d.w / 2), 1, d.h - 2, 'mol', 1); },
    up(d) { d.rect(0, 0, d.w, d.h, 'cu', 4); d.px(0, 0, 'trm', 4); },
  }, { clean: true });
  // the charge: amber-white core, cooler skin bands that make the turn readable
  const charge = mat('mol', { all(d) {
    const cx = (d.w - 1) / 2, cy = (d.h - 1) / 2;
    d.fill((x, y) => {
      const r = Math.hypot((x - cx) / Math.max(1, cx), (y - cy) / Math.max(1, cy));
      if ((x + 2 * y) % 7 === 0 && r > 0.5) return ['mol', 1];
      return ['mol', r < 0.35 ? 4 : r < 0.75 ? 3 : 2];
    });
  } }, { clean: true });
  const pyro = mat('gph', {
    side(d) { d.plate(0, 0, d.w, d.h, 'gph'); d.px(1, 1, 'teal', 4); },
    south(d) { d.plate(0, 0, d.w, d.h, 'trm'); d.rect(1, 1, d.w - 2, d.h - 2, 'vd', 1); d.px(Math.floor(d.w / 2), Math.floor(d.h / 2), 'teal', 4); },
  });
  const beam = mat('teal', { all(d) { d.rect(0, 0, d.w, d.h, 'teal', 3); } }, { flat: true });

  // shield: orange transport shutter with house-colour hazard edge, a glass insert and the ingot slot
  const shield = mat('ora', {
    south(d) {
      d.rect(0, 0, d.w, d.h, 'gph', 1);
      bevel(d, 1, 1, d.w - 2, d.h - 3, 'ora');
      d.stripes(1, d.h - 3, d.w - 2, 2, ['ora', 3], ['gph', 0], { width: 2 });
      insert(d, 4, 3, 8, 5);
      d.rings(14, 3, d.w - 18, 5, [['gph', 0]]); d.screen(14, 3, d.w - 18, 5);
      d.rivets(2, 1, d.w - 4, 'trm', { step: 6 });
    },
    side(d) { d.fill((x, y) => ['gph', y === 0 ? 4 : 2]); },
    up(d) { d.rect(0, 0, d.w, d.h, 'gph', 3); d.hline(0, 0, d.w, 'ora', 4); },
  });
  const tray = mat('gph', {
    side(d) { d.hline(0, 0, d.w, 'trm', 4); d.fill((x, y) => (y > 0 && x % 4 === 0 ? ['gph', 0] : null)); d.px(1, 1, 'teal', 3); },
    up(d) { d.rect(0, 0, d.w, d.h, 'gph', 1); d.rings(0, 0, d.w, d.h, [['trm', 3]]); d.checker(1, 1, d.w - 2, d.h - 2, 'gph', 1, 0, 2); },
  });
  const ingot = mat('cu', {
    up(d) { d.rect(0, 0, d.w, d.h, 'trm', 3); d.rings(0, 0, d.w, d.h, [['trm', 4]]); d.px(1, 1, 'trm', 2); },
    side(d) { d.fill((x, y) => ['trm', y === 0 ? 4 : 2]); d.px(0, d.h - 1, 'trm', 1); },
  }, { clean: true });

  // robot arm: graphite links under orange covers, trim knuckles with a teal ring light
  const link = mat('gph', { all(d) { d.fill((x, y) => ['gph', y === 0 || x === 0 ? 4 : (x + y) % 5 === 0 ? 0 : (x * 3 + y) % 7 === 1 ? 3 : 2]); d.rivets(1, d.h - 2, d.w - 2, 'trm', { step: 4 }); } }, { clean: true });
  const cover = mat('ora', {
    side(d) { bevel(d, 0, 0, d.w, d.h, 'ora'); const L = Math.max(d.w, d.h); if (L > 8) { if (d.w > d.h) d.rect(2, Math.floor(d.h / 2), d.w - 4, 1, 'gph', 0); else d.rect(Math.floor(d.w / 2), 2, 1, d.h - 4, 'gph', 0); } d.px(1, 1, 'trm', 4); },
    top(d) { bevel(d, 0, 0, d.w, d.h, 'ora'); },
  }, { clean: true });
  const knuckle = mat('trm', {
    north(d) { d.radial((r, a) => (r < 0.8 ? ['gph', 0] : r < 1.6 ? ['ora', a < 180 ? 3 : 1] : ['trm', r > 1.9 ? 1 : 4])); },
    south(d) { d.radial((r, a) => (r < 0.8 ? ['gph', 0] : r < 1.6 ? ['ora', a < 180 ? 3 : 1] : ['trm', r > 1.9 ? 1 : 4])); },
    side(d) { d.fill((x, y) => ['trm', y === 0 ? 4 : x % 2 ? 2 : 3]); },
    top(d) { d.fill((x, y) => ['trm', x === 0 ? 4 : 2]); },
  }, { clean: true });
  const pedestal = mat('gph', {
    side(d) { d.rect(0, 0, d.w, d.h, 'gph', 2); d.hline(0, 0, d.w, 'gph', 4); d.stripes(1, d.h - 2, d.w - 2, 1, ['ora', 2], ['gph', 0]); d.px(1, 1, 'teal', 4); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gph'); d.rings(1, 1, d.w - 2, d.h - 2, [['trm', 3]]); },
  });
  const nameplate = mat('trm', { south(d) {
    d.rect(0, 0, d.w, d.h, 'trm', 3); d.hline(0, 0, d.w, 'trm', 4); d.hline(0, d.h - 1, d.w, 'trm', 1);
    for (let x = 1; x < d.w - 1; x++) if (x % 2 || x > d.w - 3) d.px(x, 1, 'gph', x % 3 ? 0 : 1);
  } }, { clean: true });

  // ports, feed and coolant
  const collar = (axisFace) => mat('gph', {
    [axisFace](d) { d.rings(0, 0, d.w, d.h, [['trm', 3], ['ora', 2], ['gph', 0]]); d.rect(3, 3, d.w - 6, d.h - 6, 'vd', 1); d.hline(3, 3, d.w - 6, 'vd', 0); d.px(3, d.h - 4, 'teal', 3); },
    side(d) { d.fill((x, y) => ['trm', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) d.px(0, y, 'gph', 0); },
  });
  const boxMat = mat('gph', {
    side(d) { d.rect(0, 0, d.w, d.h, 'gph', 2); d.hline(0, 0, d.w, 'gph', 4); bevel(d, 1, 2, d.w - 2, Math.max(2, d.h - 4), 'ora'); d.px(2, 3, 'teal', 3); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gph'); },
  });
  const pipeMat = mat('trm', { all(d) {
    const along = d.w >= d.h;
    d.fill((x, y) => { const t = along ? x : y, c = along ? y : x, A = along ? d.h : d.w; return ['trm', c === 0 ? 4 : c === A - 1 ? 1 : t % 5 === 2 ? 2 : 3]; });
  } }, { clean: true });
  const flange = mat('cu', { all(d) { d.rect(0, 0, d.w, d.h, 'cu', 2); d.hline(0, 0, d.w, 'cu', 4); d.vline(0, 0, d.h, 'cu', 3); d.px(d.w - 1, d.h - 1, 'cu', 0); } }, { clean: true });
  const chiller = mat('gph', {
    side(d) {
      d.rect(0, 0, d.w, d.h, 'gph', 2); d.hline(0, 0, d.w, 'gph', 4);
      bevel(d, 1, 1, d.w - 2, 4, 'ora'); d.px(2, 2, 'teal', 4); d.px(4, 2, 'teal', 2);
      d.vent(1, 6, d.w - 2, d.h - 8, 'gph', 'v');
      d.hline(1, d.h - 1, d.w - 2, 'gph', 0);
    },
    east(d) {
      d.rect(0, 0, d.w, d.h, 'gph', 2); d.hline(0, 0, d.w, 'gph', 4);
      d.vent(1, 5, d.w - 2, d.h - 7, 'gph', 'v');
      d.rect(2, 1, d.w - 4, 3, 'trm', 3); for (let x = 3; x < d.w - 3; x += 2) d.px(x, 2, 'gph', 0);
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gph'); d.checker(2, 2, d.w - 4, d.h - 4, 'gph', 1, 1, 3); d.rings(1, 1, d.w - 2, d.h - 2, [['ora', 2]]); },
  });
  const gripLamp = mat('teal', { all(d) { d.rect(0, 0, d.w, d.h, 'teal', 4); } }, { flat: true });
  const chuteMat = mat('gph', {
    side(d) { d.rect(0, 0, d.w, d.h, 'gph', 2); d.hline(0, 0, d.w, 'trm', 4); bevel(d, 1, 2, d.w - 2, d.h - 4, 'ora'); d.rect(2, 4, d.w - 4, 1, 'gph', 0); d.px(2, 3, 'teal', 3); d.hline(1, d.h - 1, d.w - 2, 'gph', 0); },
    up(d) { d.rect(0, 0, d.w, d.h, 'trm', 3); d.rings(0, 0, d.w, d.h, [['trm', 4]]); d.inset(1, 1, d.w - 2, d.h - 2, 'vd'); d.fill((x, y) => (x > 1 && x < d.w - 2 && y > 1 && y < d.h - 2 && (x + y) % 4 === 0 ? ['trm', 1] : null)); },
  });
  const flowLamp = mat('teal', { side(d) { d.rect(0, 0, d.w, d.h, 'teal', 3); d.px(0, 0, 'teal', 4); }, top(d) { d.rect(0, 0, d.w, d.h, 'teal', 4); } }, { flat: true });
  const screenBox = (face) => mat('gph', {
    [face](d) { d.screen(0, 0, d.w, d.h); d.px(1, d.h - 2, 'ora', 3); },
    side(d) { d.fill((x, y) => ['gph', y === 0 ? 4 : 2]); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gph'); },
  });

  // ---------------------------------------------------------------- static base
  b.box('plinth', [-24, 0, -24], [24, 2, 24], plinth);
  b.box('deck', [-23, 2, -23], [23, 4, 23], deck);
  b.box('housing', [-20, 4, -18], [12, 14, 14], housing);
  for (const [n, x0, z0] of [['sw', -20, 10], ['se', 8, 10], ['nw', -20, -18], ['ne', 8, -18]]) b.box(`post_${n}`, [x0, 14, z0], [x0 + 4, 48, z0 + 4], post);
  b.box('glass_s', [-16, 14, 12], [8, 48, 13], glass);
  b.box('glass_e', [10.5, 14, -14], [11.5, 48, 10], glass);
  b.box('wall_n', [-16, 14, -18], [8, 48, -16], wall);
  b.box('wall_w', [-20, 14, -14], [-18, 48, 10], wall);
  b.box('cap', [-21, 48, -19], [13, 51, 15], cap);
  b.box('crown', [-12, 51, -10], [4, 60, 6], crown);
  b.box('lid', [-13, 60, -11], [5, 62, 7], lid);
  b.box('beacon', [-5, 62, -3], [-3, 64, -1], beacon);
  // capacitor banks for the induction supply, on the roof
  b.box('bank_1', [5, 51, -17], [11, 56, -11], bank);
  b.box('bank_2', [5, 51, 8], [11, 55, 13], bank);
  b.box('busbar', [4, 51, -15], [5, 53, -9], lead);

  // ---------------------------------------------------------------- the melt cell
  b.prism('core', [CX, 21.75, CZ], 8, 15.5, 'y', core, 12);
  [16.5, 20, 23.5, 27].forEach((y, i) => b.prism(`coil_${i + 1}`, [CX, y, CZ], 11, 3, 'y', coilMats[i], 12, { mats: coilMats }));
  b.box('lead_1', [CX - 3, 16, -16], [CX - 1, 18, CZ - 10.5], lead);
  b.box('lead_2', [CX + 1, 26.5, -16], [CX + 3, 28.5, CZ - 10.5], lead);
  b.prism('crucible', [CX, 30.5, CZ], 8, 2, 'y', crucible, 12);
  ringOfBoxes(b, 'finger', [CX, 31.4, CZ], 7, 8, [2, 3.8, 2], finger, { phase: 22.5 });
  b.box('pyro', [CX - 2, BALL[1] - 2, -16], [CX + 2, BALL[1] + 2, -13], pyro);
  b.box('pyro_beam', [CX - 0.25, BALL[1] - 0.25, -13], [CX + 0.25, BALL[1] + 0.25, CZ], beam);
  b.group('charge', BALL, () => voxelBall(b, 'charge', BALL, BALL_R, charge, { flat: 3.5 }));

  // ---------------------------------------------------------------- feed (west) and output (east)
  b.box('port_in', [-24, 2, -5], [-23, 14, 5], collar('west'));
  b.box('feeder', [-23, 4, -4], [-20, 12, 4], boxMat);
  pipe(b, 'riser', [-23, 12, -1.5], 'y', 36, 3, pipeMat, { flange, every: 8, first: 5 });
  b.box('riser_head', [-24, 48, -3], [-21, 53, 3], boxMat);
  b.box('duct', [-21, 51, -1.5], [-12, 53.5, 1.5], pipeMat);
  b.box('screen_w', [-21, 26, -12], [-20, 36, -4], screenBox('west'));
  b.box('screen_n', [-12, 28, -19], [-2, 36, -18], screenBox('north'));

  // mould hatch tray (west) and the output chute down to the south port
  b.box('tray', [5, 4, 15], [11.5, 7, 21], tray);
  b.box('ingot', [6.5, 7, 17], [9.5, 9, 21], ingot);
  b.box('chute', [-4, 4, 15], [4, 13, 23], chuteMat);
  b.box('port_out', [-5, 2, 23], [5, 14, 24], collar('south'));
  b.box('console', [12, 6, -6], [14, 15, 6], screenBox('east'));

  // chiller and coolant lines into the north-east post
  b.box('chiller', [12, 4, -21], [21, 15, -9], chiller);
  pipe(b, 'cool_s', [14, 15, -17.5], 'y', 11, 2, pipeMat, { flange, every: 4, first: 2 });
  pipe(b, 'cool_s_in', [14, 24, -17.5], 'x', -2, 2, pipeMat, { flange, ends: true });
  pipe(b, 'cool_r', [17, 15, -15.5], 'y', 23, 2, pipeMat, { flange, every: 6, first: 4 });
  pipe(b, 'cool_r_in', [17, 36, -15.5], 'x', -5, 2, pipeMat, { flange, every: 3, first: 2 });
  b.group('flow_1', [16.4, 23.5, -16.5], () => b.box('flow_1', [16, 22.6, -17.2], [16.8, 24.4, -15.8], flowLamp));
  b.group('flow_2', [19.5, 28, -14.5], () => b.box('flow_2', [19, 27, -15.5], [20, 29, -13.5], flowLamp));

  // ---------------------------------------------------------------- robot arm (plane z ~ 18)
  b.box('pedestal', [13.5, 4, 14.5], [20.5, 7, 21.5], pedestal);
  b.box('turret', [14.5, 7, 14], [19.5, 9, 20.5], pedestal);
  b.box('nameplate', [14.5, 4.5, 21.5], [19.5, 7, 22], nameplate);
  b.box('yoke#1', [14.5, 9, 14], [19.5, 15, 16], knuckle);
  b.box('yoke#2', [16, 11, 15.5], [18, 13, 19.5], link);
  b.group('shield', [-4, 4.5, 14.5], () => b.box('shield', [-17, 4.5, 14], [9, 15.5, 15], shield));

  const E = [S[0], S[1] + L1], W = [S[0] - L2, S[1] + L1];
  b.group('shoulder', [S[0], S[1], 17.5], () => {
    b.box('upper#1', [S[0] - 2, S[1] - 2, ZU[0]], [S[0] + 2, S[1] + 2, ZU[1]], knuckle);
    b.box('upper#2', [S[0] - 1.5, S[1] + 2, 16.5], [S[0] + 1.5, E[1] - 1.5, 18.5], link);
    b.box('upper#3', [S[0] - 2, S[1] + 4, 16.2], [S[0] + 2, E[1] - 3, 18.8], cover);
    b.box('upper#4', [E[0] - 2, E[1] - 2, ZU[0]], [E[0] + 2, E[1] + 2, ZU[1]], knuckle);
    b.group('elbow', [E[0], E[1], 20.25], () => {
      b.box('fore#1', [E[0] - 2, E[1] - 2, ZF[0]], [E[0] + 2, E[1] + 2, ZF[1]], knuckle);
      b.box('fore#2', [W[0] + 0.5, E[1] - 1, 19.5], [E[0] - 2, E[1] + 1, 21], link);
      b.box('fore#3', [W[0] + 3, E[1] - 1.6, 19.2], [E[0] - 3, E[1] + 1.6, 21.3], cover);
      b.group('wrist', [W[0], W[1], 20.25], () => {
        b.box('wrist#1', [W[0] - 1.5, W[1] - 1.5, ZF[0]], [W[0] + 1.5, W[1] + 1.5, ZF[1]], knuckle);
        b.box('wrist#2', [W[0] - 2.5, W[1] - 5, 19.25], [W[0] + 2.5, W[1] - 1.5, 21.25], cover);
        b.box('wrist#3', [W[0] - 2.5, W[1] - 7.5, 19.5], [W[0] - 1.7, W[1] - 5, 21], link);
        b.box('wrist#4', [W[0] + 1.7, W[1] - 7.5, 19.5], [W[0] + 2.5, W[1] - 5, 21], link);
        b.box('wrist#5', [W[0] - 0.5, W[1] - 4, 21.25], [W[0] + 0.5, W[1] - 3, 21.6], gripLamp);
      });
    });
  });

  // ---------------------------------------------------------------- animation
  const arm = (T) => armAngles(S, T, L1, L2);
  const P = { rest: { shoulder: 0, elbow: 0, wrist: 0 }, pick: arm(PICK), lift: arm(LIFT), over: arm(OVER), drop: arm(DROP) };
  const seq = [[0, 'rest'], [1.3, 'lift'], [2.3, 'pick'], [2.9, 'pick'], [3.8, 'lift'], [5.0, 'over'], [5.6, 'drop'], [6.2, 'over'], [8, 'rest']];
  const armTracks = (keys, unwrap = true) => {
    const raw = keys.map(([, p]) => (typeof p === 'string' ? P[p] : p)), poses = unwrap ? unwrapPoses(raw) : raw;
    return Object.fromEntries(['shoulder', 'elbow', 'wrist'].map((j) => [j, track(keys.map(([t], i) => [t, poses[i][j]]), 'z')]));
  };
  const L = 8;
  const n = 32, bob = [], spin = [];
  for (let q = 0; q <= n; q++) { const t = (q / n) * L; bob.push([+t.toFixed(3), [0, +Math.sin((q / n) * 4 * Math.PI).toFixed(3), 0]]); spin.push([+t.toFixed(3), [0, +((q / n) * 360).toFixed(2), 0]]); }
  const pulseDense = (ph) => ({ scale: Array.from({ length: 33 }, (_, q) => { const s = 1 + 0.35 * (0.5 + 0.5 * Math.sin((q / 8 + ph) * 2 * Math.PI)); return [+(q * L / 32).toFixed(3), [+s.toFixed(3), +s.toFixed(3), +s.toFixed(3)]]; }) });
  b.anim('working', L, { charge: { position: bob, rotation: spin }, flow_1: pulseDense(0), flow_2: pulseDense(0.5), ...armTracks(seq) });

  const hold = (v, axis = 'z', ch = 'rotation') => { const r = [0, 0, 0]; r[{ x: 0, y: 1, z: 2 }[axis]] = v; return { [ch]: [[0, r]] }; };
  b.anim('packaged', 0.5, { shield: hold(SHIELD_UP, 'y', 'position'), shoulder: hold(FOLD.shoulder), elbow: hold(FOLD.elbow), wrist: hold(FOLD.wrist) });
  b.anims[b.anims.length - 1].loop = 'hold';
  const D = 5;
  b.anim('deploy', D, {
    shield: track([[0, SHIELD_UP], [2, 0], [D, 0]], 'y', 'position'),
    ...armTracks([[0, FOLD], [1.5, FOLD], [4.5, P.rest], [D, P.rest]], false),
  });
  b.anims[b.anims.length - 1].loop = 'hold';
}
