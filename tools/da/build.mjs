#!/usr/bin/env node
// Build the DA concept models: concepts/<direction>/<machine>/<machine>.bbmodel (+ .png, _glowmask.png)
//   node tools/da/build.mjs [filter...]
import fs from 'node:fs';
import path from 'node:path';
import { Model } from './kit.mjs';
import { DIRECTIONS, kit } from './directions.mjs';
import { MACHINES } from './machines.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const filters = process.argv.slice(2);
for (const [did, D] of Object.entries(DIRECTIONS)) for (const [mid, MC] of Object.entries(MACHINES)) {
  const id = `${did}/${mid}`; if (filters.length && !filters.some((f) => id.includes(f))) continue;
  const b = new Model(mid, { title: `${MC.title} (${D.title})`, note: MC.role, footprint: MC.footprint, height: MC.height, ports: MC.ports, kind: 'machine', status: 'concept', direction: did, ...(MC.lint && MC.lint(D) ? { lint: MC.lint(D) } : {}), ...(MC.camera ? { camera: MC.camera } : {}) });
  MC.build(b, kit(b, D));
  const { bbmodel, texPng, glowPng, atlas } = b.build();
  const dir = path.join(ROOT, 'concepts', did, mid); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${mid}.bbmodel`), JSON.stringify(bbmodel, null, 1) + '\n');
  fs.writeFileSync(path.join(dir, `${mid}.png`), texPng);
  fs.writeFileSync(path.join(dir, `${mid}_glowmask.png`), glowPng);
  console.log(`${id.padEnd(28)} ${String(bbmodel.elements.length).padStart(4)} elements, atlas ${atlas.join('x')}`);
}
