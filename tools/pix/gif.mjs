#!/usr/bin/env node
// Animated GIF of a pix machine: node tools/pix/gif.mjs <id> [anim=first] [frames=48] [yaw=38] -> out/pix/<id>/<anim>.gif
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openViewer } from '../view/driver.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const [id, animName, nArg, yaw = 38] = process.argv.slice(2);
if (!id) { console.error('usage: gif.mjs <id> [anim] [frames] [yaw]'); process.exit(2); }
const dir = path.join(ROOT, 'concepts/pix', id);
const model = JSON.parse(fs.readFileSync(path.join(dir, `${id}.bbmodel`), 'utf8'));
const glowmask = `data:image/png;base64,${fs.readFileSync(path.join(dir, `${id}_glowmask.png`)).toString('base64')}`;
const anim = animName ? model.animations.find((a) => a.name === animName) : model.animations[0];
if (!anim) { console.error(`${id}: no animation ${animName || ''}`); process.exit(1); }
// 15 frames per second by default: at 8 fps a gear advancing one tooth per frame looks frozen (stroboscope)
const n = Number(nArg) || Math.min(240, Math.round(15 * anim.length));
const out = path.join(ROOT, 'out/pix', id); const tmp = path.join(out, `.${anim.name}-frames`);
fs.mkdirSync(tmp, { recursive: true });
const v = await openViewer();
try {
  for (let k = 0; k < n; k++) {
    const r = await v.render({ size: [640, 640], mode: 'hero', model, glowmask, anim: anim.name, t: (anim.length * k) / n, yaw: Number(yaw), pitch: 24, player: false });
    fs.writeFileSync(path.join(tmp, `f${String(k).padStart(3, '0')}.png`), r.frames[0]);
  }
} finally { await v.close(); }
const gif = path.join(out, `${anim.name}.gif`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(n / anim.length), '-i', path.join(tmp, 'f%03d.png'), '-vf', 'split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse', '-loop', '0', gif]);
fs.rmSync(tmp, { recursive: true });
console.log(path.relative(ROOT, gif));
