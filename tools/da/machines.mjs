// The five DA research machines, one functional program each, styled by a direction's kit.
// Coordinates in Blockbench px (16 = 1 block), origin = centre of the footprint, y up.
// Each machine says what it does through its silhouette: the board shows them as silhouettes too.

// a rotation track: `turns` full turns over `len` seconds. Clockwork (C) ticks: quick step, then hold.
function spin(D, axis, turns, len, phase = 0) {
  const k = { x: 0, y: 1, z: 2 }[axis]; const v = (deg) => { const a = [0, 0, 0]; a[k] = deg; return a; };
  if (D.short !== 'C') return [[0, v(phase)], [len, v(phase + 360 * turns)]];
  const steps = 16 * Math.abs(turns); const out = [];
  for (let i = 0; i < steps; i++) { const t = (i / steps) * len; const a = phase + (360 * turns * i) / steps; out.push([t, v(a)], [t + (len / steps) * 0.35, v(a + (360 * turns) / steps)]); }
  out.push([len, v(phase + 360 * turns)]);
  return out;
}

// cog teeth around a drum (part of the drum's bone): n teeth at the flats of a 12-gon
function teeth(b, K, name, c, axis, r, len, n = 12, role = 'steel', o = {}) {
  const k = { x: 0, y: 1, z: 2 }[axis]; const [i, j] = [0, 1, 2].filter((q) => q !== k);
  const w = o.width || 1.4, h = o.height || 2;
  for (let t = 0; t < n; t++) {
    const from = [...c], to = [...c];
    from[k] = c[k] - len / 2 + t * 0.01; to[k] = c[k] + len / 2 - t * 0.01; // caps a hair apart
    from[i] = c[i] - w / 2; to[i] = c[i] + w / 2; from[j] = c[j] + r - 0.5; to[j] = c[j] + r + h;
    const rot = [0, 0, 0]; rot[k] = (360 / n) * t;
    b.box(`${name}_teeth#${t + 1}`, from, to, K.m[role], { origin: c, rotation: rot.some((v) => v) ? rot : undefined });
  }
}

