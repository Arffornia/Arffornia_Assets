// Bench: Oritech Centrifuge from reference renders. Material goes into the basin of the base housing;
// the rotor on the central shaft spins six glass tanks around the vertical axis and the fluid separates.
import { addRamp, hsh, surface } from '../pix.mjs';

addRamp('rust', ['#4a170c', '#7e2e18', '#b04a24', '#cf6a33', '#e8995a'], { clusters: 0.05, chips: 0.08 });
addRamp('navy', ['#0d131c', '#1a2533', '#2a3a4e', '#3e546c', '#5d7790'], { clusters: 0.03, streaks: 0.04 });
addRamp('ice', ['#2c5f70', '#4f95ab', '#74bccd', '#a5dbe6', '#d8f2f6']);
addRamp('cap', ['#101215', '#1d2126', '#2a2f35', '#3b4148', '#59616a']);
addRamp('glass', ['#07090c', '#1c2127', '#aeb9bf', '#cfd9dc', '#eef4f5']);

export const meta = {
  title: 'Centrifuge (bench c2)', note: 'Spinning separator, Oritech bench reproduction.', footprint: [1, 1], height: 2, tier: 1,
  joints: { rotor: { type: 'revolute', axis: 'y' } },
  lint: { allow: [
    { a: 'strut_*', b: 'collar', check: 'overlap', why: 'strut heads are welded into the shaft collar' },
    { a: 'tie_*', b: 'core', check: 'overlap', why: 'tie bars pass through the rotor core' },
    { a: 'tie_*', b: 'tank_*', check: 'overlap', why: 'tie bars end inside the tank caps' },
    { a: 'tie_*', b: 'tie_*', check: 'overlap', why: 'three bars cross at the axis' },
  ] },
};

// dark fluid strokes inside the tank glass, 4 wide; '#' fluid, '+' fluid edge
const FLUID = [
  ['....', '.##.', '.##.', '..#.', '###.', '##..', '.##.', '.##.'],
  ['..#.', '.##.', '.#..', '.##.', '..##', '.##.', '##..', '.#..'],
  ['....', '.#..', '.##.', '###.', '.##.', '..#.', '.##.', '.###'],
  ['.#..', '.##.', '..#.', '.##.', '.#..', '.##.', '###.', '.#..'],
];

