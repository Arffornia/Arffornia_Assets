#!/usr/bin/env node
// Render the title/loading UI direction mock-ups over the factory-line backgrounds.
//   node ui/render.mjs [a b ...]     (default: all directions)
// Needs the ui-* background jobs from pipeline.json (npm run render) first.
// Output: out/ui/<direction>/{title.png,loading.png,title.mp4,title.webp}
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BG = 'out/scenes/factory-line/ui';
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes/factory-line.json'), 'utf8'));
// same projection as render/stage.js (orthographic, true isometric, yaw 0)
const proj = (cam, [x, y, z], SW = 1920, SH = 1080) => { const d = [x - cam.target[0], y - cam.target[1], z - cam.target[2]]; const W = cam.height * SW / SH; const o = cam.offset || [0, 0];
  const rx = (d[0] - d[2]) * Math.SQRT1_2, uy = d[1] * 0.8165 - (d[0] + d[2]) * 0.4082;
  return [((rx + W / 2 + o[0]) / W) * SW, ((cam.height / 2 - o[1] - uy) / cam.height) * SH].map(Math.round); };
const DIRS = {
  a: { page: 'a-honeycomb', bg: 'menu-left-night' },
  b: { page: 'b-drafting', bg: 'menu-left-night' },
  c: { page: 'c-launcher', bg: 'title-night' },
  d: { page: 'd-shift-board', bg: 'menu-right-night' },
  f: { page: 'f-honeycomb-launcher', bg: 'menu-left-night' },
  e: { page: 'e-maquette', bg: 'menu-right-maquette', extra: () => `&tag=${proj(S.cameras['menu-right'], [24, 9.4, 3.5]).join(',')}` },
};
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DIRS);

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const t = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }[path.extname(p)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': t }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
const ff = (argv, frames) => new Promise((res, rej) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...argv], { stdio: ['pipe', 'inherit', 'inherit'] }); p.on('exit', (c) => (c ? rej(new Error('ffmpeg')) : res())); for (const f of frames) p.stdin.write(f); p.stdin.end(); });
const BX = ['-fflags', '+bitexact', '-flags:v', '+bitexact', '-threads', '1'];

for (const k of want) {
  const D = DIRS[k]; const out = path.join(ROOT, 'out/ui', D.page); fs.mkdirSync(out, { recursive: true });
  const url = (mode, bg, prog = 0.62) => `${base}/ui/directions/${D.page}.html?record=1&mode=${mode}&progress=${prog}&bg=${encodeURIComponent(bg)}${D.extra ? D.extra() : ''}`;
  for (const mode of ['title', 'loading']) {
    const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await pg.goto(url(mode, `/${BG}/${D.bg}.png`)); await pg.waitForFunction(() => window.UI);
    await pg.evaluate(() => window.UI.frame(30)); // all intro animations finished
    await pg.screenshot({ path: path.join(out, `${mode}.png`) }); await pg.close();
  }
  // clip: the title intro over the animated factory (4 s, 24 fps, 1280x720)
  const dir = path.join(ROOT, BG, `${D.bg}.frames`); const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.goto(url('title', `/${BG}/${D.bg}.frames/${files[0]}`)); await pg.waitForFunction(() => window.UI);
  const frames = [];
  for (let i = 0; i < files.length; i++) { await pg.evaluate(([t, f]) => window.UI.frame(t, f), [i / 24, `/${BG}/${D.bg}.frames/${files[i]}`]); frames.push(await pg.screenshot()); }
  await pg.close();
  await ff(['-f', 'image2pipe', '-framerate', '24', '-c:v', 'png', '-i', '-', ...BX, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'title.mp4')], frames);
  await ff(['-f', 'image2pipe', '-framerate', '24', '-c:v', 'png', '-i', '-', ...BX, '-vf', 'scale=640:-1:flags=lanczos', '-c:v', 'libwebp_anim', '-q:v', '72', '-loop', '0', path.join(out, 'title.webp')], frames);
  console.log(`ok ${D.page}`);
}
await browser.close(); server.close();
