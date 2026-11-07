// Forge line F3, tier 2 (r5 concept F3; process sheet forge_line_f3.process.md). Ingots enter a coal-fired
// reheating furnace (west), roll out glowing on live rollers, take three blows from a cam-lifted drop hammer,
// pass a two-high rolling mill and land as plates in the exit bin (east). One shaft at the back powers it all:
// the gearbox output carries a roller chain, a chain to the mill's bottom roll and a gear that turns, through an
// idler, the big gear of the wooden cam log; the top roll follows the bottom one through the pinion gears.
import { addRamp, hsh } from '../pix.mjs';
import { teeth } from '../parts.mjs';

addRamp('gun', ['#16130f', '#27221d', '#39332c', '#524a41', '#736a5c'], { clusters: 0.035, streaks: 0.05, chips: 0.1, grime: 0.5 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.03, chips: 0.12, grime: 0.5 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { clusters: 0.05, streaks: 0.04, chips: 0.1 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });
addRamp('brickish', ['#24120c', '#4a2216', '#6e3220', '#8e472c', '#b0623e']);
addRamp('steel', ['#1b1d21', '#33373d', '#555a61', '#7d838a', '#b3b8bc'], { streaks: 0.08 });
addRamp('wood', ['#2a1a0e', '#4a2f18', '#6b4524', '#8c5d33', '#b07d4a'], { streaks: 0.14, clusters: 0.04 });

// line axis z = 0, work surface y = 9 (roller tops, anvil top)
const WORK = 9, ROLLER_R = 1.5, ROLLER_Y = WORK - ROLLER_R;
const ROLLERS = [-20, -15, -10, 14.5];
const DRIVE = [8, ROLLER_Y]; // gearbox output shaft (axis z)
// gear train in the plane z -18..-16: drive gear, idler, the big cam gear; positions solved so that on each line
// between centres one gear shows a tooth and the other a gap (phase error 0.16 deg)
const GD = 4, GI = 3, GC = 8, IDLER = [5.1976, 13.9145], CAM = [11.75, 22.75], LOBE = 6, LOG_R = 2.5;
const TAPPET = CAM[1]; // tappet underside in the bind pose (die on the anvil)
const ARM_END = CAM[0] - LOG_R - 0.4, RELEASE = Math.acos((CAM[0] - ARM_END) / LOBE); // the lobe tip slips off the tappet end
const MILL_X = 23, ROLL_R = 3.5, GAP = 1.0, BOT_Y = WORK - ROLL_R, TOP_Y = WORK + GAP + ROLL_R, PIN_R = (TOP_Y - BOT_Y) / 2, MILL_SPRK = 3;
const Z_CHAIN = [-14.5, -13.5], Z_GEAR = [-18, -16], Z_MILL = [-19.5, -18.5];
const BILLET = { len: 8, h: 2.5, w: 6 };
const deg = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
const mod = (v, m) => ((v % m) + m) % m;
const PH_D = deg(DRIVE, IDLER), PH_I = deg(IDLER, DRIVE) + 30;
const PH_C = (() => { const m = mod(deg(IDLER, CAM) - PH_I, 60); return deg(CAM, IDLER) + (m < 15 || m > 45 ? 11.25 : 0); })();

// open chain between two sprockets: the two straight runs, tangent to both
function runs(c1, r1, c2, r2) {
  const d = [c2[0] - c1[0], c2[1] - c1[1]], L = Math.hypot(...d), u = [d[0] / L, d[1] / L], p = [-u[1], u[0]];
  const sa = (r2 - r1) / L, ca = Math.sqrt(1 - sa * sa);
  return [1, -1].map((s) => {
    const n = [-sa * u[0] + s * ca * p[0], -sa * u[1] + s * ca * p[1]];
    const P1 = [c1[0] + r1 * n[0], c1[1] + r1 * n[1]], P2 = [c2[0] + r2 * n[0], c2[1] + r2 * n[1]];
    return { P1, P2, n, len: Math.hypot(P2[0] - P1[0], P2[1] - P1[1]), ang: (Math.atan2(P2[1] - P1[1], P2[0] - P1[0]) * 180) / Math.PI };
  });
}

export const meta = {
  title: 'Forge line (hammer and rolling mill)', note: 'Ingots to plates: reheat, hammer, roll. Tier 2.', footprint: [6, 3], height: 3, tier: 2,
  ports: [
    { id: 'in', kind: 'item', face: 'west', cell: [1, 0] }, { id: 'out', kind: 'item', face: 'east', cell: [1, 0] },
    { id: 'fuel', kind: 'item', face: 'north', cell: [0, 0] }, { id: 'power', kind: 'rotation', face: 'north', cell: [3, 0], bone: 'shaft_in' },
  ],
  joints: {
    shaft_in: { type: 'revolute', axis: 'z' }, drive_out: { type: 'revolute', axis: 'z' }, idler: { type: 'revolute', axis: 'z' },
    cam: { type: 'revolute', axis: 'z' }, roll_bot: { type: 'revolute', axis: 'z' }, roll_top: { type: 'revolute', axis: 'z' },
    ...Object.fromEntries(ROLLERS.map((_, i) => [`roller_${i + 1}`, { type: 'revolute', axis: 'z' }])),
    ram: { type: 'prismatic', axis: 'y' }, stack: { type: 'revolute', axis: 'z' },
    billet: { type: 'free', respawn: true, why: 'the work piece: travels down the line, deforms under the hammer and the rolls, and the next ingot starts in the furnace' },
  },
  drives: [{ a: 'shaft_in', b: 'drive_out', ratio: -1.5, via: 'gearbox' }],
  belts: [
    { id: 'roller_chain', pulleys: [{ part: 'sprk_drive', r: ROLLER_R }, ...ROLLERS.map((_, i) => ({ part: `sprk_${i + 1}`, r: ROLLER_R }))], segments: ['chain_top', 'chain_bot'] },
    { id: 'mill_chain', pulleys: [{ part: 'sprk_mill_drive', r: 1.5 }, { part: 'sprk_mill', r: MILL_SPRK }], segments: ['millc_1', 'millc_2'] },
  ],
  gears: [
    { a: 'g_drive', b: 'g_idler', ra: GD, rb: GI, ta: 8, tb: 6 },
    { a: 'g_idler', b: 'g_cam', ra: GI, rb: GC, ta: 6, tb: 16 },
    { a: 'pin_bot', b: 'pin_top', ra: PIN_R, rb: PIN_R, ta: 8, tb: 8 },
  ],
  lint: { allow: [
    { a: 'cam*', b: 'cam_bearing_*', check: 'overlap', why: 'the cam log runs in its bearings' },
    { a: 'roll_*', b: 'housing_*', check: 'overlap', why: 'the roll necks run in the housing bearings' },
    { a: 'roller_*', b: 'rail_*', check: 'overlap', why: 'the roller axles run in the table rails' },
    { a: 'drive_out', b: 'g_drive#*', check: 'overlap', why: 'the gear is keyed on the output shaft' },
    { a: 'drive_out', b: 'sprk_*', check: 'overlap', why: 'the sprockets are keyed on the output shaft' },
    { a: 'idler#*', b: 'g_idler#*', check: 'overlap', why: 'the idler gear turns on its stub shaft' },
    { a: 'cam#*', b: 'g_cam#*', check: 'overlap', why: 'the big gear is keyed on the cam log' },
    { a: 'roll_*#9', b: 'pin_*', check: 'overlap', why: 'the pinions are keyed on the roll necks' },
    { a: 'billet', b: 'furnace#*', check: 'overlap', why: 'the ingot heats inside the furnace' },
    { a: 'ram*', b: 'cam*', check: 'sweep', why: 'the cam lobe lifts the tappet: they touch by design' },
  ] },
};
export const look = { glow: 1.3 };
meta.fx = [
  { id: 'stack_smoke', kind: 'smoke', at: [-36, 46.5, 0], anims: ['working'], rise: 44, spread: 3, drift: 6, size: 1.2 },
  { id: 'hammer_sparks', kind: 'ember', at: [0, 11, 0], anims: ['working'], rise: 10, spread: 10, life: 0.6, count: 10 },
];

const range = (n) => [...Array(n).keys()];
const near = (a, step, ph = 0) => { const m = (((a - ph) % step) + step) % step; return Math.min(m, step - m); };

export function build(b, { mat: plainMat }) {
  // every face of this machine gets the weathering pass (Brian: textures were not rich enough)
  const mat = (ramp, design, o = {}) => plainMat(ramp, design, { weather: 1, ...o });
  // ---------------------------------------------------------------- materials
  const capStripes = (d) => d.stripes(1, d.h - 3, d.w - 2, 2, ['gun', 0], ['sig', 3]);
  const frame = mat('gun', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]); for (let y = 3; y < d.h - 2; y += 5) d.bolt(1, y, 'gun'); d.hline(1, d.h - 2, d.w - 2, 'gun', 0);
      if (d.h > 16 && d.w >= 6) {
        d.plate(2, 3, d.w - 4, d.h - 10, 'sig'); d.brokenRings(3, 4, d.w - 6, d.h - 12, [[0, 'sig', 1], [2, 'sig', 3]], { breaks: 0.35 });
        d.stripes(1, d.h - 6, d.w - 2, 3, ['gun', 0], ['sig', 3]);
      } else if (d.w > 8) for (let x = 3; x < d.w - 3; x += 6) d.bolt(x, 1, 'gun');
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.rivets(1, 1, d.w - 2, 'gun', { step: 3 }); },
  });
  const panel = mat('gun', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      if (d.w > 6 && d.h > 6) { d.plate(2, 2, d.w - 4, d.h - 4, 'sig'); d.brokenRings(3, 3, d.w - 6, d.h - 6, [[0, 'sig', 1], [2, 'sig', 3]], { breaks: 0.3 }); }
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); capStripes(d); d.rivets(2, 2, d.w - 4, 'gun', { step: 3 }); if (d.w > 10 && d.h > 8) { d.plate(3, 3, d.w - 6, 3, 'cu'); d.hline(4, 4, d.w - 8, 'cu', 4); } },
  });
  const deck = mat('gun', {
    side(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 6 === 5 ? 0 : 1]); for (let x = 9; x < d.w; x += 24) d.rect(x, 0, 3, 2, 'sig', 3); },
    top(d) {
      d.fill((x, y) => { const i = x % 4, j = y % 4, off = ((x >> 2) + (y >> 2)) & 1; return (off ? i === j : i === 3 - j) ? ['gun', 3] : (off ? i === j + 1 : i === 2 - j) ? ['gun', 0] : null; });
      for (let x = 15; x < d.w; x += 16) { d.vline(x, 0, d.h, 'gun', 0); d.rivets(x + 1, 1, d.h - 2, 'gun', { dir: 'v', step: 4 }); }
      d.fill((x, y) => (hsh(x >> 2, y >> 2, 21) < 0.06 ? ['slag', 1] : null));
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
    },
  });
  const bricks = (d) => {
    d.courses(0, 0, d.w, d.h, 'brickish', 3, 6);
    d.fill((x, y) => { const row = (y / 3) | 0, col = ((x + (row & 1 ? 3 : 0)) / 6) | 0, h = hsh(col, row, d.seed); if (y % 3 === 2 || (x + (row & 1 ? 3 : 0)) % 6 === 5) return null; return h < 0.12 ? ['slag', 2] : h < 0.2 && y % 3 === 0 ? ['brickish', 4] : h > 0.93 ? ['brickish', 1] : null; });
  };
  const brick = mat('brickish', {
    all(d) { d.courses(0, 0, d.w, d.h, 'brickish', 3, 6); d.hline(0, 0, d.w, 'brickish', 4); for (let x = 0; x < d.w; x++) if (hsh(x, 1, d.seed) < 0.2) d.px(x, d.h - 1, 'slag', 2); },
  });
  const furnaceBody = mat('brickish', {
    all(d) { bricks(d); d.rect(0, 0, d.w, 2, 'gun', 3); d.rect(0, d.h - 3, d.w, 3, 'gun', 1); d.rivets(1, d.h - 2, d.w - 2, 'gun', { step: 4 }); for (let x = 2; x < d.w - 2; x += 7) d.vline(x, 2, 4, 'slag', 1); },
    east(d) {
      bricks(d); d.rect(0, d.h - 3, d.w, 3, 'gun', 1);
      // the mouth: an arched opening onto the hot hearth, at the work height
      const cx = (d.w - 1) / 2, bot = d.h - 1 - (WORK - 2) + 0, top = bot - 9, hw = 6;
      d.fill((x, y) => {
        if (y < top || y > bot) return null; const dx = Math.abs(x - cx), arch = y < top + hw ? Math.hypot(dx, top + hw - y) : dx;
        if (arch > hw + 1.4) return null; if (arch > hw) return ['gun', 0];
        const t = (y - top) / (bot - top); return ['amber', t < 0.3 ? 1 : t < 0.6 ? 2 : (x + y) % 3 ? 3 : 4];
      });
    },
    south(d) {
      bricks(d); d.rect(0, d.h - 3, d.w, 3, 'gun', 1);
      d.plate(3, 3, d.w - 6, 12, 'sig'); d.rings(4, 4, d.w - 8, 10, [['sig', 1], ['sig', 3]]); d.hexMark(Math.floor(d.w / 2) - 4, 5);
      d.window(4, d.h - 9, d.w - 8, 5, 'gun', 'amber');
    },
    up(d) { d.inset(0, 0, d.w, d.h, 'gun'); d.rivets(1, 1, d.w - 2, 'gun', { step: 4 }); capStripes(d); },
  });
  const portMat = (face) => mat('gun', {
    [face](d) { d.rings(0, 0, d.w, d.h, [['cu', 3], ['gun', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'slag', 1); d.hline(2, 2, d.w - 4, 'slag', 0); },
    side(d) { d.fill((x, y) => ['cu', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); for (let y = 2; y < d.h; y += 4) d.px(0, y, 'gun', 0); },
  });
  const axle = mat('gun', { all(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); } }, { clean: true });
  const rollerMat = mat('steel', {
    top(d) { d.fill((x, y) => ['steel', y === 0 ? 4 : y === d.h - 1 ? 1 : x % 4 === 0 ? 2 : 3]); },
    side(d) { d.radial((r, a) => (r < 0.6 ? ['gun', 0] : near(a, 90) < 20 ? ['cu', 3] : ['steel', 2])); },
  }, { clean: true });
  const sprocket = mat('gun', {
    top(d) { d.fill((x, y) => ['gun', (x + y) % 2 ? 3 : 1]); },
    side(d) { d.radial((r, a) => (r > ROLLER_R - 0.4 ? ['gun', near(a, 45) < 12 ? 4 : 1] : r < 0.5 ? ['cu', 4] : ['gun', 2])); },
  }, { clean: true });
  const pulley = mat('gun', {
    top(d) { d.fill((x, y) => ['gun', x === 0 || x === d.w - 1 ? 4 : 2]); },
    side(d) { d.radial((r, a) => (r < 0.8 ? ['cu', 4] : near(a, 60) < 6 && r < 0.85 * Math.max(d.w, d.h) / 2 ? ['sig', 3] : ['gun', r > 0.8 * Math.max(d.w, d.h) / 2 ? 3 : 1])); },
  }, { clean: true });
  const beltMat = mat('slag', { all(d) { d.fill((x, y) => ['slag', x % 3 === 0 ? 3 : 1]); } }, { clean: true });
  const chainMat = mat('gun', { all(d) { d.fill((x) => ['gun', x % 2 ? 4 : 0]); } }, { clean: true });
  const gearMat = mat('cu', {
    top(d) { d.fill((x) => ['cu', x === 0 ? 4 : 2]); },
    side(d) { d.radial((r, a) => (r < 1 ? ['gun', 0] : r < 1.6 ? ['cu', 4] : near(a, 45) < 10 ? ['cu', 1] : r > 2.6 ? ['cu', 4] : ['cu', 2])); },
  });
  const toothMat = mat('cu', { all(d) { d.fill((x, y) => ['cu', x === 0 || y === 0 ? 4 : 2]); } }, { clean: true });
  const rollMat = mat('steel', {
    top(d) { d.fill((x, y) => { const e = x < 2 || x >= d.w - 2; return e ? ['gun', x === 0 || x === d.w - 1 ? 0 : 2] : ['steel', y === 0 ? 4 : y === d.h - 1 ? 1 : (x + y * 2) % 5 === 0 ? 2 : (x - y) % 7 === 0 ? 4 : 3]; }); },
    side(d) { d.radial((r, a) => (r < 1 ? ['cu', 4] : r < 2 ? ['gun', near(a, 90) < 20 ? 3 : 1] : ['steel', near(a, 30) < 4 ? 1 : r > 3 ? 4 : 3])); },
  }, { clean: true });
  const ramMat = mat('gun', {
    side(d) { d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]); if (d.w > 5 && d.h > 5) { d.rect(2, 2, d.w - 4, Math.max(1, d.h - 6), 'sig', 2); d.hline(2, 2, d.w - 4, 'sig', 4); d.bolt(2, 2, 'gun'); d.bolt(d.w - 4, 2, 'gun'); d.stripes(1, d.h - 4, d.w - 2, 2, ['gun', 0], ['sig', 3]); } d.rect(0, d.h - 1, d.w, 1, 'steel', 4); },
    top(d) { d.inset(0, 0, d.w, d.h, 'gun'); },
  });
  const anvilMat = mat('steel', {
    side(d) { d.fill((x, y) => ['steel', y === 0 ? 4 : y < 2 ? 3 : x % 5 === 0 ? 1 : 2]); d.rivets(1, d.h - 2, d.w - 2, 'gun', { step: 3 }); },
    up(d) { d.fill((x, y) => ['steel', (x + y) % 5 === 0 ? 2 : 3]); for (let x = 1; x < d.w; x += 3) d.px(x, hsh(x, 2, 3) * d.h | 0, 'amber', 1); },
  });
  const billetMat = mat('amber', { all(d) { d.fill((x, y) => ['amber', y === 0 ? 4 : (x + 2 * y) % 5 === 0 ? 2 : 3]); } }, { clean: true });
  const plateMat = mat('steel', {
    side(d) { d.fill((x, y) => ['steel', y % 2 === 0 ? 3 : 1]); for (let y = 0; y < d.h; y += 2) if (hsh(y, 1, 5) < 0.5) d.px(1 + (hsh(y, 2, 5) * (d.w - 2) | 0), y, 'gun', 0); },
    up(d) { d.fill((x, y) => ['steel', (x * 2 + y) % 9 === 0 ? 4 : 3]); d.rings(0, 0, d.w, d.h, [['steel', 1]]); },
  });
  const stackMat = mat('gun', {
    side(d) { d.fill((x, y) => ['gun', y % 6 === 0 ? 4 : y % 6 === 1 ? 0 : x === 0 ? 3 : 2]); for (let y = 0; y < 3; y++) d.hline(0, y, d.w, 'slag', 1 + (y & 1)); },
    up(d) { d.rect(0, 0, d.w, d.h, 'slag', 0); d.rings(0, 0, d.w, d.h, [['gun', 3]]); },
  });
  const coalChute = mat('gun', {
    side(d) { d.hline(0, 0, d.w, 'gun', 4); d.hline(0, d.h - 1, d.w, 'gun', 0); for (let x = 2; x < d.w; x += 4) d.bolt(x, 0, 'gun'); },
    up(d) { d.fill((x, y) => ['slag', hsh(x, y, 4) < 0.3 ? 3 : 0]); },
  });
  const handle = mat('cu', { all(d) { d.rect(0, 0, d.w, d.h, 'cu', 3); d.hline(0, 0, d.w, 'cu', 4); } }, { clean: true });
  // the cam log: bark along the sides with iron hoops, end grain rings at the cut faces
  const logMat = mat('wood', {
    top(d) { d.fill((x, y) => ['wood', x % 9 === 4 ? 0 : (y + (x >> 2)) % 3 === 0 ? 1 : (hsh(x, y >> 1, 3) < 0.2 ? 3 : 2)]); for (let x = 2; x < d.w; x += 9) d.vline(x, 0, d.h, 'gun', 2); },
    side(d) { d.radial((r) => (r > LOG_R - 0.6 ? ['wood', 1] : ['wood', (r * 2.2 | 0) % 2 ? 3 : 2])); },
  });
  const lobeMat = mat('wood', {
    all(d) { d.fill((x, y) => ['wood', y === 0 ? 4 : (x + y * 3) % 5 === 0 ? 1 : 2]); d.rings(0, 0, d.w, d.h, [['gun', 1]]); d.px(1, 1, 'cu', 4); if (d.w > 3) d.px(d.w - 2, d.h - 2, 'cu', 3); },
  });
  const gearBody = (R) => mat('gun', {
    top(d) { d.fill((x) => ['gun', x === 0 ? 4 : x === d.w - 1 ? 0 : 2]); },
    side(d) { d.radial((r, a) => (r < 1.2 ? ['cu', 4] : r < 2 ? ['gun', 0] : r > R - 1.6 ? ['gun', 4] : r > R - 2.4 ? ['gun', 1] : near(a, 45, 22.5) < 9 && r > 2.5 ? ['slag', 1] : ['sig', near(a, 45) < 5 ? 3 : 2])); },
  });
  const gearTooth = mat('gun', { all(d) { d.fill((x, y) => ['gun', x === 0 || y === 0 ? 4 : x === d.w - 1 ? 1 : 3]); } });

  // ---------------------------------------------------------------- base and furnace
  // the deck leaves a pit under the mill pinions
  b.box('deck#1', [-47, 0, -10], [47, 2, 15], deck);
  b.box('deck#2', [-47, 0, -15], [18, 2, -10], deck);
  b.box('deck#3', [28, 0, -15], [47, 2, -10], deck);
  b.box('furnace#1', [-46, 2, -13], [-24, 30, 13], furnaceBody);
  b.box('furnace#2', [-46.5, 28, -13.5], [-23.5, 30.5, 13.5], panel);
  b.box('port_in', [-48, 4, -4], [-46, 12, 4], portMat('west'));
  b.box('door_handle', [-47, 13, -3], [-46, 14, 3], handle);
  b.box('stack_base', [-40.5, 30.5, -4.5], [-31.5, 32, 4.5], frame);
  b.box('stack_rest', [-28, 30.5, -3], [-26, 32, 3], frame);
  for (const z0 of [-4.49, 2.99]) b.box(`stack_hinge_${z0 < 0 ? 'n' : 's'}`, [-34.5, 31, z0], [-32, 34.5, z0 + 1.5], frame);
  b.group('stack', [-32.5, 32, 0], () => {
    b.box('stack#1', [-39.5, 32, -3.5], [-32.5, 45.51, 3.5], stackMat);
    b.box('stack#2', [-40, 44, -4], [-32.5, 45.5, 4], frame);
  });
  // coal: fuel port on the north face, an inclined chute into the firebox
  b.box('port_fuel', [-44, 4, -24], [-36, 12, -23], portMat('north'));
  const SL = { origin: [-40, 8, -18], rotation: [16.7, 0, 0] };
  b.box('coal_chute#1', [-43, 7, -23.3], [-37, 8, -12.7], coalChute, SL);
  b.box('coal_chute#2', [-43, 8, -23.3], [-42.3, 10, -12.7], coalChute, SL);
  b.box('coal_chute#3', [-37.7, 8, -23.3], [-37, 10, -12.7], coalChute, SL);
  b.box('coal_leg', [-41.5, 0, -22], [-38.5, 7.8, -20], frame);

  // ---------------------------------------------------------------- roller tables (live rollers, chain at the back)
  for (const [n, x0, x1] of [['1', -24, -6], ['2', 6, 16]]) {
    b.box(`rail_${n}n`, [x0, 2, -7.5], [x1, WORK - 0.6, -6], frame);
    b.box(`rail_${n}s`, [x0, 2, 6], [x1, WORK - 0.6, 7.5], frame);
  }
  ROLLERS.forEach((x, i) => {
    b.group(`roller_${i + 1}`, [x, ROLLER_Y, -6.75], () => {
      b.prism(`roller_${i + 1}`, [x, ROLLER_Y, 0], ROLLER_R, 12, 'z', rollerMat, 8);
      b.box(`roller_${i + 1}#9`, [x - 1, ROLLER_Y - 1, Z_CHAIN[1]], [x + 1, ROLLER_Y + 1, -5.99], axle);
      b.prism(`sprk_${i + 1}`, [x, ROLLER_Y, (Z_CHAIN[0] + Z_CHAIN[1]) / 2], ROLLER_R, 1, 'z', sprocket, 8);
    });
  });
  const chainX0 = Math.min(...ROLLERS), chainX1 = Math.max(...ROLLERS);
  b.box('chain_top', [chainX0, WORK, Z_CHAIN[0]], [chainX1, WORK + 0.8, Z_CHAIN[1]], chainMat);
  b.box('chain_bot', [chainX0, ROLLER_Y - ROLLER_R - 0.8, Z_CHAIN[0]], [chainX1, ROLLER_Y - ROLLER_R, Z_CHAIN[1]], chainMat);
  for (const x of [-22, 17]) b.box(`chain_guard_${x < 0 ? 'w' : 'e'}`, [x - 1, 2, Z_CHAIN[0] - 0.5], [x + 1, ROLLER_Y - ROLLER_R - 0.8, Z_CHAIN[1] + 0.5], frame);

  // ---------------------------------------------------------------- power: port, gearbox, output shaft, idler
  b.box('port_power', [4, 4, -24], [12, 12, -23], portMat('north'));
  b.group('shaft_in', [8, 8, -23], () => b.prism('shaft_in', [8, 8, -22.5], 2, 1, 'z', rollerMat, 8));
  b.box('gearbox', [2, 0, -22], [14, 17, -20], panel);
  b.box('gearbox#2', [1.5, 17, -22.5], [14.5, 18, -19.5], frame);
  b.group('drive_out', [DRIVE[0], DRIVE[1], -20], () => {
    b.box('drive_out', [DRIVE[0] - 1, DRIVE[1] - 1, -20.2], [DRIVE[0] + 1, DRIVE[1] + 1, Z_CHAIN[1] - 0.1], axle);
    b.prism('g_drive', [...DRIVE, (Z_GEAR[0] + Z_GEAR[1]) / 2], GD - 1, 2, 'z', gearBody(GD - 1), 8);
    teeth(b, 'g_drive', [...DRIVE, (Z_GEAR[0] + Z_GEAR[1]) / 2], 'z', GD + 1, 4, 1.8, 1.4, gearTooth, { start: 5, phase: PH_D });
    b.prism('sprk_mill_drive', [...DRIVE, (Z_MILL[0] + Z_MILL[1]) / 2], 1.5, 1, 'z', sprocket, 8);
    b.prism('sprk_drive', [...DRIVE, (Z_CHAIN[0] + Z_CHAIN[1]) / 2], ROLLER_R, 1, 'z', sprocket, 8);
  });
  b.group('idler', [IDLER[0], IDLER[1], -20], () => {
    b.box('idler#1', [IDLER[0] - 1, IDLER[1] - 1, -20.2], [IDLER[0] + 1, IDLER[1] + 1, -15.5], axle);
    b.prism('g_idler', [...IDLER, (Z_GEAR[0] + Z_GEAR[1]) / 2 + 0.02], GI - 1, 2, 'z', gearBody(GI - 1), 8);
    teeth(b, 'g_idler', [...IDLER, (Z_GEAR[0] + Z_GEAR[1]) / 2 + 0.02], 'z', GI + 1, 3, 1.7, 1.4, gearTooth, { start: 5, phase: PH_I });
  });
  const chain = (name, c1, r1, c2, r2, [z0, z1]) => runs(c1, r1, c2, r2).forEach((sg, i) => {
    const t = 0.8, mid = [(sg.P1[0] + sg.P2[0]) / 2 + sg.n[0] * t / 2, (sg.P1[1] + sg.P2[1]) / 2 + sg.n[1] * t / 2];
    b.box(`${name}_${i + 1}`, [mid[0] - sg.len / 2, mid[1] - t / 2, z0], [mid[0] + sg.len / 2, mid[1] + t / 2, z1], chainMat, { origin: [...mid, (z0 + z1) / 2], rotation: [0, 0, sg.ang] });
  });
  chain('millc', DRIVE, 1.5, [MILL_X, BOT_Y], MILL_SPRK, Z_MILL);

  // ---------------------------------------------------------------- drop hammer: anvil, frame, ram, wooden cam log
  b.box('anvil#1', [-5, 2, -5], [5, WORK, 5], anvilMat);
  b.box('anvil#2', [-6, 2, -6], [6, 4, 6], frame);
  for (const [s, z0] of [['n', -11], ['s', 7]]) b.box(`post_${s}`, [-4, 2, z0], [4, 44, z0 + 4], frame);
  b.box('crosshead', [-9, 44, -13], [15, 47, 11], panel);
  // bearings: a pedestal behind (between the gear and the chain plane) and a hanger in front of the lobe
  b.box('cam_bearing_back', [CAM[0] - 2, 2, -13.3], [CAM[0] + 2, CAM[1] + 0.5, -11.8], frame);
  b.box('cam_bearing_front', [CAM[0] - 1.5, CAM[1] + LOG_R - 0.6, -3.2], [CAM[0] + 1.5, 44, -1.7], frame);
  const DIE = WORK;
  b.group('ram', [0, DIE, 0], () => {
    b.box('ram', [-4, DIE, -5], [4, DIE + 2, 5], ramMat);
    b.box('ram#2', [-4, DIE + 2, -7], [4, TAPPET + 3, 7], ramMat);
    // tappet: a thick iron-shod block on the ram's east side, over the lobe's path
    b.box('ram#3', [3.5, TAPPET, -6.5], [ARM_END, TAPPET + 3, -3.5], lobeMat);
  });
  b.group('cam', [CAM[0], CAM[1], -12.5], () => {
    b.prism('cam', [CAM[0], CAM[1], -9.55], LOG_R, 16.1, 'z', logMat, 8);
    // the lobe points west at rest, under the tappet; turning clockwise it lifts the tappet, then slips off its end
    b.box('cam_lobe', [CAM[0] - LOBE, CAM[1] - 3, -6.5], [CAM[0] - LOG_R + 0.5, CAM[1], -3.5], lobeMat);
    b.prism('g_cam', [...CAM, (Z_GEAR[0] + Z_GEAR[1]) / 2 - 0.02], GC - 1, 2, 'z', gearBody(GC - 1), 12);
    teeth(b, 'g_cam', [...CAM, (Z_GEAR[0] + Z_GEAR[1]) / 2 - 0.02], 'z', GC + 1, 8, 1.72, 1.4, gearTooth, { start: 7, phase: PH_C });
  });

  // ---------------------------------------------------------------- rolling mill: housings, rolls, pinion gears
  for (const [s, z0] of [['n', -11], ['s', 7]]) {
    b.box(`housing_${s}`, [MILL_X - 5, 2, z0], [MILL_X + 5, TOP_Y + ROLL_R + 4, z0 + 4], panel);
  }
  b.box('housing_cap', [MILL_X - 5.5, TOP_Y + ROLL_R + 4, -11.5], [MILL_X + 5.5, TOP_Y + ROLL_R + 6, 11.5], frame);
  b.box('screwdown', [MILL_X - 1.5, TOP_Y + ROLL_R + 6, -1.5], [MILL_X + 1.5, TOP_Y + ROLL_R + 9, 1.5], handle);
  for (const [n, y] of [['bot', BOT_Y], ['top', TOP_Y]]) {
    b.group(`roll_${n}`, [MILL_X, y, -9], () => {
      b.prism(`roll_${n}`, [MILL_X, y, 0], ROLL_R, 14, 'z', rollMat, 12);
      const pz = n === 'bot' ? -12.5 : -12.48;
      b.box(`roll_${n}#9`, [MILL_X - 1.2, y - 1.2, n === 'bot' ? Z_MILL[0] + 0.1 : -13.4], [MILL_X + 1.2, y + 1.2, -6.99], axle);
      b.prism(`pin_${n}`, [MILL_X, y, pz], PIN_R - 1, 2, 'z', gearMat, 8);
      teeth(b, `pin_${n}`, [MILL_X, y, pz], 'z', PIN_R + 1, 4, 1.8, 2, toothMat, { start: 5, phase: n === 'bot' ? 0 : 22.5 });
      if (n === 'bot') b.prism('sprk_mill', [MILL_X, y, (Z_MILL[0] + Z_MILL[1]) / 2], MILL_SPRK, 1, 'z', sprocket, 8);
    });
  }

  // ---------------------------------------------------------------- exit table and plate stack
  // exit: a short table, then the plates drop into a bin
  b.box('exit_table', [28, 2, -7], [33, WORK, 7], frame);
  b.box('plates', [33.5, 2, -5], [45.5, WORK - 1, 5], plateMat);
  for (const [n, z0] of [['n', -6.5], ['s', 5]]) b.box(`bin_${n}`, [33, 2, z0], [46, WORK, z0 + 1.5], frame);
  b.box('port_out', [46, 4, -4], [48, 12, 4], portMat('east'));
  b.box('port_out_foot', [46, 2, -4], [47, 4, 4], frame);

  // ---------------------------------------------------------------- work piece
  // bind pose: the ingot heating inside the furnace
  const BX = -32;
  b.group('billet', [BX, WORK, 0], () => b.box('billet', [BX - BILLET.len / 2, WORK, -BILLET.w / 2], [BX + BILLET.len / 2, WORK + BILLET.h, BILLET.w / 2], billetMat));

  // ---------------------------------------------------------------- animation
  const L = 12, TC = 2, DRIVE_TURNS = -12; // rollers 1 turn/s: 9.4 px/s at the surface
  const spinZ = (turns, off = 0) => ({ rotation: range(8 * L + 1).map((q) => [q / 8, [0, 0, off + (turns * 360 * q) / (8 * L)]]) });
  // hammer: the cam lifts the tappet by LOBE·sin(angle) from the moment the lobe reaches west, until the tip slips
  // off the tappet end (RELEASE); then the ram falls onto whatever lies on the anvil. Blows at 0.6, 2.6 and 4.6 s.
  // the cam turns from its bind angle with no offset (an offset would break the gear mesh), so each lift starts
  // on a whole cam turn and the blows land TR later
  const TR = (TC * RELEASE) / (2 * Math.PI), T0 = 4, BLOWS = [4, 6, 8].map((b) => b + TR);
  const H = [BILLET.h, 2.0, 1.6, 1.6]; // billet height before blow 1, after blow 1, 2, 3
  const restAt = (t) => (t < BLOWS[0] ? 0 : t < BLOWS[1] ? H[1] : t < BLOWS[2] ? H[2] : t < 9.6 ? H[3] : 0); // die height above the anvil at rest
  const lifted = (t) => { const c = mod(t - T0, TC); return c > TR ? null : CAM[1] - TAPPET + LOBE * Math.sin((2 * Math.PI * c) / TC); };
  const ramKeys = [];
  for (let q = 0; q <= 8 * L; q++) {
    const t = q / 8; if (BLOWS.some((tb) => t > tb - 0.13 && t < tb + 0.13)) continue; const lf = lifted(t);
    ramKeys.push([t, [0, lf === null ? restAt(t) : Math.max(restAt(t), lf), 0]]);
  }
  for (const tb of BLOWS) ramKeys.push([tb - 0.01, [0, Math.max(restAt(tb - 0.02), LOBE * Math.sin(RELEASE)), 0]], [tb + 0.12, [0, restAt(tb + 0.01), 0]]);
  ramKeys.push([9.55, [0, restAt(9.55), 0]], [9.65, [0, restAt(9.65), 0]]);
  ramKeys.sort((a, c) => a[0] - c[0]);
  // billet: out of the furnace, under the hammer for three blows, through the rolls, into the bin
  const bx = (x, y = 0) => [x - BX, y, 0];
  const h = (k) => H[k] / BILLET.h;
  const billet = {
    // it rolls to the hammer and waits, slips under while the cam holds the ram up, takes three blows, rolls on
    position: [[0, bx(-32)], [2.0, bx(-12.5)], [4.12, bx(-12.5)], [4.32, bx(0)], [8.6, bx(0)], [10.4, bx(MILL_X - 4)], [11.3, bx(MILL_X + 8)], [11.5, bx(34)], [11.62, bx(39.5, -1)], [11.83, bx(39.5, -1)], [11.84, bx(-32)], [L, bx(-32)]],
    scale: [[0, [1, 1, 1]], [4.34, [1, 1, 1]], [4.46, [1.1, h(1), 1]], [6.34, [1.1, h(1), 1]], [6.46, [1.2, h(2), 1]], [8.34, [1.2, h(2), 1]], [8.46, [1.3, h(3), 1]], [10.4, [1.3, h(3), 1]], [10.7, [1.6, GAP / BILLET.h, 1]], [11.7, [1.6, GAP / BILLET.h, 1]], [11.82, [0.02, 0.02, 0.02]], [11.88, [0.02, 0.02, 0.02]], [L, [1, 1, 1]]],
  };
  const CAM_TURNS = (DRIVE_TURNS * GD) / GC;
  const working = {
    shaft_in: spinZ(DRIVE_TURNS / -1.5), drive_out: spinZ(DRIVE_TURNS), idler: spinZ(-DRIVE_TURNS * GD / GI),
    cam: spinZ(CAM_TURNS),
    roll_bot: spinZ(DRIVE_TURNS * 1.5 / MILL_SPRK), roll_top: spinZ(-DRIVE_TURNS * 1.5 / MILL_SPRK),
    ...Object.fromEntries(ROLLERS.map((_, i) => [`roller_${i + 1}`, spinZ(DRIVE_TURNS)])),
    ram: { position: ramKeys }, billet,
  };
  b.anim('working', L, working);

  // packaged: stack folded onto its rest on the furnace roof; deploy raises it
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const D = 4, FOLD = -90;
  b.anim('packaged', 0.5, { stack: { rotation: [[0, [0, 0, FOLD]]] } });
  b.anims[b.anims.length - 1].loop = 'hold';
  b.anim('deploy', D, {
    stack: { rotation: range(21).map((q) => [+(0.5 + 2.5 * q / 20).toFixed(3), [0, 0, FOLD * (1 - ease(q / 20))]]).concat([[0, [0, 0, FOLD]], [D, [0, 0, 0]]]).sort((a, c) => a[0] - c[0]) },
  });
  b.anims[b.anims.length - 1].loop = 'hold';
}
