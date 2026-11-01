#!/usr/bin/env node
// Round 4 renders: title stills per tile skin + the keyboard-navigation clip.
//   node ui/render-r4.mjs <outDir> [skin ...]     default skins: machined glass extruded
// Clip: skin = first one given, scripted keys/mouse (?script=nav), 10.5 s at 24 fps, 1280x720,
// over the seamless 3 s factory loop (node early/line.mjs --frames menu-left 72).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BG = 'out/scenes/factory-line/ui';
const [outDir, ...rest] = process.argv.slice(2); const skins = rest.length ? rest : ['machined', 'glass', 'extruded'];
const clipOnly = process.env.CLIP_ONLY === '1', noClip = process.env.NO_CLIP === '1';
fs.mkdirSync(outDir, { recursive: true });
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const t = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }[path.extname(p)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': t }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
const url = (skin, bg, extra = '') => `${base}/ui/directions/g-honeycomb-r4.html?record=1&mode=title&skin=${skin}&bg=${encodeURIComponent(bg)}${extra}`;
if (!clipOnly) for (const skin of skins) {
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto(url(skin, `/${BG}/menu-left-night.png`)); await pg.waitForFunction(() => window.UI); await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => window.UI.frame(30)); await pg.screenshot({ path: path.join(outDir, `title.${skin}.png`) });
  // the same screen with the selection moved (keyboard), to show the selector away from Play
  await pg.goto(url(skin, `/${BG}/menu-left-night.png`, '&script=nav&keys=0')); await pg.waitForFunction(() => window.UI); await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => window.UI.frame(2.9)); await pg.screenshot({ path: path.join(outDir, `title.${skin}.selected-mods.png`) });
  await pg.close(); console.log('still', skin);
}
if (!noClip) {
  const skin = skins[0]; const dir = path.join(ROOT, BG, 'menu-left-night.frames'); const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.goto(url(skin, `/${BG}/menu-left-night.frames/${files[0]}`, '&script=nav')); await pg.waitForFunction(() => window.UI); await pg.evaluate(() => document.fonts.ready);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '24', '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(outDir, `title.${skin}.keyboard.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(10.5 * 24);
  for (let i = 0; i < n; i++) { await pg.evaluate(([t, f]) => window.UI.frame(t, f), [i / 24, `/${BG}/menu-left-night.frames/${files[i % files.length]}`]); ff.stdin.write(await pg.screenshot()); }
  ff.stdin.end(); await new Promise((r) => ff.on('exit', r)); await pg.close(); console.log('clip', skin);
}
await browser.close(); server.close();
