// Bake early/overlay-line.html to out/early/overlay-line.png (854x480, transparent where the line shows).
import { chromium } from 'playwright';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 854, height: 480 } });
await p.goto(`file://${root}/early/overlay-line.html`); await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: path.join(root, 'out/early/overlay-line.png'), omitBackground: true });
await b.close();
