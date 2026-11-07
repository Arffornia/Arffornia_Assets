// Helpers written for the levitation smelter; candidates for tools/pix/parts.mjs once reviewed.
// Units are px, angles in degrees, the kit's world sense (+z rotation lifts the +x end).

const RAD = Math.PI / 180;

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Planar two-link arm (shoulder S, target wrist T, both [u, v] in the arm plane). elbow: 'up' (higher v),
// 'left' (smaller u) or 'right': keep one side along a path, or the arm flips between branches.
// Returns global link angles (deg, ccw from +u) and the elbow point.
export function ik2(S, T, L1, L2, elbow = 'up') {
  const dx = T[0] - S[0], dy = T[1] - S[1], d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1e-6);
  const phi = Math.atan2(dy, dx), a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const pick = [phi + a, phi - a].map((A1) => ({ A1, E: [S[0] + L1 * Math.cos(A1), S[1] + L1 * Math.sin(A1)] })).sort((p, q) => (elbow === 'left' ? p.E[0] - q.E[0] : elbow === 'right' ? q.E[0] - p.E[0] : q.E[1] - p.E[1]))[0];
  const A2 = Math.atan2(T[1] - pick.E[1], T[0] - pick.E[0]);
  return { A1: pick.A1 / RAD, A2: A2 / RAD, elbow: pick.E };
}

// Joint angles for an arm modelled at rest with the upper link at restA1 and the forearm at restA2 (global
// deg), and a tool that the wrist keeps at its rest orientation. Angles come wrapped to (-180, 180]:
// pass the poses through unwrapPoses before keying them.
export function armAngles(S, T, L1, L2, restA1 = 90, restA2 = 180, elbow = 'up') {
  const { A1, A2 } = ik2(S, T, L1, L2, elbow);
  const wrap = (a) => ((a + 540) % 360) - 180;
  const sh = wrap(A1 - restA1), el = wrap(A2 - A1 - (restA2 - restA1));
  return { shoulder: sh, elbow: el, wrist: -(sh + el) };
}

// Keyframe track for one channel and axis from poses [[t, value], ...], eased between keys and sampled
// every `step` s, so the lint (linear sampler) sees the same smooth motion as the game.
export function track(keys, axis = 'x', channel = 'rotation', o = {}) {
  const k = { x: 0, y: 1, z: 2 }[axis], step = o.step ?? 0.1, out = [];
  const vec = (v) => { const r = [0, 0, 0]; r[k] = +v.toFixed(3); return r; };
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1], n = Math.max(1, Math.round((t1 - t0) / step));
    for (let q = 0; q < n; q++) { const t = t0 + ((t1 - t0) * q) / n; out.push([+t.toFixed(3), vec(v0 + (v1 - v0) * (o.linear ? q / n : ease(q / n)))]); }
  }
  const last = keys[keys.length - 1]; out.push([last[0], vec(last[1])]);
  return { [channel]: out };
}

// `count` boxes standing on a circle of radius r round the vertical axis through c, each turned to face
// the centre (crucible fingers, bolt rings, pylons). size: [radial, height, tangential]. o.phase in deg.
export function ringOfBoxes(b, name, c, r, count, size, mat, o = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (o.phase || 0) + (i * 360) / count, x = c[0] + r * Math.cos(a * RAD), z = c[2] - r * Math.sin(a * RAD);
    const h = [size[0] / 2, 0, size[2] / 2];
    out.push(b.box(`${name}#${(o.start || 1) + i}`, [x - h[0], c[1], z - h[2]], [x + h[0], c[1] + size[1], z + h[2]], typeof mat === 'function' ? mat(i) : mat, { origin: [x, c[1], z], rotation: [0, a, 0] }));
  }
  return out;
}

// A voxel sphere of three crossed boxes (a 'plus' ball that reads round at Minecraft scale).
export function voxelBall(b, name, c, r, mat, o = {}) {
  const s = o.flat ?? Math.round(r * 0.75);
  return [[r, s, s], [s, r, s], [s, s, r]].map((e, i) => b.box(`${name}#${i + 1}`, c.map((v, q) => v - e[q] + i * 0.01), c.map((v, q) => v + e[q] - i * 0.01), mat));
}

// A sequence of poses ({ joint: deg }) made continuous: each angle takes the 360-multiple nearest the
// previous pose, so an elbow going from -133 to -215 does not swing the long way round through +145.
export function unwrapPoses(poses) {
  const out = [];
  for (const p of poses) {
    const prev = out[out.length - 1], q = {};
    for (const [j, v] of Object.entries(p)) q[j] = prev && prev[j] !== undefined ? v + 360 * Math.round((prev[j] - v) / 360) : v;
    out.push(q);
  }
  return out;
}
