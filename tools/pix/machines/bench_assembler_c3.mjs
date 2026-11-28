// Bench: Oritech Assembler from reference renders. Parts are laid on the two glowing work plates of a
// workbench; the gantry carriage runs along the overhead beam and its tool head joins them into a component.
// Footprint declared [3, 2]: the beam end and the slab overhang the 2x1 body, as in Oritech.
import { addRamp, hsh, surface } from '../pix.mjs';

addRamp('rust', ['#4a170c', '#8e3419', '#c05427', '#d97638', '#eba25f'], { clusters: 0.04, chips: 0.06 });
addRamp('slate', ['#12161d', '#222a35', '#323d4b', '#4a5767', '#6a7a8b'], { clusters: 0.03, streaks: 0.04 });
addRamp('pale', ['#333f45', '#53636a', '#7d9295', '#9cb2b2', '#bccfcc']);
addRamp('ochre', ['#7a3a12', '#b0601e', '#d88a38', '#ebac58', '#f6cc84']);
addRamp('red', ['#3a0f08', '#6e2012', '#94301a', '#ad4424', '#c45a30']);
addRamp('ice', ['#2a5866', '#4b93a8', '#73bccc', '#a2dae4', '#d6f2f6']);
addRamp('navy', ['#0c1520', '#172838', '#21405a', '#326580', '#4f8eaa']);
addRamp('glowc', ['#0f4b5a', '#2aa0b6', '#72e4f0', '#b8f6fb', '#f0ffff'], null, { glow: true });

export const meta = {
  title: 'Assembler (bench c3)', note: 'Workbench assembler, Oritech bench reproduction.', footprint: [3, 2], height: 2, tier: 1,
  joints: { gantry: { type: 'prismatic', axis: 'x' } },
  lint: { allow: [{ a: 'chute', b: 'slab_w', check: 'overlap', why: 'the tilted parts chute is bolted into the counter slab' }] },
};
export const look = { glow: 1.0 };

