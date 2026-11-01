// out/lint/<id>.png: the model in grey, every part named in an error in magenta.
import fs from 'node:fs';
import path from 'node:path';
import { openViewer } from '../view/driver.mjs';

export async function snapshots(items, outDir) {
  const v = await openViewer();
  try {
    for (const it of items) {
      const model = JSON.parse(fs.readFileSync(it.file, 'utf8'));
      const { frames } = await v.render({ size: [720, 540], mode: 'lint', model, highlight: it.parts });
      fs.writeFileSync(path.join(outDir, `${it.id}.png`), frames[0]);
    }
  } finally { await v.close(); }
}
