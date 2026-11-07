// Pixel-art face painter: flat ramps, 1 px outlines, bevels, and designed motifs. No noise.
// A ramp is 5 shades, darkest first: [outline, shadow, base, light, highlight].
import { hex } from '../da/kit.mjs';

export const RAMPS = {
  steel: ['#14171c', '#232931', '#323a44', '#46505c', '#62707e'],
  paint: ['#3d1a0c', '#8a3714', '#c45a20', '#e57c32', '#f7aa5c'],
  copper: ['#331a0e', '#6b3a1d', '#a35d2f', '#cc8448', '#ecb27a'],
  iron: ['#262a2f', '#4a5158', '#6e7780', '#98a2ab', '#c9d0d6'],
  hot: ['#4a1400', '#a8380a', '#ff6f12', '#ffae3c', '#fff1b8'],
  teal: ['#081a1e', '#0f3a40', '#1c7173', '#3cc4b4', '#c4fff4'],
  coal: ['#0b0b0d', '#17171a', '#222226', '#303036', '#45454c'],
  hazard: ['#14120c', '#2a261a', '#e0a91e', '#f2c440', '#fde58a'],
  brick: ['#2a120c', '#5a2416', '#82361f', '#a5492b', '#c76a44'],
};
const R = (n) => RAMPS[n].map(hex);
export const GLOW = new Set(['hot', 'teal']);

const HEX = ['..RRRRR..', '.RTTTTTR.', 'RLTTTTTDR', 'RLLLTDDDR', 'RLLLSDDDR', 'RLLLSDDDR', '.RLLSDDR.', '..RRRRR..'];

