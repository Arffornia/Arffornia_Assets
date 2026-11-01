// Inspection and concept-render stage, separate from render/stage.js so the production outputs
// stay byte-stable. Driven by Playwright (window.VIEW) from tools/lint/snapshot.mjs and
// tools/da/render.mjs. Same loader as production (render/bbmodel.js).
//
// modes:
//   hero        concept render: studio backdrop, block-grid floor, player for scale, AO + bloom
//   silhouette  black shape on white, no floor (is the machine readable from its outline alone?)
//   lint        grey model, the parts named in `highlight` in magenta
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { buildModel, pose, loadImage } from '../../render/bbmodel.js';

let R, scene, camera, composer, model, opts;

function grad(cols) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); x.fillStyle = g; x.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// a block-grid floor: one tile per block, so the footprint reads at a glance
function floorTexture(base, line) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 64, 64);
  x.fillStyle = line; x.fillRect(0, 0, 64, 2); x.fillRect(0, 0, 2, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

// a neutral player-sized mannequin (1.8 blocks), built like a player model but not one
function mannequin() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.8 });
  const box = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); };
  box(0.5, 0.5, 0.5, 0, 1.55, 0); box(0.5, 0.75, 0.25, 0, 0.925, 0); box(0.25, 0.75, 0.25, -0.375, 0.925, 0); box(0.25, 0.75, 0.25, 0.375, 0.925, 0);
  box(0.24, 0.75, 0.25, -0.125, 0.375, 0); box(0.24, 0.75, 0.25, 0.125, 0.375, 0);
  return g;
}

