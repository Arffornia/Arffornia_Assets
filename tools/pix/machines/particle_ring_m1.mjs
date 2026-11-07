// Particle smelter, tier 8: accelerator ring (r5 concept M1 as a circle; process sheet particle_ring_m1.process.md).
// Twelve magnet segments stand in a circle on a white ceramic base; a violet beam runs round the ring and an
// injection line bends it into the glass chamber at the centre, where the ore hangs in the field and melts.
// Ore comes in by the feeder tube on top (up port), power by the north cable port through the conditioner,
// and the molten metal drains down the east chute to the output port.
import { addRamp, hsh } from '../pix.mjs';

addRamp('cer', ['#7d7a76', '#a9a6a1', '#cfccc6', '#e6e3dd', '#f7f5f0'], { clusters: 0.03 });
addRamp('graph', ['#0f1012', '#1b1d21', '#2a2d33', '#3c4048', '#585d66'], { clusters: 0.03, streaks: 0.04 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.02 });
addRamp('vio', ['#2a0a4a', '#5a1a9a', '#9a4aee', '#c88bff', '#f0dcff'], null, { glow: true });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('ore', ['#1e1a18', '#3a322c', '#5a4c40', '#7a6a58', '#9c8a74'], { clusters: 0.12 });
addRamp('glassy', ['#9fb8c8', '#b9cfdc', '#d2e3ee', '#e6f1f7', '#f7fbfd']);

const RR = 30, SEG = 12, SEG_W = 8, SEG_D = 7, SEG_H = 10, BEAM_Y = 6.5;
const CH_R = 7, CH_Y0 = 7, CH_Y1 = 22;

export const meta = {
  title: 'Particle smelter (accelerator ring)', note: 'Ore melted in a levitation chamber fed by a particle ring. Tier 8.', footprint: [5, 5], height: 2, tier: 8,
  ports: [
    { id: 'in', kind: 'item', face: 'up', cell: [2, 2] }, { id: 'out', kind: 'item', face: 'east', cell: [2, 0] },
    { id: 'power', kind: 'energy', face: 'north', cell: [2, 0] },
  ],
  joints: {
    beam: { type: 'free', light: true, why: 'particle bunches: light running round the ring' },
    field: { type: 'free', light: true, why: 'the ring field: a violet glow that pulses' },
    ore: { type: 'free', light: true, respawn: true, why: 'the ore levitates in the field and melts away; the next lump drops from the feeder' },
    drip: { type: 'free', light: true, why: 'molten droplets falling from the ore into the drain' },
    injector: { type: 'revolute', axis: 'y' },
  },
  lint: { allow: [
  ] },
};
meta.fx = [{ id: 'chamber_sparks', kind: 'ember', at: [0, 14, 0], anims: ['working'], rise: 4, spread: 8, life: 0.8, count: 10, color: '#d9a8ff' }];
export const look = { glow: 1.6 };

const range = (n) => [...Array(n).keys()];

