#!/usr/bin/env node
// One-shot extractor: turns the mock machines drawn by the loading/title-screen previews
// (legacy/mc-screens-engine.js, the canvas-2D isometric engine from docs PR #7) into
// Blockbench .bbmodel files, so the models Brian liked become editable source of truth.
//
// How: the legacy engine runs in headless Chromium. Each machine function is called with a
// recording renderer: every box()/cyl() call becomes a cuboid, and the face decoration
// callbacks (strips, hatches, vents, screens, hazard stripes) are painted for real into a
// texture atlas at PPB pixels per block. Moving parts are put in named bones and get a
// Blockbench animation that reproduces the preview motion.
//
// usage: node tools/extract-mc-screens.mjs [--ppb 32]
// Output: models/<id>/<id>.bbmodel (overwrites). Run once; afterwards edit the models in Blockbench.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PPB = Number(process.argv[process.argv.indexOf('--ppb') + 1]) || 32;
const SRC = fs.readFileSync(path.join(ROOT, 'legacy/mc-screens-engine.js'), 'utf8')
  .replace('window.ARF = {', 'window.ARF = { Iso, miner, smelter, constructor_, foundry, assembler, elevator, LINE, ');

// Deterministic UUIDs (stable diffs when the extractor is re-run).
const uuid = (s) => {
  const h = crypto.createHash('sha1').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// id, legacy function, footprint (blocks), title, tier note, input conveyor, bone rules
const MACHINES = [
  { id: 'miner', fn: 'miner', fp: [2, 2], title: 'Miner', note: 'Tier 0. Drills an ore node.' },
  { id: 'smelter', fn: 'smelter', fp: [2, 2], title: 'Smelter', note: 'Tier 0. Ore to ingots.', cv: 'c1' },
  { id: 'constructor', fn: 'constructor_', fp: [2, 2], title: 'Constructor', note: 'Tier 1. Ingots to plates and rods.', cv: 'c2' },
  { id: 'foundry', fn: 'foundry', fp: [3, 3], title: 'Foundry', note: 'Tier 2. Alloys.' },
  { id: 'assembler', fn: 'assembler', fp: [3, 3], title: 'Assembler', note: 'Tier 2. Plates and rods to reinforced plates.', cv: 'c3' },
  { id: 'space-elevator', fn: 'elevator', fp: [3, 3], title: 'Space Elevator', note: 'Tier 3. Milestone deliveries.', cv: 'c5' },
];

function inPage({ fn, cv, ppb }) {
  /* global ARF */
  const th = ARF.THEMES.night;
  const recs = [];
  const stub = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  const R = new ARF.Iso(stub, th);
  R.t = 0; R.power = 1; R.curPower = 1;
  R.add = (d, f) => f(); R.addLight = () => {}; R.glow = () => {}; R.pool = () => {}; R.line = () => {}; R.poly = () => {}; R.reset = () => {}; R.face = () => {};
  R.p = () => [0, 0];
  R.box = (x, y, z, w, d, h, col, o = {}) => recs.push({ k: 'box', x, y, z, w, d, h, col, o });
  R.cyl = (cx, cy, z, r, h, col, o = {}) => recs.push({ k: 'cyl', x: cx - r, y: cy - r, z, w: 2 * r, d: 2 * r, h, r, col, o });
  const m = { x: 0, y: 0 };
  const cvIn = cv ? ARF.LINE.cv[cv] : undefined;
  ARF[fn](R, m, cvIn);

  // ---- atlas: decorated faces get their own region, plain faces share one 4x4 swatch per colour
  const css = (c) => ARF.css(c);
  const regions = []; const swatches = new Map();
  const want = (rec, i, face, uw, vh) => regions.push({ rec: i, face, w: Math.max(1, Math.round(uw * ppb)), h: Math.max(1, Math.round(vh * ppb)), uw, vh });
  recs.forEach((r, i) => {
    if (r.k === 'box') {
      want(r, i, 'south', r.w, r.h); want(r, i, 'east', r.d, r.h); want(r, i, 'up', r.w, r.d);
    }
    for (const c of [r.col, r.o.topCol].filter(Boolean)) { const key = css(c); if (!swatches.has(key)) swatches.set(key, null); }
  });
  for (const c of [th.orange, th.steel, th.teal, th.dark]) swatches.set(css(c), null); // accent swatches for parts added later
  for (const key of swatches.keys()) regions.push({ swatch: key, w: 4, h: 4 });
  // shelf packing
  const W = regions.some((r) => r.w > 480) ? 1024 : 512; let x = 0, y = 0, rowH = 0;
  [...regions].sort((a, b) => b.h - a.h || b.w - a.w).forEach((r) => {
    if (x + r.w + 1 > W) { x = 0; y += rowH + 1; rowH = 0; }
    r.px = x; r.py = y; x += r.w + 1; rowH = Math.max(rowH, r.h);
  });
  let H = 16; while (H < y + rowH + 1) H *= 2;
  const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');
  const painter = Object.create(ARF.Iso.prototype); painter.ctx = ctx; painter.th = th; painter.power = 1; painter.t = 0;
  const faceUV = {};
  for (const g of regions) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(g.px, g.py, g.w, g.h); ctx.clip();
    if (g.swatch) { ctx.fillStyle = g.swatch; ctx.fillRect(g.px, g.py, g.w, g.h); swatches.set(g.swatch, [g.px + 1, g.py + 1, g.px + 3, g.py + 3]); ctx.restore(); continue; }
    const r = recs[g.rec];
    ctx.fillStyle = css(r.col); ctx.fillRect(g.px, g.py, g.w, g.h);
    const sx = g.w / g.uw, sy = g.h / g.vh;
    if (g.face === 'up') ctx.setTransform(sx, 0, 0, sy, g.px, g.py);
    else ctx.setTransform(sx, 0, 0, -sy, g.px, g.py + g.h); // side faces: v points up in the legacy engine
    const cb = { south: r.o.left, east: r.o.right, up: r.o.top }[g.face];
    try { if (cb) cb(painter, g.uw, g.vh); } catch (e) { /* decoration that needs screen-space data: skip */ }
    ctx.restore();
    (faceUV[g.rec] ||= {})[g.face] = [g.px, g.py, g.px + g.w, g.py + g.h];
  }
  return {
    atlas: cvs.toDataURL('image/png'), W, H, accents: { orange: swatches.get(css(th.orange)), steel: swatches.get(css(th.steel)), teal: swatches.get(css(th.teal)), dark: swatches.get(css(th.dark)) },
    shaft: css(th.shaft), recs: recs.map((r, i) => ({ k: r.k, r: r.r, x: r.x, y: r.y, z: r.z, w: r.w, d: r.d, h: r.h, col: css(r.col), top: r.o.topCol ? css(r.o.topCol) : null, uv: faceUV[i] || {}, sw: swatches.get(css(r.col)), swTop: r.o.topCol ? swatches.get(css(r.o.topCol)) : null })),
  };
}

