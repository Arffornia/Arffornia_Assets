#!/usr/bin/env node
// Procedural factory (spec 007): bakes the layers Arffornia_Mods composes every frame for the early
// window and the title screen, instead of a video. Per screen:
//   out/scene/<screen>/static.(png|jpg)  everything that never moves (belts without chevrons)
//   out/scene/<screen>/*.png             sprites of what moves, and mattes (the still's pixels in front of it)
//   out/scene/<screen>/scene.json        where to draw them, and their motion sampled at 60 Hz per element
// Each element loops on its own period, so the scene never has a seam: nothing jumps, nothing teleports.
//   node early/scene.mjs [early|title ...]   (CHROME_PATH for a system Chrome; needs python3 with PIL+numpy)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes/factory-line.json'), 'utf8'));
const models = Object.create(null);
for (const m of S.models) models[m.model] ||= JSON.parse(fs.readFileSync(path.join(ROOT, 'models', m.model, `${m.model}.bbmodel`), 'utf8'));
const RATE = 60;

// The early window draws its band (480x288 window px at 187,20) at FBScale up to 4; the title screen
// fills 1920x1080 design px, baked for a 4K window. Same iso camera, different framing and density.
const SCREENS = {
  early: { size: [1920, 1152], camera: { target: [12.6, 2.2, 1.6], height: 288 / 17.91, offset: [27 / 17.91, 44.5 / 17.91] }, opaque: false, grade: false },
  title: { size: [3840, 2160], camera: S.cameras['menu-left'], opaque: true, grade: true },
};

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });

async function stage(cfg, transparent) {
  const pg = await browser.newPage({ viewport: { width: 64, height: 64 } });
  await pg.goto(`http://127.0.0.1:${server.address().port}/render/stage.html`); await pg.waitForFunction(() => window.STAGE);
  await pg.evaluate((o) => window.STAGE.init(o), { size: cfg.size, look: 'night', scene: S, models, camera: cfg.camera, transparent });
  return pg;
}
const png = (url) => Buffer.from(url.split(',')[1], 'base64');
const range = (n) => Array.from({ length: n }, (_, i) => i);