export async function init(o) {
  opts = o; const [w, h] = o.size; const mode = o.mode || 'hero';
  const canvas = document.getElementById('c'); canvas.width = w; canvas.height = h;
  R = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: !!o.transparent });
  R.setPixelRatio(1); R.setSize(w, h, false); R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = mode === 'hero' ? THREE.AgXToneMapping : THREE.NoToneMapping; R.toneMappingExposure = o.exposure || 1.25;
  R.shadowMap.enabled = mode !== 'silhouette'; R.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  const bg = o.bg || (mode === 'hero' ? ['#2a3038', '#1d2228', '#15181c'] : ['#ffffff', '#ffffff']);
  if (!o.transparent) scene.background = grad(bg);
  if (mode === 'hero') scene.fog = new THREE.Fog(bg[bg.length - 1], 30, 90);

  model = await buildModel(o.model, { emissive: false, material: { roughness: 0.78, metalness: 0.0 } });
  const glow = o.glowmask ? await loadImage(o.glowmask) : null;
  // highlight: { partName: '#rrggbb' } (or a list of names, all magenta)
  const hl = new Map(Array.isArray(o.highlight) ? o.highlight.map((nm) => [nm, '#ff2bd6']) : Object.entries(o.highlight || {}));
  model.root.traverse((n) => {
    if (!n.isMesh) return;
    n.castShadow = !/^glass/i.test(n.name); n.receiveShadow = true;
    if (mode === 'silhouette') { n.material = new THREE.MeshBasicMaterial({ color: '#101215' }); return; }
    if (mode === 'lint') {
      const bad = hl.get(n.name);
      n.material = new THREE.MeshStandardMaterial({ color: bad || '#b7bec6', emissive: bad || '#000', emissiveIntensity: bad ? 0.35 : 0, roughness: 0.9, transparent: !bad, opacity: bad ? 1 : 0.45, depthWrite: !!bad });
      if (bad) n.renderOrder = 3;
      return;
    }
    if (glow) for (const mm of [].concat(n.material)) {
      if (mm.transparent) continue;
      const t = new THREE.Texture(glow); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.needsUpdate = true;
      mm.emissiveMap = t; mm.emissive = new THREE.Color(1, 1, 1); mm.emissiveIntensity = o.glow ?? 2.2;
    }
    for (const mm of [].concat(n.material)) if (mm.transparent) { mm.opacity = 0.3; mm.color = new THREE.Color('#9fd4e8'); mm.roughness = 0.05; }
  });
  pose(model, o.t || 0, o.anim);
  scene.add(model.root);

  const box = new THREE.Box3().setFromObject(model.root); const size = box.getSize(new THREE.Vector3()); const ctr = box.getCenter(new THREE.Vector3());
  const fp = (o.model.arffornia || {}).footprint || [Math.ceil(size.x), Math.ceil(size.z)];

  if (mode !== 'silhouette') {
    scene.add(new THREE.HemisphereLight(o.sky || '#c8d4e0', o.groundLight || '#3a3530', mode === 'hero' ? 1.15 : 2.2));
    const key = new THREE.DirectionalLight(o.keyColor || '#ffe7cf', mode === 'hero' ? 3.4 : 1.6);
    const r = Math.max(size.x, size.y, size.z) * 1.6 + 4;
    key.position.set(ctr.x - r * 0.55, ctr.y + r * 1.1, ctr.z + r * 0.8); key.target.position.copy(ctr);
    key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.015; key.shadow.radius = 3;
    Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: r * 4 });
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(o.rimColor || '#8fc8ff', mode === 'hero' ? 1.6 : 0.4); rim.position.set(ctr.x + r, ctr.y + r * 0.5, ctr.z - r); scene.add(rim);
    const fill = new THREE.DirectionalLight('#ffffff', mode === 'hero' ? 0.45 : 0.6); fill.position.set(ctr.x + r, ctr.y + r * 0.3, ctr.z + r * 0.6); scene.add(fill);
    if (mode === 'lint' && o.model.arffornia && o.model.arffornia.footprint) {
      const hgt = o.model.arffornia.height || Math.ceil(size.y);
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(fp[0], hgt, fp[1])), new THREE.LineBasicMaterial({ color: '#2b6cff' }));
      wire.position.set(0, hgt / 2, 0); scene.add(wire);
    }
    if (o.floor !== false && mode === 'hero') {
      const ext = Math.max(fp[0], fp[1]) + 60;
      const ft = floorTexture(o.floorBase || '#3b4048', o.floorLine || '#4a5059'); ft.repeat.set(ext * 2, ext * 2); ft.offset.set((fp[0] % 2) / 2, (fp[1] % 2) / 2);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2, ext * 2), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.95 }));
      fl.rotation.x = -Math.PI / 2; fl.position.y = -0.001; fl.receiveShadow = true; scene.add(fl);
      // footprint outline (what the machine claims on the grid)
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(fp[0], fp[1]), new THREE.MeshStandardMaterial({ color: o.padColor || '#4b525c', roughness: 0.9 }));
      pad.rotation.x = -Math.PI / 2; pad.position.y = 0.0005; pad.receiveShadow = true; scene.add(pad);
    }
    if (o.player !== false && mode === 'hero') { const p = mannequin(); p.position.set(fp[0] / 2 + 1.0, 0, -fp[1] / 2 + 0.8); p.rotation.y = 0.6; scene.add(p); }
  }

  // camera: perspective for hero (scale reads better), orthographic iso for lint/silhouette
  const yaw = THREE.MathUtils.degToRad(o.yaw ?? 35), pitch = THREE.MathUtils.degToRad(o.pitch ?? (mode === 'hero' ? 24 : 30));
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const target = ctr.clone(); if (o.targetDy) target.y += o.targetDy;
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
  if (mode === 'hero') {
    const fov = o.fov || 30; camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 400);
    const dist = (radius * (o.zoom || 0.98)) / Math.sin(THREE.MathUtils.degToRad(fov / 2)) * (w < h ? h / w : 1);
    camera.position.copy(target).addScaledVector(dir, dist); camera.lookAt(target);
  } else {
    const H = radius * 2 * (o.zoom || 1.08), W = H * w / h; camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 400);
    camera.position.copy(target).addScaledVector(dir, radius * 6); camera.lookAt(target);
  }

  composer = new EffectComposer(R); composer.setPixelRatio(1); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  if (mode === 'hero') {
    if (o.ao !== false) { const ao = new GTAOPass(scene, camera, w, h); ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 }); ao.blendIntensity = 0.85; composer.addPass(ao); }
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), o.bloom ?? 0.55, 0.5, 0.82));
  }
  composer.addPass(new OutputPass());
  if (mode !== 'silhouette') composer.addPass(new SMAAPass(w, h));
  return { size: size.toArray(), footprint: fp };
}

export function frame(t) {
  if (t !== undefined) { pose(model, t, opts.anim); }
  composer.render();
  return document.getElementById('c').toDataURL('image/png');
}

window.VIEW = { init, frame };
