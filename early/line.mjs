#!/usr/bin/env node
// Early-window assembly line (spec 007): the factory-line scene as a seamless loop of frames, drawn by
// our own provider in a band of the 854x480 early window at FBScale 2 (so the frames are 2x).
//   node early/line.mjs                -> out/early/line/f0000.png ... + line.json
//   node early/line.mjs --frames <cam> -> out/scenes/factory-line/ui/<cam>-night.frames (title screen clip)
// Both are one LOOP-second loop: stage.js retimes every belt and animation to whole cycles in it.
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
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });
// 20/3 s closes the belts (1.11 s texture, 1.67 s items) and the 1.67 s machines exactly; the miner
// (2.4 s) and the elevator (6 s) run 8 % and 10 % slower. 3 s, the old loop, closed nothing.
const LOOP = 20 / 3, FPS = 12, N = Math.round(LOOP * FPS);
const loopTimes = () => Array.from({ length: N }, (_, i) => i / FPS);
async function frames(size, camera, times, transparent = false) {
  const pg = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  await pg.goto(`http://127.0.0.1:${server.address().port}/render/stage.html`); await pg.waitForFunction(() => window.STAGE);
  await pg.evaluate((o) => window.STAGE.init(o), { size, look: 'night', scene: S, models, camera, transparent, loop: LOOP });
  const out = []; for (const t of times) out.push(Buffer.from((await pg.evaluate((tt) => window.STAGE.renderFrame(tt), t)).split(',')[1], 'base64'));
  await pg.close(); return out;
}
const args = process.argv.slice(2);
if (args[0] === '--frames') {
  const cam = args[1] || 'menu-left'; const dir = path.join(ROOT, `out/scenes/factory-line/ui/${cam}-night.frames`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const fr = await frames([1920, 1080], S.cameras[cam], loopTimes());
  fr.forEach((b, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), b));
  fs.writeFileSync(path.join(dir, 'clip.json'), JSON.stringify({ frames: N, fps: FPS, size: [1920, 1080], loop: true }, null, 1) + '\n');
} else if (args[0] === '--probe') {
  // measure the line's real extent over the whole loop: a big cell at the frames' pixel density
  const dir = args[1]; fs.mkdirSync(dir, { recursive: true });
  const cam = JSON.parse(args[2]); const size = JSON.parse(args[3]);
  const fr = await frames(size, cam, loopTimes(), true);
  fr.forEach((b, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), b));
} else {
  // The cell fits the line's measured extent (`--probe`) with the content centred, and
  // `early/check-sheet.py` fails if any frame touches its cell edge. 480x288 window pixels at the
  // round 4 density (17.9 px per block), rendered at 2x for the FBScale 2 framebuffer, then laid on
  // the backdrop under the cell (at window pixel `at`) and stored as JPEG: an opaque frame needs no
  // alpha, and a still part of the picture encodes to the same bytes in every frame, so it cannot shimmer.
  const cell = [960, 576], at = [187, 20];
  const backdrop = path.join(ROOT, 'out/early/w4-backdrop@2x.png');
  if (!fs.existsSync(backdrop)) throw new Error(`missing ${backdrop}: run node early/window-line.mjs first`);
  const cam = { target: [12.6, 2.2, 1.6], height: 288 / 17.91, offset: [27 / 17.91, 44.5 / 17.91] };
  const fr = await frames(cell, cam, loopTimes(), true);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'line-'));
  fr.forEach((b, i) => fs.writeFileSync(path.join(tmp, `f${String(i).padStart(4, '0')}.png`), b));
  const dir = path.join(ROOT, 'out/early/line');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'line.json'), JSON.stringify({ frames: N, fps: FPS, cell, at, scale: 2, loop: true }, null, 1) + '\n');
  fs.copyFileSync(path.join(dir, 'line.json'), path.join(tmp, 'line.json'));
  const check = spawnSync('python3', [path.join(ROOT, 'early/check-sheet.py'), tmp], { stdio: 'inherit' });
  if (check.status !== 0) throw new Error('line frames failed early/check-sheet.py');
  const crop = `crop=${cell[0]}:${cell[1]}:${at[0] * 2}:${at[1] * 2}`;
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', backdrop, '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'),
    '-filter_complex', `[0]${crop}[b];[b][1]overlay=format=auto,format=yuvj420p`, '-q:v', '3', '-frames:v', String(N), '-start_number', '0', path.join(dir, 'f%04d.jpg')], { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true });
}
await browser.close(); server.close();
