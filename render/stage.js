// The render stage: one three.js scene that renders a model or a scene file at time t.
// Driven by render/build.mjs through Playwright (window.STAGE), or opened by hand in a browser
// (render/stage.html?model=miner or ?scene=factory-line) for a live preview.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildModel, pose, bakeClip, animLength } from './bbmodel.js';

// Looks: the art direction knobs. "night" matches the Night Shift previews, "maquette" the light ones.
export const LOOKS = {
  night: { bg: ['#0b1116', '#101b22', '#16222a'], fog: '#0d161c', ground: '#121b21', grid: '#2fd1c1', gridA: 0.07,
    hemi: ['#9db4c2', '#1a242b', 1.7], key: ['#ffe9d6', 3.6], rim: ['#2fd1c1', 1.4], fill: ['#c9d6de', 0.9], bloom: [0.5, 0.45, 0.85], exposure: 1.3, emissive: 1.6 },
  maquette: { bg: ['#f4f6f7', '#e9eef1', '#dfe6ea'], fog: '#e9eef1', ground: '#e3e9ed', grid: '#46606f', gridA: 0.1,
    hemi: ['#ffffff', '#b8c5cd', 1.6], key: ['#ffffff', 2.4], rim: ['#cfe3e1', 0.6], fill: ['#ffffff', 0.4], bloom: [0.18, 0.4, 0.92], exposure: 1.0, emissive: 0.9 },
};

const BELT_V = 0.9, GAP = 1.5;
const ITEM = { ore: '#5b4a42', ingot: '#e0703c', plate: '#b9c6cf', rod: '#7f909c', rplate: '#d6dee4', pkg: '#e0703c' };

let R, scene, camera, composer, bloom, models = [], belts = [], opts, root;

function gradientTexture(cols, w = 4, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function beltTexture(look) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32; const x = c.getContext('2d');
  x.fillStyle = look === 'night' ? '#141c22' : '#5d6e78'; x.fillRect(0, 0, 64, 32);
  x.strokeStyle = look === 'night' ? '#46566060' : '#8fa0aa'; x.lineWidth = 3;
  for (const s of [0, 32]) { x.beginPath(); x.moveTo(s + 4, 4); x.lineTo(s + 13, 16); x.lineTo(s + 4, 28); x.stroke(); }
  x.fillStyle = '#8a9aa6'; x.fillRect(0, 0, 64, 3); x.fillRect(0, 29, 64, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t;
}

function groundGrid(L, radius = 90) {
  const g = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshStandardMaterial({ color: L.ground, roughness: 0.95 }));
  plane.rotation.x = -Math.PI / 2; plane.position.y = -0.33; plane.receiveShadow = true; g.add(plane);
  const pts = []; for (let k = -radius; k <= radius; k++) { pts.push(k, -0.32, -radius, k, -0.32, radius, -radius, -0.32, k, radius, -0.32, k); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: L.grid, transparent: true, opacity: L.gridA })));
  return g;
}

function slab(x, y, w, d, look) {
  const L = LOOKS[look];
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, d), new THREE.MeshStandardMaterial({ color: look === 'night' ? '#1a252d' : '#e3e9ed', roughness: 0.9 }));
  m.position.set(x + w / 2, -0.16, y + d / 2); m.receiveShadow = true; m.castShadow = false;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.002, 0.05, d + 0.002), new THREE.MeshStandardMaterial({ color: '#e0703c', emissive: '#e0703c', emissiveIntensity: look === 'night' ? 0.6 : 0.1 }));
  edge.position.set(x + w / 2, -0.06, y + d / 2); edge.scale.set(1.001, 1, 1.001); void L;
  return [m, edge];
}

