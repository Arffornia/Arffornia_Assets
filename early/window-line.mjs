// Bake the round-4 early-window layers from early/window-line.html (854x480):
//   out/early/w4-backdrop.png, out/early/w4-overlay.png (logo + wordmark + track only: what ships),
//   out/early/w4-sample.png (the same with every live line as sample text, for the stills only),
//   out/early/w4-bar.png (the 350x4 gradient fill the provider crops to the progress),
//   and each of them again at 2x as *@2x.png.
import { chromium } from 'playwright';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'out/early');
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
// @2x for `earlyWindowFBScale = 2`: the provider draws into a 1708x960 framebuffer.
for (const [scale, suffix] of [[1, ''], [2, '@2x']]) {
  const p = await b.newPage({ viewport: { width: 854, height: 480 }, deviceScaleFactor: scale });
  for (const [q, f, transparent] of [['layer=backdrop', 'w4-backdrop', false], ['layer=overlay', 'w4-overlay', true], ['layer=overlay&sample', 'w4-sample', true]]) {
    await p.goto(`file://${root}/early/window-line.html?${q}`); await p.evaluate(() => document.fonts.ready);
    if (transparent) await p.evaluate(() => { document.querySelector('.fill').style.display = 'none'; });
    await p.screenshot({ path: path.join(out, `${f}${suffix}.png`), omitBackground: transparent });
  }
  await p.setViewportSize({ width: 350, height: 4 });
  await p.setContent('<body style="margin:0;background:linear-gradient(90deg,#ffb36b,#e0703c)"></body>');
  await p.screenshot({ path: path.join(out, `w4-bar${suffix}.png`) });
  await p.close();
}
await b.close();
