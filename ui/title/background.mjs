// Bake the title screen background (spec 007 D11 a): the menu-left factory clip graded like the
// mock-up -> out/ui/title-background/f0000.jpg ... + clip.json, 1920x1080, one seamless loop.
// Needs the clip first: node early/line.mjs --frames menu-left
// JPEG: the mod decodes the frames itself, and a still part of the picture (grain included, it is the
// same in every frame) encodes to the same bytes in every frame, so it cannot shimmer.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const clip = path.join(root, 'out/scenes/factory-line/ui/menu-left-night.frames');
if (!fs.existsSync(path.join(clip, 'clip.json'))) throw new Error(`missing ${clip}/clip.json: run node early/line.mjs --frames menu-left`);
const meta = JSON.parse(fs.readFileSync(path.join(clip, 'clip.json'), 'utf8'));
const out = path.join(root, 'out/ui/title-background');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.goto(`file://${root}/ui/title/background.html`);
for (let i = 0; i < meta.frames; i++) {
  const name = `f${String(i).padStart(4, '0')}`;
  await p.evaluate(async (src) => { const img = document.querySelector('img'); img.src = src; await img.decode(); }, `file://${clip}/${name}.png`);
  await p.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 80 });
}
fs.writeFileSync(path.join(out, 'clip.json'), JSON.stringify({ ...meta, size: [1920, 1080] }, null, 1) + '\n');
await b.close();
