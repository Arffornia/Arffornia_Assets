// Render brand/wordmark.html -> out/brand/wordmark.png (transparent, 1920x459).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(path.join(root, 'out/brand'), { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 459 } });
await p.goto(`file://${root}/brand/wordmark.html`); await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: path.join(root, 'out/brand/wordmark.png'), omitBackground: true }); await b.close();
