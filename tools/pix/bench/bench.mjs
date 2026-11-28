#!/usr/bin/env node
// Bench: compare a candidate machine with an Oritech reference, view by view.
//   node tools/pix/bench/bench.mjs ref <target>              fetch + render the reference -> out/bench/<target>/ref/
//   node tools/pix/bench/bench.mjs score <target> <cand-id>  render concepts/pix/<cand>/ the same way, score, sheet
// Scores (all automatic, the judgement stays human or a judge agent):
//   iou[v]      silhouette overlap per view (scale-free: both are framed on their own bounds)
//   aspect      candidate / reference bounding-box ratios (w:h:d), 1 is ideal
//   cubes       element count, texels: unique colours, variation (share of texels differing from the right neighbour)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openViewer } from '../../view/driver.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/pix/bench/targets.json'), 'utf8'));
const [cmd, target, cand] = process.argv.slice(2);
const T = CFG.targets[target];
if (!T || !['ref', 'score'].includes(cmd)) { console.error('usage: bench.mjs ref <target> | score <target> <cand>'); process.exit(2); }
const OUT = path.join(ROOT, 'out/bench', target);
const magick = (...a) => execFileSync('magick', a, { encoding: 'utf8' }).trim();

async function fetchTo(url, file) {
  if (fs.existsSync(file)) return;
  const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

async function renderSet(model, glowPng, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const glowmask = `data:image/png;base64,${glowPng.toString('base64')}`;
  const v = await openViewer();
  try {
    for (const [i, [yaw, pitch]] of CFG.views.entries()) {
      const h = await v.render({ size: [800, 800], mode: 'hero', model, glowmask, t: 0, yaw, pitch, player: false });
      fs.writeFileSync(path.join(dir, `hero${i}.png`), h.frames[0]);
      const s = await v.render({ size: [400, 400], mode: 'silhouette', model, t: 0, yaw, pitch });
      fs.writeFileSync(path.join(dir, `sil${i}.png`), s.frames[0]);
      if (i === 0) fs.writeFileSync(path.join(dir, 'size.json'), JSON.stringify(h.info.size));
    }
  } finally { await v.close(); }
}

const texStats = (png) => {
  const mask = (f) => magick(png, ...f, '-format', '%[fx:mean]', 'info:');
  const alpha = Number(mask(['-alpha', 'extract']));
  const diff = Number(magick(png, '(', '+clone', '-roll', '+1+0', ')', '-compose', 'difference', '-composite', '-alpha', 'off', '-colorspace', 'gray', '-threshold', '1%', '(', png, '-alpha', 'extract', ')', '-compose', 'multiply', '-composite', '-format', '%[fx:mean]', 'info:'));
  return { colours: Number(magick(png, '-alpha', 'off', '-unique-colors', '-format', '%w', 'info:')), variation: alpha ? +(diff / alpha).toFixed(3) : 0 };
};

if (cmd === 'ref') {
  const cache = path.join(OUT, 'src');
  await fetchTo(`${CFG.source}/${T.geo}`, path.join(cache, 'model.geo.json'));
  await fetchTo(`${CFG.source}/${T.tex}`, path.join(cache, 'texture.png'));
  if (T.glow) await fetchTo(`${CFG.source}/${T.glow}`, path.join(cache, 'glow.png'));
  execFileSync('node', [path.join(ROOT, 'tools/pix/geo2bb.mjs'), path.join(cache, 'model.geo.json'), path.join(cache, 'texture.png'), path.join(cache, 'model.bbmodel')], { stdio: 'inherit' });
  const glow = T.glow ? fs.readFileSync(path.join(cache, 'glow.png')) : Buffer.from(magick('-size', '1x1', 'xc:none', 'png:-'), 'binary');
  const model = JSON.parse(fs.readFileSync(path.join(cache, 'model.bbmodel'), 'utf8'));
  await renderSet(model, T.glow ? glow : execFileSync('magick', ['-size', '1x1', 'xc:none', 'png:-']), path.join(OUT, 'ref'));
  fs.writeFileSync(path.join(OUT, 'ref', 'stats.json'), JSON.stringify({ cubes: model.elements.length, ...texStats(path.join(cache, 'texture.png')) }));
  fs.writeFileSync(path.join(OUT, 'brief.txt'), T.brief + '\n');
  console.log(`reference: ${path.relative(ROOT, path.join(OUT, 'ref'))}`);
} else {
  const dir = path.join(ROOT, 'concepts/pix', cand);
  const model = JSON.parse(fs.readFileSync(path.join(dir, `${cand}.bbmodel`), 'utf8'));
  const cdir = path.join(OUT, cand);
  await renderSet(model, fs.readFileSync(path.join(dir, `${cand}_glowmask.png`)), cdir);
  const iou = CFG.views.map((_, i) => {
    const a = path.join(OUT, 'ref', `sil${i}.png`), b = path.join(cdir, `sil${i}.png`);
    const m = (f) => ['(', f, '-alpha', 'off', '-colorspace', 'gray', '-negate', '-threshold', '50%', ')'];
    const inter = Number(magick(...m(a), ...m(b), '-compose', 'multiply', '-composite', '-format', '%[fx:mean]', 'info:'));
    const uni = Number(magick(...m(a), ...m(b), '-compose', 'lighten', '-composite', '-format', '%[fx:mean]', 'info:'));
    return uni ? +(inter / uni).toFixed(3) : 0;
  });
  const rs = JSON.parse(fs.readFileSync(path.join(OUT, 'ref', 'size.json'))), cs = JSON.parse(fs.readFileSync(path.join(cdir, 'size.json')));
  const norm = (s) => s.map((x) => x / s[1]);
  const aspect = norm(cs).map((x, i) => +(x / norm(rs)[i]).toFixed(2));
  const ref = JSON.parse(fs.readFileSync(path.join(OUT, 'ref', 'stats.json')));
  const score = { target, cand, iou, iouMean: +(iou.reduce((s, x) => s + x, 0) / iou.length).toFixed(3), aspect, cubes: model.elements.length, refCubes: ref.cubes, ...texStats(path.join(dir, `${cand}.png`)), refColours: ref.colours, refVariation: ref.variation };
  fs.writeFileSync(path.join(cdir, 'score.json'), JSON.stringify(score, null, 1));
  // silhouette overlay per view: white = both, magenta = reference only (missing mass), green = candidate only (extra mass)
  CFG.views.forEach((_, i) => {
    const a = path.join(OUT, 'ref', `sil${i}.png`), b = path.join(cdir, `sil${i}.png`);
    const m = (f) => ['(', f, '-alpha', 'off', '-colorspace', 'gray', '-negate', '-threshold', '50%', ')'];
    magick(...m(a), ...m(b), ...m(a), '-channel', 'RGB', '-combine', '-resize', '800x800', path.join(cdir, `ovl${i}.png`));
  });
  const rows = CFG.views.map((_, i) => ['(', path.join(OUT, 'ref', `hero${i}.png`), path.join(cdir, `hero${i}.png`), path.join(cdir, `ovl${i}.png`), '+append', ')']).flat();
  magick(...rows, '-append', '-resize', '1500x', path.join(cdir, 'compare.jpg'));
  // animation: 8 frames (not 6: a 6-fold rotor would look frozen) of the first animation over its length, from the first view
  const anim = (model.animations || [])[0];
  if (anim) {
    const v = await openViewer(); const frames = [];
    try { for (let k = 0; k < 8; k++) { const r = await v.render({ size: [400, 400], mode: 'hero', model, glowmask: `data:image/png;base64,${fs.readFileSync(path.join(dir, `${cand}_glowmask.png`)).toString('base64')}`, anim: anim.name, t: (anim.length * k) / 8, yaw: CFG.views[0][0], pitch: CFG.views[0][1], player: false }); const f = path.join(cdir, `anim${k}.png`); fs.writeFileSync(f, r.frames[0]); frames.push(f); } } finally { await v.close(); }
    magick(...frames, '+append', path.join(cdir, 'anim.jpg')); frames.forEach((f) => fs.rmSync(f));
    console.log(`anim: ${path.relative(ROOT, path.join(cdir, 'anim.jpg'))} (${anim.name}, ${anim.length}s, 8 frames)`);
  }
  console.log(JSON.stringify(score));
  console.log(`sheet: ${path.relative(ROOT, path.join(cdir, 'compare.jpg'))} (left: reference, right: candidate)`);
}
