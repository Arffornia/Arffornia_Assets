// Helpers from smelter_arc (tier 4, electric arc furnace). Candidates for tools/pix/pix.mjs or parts.mjs.

// round gauge: steel bezel, pale face, a dark needle; s = diameter in texels (>= 4). Ramps: bezel, needle.
export function dial(d, x, y, s, o = {}) {
  const c = (s - 1) / 2, ang = ((o.angle ?? 40) * Math.PI) / 180, bz = o.bezel || 'bs';
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const r = Math.hypot(i - c, j - c); if (r > c + 0.5) continue;
    if (r > c - 0.6) d.px(x + i, y + j, bz, j < c ? 4 : 1);
    else d.px(x + i, y + j, bz, j > c + 0.5 ? 3 : 4);
  }
  for (let t = 0; t < c - 0.6; t += 0.5) d.px(x + Math.round(c + Math.cos(ang) * t), y + Math.round(c - Math.sin(ang) * t), o.needle || 'ink', 0);
}

// a row (or column, o.dir 'v') of status LEDs in a dark bezel; on(i) decides lit (o.ramp, glowing) or dim
export function leds(d, x, y, n, on = () => true, o = {}) {
  const v = o.dir === 'v';
  d.rect(x - 1, y - 1, v ? 3 : 2 * n + 1, v ? 2 * n + 1 : 3, o.bezel || 'ink', 1);
  for (let i = 0; i < n; i++) { const [px, py] = v ? [x, y + 2 * i] : [x + 2 * i, y]; if (on(i)) d.px(px, py, o.ramp || 'led', i % 3 === 2 ? 3 : 4); else d.px(px, py, o.dim || 'bg', 2); }
}

// Materials for each slab of a `b.prism`, so caps painted with d.radial line up across slabs: slab i is
// turned by i*360/sides, and design(i, rot) receives the angle offset to pass as radial's `rot`.
// Use: const ms = slabMats(mat, 12, (i, rot) => mat(...)); b.prism(name, c, r, len, axis, ms[0], 12, { mats: ms }).
export function slabMats(sides, design) {
  return Array.from({ length: sides / 2 }, (_, i) => design(i, (i * 360) / sides));
}

// eased keyframes for b.anim: value v(t) from a to b between t0 and t1, `n` samples; vec(x) builds the [x,y,z]
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export function tween(t0, t1, a, b, vec, n = 12) {
  return Array.from({ length: n + 1 }, (_, q) => [+(t0 + ((t1 - t0) * q) / n).toFixed(4), vec(a + (b - a) * ease(q / n))]);
}
// stepped track: list of [time, value, ramp?]: the value is reached at `time`, eased over `ramp` seconds
// (default 0.12) and held until the next entry (a servo moving in steps)
export function steps(list, vec, ramp = 0.12) {
  const out = [[list[0][0], vec(list[0][1])]];
  for (let i = 1; i < list.length; i++) {
    const [t, v, rp = ramp] = list[i], pv = list[i - 1][1];
    if (v === pv) { out.push([t, vec(v)]); continue; }
    out.push(...tween(t - rp, t, pv, v, vec, Math.max(2, Math.round(rp / 0.05))));
  }
  return out.filter((k, i, a) => i === 0 || k[0] > a[i - 1][0] + 1e-4);
}
