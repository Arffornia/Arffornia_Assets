// Concept-model kit: build a Blockbench .bbmodel from code, with a painted 32 px/block texture
// atlas and a GeckoLib-style glowmask. Used for the DA research models (concepts/), so the same
// lint and renderer that gate production models judge the concepts too.
//
// Units: Blockbench px (16 = 1 block). Origin = centre of the footprint on the ground, y up.
// One texel = 0.5 px, so every face is painted at exactly 32 texels per block.
import zlib from 'node:zlib';
import crypto from 'node:crypto';

// ------------------------------------------------------------------ PNG (deterministic, no deps)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function png(w, h, rgba) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------ colour + noise helpers
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const shade = (c, k) => c.map((v) => v * k);
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
// integer hash noise: deterministic per (x, y, seed)
export const rnd = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return ((h >>> 0) % 10000) / 10000; };
const smooth = (x, y, s, f) => { const xi = Math.floor(x / f), yi = Math.floor(y / f), xf = x / f - xi, yf = y / f - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return rnd(xi, yi, s) * (1 - u) * (1 - v) + rnd(xi + 1, yi, s) * u * (1 - v) + rnd(xi, yi + 1, s) * (1 - u) * v + rnd(xi + 1, yi + 1, s) * u * v; };
export const fbm = (x, y, s) => 0.55 * smooth(x, y, s, 8) + 0.3 * smooth(x, y, s + 7, 3) + 0.15 * rnd(x, y, s + 13);

// ------------------------------------------------------------------ 3x5 stencil font (scale cues: "CR-01")
const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', X: '101101010101101', Y: '101101010010010', '-': '000000111000000', ' ': '000000000000000', '.': '000000000000010' };

// ------------------------------------------------------------------ the builder
export class Model {
  constructor(id, meta) {
    this.id = id; this.meta = meta; this.elements = []; this.root = []; this.stack = [this.root]; this.anims = []; this.n = 0;
  }
  uuid(s) { const h = crypto.createHash('sha1').update(`${this.id}:${s}:${this.n++}`).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; }
  // group (bone): children added inside fn are under it
  group(name, origin, fn, rotation) {
    const g = { name, origin, uuid: this.uuid(name), children: [], ...(rotation ? { rotation } : {}) };
    this.stack[this.stack.length - 1].push(g); this.stack.push(g.children); fn(); this.stack.pop(); return g;
  }
  // a cuboid: from/to in px, mat = { paint(ctx), glow? } from a direction's palette
  box(name, from, to, mat, o = {}) {
    const f = [Math.min(from[0], to[0]), Math.min(from[1], to[1]), Math.min(from[2], to[2])], t = [Math.max(from[0], to[0]), Math.max(from[1], to[1]), Math.max(from[2], to[2])];
    if (t.some((v, i) => v - f[i] < 0.01)) return null;
    const el = { name, from: f, to: t, origin: o.origin || [(f[0] + t[0]) / 2, (f[1] + t[1]) / 2, (f[2] + t[2]) / 2], uuid: this.uuid(name), type: 'cube', box_uv: false, rescale: false, autouv: 0, color: 0, faces: {}, _mat: mat, _hide: new Set(o.hide || []), _decal: o.decal };
    if (o.rotation) el.rotation = o.rotation;
    this.elements.push(el); this.stack[this.stack.length - 1].push(el.uuid); return el;
  }
  // regular n-gon prism around an axis, exact: one thin rectangle per pair of opposite sides
  // (2r long, 2r*tan(pi/n) wide, rotated by k*180/n). All are one compound (stem#k); their inner
  // long faces are hidden and their caps sit a hair apart (no z-fight). r = inradius (flat to centre).
  // spin rotates the whole prism around its axis (deg): a hexagon with spin 30 has flats along z.
  prism(name, c, r, len, axis, mat, sides = 12, o = {}) {
    const ax = { x: 0, y: 1, z: 2 }[axis]; const k = sides / 2; const step = 180 / k; const other = [0, 1, 2].filter((q) => q !== ax);
    const halfW = r * Math.tan(Math.PI / sides);
    const FN = [['west', 'east'], ['down', 'up'], ['north', 'south']];
    const out = [];
    for (let i = 0; i < k; i++) {
      const h = len / 2 - i * 0.01;
      const ext = [0, 0, 0]; ext[ax] = h; ext[other[0]] = r; ext[other[1]] = halfW;
      const rot = [0, 0, 0]; rot[ax] = (o.spin || 0) + i * step; const rr = rot.some((v) => Math.abs(v) > 1e-9) ? rot : undefined;
      const hide = [...(o.hide || []), ...FN[other[1]]];
      out.push(this.box(`${name}#${i + 1}`, c.map((v, q) => v - ext[q]), c.map((v, q) => v + ext[q]), i === 0 || !o.mats ? mat : o.mats[i % o.mats.length], { origin: c, rotation: rr, hide, decal: o.decal }));
    }
    return out;
  }
  // a chamfered box (45 deg edges on the vertical corners): two inset boxes + four corner squares
  chamfer(name, from, to, mat, ch, o = {}) {
    const [x0, y0, z0] = from, [x1, y1, z1] = to; const c = Math.min(ch, (x1 - x0) / 3, (z1 - z0) / 3);
    if (c < 0.5) return [this.box(name, from, to, mat, o)];
    const out = [this.box(`${name}#1`, [x0 + c, y0, z0], [x1 - c, y1, z1], mat, { hide: ['east', 'west'], decal: o.decal }), this.box(`${name}#2`, [x0, y0 + 0.01, z0 + c], [x1, y1 - 0.01, z1 - c], mat, { hide: ['north', 'south'], decal: o.decal })];
    const s = c / Math.SQRT2;
    [[x0 + c, z0 + c], [x1 - c, z0 + c], [x1 - c, z1 - c], [x0 + c, z1 - c]].forEach(([cx, cz], i) => out.push(this.box(`${name}#${3 + i}`, [cx - s, y0 + 0.02 + i * 0.002, cz - s], [cx + s, y1 - 0.02 - i * 0.002, cz + s], mat, { origin: [cx, y0, cz], rotation: [0, 45, 0] })));
    return out;
  }
  anim(name, length, tracks, interp = 'linear') {
    // tracks: { bone: { rotation: [[t, [x, y, z]], ...], position: [...] } } in world sense; Blockbench signs applied here
    const animators = {};
    for (const [bone, ch] of Object.entries(tracks)) {
      const kfs = [];
      for (const [channel, keys] of Object.entries(ch)) for (const [time, v, ip] of keys) {
        const d = channel === 'rotation' ? [-v[0], -v[1], v[2]] : channel === 'position' ? [-v[0], v[1], v[2]] : v;
        kfs.push({ channel, data_points: [{ x: d[0], y: d[1], z: d[2] }], uuid: this.uuid(`${bone}${channel}${time}`), time, color: -1, interpolation: ip || interp });
      }
      animators[this.uuid(bone)] = { name: bone, type: 'bone', keyframes: kfs };
    }
    this.anims.push({ uuid: this.uuid(name), name, loop: 'loop', override: false, length, snapping: 20, selected: false, anim_time_update: '', blend_weight: '', start_delay: '', loop_delay: '', animators });
  }

