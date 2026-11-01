// Blockbench .bbmodel -> three.js, with deterministic animation sampling.
// Supports what Arffornia models use: cuboids with per-face UVs on one or more textures,
// element rotation around an origin, nested groups (bones) with pivots, and Blockbench
// animations (position / rotation / scale keyframes, linear, step and catmullrom).
// Units: 16 Blockbench pixels = 1 block = 1 three.js unit.
import * as THREE from 'three';

export const PX = 1 / 16;

// Each face: corners [top-left, top-right, bottom-left, bottom-right] as seen from outside,
// matching Blockbench's UV orientation (u to the right, v down).
const FACES = {
  south: (a, b) => [[a[0], b[1], b[2]], [b[0], b[1], b[2]], [a[0], a[1], b[2]], [b[0], a[1], b[2]]],
  north: (a, b) => [[b[0], b[1], a[2]], [a[0], b[1], a[2]], [b[0], a[1], a[2]], [a[0], a[1], a[2]]],
  east: (a, b) => [[b[0], b[1], b[2]], [b[0], b[1], a[2]], [b[0], a[1], b[2]], [b[0], a[1], a[2]]],
  west: (a, b) => [[a[0], b[1], a[2]], [a[0], b[1], b[2]], [a[0], a[1], a[2]], [a[0], a[1], b[2]]],
  up: (a, b) => [[a[0], b[1], a[2]], [b[0], b[1], a[2]], [a[0], b[1], b[2]], [b[0], b[1], b[2]]],
  down: (a, b) => [[a[0], a[1], b[2]], [b[0], a[1], b[2]], [a[0], a[1], a[2]], [b[0], a[1], a[2]]],
};

function cuboidGeometry(el, res, groupOrigin) {
  const pos = [], uv = [], nor = [], idx = [], groups = [];
  const a = el.from.map((v, i) => (v - groupOrigin[i]) * PX), b = el.to.map((v, i) => (v - groupOrigin[i]) * PX);
  let n = 0;
  for (const [name, corners] of Object.entries(FACES)) {
    const f = el.faces && el.faces[name];
    if (!f || f.texture === null || f.texture === undefined) continue;
    const c = corners(a, b);
    const [u0, v0, u1, v1] = f.uv || [0, 0, 1, 1];
    const tw = res.width, th = res.height;
    const uvs = [[u0 / tw, 1 - v0 / th], [u1 / tw, 1 - v0 / th], [u0 / tw, 1 - v1 / th], [u1 / tw, 1 - v1 / th]];
    const e1 = new THREE.Vector3(...c[2]).sub(new THREE.Vector3(...c[0]));
    const e2 = new THREE.Vector3(...c[1]).sub(new THREE.Vector3(...c[0]));
    const nn = e1.cross(e2).normalize();
    const start = idx.length;
    for (let k = 0; k < 4; k++) { pos.push(...c[k]); uv.push(...uvs[k]); nor.push(nn.x, nn.y, nn.z); }
    idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    groups.push([start, 6, Number(f.texture) || 0]);
    n += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  for (const [s, c, m] of groups) g.addGroup(s, c, m);
  return g;
}

// Emissive mask: saturated, bright texels (light strips, molten metal, screens) glow.
export function emissiveFrom(img, { sat = 0.45, val = 0.55 } = {}) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i] / 255, g = d.data[i + 1] / 255, b = d.data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
    const k = s > sat && mx > val ? Math.min(1, (s - sat) / 0.25) * Math.min(1, (mx - val) / 0.2) : 0;
    d.data[i] *= k; d.data[i + 1] *= k; d.data[i + 2] *= k; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}

export async function loadImage(src) {
  const img = new Image(); img.src = src; await img.decode(); return img;
}

// Build a three.js object. Returns { root, bones: Map(name -> Object3D with userData.rest), json }.
export async function buildModel(json, { emissive = true, material = {} } = {}) {
  const res = json.resolution || { width: 16, height: 16 };
  const mats = [];
  for (const t of json.textures || []) {
    const img = await loadImage(t.source);
    const map = new THREE.Texture(img); map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestMipmapLinearFilter; map.needsUpdate = true;
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0.18, ...material });
    if (emissive) { const em = new THREE.CanvasTexture(emissiveFrom(img)); em.colorSpace = THREE.SRGBColorSpace; em.magFilter = THREE.NearestFilter; m.emissiveMap = em; m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = 1.6; }
    mats.push(m);
  }
  if (!mats.length) mats.push(new THREE.MeshStandardMaterial({ color: 0x8a9aa6 }));
  const byId = new Map((json.elements || []).map((e) => [e.uuid, e]));
  const bones = new Map();
  const root = new THREE.Group(); root.name = json.name || 'model';
  const deg = THREE.MathUtils.degToRad;

  const addElement = (el, parent, origin) => {
    if (el.visibility === false || el.type && el.type !== 'cube') return;
    const geo = cuboidGeometry(el, res, el.origin || origin);
    // naming convention: elements called glass* are translucent (Blockbench has no material model)
    const glass = /^glass/i.test(el.name);
    const mesh = new THREE.Mesh(geo, glass ? mats.map((m) => { const g = m.clone(); g.transparent = true; g.opacity = 0.22; g.depthWrite = false; g.emissiveIntensity = 0; g.roughness = 0.1; g.metalness = 0.3; return g; }) : mats);
    if (glass) mesh.renderOrder = 2;
    mesh.name = el.name; mesh.castShadow = !glass; mesh.receiveShadow = true;
    const o = el.origin || origin;
    mesh.position.set((o[0] - origin[0]) * PX, (o[1] - origin[1]) * PX, (o[2] - origin[2]) * PX);
    if (el.rotation) mesh.rotation.set(deg(el.rotation[0] || 0), deg(el.rotation[1] || 0), deg(el.rotation[2] || 0), 'ZYX');
    parent.add(mesh);
  };
  const addNode = (node, parent, parentOrigin) => {
    if (typeof node === 'string') { const el = byId.get(node); if (el) addElement(el, parent, parentOrigin); return; }
    const g = new THREE.Group(); g.name = node.name;
    const o = node.origin || [0, 0, 0];
    g.position.set((o[0] - parentOrigin[0]) * PX, (o[1] - parentOrigin[1]) * PX, (o[2] - parentOrigin[2]) * PX);
    if (node.rotation) g.rotation.set(deg(node.rotation[0] || 0), deg(node.rotation[1] || 0), deg(node.rotation[2] || 0), 'ZYX');
    g.userData.rest = { p: g.position.clone(), r: g.rotation.clone(), s: g.scale.clone() };
    bones.set(node.name, g);
    for (const ch of node.children || []) addNode(ch, g, o);
    parent.add(g);
  };
  const outliner = json.outliner && json.outliner.length ? json.outliner : (json.elements || []).map((e) => e.uuid);
  for (const n of outliner) addNode(n, root, [0, 0, 0]);
  return { root, bones, json };
}