export function build(b, { mat }) {
  const C = { clean: false };
  const fill = (d, f) => { for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const r = f(x, y); if (r) d.px(x, y, r[0], r[1]); } };

  // navy steel laid as staggered courses, like the Oritech housing blocks
  const courses = (d, ramp = 'navy', h = 3) => fill(d, (x, y) => {
    const row = Math.floor(y / h), t = d.side ? y / Math.max(1, d.h - 1) : 0.5;
    const base = t < 0.3 ? 3 : t < 0.7 ? 2 : 1;
    if (y % h === h - 1) return [ramp, 0];
    if ((x + row * 3) % 7 === 0) return [ramp, 1];
    if (y % h === 0 && hsh(x >> 1, row, d.seed) < 0.5) return [ramp, Math.min(4, base + 1)];
    return [ramp, hsh(x >> 1, y, d.seed + 1) < 0.15 ? base - 1 || 1 : base];
  });
  const orangeBlocks = (d) => fill(d, (x, y) => {
    const c = ((x >> 1) + (y >> 1)) & 1, t = d.side ? y / Math.max(1, d.h - 1) : 0.3;
    if (y === 0 && d.side) return ['rust', 4];
    if (y === d.h - 1 && d.side) return ['rust', 1];
    return ['rust', (t < 0.5 ? 3 : 2) - (c && hsh(x >> 1, y >> 1, d.seed) < 0.6 ? 1 : 0)];
  });
  const column = (d, ramp = 'navy') => fill(d, (x, y) => {
    const k = x === 0 ? 1 : x === d.w - 1 ? 0 : x === 1 ? 3 : 2;
    return [ramp, y % 4 === 3 && x > 0 && x < d.w - 1 ? Math.max(0, k - 1) : k];
  });

  // window panel: orange frame, ice ring, a navy well with a bright ice bar between two dark slots
  const windowFace = (d) => {
    const W = d.w, H = d.h, m = Math.floor(W / 2) - 1;
    fill(d, (x, y) => {
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) return ['rust', y === 0 ? 3 : x === W - 1 || y === H - 1 ? 1 : 2];
      if (x === 1 || y === 1 || x === W - 2 || y === H - 2) return ['ice', y < 3 ? 3 : 2];
      if (x === m || x === m + 1) return ['ice', x === m ? 4 : 3];
      const left = x < m, xl = left ? x - 2 : x - m - 2, wl = m - 2, yl = y - 2, hl = H - 4;
      const cornerOut = (xl === 0 || xl === wl - 1) && (yl === 0 || yl === hl - 1);
      if (cornerOut) return ['ice', 2];
      if (xl === (left ? wl - 1 : 0)) return ['ice', 1];
      if (yl === 0) return ['navy', 3];
      if (xl === (left ? 0 : wl - 1)) return ['navy', 2];
      return ['navy', yl < hl / 2 ? 1 : 0];
    });
    d.px(3, 3, 'navy', 4); d.px(m + 3, 3, 'navy', 4);
  };
  const panel = mat('rust', {
    side: orangeBlocks, top: orangeBlocks,
    east: windowFace, west: windowFace,
    up(d) { d.rect(0, 0, d.w, d.h, 'ice', 3); d.hline(0, 0, d.w, 'ice', 4); },
  }, C);

  const body = mat('navy', {
    side: (d) => courses(d),
    up(d) {
      courses(d);
      d.inset(2, 2, d.w - 4, d.h - 4, 'navy');
      fill(d, (x, y) => (x > 2 && y > 2 && x < d.w - 3 && y < d.h - 3) ? ['ice', ((x * 3 + y * 5) % 7 === 0) ? 4 : (x + y) % 3 === 0 ? 3 : 2] : null);
      d.rect(5, 5, d.w - 10, d.h - 10, 'navy', 1);
    },
  }, C);
  const plinth = mat('navy', { all(d) { courses(d, 'navy', 2); }, top(d) { fill(d, (x, y) => ['navy', ((x >> 1) + (y >> 1)) & 1 ? 1 : 2]); } }, C);
  const pillar = mat('navy', { side: (d) => column(d), top(d) { d.rect(0, 0, d.w, d.h, 'navy', 3); d.px(1, 0, 'navy', 4); } }, C);
  const bracket = mat('rust', { all: orangeBlocks }, C);
  const leg = mat('rust', { side(d) { fill(d, (x, y) => ['rust', x === 0 ? 4 : x === d.w - 1 ? 1 : y < d.h / 3 ? 3 : (hsh(x, y >> 1, d.seed) < 0.25 ? 3 : 2)]); } }, C);
  const shaft = mat('navy', {
    side(d) { column(d); d.hline(0, 0, d.w, 'navy', 4); d.hline(0, d.h - 1, d.w, 'navy', 0); d.rect(1, d.h - 3, d.w - 2, 1, 'navy', 4); },
  }, C);
  const collar = mat('navy', { side(d) { fill(d, (x, y) => ['navy', y === 0 ? 4 : (x & 1 ? 1 : 3)]); } }, C);
  const hub = mat('rust', {
    side(d) { orangeBlocks(d); d.px(0, d.h - 1, 'rust', 0); d.px(d.w - 1, d.h - 1, 'rust', 0); },
    up(d) { surface(d, 'rust', { flat: true }); fill(d, (x, y) => (x < 2 || y < 2 || x > d.w - 3 || y > d.h - 3) ? ['rust', (x + y) & 1 ? 3 : 4] : null); for (const [x, y] of [[0, 0], [d.w - 1, 0], [0, d.h - 1], [d.w - 1, d.h - 1]]) d.px(x, y, 'rust', 1); },
    down(d) { orangeBlocks(d); d.rect(2, 2, d.w - 4, d.h - 4, 'rust', 1); },
  }, C);
  const core = mat('navy', { side(d) { column(d); for (let y = 2; y < d.h; y += 4) d.hline(0, y, d.w, 'navy', 4); }, top(d) { d.rect(0, 0, d.w, d.h, 'navy', 3); d.px(1, 1, 'ice', 4); } }, C);
  const arm = mat('rust', { all(d) { fill(d, (x, y) => ['rust', y === 0 ? 4 : y === d.h - 1 ? 1 : (x >> 1) & 1 ? 3 : 2]); } }, C);

  // tank: glass with dark fluid strokes, ice-tinted edge columns, a navy cap with a light cross on top
  let tankN = 0;
  const tankSide = (d) => {
    const cap = 3, glyph = FLUID[(tankN++ + d.seed) % FLUID.length];
    fill(d, (x, y) => {
      if (y < cap) return ['cap', y === 0 ? 4 : y === cap - 1 ? 0 : (x === 0 ? 2 : 3)];
      const gy = y - cap;
      if (x === 0) return gy < 2 || gy > d.h - cap - 3 ? ['ice', 3] : ['glass', 3];
      if (x === d.w - 1) return ['ice', gy > d.h - cap - 3 ? 2 : 4];
      const g = glyph[gy] && glyph[gy][x];
      if (g === '#') return ['glass', x === 1 && gy > 2 ? 1 : 0];
      if (gy === d.h - cap - 1) return ['ice', 3];
      return ['glass', gy < 3 ? 4 : hsh(x, gy, d.seed) < 0.25 ? 3 : 4];
    });
  };
  const tank = mat('glass', {
    side: tankSide,
    up(d) { d.rect(0, 0, d.w, d.h, 'cap', 2); d.hline(1, 1, d.w - 2, 'cap', 4); d.vline(1, 0, d.h, 'cap', 4); d.px(1, 1, 'cap', 3); d.px(d.w - 1, d.h - 1, 'cap', 1); },
    down(d) { d.rect(0, 0, d.w, d.h, 'ice', 2); d.rect(1, 1, d.w - 2, d.h - 2, 'glass', 1); },
  }, { clean: true });

  // base housing: navy block, window panels east and west, pillar and two clamp bands north and south
  b.box('plinth', [-7.5, 0, -7.5], [7.5, 1, 7.5], plinth);
  b.box('body', [-6.5, 1, -6.5], [6.5, 8.5, 6.5], body);
  for (const s of [1, -1]) {
    const e = s > 0 ? 'e' : 'w', n = s > 0 ? 's' : 'n';
    b.box(`panel_${e}`, s > 0 ? [6.5, 1, -7] : [-7.25, 1, -7], s > 0 ? [7.25, 12, 7] : [-6.5, 12, 7], panel);
    b.box(`pillar_${n}`, [-1.75, 1, s > 0 ? 6.5 : -7.5], [1.75, 10.5, s > 0 ? 7.5 : -6.5], pillar);
    for (const sx of [1, -1]) {
      const xa = sx > 0 ? 1.75 : -7.2, xb = sx > 0 ? 7.2 : -1.75, za = s > 0 ? 6.5 : -7.75, zb = s > 0 ? 7.75 : -6.5;
      b.box(`clamp_hi_${n}${sx > 0 ? 'e' : 'w'}`, [xa, 4.5, za], [xb, 7.5, zb], bracket);
      b.box(`clamp_lo_${n}${sx > 0 ? 'e' : 'w'}`, [sx > 0 ? 1.75 : -6.8, 1.5, s > 0 ? 6.5 : -7.4], [sx > 0 ? 6.8 : -1.75, 4.5, s > 0 ? 7.4 : -6.5], bracket);
    }
  }
  // four struts from the basin rim up to the shaft collar
  for (const [n, dx, dz] of [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]]) {
    const cx = dx * 3.7, cz = dz * 3.7;
    const rot = dx ? [0, 0, dx * 48] : [-dz * 48, 0, 0];
    const hx = dx ? 1 : 1.5, hz = dz ? 1 : 1.5;
    b.box(`strut_${n}`, [cx - hx, 7.9, cz - hz], [cx + hx, 12.9, cz + hz], leg, { origin: [cx, 10.4, cz], rotation: rot });
  }
  b.box('collar', [-2.25, 8.5, -2.25], [2.25, 12.5, 2.25], collar);
  b.box('shaft', [-1.5, 12.5, -1.5], [1.5, 18, 1.5], shaft);

  // rotor: hub, core, six tanks on a hexagon facing outward, three tie bars under the caps
  const R = 6;
  b.group('rotor', [0, 18, 0], () => {
    b.box('hub', [-3.5, 18, -3.5], [3.5, 20.5, 3.5], hub);
    b.box('core', [-1.25, 20.5, -1.25], [1.25, 29.5, 1.25], core);
    for (let i = 0; i < 3; i++) b.box(`tie_${i}`, [-R, 27.3 + i * 0.02, -1.2], [R, 29.2 + i * 0.02, 1.2], arm, { origin: [0, 28.3, 0], rotation: [0, -(45 + i * 60), 0] });
    for (let i = 0; i < 6; i++) {
      const deg = 45 + i * 60, a = deg * Math.PI / 180, x = R * Math.cos(a), z = R * Math.sin(a);
      b.box(`tank_${i}`, [x - 1.75, 21, z - 1.75], [x + 1.75, 30, z + 1.75], tank, { origin: [x, 25.5, z], rotation: [0, -deg, 0] });
    }
  });
  b.anim('working', 1.5, { rotor: { rotation: [[0, [0, 0, 0]], [1.5, [0, 360, 0]]] } });
}