// drawing API bound to one face, or to a region of it (texel coordinates, origin top-left as seen from outside)
function api(c, reg = { x: 0, y: 0, w: c.w, h: c.h }) {
  const px = (x, y, col, glow) => { if (x < 0 || y < 0 || x >= reg.w || y >= reg.h) return; c.put(reg.x + x, reg.y + y, col); if (glow) c.glow(reg.x + x, reg.y + y, col); };
  const d = {
    w: reg.w, h: reg.h, face: c.face, seed: c.seed + reg.x * 31 + reg.y * 17, y0: c.y0, y1: c.y1, side: c.face !== 'up' && c.face !== 'down',
    // a sub-region with its own origin and clipping: surface(d.sub(...), ...) paints only there
    sub: (x, y, w, h) => api(c, { x: reg.x + x, y: reg.y + y, w, h }),
    // per-texel painter: fn(x, y) returns [ramp, shade] or null to leave the texel
    fill(fn) { for (let y = 0; y < reg.h; y++) for (let x = 0; x < reg.w; x++) { const r = fn(x, y); if (r) d.px(x, y, r[0], r[1]); } },
    // nested 1-texel frames, outermost first: [[ramp, shade], ...] (Oritech's main panel motif)
    rings(x, y, w, h, list) { list.forEach(([rp, k], i) => { if (w - 2 * i < 1 || h - 2 * i < 1) return; d.rect(x + i, y + i, w - 2 * i, 1, rp, k); d.rect(x + i, y + h - 1 - i, w - 2 * i, 1, rp, k); d.rect(x + i, y + i, 1, h - 2 * i, rp, k); d.rect(x + w - 1 - i, y + i, 1, h - 2 * i, rp, k); }); },
    checker(x, y, w, h, ramp, cell = 2, a = 1, b2 = 2) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) d.px(x + i, y + j, ramp, (((i / cell) | 0) + ((j / cell) | 0)) & 1 ? a : b2); },
    // staggered courses (bricks, blocks, plates): seams in shade 0, a light top row per course
    courses(x, y, w, h, ramp, ch = 4, cw = 8) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const row = (j / ch) | 0, jj = j % ch, ii = (i + (row & 1 ? cw >> 1 : 0)) % cw; d.px(x + i, y + j, ramp, jj === ch - 1 || ii === cw - 1 ? 0 : jj === 0 ? 3 : 2); } },
    px: (x, y, ramp, k) => px(x, y, R(ramp)[k], GLOW.has(ramp)),
    rect(x, y, w, h, ramp, k) { const col = R(ramp)[k]; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, col, GLOW.has(ramp)); },
    // raised plate: outline, light top/left, dark bottom/right
    plate(x, y, w, h, ramp, o = {}) {
      const r = R(ramp), g = GLOW.has(ramp);
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        const e = i === x || j === y || i === x + w - 1 || j === y + h - 1;
        let k = 2; if (e) k = 0; else if (j === y + 1 || i === x + 1) k = 3; else if (j === y + h - 2 || i === x + w - 2) k = 1;
        px(i, j, r[o.flat && !e ? 2 : k], g);
      }
      if (o.bolts && w >= 6 && h >= 6) for (const [bx, by] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]]) d.bolt(bx, by, ramp);
    },
    // sunken panel: dark rim top/left, light bottom/right
    inset(x, y, w, h, ramp) {
      const r = R(ramp);
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        let k = 2; if (j === y || i === x) k = 0; else if (j === y + h - 1 || i === x + w - 1) k = 3; else if (j === y + 1 || i === x + 1) k = 1;
        px(i, j, r[k], GLOW.has(ramp));
      }
    },
    bolt(x, y, ramp) { const r = R(ramp); px(x, y, r[4]); px(x + 1, y, r[3]); px(x, y + 1, r[3]); px(x + 1, y + 1, r[0]); },
    vent(x, y, w, h, ramp, dir = 'h') {
      const r = R(ramp); d.rect(x, y, w, h, ramp, 0);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const t = dir === 'h' ? j : i; const lip = t % 3 === 0; if (dir === 'h' ? (i > 0 && i < w - 1) : (j > 0 && j < h - 1)) px(x + i, y + j, lip ? r[3] : t % 3 === 1 ? r[1] : r[0]); }
    },
    // glowing window: frame ramp around a hot core, brighter towards the bottom
    window(x, y, w, h, frame = 'steel', core = 'hot') {
      d.plate(x, y, w, h, frame); const r = R(core);
      for (let j = y + 2; j < y + h - 2; j++) for (let i = x + 2; i < x + w - 2; i++) {
        const t = (j - y - 2) / Math.max(1, h - 5); const k = t > 0.75 ? 4 : t > 0.45 ? 3 : t > 0.15 ? 2 : 1;
        px(i, j, r[(i + j) % 7 === 0 && k > 1 ? k - 1 : k], true);
      }
      for (let i = x + 2; i < x + w - 2; i += 3) px(i, y + 2, R(frame)[0]);
    },
    screen(x, y, w, h) { d.plate(x, y, w, h, 'steel'); d.rect(x + 2, y + 2, w - 4, h - 4, 'teal', 1); for (let j = y + 3; j < y + h - 2; j += 2) d.rect(x + 3, j, Math.max(1, Math.floor((w - 6) * (0.4 + 0.6 * ((j * 7) % 5) / 5))), 1, 'teal', 3); d.px(x + w - 4, y + 3, 'teal', 4); },
    hazard(x, y, w, h) { const a = R('hazard'); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, Math.floor((i + j) / 3) % 2 ? a[0] : a[2]); d.rect(x, y, w, 1, 'hazard', 3); },
    hline(x, y, w, ramp, k) { d.rect(x, y, w, 1, ramp, k); },
    vline(x, y, h, ramp, k) { d.rect(x, y, 1, h, ramp, k); },
    // per-texel painter by radius (texels) and angle (deg, ccw from +u) around a centre, default the face
    // centre: paints prism caps as discs. fn(r, a, x, y) returns [ramp, shade] or null. o: { cx, cy, rot }
    radial(fn, o = {}) {
      const cx = o.cx ?? (reg.w - 1) / 2, cy = o.cy ?? (reg.h - 1) / 2;
      d.fill((x, y) => fn(Math.hypot(x - cx, y - cy), (((Math.atan2(cy - y, x - cx) * 180) / Math.PI + (o.rot || 0)) % 360 + 360) % 360, x, y));
    },
    // nested frames broken into key strokes (Oritech's maze panels): list [[inset, ramp, shade], ...];
    // o.breaks is the share of 5-texel runs left out, a tick turns inwards at the start of each break
    brokenRings(x, y, w, h, list, o = {}) {
      for (const [i, rp, k] of list) {
        const W = w - 2 * i, H = h - 2 * i; if (W < 2 || H < 2) continue;
        const per = 2 * (W + H) - 4;
        const at = (t) => (t < W ? [t, 0, 0, 1] : t < W + H - 1 ? [W - 1, t - W + 1, -1, 0] : t < 2 * W + H - 2 ? [W - 1 - (t - W - H + 2), H - 1, 0, -1] : [0, H - 1 - (t - 2 * W - H + 3), 1, 0]);
        let was = true;
        for (let t = 0; t < per; t++) {
          const on = hsh(Math.floor(t / 5), i, d.seed + (o.seed || 41)) >= (o.breaks ?? 0.22);
          const [px0, py0, nx, ny] = at(t);
          if (on) d.px(x + i + px0, y + i + py0, rp, k);
          else if (was && i + 1 < Math.min(w, h) / 2) d.px(x + i + px0 + nx, y + i + py0 + ny, rp, k);
          was = on;
        }
      }
    },
    // diagonal stripes in two given [ramp, shade] pairs (house warning stripes, not the yellow hazard)
    stripes(x, y, w, h, a, b2, o = {}) {
      const sw = o.width || 2, dir = o.dir ?? 1;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) d.px(x + i, y + j, ...(Math.floor((dir > 0 ? i + j : i - j + 4096) / sw) % 2 ? a : b2));
    },
    // weld bead along a line ('h' or 'v'): rippled lit bead, a dark groove on the shadow side
    weld(x, y, len, ramp, o = {}) {
      const v = o.dir === 'v';
      for (let t = 0; t < len; t++) {
        const [i, j] = v ? [x, y + t] : [x + t, y];
        d.px(i, j, ramp, t % 3 === 0 ? 4 : 3);
        d.px(v ? i + 1 : i, v ? j : j + 1, ramp, o.groove ?? 0);
      }
    },
    // row of rivets along a line ('h' or 'v'): a lit head and its shadow texel, every `step` texels
    rivets(x, y, len, ramp, o = {}) {
      const v = o.dir === 'v', step = o.step || 3;
      for (let t = o.phase || 0; t < len; t += step) { const [i, j] = v ? [x, y + t] : [x + t, y]; d.px(i, j, ramp, 4); d.px(i + 1, j + 1, ramp, o.shadow ?? 1); }
    },
    // the Arffornia brand mark: a 9x8 hexagon holding an isometric cube (rim, lit top, mid left, dark right)
    hexMark(x, y, o = {}) {
      const rim = o.rim || ['cu', 3], [top, left, right] = o.faces || [['sig', 4], ['sig', 2], ['sig', 1]];
      const key = { R: rim, T: top, L: left, D: right, S: o.spine || right };
      HEX.forEach((row, j) => [...row].forEach((ch, i) => { if (key[ch]) d.px(x + i, y + j, ...key[ch]); }));
    },
  };
  return d;
}

