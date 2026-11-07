// Smelter, tier 0: brick beehive kiln (r5 concept S1, process sheet smelter_beehive_s1.process.md).
// Natural draft, no power. Ore slides down a wooden chute (west port) into the hopper on the dome top and drops
// into the crucible. Coal (south port) fills a stone trough in front of the firebox door; the fire glows
// through the grate. A brick chimney on the dome's shoulder carries the smoke. When a melt is ready the iron
// tap door on the east side lifts, the ingot slides out onto the stone tray (east port), and the door drops.
import { addRamp, hsh } from '../pix.mjs';

addRamp('gun', ['#16130f', '#27221d', '#39332c', '#524a41', '#736a5c'], { clusters: 0.035, streaks: 0.05, chips: 0.1, grime: 0.5 });
addRamp('sig', ['#4f1c0b', '#a63d12', '#e0661c', '#f78c2f', '#ffbd5e'], { clusters: 0.03, chips: 0.12, grime: 0.5 });
addRamp('cu', ['#3a170e', '#78341c', '#b4592e', '#d9804a', '#f2b07a'], { clusters: 0.05, streaks: 0.04, chips: 0.1 });
addRamp('amber', ['#5c1c04', '#b4460c', '#ff8a1e', '#ffc24e', '#fff2c4'], null, { glow: true });
addRamp('slag', ['#0c0b0c', '#1a1716', '#2a2421', '#3d322b', '#57463a'], { clusters: 0.1 });
addRamp('redbrick', ['#2a0f0a', '#5a1f14', '#88321f', '#ad4a2e', '#cf7350'], { clusters: 0.06, grime: 0.6 });
addRamp('stone', ['#232426', '#3c3e41', '#5a5c5f', '#7b7d80', '#a3a5a7'], { clusters: 0.08, grime: 0.5 });
addRamp('wood', ['#2a1a0e', '#4a2f18', '#6b4524', '#8c5d33', '#b07d4a'], { streaks: 0.14, clusters: 0.04 });

// dome: a 12-sided base drum, then stepped courses; flats face the axes (south flat at z = r)
const BASE_R = 18, BASE_TOP = 16;
const STEPS = [[16.5, 16, 20], [14.5, 20, 24], [12, 24, 28], [9, 28, 31], [6, 31, 33.5]];
const HOOPS = [20, 24, 28];
const TOP = 33.5;

export const meta = {
  title: 'Smelter (beehive kiln)', note: 'Ore to ingots in a coal-fired brick kiln. Tier 0.', footprint: [3, 3], height: 3, tier: 0,
  ports: [
    { id: 'in', kind: 'item', face: 'west', cell: [1, 2] }, { id: 'out', kind: 'item', face: 'east', cell: [1, 0] },
    { id: 'fuel', kind: 'item', face: 'south', cell: [0, 0] },
  ],
  joints: {
    tap_door: { type: 'prismatic', axis: 'y', min: 0, max: 7 },
    fire: { type: 'free', why: 'flames: light that flickers' },
    ingot: { type: 'free', respawn: true, why: 'the work piece: a fresh ingot slides out at each tap, the next one forms inside' },
  },
  lint: { allow: [
    { a: 'ingot', b: 'base#*', check: 'sweep', why: 'the ingot leaves the kiln through the tap hole' },
    { a: 'chimney#*', b: 'dome_*', check: 'overlap', why: 'the chimney is built into the dome courses' },
    { a: 'hoop_*', b: 'dome_*', check: 'overlap', why: 'the iron hoops are shrunk round the courses' },
    { a: 'hoop_*', b: 'chimney#*', check: 'overlap', why: 'the hoop runs round the chimney foot' },
    { a: 'fire', b: 'fire', check: 'thin', why: 'a sheet of flame behind the grate, not a driving part' },
  ] },
};
meta.fx = [
  { id: 'chimney_smoke', kind: 'smoke', at: [0, 46.5, -13], anims: ['working'], rise: 40, spread: 3, drift: 5, size: 1.1 },
  { id: 'door_sparks', kind: 'ember', at: [0, 8, 19.5], anims: ['working'], rise: 6, spread: 6, life: 0.7, count: 8 },
];
export const look = { glow: 1.3 };

