#!/usr/bin/env node
// Early-window assembly line (spec 007 round 3): the factory-line scene as a 20 fps sprite sheet,
// drawn 1:1 (no upscaling) in a band of the 854x480 early window by our own provider.
//   node early/line.mjs                -> out/early/line-20fps.sheet.png + .json
//   node early/line.mjs --frames <cam> -> out/scenes/factory-line/ui/<cam>-night.frames (title clip background)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes/factory-line.json'), 'utf8'));
const models = Object.create(null);
for (const m of S.models) models[m.model] ||= JSON.parse(fs.readFileSync(path.join(ROOT, 'models', m.model, `${m.model}.bbmodel`), 'utf8'));
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });
async function frames(size, camera, times, transparent = false) {
  const pg = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  await pg.goto(`http://127.0.0.1:${server.address().port}/render/stage.html`); await pg.waitForFunction(() => window.STAGE);
  await pg.evaluate((o) => window.STAGE.init(o), { size, look: 'night', scene: S, models, camera, transparent });
  const out = []; for (const t of times) out.push(Buffer.from((await pg.evaluate((tt) => window.STAGE.renderFrame(tt), t)).split(',')[1], 'base64'));
  await pg.close(); return out;
}
const args = process.argv.slice(2);
if (args[0] === '--frames') {
  const cam = args[1] || 'menu-left'; const dir = path.join(ROOT, `out/scenes/factory-line/ui/${cam}-night.frames`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const fr = await frames([1280, 720], S.cameras[cam], Array.from({ length: 96 }, (_, i) => 1 + i / 24));
  fr.forEach((b, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), b));
} else {
  // 3 s loop (60 ticks): belts repeat every 1.67 s and the machines every 0.6-3 s, so 3 s is the
  // shortest loop that closes for the whole line. The band is 640x240, the line framed tight.
  const cell = [640, 240], n = 60, cols = 6, rows = 10;
  const cam = { target: [12.6, 2.2, 1.6], height: 13.4 };
  const fr = await frames(cell, cam, Array.from({ length: n }, (_, i) => i / 20), true); // transparent: the line sits on the window's own night colour
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'line-'));
  fr.forEach((b, i) => fs.writeFileSync(path.join(tmp, `f${String(i).padStart(4, '0')}.png`), b));
  fs.mkdirSync(path.join(ROOT, 'out/early'), { recursive: true });
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(tmp, 'f%04d.png'), '-vf', `tile=${cols}x${rows}:color=0x00000000`, '-frames:v', '1', path.join(ROOT, 'out/early/line-20fps.sheet.png')], { stdio: 'inherit' });
  fs.writeFileSync(path.join(ROOT, 'out/early/line-20fps.sheet.json'), JSON.stringify({ frames: n, fps: 20, cols, rows, cell, loop: true }, null, 1) + '\n');
  fs.rmSync(tmp, { recursive: true });
}
await browser.close(); server.close();
