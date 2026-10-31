#!/usr/bin/env node
// Re-export every derived asset from the source models (models/*/*.bbmodel) and scenes.
//
//   node render/build.mjs                 build everything listed in pipeline.json
//   node render/build.mjs --changed       only jobs whose inputs changed (hash in out/manifest.json)
//   node render/build.mjs --check         exit 1 if any output is stale (CI gate)
//   node render/build.mjs --only miner    restrict to one model or scene id (repeatable)
//
// Deterministic: every frame is a pure function of t (no clocks, no randomness), rendered by
// three.js in headless Chromium on SwiftShader (CPU), and encoded with bit-exact ffmpeg flags.
// Same inputs + same container image = same bytes.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'out');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const only = args.flatMap((a, i) => (args[i - 1] === '--only' ? [a] : []));
const PIPE = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline.json'), 'utf8'));
const sha = (...parts) => { const h = crypto.createHash('sha256'); for (const p of parts) h.update(p); return h.digest('hex').slice(0, 16); };
const ENGINE = sha(...['render/stage.js', 'render/bbmodel.js', 'render/build.mjs', 'package-lock.json'].map((f) => fs.readFileSync(path.join(ROOT, f))));

// ------------------------------------------------------------------ jobs
const modelIds = fs.readdirSync(path.join(ROOT, 'models')).filter((d) => fs.existsSync(path.join(ROOT, 'models', d, `${d}.bbmodel`))).sort();
const readModel = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'models', id, `${id}.bbmodel`), 'utf8'));
const jobs = [];
for (const id of modelIds) {
  if (only.length && !only.includes(id)) continue;
  const src = fs.readFileSync(path.join(ROOT, 'models', id, `${id}.bbmodel`));
  for (const spec of PIPE.model) jobs.push({ name: `${id}:${spec.id}`, spec, model: id, file: spec.file.replaceAll('{id}', id), hash: sha(ENGINE, src, JSON.stringify(spec)) });
}
for (const [sid, specs] of Object.entries(PIPE.scenes)) {
  if (only.length && !only.includes(sid)) continue;
  const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes', `${sid}.json`), 'utf8'));
  const srcs = [JSON.stringify(S), ...[...new Set(S.models.map((m) => m.model))].sort().map((m) => fs.readFileSync(path.join(ROOT, 'models', m, `${m}.bbmodel`)))];
  for (const spec of specs) jobs.push({ name: `${sid}:${spec.id}`, spec, scene: S, file: spec.file, hash: sha(ENGINE, ...srcs, JSON.stringify(spec)) });
}

const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { outputs: {} };
const outputsOf = (j) => (j.spec.formats ? j.spec.formats.map((f) => `${j.file}.${f}`) : [j.file]);
const fresh = (j) => manifest.outputs[j.name]?.hash === j.hash && outputsOf(j).every((f) => fs.existsSync(path.join(OUT, f)));
const todo = flag('--changed') || flag('--check') ? jobs.filter((j) => !fresh(j)) : jobs;
if (flag('--check')) {
  if (todo.length) { console.error(`stale outputs (run: npm run render:changed):\n  ${todo.map((j) => j.name).join('\n  ')}`); process.exit(1); }
  console.log(`all ${jobs.length} outputs are fresh`); process.exit(0);
}
if (!todo.length) { console.log('nothing to do'); process.exit(0); }

// ------------------------------------------------------------------ static server + browser
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.bbmodel': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--disable-lcd-text'] });

async function stage(opts) {
  const pg = await browser.newPage({ viewport: { width: opts.size[0], height: opts.size[1] }, deviceScaleFactor: 1 });
  pg.on('pageerror', (e) => console.error('page error:', e.message));
  await pg.goto(`${base}/render/stage.html`);
  await pg.waitForFunction(() => window.STAGE);
  const info = await pg.evaluate((o) => window.STAGE.init(o), opts);
  return { pg, info, frame: async (t) => Buffer.from((await pg.evaluate((tt) => window.STAGE.renderFrame(tt), t)).split(',')[1], 'base64') };
}

