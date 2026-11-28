#!/usr/bin/env node
// .bbmodel (free format, per-face UV) -> GeckoLib: <name>.geo.json, <name>.animation.json, <name>.png, <name>_glowmask.png
//   node tools/pix/geckolib.mjs <id> [--name <asset name>] [--out <dir>]
// Reads concepts/pix/<id>/ (written by build.mjs) and writes out/geckolib/<id>/ by default.
// The conversion follows Blockbench's own Bedrock codec, so GeckoLib renders what the viewer and Blockbench show:
// x is mirrored (Bedrock space), up/down UVs are stored from their far corner with a negative size, and keyframe
// values are already in Blockbench's keyframe signs (the kit converts world sense when it records them).
import fs from 'node:fs';
import path from 'node:path';

const LOOP = { loop: true, hold: 'hold_on_last_frame', once: false };
const LERP = new Set(['linear', 'catmullrom']);
const round = (v) => Math.round(v * 1e4) / 1e4 + 0;
const vec = (a) => a.map(round);
const mirrorX = (p) => [round(-p[0]), round(p[1]), round(p[2])];
const mirrorRot = (r) => [round(-r[0]), round(-r[1]), round(r[2])];
const isZero = (v) => !v || v.every((x) => Math.abs(x) < 1e-9);

function cube(el) {
  if (el.type && el.type !== 'cube') throw new Error(`${el.name}: only cubes export to GeckoLib, not ${el.type}`);
  const size = el.to.map((v, i) => v - el.from[i]);
  const out = { origin: [round(-el.to[0]), round(el.from[1]), round(el.from[2])], size: vec(size) };
  if (el.inflate) out.inflate = el.inflate;
  if (!isZero(el.rotation)) { out.pivot = mirrorX(el.origin); out.rotation = mirrorRot(el.rotation); }
  const uv = {};
  for (const [face, f] of Object.entries(el.faces || {})) {
    if (f.texture === null || f.texture === undefined || !f.uv) continue;
    if (f.rotation) throw new Error(`${el.name}.${face}: rotated face UVs are not exported`);
    let u = [f.uv[0], f.uv[1]], s = [f.uv[2] - f.uv[0], f.uv[3] - f.uv[1]];
    if (face === 'up' || face === 'down') { u = [u[0] + s[0], u[1] + s[1]]; s = [-s[0], -s[1]]; }
    uv[face] = { uv: vec(u), uv_size: vec(s) };
  }
  out.uv = uv;
  return out;
}

/** Converts a parsed .bbmodel to { geo, animation } JSON objects for GeckoLib 4. */
export function toGeckoLib(bb, name) {
  const byUuid = new Map(bb.elements.map((e) => [e.uuid, e]));
  const bones = [], names = new Set();
  const addBone = (bone) => {
    if (names.has(bone.name)) throw new Error(`duplicate bone name ${bone.name}: GeckoLib keys bones by name`);
    names.add(bone.name); bones.push(bone); return bone;
  };
  const loose = bb.outliner.filter((c) => typeof c === 'string');
  if (loose.length) addBone({ name: 'body', pivot: [0, 0, 0], cubes: loose.map((u) => cube(byUuid.get(u))) });
  const walk = (group, parent) => {
    const bone = { name: group.name, ...(parent ? { parent } : {}), pivot: mirrorX(group.origin || [0, 0, 0]) };
    if (!isZero(group.rotation)) bone.rotation = mirrorRot(group.rotation);
    const cubes = group.children.filter((c) => typeof c === 'string').map((u) => cube(byUuid.get(u)));
    if (cubes.length) bone.cubes = cubes;
    addBone(bone);
    for (const child of group.children) if (typeof child === 'object') walk(child, group.name);
  };
  for (const node of bb.outliner) if (typeof node === 'object') walk(node, null);

  const allFrom = bb.elements.map((e) => e.from), allTo = bb.elements.map((e) => e.to);
  const min = [0, 1, 2].map((k) => Math.min(...allFrom.map((p) => p[k]))), max = [0, 1, 2].map((k) => Math.max(...allTo.map((p) => p[k])));
  const geo = {
    format_version: '1.12.0',
    'minecraft:geometry': [{
      description: {
        identifier: `geometry.${name}`, texture_width: bb.resolution.width, texture_height: bb.resolution.height,
        visible_bounds_width: Math.ceil(Math.max(max[0] - min[0], max[2] - min[2]) / 16) + 1,
        visible_bounds_height: Math.ceil((max[1] - min[1]) / 16) + 1,
        visible_bounds_offset: [0, round((max[1] + min[1]) / 32), 0],
      },
      bones,
    }],
  };

  const animations = {};
  for (const a of bb.animations || []) {
    if (!(a.loop in LOOP)) throw new Error(`animation ${a.name}: unknown loop mode ${a.loop}`);
    const boneTracks = {};
    for (const animator of Object.values(a.animators || {})) {
      if (animator.type && animator.type !== 'bone') continue;
      if (!names.has(animator.name)) throw new Error(`animation ${a.name}: no bone named ${animator.name}`);
      const channels = {};
      for (const k of animator.keyframes) {
        if (!LERP.has(k.interpolation || 'linear')) throw new Error(`animation ${a.name}/${animator.name}: ${k.interpolation} keyframes are not exported`);
        const p = k.data_points[0];
        const v = [p.x, p.y, p.z].map(Number);
        const ch = (channels[k.channel] ||= {});
        ch[String(round(k.time))] = k.interpolation === 'catmullrom' ? { post: vec(v), lerp_mode: 'catmullrom' } : vec(v);
      }
      for (const ch of Object.values(channels)) {
        const sorted = Object.entries(ch).sort((x, y) => Number(x[0]) - Number(y[0]));
        for (const key of Object.keys(ch)) delete ch[key];
        for (const [t, v] of sorted) ch[t] = v;
      }
      boneTracks[animator.name] = channels;
    }
    animations[`animation.${name}.${a.name}`] = { loop: LOOP[a.loop], animation_length: round(a.length), bones: boneTracks };
  }
  return { geo, animation: { format_version: '1.8.0', animations } };
}

function main(args) {
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const id = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
  if (!id) { console.error('usage: geckolib.mjs <id> [--name <asset name>] [--out <dir>]'); process.exit(2); }
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
  const name = opt('--name', id), src = path.join(root, 'concepts/pix', id), out = opt('--out', path.join(root, 'out/geckolib', id));
  const bb = JSON.parse(fs.readFileSync(path.join(src, `${id}.bbmodel`), 'utf8'));
  const { geo, animation } = toGeckoLib(bb, name);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `${name}.geo.json`), JSON.stringify(geo, null, 1) + '\n');
  fs.writeFileSync(path.join(out, `${name}.animation.json`), JSON.stringify(animation, null, 1) + '\n');
  fs.copyFileSync(path.join(src, `${id}.png`), path.join(out, `${name}.png`));
  fs.copyFileSync(path.join(src, `${id}_glowmask.png`), path.join(out, `${name}_glowmask.png`));
  const g = geo['minecraft:geometry'][0];
  console.log(`${id} -> ${path.relative(process.cwd(), out)}/${name}.*: ${g.bones.length} bones, ${g.bones.reduce((s, b) => s + (b.cubes || []).length, 0)} cubes, `
    + `animations ${Object.keys(animation.animations).map((k) => k.split('.').pop()).join(', ') || 'none'}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
