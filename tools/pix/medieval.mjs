// Tier 0 (medieval) painters and geometry for pixel-art machines: masonry, timber, wicker, leather, clay,
// iron straps; wheel rims and radial boards; cam lift from the cam's real outline.
// Painters take the drawing API `d` from pix.mjs (face or sub-region). Geometry helpers take the kit Model `b`.
import { hsh } from './pix.mjs';

const clampK = (k) => Math.max(0, Math.min(4, k));
// light map row band on side faces: +1 top quarter, -1 bottom quarter
const band = (d, y, H = d.h) => (!d.side ? 0 : y < H * 0.25 ? 1 : y >= H * 0.75 ? -1 : 0);

// Irregular masonry: courses `ch` texels high, stones min..max wide with their own base shade, a lit top row,
// mortar joints (o.mortar [ramp, k]) under and right of each stone, hairline cracks in some stones.
// o.alt = [ramp, share]: that share of stones is painted in another ramp (lime-washed or daubed patches).
// o.lip: courses alternate in depth (every other course one shade darker): reads as rough-laid stone.
export function masonry(d, ramp, o = {}) {
  const ch = o.ch || 4, min = o.min || 4, max = o.max || 9, s = d.seed + (o.seed || 0);
  const mortar = o.mortar || [ramp, 0];
  for (let row = 0; row * ch < d.h; row++) {
    let x = -Math.floor(hsh(row, 0, s) * max), i = 0;
    while (x < d.w) {
      const bw = min + Math.floor(hsh(row, i, s + 1) * (max - min + 1));
      const alt = o.alt && hsh(row, i, s + 9) < o.alt[1];
      const rp = alt ? o.alt[0] : ramp;
      const base = [1, 2, 2, 2, 3][Math.floor(hsh(row, i, s + 2) * 5)] - (o.lip && row & 1 ? 1 : 0);
      for (let j = 0; j < ch; j++) for (let k = 0; k < bw; k++) {
        const X = x + k, Y = row * ch + j; if (X < 0 || X >= d.w || Y >= d.h) continue;
        if (j === ch - 1 || k === bw - 1) { d.px(X, Y, ...mortar); continue; }
        let sh = base + band(d, Y) + (j === 0 ? 1 : 0) - (j === ch - 2 && ch > 3 ? 1 : 0);
        const r = hsh(X, Y, s + 5); if (r < 0.07) sh -= 1; else if (r > 0.95) sh += 1;
        d.px(X, Y, rp, Math.max(1, Math.min(4, sh)));
      }
      if (!alt && bw > 4 && hsh(row, i, s + 3) < (o.crack ?? 0.25)) {
        let cx = x + 1 + Math.floor(hsh(row, i, s + 4) * (bw - 3));
        for (let j = 0; j < ch - 1; j++) { d.px(cx, row * ch + j, ramp, 0); if (hsh(row * 7 + j, i, s + 8) < 0.5) cx++; }
      }
      x += bw; i++;
    }
  }
}

// Boards along u (o.dir 'h') or v ('v'), `pw` texels wide: dark seams, a lit edge per board, grain streaks one
// shade off along the board, butt joints with nail heads (o.nail [ramp, k]) every o.joint texels, knots.
export function planks(d, ramp, o = {}) {
  const v = o.dir === 'v', pw = o.pw || 4, s = d.seed + (o.seed || 0), J = o.joint || 0;
  d.fill((x, y) => {
    const t = v ? y : x, c = v ? x : y, board = Math.floor(c / pw), cc = c % pw;
    if (cc === pw - 1 && o.seams !== false) return [ramp, 0];
    const off = Math.floor(hsh(board, 1, s) * 9);
    if (J && (t + off) % J === 0) return [ramp, 0];
    let k = [2, 2, 3, 1][Math.floor(hsh(board, 0, s) * 4)] + band(d, y) + (cc === 0 ? 1 : 0);
    const g = hsh(Math.floor((t + board * 5) / 3), c, s + 1); if (g < 0.2) k -= 1; else if (g > 0.92) k += 1;
    return [ramp, Math.max(1, Math.min(4, k))];
  });
  // knots: a dark core in a ring one shade below
  const n = Math.round((d.w * d.h) / (o.knotEvery || 90));
  for (let q = 0; q < n; q++) {
    const kx = Math.floor(hsh(q, 3, s) * d.w), ky = Math.floor(hsh(q, 4, s) * d.h);
    d.px(kx, ky, ramp, 0); d.px(kx + (v ? 0 : 1), ky + (v ? 1 : 0), ramp, 1); d.px(kx - (v ? 0 : 1), ky - (v ? 1 : 0), ramp, 3);
  }
  if (o.nail && J) {
    const L = v ? d.h : d.w, A = v ? d.w : d.h;
    for (let b0 = 0; b0 * pw < A; b0++) {
      const off = Math.floor(hsh(b0, 1, s) * 9);
      for (let t = 0; t < L; t++) if ((t + off) % J === 0) for (const tt of [t - 1, t + 1]) {
        const c = b0 * pw + Math.floor((pw - 1) / 2);
        d.px(v ? c : tt, v ? tt : c, o.nail[0], o.nail[1]);
      }
    }
  }
}

