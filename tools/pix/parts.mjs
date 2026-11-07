// Geometry helpers for pixel-art machines: compound parts that need the kit Model `b`.
// Units are px. Every helper names its cubes `${name}#k` (one compound) and returns them.

const AX = { x: 0, y: 1, z: 2 };

// A straight square pipe from `a` along `axis` (signed length), with 1 px larger flange rings every
// `every` px (o.first: offset of the first, o.ends: also at both ends). o.flange: ring material.
export function pipe(b, name, a, axis, len, size, mat, o = {}) {
  const k = AX[axis], s = Math.sign(len) || 1, L = Math.abs(len), lip = o.lip ?? 1, out = [];
  const box = (t0, t1, grow, m, hide) => {
    const from = [...a], to = [...a];
    for (let q = 0; q < 3; q++) if (q !== k) { from[q] = a[q] - grow; to[q] = a[q] + size + grow; }
    from[k] = a[k] + s * t0; to[k] = a[k] + s * t1;
    return b.box(`${name}#${out.length + 1}`, from, to, m, { hide });
  };
  // end flanges cover the pipe's end faces: hide those so they do not z-fight
  out.push(box(0, L, 0, mat, o.ends ? [['west', 'east'], ['down', 'up'], ['north', 'south']][k] : []));
  const at = [];
  if (o.ends) at.push(0, L - 1);
  if (o.every) for (let t = o.first ?? o.every; t < L - 1; t += o.every) at.push(t);
  for (const t of at.sort((p, q) => p - q)) out.push(box(t, t + (o.width || 1), lip, o.flange || mat));
  return out;
}

// Spur-gear teeth around an axis: `count` bars through the centre (two teeth each), `tip` = outer
// radius, `thick` along the axis, `width` across the tooth. The 0.01 px shrink per bar keeps coplanar
// faces apart. o.start: first compound index, o.phase: rotation of the first bar (deg).
export function teeth(b, name, c, axis, tip, count, thick, width, mat, o = {}) {
  const k = AX[axis], other = [0, 1, 2].filter((q) => q !== k), out = [];
  for (let i = 0; i < count; i++) {
    const ext = []; ext[k] = thick / 2 - i * 0.01; ext[other[0]] = tip; ext[other[1]] = width / 2;
    const rot = [0, 0, 0]; rot[k] = (o.phase || 0) + (i * 180) / count;
    out.push(b.box(`${name}#${(o.start || 1) + i}`, c.map((v, q) => v - ext[q]), c.map((v, q) => v + ext[q]), mat, { origin: c, rotation: rot }));
  }
  return out;
}
