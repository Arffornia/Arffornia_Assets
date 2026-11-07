// Packs a concept round for the picker artifact: JPEGs under out/picker/img/<round>/ and an entry in
// out/picker/rounds.json (newest round first). Groups come from <round>.groups.json next to the TSV. Publish out/picker/ with the Artifact tool afterwards.
//   node tools/pix/picker/pack.mjs tools/pix/rounds/r4-smelter.tsv "Fondeur : exploration par tier"
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const [tsvPath, label] = process.argv.slice(2);
if (!tsvPath) throw new Error('usage: pack.mjs <round.tsv> [label]');

const round = basename(tsvPath, '.tsv');
const srcDir = join(root, 'out/concepts', round);
const outDir = join(root, 'out/picker');
const imgDir = join(outDir, 'img', round);
mkdirSync(imgDir, { recursive: true });
copyFileSync(join(root, 'tools/pix/picker/index.html'), join(outDir, 'index.html'));

const groups = JSON.parse(readFileSync(join(root, tsvPath.replace(/\.tsv$/, '.groups.json')), 'utf8'));
const items = [];
for (const line of readFileSync(join(root, tsvPath), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [group, ref, title, tier, mechanism, predict] = line.split('\t');
  const png = join(srcDir, `${ref}.png`);
  if (!existsSync(png)) continue;
  const jpg = join(imgDir, `${ref}.jpg`);
  execFileSync('magick', [png, '-resize', '1024x1024', '-quality', '82', jpg]);
  // a 3D model round may carry an animation next to the still: <ref>.gif, shown in the enlarged view
  const gifSrc = join(srcDir, `${ref}.gif`), gif = existsSync(gifSrc) ? `img/${round}/${ref}.gif` : undefined;
  if (gif) copyFileSync(gifSrc, join(imgDir, `${ref}.gif`));
  items.push({ ref, group, title, tier: Number(tier), mechanism, predicted: predict?.trim() === 'y', img: `img/${round}/${ref}.jpg`, ...(gif ? { gif } : {}) });
}

const usedGroups = [...new Set(items.map((i) => i.group))].map((id) => ({ id, ...groups[id] }));
const roundsFile = join(outDir, 'rounds.json');
const rounds = existsSync(roundsFile) ? JSON.parse(readFileSync(roundsFile, 'utf8')) : [];
const entry = { id: round, label: label ?? round, date: new Date().toISOString().slice(0, 10), groups: usedGroups, items };
const kept = rounds.filter((r) => r.id !== round);
writeFileSync(roundsFile, JSON.stringify([entry, ...kept], null, 1));

const files = readdirSync(join(outDir, 'img')).flatMap((r) => readdirSync(join(outDir, 'img', r)).map((f) => `img/${r}/${f}`));
writeFileSync(join(outDir, 'files.json'), JSON.stringify(['rounds.json', ...files]));
console.log(`${round}: ${items.length} images packed, ${files.length} images in out/picker (publish list in out/picker/files.json)`);