// End grain (a log or post top seen from above): growth rings around (cx, cy), a radial check crack.
export function endGrain(d, ramp, o = {}) {
  const s = d.seed + (o.seed || 0), cx = o.cx ?? (d.w - 1) / 2, cy = o.cy ?? (d.h - 1) / 2, ca = hsh(1, 2, s) * 360;
  d.radial((r, a) => {
    if (Math.abs(((a - ca + 540) % 360) - 180) < 9 && r > 0.8) return [ramp, 0];
    const ring = Math.floor(r * 0.9 + hsh(Math.floor(a / 40), 0, s) * 0.6);
    return [ramp, r > Math.min(d.w, d.h) / 2 - 0.6 ? 1 : ring % 2 ? 2 : 3 + (r < 1 ? 1 : 0)];
  }, { cx, cy });
}

// Basket weave: horizontal withies 2 texels high going over and under vertical stakes every `step` texels.
export function wicker(d, ramp, o = {}) {
  const step = o.step || 4;
  d.fill((x, y) => {
    const row = y >> 1, stake = x % step === 0, over = ((Math.floor(x / step) + row) & 1) === 0;
    if (stake) return [ramp, over ? 1 : 3];
    const k = over ? (y & 1 ? 2 : 4) : (y & 1 ? 0 : 1);
    return [ramp, clampK(k + (band(d, y) < 0 ? -1 : 0))];
  });
}

// Leather bellows hide: fold creases every `fh` texels (dark crease, lit ridge above), short wrinkles near the
// pinched end (o.pinch 'w' or 'e'), and a stitched seam (o.stitch [ramp, k]) along the top and bottom.
export function leather(d, ramp, o = {}) {
  const fh = o.fh || 3, s = d.seed + (o.seed || 0);
  d.fill((x, y) => {
    const f = y % fh; let k = f === fh - 1 ? 0 : f === 0 ? 3 : 2;
    const pinch = o.pinch === 'w' ? x : o.pinch === 'e' ? d.w - 1 - x : 99;
    if (pinch < 4 && f !== fh - 1 && ((x + y) % 3 === 0)) k = 1;
    if (hsh(x >> 1, y, s) < 0.08) k = Math.max(1, k - 1);
    if (k === 3 && hsh(x, y, s + 2) < 0.12) k = 4;
    return [ramp, k];
  });
  if (o.stitch) for (let x = 1; x < d.w; x += 2) { d.px(x, 0, ...o.stitch); d.px(x, d.h - 1, ...o.stitch); }
}

// Hand-laid clay daub: the lit surface is assumed painted; this adds layer lines every o.layer texels,
// finger smears (short lit strokes) and branching hairline cracks.
export function clayDaub(d, ramp, o = {}) {
  const s = d.seed + (o.seed || 0);
  if (o.layer) for (let y = o.layer - 1; y < d.h; y += o.layer) for (let x = 0; x < d.w; x++) if (hsh(x >> 2, y, s) > 0.25) d.px(x, y, ramp, 1);
  for (let q = 0; q < (o.smears ?? Math.round(d.w * d.h / 40)); q++) {
    const x = Math.floor(hsh(q, 1, s) * d.w), y = Math.floor(hsh(q, 2, s) * d.h);
    d.px(x, y, ramp, 3); d.px(x + 1, y, ramp, 3); d.px(x + 2, y + 1, ramp, 2);
  }
  cracks(d, ramp, o.cracks ?? Math.max(1, Math.round(d.w * d.h / 120)), { seed: s + 7 });
}

// Branching hairline cracks: random walks of 4-9 texels in shade 0 with a lit texel beside the start.
export function cracks(d, ramp, n, o = {}) {
  const s = (o.seed || 0) + d.seed;
  for (let q = 0; q < n; q++) {
    let x = Math.floor(hsh(q, 11, s) * d.w), y = Math.floor(hsh(q, 12, s) * d.h);
    const len = 4 + Math.floor(hsh(q, 13, s) * 6), dir = hsh(q, 14, s) < 0.5 ? 1 : -1;
    d.px(x - 1, y, ramp, 4);
    for (let t = 0; t < len; t++) {
      d.px(x, y, ramp, 0);
      const r = hsh(q, t, s + 15);
      if (r < 0.45) y++; else if (r < 0.8) x += dir; else { x += dir; y++; }
      if (t === 3 && hsh(q, 16, s) < 0.5) d.px(x - dir, y + 1, ramp, 0);
    }
  }
}