export function build(b, { mat: plainMat }) {
  const mat = (ramp, design, o = {}) => plainMat(ramp, design, { weather: 1, ...o });

  // ---------------------------------------------------------------- materials
  const bricks = (d, ramp = 'redbrick', ch = 3, cw = 6) => {
    d.courses(0, 0, d.w, d.h, ramp, ch, cw);
    d.fill((x, y) => { const row = (y / ch) | 0, xx = x + (row & 1 ? cw >> 1 : 0), h = hsh((xx / cw) | 0, row, d.seed); if (y % ch === ch - 1 || xx % cw === cw - 1) return null; return h < 0.1 ? [ramp, 1] : h > 0.9 && y % ch === 0 ? [ramp, 4] : h > 0.82 ? ['slag', 2] : null; });
  };
  const brickMat = mat('redbrick', { side(d) { bricks(d); }, top(d) { d.fill((x, y) => ['redbrick', (x + y) % 7 === 0 ? 1 : (x * 3 + y) % 11 === 0 ? 4 : 3]); d.rings(0, 0, d.w, d.h, [['redbrick', 1]]); } });
  const domeMat = mat('redbrick', {
    side(d) { bricks(d, 'redbrick', 2, 5); d.hline(0, 0, d.w, 'redbrick', 4); for (let x = 0; x < d.w; x++) if (hsh(x, 9, d.seed) < 0.25) d.px(x, d.h - 1, 'slag', 2); },
    top(d) { d.fill((x, y) => { const r = Math.hypot(x - d.w / 2, y - d.h / 2); return ['redbrick', (r | 0) % 2 ? 2 : 3]; }); },
  });
  const hoopMat = mat('gun', { side(d) { d.fill((x) => ['gun', x % 5 === 0 ? 4 : 2]); for (let x = 2; x < d.w; x += 5) d.px(x, 0, 'gun', 0); }, top(d) { d.fill(() => ['gun', 1]); } }, { clean: true });
  const stoneMat = mat('stone', {
    side(d) { d.courses(0, 0, d.w, d.h, 'stone', 4, 9); d.fill((x, y) => (hsh(x >> 1, y >> 1, d.seed) < 0.07 ? ['slag', 2] : null)); },
    top(d) { d.courses(0, 0, d.w, d.h, 'stone', 8, 8); d.fill((x, y) => (hsh(x, y, d.seed + 3) < 0.04 ? ['stone', 4] : null)); },
  });
  const woodMat = mat('wood', {
    all(d) { d.fill((x, y) => ['wood', (x + (y >> 2)) % 4 === 0 ? 1 : y % 6 === 5 ? 0 : (hsh(x, y >> 1, d.seed) < 0.15 ? 3 : 2)]); for (let y = 2; y < d.h; y += 6) { d.px(1, y, 'gun', 3); if (d.w > 3) d.px(d.w - 2, y, 'gun', 3); } },
  });
  const oreMat = mat('slag', {
    up(d) { d.fill((x, y) => { const h = hsh(x >> 1, y >> 1, 5); return h < 0.25 ? ['stone', 3] : h < 0.4 ? ['sig', 1] : h < 0.5 ? ['stone', 4] : ['slag', h < 0.75 ? 2 : 3]; }); d.rings(0, 0, d.w, d.h, [['wood', 1], ['wood', 3]]); },
    side(d) { d.fill((x, y) => ['wood', (x + y) % 5 === 0 ? 1 : 2]); d.hline(0, 0, d.w, 'wood', 4); },
  });
  const coalMat = mat('stone', {
    up(d) { d.rings(0, 0, d.w, d.h, [['stone', 1], ['stone', 3]]); d.fill((x, y) => (x > 1 && y > 1 && x < d.w - 2 && y < d.h - 2 ? ['slag', [0, 1, 2, 3, 1, 0][Math.floor(hsh(x >> 1, y >> 1, 9) * 6)]] : null)); },
    side(d) { d.courses(0, 0, d.w, d.h, 'stone', 3, 7); },
  });
  const doorFrame = mat('gun', {
    side(d) {
      d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]);
      if (d.w > 6) {
        d.plate(1, 1, d.w - 2, d.h - 2, 'sig'); d.rect(Math.floor(d.w / 2) - 5, 1, 11, d.h - 2, 'gun', 0); d.hexMark(Math.floor(d.w / 2) - 4, Math.floor((d.h - 8) / 2));
      }
      for (const y of [1, d.h - 2]) { d.bolt(0, y, 'gun'); d.bolt(d.w - 2, y, 'gun'); }
    },
  });
  const fireMat = mat('amber', { all(d) { d.fill((x, y) => { const t = (d.h - 1 - y) / Math.max(1, d.h - 1); return ['amber', t < 0.25 ? 4 : t < 0.6 ? (hsh(x, y >> 1, 3) < 0.5 ? 4 : 3) : (hsh(x, y, 4) < 0.5 ? 2 : 1)]; }); } }, { clean: true });
  const tapDoor = mat('sig', {
    all(d) { d.rings(0, 0, d.w, d.h, [['gun', 0], ['gun', 3]]); if (d.w > 3 && d.h > 3) { d.rect(1, 1, d.w - 2, d.h - 2, 'sig', 2); d.hline(1, 1, d.w - 2, 'sig', 4); d.bolt(1, 1, 'gun'); if (d.w > 5) d.bolt(d.w - 3, d.h - 3, 'gun'); } },
  });
  const ironMat = mat('gun', { all(d) { d.fill((x, y) => ['gun', y === 0 ? 4 : x % 3 === 0 ? 1 : 2]); } });
  const ingotMat = mat('amber', { all(d) { d.fill((x, y) => ['amber', y === 0 ? 4 : (x + y) % 4 === 0 ? 2 : 3]); } }, { clean: true });
  const portMat = (face) => mat('gun', {
    [face](d) { d.rings(0, 0, d.w, d.h, [['sig', 3], ['gun', 0]]); d.rect(2, 2, d.w - 4, d.h - 4, 'slag', 1); d.hline(2, 2, d.w - 4, 'slag', 0); },
    side(d) { d.fill((x, y) => ['sig', y === 0 ? 4 : y === d.h - 1 ? 1 : 2]); },
  });

  // ---------------------------------------------------------------- plinth and kiln body
  b.box('plinth', [-24, 0, -24], [24, 3, 24], stoneMat);
  b.prism('base', [0, (3.01 + BASE_TOP) / 2, 0], BASE_R, BASE_TOP - 3.01, 'y', brickMat, 12);
  STEPS.forEach(([r, y0, y1], i) => b.prism(`dome_${i + 1}`, [0, (y0 + y1) / 2, 0], r, y1 - y0, 'y', i === 0 ? brickMat : domeMat, 12));
  HOOPS.forEach((y, i) => { const r = STEPS.find(([, y0, y1]) => y >= y0 && y < y1)[0]; b.prism(`hoop_${i + 1}`, [0, y + 0.6, 0], r + 0.4, 1, 'y', hoopMat, 12); });

  // hopper on the dome top, fed by an inclined wooden chute from the west port
  b.box('hopper', [-4.5, TOP, -4.5], [4.5, TOP + 3.5, 4.5], oreMat);
  b.box('port_in', [-24, 36, -4], [-23, 44, 4], portMat('west'));
  const SL = { origin: [-13.5, 39.5, 0], rotation: [0, 0, -12] };
  b.box('chute#1', [-23, 38.5, -3], [-4, 39.5, 3], woodMat, SL);
  b.box('chute#2', [-23, 39.5, -3], [-4, 41.5, -2.3], woodMat, SL);
  b.box('chute#3', [-23, 39.5, 2.3], [-4, 41.5, 3], woodMat, SL);
  b.box('trestle#1', [-21.5, 3, -1.5], [-18.5, 40.5, 1.5], woodMat);
  b.box('trestle#2', [-22.5, 3, -3], [-17.5, 5, 3], woodMat);

  // chimney on the dome's north shoulder
  b.box('chimney#1', [-3, 24, -16.5], [3, 45.9, -10.5], brickMat);
  b.box('chimney#2', [-3.5, 44.5, -17], [3.5, 46, -10], ironMat);

  // firebox door (south flat) with the fire behind the grate
  b.box('fire_door#1', [-5.5, 3, 17.6], [-3.5, 11, 19], ironMat);
  b.box('fire_door#2', [3.5, 3, 17.6], [5.5, 11, 19], ironMat);
  b.box('fire_door#3', [-5.5, 11, 17.6], [5.5, 20, 19], doorFrame);
  b.box('fire_door#4', [-3.5, 3, 17.6], [3.5, 4, 19], ironMat);
  for (const x of [-2, 0, 2]) b.box(`grate_${x + 2}`, [x - 0.4, 4, 18.4], [x + 0.4, 11, 18.9], ironMat);
  b.group('fire', [0, 4, 17.8], () => b.box('fire', [-3.5, 4, 17.2], [3.5, 11, 18.4], fireMat));
  // coal bin at the south-west corner, a stone channel to the firebox mouth
  b.box('coal_bin', [-20, 3, 17], [-12, 8, 23], coalMat);
  b.box('coal_channel', [-12, 3, 18.6], [-3.5, 4.5, 21.5], coalMat);
  b.box('port_fuel', [-20, 4, 23], [-12, 12, 24], portMat('south'));

  // tap hole (east flat): iron frame, a sliding door, a short chute and the stone tray
  b.box('tap_frame#1', [17.6, 3, -4.5], [19, 4, 4.5], ironMat);
  b.box('tap_frame#2', [17.6, 4, -4.5], [19, 16, -3], ironMat);
  b.box('tap_frame#3', [17.6, 4, 3], [19, 16, 4.5], ironMat);
  b.group('tap_door', [18.6, 4, 0], () => b.box('tap_door', [18.6, 4, -3.4], [20.1, 11, 3.4], tapDoor));
  b.box('tray', [19.6, 3, -6], [23, 5, 6], stoneMat);
  b.box('tray#2', [19.6, 5, -6], [23, 6, -5], stoneMat);
  b.box('tray#3', [19.6, 5, 5], [23, 6, 6], stoneMat);
  b.box('port_out', [23, 4, -4], [24, 12, 4], portMat('east'));

  // the ingot (bind pose: inside the kiln, behind the tap hole)
  const IX = 14;
  b.group('ingot', [IX, 4, 0], () => b.box('ingot', [IX - 2, 4, -1.5], [IX + 2, 6, 1.5], ingotMat));

  // ---------------------------------------------------------------- animation
  const L = 4;
  const flicker = { scale: [...Array(17).keys()].map((q) => [q * L / 16, q === 0 || q === 16 ? [1, 1, 1] : [0.92 + 0.12 * hsh(q, 1, 5), 0.75 + 0.35 * hsh(q, 2, 5), 1]]) };
  const door = { position: [[0, [0, 0, 0]], [1.0, [0, 0, 0]], [1.3, [0, 7, 0]], [2.2, [0, 7, 0]], [2.5, [0, 0, 0]], [L, [0, 0, 0]]] };
  const ix = (x, y = 0) => [x - IX, y, 0];
  const ingot = {
    position: [[0, ix(IX)], [1.3, ix(IX)], [1.9, ix(21.3, 1)], [3.5, ix(21.3, 1)], [3.61, ix(IX)], [L, ix(IX)]],
    scale: [[0, [1, 1, 1]], [3.3, [1, 1, 1]], [3.55, [0.02, 0.02, 0.02]], [3.65, [0.02, 0.02, 0.02]], [L, [1, 1, 1]]],
  };
  b.anim('working', L, { fire: flicker, tap_door: door, ingot });
}