function makeBelt(cv, look) {
  const g = new THREE.Group(); const tex = beltTexture(look);
  const len = cv.len; const along = cv.axis === 'x';
  const frame = new THREE.Mesh(new THREE.BoxGeometry(along ? len : 0.74, 0.2, along ? 0.74 : len), new THREE.MeshStandardMaterial({ color: look === 'night' ? '#1c252c' : '#b8c5cd', roughness: 0.8 }));
  frame.castShadow = true; frame.receiveShadow = true;
  const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }); tex.repeat.set(len / 1, 1);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.6), topMat); top.rotation.x = -Math.PI / 2; top.position.y = 0.101;
  if (!along) top.rotation.z = -Math.PI / 2;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(along ? len : 0.745, 0.025, along ? 0.745 : len), new THREE.MeshStandardMaterial({ color: '#e0703c', emissive: '#e0703c', emissiveIntensity: look === 'night' ? 0.9 : 0.15 }));
  stripe.position.y = 0.02;
  g.add(frame, top, stripe);
  const cx = along ? cv.x0 + len / 2 : cv.c, cy = along ? cv.c : cv.y0 + len / 2;
  g.position.set(cx, 0.1, cy);
  const n = Math.ceil((len + 0.35) / GAP);
  const items = [];
  for (let k = 0; k < n; k++) {
    const s = cv.item === 'rod' ? [0.5, 0.12, 0.12] : cv.item === 'pkg' ? [0.38, 0.32, 0.38] : cv.item === 'ore' ? [0.3, 0.24, 0.3] : [0.42, 0.08, 0.36];
    const col = ITEM[cv.item] || '#ccc';
    const it = new THREE.Mesh(new THREE.BoxGeometry(...(along ? s : [s[2], s[1], s[0]])), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.4, emissive: cv.item === 'ingot' ? col : '#000', emissiveIntensity: look === 'night' ? 0.8 : 0.2 }));
    it.castShadow = true; scene.add(it); items.push(it);
  }
  return { cv, group: g, tex, items, n };
}

function updateBelt(b, t) {
  const { cv, tex, items, n } = b; const cyc = n * GAP; const along = cv.axis === 'x';
  tex.offset.x = -((t * BELT_V) % 1);
  items.forEach((it, k) => {
    const u = ((((t * BELT_V + (cv.ph || 0) + k * GAP) / cyc) % 1 + 1) % 1) * cyc - 0.05;
    const vis = u >= 0 && u <= cv.len + 0.28; it.visible = vis; if (!vis) return;
    const sc = cv.noFade ? 1 : Math.min(1, Math.max(0.001, u / 0.3));
    it.scale.setScalar(sc);
    const x = along ? cv.x0 + u : cv.c, y = along ? cv.c : cv.y0 + u;
    it.position.set(x, 0.2 + it.geometry.parameters.height / 2 * sc, y);
  });
}

