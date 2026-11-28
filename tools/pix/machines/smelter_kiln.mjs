// Smelter, tier 0: a rotary kiln. Ore drops from the hopper into the high (west) end of an orange drum
// that rolls on two steel tyres; a motor turns it through a pinion and a ring gear. Molten metal leaves
// the low (east) end through the firing hood and pours into an ingot crate.
import { addRamp, hsh } from '../pix.mjs';

addRamp('gun', ['#111317', '#1d2024', '#2c2f33', '#424549', '#636460'], { clusters: 0.035, streaks: 0.05, chips: 0.1, grime: 0.5 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.03, chips: 0.12, grime: 0.5 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { clusters: 0.05, streaks: 0.04, chips: 0.1 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });

// The drum assembly tilts 3 degrees so the feed (west) end is high. Local frame of that group: pivot on
// the drum axis at mid length.
const TILT = -3, AX = [0, 22, 0];
const sa = Math.sin(TILT * Math.PI / 180), ca = Math.cos(TILT * Math.PI / 180);
const worldY = (x, y) => AX[1] + x * sa + (y - AX[1]) * ca;

const DRUM_R = 10, TYRE_R = 12, ROLLER_R = 4, GEAR_R = 15, PINION_R = 5;
const GEAR_X = -25, TYRES = [['w', -16], ['e', 14]];
const PIN = [GEAR_X, AX[1] - (GEAR_R + PINION_R) * Math.sin(Math.PI / 6), (GEAR_R + PINION_R) * Math.cos(Math.PI / 6)];
const RA = 35 * Math.PI / 180, RC = TYRE_R + ROLLER_R;
const ROLL_Y = AX[1] - RC * Math.cos(RA), ROLL_Z = RC * Math.sin(RA);

export const meta = {
  title: 'Smelter (rotary kiln)', note: 'Ore to ingots in a turning kiln. Tier 0.', footprint: [5, 3], height: 3, tier: 0,
  ports: [{ id: 'in', kind: 'item', face: 'up', cell: [0, 1] }, { id: 'out', kind: 'item', face: 'east', cell: [1, 0] }],
  joints: {
    drum: { type: 'revolute', axis: 'x' }, pinion: { type: 'revolute', axis: 'x' },
    roller_wn: { type: 'revolute', axis: 'x' }, roller_ws: { type: 'revolute', axis: 'x' },
    roller_en: { type: 'revolute', axis: 'x' }, roller_es: { type: 'revolute', axis: 'x' },
  },
  gears: [
    { a: 'ring_gear', b: 'pinion', ra: GEAR_R, rb: PINION_R },
    ...TYRES.flatMap(([t]) => ['n', 's'].map((s) => ({ a: `tyre_${t}`, b: `roller_${t}${s}`, ra: TYRE_R, rb: ROLLER_R }))),
  ],
  lint: { allow: [
    { a: 'tyre_*', b: 'shell#*', check: 'overlap', why: 'riding tyres are shrunk onto the shell' },
    { a: 'ring_gear#*', b: 'shell#*', check: 'overlap', why: 'the girth gear is bolted round the shell' },
    { a: 'ring_gear#*', b: 'pinion#*', check: 'overlap', why: 'meshing teeth' },
    { a: 'feed_spout', b: 'shell#*', check: 'overlap', why: 'the stationary feed spout enters the drum along its axis' },
  ] },
};
export const look = { glow: 1.3 };

// ---- helpers (module-local)
const range = (n) => [...Array(n).keys()];
// raised weld seam across a face: a dark line with a lit lip on its left
const seamV = (d, x, ramp, k = 1) => { d.vline(x, 0, d.h, ramp, k); d.vline(x - 1, 0, d.h, ramp, 3); };
const seamH = (d, y, ramp, k = 1) => { d.hline(0, y, d.w, ramp, k); d.hline(0, y - 1, d.w, ramp, 3); };
// cap of a prism slab (east/west face): v runs across the diameter; paint by radius
// house hazard: signal orange and gunmetal diagonals (the yellow hazard ramp is outside the DA)
const stripes = (d, x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) d.px(x + i, y + j, ...(((x + i + y + j) >> 1) % 2 ? ['gun', 0] : ['sig', j === 0 ? 4 : 3])); };
const radial = (d, fn) => { const c = (d.h - 1) / 2; d.fill((x, y) => fn(Math.abs(y - c), y < c, x)); };