export const MACHINES = {
  // ---------------------------------------------------------------- CRUSHER (3x3x4)
  // Reads as: ore goes up the elevator, falls into a hopper, is ground between two big rollers
  // driven by a heavy flywheel, and leaves as gravel on the south belt.
  crusher: {
    title: 'Crusher', role: 'Ore to crushed ore. Tier 1.', footprint: [3, 3], height: 4,
    ports: [{ id: 'in', kind: 'item', face: 'east', cell: [1, 0] }, { id: 'out', kind: 'item', face: 'west', cell: [1, 0] }],
    build(b, K) {
      const { m, D } = K; const C = D.short;
      K.slab('plinth', [-24, 0, -24], [24, 4, 24], 'base');
      // two heavy cheeks carry the rollers; the nip between them is open to the side
      b.box('cheek_n', [-14, 4, -16], [14, 32, -12], m.frame);
      b.box('cheek_s', [-14, 4, 12], [14, 32, 16], m.frame, { decal: K.tag('CR-01') });
      if (C === 'A') b.box('cheek_hz', [10, 4, 16], [14, 10, 16.6], m.hazard);
      b.box('chute', [-10, 4, -12], [12, 12, 12], m.dark);
      const roller = (id, x) => b.group(id, [x, 20, 0], () => {
        if (C === 'B') { K.drum(`${id}_l`, [x, 20, -7.5], 4.5, 9, 'z', 'steel', { sides: 12 }); K.drum(`${id}_m`, [x, 20, 0], 4.5, 6, 'z', 'energy', { sides: 12 }); K.drum(`${id}_r`, [x, 20, 7.5], 4.5, 9, 'z', 'steel', { sides: 12 }); }
        else K.drum(id, [x, 20, 0], 4.5, 24, 'z', 'steel', { sides: 12 });
      });
      roller('roller_a', -3.2); roller('roller_b', 6.6);
      // the flywheel is the crusher's face: big, on the south side, in view
      b.group('flywheel', [-3.2, 20, 18], () => {
        K.drum('flywheel', [-3.2, 20, 18], 9, 4, 'z', C === 'C' ? 'steel' : C === 'B' ? 'body' : 'body', { sides: 12 });
        K.drum('fly_hub', [-3.2, 20, 21], 3, 2, 'z', C === 'B' ? 'energy' : 'dark', { sides: 8 });
        if (C === 'C') teeth(b, K, 'fly', [-3.2, 20, 18], 'z', 9, 4);
        if (C !== 'C') b.box('fly_weight', [-6.2, 25, 20], [-0.2, 28.5, 21], C === 'B' ? m.accent : m.hazard);
      });
      // motor on a cradle beside the flywheel
      b.box('cradle', [-23.5, 4, 11], [-16.5, 7.5, 23], m.frame);
      const mr = D.drumSides === 6 ? 3.4 : 4;
      K.drum('motor', [-20, 7.5 + mr, 17], mr, 12, 'z', C === 'B' ? 'body' : 'body2', { sides: D.drumSides === 6 ? 6 : 12, flat: 'y' });
      b.box('motor_fins', [-22, 7.5 + 2 * mr, 13], [-18, 9 + 2 * mr, 21], m.vent);
      // north side: guard (A), smooth cover with a light slit (B), exposed gear train (C)
      if (C === 'C') {
        for (const [id, x, rot] of [['gear_a', -3.2, 0], ['gear_b', 6.6, 15]]) b.group(id, [x, 20, -17.5], () => { K.drum(id, [x, 20, -17.5], 2.9, 3, 'z', 'steel', { sides: 12 }); teeth(b, K, id, [x, 20, -17.5], 'z', 2.9, 3, 12, 'steel', { height: 1.9 }); }, rot ? [0, 0, rot] : undefined);
      } else {
        b.box('guard', [-12, 10, -21], [14, 30, -16], m.body);
        if (C === 'B') b.box('guard_slit', [-8, 18, -21.5], [10, 22, -21], m.energy);
      }
      // hopper on the cheeks, ore inside the rim
      if (C === 'C') {
        K.drum('hopper1', [0, 34, 0], 14, 4, 'y', 'body', { flat: 'x' });
        K.drum('hopper2', [0, 38.75, 0], 16.5, 5.5, 'y', 'body', { flat: 'x' });
        K.drum('collar', [0, 42.25, 0], 18.6, 1.5, 'y', 'steel', { flat: 'x' });
        K.drum('hopper3', [0, 44.5, 0], 18.6, 3, 'y', 'body2', { flat: 'x' });
        K.drum('ore', [0, 46.5, 0], 16.5, 1, 'y', 'ore', { flat: 'x' });
      } else {
        K.slab('hopper1', [-14, 32, -16], [14, 36, 16], 'body');
        K.slab('hopper2', [-17, 36, -19], [17, 40, 19], 'body', { decal: K.tag('CR-01') });
        b.box('rim_n', [-19, 40, -21], [19, 46, -19], C === 'A' ? m.body : m.frame);
        b.box('rim_s', [-19, 40, 19], [19, 46, 21], C === 'A' || C === 'D' ? m.body : m.frame);
        b.box('rim_w', [-19, 40, -19], [-17, 46, 19], C === 'A' ? m.body : m.frame);
        b.box('rim_e', [17, 40, -19], [19, 46, 19], C === 'A' ? m.body : m.frame);
        b.box('ore', [-17, 40, -19], [17, 44, 19], m.ore);
      }
      // bucket elevator: in at the east port, up, and over into the hopper
      const xe = C === 'C' ? 18.6 : 19;
      b.box('elevator', [xe, 4, -6], [22, 52, 6], C === 'B' ? m.body2 : m.frame);
      if (C === 'C') for (let k = 0; k < 10; k++) b.box(`rung${k}`, [xe + 0.5, 8 + k * 4.4, 6], [21.5, 9 + k * 4.4, 7], m.steel);
      else if (C === 'B') b.box('elev_light', [xe + 0.5, 8, 6], [21.5, 48, 6.5], m.energy);
      else for (let k = 0; k < 7; k++) b.box(`bucket${k}`, [xe + 0.5, 8 + k * 6.4, 6], [21.5, 11 + k * 6.4, 8], m.steel);
      b.box('head', [11, 52, -7], [23, 58, 7], m.body);
      b.box('spout', [5, 50, -4], [11, 55, 4], m.dark); // hangs from the head's west face, not from its edge
      K.lamp('lamp', [17, 58, 0]);
      K.port('in', 'east', [24, 8, 0]);
      K.port('out', 'west', [-24, 8, 0]);
      b.box('belt_out', [-22, 4, -4], [-10, 9, 4], m.rubber);
      b.anim('work', 2, { roller_a: { rotation: spin(D, 'z', 1, 2) }, roller_b: { rotation: spin(D, 'z', -1, 2) }, flywheel: { rotation: spin(D, 'z', 1, 2) },
        ...(C === 'C' ? { gear_a: { rotation: spin(D, 'z', 1, 2) }, gear_b: { rotation: spin(D, 'z', -1, 2) } } : {}) });
    },
  },
  // ---------------------------------------------------------------- SMELTER (3x3x5)
  // Reads as: a squat furnace with a tall stack, a glowing mouth, and a crucible that tips molten
  // metal into ingot moulds on the out belt.
  smelter: {
    title: 'Smelter', role: 'Crushed ore to ingots. Tier 1.', footprint: [3, 3], height: 4,
    lint: (D) => (D.short === 'B' ? { allow: [{ a: 'core*', b: 'glass_crucible*', why: 'the plasma core is held inside the glass crucible' }] } : undefined),
    ports: [{ id: 'in', kind: 'item', face: 'west', cell: [1, 0] }, { id: 'out', kind: 'item', face: 'south', cell: [2, 0] }],
    build(b, K) {
      const { m, D } = K; const C = D.short;
      K.slab('plinth', [-24, 0, -24], [24, 4, 24], 'base');
      if (C === 'C') { K.drum('furnace', [-6, 17, -6], 14, 26, 'y', 'body', { flat: 'x' }); K.drum('furnace#crown', [-6, 30.75, -6], 12, 1.5, 'y', 'steel', { flat: 'x' }); }
      else K.slab('furnace', [-20, 4, -20], [8, 30, 8], C === 'A' ? 'body' : 'body', { decal: K.tag('SM-02') });
      // glowing mouth on the east face, towards the crucible
      b.box('mouth', [8, 6, -16], [9.5, 22, -6], m.brick);
      b.box('mouth_glow', [9.5, 9, -14], [10, 19, -8], m.hot);
      if (C === 'A') b.box('mouth_hz', [8, 22, -16], [9.5, 24, -6], m.hazard);
      b.box('launder', [8, 24, -12], [12.5, 26, -3], m.dark);
      b.box('launder_melt', [9, 26, -11], [12, 26.5, -4], m.hot);
      // stack
      const sr = C === 'C' ? 6 : 6.5;
      const top = C === 'C' ? 31.5 : 30;
      K.drum('stack_base', [-12, top + 1.5, -12], sr + 2, 3, 'y', C === 'B' ? 'frame' : 'dark', { flat: 'x' });
      K.drum('stack', [-12, (top + 3 + 58) / 2, -12], sr, 58 - top - 3, 'y', C === 'A' ? 'steel' : C === 'B' ? 'body' : 'pipe', { flat: 'x' });
      K.drum('stack#ring1', [-12, 44, -12], sr + 0.8, 2, 'y', C === 'A' ? 'body' : C === 'B' ? 'energy' : 'steel', { flat: 'x' });
      K.drum('stack#ring2', [-12, 54, -12], sr + 0.8, 2, 'y', C === 'A' ? 'hazard' : C === 'B' ? 'energy' : 'steel', { flat: 'x' });
      K.drum('stack_cap', [-12, 59.5, -12], sr + 1.5, 3, 'y', 'dark', { flat: 'x' });
      // blower on the north face
      if (C !== 'C') K.drum('blower', [-2, 14, -22], 6, 4, 'z', C === 'B' ? 'body2' : 'body2', { sides: 12 });
      else K.drum('blower', [-21.2, 14, -12], 5, 2.4, 'x', 'steel', { sides: 12 });
      // tilting crucible on trunnions between two posts
      b.box('post_n', [16.5, 4, -10], [19.5, 24, -6], m.frame);
      b.box('post_s', [16.5, 4, 6], [19.5, 24, 10], m.frame);
      b.group('crucible', [18, 20, 0], () => {
        K.drum(C === 'B' ? 'glass_crucible' : 'crucible', [18, 16, 0], 5, 10, 'y', C === 'B' ? 'glass' : C === 'C' ? 'steel' : 'body2', { sides: 12 });
        if (C === 'B') b.prism('core', [18, 15, 0], 3.5, 6, 'y', m.hot, 12);
        K.drum('melt', [18, 21.25, 0], 4, 0.5, 'y', 'hot', { sides: 12 });
        K.drum('pin_n', [18, 20, -5.5], 1.5, 1, 'z', 'steel', { sides: 8 });
        K.drum('pin_s', [18, 20, 5.5], 1.5, 1, 'z', 'steel', { sides: 8 });
      });
      // moulds on the out belt
      b.box('belt_out', [12, 4, 10], [20, 8, 22], m.rubber);
      b.box('ingot1', [14, 8, 12], [18, 9.5, 15], m.hot);
      b.box('ingot2', [14, 8, 17], [18, 9.5, 20], C === 'C' ? m.steel : m.accent);
      K.port('out', 'south', [16, 8, 24]);
      // feed from the west port
      const fx = C === 'C' ? -20 : -20;
      b.box('belt_in', [-22, 4, -4], [fx, 9, 4], m.rubber);
      K.port('in', 'west', [-24, 8, 0]);
      b.box('screen', [2, 18, 8], [7, 24, 8.5], m.screen);
      if (C === 'C') b.box('screen_mount', [1, 4, 6], [8, 18, 9], m.frame);
      K.lamp('lamp', [2, C === 'C' ? 31.5 : 30, -2]);
      b.anim('pour', 4, { crucible: { rotation: [[0, [0, 0, 0]], [1.2, [0, 0, 0]], [2, [0, 0, -32]], [2.8, [0, 0, -32]], [3.6, [0, 0, 0]], [4, [0, 0, 0]]] } }, D.short === 'C' ? 'linear' : 'catmullrom');
    },
  },

  // ---------------------------------------------------------------- ASSEMBLER (3x3x4)
  // Reads as: an open gantry over a conveyor, a bridge crane with a welding head, a robot arm.
  assembler: {
    title: 'Assembler', role: 'Parts to components. Tier 2.', footprint: [3, 3], height: 4,
    ports: [{ id: 'in', kind: 'item', face: 'west', cell: [1, 0] }, { id: 'out', kind: 'item', face: 'east', cell: [1, 0] }],
    build(b, K) {
      const { m, D } = K; const C = D.short;
      K.slab('plinth', [-24, 0, -24], [24, 4, 24], 'base');
      b.box('belt', [-22, 4, -4], [22, 9, 4], m.rubber);
      for (const [x, i] of [[-15, 0], [-2, 1], [12, 2]]) b.box(`part${i}`, [x, 9, -2.5], [x + 5, 10.5, 2.5], i === 1 ? m.hot : m.accent);
      K.port('in', 'west', [-24, 8, 0]); K.port('out', 'east', [24, 8, 0]);
      b.box('table', [-10, 4, -14], [10, 12, -5], m.frame);
      b.box('table_top', [-9, 12, -13], [9, 13, -6], C === 'B' ? m.energy : m.steel);
      b.box('workpiece#1', [-5, 13, -12], [5, 17, -7], m.accent);
      b.box('workpiece#seam', [-5.5, 14.5, -12.5], [5.5, 15.5, -6.5], m.hot);
      // gantry
      const post = (id, x, z) => C === 'C' ? K.drum(id, [x, 24, z], 2, 40, 'y', 'frame', { flat: 'x' }) : K.slab(id, [x - 2, 4, z - 2], [x + 2, 44, z + 2], 'frame', { square: true });
      post('post_nw', -20, -20); post('post_ne', 20, -20); post('post_sw', -20, 20); post('post_se', 20, 20);
      if (C === 'C') for (const [x, z] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) K.drum(`post_nw#c${x}${z}`.replace('post_nw', x < 0 ? (z < 0 ? 'post_nw' : 'post_sw') : (z < 0 ? 'post_ne' : 'post_se')), [x, 41, z], 2.6, 2, 'y', 'steel', { flat: 'x' });
      b.box('beam_n', [-22, 44, -22], [22, 48, -18], C === 'A' ? m.body : m.body);
      b.box('beam_s', [-22, 44, 18], [22, 48, 22], m.body, { decal: K.tag('AS-03') });
      if (C === 'B') { b.box('beam_n_glow', [-18, 45, -22.5], [18, 47, -22], m.energy); b.box('beam_s_glow', [-18, 45, 22], [18, 47, 22.5], m.energy); }
      b.group('bridge', [0, 48, 0], () => {
        b.box('bridge', [-3, 48, -22], [3, 52, 22], m.body2);
        b.group('carriage', [0, 44, 0], () => {
          b.box('carriage', [-4, 40, -4], [4, 48, 4], C === 'B' ? m.body : m.frame);
          b.box('tool', [-1.5, 22, -1.5], [1.5, 40, 1.5], m.steel);
          b.box('head', [-3, 19, -3], [3, 22, 3], C === 'C' ? m.steel : m.dark);
          b.box('tip', [-1, 17.5, -1], [1, 19, 1], C === 'C' ? m.warm : m.energy);
        });
      });
      // robot arm on the south side
      b.box('arm_base', [8, 4, 8], [16, 6, 16], m.dark);
      b.group('arm', [12, 6, 12], () => {
        K.drum('turret', [12, 9, 12], 3.5, 6, 'y', C === 'A' ? 'body' : C === 'B' ? 'body' : 'steel', { sides: C === 'C' ? 6 : 12, flat: 'x' });
        b.box('forearm', [0, 12, 10.5], [13, 15, 13.5], C === 'A' ? m.body : C === 'B' ? m.body : m.body2);
        b.box('gripper', [0, 10, 11], [3, 12, 13], m.steel);
        b.box('arm_light', [5, 15, 11.25], [9, 15.5, 12.75], m.energy);
      });
      b.box('console', [-22, 4, 8], [-14, 14, 16], m.frame);
      b.box('console_screen', [-21, 14, 9], [-15, 14.5, 15], m.screen);
      K.lamp('lamp_a', [-18, 48, 20]); K.lamp('lamp_b', [18, 48, -20]);
      const ease = C === 'C' ? 'linear' : 'catmullrom';
      b.anim('work', 4, {
        bridge: { position: [[0, [0, 0, 0]], [1, [10, 0, 0]], [2, [10, 0, 0]], [3, [-10, 0, 0]], [4, [0, 0, 0]]] },
        carriage: { position: [[0, [0, 0, 0]], [1, [0, 0, 6]], [2, [0, 0, -6]], [3, [0, 0, -6]], [4, [0, 0, 0]]] },
        arm: { rotation: [[0, [0, 0, 0]], [1.3, [0, 55, 0]], [2.6, [0, -55, 0]], [4, [0, 0, 0]]] },
      }, ease);
    },
  },

  // ---------------------------------------------------------------- REFINERY (3x3x7)
  // Reads as: tall distillation columns, a storage tank, pipes between them, a pump, a flare.
  refinery: {
    title: 'Refinery', role: 'Crude to fuel and plastics. Tier 3.', footprint: [3, 3], height: 7,
    joints: { flame: { type: 'free', why: 'a gas flare: a flame, not a rigid part' } },
    ports: [{ id: 'in', kind: 'fluid', face: 'west', cell: [1, 0] }, { id: 'out', kind: 'fluid', face: 'south', cell: [1, 0] }],
    lint: () => ({ allow: [{ a: 'deck*', b: 'column1*', why: 'the grating deck is clamped around the column' }] }),
    build(b, K) {
      const { m, D } = K; const C = D.short;
      const col = C === 'A' ? 'steel' : C === 'B' ? 'body' : 'pipe';
      K.slab('plinth', [-24, 0, -24], [24, 4, 24], 'base');
      K.drum('column1', [-10, 52, -10], 7, 96, 'y', col, { sides: 12 });
      K.drum('column2', [8, 37, -12], 5, 66, 'y', col, { sides: 12 });
      for (const y of [20, 44, 68, 92]) K.drum(`column1#band${y}`, [-10, y, -10], 7.6, 1.5, 'y', C === 'A' ? 'body' : C === 'B' ? 'frame' : 'steel', { sides: C === 'C' ? 12 : 12 });
      for (const y of [20, 44, 66]) K.drum(`column2#band${y}`, [8, y, -12], 5.6, 1.5, 'y', C === 'A' ? 'body' : C === 'B' ? 'frame' : 'steel', { sides: 12 });
      K.drum('column1#cap', [-10, 101, -10], 5, 2, 'y', 'dark', { sides: 12 });
      K.drum('column2#cap', [8, 71, -12], 3.5, 2, 'y', 'dark', { sides: 12 });
      // sight glass with the product inside
      b.box('sight1', [-11.5, 56, -3], [-8.5, 86, -2.5], m.fluid);
      b.box('sight2', [7, 30, -7], [9, 60, -6.5], m.fluid);
      // ladder + deck on column 1
      for (let k = 1; k < 10; k++) b.box(`rung${k}`, [-12, 8 + k * 4.4, -3], [-8, 9 + k * 4.4, -2], m.steel);
      b.box('deck', [-19, 50, -19], [-1, 52, -1], m.grate);
      for (const [x, z] of [[-19, -19], [-2, -19], [-19, -2], [-2, -2]]) b.box(`rail${x}${z}`, [x, 52, z], [x + 1, 62, z + 1], C === 'A' ? m.body : m.frame);
      b.box('rail_top_e', [-2, 62, -19], [-1, 63, -1], C === 'A' ? m.body : m.frame);
      b.box('rail_top_s', [-19, 62, -2], [-2, 63, -1], C === 'A' ? m.body : m.frame);
      // storage tank
      K.drum('tank', [0, 17, 10], 9, 26, 'y', C === 'A' ? 'body' : C === 'B' ? 'body2' : 'body', { sides: 12 });
      K.drum('tank#dome', [0, 32, 10], 7, 4, 'y', C === 'A' ? 'body' : C === 'B' ? 'body' : 'steel', { sides: 12 });
      K.drum('tank#band', [0, 24, 10], 9.6, 2, 'y', C === 'A' ? 'hazard' : C === 'B' ? 'energy' : 'steel', { sides: 12 });
      // pipes: column1 -> column2 -> tank -> east port; west port -> column1
      K.pipe('p1', [[-3, 40, -10], [3, 40, -10]], 2);
      K.pipe('p2', [[8, 24, -7], [8, 24, -3], [0, 24, -3], [0, 24, 1]], 2);
      K.pipe('p3', [[0, 8, 19], [0, 8, 22]], 2);
      K.pipe('p4', [[-22, 8, 0], [-10, 8, 0], [-10, 8, -3]], 2);
      K.port('in', 'west', [-24, 8, 0], 'fluid'); K.port('out', 'south', [0, 8, 24], 'fluid');
      // pump with flywheel
      b.box('pump', [-22, 4, 8], [-12, 12, 20], C === 'B' ? m.body : m.body2);
      b.group('pump_wheel', [-10.5, 10, 14], () => { K.drum('pump_wheel', [-10.5, 10, 14], 4, 3, 'x', C === 'C' ? 'steel' : 'dark', { sides: 12 }); if (C === 'C') teeth(b, K, 'pump', [-10.5, 10, 14], 'x', 4, 3, 12, 'steel', { height: 1.2 }); });
      // flare stack
      K.drum('flare', [-10, 105, -10], 1.5, 6, 'y', 'steel', { sides: 8 });
      b.group('flame', [-10, 108, -10], () => { b.box('flame', [-11.5, 108, -11.5], [-8.5, 112, -8.5], m.hot); });
      K.lamp('lamp', [0, 34, 10]);
      b.anim('run', 2, { pump_wheel: { rotation: spin(D, 'x', 1, 2) }, flame: { scale: [[0, [1, 1, 1]], [0.5, [0.85, 0.8, 0.85]], [1, [1, 1, 1]], [1.5, [0.9, 0.75, 0.9]], [2, [1, 1, 1]]] } }, 'linear');
    },
  },

  // ---------------------------------------------------------------- PARTICLE ACCELERATOR (5x5x3)
  // Reads as: a ring of magnets on pedestals with a glowing vacuum tube, an injector line, a central
  // detector, a power transformer and an operator booth for scale.
  accelerator: {
    title: 'Particle Accelerator', role: 'Matter to exotic matter. Tier 5.', footprint: [5, 5], height: 3,
    ports: [{ id: 'in', kind: 'item', face: 'west', cell: [2, 0] }, { id: 'out', kind: 'item', face: 'east', cell: [2, 0] }, { id: 'power', kind: 'energy', face: 'north', cell: [2, 0] }],
    lint: () => ({ allow: [
      { a: 'bunch*', b: 'glass_tube*', why: 'the particle bunch travels inside the vacuum tube' },
      { a: 'bunch*', b: 'coil*', why: 'the particle bunch travels through the magnet bores' },
    ] }),
    camera: { yaw: 32, pitch: 30 },
    build(b, K) {
      const { m, D } = K; const C = D.short;
      K.slab('plinth', [-40, 0, -40], [40, 4, 40], 'base');
      for (let k = 0; k < 12; k++) {
        const rot = k ? [0, k * 30, 0] : undefined; const o = [0, 0, 0];
        if (k % 2 === 0) {
          b.box(`pedestal${k}`, [-4, 4, -31], [4, 15, -25], m.frame, { origin: o, rotation: rot });
          b.box(`coil${k}`, [-5, 15, -34], [5, 29, -22], C === 'A' ? m.body : C === 'B' ? m.body : m.body2, { origin: o, rotation: rot });
          b.box(`coil${k}_top`, [-3, 29, -32], [3, 29.6, -24], m.energy, { origin: o, rotation: rot });
          b.box(`coil${k}_band`, [-5.6, 20, -34.6], [5.6, 24, -34], C === 'A' ? m.hazard : C === 'B' ? m.energy : m.steel, { origin: o, rotation: rot });
        } else {
          b.box(`glass_tube${k}`, [-8.5, 19, -30.5], [8.5, 25, -25.5], m.glass, { origin: o, rotation: rot });
          b.box(`tube_rail${k}`, [-9.5, 25, -29], [9.5, 26, -27], m.energy, { origin: o, rotation: rot });
          b.box(`tube_stand${k}`, [-1.5, k === 9 ? 9 : 4, -29.5], [1.5, 19, -26.5], m.steel, { origin: o, rotation: rot });
        }
      }
      b.group('bunch', [0, 22, 0], () => { for (let i = 0; i < 3; i++) b.box(`bunch${i}`, [-1.2, 20.8, -29.2], [1.2, 23.2, -26.8], m.energy, { origin: [0, 22, 0], rotation: [0, i * 120 + 15, 0] }); });
      // detector in the middle
      if (C === 'C') { K.drum('detector', [0, 14, 0], 11, 20, 'y', 'body', { flat: 'x' }); K.drum('detector#ring', [0, 18, 0], 12, 3, 'y', 'steel', { flat: 'x' }); K.drum('detector_top', [0, 26, 0], 7, 4, 'y', 'grate', { flat: 'x' }); }
      else { K.drum('detector', [0, 14, 0], 11, 20, 'y', C === 'A' ? 'body2' : 'body', { sides: 12 }); K.drum('detector#ring', [0, 18, 0], 11.6, 3, 'y', C === 'A' ? 'hazard' : 'energy', { sides: 12 }); K.drum('detector_top', [0, 26, 0], 7, 4, 'y', 'grate', { sides: 12 }); }
      b.group('scanner', [0, 28, 0], () => { b.box('scanner', [-9, 28, -1.5], [9, 30, 1.5], C === 'C' ? m.steel : m.frame); b.box('scanner_eye', [-8, 30, -1], [-5, 31, 1], m.energy); });
      // injector from the west port into the tube
      b.box('injector', [-38, 4, -3.5], [-30.5, 26, 3.5], C === 'B' ? m.body : m.frame);
      b.box('injector_glow', [-37, 26, -1.5], [-32, 26.5, 1.5], m.energy);
      K.port('in', 'west', [-40, 8, 0]);
      // extraction under the ring to the east port
      b.box('extract', [11, 4, -3], [38, 9, 3], m.dark);
      K.port('out', 'east', [40, 8, 0]);
      // transformer on the north edge
      b.box('transformer', [-10, 4, -38], [10, 20, -35], C === 'B' ? m.body2 : m.body2);
      for (let i = 0; i < 4; i++) b.box(`fin${i}`, [-9 + i * 5, 20, -38], [-7 + i * 5, 26, -35.5], m.vent);
      K.port('power', 'north', [0, 8, -40], 'energy');
      // operator booth for scale (door 2 blocks high)
      K.slab('booth', [24, 4, 24], [38, 38, 38], C === 'A' ? 'body' : 'body', { decal: K.tag('PA-05') });
      b.box('door', [27, 4, 38], [33, 30, 38.5], m.dark);
      b.box('window', [24, 24, 26], [23.5, 32, 36], m.glass);
      K.lamp('lamp', [31, 38, 31]);
      b.anim('run', 2, { bunch: { rotation: [[0, [0, 0, 0]], [2, [0, 360, 0]]] }, scanner: { rotation: [[0, [0, 0, 0]], [2, [0, -360, 0]]] } }, 'linear');
    },
  },
};