export function build(b, { mat }) {
  const C = { clean: true };
  const fill = (d, f) => { for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const r = f(x, y); if (r) d.px(x, y, r[0], r[1]); } };
  const band = (d, y) => { if (!d.side) return 2; const t = y / Math.max(1, d.h - 1); return t < 0.2 ? 3 : t < 0.75 ? 2 : 1; };

  // Oritech orange: horizontal brushed streaks over a light map
  const rustBase = (d) => fill(d, (x, y) => {
    const k = band(d, y), r = hsh(x >> 2, y, d.seed);
    const q = hsh(x >> 1, y, d.seed + 3);
    if (q > 0.985) return ['ochre', 3]; if (q < 0.012) return ['red', 2];
    return ['rust', r < 0.24 ? Math.max(1, k - 1) : r > 0.78 ? Math.min(4, k + 1) : q < 0.08 ? Math.max(1, k - 1) : q > 0.95 ? Math.min(4, k + 1) : k];
  });
  // Oritech key maze: nested frames broken into key-shaped strokes, alternating light and dark
  const brokenRings = (d, list) => {
    for (const [i, rp, k] of list) {
      const w = d.w - 2 * i, h = d.h - 2 * i; if (w < 2 || h < 2) continue;
      const per = 2 * (w + h) - 4;
      for (let t = 0; t < per; t++) {
        if (hsh(Math.floor(t / 5), i, d.seed + 41) < 0.22) continue;
        const [x, y] = t < w ? [t, 0] : t < w + h - 1 ? [w - 1, t - w + 1] : t < 2 * w + h - 2 ? [w - 1 - (t - w - h + 2), h - 1] : [0, h - 1 - (t - 2 * w - h + 3)];
        d.px(i + x, i + y, rp, k);
      }
    }
  };
  // concentric frames of the cabinet doors
  const doorRings = (d, x, y, w, h) => d.rings(x, y, w, h, [['red', 2], ['ochre', 3], ['rust', 3]]);
  // teal window: ice frames, dark well, a pale bar flanked by two dark blocks
  const tealWindow = (d, x, y, w, h) => {
    d.rings(x, y, w, h, [['ice', 4], ['ice', 2]]);
    d.vline(x + w - 1, y + 1, h - 1, 'ice', 3); d.hline(x + 1, y + h - 1, w - 1, 'ice', 3);
    const iw = w - 4, ih = h - 4, m = x + 2 + Math.floor(iw / 2) - 1;
    d.rect(x + 2, y + 2, iw, ih, 'pale', 1); d.hline(x + 2, y + 2, iw, 'slate', 2);
    d.rect(m, y + 2, 2, ih, 'ice', 4); d.vline(m + 1, y + 3, ih - 1, 'ice', 3); d.px(m, y + ih + 1, 'ice', 3);
    const bh = Math.max(1, Math.min(3, ih - 3));
    d.rect(m - 2, y + 3, 2, bh, 'slate', 0); d.rect(m + 2, y + 3, 2, bh, 'slate', 0);
    d.px(m - 2, y + 3, 'slate', 3); d.px(m + 2, y + 3, 'slate', 3);
  };
  const slotPanel = (d, x, y, w, h) => {
    d.rings(x, y, w, h, [['pale', 3], ['pale', 1], ['slate', 2]]);
    d.rect(x + 3, y + 3, w - 6, h - 6, 'rust', 2); d.hline(x + 3, y + 3, w - 6, 'rust', 1); d.rect(x + 4, y + 4, w - 8, h - 8, 'rust', 3);
  };
  const slatePlain = (d) => fill(d, (x, y) => ['slate', d.side ? (y === 0 ? 4 : y === d.h - 1 ? 1 : (hsh(x >> 2, y, d.seed) < 0.2 ? 3 : 2)) : (hsh(x >> 1, y, d.seed) < 0.2 ? 3 : 2)]);
  const bricks = (d, x, y, w, h) => { d.rect(x, y, w, h, 'slate', 1); for (let j = y; j < y + h; j += 2) for (let i = x + ((j >> 1) & 1) * 2; i < x + w - 1; i += 4) d.rect(i, j, 3, 1, 'pale', j < y + h / 2 ? 3 : 2); };

  // ---------------- materials
  const plinth = mat('slate', { all(d) { fill(d, (x, y) => ['slate', d.side ? (y === 0 ? 3 : 1 + ((x >> 1) & 1)) : (((x >> 1) + (y >> 1)) & 1 ? 1 : 2)]); } }, C);
  const bodyW = mat('rust', {
    all: rustBase,
    south(d) { doorRings(d, 0, 0, d.w, d.h); tealWindow(d, 3, 3, d.w - 6, d.h - 5); },
    north(d) { doorRings(d, 1, 0, d.w - 2, d.h); d.rings(5, 3, d.w - 10, d.h - 6, [['rust', 1], ['rust', 4]]); d.rect(2, 4, 1, 6, 'ice', 3); d.px(2, 4, 'ice', 4); },
    west(d) { doorRings(d, 0, 0, d.w, d.h); tealWindow(d, 3, 3, d.w - 6, d.h - 5); },
  }, C);
  const bodyE = mat('rust', {
    all: rustBase,
    south(d) { doorRings(d, 0, 0, d.w - 1, d.h); slotPanel(d, 3, 2, d.w - 7, d.h - 4); },
    north(d) { doorRings(d, 0, 0, d.w, d.h); d.rect(d.w - 3, 2, 1, 6, 'ice', 3); },
    east(d) { doorRings(d, 0, 0, d.w, d.h); tealWindow(d, 3, 3, d.w - 6, d.h - 5); },
  }, C);
  const slab = mat('slate', {
    side: slatePlain,
    up(d) {
      fill(d, (x, y) => ['slate', x === 0 || y === 0 ? 4 : x === d.w - 1 || y === d.h - 1 ? 1 : 3]);
      d.rect(2, 2, d.w - 4, d.h - 4, 'rust', 1);
      fill(d, (x, y) => (x > 2 && y > 2 && x < d.w - 3 && y < d.h - 3) ? ['rust', (x + 2 * y) % 5 === 0 ? 3 : (hsh(x >> 1, y, d.seed) < 0.4 ? 2 : 1)] : null);
    },
  }, C);
  const workPlate = mat('navy', {
    up(d) {
      d.rect(0, 0, d.w, d.h, 'navy', 1); d.rings(0, 0, d.w, d.h, [['slate', 2]]);
      const L = 3, e = d.w - 2, f = d.h - 2;
      for (const [cx, cy, sx, sy] of [[1, 1, 1, 1], [e, 1, -1, 1], [1, f, 1, -1], [e, f, -1, -1]]) { for (let i = 0; i < L; i++) { d.px(cx + sx * i, cy, 'glowc', 2); d.px(cx, cy + sy * i, 'glowc', 2); } d.px(cx, cy, 'glowc', 3); }
      d.rect(3, 3, d.w - 6, d.h - 6, 'navy', 2); d.px(4, 4, 'navy', 3);
    },
    side(d) { d.rect(0, 0, d.w, d.h, 'slate', 3); },
  }, C);
  const mazeWall = mat('rust', {
    all: rustBase,
    east(d) {
      brokenRings(d, [[1, 'ochre', 3], [3, 'red', 2], [5, 'ochre', 2]]);
      const m = Math.floor(d.w / 2); d.vline(m, 2, d.h - 4, 'ochre', 3); d.vline(m - 1, 4, d.h - 8, 'red', 2);
      d.hline(4, 6, d.w - 8, 'navy', 3); d.hline(4, d.h - 6, d.w - 8, 'navy', 3);
    },
    west(d) { d.rings(0, 0, d.w, d.h, [['rust', 3], ['rust', 2], ['slate', 0]]); bricks(d, 3, 3, d.w - 6, d.h - 6); for (let i = 0; i < 6; i++) d.px(4 + i * 2, d.h - 5 - i * 2, 'pale', 4); },
    up(d) { d.rect(0, 0, d.w, d.h, 'rust', 3); d.hline(0, 0, d.w, 'rust', 4); },
  }, C);
  const ledge = mat('slate', { side: slatePlain, up(d) { d.rect(0, 0, d.w, d.h, 'slate', 2); d.rings(0, 0, d.w, d.h, [['slate', 3]]); } }, C);
  const lamp = mat('glowc', { all(d) { d.rect(0, 0, d.w, d.h, 'glowc', 1); }, up(d) { d.rect(0, 0, d.w, d.h, 'glowc', 2); d.hline(0, 0, d.w, 'glowc', 3); } }, C);
  const key = mat('navy', { all(d) { fill(d, (x, y) => ['navy', x === 0 || y === 0 ? 4 : x === d.w - 1 || y === d.h - 1 ? 1 : 3]); } }, C);
  const backWall = mat('navy', {
    north(d) {
      fill(d, (x, y) => { const c = x % 4; return ['navy', c === 0 ? 0 : c === 1 ? (y < d.h / 3 ? 4 : 3) : c === 2 ? 2 : 1]; });
      d.hline(0, 0, d.w, 'slate', 3); d.hline(0, d.h - 1, d.w, 'slate', 1);
    },
    south(d) {
      fill(d, (x, y) => ['pale', Math.max(1, band(d, y) - 1) + (hsh(x >> 2, y, d.seed) < 0.15 ? 1 : 0)]);
      d.rings(1, 1, d.w - 2, d.h - 2, [['pale', 3], ['pale', 2]]);
      fill(d, (x, y) => (x > 2 && y > 2 && x < d.w - 3 && y < d.h - 3) ? ['pale', hsh(x >> 1, y, d.seed + 2) < 0.2 ? 2 : 1] : null);
      const n = Math.floor((d.w - 6) / 4), ox = Math.floor((d.w - n * 4 + 1) / 2);
      for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) { const x = ox + i * 4, y = 3 + r * 3; d.rect(x, y, 3, 2, 'slate', 2); d.hline(x, y, 3, 'slate', 1); d.px(x + 2, y + 1, 'slate', 3); }
      for (let i = 0; i < n - 1; i++) { d.px(ox + i * 4 + 3, 5, 'pale', 4); d.px(ox + i * 4 + 3, 4, 'pale', 3); }
    },
    up(d) { d.rect(0, 0, d.w, d.h, 'slate', 3); d.hline(0, 0, d.w, 'slate', 4); },
    side(d) { d.rect(0, 0, d.w, d.h, 'slate', 2); },
  }, C);
  const post = mat('slate', { side(d) { fill(d, (x, y) => (y % 6 < 2) ? ['rust', y % 6 === 0 ? 3 : 1] : ['slate', x === 0 ? 3 : x === d.w - 1 ? 1 : 2]); }, top(d) { d.rect(0, 0, d.w, d.h, 'slate', 3); } }, C);
  const pipe = mat('slate', { side(d) { fill(d, (x, y) => ['slate', y % 5 === 0 ? 4 : x === 0 ? 3 : x === d.w - 1 ? 0 : 1]); } }, C);
  const beam = mat('slate', {
    side(d) { fill(d, (x, y) => y < d.h / 2 ? ['rust', y === 0 ? 4 : (hsh(x >> 2, y, d.seed) < 0.3 ? 2 : 3)] : ['navy', y === d.h - 1 ? 0 : (x % 3 === 0 ? 3 : 2)]); },
    up(d) { rustBase(d); d.hline(0, 0, d.w, 'rust', 4); },
    down(d) { fill(d, (x, y) => ['navy', x % 3 === 0 ? 2 : 1]); },
  }, C);
  const block = mat('rust', {
    all(d) { fill(d, (x, y) => { const c = ((x >> 1) + (y >> 1)) & 1; return ['rust', y === 0 && d.side ? 4 : y === d.h - 1 && d.side ? 1 : (c && hsh(x >> 1, y >> 1, d.seed) < 0.6 ? 2 : 3)]; }); },
  }, C);
  const striped = mat('rust', { all(d) { fill(d, (x, y) => ((x >> 1) % 3 === 2) ? ['slate', y === 0 ? 4 : 3] : ['rust', (x >> 1) % 3 === 0 ? 4 : 2]); } }, C);
  const slope = mat('rust', {
    all(d) { fill(d, (x, y) => (x % 4 === 3) ? ['pale', y < 2 ? 3 : 2] : ['rust', x % 4 === 0 ? 4 : y > d.h / 2 ? 2 : 3]); },
    side(d) { rustBase(d); },
  }, C);
  const strut = mat('ice', { all(d) { fill(d, (x, y) => ['ice', x === 0 ? 3 : x === d.w - 1 ? 1 : 2]); } }, C);
  const rod = mat('slate', { all(d) { fill(d, (x, y) => ['slate', x === 0 ? 4 : 1]); } }, C);
  const tip = mat('glowc', { all(d) { fill(d, (x, y) => ['glowc', y > d.h - 2 ? 3 : 2]); } }, C);
  const darkPanel = mat('navy', {
    north(d) { d.rings(0, 0, d.w, d.h, [['slate', 1], ['slate', 3]]); for (let j = 2; j < d.h - 2; j++) for (let i = 2; i < d.w - 2; i++) d.px(i, j, 'navy', ((i + (j & 1) * 2) % 4 === 0) ? 1 : j < d.h / 2 ? 3 : 2); },
    side(d) { d.rect(0, 0, d.w, d.h, 'slate', 2); },
  }, C);
  const handle = mat('slate', { all(d) { fill(d, (x, y) => ['slate', y === 0 ? 4 : 2]); } }, C);

  // ---------------- masses: two cabinets on plinths, the west one deeper
  b.box('plinth_w', [-16, 0, -8], [0, 2, 8], plinth);
  b.box('plinth_e', [0, 0, -7.5], [16.5, 1.5, 7], plinth);
  b.box('body_w', [-15.5, 2, -7.5], [0, 15, 7.5], bodyW);
  b.box('body_e', [0, 1.5, -7], [16, 14.5, 6.5], bodyE);
  // structure: counter slabs, east wall with its lamp ledge, back wall with post and pipe
  b.box('slab_w', [-16.5, 15, -8], [0.5, 17, 8], slab);
  b.box('slab_e', [0.5, 14.5, -7.5], [16.8, 16.5, 7.25], slab);
  b.box('plate_w', [-10, 17, -6], [-3, 17.5, 1], workPlate);
  b.box('plate_e', [1.5, 16.5, -6], [8.5, 17, 1], workPlate);
  b.box('east_wall', [11, 16.5, -7.5], [14, 31.25, 7.5], mazeWall);
  b.box('wall_cap', [10.75, 31.25, -7.75], [14.25, 32, 7.75], block);
  for (const [i, z] of [[0, -5.5], [1, 4]]) for (const [j, y] of [[0, 19.5], [1, 25.5]]) b.box(`key_${i}${j}`, [14, y, z], [14.75, y + 4.5, z + 1.5], key);
  b.box('ledge', [14, 16.5, -7], [16.5, 18.5, 7], ledge);
  b.box('lamp_n', [14.75, 18.5, -5], [15.75, 19, -2], lamp);
  b.box('lamp_s', [14.75, 18.5, 2], [15.75, 19, 5], lamp);
  b.box('back_wall', [-14, 17, 4], [9.5, 28.25, 6.5], backWall);
  b.box('back_cap', [-14.5, 28.25, 3.75], [9.5, 29, 6.75], ledge);
  b.box('back_post_w', [-15, 17, 3.5], [-14, 28.25, 6.99], post);
  b.box('beam_brace', [9.5, 28, 1.5], [11, 30, 3.5], ledge);
  b.box('post', [9.5, 16.5, 3.5], [11, 30, 7], post);
  b.box('pipe', [9.5, 1.5, 6.5], [11, 14.5, 7.5], pipe);
  b.box('clamp_lo', [9.25, 4, 6.51], [11.25, 5, 7.75], ledge);
  b.box('clamp_hi', [9.25, 10, 6.51], [11.25, 11, 7.75], ledge);
  b.box('front_panel', [2, 6, -8], [12, 12, -7], darkPanel);
  b.box('panel_tab', [6.5, 3.5, -7.75], [7.5, 6, -7], strut);
  // gantry: beam from the east wall over the whole bench, overhanging west
  b.box('beam#1', [-16.5, 28, -1.5], [11, 31, 1.5], beam);
  b.box('beam#2', [-17, 27.5, -2], [-12.5, 31.75, 2], striped);
  b.box('beam#3', [7, 27.5, -2], [10.99, 32, 2], block);
  // west tool arm: strut down to a tilted joint and a parked head over the parts chute
  b.box('strut', [-14.75, 21.5, -0.75], [-13.25, 28.2, 0.75], strut, { origin: [-14, 24.85, 0], rotation: [0, 0, 25] });
  b.box('joint#1', [-13.25, 19.8, -1.75], [-10.25, 22.8, 1.75], block, { origin: [-11.75, 21.3, 0], rotation: [0, 0, 45] });
  b.box('head_base', [-13.5, 17, -2.5], [-10.05, 17.75, 2.5], ledge);
  b.box('joint#2', [-12.25, 20.8, -2.25], [-11.25, 21.8, 2.25], rod);
  b.box('head_w', [-13.25, 17.75, -2], [-10.25, 20, 2], block);
  b.box('chute', [-17.5, 15.5, -7], [-13, 17.5, 7], slope, { origin: [-15, 16.5, 0], rotation: [0, 0, 25] });

  // moving carriage, parked over the west plate
  b.group('gantry', [-6.5, 29.5, 0], () => {
    b.box('carriage#1', [-9, 31, -2], [-4, 32, 2], block);
    b.box('carriage#2', [-9, 26.5, -2.5], [-4, 31, -1.5], block);
    b.box('carriage#3', [-9, 26.5, 1.5], [-4, 31, 2.5], block);
    b.box('hanger', [-7, 26, -0.5], [-6, 28, 0.5], rod);
    b.box('tool', [-8.5, 22.5, -2], [-4.5, 26, 2], block);
    b.box('tool_collar', [-7.75, 22, -1.25], [-5.25, 22.5, 1.25], rod);
    b.box('tip', [-7, 19, -0.5], [-6, 22, 0.5], tip);
  });
  b.anim('working', 4, { gantry: { position: [[0, [0, 0, 0]], [0.6, [0, 0, 0]], [2, [11.5, 0, 0]], [2.6, [11.5, 0, 0]], [4, [0, 0, 0]]] } });
}
