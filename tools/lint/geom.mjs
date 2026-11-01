// Geometry for the model lint: a .bbmodel posed in node (no browser), each element as an
// oriented box (OBB) in block units, and the tests the checks need (SAT overlap with
// penetration depth, containment, coplanar faces).
//
// The skeleton mirrors render/bbmodel.js exactly (same pivots, same Euler order, same animation
// sampler), so what the lint sees is what the renderer draws.
import * as THREE from 'three';
import { PX, pose } from '../../render/bbmodel.js';
export { PX };

const deg = THREE.MathUtils.degToRad;
export const TOL = 0.02 * PX; // 0.02 Blockbench px: below this, two parts touch rather than overlap

// Element name conventions (documented in docs/MODEL-RULES.md):
//   stem#n      parts of one compound solid (an octagonal tank built from two boxes); they may overlap
//   port_<id>   the collar of port <id> declared in arffornia.ports
//   glass*      translucent (renderer convention)
export const stemOf = (name) => (name || '').split('#')[0];

// Build a posable skeleton: { root, bones: Map(name -> Group), json, elements: [{ el, obj, bone }] }
export function skeleton(json) {
  const byId = new Map((json.elements || []).map((e) => [e.uuid, e]));
  const bones = new Map();
  const elements = [];
  const root = new THREE.Group();
  const addElement = (el, parent, origin, bone) => {
    if (el.visibility === false || (el.type && el.type !== 'cube')) return;
    const o = el.origin || origin;
    const obj = new THREE.Object3D();
    obj.position.set((o[0] - origin[0]) * PX, (o[1] - origin[1]) * PX, (o[2] - origin[2]) * PX);
    if (el.rotation) obj.rotation.set(deg(el.rotation[0] || 0), deg(el.rotation[1] || 0), deg(el.rotation[2] || 0), 'ZYX');
    parent.add(obj);
    const inf = el.inflate || 0;
    const a = el.from.map((v, i) => (v - inf - o[i]) * PX), b = el.to.map((v, i) => (v + inf - o[i]) * PX);
    elements.push({ el, name: el.name, obj, bone, a, b });
  };
  const addNode = (node, parent, parentOrigin, bone) => {
    if (typeof node === 'string') { const el = byId.get(node); if (el) addElement(el, parent, parentOrigin, bone); return; }
    const g = new THREE.Group(); g.name = node.name;
    const o = node.origin || [0, 0, 0];
    g.position.set((o[0] - parentOrigin[0]) * PX, (o[1] - parentOrigin[1]) * PX, (o[2] - parentOrigin[2]) * PX);
    if (node.rotation) g.rotation.set(deg(node.rotation[0] || 0), deg(node.rotation[1] || 0), deg(node.rotation[2] || 0), 'ZYX');
    g.userData.rest = { p: g.position.clone(), r: g.rotation.clone(), s: g.scale.clone() };
    bones.set(node.name, g);
    for (const ch of node.children || []) addNode(ch, g, o, node.name);
    parent.add(g);
  };
  const outliner = json.outliner && json.outliner.length ? json.outliner : (json.elements || []).map((e) => e.uuid);
  for (const n of outliner) addNode(n, root, [0, 0, 0], null);
  // which bone actually moves each element: the nearest animated ancestor (null = static)
  const animated = new Set();
  for (const an of json.animations || []) for (const a of Object.values(an.animators || {})) if ((a.keyframes || []).length) animated.add(a.name);
  for (const e of elements) {
    let n = e.obj.parent; e.mover = null;
    while (n && n !== root) { if (n.isGroup && animated.has(n.name)) { e.mover = n.name; break; } n = n.parent; }
  }
  return { root, bones, json, elements, animated };
}

export function poseAt(sk, t, animName) {
  pose(sk, t, animName);
  sk.root.updateMatrixWorld(true);
}

// OBB of every element in the current pose: centre c, unit axes u[3], half extents e[3] (blocks)
export function obbs(sk) {
  return sk.elements.map((x) => {
    const m = x.obj.matrixWorld;
    const cl = new THREE.Vector3((x.a[0] + x.b[0]) / 2, (x.a[1] + x.b[1]) / 2, (x.a[2] + x.b[2]) / 2).applyMatrix4(m);
    const cols = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    m.extractBasis(cols[0], cols[1], cols[2]);
    const e = [0, 1, 2].map((k) => Math.abs(x.b[k] - x.a[k]) / 2 * cols[k].length());
    const u = cols.map((v) => v.clone().normalize());
    return { name: x.name, c: cl, u, e, x };
  });
}

