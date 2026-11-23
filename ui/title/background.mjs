// Bake the title screen background (spec 007 D11 a) -> out/ui/title-background.png (1280x720).
// Needs the menu-left frame first: node early/line.mjs --frames menu-left 1
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const frame = path.join(root, 'out/scenes/factory-line/ui/menu-left-night.frames/f0000.png');
if (!fs.existsSync(frame)) throw new Error(`missing ${frame}: run node early/line.mjs --frames menu-left 1`);
fs.mkdirSync(path.join(root, 'out/ui'), { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--force-color-profile=srgb'] });
// The factory render is 1280x720: laid out at 1920x1080 like the mock-up, captured at 2/3.
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 / 3 });
await p.goto(`file://${root}/ui/title/background.html`);
await p.evaluate(() => document.querySelector('img').decode());
await p.screenshot({ path: path.join(root, 'out/ui/title-background.png') });
await b.close();
