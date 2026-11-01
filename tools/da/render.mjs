#!/usr/bin/env node
// Concept renders for the DA board: out/da/<direction>/<machine>.{hero,sil}.png
//   node tools/da/render.mjs [filter...] [--size 1400x1050] [--t 0.4]
import fs from 'node:fs';
import path from 'node:path';
import { openViewer } from '../view/driver.mjs';
import { DIRECTIONS } from './directions.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const filters = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const [W, H] = opt('--size', '1400x1050').split('x').map(Number);
const T = Number(opt('--t', '0.4'));
const only = opt('--only', 'hero,sil').split(',');

const v = await openViewer();
try {
  for (const did of Object.keys(DIRECTIONS)) {
    const dir = path.join(ROOT, 'concepts', did); if (!fs.existsSync(dir)) continue;
    for (const mid of fs.readdirSync(dir).sort()) {
      const id = `${did}/${mid}`; if (filters.length && !filters.some((f) => id.includes(f))) continue;
      const model = JSON.parse(fs.readFileSync(path.join(dir, mid, `${mid}.bbmodel`), 'utf8'));
      const glowmask = `data:image/png;base64,${fs.readFileSync(path.join(dir, mid, `${mid}_glowmask.png`)).toString('base64')}`;
      const out = path.join(ROOT, 'out/da', did); fs.mkdirSync(out, { recursive: true });
      const L = DIRECTIONS[did].look; const anim = (model.animations[0] || {}).name;
      const cam = { yaw: 38, pitch: 24, ...(model.arffornia.camera || {}) };
      const t0 = Date.now();
      if (only.includes('hero')) { const r = await v.render({ size: [W, H], mode: 'hero', model, glowmask, anim, t: T, ...L, ...cam }); fs.writeFileSync(path.join(out, `${mid}.hero.png`), r.frames[0]); }
      if (only.includes('sil')) { const r = await v.render({ size: [480, 480], mode: 'silhouette', model, anim, t: T, yaw: 38, pitch: 18, zoom: 1.04 }); fs.writeFileSync(path.join(out, `${mid}.sil.png`), r.frames[0]); }
      console.log(`${id.padEnd(28)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  }
} finally { await v.close(); }
