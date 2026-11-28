// Smelter, tier 0: ore falls from the coal-and-ore hopper into a crucible furnace; molten metal pours
// from the east chute into ingot moulds. The west flywheel drives the blower that feeds the fire.
export const meta = {
  title: 'Smelter', note: 'Ore to ingots. Tier 0.', footprint: [3, 3], height: 4, tier: 0,
  ports: [{ id: 'in', kind: 'item', face: 'north', cell: [1, 0] }, { id: 'out', kind: 'item', face: 'east', cell: [1, 0] }],
  joints: { flywheel: { type: 'revolute', axis: 'x' } },
};
export const look = { glow: 1.3 };

export function build(b, { mat }) {
  const boltsCol = (d, x, step = 7) => { for (let y = 3; y < d.h - 7; y += step) d.bolt(x, y, 'steel'); };
  const pillar = mat('steel', { side(d) { boltsCol(d, 2); d.hazard(0, d.h - 6, d.w, 4); }, top(d) { d.bolt(2, 2, 'steel'); } });
  const beam = mat('steel', { side(d) { for (let x = 3; x < d.w - 3; x += 8) d.bolt(x, 1, 'steel'); d.hline(1, d.h - 2, d.w - 2, 'steel', 1); } });
  const body = mat('paint', {
    south(d) {
      d.inset(3, 3, 13, 10, 'paint'); d.inset(18, 3, 13, 10, 'paint');
      for (const x of [5, 13, 20, 28]) d.bolt(x, 5, 'paint');
      d.rect(1, 15, d.w - 2, 3, 'steel', 2); d.hline(1, 15, d.w - 2, 'steel', 3); d.hline(1, 17, d.w - 2, 'steel', 0);
      d.hazard(10, 20, 14, 4);
      d.vent(2, 27, 7, 12, 'steel'); d.vent(25, 27, 7, 12, 'steel');
    },
    east(d) {
      d.window(6, 4, 22, 15, 'steel', 'hot');
      d.rect(1, 21, d.w - 2, 2, 'steel', 1);
      d.screen(3, 26, 12, 10);
      d.vent(19, 26, 12, 12, 'steel', 'v');
    },
    north(d) {
      for (const [x, y] of [[3, 3], [18, 3], [3, 22], [18, 22]]) { d.inset(x, y, 13, 15, 'paint'); d.bolt(x + 2, y + 2, 'paint'); d.bolt(x + 9, y + 11, 'paint'); }
    },
    west(d) { d.inset(3, 3, 28, 8, 'paint'); d.rect(1, 13, d.w - 2, 2, 'steel', 1); d.vent(3, 30, 28, 8, 'steel'); },
  }, { bolts: true });
  const hopper = mat('steel', {
    up(d) {
      d.inset(2, 2, d.w - 4, d.h - 4, 'coal');
      for (const [x, y, w, h] of [[4, 4, 5, 4], [10, 5, 4, 5], [15, 3, 5, 4], [5, 10, 4, 4], [11, 11, 6, 5], [17, 9, 3, 4], [4, 16, 5, 4], [12, 17, 4, 3], [17, 15, 4, 5]]) d.plate(x, y, w, h, 'coal');
      d.px(12, 12, 'hot', 3); d.px(6, 11, 'hot', 2); d.px(18, 16, 'hot', 2);
    },
    side(d) { d.hline(1, 1, d.w - 2, 'steel', 3); for (let x = 3; x < d.w - 2; x += 6) d.bolt(x, 2, 'steel'); },
  });
  const firebox = mat('steel', { south(d) { d.window(2, 2, 12, 9, 'iron', 'hot'); d.bolt(1, 1, 'steel'); d.bolt(13, 1, 'steel'); } });
  const stack = mat('iron', { side(d) { for (const y of [2, 7]) { d.hline(0, y, d.w, 'iron', 0); d.hline(0, y + 1, d.w, 'iron', 4); } } });
  const steel = mat('steel'), copper = mat('copper', { side(d) { d.hline(0, 1, d.w, 'copper', 4); d.hline(0, d.h - 2, d.w, 'copper', 1); } });
  const hot = mat('hot', {}, { flat: true });
  const collar = mat('steel', { side(d) { d.hazard(0, 0, d.w, 2); d.hazard(0, d.h - 2, d.w, 2); } });
  const hub = (d) => d.plate(Math.floor(d.w / 2) - 2, Math.floor(d.h / 2) - 2, 4, 4, 'steel');
  const fly = mat('iron', { west: hub, east: hub });
  const funnel = mat('steel', { side(d) { d.hazard(0, 0, d.w, 2); }, up(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'coal'); } });

  b.box('plinth', [-24, 0, -24], [24, 3, 24], mat('steel', { top(d) { d.inset(3, 3, d.w - 6, d.h - 6, 'steel'); } }));
  for (const [x0, z0] of [[-23, -23], [17, -23], [17, 17], [-23, 17]]) b.box(`pillar_${x0}_${z0}`, [x0, 3, z0], [x0 + 6, 44, z0 + 6], pillar);
  b.box('body', [-17, 3, -17], [17, 44, 17], body);
  b.box('beam_n', [-23, 44, -23], [23, 48, -17], beam);
  b.box('beam_s', [-23, 44, 17], [23, 48, 23], beam);
  b.box('beam_w', [-23, 44, -17], [-17, 48, 17], beam);
  b.box('beam_e', [17, 44, -17], [23, 48, 17], beam);
  b.box('hopper', [-12, 44, -12], [12, 52, 12], hopper);
  b.box('firebox', [-8, 3, 17], [8, 16, 20], firebox);
  b.box('stack_base', [-22, 48, -22], [-14, 51, -14], steel);
  b.box('stack', [-21, 51, -21], [-15, 61, -15], stack);
  b.box('stack_cap', [-22, 61, -22], [-14, 64, -14], steel);
  b.box('lamp', [19, 48, 19], [21, 51, 21], hot);
  // north: ore intake funnel on the input port
  b.box('intake_low', [-4, 3, -22], [4, 12, -17], steel);
  b.box('port_in', [-4, 4, -24], [4, 12, -22], collar);
  b.box('intake', [-6, 12, -23], [6, 16, -17], funnel);
  // east: pour chute and ingot tray
  b.box('chute', [17, 18, -3], [22, 21, 3], copper);
  b.box('tray', [17, 3, -7], [23, 7, 7], mat('steel', { top(d) { d.inset(1, 1, d.w - 2, d.h - 2, 'steel'); } }));
  b.box('port_out', [22, 4, -4], [24, 12, 4], collar);
  b.box('ingot_1', [18, 7, -5], [22, 8.5, -1], mat('hot'));
  b.box('ingot_2', [18, 7, 1], [22, 8.5, 5], mat('copper'));
  b.box('pour', [19, 8.5, -3.5], [20.5, 18, -2.5], hot);
  // west: blower flywheel on a bearing, copper duct from the blower into the firebox
  b.box('bearing', [-19.5, 23, -4], [-17, 29, 2], steel);
  b.group('flywheel', [-21, 26, -1], () => {
    b.prism('flywheel', [-21, 26, -1], 9, 3, 'x', fly, 12);
    b.box('fly_weight', [-22.6, 31, -4], [-22.5, 34, 2], mat('hazard', {}, { flat: true }));
  });
  b.box('duct_v', [-21, 3, 8], [-18, 20, 11], copper);
  b.box('duct_h', [-18, 6, 8], [-17, 9, 11], copper);
  b.anim('working', 3, { flywheel: { rotation: [[0, [0, 0, 0]], [3, [360, 0, 0]]] } });
}