// deterministic hash in [0, 1)
export const hsh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// Hand-made surface: what a pixel artist adds after the shapes, so a face never looks vector-perfect.
// - clusters: 2-3 texel blotches one shade lighter or darker (vanilla iron/copper look), density by material
// - streaks: short 1-texel runs along one axis (brushed or cast metal)
// - chips: lighter texels on the outline (paint worn off edges); grime: dithered darker band near the ground
const GRAIN = {
  paint: { clusters: 0.05, chips: 0.18, grime: 0.6 },
  steel: { clusters: 0.035, streaks: 0.05, chips: 0.1, grime: 0.5 },
  iron: { streaks: 0.08, clusters: 0.02, chips: 0.08 },
  copper: { clusters: 0.06, streaks: 0.03, chips: 0.12 },
  brick: { clusters: 0.08, grime: 0.6 },
  coal: { clusters: 0.12 },
};
function grain(c, ramp, g) {
  const r = R(ramp), s = c.seed, side = c.face !== 'up' && c.face !== 'down';
  const shift = (x, y, dk) => { const cur = c.get(x, y); const k = r.findIndex((q) => q.every((v, i) => Math.abs(v - cur[i]) < 2)); if (k < 1 || k > 3) return; c.put(x, y, r[Math.max(0, Math.min(4, k + dk))]); };
  for (let y = 1; y < c.h - 1; y++) for (let x = 1; x < c.w - 1; x++) {
    const a = hsh(x >> 1, y >> 1, s), b = hsh(x, y, s + 7);
    if (g.clusters && a < g.clusters && b < 0.75) shift(x, y, hsh(x >> 1, y >> 1, s + 3) < 0.5 ? -1 : 1);
    if (g.streaks && hsh(x >> 2, y, s + 11) < g.streaks) shift(x, y, hsh(0, y, s + 13) < 0.6 ? 1 : -1);
  }
  if (g.chips) for (let x = 0; x < c.w; x++) for (const y of [0, c.h - 1]) if (hsh(x, y, s + 17) < g.chips) c.put(x, y, r[1]);
  if (g.chips) for (let y = 0; y < c.h; y++) for (const x of [0, c.w - 1]) if (hsh(x, y, s + 19) < g.chips) c.put(x, y, r[1]);
  if (g.grime && side && c.y0 < 8) {
    const rows = Math.min(c.h, Math.round((8 - c.y0) * c.h / Math.max(1, c.y1 - c.y0)));
    for (let j = 0; j < rows; j++) { const y = c.h - 1 - j; const p = g.grime * (1 - j / Math.max(1, rows)); for (let x = 1; x < c.w - 1; x++) if (((x + y) & 1) === 0 && hsh(x, y, s + 23) < p) shift(x, y, -1); }
  }
}