export function build(b, { mat }) {
  // ---------------------------------------------------------------- materials
  const plinth = mat('gun', {
    side(d) { d.courses(0, 0, d.w, d.h, 'gun', 2, 10); d.hline(0, 0, d.w, 'gun', 4); },
    top(d) { d.checker(0, 0, d.w, d.h, 'gun', 2, 1, 2); for (let x = 3; x < d.w; x += 12) d.vline(x, 0, d.h, 'gun', 0); },
  });
  const pier = mat('gun', {
    side(d) {
      d.rings(1, 2, d.w - 2, d.h - 3, [['gun', 0], ['gun', 3], ['gun', 1]]);
      d.rect(3, 4, d.w - 6, Math.max(1, d.h - 8), 'sig', 2); d.hline(3, 4, d.w - 6, 'sig', 3);
      for (let x = 4; x < d.w - 4; x += 3) d.vline(x, 6, Math.max(1, d.h - 11), 'sig', 1);
      d.bolt(2, 1, 'gun'); d.bolt(d.w - 4, 1, 'gun');
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); },
  });
  const bed = mat('gun', { side(d) { d.hline(0, 0, d.w, 'gun', 4); for (let x = 2; x < d.w - 1; x += 5) d.bolt(x, 1, 'gun'); } });
  const bearing = mat('gun', {
    side(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.px(Math.floor(d.w / 2), 1, 'cu', 4); },
    east(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.rect(1, 1, d.w - 2, d.h - 2, 'cu', 2); d.px(1, 1, 'cu', 4); d.px(d.w - 2, d.h - 2, 'cu', 1); },
    west(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.rect(1, 1, d.w - 2, d.h - 2, 'cu', 2); d.px(1, 1, 'cu', 4); },
  });

  // drum shell: welded orange plates, staggered so the seams step round the drum; two bolted gunmetal
  // strakes per turn so the rotation reads
  // drum shell: rolled orange plates with circumferential welds in the gaps between tyres and gear; the
  // facets carry what shows the rotation: two bolted gunmetal strakes and flow chevrons per turn
  const SEAMS = [9, 24, 33, 51];
  const shellFace = (variant) => (d) => {
    d.fill((x, y) => {
      const plate = SEAMS.filter((sx) => sx <= x).length, r = hsh(x >> 1, y, d.seed);
      const k = y === 0 ? 3 : y === d.h - 1 ? 1 : (plate & 1) && y === 1 ? 3 : 2;
      return ['sig', r < 0.07 ? Math.max(1, k - 1) : r > 0.95 ? Math.min(3, k + 1) : k];
    });
    for (const x of SEAMS) { d.vline(x, 0, d.h, 'sig', 1); d.vline(x - 1, 0, d.h, 'sig', 3); d.px(x + 1, 2, 'sig', 3); }
    if (variant === 'strake') {
      d.rect(0, 1, d.w, d.h - 2, 'gun', 2); d.hline(0, 1, d.w, 'gun', 3); d.hline(0, d.h - 2, d.w, 'gun', 1);
      for (let x = 2; x < d.w; x += 4) d.px(x, 2, 'gun', 4);
    } else if (variant === 'chevron') {
      for (const x0 of [18, 28, 38]) { for (const [i, j] of [[0, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [0, 4]]) d.px(x0 + i, j, 'gun', 1); d.hline(x0 - 4, 2, 4, 'gun', 1); }
    }
    d.rect(0, 0, 2, d.h, 'gun', 1); d.rect(d.w - 2, 0, 2, d.h, 'gun', 1);
  };
  const shellMat = (v) => mat('sig', { top: shellFace(v), side(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); } }, { clean: true });
  const shellMats = ['plain', 'strake', 'chevron', 'plain', 'strake', 'chevron'].map(shellMat);

  const tyre = (boltPhase) => mat('gun', {
    top(d) { d.fill((x, y) => ['gun', x === 0 || x === d.w - 1 ? 0 : x === 1 ? 4 : 3]); if (boltPhase) d.px(2, Math.floor(d.h / 2), 'cu', 3); },
    side(d) { radial(d, (r) => (r > TYRE_R * 1 - 1.5 ? ['gun', 4] : r > TYRE_R - 2.5 ? ['gun', 0] : ['gun', 2])); },
  });
  const tyreMats = range(6).map((i) => tyre(i % 2 === 0));

  const gearBody = (bolts) => mat('gun', {
    top(d) { d.fill((x) => ['gun', x === 0 ? 4 : x === d.w - 1 ? 0 : 2]); },
    side(d) {
      radial(d, (r, up, x) => {
        if (r > GEAR_R - 1.5) return ['gun', 3];
        if (r > GEAR_R - 2.5) return ['gun', 0];
        if (r > DRUM_R + 0.5) return ['sig', up ? 3 : 2];
        return ['gun', 1];
      });
      if (bolts) { const c = Math.floor(d.h / 2); d.px(Math.floor(d.w / 2), c - 12, 'cu', 4); d.px(Math.floor(d.w / 2), c + 11, 'cu', 3); }
    },
  });
  const gearMats = range(6).map((i) => gearBody(i % 2 === 0));
  const tooth = mat('gun', { all(d) { d.fill((x, y) => { const L = Math.max(d.w, d.h), t = d.h >= d.w ? y : x; const e = Math.min(t, L - 1 - t); return ['gun', e < 1 ? 4 : e < 2 ? 3 : 1]; }); } }, { clean: true });

  const hatch = mat('gun', {
    top(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.rect(2, 1, d.w - 4, d.h - 2, 'sig', 3); d.hline(2, 1, d.w - 4, 'sig', 4); for (const x of [1, d.w - 2]) d.px(x, 1, 'cu', 4); },
    side(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); d.hline(0, 0, d.w, 'gun', 3); },
  }, { clean: true });
  const handle = mat('cu', { all(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.hline(0, 0, d.w, 'cu', 4); } }, { clean: true });

  const roller = mat('gun', {
    top(d) { d.fill((x) => ['gun', x === 0 || x === d.w - 1 ? 1 : x % 3 === 1 ? 4 : 3]); },
    side(d) { radial(d, (r) => (r > ROLLER_R - 1 ? ['gun', 3] : ['cu', 3])); },
  }, { clean: true });
  const rollerB = mat('gun', { top(d) { d.fill((x) => ['gun', x === 0 || x === d.w - 1 ? 1 : 2]); d.px(Math.floor(d.w / 2), 1, 'cu', 4); }, side(d) { radial(d, (r) => (r > ROLLER_R - 1 ? ['gun', 3] : ['cu', 2])); } }, { clean: true });
  const axle = mat('gun', { all(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : 2]); } }, { clean: true });

  const pinionBody = mat('cu', {
    top(d) { d.fill((x) => ['cu', x === 0 ? 4 : x === d.w - 1 ? 1 : 3]); },
    side(d) { radial(d, (r) => (r < 1.2 ? ['gun', 0] : r < 2.5 ? ['cu', 4] : ['cu', 2])); },
  });
  const pinionTooth = mat('cu', { all(d) { d.fill((x, y) => { const L = Math.max(d.w, d.h), t = d.h >= d.w ? y : x; const e = Math.min(t, L - 1 - t); return ['cu', e < 1 ? 4 : 2]; }); } }, { clean: true });
  const coupling = mat('gun', { side(d) { d.fill((x, y) => ['gun', x % 2 ? 1 : 3]); d.hline(0, 0, d.w, 'cu', 4); } });

  // motor: gunmetal can with axial cooling fins, orange end bell with a fan grille
  const motorFins = mat('gun', {
    top(d) { d.fill((x, y) => ['gun', [4, 2, 0, 3, 1][y % 5]]); d.vline(1, 0, d.h, 'gun', 0); d.vline(d.w - 2, 0, d.h, 'gun', 0); },
    side(d) { radial(d, (r) => (r > 4 ? ['gun', 1] : r > 2 ? ['sig', 2] : ['gun', 3])); },
  });
  const bell = mat('sig', {
    west(d) { d.rings(0, 0, d.w, d.h, [['sig', 1], ['sig', 3]]); d.vent(2, 2, d.w - 4, d.h - 4, 'gun'); },
    side(d) { d.hline(0, 0, d.w, 'sig', 4); },
  });
  const termBox = mat('sig', {
    side(d) { d.rings(0, 0, d.w, d.h, [['sig', 0], ['sig', 3]]); d.px(2, 2, 'cu', 4); d.px(d.w - 3, 2, 'cu', 4); },
    top(d) { d.plate(0, 0, d.w, d.h, 'sig'); d.px(2, 2, 'gun', 0); },
  });

  // feed hood: orange casing with gunmetal bands; copper seal ring where the drum enters
  const feedHood = mat('sig', {
    side(d) { d.hline(0, 0, d.w, 'gun', 3); d.rect(0, d.h - 4, d.w, 4, 'gun', 1); d.hline(0, d.h - 4, d.w, 'gun', 3); },
    west(d) {
      d.rings(2, 3, d.w - 4, 17, [['gun', 1], ['sig', 4], ['sig', 1]]);
      d.inset(5, 6, d.w - 10, 11, 'sig'); d.bolt(3, 4, 'sig'); d.bolt(d.w - 5, 4, 'sig');
      d.rect(6, 22, d.w - 12, 3, 'gun', 0); d.hline(7, 23, d.w - 14, 'cu', 3);
      d.vent(4, 27, d.w - 8, 4, 'gun');
    },
    south(d) { d.window(1, 8, d.w - 2, 7, 'gun', 'amber'); for (let y = 18; y < d.h - 5; y += 4) d.bolt(2, y, 'sig'); },
    north(d) { d.inset(1, 6, d.w - 2, 14, 'sig'); d.vline(Math.floor(d.w / 2), 7, 12, 'sig', 3); },
    east(d) {
      const cx = (d.w - 1) / 2, cy = d.h - 1 - (AX[1] - 2);
      d.fill((x, y) => { const r = Math.hypot(x - cx, y - cy); return r < DRUM_R + 0.6 ? ['slag', 1] : r < DRUM_R + 2 ? ['cu', y < cy ? 4 : 2] : null; });
    },
    top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); },
  });
  const termBoxJ = mat('gun', { south(d) { d.plate(0, 0, d.w, d.h, 'gun'); d.px(1, 1, 'amber', 3); d.px(2, 1, 'cu', 4); } });
  const hopperNeck = mat('gun', { side(d) { d.fill((x, y) => ['gun', x % 4 === 0 ? 1 : y === 0 ? 4 : 2]); } });
  const hopperBin = mat('sig', {
    side(d) {
      d.rect(0, 0, 1, d.h, 'gun', 2); d.rect(d.w - 1, 0, 1, d.h, 'gun', 1);
      d.hline(0, d.h - 1, d.w, 'gun', 0);
      d.rings(2, 1, d.w - 4, d.h - 3, [['sig', 1], ['sig', 3]]);
      d.hline(3, 3, d.w - 6, 'gun', 1);
    },
    down(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); d.inset(2, 2, d.w - 4, d.h - 4, 'gun'); },
  });
  const portIn = mat('gun', {
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : 2]); d.px(1, 1, 'cu', 4); },
    up(d) {
      d.rect(0, 0, d.w, d.h, 'cu', 3); d.hline(0, 0, d.w, 'cu', 4);
      d.rect(1, 1, d.w - 2, d.h - 2, 'slag', 0);
      for (const [x, y, k] of [[2, 2, 3], [3, 3, 4], [6, 2, 2], [7, 4, 3], [4, 6, 3], [8, 7, 2], [2, 8, 4], [5, 9, 3], [9, 3, 3], [3, 5, 2]]) if (x < d.w - 1 && y < d.h - 1) { d.px(x, y, 'slag', k); d.px(x + 1, y, 'slag', k - 1); }
      d.px(6, 6, 'cu', 4); d.px(3, 9, 'cu', 3);
    },
  }, { clean: true });

  // firing hood at the discharge end: heavy gunmetal casing, orange door, glowing mouth and peephole
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
    },
    south(d) {
      d.rings(1, 2, d.w - 2, 13, [['gun', 0], ['sig', 3], ['sig', 2]]);
      d.window(2, 4, d.w - 4, 6, 'gun', 'amber');
      d.vent(1, 17, d.w - 2, d.h - 19, 'gun');
    },
    north(d) { d.rings(1, 2, d.w - 2, d.h - 6, [['gun', 0], ['sig', 3], ['sig', 2]]); d.bolt(2, 3, 'sig'); d.bolt(d.w - 4, d.h - 7, 'sig'); },
    west(d) {
      const cx = (d.w - 1) / 2, cy = d.h - 1 - (AX[1] - 10.5);
      d.fill((x, y) => { const r = Math.hypot(x - cx, y - cy); return r < DRUM_R + 0.6 ? ['slag', 0] : r < DRUM_R + 2 ? ['amber', r < DRUM_R + 1.3 ? 2 : 1] : null; });
    },
    up(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); stripes(d, 1, d.h - 3, d.w - 2, 2); },
    down(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); },
  });
  const hoodLeg = mat('gun', { side(d) { d.fill((x, y) => ['gun', x === 0 ? 3 : x === d.w - 1 ? 0 : y % 5 === 0 ? 1 : 2]); } });
  const flue = mat('gun', { side(d) { for (const y of [1, 4]) { d.hline(0, y, d.w, 'gun', 0); d.hline(0, y + 1, d.w, 'gun', 4); } }, up(d) { d.rect(0, 0, d.w, d.h, 'slag', 0); d.px(1, 1, 'amber', 1); } });
  const flueCap = mat('cu', { side(d) { d.hline(0, 0, d.w, 'cu', 4); d.hline(0, d.h - 1, d.w, 'cu', 1); }, up(d) { d.rect(1, 1, d.w - 2, d.h - 2, 'slag', 0); } });
  const chute = mat('gun', {
    up(d) { d.rect(0, 0, d.w, d.h, 'gun', 1); d.rect(0, 1, d.w, d.h - 2, 'amber', 2); d.hline(0, Math.floor(d.h / 2), d.w, 'amber', 3); },
    side(d) { d.hline(0, 0, d.w, 'cu', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); },
  });
  const stream = mat('amber', { all(d) { d.fill((x, y) => ['amber', x === 0 ? 2 : (y + x) % 4 === 0 ? 4 : 3]); } }, { clean: true });
  const crateWall = mat('gun', {
    side(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 5 === 0 ? 1 : y > d.h - 2 ? 1 : 2]); for (const x of [0, d.w - 1]) d.vline(x, 0, d.h, 'cu', 2); },
    top(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); },
  }, { clean: true });
  const melt = mat('amber', {
    up(d) {
      d.fill((x, y) => ['amber', (x % 5 === 4 || y % 6 === 5) ? 1 : (x + y * 2) % 7 === 0 ? 4 : 3]);
      for (let x = 4; x < d.w; x += 5) d.vline(x, 0, d.h, 'gun', 1);
    },
  }, { clean: true });
  const portOut = mat('gun', {
    east(d) { d.rings(0, 0, d.w, d.h, [['cu', 3], ['gun', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'slag', 1); d.hline(2, 2, d.w - 4, 'slag', 0); d.px(2, d.h - 3, 'amber', 1); },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : 2]); },
  });

  const pipe = mat('cu', { all(d) { d.fill((x, y) => { const L = d.h >= d.w ? d.w : d.h, t = d.h >= d.w ? x : y; return ['cu', t === 0 ? 4 : t === L - 1 ? 1 : t === 1 ? 3 : 2]; }); } });
  const flange = mat('cu', { all(d) { d.rect(0, 0, d.w, d.h, 'cu', 2); d.hline(0, 0, d.w, 'cu', 4); d.px(1, 1, 'gun', 0); } });
  const lamp = mat('amber', { side(d) { d.rect(0, 0, d.w, d.h, 'amber', 3); d.px(0, 0, 'amber', 4); }, up(d) { d.rect(0, 0, d.w, d.h, 'amber', 4); } }, { flat: true });
  const gauge = mat('gun', { south(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.rect(1, 1, d.w - 2, d.h - 2, 'gun', 4); d.px(1, 1, 'slag', 0); d.px(2, 2, 'amber', 2); } });

  // ---------------------------------------------------------------- static base (world frame)
  b.box('plinth', [-38, 0, -13], [30, 2, 13], plinth);
  const bedBottom = (x) => worldY(x, ROLL_Y - 5.5);
  for (const [t, xt] of TYRES) b.box(`pier_${t}`, [xt - 7, 2, -12], [xt + 7, bedBottom(xt) + 0.2, 12], pier);

  // side girders between the piers carry the base and close the silhouette
  const rail = mat('gun', {
    side(d) {
      d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0);
      for (let x = 2; x + 9 < d.w; x += 12) { d.inset(x, 1, 9, d.h - 2, 'sig'); d.px(x + 1, 2, 'sig', 4); }
      for (let x = 0; x < d.w; x += 12) d.bolt(x, 1, 'gun');
    },
    top(d) { d.rect(0, 0, d.w, d.h, 'gun', 3); for (let x = 1; x < d.w; x += 4) d.px(x, 0, 'gun', 4); },
  });
  for (const [i, x0, x1] of [[1, -30, -23], [2, -9, 7], [3, 21, 26]]) {
    b.box(`rail_n${i}`, [x0, 2.01, -13], [x1, 6.5, -11.5], rail);
    b.box(`rail_s${i}`, [x0, 2.01, 11.5], [x1, 6.5, 13], rail);
  }
  b.box('vent_pipe', [-32.5, 36, 7], [-30.5, 40, 9], pipe);
  b.box('vent_cap', [-33, 40, 6.5], [-30, 41, 9.5], flange);
  b.box('junction', [-8, 3, 13], [-4, 7, 14], termBoxJ);

  // feed end: hood, hopper and its port
  b.box('feed_hood#1', [-38, 2, -11.5], [-30, 36, 11.5], feedHood);
  b.box('feed_hood#2', [-38.5, 30, -12], [-29.5, 32, 12], mat('gun', { side(d) { d.hline(0, 0, d.w, 'gun', 4); for (let x = 2; x < d.w; x += 4) d.px(x, 1, 'cu', 3); } }));
  const capMat = mat('gun', { side(d) { d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 3; x < d.w - 1; x += 6) d.px(x, 1, 'cu', 3); }, top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'gun'); for (let x = 3; x < d.w - 2; x += 5) d.px(x, 2, 'gun', 4); } });
  b.box('feed_hood#3', [-38.6, 34.5, -12.1], [-29.4, 36.2, 12.1], capMat);
  b.box('door_handle', [-39, 12, -3], [-38, 13, 3], handle);
  b.box('feed_spout', [-31, AX[1] - 2, -2], [-27, AX[1] + 2, 2], pipe);
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
  b.box('chute', [34, 13, -2.5], [37.5, 15.5, 2.5], chute);
  b.box('chute_lip', [36.5, 12, -2.5], [37.5, 13, 2.5], mat('cu'));
  b.box('stream', [35.5, 8.5, -1], [36.5, 12, 1], stream);
  b.box('crate_base', [30, 2, -7], [39, 4, 7], crateWall);
  b.box('crate_n', [30, 4, -7], [39, 9, -6], crateWall);
  b.box('crate_s', [30, 4, 6], [39, 9, 7], crateWall);
  b.box('crate_w', [30, 4, -6], [31, 9, 6], crateWall);
  b.box('melt', [31, 4, -6], [39, 8.5, 6], melt);
  b.box('port_out', [39, 2, -6], [40, 14, 6], portOut);
  b.box('gauge', [30, 26, 12], [33, 29, 13], gauge);

  // burner feed: copper pipe along the south side into the firing hood
  b.box('pipe_run#1', [-18, 1.5, 14], [24, 3.5, 16], pipe);
  b.box('pipe_rise#1', [24, 0, 14], [26, 22, 16], pipe);
  b.box('pipe_in', [26, 20, 12], [29, 22, 14], pipe);
  for (const [i, x] of [[2, -12], [3, 4]]) b.box(`pipe_run#${i}`, [x - 0.5, 0, 13], [x + 2.5, 2, 17], flange);
  b.box('pipe_run#4', [-19, 0.5, 13.5], [-18, 4, 16.5], flange);
  b.box('pipe_rise#2', [23.5, 18, 13.5], [26.5, 19, 16.5], flange);

  // motor bed and pinion pedestal, under the tilted drive
  const motorBottom = worldY(-34, PIN[1] - 5.5);
  b.box('motor_bed', [-39, 0, 12], [-29, motorBottom + 0.3, 23], mat('gun', { side(d) { d.hline(0, 0, d.w, 'gun', 4); stripes(d, 1, d.h - 3, d.w - 2, 2); } }));
  b.box('pinion_stand', [-23, 0, 14], [-19, worldY(-21, PIN[1] - 2.5) + 0.3, 20.5], pier);

  // ---------------------------------------------------------------- tilted drive and drum
  b.group('kiln', AX, () => {
    // rollers on their beds, one pair under each tyre
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

    // drive: motor, coupling and pinion
    const [px, py, pz] = PIN;
    b.prism('motor', [-34, py, pz], 5.5, 8, 'x', motorFins, 8);
    b.box('motor_bell', [-39.3, py - 4, pz - 4], [-38, py + 4, pz + 4], bell);
    b.box('motor_term', [-35, py + 5, pz - 2.5], [-32, py + 8, pz + 1], termBox);
    b.box('conduit', [-34, py + 6, pz + 1], [-33, py + 7, pz + 4.5], pipe);
    b.box('pinion_block', [-23, py - 2.5, pz - 2.5], [-19, py + 2.5, pz + 2.5], bearing);
    b.group('pinion', [-23, py, pz], () => {
      b.prism('pinion', [px, py, pz], PINION_R - 1, 3, 'x', pinionBody, 8);
      for (let i = 0; i < 4; i++) b.box(`pinion#${5 + i}`, [px - 1.25 + i * 0.01, py - (PINION_R + 1), pz - 1], [px + 1.25 - i * 0.01, py + PINION_R + 1, pz + 1], pinionTooth, { origin: [px, py, pz], rotation: [i * 45 + 22.5, 0, 0] });
      b.box('pinion#9', [-30, py - 1, pz - 1], [px - 1.5, py + 1, pz + 1], axle);
      b.box('pinion#10', [-29.5, py - 2, pz - 2], [-27.5, py + 2, pz + 2], coupling);
      b.box('pinion#11', [px + 1.5, py - 1, pz - 1], [-23, py + 1, pz + 1], axle);
    });

    // the drum: shell, two riding tyres, girth gear, hatches
    b.group('drum', [-29, AX[1], 0], () => {
      b.prism('shell', [-2, AX[1], 0], DRUM_R, 56, 'x', shellMats[0], 12, { mats: shellMats });
      for (const [t, xt] of TYRES) b.prism(`tyre_${t}`, [xt, AX[1], 0], TYRE_R, 5, 'x', tyreMats[0], 12, { mats: tyreMats });
      b.prism('ring_gear', [GEAR_X, AX[1], 0], GEAR_R - 1, 3, 'x', gearMats[0], 12, { mats: gearMats });
      for (let i = 0; i < 12; i++) b.box(`ring_gear#${7 + i}`, [GEAR_X - 1.25 + i * 0.01, AX[1] - (GEAR_R + 1), -1], [GEAR_X + 1.25 - i * 0.01, AX[1] + GEAR_R + 1, 1], tooth, { origin: [GEAR_X, AX[1], 0], rotation: [i * 15, 0, 0] });
      for (const [i, x0, ang] of [[1, -9, 0], [2, 1, 120], [3, 19, 240], [4, -4, 60]]) {
        const top = AX[1] + DRUM_R;
        b.box(`hatch_${i}`, [x0, top - 0.5, -2.5], [x0 + 7, top + 1, 2.5], hatch, { origin: [x0 + 3.5, AX[1], 0], rotation: [ang, 0, 0] });
        b.box(`hatch_${i}_grip`, [x0 + 2.5, top + 1, -1], [x0 + 4.5, top + 2, 1], handle, { origin: [x0 + 3.5, AX[1], 0], rotation: [ang, 0, 0] });
      }
    });
  }, [0, 0, TILT]);

  // one drum turn per cycle; pinion 3x (15/5), rollers 4x (12/3), both counter-rotating
  const L = 8, turn = (k) => ({ rotation: range(4 * L + 1).map((q) => [q / 4, [k * 90 * q / L, 0, 0]]) });
  b.anim('working', L, {
    drum: turn(1), pinion: turn(-GEAR_R / PINION_R),
    ...Object.fromEntries(TYRES.flatMap(([t]) => ['n', 's'].map((s) => [`roller_${t}${s}`, turn(-TYRE_R / ROLLER_R)]))),
  });
}