// Wrought iron strap along u ('h') or v ('v'), 2-3 texels: lit edge, body, shadow edge, rivet heads every `step`.
export function strap(d, x, y, len, ramp, o = {}) {
  const v = o.dir === 'v', wdt = o.width || 2, step = o.step || 4;
  for (let t = 0; t < len; t++) for (let c = 0; c < wdt; c++) {
    const [i, j] = v ? [x + c, y + t] : [x + t, y + c];
    const k = c === 0 ? 3 : c === wdt - 1 ? 1 : 2;
    d.px(i, j, ramp, hsh(t, c, d.seed + 31) < 0.1 ? k - 1 : k);
  }
  for (let t = o.phase ?? 1; t < len; t += step) {
    const [i, j] = v ? [x + ((wdt - 1) >> 1), y + t] : [x + t, y + ((wdt - 1) >> 1)];
    d.px(i, j, ramp, 4); d.px(i + (v ? 1 : 0), j + (v ? 0 : 1), ramp, 0);
  }
}

// ---------------------------------------------------------------- geometry

const AX = { x: 0, y: 1, z: 2 };
// a point (u, v) in the plane across `axis` rotated by `deg` in the kit's sense (+x lifts -z, +z lifts +x, +y turns +x to -z)
function rot2(u, v, deg) { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [u * c - v * s, u * s + v * c]; }

// A polygon rim of `n` straight segments (wheel rims, tyres, hoops) around axis `axis` through `c`, between
// radii rIn and rOut, `depth` along the axis. Segments are one compound `${name}#k` from o.start; they
// alternate 0.02 px in depth so their overlapping corners do not z-fight. o.phase: angle of the first (deg).
export function rim(b, name, c, axis, rIn, rOut, n, depth, mat, o = {}) {
  const k = AX[axis], [p, q] = [0, 1, 2].filter((i) => i !== k), half = rOut * Math.tan(Math.PI / n), out = [];
  for (let i = 0; i < n; i++) {
    const dd = depth / 2 - (i & 1) * 0.02, from = [...c], to = [...c];
    from[k] = c[k] - dd; to[k] = c[k] + dd;
    // unrotated segment on the +p side (for axis x: +y, the top), tangent along q
    from[p] = c[p] + rIn; to[p] = c[p] + rOut; from[q] = c[q] - half; to[q] = c[q] + half;
    const r = [0, 0, 0]; r[k] = (o.phase || 0) + (i * 360) / n;
    out.push(b.box(`${name}#${(o.start || 1) + i}`, from, to, o.mats ? o.mats[i % o.mats.length] : mat, { origin: c, rotation: r, hide: o.hide }));
  }
  return out;
}

// `n` radial boards (paddles, buckets, spokes that stop at a hub) from r0 to r1, `thick` across, `depth`
// along the axis. Same naming and phase rules as rim().
export function radial(b, name, c, axis, r0, r1, n, thick, depth, mat, o = {}) {
  const k = AX[axis], [p, q] = [0, 1, 2].filter((i) => i !== k), out = [];
  for (let i = 0; i < n; i++) {
    const from = [...c], to = [...c];
    from[k] = c[k] - depth / 2; to[k] = c[k] + depth / 2;
    from[p] = c[p] + r0; to[p] = c[p] + r1; from[q] = c[q] - thick / 2; to[q] = c[q] + thick / 2;
    const r = [0, 0, 0]; r[k] = (o.phase || 0) + (i * 360) / n;
    out.push(b.box(`${name}#${(o.start || 1) + i}`, from, to, o.mats ? o.mats[i % o.mats.length] : mat, { origin: c, rotation: r, hide: o.hide }));
  }
  return out;
}

// Cam follower lift: how far above the shaft axis the cam outline reaches (its support in +p, the first
// in-plane axis: +y for a shaft along x or z) when the cam has turned by `deg`. `rects` are the cam's
// boxes as [pc, qc, halfP, halfQ, restDeg] around the axis (a prism slab is [0, 0, r, r·tan(π/n), i·180/n]).
// A follower resting on it at `base + support(deg)` touches it at every angle: no gap, no penetration.
export function camSupport(rects, deg) {
  let m = -Infinity;
  for (const [pc, qc, hp, hq, r0] of rects) for (const [sp, sq] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const [u0, v0] = rot2(sp * hp, sq * hq, r0 || 0);
    const [u, v] = rot2(pc + u0, qc + v0, deg);
    m = Math.max(m, u); void v;
  }
  return m;
}