export function aabb(o) {
  const ext = [0, 1, 2].map((k) => o.e[0] * Math.abs(o.u[0].getComponent(k)) + o.e[1] * Math.abs(o.u[1].getComponent(k)) + o.e[2] * Math.abs(o.u[2].getComponent(k)));
  return { min: [o.c.x - ext[0], o.c.y - ext[1], o.c.z - ext[2]], max: [o.c.x + ext[0], o.c.y + ext[1], o.c.z + ext[2]] };
}

// Separating-axis test. Returns the smallest overlap over all candidate axes:
// < 0 means separated by that gap, ~0 touching, > 0 the penetration depth (blocks).
export function sat(A, B) {
  const T = B.c.clone().sub(A.c);
  let best = Infinity;
  const test = (L) => {
    const len = L.length(); if (len < 1e-6) return; L.multiplyScalar(1 / len);
    const rA = A.e[0] * Math.abs(A.u[0].dot(L)) + A.e[1] * Math.abs(A.u[1].dot(L)) + A.e[2] * Math.abs(A.u[2].dot(L));
    const rB = B.e[0] * Math.abs(B.u[0].dot(L)) + B.e[1] * Math.abs(B.u[1].dot(L)) + B.e[2] * Math.abs(B.u[2].dot(L));
    const ov = rA + rB - Math.abs(T.dot(L));
    if (ov < best) best = ov;
  };
  for (let i = 0; i < 3; i++) test(A.u[i].clone());
  for (let i = 0; i < 3; i++) test(B.u[i].clone());
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) test(new THREE.Vector3().crossVectors(A.u[i], B.u[j]));
  return best;
}

export function corners(o) {
  const out = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(o.c.clone().addScaledVector(o.u[0], sx * o.e[0]).addScaledVector(o.u[1], sy * o.e[1]).addScaledVector(o.u[2], sz * o.e[2]));
  }
  return out;
}

// A entirely inside B
export function contains(B, A, tol = TOL) {
  return corners(A).every((p) => { const d = p.clone().sub(B.c); return [0, 1, 2].every((k) => Math.abs(d.dot(B.u[k])) <= B.e[k] + tol); });
}

export const volume = (o) => 8 * o.e[0] * o.e[1] * o.e[2];

// The six faces of an OBB with their element face name, outward normal, centre and in-plane frame.
const FACE_AXES = { east: [0, 1], west: [0, -1], up: [1, 1], down: [1, -1], south: [2, 1], north: [2, -1] };
export function faces(o) {
  return Object.entries(FACE_AXES).map(([name, [k, s]]) => {
    const n = o.u[k].clone().multiplyScalar(s);
    const c = o.c.clone().addScaledVector(n, o.e[k]);
    const [i, j] = [0, 1, 2].filter((q) => q !== k);
    return { name, n, c, u: o.u[i], v: o.u[j], hu: o.e[i], hv: o.e[j], k };
  });
}

// Two coplanar rectangles with parallel normals: overlap area in the plane (2D SAT on 4 axes).
export function coplanarOverlap(f, g) {
  const proj = (F, ax) => { const c = F.c.dot(ax); const r = F.hu * Math.abs(F.u.dot(ax)) + F.hv * Math.abs(F.v.dot(ax)); return [c - r, c + r]; };
  let area = 1;
  const axes = [f.u, f.v, g.u, g.v];
  let minOv = Infinity;
  for (const ax of axes) { const [a0, a1] = proj(f, ax), [b0, b1] = proj(g, ax); const ov = Math.min(a1, b1) - Math.max(a0, b0); if (ov <= 1e-6) return 0; minOv = Math.min(minOv, ov); }
  // exact when the rectangles are aligned (the common case); a lower bound otherwise
  const [a0, a1] = proj(f, f.u), [b0, b1] = proj(g, f.u), [c0, c1] = proj(f, f.v), [d0, d1] = proj(g, f.v);
  area = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) * Math.max(0, Math.min(c1, d1) - Math.max(c0, d0));
  return Math.min(area, minOv * minOv * 4) > 0 ? area : 0;
}

// Convex hull (monotone chain) of 2D points, counter-clockwise.
export function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// Signed distance from a point to the inside of a convex CCW polygon (> 0 inside).
export function insideDistance(poly, q) {
  if (poly.length < 3) return -Infinity;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1;
    d = Math.min(d, ((q[1] - a[1]) * ex - (q[0] - a[0]) * ey) / L);
  }
  return d;
}
