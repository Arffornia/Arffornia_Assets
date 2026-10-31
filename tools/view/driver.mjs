// Headless driver for tools/view: a static server over the repo and a SwiftShader Chromium.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

export async function openViewer() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });
  return {
    async render(o, times = [undefined]) {
      const pg = await browser.newPage({ viewport: { width: o.size[0], height: o.size[1] }, deviceScaleFactor: 1 });
      pg.on('pageerror', (e) => console.error('page error:', e.message));
      await pg.goto(`${base}/tools/view/view.html`); await pg.waitForFunction(() => window.VIEW);
      const info = await pg.evaluate((oo) => window.VIEW.init(oo), o);
      const out = [];
      for (const t of times) out.push(Buffer.from((await pg.evaluate((tt) => window.VIEW.frame(tt), t)).split(',')[1], 'base64'));
      await pg.close();
      return { info, frames: out };
    },
    async close() { await browser.close(); server.close(); },
  };
}
