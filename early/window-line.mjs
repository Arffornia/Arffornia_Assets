// Bake the round-4 early-window layers from early/window-line.html (854x480):
//   out/early/w4-backdrop.png, out/early/w4-overlay.png (MOTD + status baked as sample text),
//   out/early/w4-bar.png (the 350x4 gradient fill the provider crops to the progress).
import { chromium } from 'playwright';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'out/early');
const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
const p = await b.newPage({ viewport: { width: 854, height: 480 } });
for (const [q, f, transparent] of [['layer=backdrop', 'w4-backdrop.png', false], ['layer=overlay&sample', 'w4-overlay.png', true]]) {
  await p.goto(`file://${root}/early/window-line.html?${q}`); await p.evaluate(() => document.fonts.ready);
  if (transparent) await p.evaluate(() => { document.querySelector('.fill').style.display = 'none'; });
  await p.screenshot({ path: path.join(out, f), omitBackground: transparent });
}
await p.setViewportSize({ width: 350, height: 4 });
await p.setContent('<body style="margin:0;background:linear-gradient(90deg,#ffb36b,#e0703c)"></body>');
await p.screenshot({ path: path.join(out, 'w4-bar.png') });
await b.close();
