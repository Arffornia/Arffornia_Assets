// Packs the interactive viewer artifact into out/viewer/: the page, the production bbmodel loader and the models.
//   node tools/pix/viewer/pack.mjs S1:smelter_beehive_s1 S3:smelter_kiln_s3 ...
// Publish out/viewer/index.html with the Artifact tool, files from out/viewer/files.json.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = join(root, 'out/viewer');
mkdirSync(join(out, 'models'), { recursive: true });
copyFileSync(join(root, 'tools/pix/viewer/index.html'), join(out, 'index.html'));
copyFileSync(join(root, 'render/bbmodel.js'), join(out, 'bbmodel.js'));
const list = process.argv.slice(2).map((arg) => {
  const [ref, id] = arg.split(':');
  const src = join(root, 'concepts/pix', id);
  copyFileSync(join(src, `${id}.bbmodel`), join(out, 'models', `${id}.bbmodel`));
  copyFileSync(join(src, `${id}_glowmask.png`), join(out, 'models', `${id}_glowmask.png`));
  const json = JSON.parse(readFileSync(join(src, `${id}.bbmodel`), 'utf8'));
  const m = json.arffornia || {};
  return { id, ref, title: m.title || id, note: m.note || '', model: `models/${id}.bbmodel`, glow: `models/${id}_glowmask.png` };
});
writeFileSync(join(out, 'models.json'), JSON.stringify(list, null, 1));
const files = ['bbmodel.js', 'models.json', ...list.flatMap((e) => [e.model, e.glow])];
writeFileSync(join(out, 'files.json'), JSON.stringify(files));
console.log(`viewer: ${list.length} models, ${files.length} files`);
