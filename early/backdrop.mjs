// Bake the early-window backdrop (854x480) from early/backdrop.html.
import { chromium } from 'playwright';
import path from 'node:path';
const out = process.argv[2] || 'out/early';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 854, height: 480 } });
for (const [q, f] of [['', 'backdrop.png'], ['?static', 'backdrop-static.png']]) {
  await p.goto(`file://${root}/early/backdrop.html${q}`); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(out, f) });
}
await b.close();