// Which bone a recorded part belongs to (moving parts only; everything else is "body").
function boneOf(id, r, i) {
  if (id === 'miner' && r.k === 'cyl') return 'drill';
  if (id === 'miner' && r.k === 'box' && Math.abs(r.z - 2.62) < 1e-6) return 'fan';
  if (id === 'constructor' && r.k === 'cyl' && r.z > 2.4) return 'piston';
  if (id === 'space-elevator' && r.k === 'box' && r.col === 'rgb(224,112,60)' && r.w < 1) return 'capsule';
  return 'body';
}

const S = 16; // Blockbench pixels per block
function toBB(m, data) {
  const [fw, fd] = m.fp; const ox = fw / 2, oy = fd / 2; // centre the footprint on the origin
  const elements = []; const bones = new Map([['body', []]]);
  const face = (uv) => ({ uv, texture: 0 });
  data.recs.forEach((r, i) => {
    // legacy iso (x, y, z-up) -> Blockbench (X = x, Y = z, Z = y), in pixels, centred
    if (m.id === 'assembler' && r.k === 'box' && r.z >= 1.8 && r.w <= 0.6) return; // carried items: drawn by scenes
    if (m.id === 'space-elevator' && r.col === 'rgb(224,112,60)' && r.w < 1) r.z = 1.0; // capsule at rest
    const bone = boneOf(m.id, r, i); if (!bones.has(bone)) bones.set(bone, []);
    const from = [(r.x - ox) * S, r.z * S, (r.y - oy) * S], to = [(r.x + r.w - ox) * S, (r.z + r.h) * S, (r.y + r.d - oy) * S];
    const sw = r.sw, top = r.swTop || sw;
    const mk = (name, f, t, rot, faces) => {
      const e = { name, box_uv: false, rescale: false, locked: false, render_order: 'default', allow_mirror_modeling: true,
        from: f.map((v) => +v.toFixed(4)), to: t.map((v) => +v.toFixed(4)), autouv: 0, color: 0,
        origin: [+((f[0] + t[0]) / 2).toFixed(4), +f[1].toFixed(4), +((f[2] + t[2]) / 2).toFixed(4)],
        faces, type: 'cube', uuid: uuid(`${m.id}/${i}/${name}`) };
      if (rot) e.rotation = [0, rot, 0];
      elements.push(e); bones.get(bone).push(e.uuid);
    };
    if (r.k === 'box') {
      // naming convention read by the renderer: glass_* elements are translucent
      mk(`${r.col === data.shaft ? 'glass' : bone}_${i}`, from, to, 0, { north: face(sw), east: face(r.uv.east || sw), south: face(r.uv.south || sw), west: face(sw), up: face(r.uv.up || sw), down: face(sw) });
    } else { // cylinder -> octagonal prism from two cuboids
      const c = [(from[0] + to[0]) / 2, (from[2] + to[2]) / 2], half = r.r * S * 0.924;
      const F = [c[0] - half, from[1], c[1] - half], T = [c[0] + half, to[1], c[1] + half];
      const faces = { north: face(sw), east: face(sw), south: face(sw), west: face(sw), up: face(top), down: face(sw) };
      mk(`${bone}_${i}_a`, F, T, 0, faces); mk(`${bone}_${i}_b`, F, T, 45, { ...faces });
    }
  });
  if (m.id === 'assembler') { // the arm is drawn with lines in the legacy engine: rebuild it as cuboids
    const sh = [0, (1.92 + 0.35) * S, 0];
    bones.set('arm', []);
    const or = data.accents.orange, steel = data.accents.steel;
    for (const [name, f, t] of [
      ['arm_upper', [-1.4, sh[1] - 1.4, -1.4], [1.4, sh[1] + 1.4, 14.6]],
      ['arm_elbow', [-2, sh[1] - 2, 12.6], [2, sh[1] + 2, 16.6]],
      ['arm_fore', [-1.1, sh[1] - 9, 13.5], [1.1, sh[1] - 1, 15.7]],
      ['arm_gripper', [-2.2, sh[1] - 10.4, 12.4], [2.2, sh[1] - 9, 16.8]],
    ]) {
      const c = name === 'arm_upper' || name === 'arm_fore' ? or : steel;
      const e = { name, box_uv: false, rescale: false, locked: false, render_order: 'default', allow_mirror_modeling: true, from: f, to: t, autouv: 0, color: 1,
        origin: [0, sh[1], 0], faces: Object.fromEntries(['north', 'east', 'south', 'west', 'up', 'down'].map((k) => [k, face(c)])), type: 'cube', uuid: uuid(`${m.id}/${name}`) };
      elements.push(e); bones.get('arm').push(e.uuid);
    }
  }
  const pivots = { drill: [0, 0.35 * S, 0], fan: [0, 2.62 * S, 0], piston: [0, 2.44 * S, 0], capsule: [0, 1.0 * S, 0], arm: [0, (1.92 + 0.35) * S, 0], body: [0, 0, 0] };
  const outliner = [...bones.entries()].map(([name, children]) => ({ name, origin: pivots[name] || [0, 0, 0], color: 0, uuid: uuid(`${m.id}/bone/${name}`), export: true, mirror_uv: false, isOpen: false, locked: false, visibility: true, autouv: 0, children }));
  const boneId = (n) => uuid(`${m.id}/bone/${n}`);
  const kf = (channel, time, v, interp = 'linear') => ({ channel, data_points: [{ x: v[0], y: v[1], z: v[2] }], uuid: uuid(`${m.id}/${channel}/${time}/${v}`), time, color: -1, interpolation: interp });
  const anim = (name, length, animators) => ({ uuid: uuid(`${m.id}/anim/${name}`), name, loop: 'loop', override: false, length, snapping: 20, selected: false, anim_time_update: '', blend_weight: '', start_delay: '', loop_delay: '', animators });
  const animations = [];
  const CYCLE = 1.5 / 0.9;
  if (m.id === 'miner') {
    animations.push(anim('animation.miner.work', 2.4, {
      [boneId('drill')]: { name: 'drill', type: 'bone', keyframes: [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4].map((t, k) => kf('position', t, [0, [0, 1.28, 0, -1.28][k % 4], 0], 'catmullrom')) },
      [boneId('fan')]: { name: 'fan', type: 'bone', keyframes: [kf('rotation', 0, [0, 0, 0]), kf('rotation', 1.2, [0, -540, 0]), kf('rotation', 2.4, [0, -1080, 0])] },
    }));
  }
  if (m.id === 'constructor') {
    const L = CYCLE, d = -0.62 * S;
    animations.push(anim('animation.constructor.press', +L.toFixed(4), {
      [boneId('piston')]: { name: 'piston', type: 'bone', keyframes: [[0, 0], [0.18, 0], [0.34, d], [0.4, d], [0.85, 0], [1, 0]].map(([p, v]) => kf('position', +(p * L).toFixed(4), [0, v, 0])) },
    }));
  }
  if (m.id === 'space-elevator') {
    const top = (7.4 - 2.6) * S;
    animations.push(anim('animation.space_elevator.launch', 6, {
      [boneId('capsule')]: { name: 'capsule', type: 'bone', keyframes: [kf('position', 0, [0, 0, 0]), kf('position', 0.9, [0, 0, 0]), kf('position', 4.5, [0, top, 0], 'catmullrom'), kf('position', 5.85, [0, top, 0]), kf('position', 6, [0, 0, 0])] },
    }));
  }
  if (m.id === 'assembler') {
    const L = CYCLE; // yaw from the pick pad (back-left) to the place pad (front-right)
    const a0 = 122, a1 = -58; // degrees, Blockbench animation convention (y is negated on apply)
    animations.push(anim('animation.assembler.pick_place', +L.toFixed(4), {
      [boneId('arm')]: { name: 'arm', type: 'bone', keyframes: [
        kf('rotation', 0, [0, a0, 0]), kf('rotation', +(0.12 * L).toFixed(4), [0, a0, 0]), kf('rotation', +(0.55 * L).toFixed(4), [0, a1, 0], 'catmullrom'),
        kf('rotation', +(0.65 * L).toFixed(4), [0, a1, 0]), kf('rotation', +L.toFixed(4), [0, a0, 0], 'catmullrom'),
        kf('position', 0, [0, 0, 0]), kf('position', +(0.33 * L).toFixed(4), [0, 4, 0], 'catmullrom'), kf('position', +(0.55 * L).toFixed(4), [0, 0, 0]), kf('position', +L.toFixed(4), [0, 0, 0]),
      ] },
    }));
  }
  return {
    meta: { format_version: '4.10', model_format: 'free', box_uv: false },
    name: m.id, model_identifier: '', visible_box: [fw, Math.ceil(Math.max(...elements.map((e) => e.to[1])) / S), fd],
    variable_placeholders: '', variable_placeholder_buttons: [], timeline_setups: [], unhandled_root_fields: {},
    resolution: { width: data.W, height: data.H },
    elements, outliner,
    textures: [{ path: '', name: `${m.id}.png`, folder: 'block', namespace: 'arffornia', id: '0', width: data.W, height: data.H, uv_width: data.W, uv_height: data.H,
      particle: false, layers_enabled: false, sync_to_project: '', render_mode: 'default', render_sides: 'auto', frame_time: 1, frame_order_type: 'loop', frame_order: '', frame_interpolate: false,
      visible: true, internal: true, saved: true, uuid: uuid(`${m.id}/texture`), relative_path: `../${m.id}.png`, source: data.atlas }],
    animations,
    arffornia: { title: m.title, note: m.note, footprint: m.fp, origin: 'Extracted from the loading/title-screen previews (docs PR #7) by tools/extract-mc-screens.mjs', status: 'mock' },
  };
}

const b = await chromium.launch();
const pg = await b.newPage();
await pg.setContent('<html><body></body></html>');
await pg.addScriptTag({ content: SRC });
for (const m of MACHINES) {
  const data = await pg.evaluate(inPage, { fn: m.fn, cv: m.cv, ppb: PPB });
  const bb = toBB(m, data);
  const dir = path.join(ROOT, 'models', m.id); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${m.id}.bbmodel`), JSON.stringify(bb, null, 1) + '\n');
  fs.writeFileSync(path.join(dir, `${m.id}.png`), Buffer.from(data.atlas.split(',')[1], 'base64'));
  console.log(`${m.id}: ${bb.elements.length} cuboids, atlas ${data.W}x${data.H}, ${bb.animations.length} animation(s)`);
}
await b.close();