  // pack every face into an atlas (32 texels per block), paint it, emit .bbmodel + png + glowmask
  build() {
    const td = (this.meta.texelsPerBlock || 32) / 16;
    const DIMS = { north: [0, 1], south: [0, 1], east: [2, 1], west: [2, 1], up: [0, 2], down: [0, 2] };
    const islands = [];
    for (const el of this.elements) {
      const sz = [0, 1, 2].map((k) => el.to[k] - el.from[k]);
      for (const face of Object.keys(DIMS)) {
        if (el._hide.has(face)) { el.faces[face] = { uv: [0, 0, 0, 0], texture: null }; continue; }
        const [i, j] = DIMS[face];
        const w = Math.max(1, Math.round(sz[i] * td)), h = Math.max(1, Math.round(sz[j] * td));
        islands.push({ el, face, w, h, pw: sz[i], ph: sz[j] });
      }
    }
    // shelf packing, tallest first; 1 texel gutter
    islands.sort((a, b) => b.h - a.h || b.w - a.w);
    const area = islands.reduce((s, q) => s + (q.w + 1) * (q.h + 1), 0);
    let W = 256; while (W * W < area * 1.25) W *= 2;
    let x = 0, y = 0, rowH = 0;
    for (const q of islands) { if (x + q.w + 1 > W) { x = 0; y += rowH + 1; rowH = 0; } q.x = x; q.y = y; x += q.w + 1; rowH = Math.max(rowH, q.h); }
    let H = 64; while (H < y + rowH + 1) H *= 2;
    const tex = new Uint8Array(W * H * 4), glow = new Uint8Array(W * H * 4);
    for (const q of islands) {
      const el = q.el;
      // UVs in texels; resolution = atlas size, so 1 uv unit = 1 texel
      el.faces[q.face] = { uv: [q.x, q.y, q.x + q.w, q.y + q.h], texture: 0 };
      const ctx = { w: q.w, h: q.h, face: q.face, side: q.face !== 'up' && q.face !== 'down', y0: el.from[1], y1: el.to[1], name: el.name, seed: this.seedOf(el.name),
        put: (px, py, c, a = 255) => { if (px < 0 || py < 0 || px >= q.w || py >= q.h) return; const o = ((q.y + py) * W + q.x + px) * 4; tex[o] = clamp(c[0]); tex[o + 1] = clamp(c[1]); tex[o + 2] = clamp(c[2]); tex[o + 3] = a; },
        get: (px, py) => { const o = ((q.y + py) * W + q.x + px) * 4; return [tex[o], tex[o + 1], tex[o + 2]]; },
        glow: (px, py, c) => { if (px < 0 || py < 0 || px >= q.w || py >= q.h) return; const o = ((q.y + py) * W + q.x + px) * 4; glow[o] = clamp(c[0]); glow[o + 1] = clamp(c[1]); glow[o + 2] = clamp(c[2]); glow[o + 3] = 255; },
        text: (s, px, py, c) => { [...s].forEach((ch, k) => { const g = FONT[ch.toUpperCase()] || FONT[' ']; for (let r = 0; r < 5; r++) for (let cc = 0; cc < 3; cc++) if (g[r * 3 + cc] === '1') ctx.put(px + k * 4 + cc, py + r, c); }); } };
      el._mat.paint(ctx);
      if (el._decal) el._decal(ctx);
      // gutter: repeat the island's border so mipmaps do not bleed
      for (let py = -1; py <= q.h; py++) for (const px of [-1, q.w]) { const sx = Math.max(0, Math.min(q.w - 1, px)), sy = Math.max(0, Math.min(q.h - 1, py)); const xx = q.x + px, yy = q.y + py; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const o = (yy * W + xx) * 4, s = ((q.y + sy) * W + q.x + sx) * 4; for (let k = 0; k < 4; k++) tex[o + k] = tex[s + k]; }
      for (let px = 0; px < q.w; px++) { const yy = q.y + q.h; if (yy >= H) continue; const o = (yy * W + q.x + px) * 4, s = ((q.y + q.h - 1) * W + q.x + px) * 4; for (let k = 0; k < 4; k++) tex[o + k] = tex[s + k]; }
    }
    const texPng = png(W, H, tex), glowPng = png(W, H, glow);
    const strip = (el) => { const { _mat, _hide, _decal, ...rest } = el; return rest; };
    const bb = {
      meta: { format_version: '4.10', model_format: 'free', box_uv: false },
      name: this.id, model_identifier: '', visible_box: [1, 1, 0], variable_placeholders: '', variable_placeholder_buttons: [], timeline_setups: [], unhandled_root_fields: {},
      resolution: { width: W, height: H },
      elements: this.elements.map(strip), outliner: this.root,
      textures: [{ path: '', name: `${this.id}.png`, folder: '', namespace: '', id: '0', width: W, height: H, uv_width: W, uv_height: H, particle: false, render_mode: 'default', render_sides: 'auto', visible: true, internal: true, saved: true, uuid: this.uuid('tex'), source: `data:image/png;base64,${texPng.toString('base64')}` }],
      animations: this.anims,
      arffornia: this.meta,
    };
    return { bbmodel: bb, texPng, glowPng, atlas: [W, H] };
  }
  seedOf(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) % 9973; }
}

