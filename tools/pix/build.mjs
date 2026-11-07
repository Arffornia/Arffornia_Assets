#!/usr/bin/env node
// Build, lint and render pixel-art machines: tools/pix/machines/<id>.mjs -> concepts/pix/<id>/ + out/pix/<id>/
//   node tools/pix/build.mjs <id> [--no-render] [--views 38:26,230:26] [--t 0.5]
// A machine module exports `meta` (footprint, height, ports, joints, texelsPerBlock...) and `build(b, P)`,
// where b is the kit Model and P the painter (tools/pix/pix.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Model } from '../da/kit.mjs';
import * as P from './pix.mjs';
import { lintModel } from '../lint/checks.mjs';
import { openViewer } from '../view/driver.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const id = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!id) { console.error('usage: build.mjs <id>'); process.exit(2); }

const mod = await import(path.join(ROOT, 'tools/pix/machines', `${id}.mjs`));
const b = new Model(id, { kind: 'machine', status: 'concept', texelsPerBlock: 16, ...mod.meta });
mod.build(b, P);
const { bbmodel, texPng, glowPng, atlas } = b.build();
const dir = path.join(ROOT, 'concepts/pix', id); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `${id}.bbmodel`), JSON.stringify(bbmodel, null, 1) + '\n');
fs.writeFileSync(path.join(dir, `${id}.png`), texPng);
fs.writeFileSync(path.join(dir, `${id}_glowmask.png`), glowPng);

// Bare faces: Brian's "too flat" in numbers. Each drawn face is cut into 8x8-texel tiles (8xN strips on narrow faces); a tile is bare when it
// has at most 3 distinct colours and no darkest or brightest accent (only the light map and jitter). A part whose
// visible faces are mostly bare tiles reads as a flat placeholder, whatever the rest of the model does.
function bareFaces(bb, png) {
  const [W, H] = [bb.resolution.width, bb.resolution.height];
  const raw = execFileSync('magick', ['png:-', '-depth', '8', 'rgba:-'], { input: png, maxBuffer: 1 << 28 });
  const out = []; let allTiles = 0, allBare = 0;
  for (const el of bb.elements) {
    let tiles = 0, bare = 0;
    for (const [face, f] of Object.entries(el.faces || {})) {
      if (face === 'down' || f.texture === null || !f.uv) continue;
      const [u0, v0, u1, v1] = f.uv.map(Math.round); const fw = Math.abs(u1 - u0), fh = Math.abs(v1 - v0);
      // narrow faces (pipes, drum staves) get strips: 8 texels along the long side, the full short side
      const tw = Math.min(8, fw), th = Math.min(8, fh); if (tw * th < 12) continue;
      for (let ty = 0; ty + th <= fh; ty += th) for (let tx = 0; tx + tw <= fw; tx += tw) {
        const cols = new Set(); let lum = [];
        for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const o = ((Math.min(v0, v1) + ty + y) * W + Math.min(u0, u1) + tx + x) * 4; cols.add(raw.readUInt32BE(o)); lum.push(raw[o] + raw[o + 1] + raw[o + 2]); }
        lum.sort((a, b) => a - b); const spread = lum[lum.length - 1] - lum[0];
        tiles++; if (cols.size <= 3 || spread < 60) bare++;
      }
    }
    allTiles += tiles; allBare += bare;
    if (tiles >= 3 && bare / tiles > 0.4) out.push({ name: el.name, bare, tiles });
  }
  const byStem = new Map(); for (const r of out) { const k = r.name.split('#')[0]; const c = byStem.get(k) || { bare: 0, tiles: 0 }; c.bare += r.bare; c.tiles += r.tiles; byStem.set(k, c); }
  return { share: allTiles ? allBare / allTiles : 0, parts: [...byStem.entries()].sort((a, b) => b[1].bare - a[1].bare) };
}

const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/lint/rules.json'), 'utf8'));
const res = lintModel(bbmodel, rules, { id: `pix/${id}` });
const findings = res.findings || res;
const errors = findings.filter((f) => f.level === 'error'), warns = findings.filter((f) => f.level === 'warn');
console.log(`${id}: ${bbmodel.elements.length} elements, atlas ${atlas.join('x')}, ${errors.length} errors, ${warns.length} warnings`);
for (const f of [...errors, ...warns]) console.log(`  ${f.level} ${f.check}: ${f.msg}`);
// Oritech machines measure 0.30-0.60 (foundry 0.48, assembler 0.60, centrifuge 0.30); above 0.55 reads flat.
const bare = bareFaces(bbmodel, texPng);
console.log(`  bare share ${bare.share.toFixed(2)} (Oritech 0.30-0.60, target <= 0.55)${bare.share > 0.55 ? ' TOO FLAT' : ''}`);
if (bare.parts.length) console.log(`  flattest parts (bare tiles / tiles): ${bare.parts.slice(0, 12).map(([n, c]) => `${n} ${c.bare}/${c.tiles}`).join(', ')}`);

if (!args.includes('--no-render')) {
  const out = path.join(ROOT, 'out/pix', id); fs.mkdirSync(out, { recursive: true });
  const glowmask = `data:image/png;base64,${glowPng.toString('base64')}`;
  const anim = (bbmodel.animations[0] || {}).name;
  const views = opt('--views', '38:24,218:24').split(',').map((v) => v.split(':').map(Number));
  const v = await openViewer();
  const files = [];
  try {
    for (const [i, [yaw, pitch]] of views.entries()) {
      const r = await v.render({ size: [900, 900], mode: 'hero', model: bbmodel, glowmask, anim, t: Number(opt('--t', '0.5')), yaw, pitch, player: !args.includes('--no-player'), ...(mod.look || {}) });
      const f = path.join(out, `view${i + 1}.png`); fs.writeFileSync(f, r.frames[0]); files.push(f);
    }
  } finally { await v.close(); }
  try { execFileSync('magick', [...files, '+append', '-resize', '1600x', path.join(out, 'sheet.jpg')]); console.log(`  render: ${path.relative(ROOT, path.join(out, 'sheet.jpg'))}`); } catch { console.log(`  render: ${files.map((f) => path.relative(ROOT, f)).join(', ')}`); }
}
process.exitCode = errors.length ? 1 : 0;