// --- animation sampling -------------------------------------------------------------
const num = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0); // Molang expressions are not supported
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
export function sampleChannel(kfs, t) {
  if (!kfs.length) return null;
  const v = (k) => [num(k.data_points[0].x), num(k.data_points[0].y), num(k.data_points[0].z)];
  if (t <= kfs[0].time) return v(kfs[0]);
  if (t >= kfs[kfs.length - 1].time) return v(kfs[kfs.length - 1]);
  let i = 0; while (i < kfs.length - 1 && kfs[i + 1].time < t) i++;
  const a = kfs[i], b = kfs[i + 1]; const u = (t - a.time) / Math.max(1e-9, b.time - a.time);
  if (a.interpolation === 'step') return v(a);
  if (a.interpolation === 'catmullrom' || b.interpolation === 'catmullrom') {
    const p0 = v(kfs[Math.max(0, i - 1)]), p1 = v(a), p2 = v(b), p3 = v(kfs[Math.min(kfs.length - 1, i + 2)]);
    return [0, 1, 2].map((k) => catmull(p0[k], p1[k], p2[k], p3[k], u));
  }
  const A = v(a), B = v(b); return [0, 1, 2].map((k) => A[k] + (B[k] - A[k]) * u);
}

// Pose the model at time t (seconds) for the named animation (or the first one). Pure: same t, same pose.
// Blockbench convention: position x and rotation x/y are negated when applied.
export function pose(model, t, animName) {
  const anims = model.json.animations || [];
  for (const g of model.bones.values()) { const r = g.userData.rest; g.position.copy(r.p); g.rotation.copy(r.r); g.scale.copy(r.s); }
  const an = animName ? anims.find((a) => a.name === animName) : anims[0];
  if (!an) return;
  const L = an.length || 1; const tt = an.loop === 'loop' ? ((t % L) + L) % L : Math.min(t, L);
  const deg = THREE.MathUtils.degToRad;
  for (const a of Object.values(an.animators || {})) {
    const g = model.bones.get(a.name); if (!g) continue;
    const ch = (c) => (a.keyframes || []).filter((k) => k.channel === c).sort((x, y) => x.time - y.time);
    const p = sampleChannel(ch('position'), tt), r = sampleChannel(ch('rotation'), tt), s = sampleChannel(ch('scale'), tt);
    if (p) { g.position.x -= p[0] * PX; g.position.y += p[1] * PX; g.position.z += p[2] * PX; }
    if (r) { g.rotation.x -= deg(r[0]); g.rotation.y -= deg(r[1]); g.rotation.z += deg(r[2]); }
    if (s) g.scale.set(s[0], s[1], s[2]);
  }
}

export function animLength(json, animName) {
  const an = (json.animations || []).find((a) => !animName || a.name === animName);
  return an ? an.length : 0;
}

// Bake an animation to a three.js AnimationClip (sampled at fps) for glTF export.
export function bakeClip(model, animName, fps = 30) {
  const an = (model.json.animations || []).find((a) => !animName || a.name === animName);
  if (!an) return null;
  const n = Math.max(2, Math.round(an.length * fps) + 1);
  const times = Array.from({ length: n }, (_, i) => (i / (n - 1)) * an.length);
  const tracks = [];
  const names = Object.values(an.animators || {}).map((a) => a.name).filter((nm) => model.bones.has(nm));
  const data = Object.fromEntries(names.map((nm) => [nm, { p: [], q: [] }]));
  for (const t of times) {
    pose(model, Math.min(t, an.length - 1e-6), an.name);
    for (const nm of names) { const g = model.bones.get(nm); data[nm].p.push(g.position.x, g.position.y, g.position.z); data[nm].q.push(...new THREE.Quaternion().setFromEuler(g.rotation).toArray()); }
  }
  for (const nm of names) {
    tracks.push(new THREE.VectorKeyframeTrack(`${nm}.position`, times, data[nm].p));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${nm}.quaternion`, times, data[nm].q));
  }
  pose(model, 0, an.name);
  return new THREE.AnimationClip(an.name, an.length, tracks);
}