function placeCamera(cam, t) {
  const c = opts.camera || {}; const target = new THREE.Vector3(...(c.target || [0, 1, 0]));
  const yaw = THREE.MathUtils.degToRad((c.yaw || 0) + (opts.turntable || 0) * t); // 0 = true isometric from (+x, +y, +z)
  const pitch = THREE.MathUtils.degToRad(c.pitch ?? 35.264);
  const dist = 60; const dir = new THREE.Vector3(Math.sin(Math.PI / 4 + yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(Math.PI / 4 + yaw) * Math.cos(pitch));
  cam.position.copy(target).addScaledVector(dir, dist); cam.up.set(0, 1, 0); cam.lookAt(target);
  const H = c.height || 6, W = H * (opts.size[0] / opts.size[1]);
  const off = c.offset || [0, 0]; // screen-space framing offset in blocks
  cam.left = -W / 2 - off[0]; cam.right = W / 2 - off[0]; cam.top = H / 2 - off[1]; cam.bottom = -H / 2 - off[1];
  cam.near = 0.1; cam.far = 200; cam.updateProjectionMatrix();
}

export async function init(o) {
  opts = o; const [w, h] = o.size; const look = o.look || 'night'; const L = LOOKS[look] || LOOKS.night; const transparent = !!o.transparent;
  const canvas = document.getElementById('c'); canvas.width = w; canvas.height = h; canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: transparent, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(w, h, false); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = L.exposure;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  if (!transparent) { scene.background = gradientTexture(L.bg); }
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]));
  const key = new THREE.DirectionalLight(L.key[0], L.key[1]); key.position.set(-6, 14, 12); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02; Object.assign(key.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  const rim = new THREE.DirectionalLight(L.rim[0], L.rim[1]); rim.position.set(-12, 8, -14);
  const fill = new THREE.DirectionalLight(L.fill[0], L.fill[1]); fill.position.set(14, 4, 2);
  root = new THREE.Group(); scene.add(root, key, rim, fill);
  const tgt = new THREE.Object3D(); scene.add(tgt); key.target = tgt;
  models = []; belts = [];
  const S = o.scene;
  if (S) {
    const [cx, cy] = S.center || [11, 2]; tgt.position.set(cx, 0, cy); key.position.set(cx - 6, 14, cy + 12); key.shadow.camera.updateProjectionMatrix();
    if (!transparent && S.ground !== false) root.add(groundGrid(L));
    for (const s of S.slabs || []) root.add(...slab(...s, look));
    for (const cv of S.belts || []) { const b = makeBelt(cv, look); root.add(b.group); belts.push(b); }
    for (const p of S.models) {
      const m = await buildModel(o.models[p.model]); m.root.traverse((n) => { if (n.material) [].concat(n.material).forEach((mm) => { if (mm.emissiveMap) mm.emissiveIntensity = L.emissive; }); });
      const fp = (o.models[p.model].arffornia || {}).footprint || [1, 1];
      m.root.position.set(p.at[0] + fp[0] / 2, 0, p.at[1] + fp[1] / 2); m.speed = p.speed || 1; m.offset = p.offset || 0; m.anim = p.anim;
      root.add(m.root); models.push(m);
    }
    for (const l of S.lights || []) { const pl = new THREE.PointLight(l.color, l.intensity * (look === 'night' ? 1 : 0.3), l.range || 6, 2); pl.position.set(l.at[0], l.at[2], l.at[1]); root.add(pl); }
  } else {
    const m = await buildModel(o.models[o.model]); m.root.traverse((n) => { if (n.material) [].concat(n.material).forEach((mm) => { if (mm.emissiveMap) mm.emissiveIntensity = L.emissive; }); });
    root.add(m.root); models.push(m);
    if (!transparent && o.floor !== false) { const f = groundGrid(L, 24); root.add(f); }
    const box = new THREE.Box3().setFromObject(m.root); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    // projected height of the bounding box in the isometric view, plus a margin
    const ph = 0.816 * size.y + 0.408 * (size.x + size.z), pw = 0.707 * (size.x + size.z);
    opts.camera = { target: [c.x, c.y, c.z], height: Math.max(ph, pw * o.size[1] / o.size[0]) * (o.margin || 1.24), ...(o.camera || {}) };
  }
  composer = new EffectComposer(R); composer.setPixelRatio(1); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  if (!transparent && o.bloom !== false) { bloom = new UnrealBloomPass(new THREE.Vector2(w, h), L.bloom[0], L.bloom[1], L.bloom[2]); composer.addPass(bloom); }
  composer.addPass(new OutputPass());
  return { anim: models.map((m) => animLength(m.json, m.anim)) };
}

export function renderFrame(t) {
  for (const m of models) pose(m, (t + (m.offset || 0)) * (m.speed || 1), m.anim);
  for (const b of belts) updateBelt(b, t);
  placeCamera(camera, t);
  if (opts.transparent) R.render(scene, camera); else composer.render();
  return document.getElementById('c').toDataURL('image/png');
}

export async function exportGLB() {
  const m = models[0]; const clips = (m.json.animations || []).map((a) => bakeClip(m, a.name, 30)).filter(Boolean);
  const ex = new GLTFExporter();
  const buf = await ex.parseAsync(m.root, { binary: true, animations: clips });
  let s = ''; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

window.STAGE = { init, renderFrame, exportGLB };

// Live preview when opened by hand: stage.html?model=miner or ?scene=factory-line&look=maquette
const q = new URLSearchParams(location.search);
if (q.get('model') || q.get('scene')) {
  (async () => {
    const look = q.get('look') || 'night';
    const get = async (p) => (await fetch(p)).json();
    let o;
    if (q.get('scene')) { const S = await get(`../scenes/${q.get('scene')}.json`); const ms = Object.create(null); for (const p of S.models) ms[p.model] ||= await get(`../models/${p.model}/${p.model}.bbmodel`); o = { size: [innerWidth, innerHeight], look, scene: S, models: ms, camera: S.cameras[q.get('cam') || Object.keys(S.cameras)[0]] }; }
    else { const id = q.get('model'); o = { size: [innerWidth, innerHeight], look, model: id, models: { [id]: await get(`../models/${id}/${id}.bbmodel`) }, turntable: 20 }; }
    await init(o); const t0 = performance.now(); const loop = () => { renderFrame((performance.now() - t0) / 1000); requestAnimationFrame(loop); }; loop();
  })();
}