async function bake(name) {
  const cfg = SCREENS[name]; const dir = path.join(ROOT, 'out/scene', name, 'raw');
  fs.rmSync(path.join(ROOT, 'out/scene', name), { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const write = (f, url) => fs.writeFileSync(path.join(dir, f), png(url));

  // 1. The still, and one mask per group of moving things.
  const a = await stage(cfg, !cfg.opaque);
  const groups = await a.evaluate(() => {
    const { STAGE } = window; const T = STAGE.THREE; STAGE.staticOnly(); STAGE.pose(0);
    const box = (min, max) => new T.Box3(new T.Vector3(...min), new T.Vector3(...max));
    const out = [];
    STAGE.beltInfo().forEach(({ cv, itemHeight }, i) => {
      const along = cv.axis === 'x', lo = -0.35, hi = cv.len + 0.35, w = 0.37;
      const min = along ? [cv.x0 + lo, 0.2, cv.c - w] : [cv.c - w, 0.2, cv.y0 + lo];
      const max = along ? [cv.x0 + hi, 0.21 + itemHeight + 0.05, cv.c + w] : [cv.c + w, 0.21 + itemHeight + 0.05, cv.y0 + hi];
      out.push({ id: `belt${i}`, belt: i, box: [min, max], matte: true });
    });
    for (const [model, bones] of Object.entries(STAGE.MOVING_BONES)) for (const bone of bones) {
      const b = new T.Box3();
      for (let k = 0; k < 48; k++) b.union(STAGE.boneBox(model, bone, k * 0.125));
      // parts that move inside their machine are baked already hidden by it (frames); the capsule
      // travels 4.8 blocks up its tower, so it gets a matte like the belt items
      if (bone === 'capsule') b.max.y += 4.8;
      out.push({ id: `${model}.${bone}`, model, bone, box: [b.min.toArray(), b.max.toArray()], matte: bone === 'capsule' });
    }
    STAGE.pose(0);
    return out;
  });
  write('static.png', await a.evaluate(() => window.STAGE.render()));
  for (const g of groups) {
    if (g.matte) {
      write(`mask.${g.id}.png`, await a.evaluate((bx) => { const T = window.STAGE.THREE; return window.STAGE.mask(new T.Box3(new T.Vector3(...bx[0]), new T.Vector3(...bx[1]))); }, g.box));
      const [glass, sil] = await a.evaluate((bx) => { const T = window.STAGE.THREE; return window.STAGE.glassFront(new T.Box3(new T.Vector3(...bx[0]), new T.Vector3(...bx[1]))); }, g.box);
      write(`glass.${g.id}.png`, glass); write(`sil.${g.id}.png`, sil);
    }
    g.depth = (g.box[0][0] + g.box[1][0] + g.box[0][2] + g.box[1][2]) / 2;
  }
  // belt tops for the scrolling chevrons, in screen px: u runs along the item motion, v across
  for (const g of groups.filter((x) => x.belt !== undefined)) {
    g.beltTop = await a.evaluate((i) => {
      const { cv } = window.STAGE.beltInfo()[i]; const along = cv.axis === 'x', y = 0.201, h = 0.3;
      const P = (u, v) => window.STAGE.project(along ? [cv.x0 + u, y, cv.c + v] : [cv.c - v, y, cv.y0 + u]);
      return { u0v0: P(0, -h), u1v0: P(cv.len, -h), u0v1: P(0, h), u1v1: P(cv.len, h), len: cv.len, speed: window.STAGE.BELT.V };
    }, g.belt);
  }
  await a.close();

  // 2. Sprites on a transparent stage, everything else hidden.
  const b = await stage(cfg, true);
  const sprites = {}; const elements = [];
  const info = await b.evaluate(() => window.STAGE.beltInfo());
  for (const [i, { cv, n }] of info.entries()) {
    const ref = cv.len / 2;
    write(`sprite.item${i}.png`, await b.evaluate(([i, ref]) => {
      const { STAGE } = window; STAGE.pose(0); const it = STAGE.beltItem(i, ref); const c = STAGE.shadowCatcher(i);
      STAGE.only([it, c]); const url = STAGE.render(); STAGE.showAll(); c.parent.remove(c); return url;
    }, [i, ref]));
    const pos = (u) => (cv.axis === 'x' ? [cv.x0 + u, 0.201, cv.c] : [cv.c, 0.201, cv.y0 + u]);
    const pivot = await b.evaluate((p) => window.STAGE.project(p), pos(ref));
    const cyc = n * S_GAP, period = cyc / S_V;
    const samples = [];
    for (const k of range(Math.round(period * RATE))) {
      const u = ((k / RATE * S_V) / cyc % 1) * cyc - 0.05;
      const visible = u >= 0 && u <= cv.len + 0.28;
      const p = await b.evaluate((q) => window.STAGE.project(q), pos(Math.max(-0.05, Math.min(cv.len + 0.28, u))));
      const scale = cv.noFade ? 1 : Math.min(1, Math.max(0, u / 0.3));
      samples.push([p[0] - pivot[0], p[1] - pivot[1], visible ? scale : 0, visible ? 1 : 0, 0]);
    }
    const phases = range(n).map((k) => ((cv.ph || 0) + k * S_GAP) / S_V);
    sprites[`item${i}`] = { pivot }; elements.push({ group: `belt${i}`, sprite: `item${i}`, period, samples, phases });
  }
  // the capsule: loaded at the base, rises, holds at the top, fades out (launched), the next fades in
  {
    write('sprite.space-elevator.capsule.png', await b.evaluate(() => { const { STAGE } = window; STAGE.pose(0); STAGE.only([STAGE.boneObject('space-elevator', 'capsule')]); const u = STAGE.render(); STAGE.showAll(); return u; }));
    const o0 = await b.evaluate(() => window.STAGE.project(window.STAGE.boneOrigin('space-elevator', 'capsule', 0)));
    const top = await b.evaluate(() => { const p = window.STAGE.boneOrigin('space-elevator', 'capsule', 0); p[1] += 4.8; return window.STAGE.project(p); });
    const period = 6, samples = [];
    const ease = (x) => x * x * (3 - 2 * x);
    for (const k of range(period * RATE)) {
      const t = k / RATE;
      const h = t < 0.9 ? 0 : t < 4.5 ? ease((t - 0.9) / 3.6) : 1;
      const alpha = t < 4.9 ? 1 : t < 5.3 ? 1 - (t - 4.9) / 0.4 : t < 5.4 ? 0 : (t - 5.4) / 0.6;
      const atBase = t >= 5.3;
      const hh = atBase ? 0 : h;
      samples.push([(top[0] - o0[0]) * hh, (top[1] - o0[1]) * hh, 1, alpha, 0]);
    }
    sprites['space-elevator.capsule'] = { pivot: o0 }; elements.push({ group: 'space-elevator.capsule', sprite: 'space-elevator.capsule', period, samples, phases: [0] });
  }
  // parts inside their machine: frames over one cycle at 30 fps, rendered hidden by the still's depth
  await b.evaluate(() => window.STAGE.staticOnly());
  for (const [model, bone, period] of [['miner', 'fan', 0.8], ['miner', 'drill', 2.4], ['constructor', 'piston', 1.6667], ['assembler', 'arm', 1.6667]]) {
    const n = Math.round(period * 30);
    for (const k of range(n)) {
      write(`frame.${model}.${bone}.${String(k).padStart(3, '0')}.png`, await b.evaluate(([m, bn, t]) => {
        const { STAGE } = window; STAGE.pose(t); const o = STAGE.boneObject(m, bn); const u = STAGE.occluded([o]); if (bn !== 'fan') o.visible = false; return u;
      }, [model, bone, k * period / n]));
    }
    const samples = range(Math.round(period * RATE)).map((k) => [0, 0, 1, 1, (k / RATE) / period * n]);
    sprites[`${model}.${bone}`] = { pivot: [0, 0], frames: n }; elements.push({ group: `${model}.${bone}`, sprite: `${model}.${bone}`, period, samples, phases: [0] });
  }
  await b.close();

  // 3. Crop, grade and write the runtime files (python: PIL + numpy).
  fs.writeFileSync(path.join(dir, 'layout.json'), JSON.stringify({ screen: name, size: cfg.size, opaque: cfg.opaque, grade: cfg.grade, groups, sprites, elements }));
  const r = spawnSync('python3', [path.join(ROOT, 'early/scene_pack.py'), dir, path.join(ROOT, 'out/scene', name)], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`scene_pack.py failed for ${name}`);
  if (cfg.grade) await overlay(path.join(ROOT, 'out/scene', name, 'overlay.png'));
}

// The title's darkening gradients (ui/title/background.html grade2 + scrim), drawn by the mod over the scene.
async function overlay(file) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(`file://${ROOT}/ui/title/background.html?overlay`);
  await p.evaluate(() => { document.querySelectorAll('img, .grade, .grain').forEach((e) => e.remove()); document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; });
  await p.screenshot({ path: file, omitBackground: true });
  await p.close();
}

const S_V = 0.9, S_GAP = 1.5; // stage.js BELT
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCREENS)) await bake(name);
await browser.close(); server.close();
