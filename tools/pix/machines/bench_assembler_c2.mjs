// Bench: Oritech Assembler from reference renders. Parts go on the two glowing work plates; the
// gantry carriage slides along the top rail and lowers its tool head onto them to join a component.
import { addRamp, surface, hsh } from '../pix.mjs';

addRamp('rust', ['#5e1f10', '#a03f20', '#c95d2c', '#de7c3c', '#eda75c'], { clusters: 0.04, chips: 0.08 });
addRamp('slate', ['#181d27', '#283040', '#3a4557', '#536074', '#73839a'], { streaks: 0.04, chips: 0.06 });
addRamp('grey', ['#353e47', '#4f5b63', '#6f7f86', '#8c9ea0', '#aebfbe']);
addRamp('blue', ['#12243a', '#1d3b56', '#2a5676', '#3c7596', '#5d98b8']);
// the painter only glows 'teal' and 'hot': retune teal to Oritech's cyan-white plate glow
addRamp('ice', ['#22506a', '#3a86a8', '#55aecb', '#80cbe0', '#b4e4ef']);
addRamp('teal', ['#0d2b3a', '#1f6a85', '#58c4dc', '#a6ecf6', '#e8fdff']);

export const meta = {
  title: 'Assembler (bench c2)', note: 'Oritech Assembler reproduction.', footprint: [2, 1], height: 2, tier: 1,
  joints: { carriage: { type: 'prismatic', axis: 'x' } },
};
export const look = { glow: 1.4 };

const ring = (d, x, y, w, h, ramp, k) => { d.hline(x, y, w, ramp, k); d.hline(x, y + h - 1, w, ramp, k); d.vline(x, y, h, ramp, k); d.vline(x + w - 1, y, h, ramp, k); };
// nested 1-texel rings from the outside in; each entry is [ramp, shade]
const rings = (d, x, y, w, h, seq) => seq.forEach(([r, k], i) => { if (w - 2 * i > 0 && h - 2 * i > 0) ring(d, x + i, y + i, w - 2 * i, h - 2 * i, r, k); });