export function build(b, { mat: plainMat }) {
  const mat = (ramp, design, o = {}) => plainMat(ramp, design, { weather: 0.5, ...o });

  // ---------------------------------------------------------------- materials (tier 8: polished graphite, white ceramic, violet)
  const base = mat('cer', {
    top(d) { d.fill((x, y) => { const r = Math.hypot(x - d.w / 2, y - d.h / 2); return ['cer', (r | 0) % 9 === 0 ? 1 : (r | 0) % 9 === 1 ? 4 : 3]; }); },
    side(d) { d.fill((x, y) => ['cer', y === 0 ? 4 : y === d.h - 1 ? 1 : 3]); for (let x = 2; x < d.w; x += 10) d.rect(x, 1, 5, 1, 'sig', 3); },
  });
  const segMat = mat('graph', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['graph', 0], ['graph', 3]]);
      if (d.w >= 6 && d.h >= 8) { d.rect(1, 2, d.w - 2, 3, 'vio', 2); d.hline(1, 3, d.w - 2, 'vio', 4); d.rect(1, d.h - 3, d.w - 2, 1, 'sig', 3); for (let x = 2; x < d.w - 1; x += 3) d.vline(x, 6, d.h - 9, 'graph', 1); }
    },
    top(d) { d.inset(0, 0, d.w, d.h, 'graph'); d.rect(1, 1, d.w - 2, 1, 'cer', 4); d.hline(1, Math.floor(d.h / 2), d.w - 2, 'vio', 2); },
  });
  const cerPart = mat('cer', { side(d) { d.rings(0, 0, d.w, d.h, [['cer', 1], ['cer', 4]]); if (d.w > 6) d.rect(2, Math.floor(d.h / 2), d.w - 4, 1, 'sig', 3); }, top(d) { d.inset(0, 0, d.w, d.h, 'cer'); } });
  const ringCap = mat('graph', { all(d) { d.fill((x, y) => ['graph', y === 0 ? 4 : (x % 4 === 0 ? 1 : 2)]); for (let x = 2; x < d.w; x += 4) d.px(x, Math.floor(d.h / 2), 'vio', 3); } });
  const glassMat = mat('glassy', { all(d) { d.fill((x, y) => ['glassy', (x + y) % 9 === 0 ? 4 : 2]); } }, { clean: true });
  const glowVio = mat('vio', { all(d) { d.fill((x, y) => ['vio', (x + y) % 3 === 0 ? 4 : 3]); } }, { clean: true });
  const oreMat = mat('ore', { all(d) { d.fill((x, y) => { const h = hsh(x, y, 7); return h < 0.2 ? ['amber', 3] : h < 0.35 ? ['vio', 2] : ['ore', h < 0.7 ? 2 : 3]; }); } }, { clean: true });
  const metal = mat('amber', { all(d) { d.fill((x, y) => ['amber', y === 0 ? 4 : (x + y) % 4 === 0 ? 2 : 3]); } }, { clean: true });
  const cabinet = mat('graph', {
    side(d) { d.rings(0, 0, d.w, d.h, [['graph', 0], ['cer', 3]]); if (d.w >= 8 && d.h >= 8) { d.rect(2, 2, d.w - 4, 4, 'graph', 0); for (let x = 3; x < d.w - 3; x += 2) d.px(x, 3 + (hsh(x, 1, 3) * 2 | 0), 'vio', 3); d.rect(2, d.h - 4, d.w - 4, 1, 'sig', 3); } },
    top(d) { d.inset(0, 0, d.w, d.h, 'graph'); },
  });
  const portMat = (face) => mat('cer', {
    [face](d) { d.rings(0, 0, d.w, d.h, [['sig', 3], ['graph', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'graph', 1); d.px(2, 2, 'vio', 3); },
    side(d) { d.fill((x, y) => ['sig', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); },
  });
  const cable = mat('graph', { all(d) { d.fill((x, y) => ['graph', (x + y) % 4 === 0 ? 3 : 1]); d.hline(0, 0, d.w, 'vio', 1); } }, { clean: true });

  // ---------------------------------------------------------------- base and the ring of magnet segments
  b.prism('base', [0, 1, 0], 38, 2, 'y', base, 16);
  range(SEG).forEach((k) => {
    const a = 15 + k * 30, r = (a * Math.PI) / 180, cx = RR * Math.cos(r), cz = -RR * Math.sin(r);
    b.box(`seg_${k + 1}`, [cx - SEG_D / 2, 2, cz - SEG_W / 2], [cx + SEG_D / 2, 2 + SEG_H, cz + SEG_W / 2], segMat, { origin: [cx, 2, cz], rotation: [0, a, 0] });
    b.box(`seg_${k + 1}#2`, [cx - SEG_D / 2 - 0.5, 2 + SEG_H, cz - SEG_W / 2 - 0.5], [cx + SEG_D / 2 + 0.5, 3 + SEG_H, cz + SEG_W / 2 + 0.5], ringCap, { origin: [cx, 2, cz], rotation: [0, a, 0] });
  });
  // the field band through the segments: 24 thin glowing chords at beam height
  b.group('field', [0, BEAM_Y, 0], () => range(24).forEach((k) => {
    const a = k * 15, r = (a * Math.PI) / 180, cx = RR * Math.cos(r), cz = -RR * Math.sin(r), chord = 2 * RR * Math.sin(Math.PI / 24) + 0.4;
    b.box(`field#${k + 1}`, [cx - 0.6, BEAM_Y - 1, cz - chord / 2], [cx + 0.6, BEAM_Y + 1, cz + chord / 2], glowVio, { origin: [cx, BEAM_Y, cz], rotation: [0, a, 0] });
  }));
  // bunches running round the ring
  b.group('beam', [0, BEAM_Y, 0], () => range(4).forEach((k) => {
    const a = k * 90 + 7, r = (a * Math.PI) / 180, cx = RR * Math.cos(r), cz = -RR * Math.sin(r);
    b.box(`beam#${k + 1}`, [cx - 1.2, BEAM_Y - 1.2, cz - 1.2], [cx + 1.2, BEAM_Y + 1.2, cz + 1.2], glowVio);
  }));

  // ---------------------------------------------------------------- centre: pedestal, glass chamber, feeder, drain
  b.prism('pedestal', [0, 4.5, 0], 10, 5, 'y', cerPart, 12);
  b.prism('chamber_base', [0, CH_Y0 - 0.25, 0], CH_R + 0.8, 1.5, 'y', ringCap, 12);
  b.prism('glass_chamber', [0, (CH_Y0 + CH_Y1) / 2, 0], CH_R, CH_Y1 - CH_Y0 - 1, 'y', glassMat, 12);
  b.prism('chamber_top', [0, CH_Y1 - 0.25, 0], CH_R + 0.8, 1.5, 'y', ringCap, 12);
  for (const k of range(4)) {
    const a = 45 + k * 90, r = (a * Math.PI) / 180, x = (CH_R + 0.4) * Math.cos(r), z = -(CH_R + 0.4) * Math.sin(r);
    b.box(`emitter_${k + 1}`, [x - 1, CH_Y0 + 0.5, z - 1], [x + 1, CH_Y1 - 0.5, z + 1], cerPart);
  }
  b.box('feeder', [-2.5, CH_Y1 + 0.5, -2.5], [2.5, 31, 2.5], cerPart);
  b.box('port_in', [-4, 31, -4], [4, 32, 4], portMat('up'));
  b.box('drain', [9, 2.01, -2], [36, 4, 2], cerPart);
  b.box('drain#2', [9, 4, -2], [36, 4.6, -1.4], ringCap);
  b.box('drain#3', [9, 4, 1.4], [36, 4.6, 2], ringCap);
  b.box('drain_metal', [9.5, 4, -1.3], [36, 4.3, 1.3], metal);
  b.box('port_out', [36, 2, -4], [40, 12, 4], portMat('east'));

  // ---------------------------------------------------------------- power: north port, conditioner, cables under the deck edge
  b.box('port_power', [-4, 4, -40], [4, 12, -37.9], portMat('north'));
  b.box('port_power_foot', [-3, 0, -40], [3, 4, -38], cabinet);
  b.box('conditioner', [-7, 1.8, -37.9], [7, 15, -33.5], cabinet);
  b.box('cable_n', [-1, 1.8, -33.5], [1, 3, -10], cable);

  // ---------------------------------------------------------------- injection line (west): swivels in for operation
  // a kicker magnet in the ring's west gap bends the beam into the line; the line itself swivels on the pedestal
  b.box('kicker', [-33, 2, -3], [-27, 10, 3], segMat);
  b.group('injector', [-9, 7, 0], () => {
    b.box('injector#1', [-26, 7, -1.5], [-9, 10, 1.5], cerPart);
    b.box('injector#2', [-25.5, 10, -0.6], [-9.5, 10.6, 0.6], glowVio);
    b.box('injector#3', [-14, 7, -3], [-10, 12, 3], segMat);
    b.box('injector#4', [-24, 2, -1.5], [-21, 7, 1.5], cerPart);
  });

  // ---------------------------------------------------------------- the ore and the drip
  b.group('ore', [0, 12, 0], () => b.box('ore', [-2, 12, -2], [2, 16, 2], oreMat));
  b.group('drip', [0, 12, 0], () => b.box('drip', [-0.6, 7.6, -0.6], [0.6, 12, 0.6], metal));

  // ---------------------------------------------------------------- animation
  const L = 4, off = [0.02, 0.02, 0.02], on = [1, 1, 1];
  const beam = { rotation: range(4 * L * 8 + 1).map((q) => [q / 32, [0, (q / 32) * 360 * 2 / L * 1, 0]]) };
  const field = { scale: range(17).map((q) => [q * L / 16, q === 0 || q === 16 ? on : [1, 0.7 + 0.5 * Math.abs(Math.sin(q * 1.3)), 1]]) };
  // the ore drops from the feeder (hidden in the tube), floats and turns, shrinks as it melts, and drips
  const ore = {
    position: [[0, [0, 12, 0]], [0.4, [0, 0, 0]], [1.4, [0, 1, 0]], [2.4, [0, -0.5, 0]], [3.4, [0, 0.5, 0]], [3.7, [0, 0.5, 0]], [3.75, [0, 12, 0]], [L, [0, 12, 0]]],
    rotation: [[0, [0, 0, 0]], [3.7, [0, 270, 0]], [3.75, [0, 0, 0]], [L, [0, 0, 0]]],
    scale: [[0, on], [0.6, on], [3.6, [0.25, 0.25, 0.25]], [3.65, off], [3.8, off], [L, on]],
  };
  const drip = { scale: [[0, off], [0.9, off], [1.0, on], [3.5, on], [3.6, off], [L, off]] };
  b.anim('working', L, { beam, field, ore, drip });

  // packaged: injection line swung along the north-west, field off; deploy swings it in and starts the field
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const D = 4, SWING = 70;
  b.anim('packaged', 0.5, { injector: { rotation: [[0, [0, SWING, 0]]] }, field: { scale: [[0, [1, 0.05, 1]]] }, beam: { scale: [[0, off]] }, ore: { scale: [[0, off]] }, drip: { scale: [[0, off]] } });
  b.anims[b.anims.length - 1].loop = 'hold';
  b.anim('deploy', D, {
    injector: { rotation: range(21).map((q) => [+(0.3 + 2.2 * q / 20).toFixed(3), [0, SWING * (1 - ease(q / 20)), 0]]).concat([[0, [0, SWING, 0]], [D, [0, 0, 0]]]).sort((a, z) => a[0] - z[0]) },
    field: { scale: [[0, [1, 0.05, 1]], [2.6, [1, 0.05, 1]], [3.2, on], [D, on]] }, beam: { scale: [[0, off], [3.2, off], [3.6, on], [D, on]] },
    ore: { scale: [[0, off], [3.4, off], [D, on]] }, drip: { scale: [[0, off], [3.4, off], [D, on]] },
  });
  b.anims[b.anims.length - 1].loop = 'hold';
}