// ------------------------------------------------------------------ materials
// A material is { paint(ctx) }. Directions compose these with their own palettes and wear.
export const M = {
  // painted metal: noise, fake bevel, chipped edges, grime towards the ground, panel seams + rivets
  paint(col, o = {}) {
    const base = hex(col), metal = hex(o.under || '#5d6368'), dirt = hex(o.dirt || '#2c2620');
    return { paint(c) {
      const seam = o.panel || 0;
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
        let k = 1 + (fbm(x, y, c.seed) - 0.5) * (o.noise ?? 0.12);
        let col2 = shade(base, k);
        // fake bevel: light top/left, dark bottom/right edge
        if (y === 0 || x === 0) col2 = shade(col2, 1.16); else if (y === c.h - 1 || x === c.w - 1) col2 = shade(col2, 0.7);
        // vertical grime: darker and dirtier near the ground (world y)
        if (c.side && o.grime) { const wy = c.y1 - (y / c.h) * (c.y1 - c.y0); const g = Math.max(0, 1 - wy / (o.grimeH || 14)) * o.grime; col2 = mix(col2, dirt, g * (0.6 + 0.4 * fbm(x, y, c.seed + 3))); }
        if (seam && c.w > seam * 1.5 && x % seam === 0 && x > 0) col2 = shade(col2, 0.72);
        if (seam && c.h > seam * 1.5 && y % seam === 0 && y > 0) col2 = shade(col2, 0.72);
        // chipped paint on edges
        const edge = Math.min(x, y, c.w - 1 - x, c.h - 1 - y);
        if (o.wear && edge < 2 && rnd(x, y, c.seed + 5) < o.wear * (edge === 0 ? 1 : 0.4)) col2 = shade(metal, 0.9 + rnd(x, y, 9) * 0.25);
        c.put(x, y, col2);
      }
      if (o.rivets && c.w >= 10 && c.h >= 10) {
        const step = o.rivets; for (let y = 3; y < c.h - 2; y += step) for (let x = 3; x < c.w - 2; x += step) if (x <= 4 || x >= c.w - 5 || y <= 4 || y >= c.h - 5) { c.put(x, y, shade(base, 1.12)); c.put(x + 1, y + 1, shade(base, 0.72)); }
      }
    } };
  },
  // brushed / bare metal
  metal(col, o = {}) {
    const base = hex(col);
    return { paint(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      let k = 1 + (smooth(x * 0.2, y * 3, c.seed, 2) - 0.5) * (o.streak ?? 0.22) + (rnd(x, y, c.seed) - 0.5) * 0.05;
      if (y === 0 || x === 0) k *= 1.2; else if (y === c.h - 1 || x === c.w - 1) k *= 0.68;
      if (o.bands && c.side && y % o.bands < 2) k *= 0.62;
      let cc = shade(base, k);
      if (o.patina && c.side) { const wy = c.y1 - (y / c.h) * (c.y1 - c.y0); const p = Math.max(0, 1 - wy / 24) * o.patina * fbm(x, y, c.seed + 11); cc = mix(cc, hex('#4f9c86'), Math.min(0.8, p * 1.4)); }
      c.put(x, y, cc);
    } } };
  },
  hazard(a = '#e8b52a', b = '#1b1c1e', period = 8) {
    const A = hex(a), B = hex(b);
    return { paint(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { const s = Math.floor((x + y) / (period / 2)) % 2; let col = s ? B : A; col = shade(col, 1 + (rnd(x, y, c.seed) - 0.5) * 0.12); if (rnd(x, y, c.seed + 2) < 0.04) col = mix(col, hex('#555'), 0.6); c.put(x, y, col); } } };
  },
  grate(col, o = {}) {
    const base = hex(col);
    return { paint(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const slot = o.vertical ? (x % 4 === 1 || x % 4 === 2) && y > 1 && y < c.h - 2 : (y % 4 === 1 || y % 4 === 2) && x > 1 && x < c.w - 2;
      let cc = slot ? shade(base, 0.25) : shade(base, 1 + (rnd(x, y, c.seed) - 0.5) * 0.1);
      if (!slot && (o.vertical ? x % 4 === 3 : y % 4 === 3)) cc = shade(cc, 1.25);
      if (slot && o.glow) { cc = hex(o.glow); c.glow(x, y, shade(hex(o.glow), 0.8)); }
      c.put(x, y, cc);
    } } };
  },
  // emissive surface (light strip, molten metal, energy): written to the glowmask too
  glow(col, o = {}) {
    const base = hex(col);
    return { paint(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const f = o.flicker ? 0.8 + fbm(x, y, c.seed) * 0.4 : 1;
      const edge = Math.min(x, y, c.w - 1 - x, c.h - 1 - y);
      const k = (edge === 0 && c.w > 3 && c.h > 3 ? 0.75 : 1) * f;
      const cc = o.core ? mix(shade(base, k), hex(o.core), Math.max(0, 1 - edge / 3) * 0 + (fbm(x, y, c.seed + 4) > 0.62 ? 0.6 : 0)) : shade(base, k);
      c.put(x, y, cc); c.glow(x, y, shade(cc, o.strength ?? 1));
    } } };
  },
  glass(col = '#9fd4e8') { const base = hex(col); return { paint(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) c.put(x, y, (x + y) % 9 === 0 ? shade(base, 1.3) : base, 120); } }; },
  rubber(col = '#1d1f22') { const base = hex(col); return { paint(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) c.put(x, y, shade(base, 1 + (rnd(x, y, c.seed) - 0.5) * 0.25 + (x % 6 === 0 ? 0.25 : 0))); } }; },
  // ceramic / composite panels: big seams, soft edge AO, almost no noise
  ceramic(col, o = {}) {
    const base = hex(col), seamC = hex(o.seam || '#8f969c');
    return { paint(c) { const P = o.panel || 24; for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const edge = Math.min(x, y, c.w - 1 - x, c.h - 1 - y);
      let cc = shade(base, 1 + (fbm(x, y, c.seed) - 0.5) * 0.05 - Math.max(0, 3 - edge) * 0.03);
      if (edge === 0) cc = shade(cc, y === 0 || x === 0 ? 1.06 : 0.8);
      if ((c.w > P * 1.4 && x % P === 0 && x) || (c.h > P * 1.4 && y % P === 0 && y)) cc = seamC;
      if (c.side && o.grime) { const wy = c.y1 - (y / c.h) * (c.y1 - c.y0); cc = mix(cc, hex('#6b6f73'), Math.max(0, 1 - wy / 6) * o.grime); }
      c.put(x, y, cc);
    } } };
  },
  // honeycomb plate: a true flat-top hex grid (cell circumradius `size` texels), raised cells, dark seams
  hexplate(col, line, o = {}) {
    const base = hex(col), L = hex(line);
    return { paint(c) { const S = o.size || 6, A = S * Math.sqrt(3) / 2;
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
        const px = x + 0.5, py = y + 0.5;
        const q = (2 / 3 * px) / S, r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / S;
        let cx = q, cz = r, cy = -q - r; let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
        const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
        if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
        const hx = S * 1.5 * rx, hy = S * Math.sqrt(3) * (rz + rx / 2);
        const lx = Math.abs(px - hx), ly = Math.abs(py - hy);
        const d = Math.max(ly, ly * 0.5 + lx * Math.sqrt(3) / 2); // distance metric to the cell edge (apothem A)
        let cc;
        if (d > A - 1) cc = L;
        else {
          cc = shade(base, 1 + (fbm(x, y, c.seed) - 0.5) * 0.1 + (py < hy ? 0.06 : -0.04));
          if (d > A - 2 && py < hy) cc = shade(cc, 1.18);
          if (o.glow && rnd(rx, rz, c.seed) < o.glowP && d < A - 1.5) { cc = mix(hex(o.glow), [255, 240, 200], d < A / 3 ? 0.35 : 0); c.glow(x, y, shade(cc, 0.95)); }
        }
        const edge = Math.min(x, y, c.w - 1 - x, c.h - 1 - y); if (edge === 0) cc = shade(cc, 0.75);
        c.put(x, y, cc);
      } } };
  },
  brick(col, mortar = '#3a2a22', o = {}) {
    const base = hex(col), mo = hex(mortar);
    return { paint(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const row = Math.floor(y / 4), xx = x + (row % 2) * 4; const m = y % 4 === 3 || xx % 8 === 7;
      let cc = m ? mo : shade(base, 0.85 + rnd(Math.floor(xx / 8), row, c.seed) * 0.3);
      if (o.heat && c.side) { const wy = c.y0 + (1 - y / c.h) * (c.y1 - c.y0); const hh = Math.max(0, 1 - Math.abs(wy - o.heatY) / 10) * o.heat; if (!m) { cc = mix(cc, hex('#ff8a3a'), hh); if (hh > 0.3) c.glow(x, y, shade(hex('#ff6a1a'), hh)); } }
      c.put(x, y, cc);
    } } };
  },
  screen(bg, fg) {
    const B = hex(bg), F = hex(fg);
    return { paint(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const edge = Math.min(x, y, c.w - 1 - x, c.h - 1 - y);
      if (edge < 1) { c.put(x, y, shade(B, 0.6)); continue; }
      const bar = y % 3 === 1 && x < 2 + (rnd(0, Math.floor(y / 3), c.seed) * (c.w - 4));
      const cc = bar ? F : B; c.put(x, y, cc); if (bar) c.glow(x, y, shade(F, 0.9)); else c.glow(x, y, shade(B, 0.25));
    } } };
  },
};

// stencil decal helper: text centred on a face, used as a scale cue ("CR-01")
export const stencil = (txt, col, faces = ['south', 'east']) => (c) => { if (!faces.includes(c.face) || c.w < txt.length * 4 + 4 || c.h < 9) return; c.text(txt, Math.floor((c.w - txt.length * 4) / 2), Math.floor(c.h * 0.22), hex(col)); };