// register a ramp (5 shades, darkest first) and optionally its grain
export function addRamp(name, shades, g, o = {}) { RAMPS[name] = shades; if (g) GRAIN[name] = g; if (o.glow) GLOW.add(name); else GLOW.delete(name); }

// Motifs: small stroke glyphs placed cell by cell on purpose, the way Oritech paints its plates
// (key-shaped "maze" strokes) instead of outlines or random speckle. 5x5, '#' = stroke.
export const MOTIFS = {
  maze: [['####.', '...#.', '.#.#.', '.###.', '.....'], ['#....', '#.###', '#.#..', '###..', '.....'], ['.###.', '.#...', '.#.##', '.#..#', '.####'], ['##.##', '.#.#.', '.###.', '.....', '#####'], ['#.###', '#...#', '###.#', '....#', '.....']],
  rivet: [['.....', '.....', '..#..', '.....', '.....']],
  slots: [['.....', '#####', '.....', '#####', '.....']],
};

// The base of every face: a light map (top rows lighter, bottom rows darker on side faces, flat mid on
// tops), sparse paired-texel jitter, then optional motif strokes one shade above the local tone.
// o: { motif, cell=6, skip=0.35, line (fixed shade), flat, jitter=0.17 }
export function surface(d, ramp, o = {}) {
  const s = d.seed + (o.seed || 0);
  const band = (y) => { if (o.flat || !d.side) return 2; const t = y / Math.max(1, d.h - 1); return t < 0.25 ? 3 : t < 0.75 ? 2 : 1; };
  const jit = o.jitter ?? 0.17;
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
    let k = band(y); const r = hsh(x >> 1, y, s);
    if (r < jit * 0.6) k = Math.max(1, k - 1); else if (r > 1 - jit * 0.4) k = Math.min(3, k + 1);
    d.px(x, y, ramp, k);
  }
  const set = o.motif && MOTIFS[o.motif]; if (!set) return;
  const cell = o.cell || 6;
  for (let cy = 0; cy * cell < d.h; cy++) for (let cx = 0; cx * cell < d.w; cx++) {
    if (hsh(cx, cy, s + 5) < (o.skip ?? 0.35)) continue;
    const key = set[Math.floor(hsh(cx, cy, s + 9) * set.length)], fx = hsh(cx, cy, s + 3) < 0.5, fy = hsh(cx, cy, s + 4) < 0.5;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      if (key[fy ? 4 - j : j][fx ? 4 - i : i] !== '#') continue;
      const X = cx * cell + i, Y = cy * cell + j; if (X >= d.w || Y >= d.h) continue;
      d.px(X, Y, ramp, o.line ?? Math.min(4, band(Y) + 1));
    }
  }
}

// a material: a lit surface of a ramp + optional designs per face ({ south(d) {...}, side(d), top(d), all(d) })
// o.surface: options for surface() (motif, cell, skip...); o.plate: old bevelled plate with an outline
// (use for raised panels and small parts only); o.flat: one flat shade (glow); o.clean: no grain
export function mat(ramp, design = {}, o = {}) {
  return { paint(c) {
    const d = api(c);
    if (o.flat) d.rect(0, 0, c.w, c.h, ramp, 2);
    else if (o.plate) d.plate(0, 0, c.w, c.h, ramp, { bolts: o.bolts && c.w >= 12 && c.h >= 12 });
    else surface(d, ramp, o.surface || {});
    if (!o.flat && !o.clean && GRAIN[ramp]) grain(c, ramp, { ...GRAIN[ramp], ...(o.grain || {}) });
    const side = c.face !== 'up' && c.face !== 'down';
    for (const f of [design.all, side ? design.side : design.top, design[c.face]]) if (f) f(d);
    if (!o.flat && !o.clean && GRAIN[ramp] && design.wear !== false) grain(c, ramp, { clusters: (GRAIN[ramp].clusters || 0) * 0.4 });
  } };
}