const BITEXACT = ['-fflags', '+bitexact', '-flags:v', '+bitexact', '-threads', '1'];
function ffmpeg(argv, input) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...argv], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('exit', (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())); if (input) input(p.stdin);
  });
}
const encoders = {
  mp4: (fps, out) => ['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', ...BITEXACT, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  webp: (fps, out) => ['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', ...BITEXACT, '-vf', 'scale=480:-1:flags=lanczos', '-c:v', 'libwebp_anim', '-q:v', '78', '-loop', '0', out],
};

function modelOpts(j, extra = {}) {
  const models = Object.create(null); let anim = 0; // null prototype: 'constructor' is a model id
  if (j.model) models[j.model] = readModel(j.model);
  else for (const m of j.scene.models) models[m.model] ||= readModel(m.model);
  return { size: j.spec.size, look: j.spec.look || 'night', transparent: !!j.spec.transparent, model: j.model, scene: j.scene, camera: j.scene ? j.scene.cameras[j.spec.camera] : undefined, models, anim, ...extra };
}
// loop length: the model's animation length (repeated to reach the requested seconds), or the requested seconds
const loopLen = (info, want) => { const L = Math.max(0, ...info.anim); return L > 0 ? L * Math.max(1, Math.round(want / L)) : want; };

async function run(j) {
  const out = path.join(OUT, j.file); fs.mkdirSync(path.dirname(out), { recursive: true });
  const s = j.spec;
  if (s.kind === 'still') {
    const st = await stage(modelOpts(j)); fs.writeFileSync(out, await st.frame(s.t ?? 0.4)); await st.pg.close(); return;
  }
  if (s.kind === 'glb') {
    const st = await stage(modelOpts(j, { size: [64, 64], transparent: true })); fs.writeFileSync(out, Buffer.from(await st.pg.evaluate(() => window.STAGE.exportGLB()), 'base64')); await st.pg.close(); return;
  }
  if (s.kind === 'clip') {
    const probe = await stage(modelOpts(j)); const L = loopLen(probe.info, s.seconds); await probe.pg.close();
    const st = await stage(modelOpts(j, { turntable: s.turntable ? 360 / L : 0 }));
    const n = Math.round(L * s.fps); const frames = [];
    for (let i = 0; i < n; i++) frames.push(await st.frame(i / s.fps));
    await st.pg.close();
    for (const f of s.formats) await ffmpeg(encoders[f](s.fps, `${out}.${f}`), (w) => { for (const b of frames) w.write(b); w.end(); });
    return;
  }
  if (s.kind === 'frames') { // a PNG sequence (backgrounds for UI mock-ups, editing in a video tool)
    fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
    const st = await stage(modelOpts(j)); const n = Math.round(s.seconds * s.fps);
    for (let i = 0; i < n; i++) fs.writeFileSync(path.join(out, `f${String(i).padStart(4, '0')}.png`), await st.frame((s.start || 0) + i / s.fps));
    await st.pg.close(); return;
  }
  if (s.kind === 'sheet' || s.kind === 'svg') {
    const size = s.size || [s.cell, s.cell];
    const st = await stage(modelOpts(j, { size, transparent: s.kind === 'svg' ? true : s.transparent }));
    const L = s.seconds || Math.max(...st.info.anim, 0) || 1 / s.fps; const n = Math.max(1, Math.round(L * s.fps));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arf-sheet-'));
    for (let i = 0; i < n; i++) fs.writeFileSync(path.join(tmp, `f${String(i).padStart(4, '0')}.png`), await st.frame(i / s.fps));
    await st.pg.close();
    const cols = s.cols || Math.min(n, s.kind === 'svg' ? n : Math.ceil(Math.sqrt(n * size[1] / size[0]))); const rows = Math.ceil(n / cols);
    const sheet = s.kind === 'svg' ? path.join(tmp, 'sheet.webp') : out;
    const enc = s.kind === 'svg' ? ['-c:v', 'libwebp', '-lossless', '0', '-q:v', '82'] : [];
    await ffmpeg(['-framerate', '1', '-i', path.join(tmp, 'f%04d.png'), ...BITEXACT, '-vf', `tile=${cols}x${rows}:color=0x00000000`, '-frames:v', '1', ...enc, sheet]);
    if (s.kind === 'sheet') {
      fs.writeFileSync(out.replace(/\.png$/, '.json'), JSON.stringify({ frames: n, fps: s.fps, cols, rows, cell: size, loop: true }, null, 1) + '\n');
    } else {
      const uri = `data:image/webp;base64,${fs.readFileSync(sheet).toString('base64')}`; const [w, h] = size;
      const dur = (n / s.fps).toFixed(3);
      fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${readModel(j.model).arffornia?.title || j.model}, animated">`
        + `<style>@keyframes play{to{transform:translateX(-${w * n}px)}}.s{animation:play ${dur}s steps(${n}) infinite}@media (prefers-reduced-motion:reduce){.s{animation:none}}</style>`
        + `<defs><clipPath id="v"><rect width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#v)"><image class="s" href="${uri}" xlink:href="${uri}" width="${w * n}" height="${h}"/></g></svg>\n`);
    }
    fs.rmSync(tmp, { recursive: true });
    return;
  }
  throw new Error(`unknown kind ${s.kind}`);
}

let failed = 0;
for (const j of todo) {
  const t0 = Date.now();
  try { await run(j); manifest.outputs[j.name] = { hash: j.hash, files: outputsOf(j) }; console.log(`ok   ${j.name.padEnd(34)} ${((Date.now() - t0) / 1000).toFixed(1)}s`); }
  catch (e) { failed++; console.error(`FAIL ${j.name}: ${e.message}`); }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({ engine: ENGINE, outputs: Object.fromEntries(Object.entries(manifest.outputs).sort()) }, null, 1) + '\n');
}
await browser.close(); server.close();
if (failed) process.exit(1);
void spawnSync;