export function build(b, { mat }) {
  const rustSurf = (o = {}) => (d) => surface(d, 'rust', { motif: 'maze', cell: 6, skip: 0.45, jitter: 0.3, ...o });
  // concentric paint rings around a teal port window with a lit slot, as on every Oritech end face
  const portWindow = (d) => {
    ring(d, 1, 1, d.w - 2, d.h - 2, 'rust', 1); ring(d, 2, 2, d.w - 4, d.h - 4, 'rust', 4);
    const x = 3, y = 3, w = d.w - 6, h = d.h - 6;
    d.rect(x, y, w, h, 'ice', 2); ring(d, x, y, w, h, 'ice', 3); d.hline(x, y, w, 'ice', 4); d.hline(x + 1, y + h - 1, w - 1, 'ice', 1);
    const cx = x + Math.floor(w / 2) - 1, ey = y + 2, eh = Math.max(2, Math.floor(h / 2) - 1);
    for (const ex of [x + 1, cx + 3]) { d.rect(ex, ey, cx - x - 2, eh, 'slate', 1); d.hline(ex, ey, cx - x - 2, 'slate', 0); d.px(ex, ey + eh - 1, 'slate', 3); }
    d.rect(x + 1, ey + eh, w - 2, h - eh - 3, 'blue', 3);
    d.rect(cx, y + 1, 2, h - 2, 'ice', 4); d.vline(cx + 1, y + 2, h - 3, 'ice', 3);
  };
  const doorRings = (d) => {
    const m = 1; rings(d, m, m, d.w - 2, d.h - 2, [['rust', 1], ['rust', 4], ['rust', 2], ['rust', 1], ['rust', 3]]);
    d.rect(m + 5, m + 5, d.w - 12, d.h - 12, 'rust', 4); d.hline(m + 5, m + 5, d.w - 12, 'rust', 3);
  };
  const greyInset = (d, x, y, w, h) => {
    rings(d, x, y, w, h, [['grey', 3], ['grey', 1], ['grey', 4]]);
    d.rect(x + 3, y + 3, w - 6, h - 6, 'rust', 3); d.hline(x + 3, y + 3, w - 6, 'rust', 1);
  };
  const brickScreen = (d, x, y, w, h) => {
    d.rect(x, y, w, h, 'slate', 0);
    for (let j = y + 1; j < y + h - 1; j++) for (let i = x + 1; i < x + w - 1; i++) {
      const row = j - y, off = (row >> 1) & 1 ? 2 : 0, mortar = row % 2 === 0 || (i - x + off) % 4 === 0;
      d.px(i, j, mortar ? 'slate' : 'blue', mortar ? 1 : (hsh(i >> 2, j >> 1, 41) < 0.4 ? 3 : 2));
    }
  };

  const screen = mat('slate', { north(d) { brickScreen(d, 0, 0, d.w, d.h); }, side(d) { d.rect(0, 0, d.w, d.h, 'slate', 1); d.hline(0, 0, d.w, 'slate', 3); } }, { clean: true });
  const plinth = mat('slate', { all(d) {
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) d.px(x, y, 'slate', (((x >> 1) + (y >> 1)) & 1) ? (y === 0 ? 2 : 1) : (y === 0 ? 3 : hsh(x >> 1, y >> 1, d.seed) < 0.3 ? 0 : 2));
  } }, { clean: true });

  const bodyW = mat('rust', {
    all: rustSurf(),
    south: portWindow, west: portWindow,
    north: doorRings,
    up(d) { surface(d, 'rust', { flat: true }); },
  });
  const bodyE = mat('rust', {
    all: rustSurf(),
    east: portWindow,
    south(d) { greyInset(d, 2, 2, d.w - 6, d.h - 4); },
    north(d) { d.rect(5, 11, 2, 3, 'ice', 3); d.px(5, 11, 'ice', 4); d.vline(6, 12, 2, 'ice', 1); },
  });
  const counter = mat('slate', {
    side(d) { surface(d, 'slate', { jitter: 0.35 }); d.hline(0, 0, d.w, 'slate', 4); for (let x = 2; x < d.w; x += 7) d.px(x, 1, 'slate', 0); },
    up(d) {
      surface(d, 'slate', {});
      const ox = 2, oy = 2, ow = d.w - 4, oh = d.h - 4;
      for (let y = oy; y < oy + oh; y++) for (let x = ox; x < ox + ow; x++) d.px(x, y, 'rust', hsh(x >> 1, y, 77) < 0.12 ? 1 : hsh(x >> 1, y, 78) < 0.1 ? 3 : 2);
      surface({ ...d, w: ow, h: oh, px: (x, y, r, k) => k > 2 && d.px(x + ox, y + oy, r, k) }, 'rust', { motif: 'maze', cell: 6, skip: 0.4, line: 3 });
      d.hline(ox, oy, ow, 'rust', 1); d.vline(ox, oy, oh, 'rust', 1);
      for (const x of [5, 15]) { d.rect(x, 2, 9, 9, 'slate', 1); d.hline(x, 2, 9, 'slate', 0); d.vline(x, 2, 9, 'slate', 0); }
    },
  });
  const plate = mat('slate', { up(d) {
    d.rect(0, 0, d.w, d.h, 'slate', 1); ring(d, 1, 1, d.w - 2, d.h - 2, 'teal', 3);
    d.hline(1, 1, d.w - 2, 'teal', 4); d.rect(2, 2, d.w - 4, d.h - 4, 'slate', 0);
  } }, { clean: true });
  const backWall = mat('blue', {
    north(d) {
      for (let x = 0; x < d.w; x++) { const s = x % 3; for (let y = 0; y < d.h; y++) d.px(x, y, 'blue', s === 0 ? 0 : s === 1 ? (y < 2 ? 4 : 3) : (hsh(x, y >> 2, 9) < 0.3 ? 3 : 2)); }
      d.hline(0, 0, d.w, 'slate', 2); d.hline(0, d.h - 1, d.w, 'slate', 1);
      for (const x of [6, 13, 20]) d.vline(x, 0, d.h, 'rust', 2);
    },
  }, { surface: { motif: 'slots', cell: 5 } });
  const gridPanel = mat('grey', {
    south(d) {
      rings(d, 0, 0, d.w, d.h, [['grey', 1], ['grey', 3], ['grey', 2]]);
      d.rect(3, 3, d.w - 6, d.h - 6, 'grey', 2);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 5; i++) {
        const cx = 4 + i * 3, cy = 4 + j * 3; if (cx + 2 > d.w - 3) continue;
        d.rect(cx, cy, 2, 2, 'grey', 1); d.px(cx, cy, 'grey', 0); d.px(cx + 2, cy + 2, 'grey', 4);
      }
      d.hline(4, 6, 15, 'grey', 3); d.vline(19, 4, 5, 'grey', 1);
    },
    side(d) { d.rect(0, 0, d.w, d.h, 'grey', 2); d.vline(0, 0, d.h, 'grey', 1); },
  }, { clean: true });
  const mazeWall = mat('rust', {
    all: rustSurf({ cell: 5, skip: 0.2 }),
    east(d) {
      surface(d, 'rust', { motif: 'maze', cell: 6, skip: 0, line: 4 });
      surface({ ...d, px: (x, y, r, k) => k > 3 && d.px(x + 3, y + 3, r, 1) }, 'rust', { motif: 'maze', cell: 6, skip: 0.3, seed: 31 });
      for (const y of [5, 11]) { d.hline(3, y, d.w - 6, 'blue', 2); d.hline(3, y + 1, d.w - 6, 'blue', 1); }
    },
    west(d) {
      surface(d, 'rust', { flat: true }); rings(d, 0, 0, d.w, d.h, [['rust', 1], ['rust', 3]]);
      d.rect(2, 2, d.w - 4, d.h - 6, 'slate', 0);
      for (let j = 3; j < d.h - 5; j++) for (let i = 3; i < d.w - 3; i++) d.px(i, j, 'grey', ((i + j) % 5 === 0) ? 4 : (j & 1 ? 2 : 1));
    },
  });
  const handle = mat('blue', { all(d) { d.rect(0, 0, d.w, d.h, 'blue', 2); d.vline(0, 0, d.h, 'blue', 4); d.hline(0, d.h - 1, d.w, 'blue', 0); } }, { clean: true });
  const ledge = mat('slate', {
    up(d) { surface(d, 'slate', { flat: true }); },
    side(d) { d.hline(0, 0, d.w, 'slate', 4); d.hline(0, d.h - 1, d.w, 'slate', 0); },
  });
  const lamp = mat('teal', {}, { flat: true });
  const railTop = mat('rust', { all: rustSurf({ cell: 4, skip: 0.3 }) });
  const railLow = mat('slate', { side(d) { d.hline(0, 0, d.w, 'slate', 3); for (let x = 1; x < d.w; x += 4) d.px(x, d.h - 1, 'slate', 0); } });
  const block = mat('rust', {
    all(d) { surface(d, 'rust', { motif: 'maze', cell: 4, skip: 0.2, line: 4 }); d.hline(0, d.h - 1, d.w, 'rust', 1); },
  });
  const striped = mat('rust', { all(d) {
    for (let x = 0; x < d.w; x++) for (let y = 0; y < d.h; y++) { const s = (x >> 1) % 3; d.px(x, y, s === 2 ? 'slate' : 'rust', s === 2 ? 3 : s === 0 ? 3 : 1); }
  } }, { clean: true });
  const strut = mat('slate', { all(d) { surface(d, 'slate', { jitter: 0.3 }); d.vline(0, 0, d.h, 'slate', 4); d.vline(d.w - 1, 0, d.h, 'slate', 0); } });
  const post = mat('slate', { side(d) {
    surface(d, 'slate', {});
    for (let y = 2; y < d.h; y += 6) { d.hline(0, y, d.w, 'rust', 2); d.hline(0, y + 1, d.w, 'rust', 1); }
  } });
  const tip = mat('teal', {}, { flat: true });

  b.box('plinth_w', [-16, 0, -8], [0, 2, 8], plinth);
  b.box('plinth_e', [0, 0, -7.5], [16, 1.5, 7.5], plinth);
  b.box('body_w', [-15, 2, -7], [0, 16, 7], bodyW);
  b.box('body_e', [0, 1.5, -6.5], [15, 16, 6], bodyE);
  b.box('screen_n', [4, 6.5, -7], [14, 14, -6.5], screen);
  b.box('counter', [-16, 16, -8], [16, 18, 8], counter);
  b.box('plate_a', [-10, 18, -5], [-3, 18.5, 2], plate);
  b.box('plate_b', [0, 18, -5], [7, 18.5, 2], plate);
  b.box('back_wall', [-9, 18, 3], [12, 28.5, 6], backWall);
  b.box('frame_w', [-10, 18, 2.5], [-9, 28.4, 6], strut);
  b.box('foot_n', [10, 18, -7.5], [12, 20.5, -5], ledge);
  b.box('foot_m', [10.5, 18, -1.5], [12, 19.5, 1.5], ledge);
  b.box('grid_panel', [-12, 18, 6], [9, 28.5, 7.5], gridPanel);
  b.box('maze_wall', [12, 17, -7.99], [14, 32, 7.99], mazeWall);
  for (const [z0, y0] of [[-6, 24], [3, 24], [-6, 30.5], [3, 30.5]]) b.box(`handle_${z0}_${y0}`, [14, y0 - 4, z0], [14.5, y0, z0 + 2], handle);
  b.box('ledge', [14, 18, -6], [16, 19, 6], ledge);
  b.box('lamp_a', [14.5, 19, -4], [15.5, 19.5, -1], lamp);
  b.box('lamp_b', [14.5, 19, 1], [15.5, 19.5, 4], lamp);
  b.box('post_low', [9, 1.5, 6], [11, 16, 8], post);
  b.box('post_up', [9, 18, 6.25], [11, 30, 8], post);
  b.box('rail_low', [-12, 28.5, 3.5], [11.99, 29.5, 5.5], railLow);
  b.box('rail_top', [-12, 29.5, 3], [12, 31, 6], railTop);
  const carriage = (n, x) => {
    b.box(`${n}#1`, [x, 28.6, 1], [x + 4, 30.99, 3.5], block);
    b.box(`${n}#2`, [x, 31, 1], [x + 4, 32, 7], block);
    b.box(`${n}#3`, [x, 29, 5.5], [x + 4, 30.99, 7], block);
  };
  carriage('carriage_b', 7);
  b.group('carriage', [3, 30, 2], () => {
    carriage('carriage_a', 1);
    b.box('head_rod', [2.5, 27, 1.25], [3.5, 28.6, 2.25], strut);
    b.box('head_block', [1, 22.5, -2], [5, 27, 2], block);
    b.box('tip', [2.5, 20, -0.5], [3.5, 22.5, 0.5], tip);
  });
  b.box('arm_end', [-16, 28.4, 2.5], [-12, 32, 6.5], striped);
  b.box('arm_strut', [-14.5, 25, 3], [-13, 28.4, 5], strut);
  b.box('arm_joint', [-15.25, 22, 2.75], [-12.25, 25, 5.25], block, { origin: [-13.75, 23.5, 4], rotation: [0, 0, 45] });
  b.box('arm_tool', [-15.5, 19.5, 2.5], [-12, 22, 5.5], block);
  // lint and viewer disagree on the sign of a z rotation: a centre pivot keeps both shapes valid
  b.box('lid', [-15.25, 18.15, -7], [-9.25, 20.15, 2.25], striped, { origin: [-12.25, 19.15, -2.5], rotation: [0, 0, -22.5] });

  b.anim('working', 4, {
    carriage: { position: [[0, [0, 0, 0]], [1, [-9, 0, 0]], [2, [-9, 0, 0]], [3, [0, 0, 0]], [4, [0, 0, 0]]] },
  });
}
