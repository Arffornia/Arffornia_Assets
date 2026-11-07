// Bedrock/GeckoLib .geo.json (box UV) -> minimal .bbmodel for side-by-side reference renders (never shipped).
import fs from 'node:fs';
const [geoPath, pngPath, out] = process.argv.slice(2);
const g = JSON.parse(fs.readFileSync(geoPath, 'utf8'))['minecraft:geometry'][0];
const tw = g.description.texture_width, th = g.description.texture_height;
const tex = `data:image/png;base64,${fs.readFileSync(pngPath).toString('base64')}`;
let n = 0; const id = () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`;
const elements = []; const groups = new Map(); const roots = [];
const flipX = (p) => [-p[0], p[1], p[2]];
for (const b of g.bones) {
  const node = { name: b.name, origin: flipX(b.pivot || [0, 0, 0]), uuid: id(), children: [] };
  if (b.rotation) node.rotation = [-b.rotation[0], -b.rotation[1], b.rotation[2]];
  groups.set(b.name, node);
  for (const c of b.cubes || []) {
    const [w, h, d] = c.size; const inf = c.inflate || 0;
    const from = [-(c.origin[0] + w) - inf, c.origin[1] - inf, c.origin[2] - inf];
    const to = [from[0] + w + 2 * inf, from[1] + h + 2 * inf, from[2] + d + 2 * inf];
    let faces;
    if (Array.isArray(c.uv)) {
      const [u, v] = c.uv; const mir = c.mirror;
      faces = { east: [u, v + d, u + d, v + d + h], north: [u + d, v + d, u + d + w, v + d + h], west: [u + d + w, v + d, u + 2 * d + w, v + d + h], south: [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h], up: [u + d + w, v + d, u + d, v], down: [u + d + 2 * w, v, u + d + w, v + d] };
      if (mir) for (const k in faces) { const f = faces[k]; faces[k] = [f[2], f[1], f[0], f[3]]; }
    } else {
      faces = {}; for (const [k, f] of Object.entries(c.uv || {})) faces[k] = [f.uv[0], f.uv[1], f.uv[0] + f.uv_size[0], f.uv[1] + f.uv_size[1]];
    }
    const el = { name: `${b.name}_c`, from, to, uuid: id(), type: 'cube', faces: {} };
    for (const [k, uv] of Object.entries(faces)) el.faces[k] = { uv, texture: 0 };
    if (c.pivot || c.rotation) { el.origin = flipX(c.pivot || [0, 0, 0]); el.rotation = c.rotation ? [-c.rotation[0], -c.rotation[1], c.rotation[2]] : [0, 0, 0]; } else el.origin = node.origin;
    elements.push(el); node.children.push(el.uuid);
  }
}
for (const b of g.bones) { const node = groups.get(b.name); (b.parent && groups.get(b.parent) ? groups.get(b.parent).children : roots).push(node); }
const bb = { meta: { format_version: '4.10', model_format: 'free', box_uv: false }, name: 'ref', resolution: { width: tw, height: th }, elements, outliner: roots, textures: [{ name: 't', source: tex }], animations: [], arffornia: {} };
fs.writeFileSync(out, JSON.stringify(bb));
console.log(`${elements.length} cubes, ${g.bones.length} bones, ${tw}x${th}`);
