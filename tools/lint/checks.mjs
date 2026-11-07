// The model lint checks. Each returns findings { check, level: 'error'|'warn'|'info', msg, parts, t }.
// Rules and their reasons: docs/MODEL-RULES.md. Thresholds: tools/lint/rules.json.
import { checkCantilevers, checkBelts, checkKinematics } from './mechanics.mjs';
import { PX, TOL, skeleton, poseAt, obbs, aabb, sat, contains, volume, faces, coplanarOverlap, hull, insideDistance, stemOf } from './geom.mjs';

const glob = (pat) => new RegExp(`^${pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
const fmtT = (t) => `${t.toFixed(2)} s`;
const px = (blocks) => +(blocks / PX).toFixed(2);

export function lintModel(json, rules, { id = json.name } = {}) {
  const meta = json.arffornia || {};
  const fp = meta.footprint;
  const findings = [];
  const add = (check, level, msg, parts = [], extra = {}) => findings.push({ check, level, msg, parts, ...extra });
  const sk = skeleton(json);
  const waivers = ((meta.lint || {}).allow || []).map((w) => ({ ...w, ra: glob(w.a), rb: glob(w.b || '*'), used: 0 }));
  const waived = (a, b, check) => waivers.find((w) => (!w.check || w.check === check) && ((w.ra.test(a) && w.rb.test(b)) || (w.ra.test(b) && w.rb.test(a))));
  const waivedOne = (name, check) => { const w = waivers.find((x) => x.check === check && x.ra.test(name)); if (w) w.used++; return w; };
  const EMBED = rules.embedPx * PX;

  if (!fp) add('meta', 'error', 'arffornia.footprint is missing: the lint cannot check the block grid.');
  for (const w of waivers) if (!w.why) add('meta', 'error', `waiver ${w.a} / ${w.b || '*'} has no "why".`);

  // ---------------------------------------------------------------- rest pose
  // the bind pose (animation t=0 is not always the rest pose)
  for (const g of sk.bones.values()) { const r = g.userData.rest; g.position.copy(r.p); g.rotation.copy(r.r); g.scale.copy(r.s); }
  sk.root.updateMatrixWorld(true);
  const rest = obbs(sk);
  const n = rest.length;
  const boxes = rest.map(aabb);
  const near = (i, j, B = boxes, pad = TOL) => [0, 1, 2].every((k) => B[i].min[k] - pad <= B[j].max[k] && B[j].min[k] - pad <= B[i].max[k]);

  // parts under a joint marked light (fire, glow, fields) are not solid: no support, no seat, no loose check
  const jointsAll = meta.joints || {};
  const lightNames = new Set(sk.elements.filter((e) => { let n = e.obj.parent; while (n) { if (jointsAll[n.name]) return !!jointsAll[n.name].light; n = n.parent; } return false; }).map((e) => e.name));
  for (const nm of [...lightNames]) lightNames.add(stemOf(nm)); // a compound's stem names it in the cantilever report
  const solid = (grp) => grp.filter((nm) => !lightNames.has(nm));
  // 1. overlaps between parts (static relation), hidden parts
  const restPen = new Map();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (!near(i, j)) continue;
    const pen = sat(rest[i], rest[j]);
    restPen.set(`${i}:${j}`, pen);
    if (pen <= EMBED) continue;
    const a = rest[i].name, b = rest[j].name;
    if (lightNames.has(a) || lightNames.has(b)) continue;
    const sameStem = stemOf(a) === stemOf(b) && a.includes('#');
    if (contains(rest[j], rest[i]) || contains(rest[i], rest[j])) {
      const [inner, outer] = contains(rest[j], rest[i]) ? [a, b] : [b, a];
      if (/^glass/i.test(outer)) continue; // seen through the glass: not hidden
      add('hidden', 'warn', `${inner} is entirely inside ${outer}: invisible, costs triangles.`, [inner, outer]);
      continue;
    }
    if (sameStem) continue;
    const w = waived(a, b, 'overlap'); if (w) { w.used++; continue; }
    add('overlap', 'error', `${a} and ${b} interpenetrate by ${px(pen)} px (max ${rules.embedPx} px to seat one part on another). Model them apart, join them as one compound (name#n), or waive with a reason.`, [a, b], { depthPx: px(pen) });
  }

  // 2. z-fighting: coplanar faces with the same normal that overlap and are both drawn
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (!near(i, j)) continue;
    const ei = rest[i].x.el, ej = rest[j].x.el;
    const fi = faces(rest[i]), fj = faces(rest[j]);
    for (const f of fi) for (const g of fj) {
      if (f.n.dot(g.n) < 0.9999) continue;
      if (Math.abs(f.n.dot(g.c.clone().sub(f.c))) > 1e-4 * PX) continue;
      if (f.n.y < -0.999 && Math.abs(f.c.y) <= TOL) continue; // bottom faces on the ground are never seen
      const drawn = (el, nm) => el.faces && el.faces[nm] && el.faces[nm].texture !== null && el.faces[nm].texture !== undefined;
      if (!drawn(ei, f.name) || !drawn(ej, g.name)) continue;
      const area = coplanarOverlap(f, g);
      if (area * 256 < rules.zfightMinPx2) continue;
      if (stemOf(rest[i].name) === stemOf(rest[j].name) && rest[i].name.includes('#')) {
        add('zfight', 'warn', `${rest[i].name} and ${rest[j].name} (one compound) share a drawn ${f.name} face: hide one of the two faces.`, [rest[i].name, rest[j].name]);
      } else add('zfight', 'error', `${rest[i].name}.${f.name} and ${rest[j].name}.${g.name} are coplanar (${(area * 256).toFixed(1)} px²): they flicker in game. Offset one by 0.01 px or hide a face.`, [rest[i].name, rest[j].name]);
    }
  }

  // 3. connectivity: every part must be held by something that reaches the ground
  const grounded = (B) => B.map((b) => b.min[1] <= TOL);
  const components = (O, B) => {
    const par = O.map((_, i) => i); const f = (i) => (par[i] === i ? i : (par[i] = f(par[i])));
    for (let i = 0; i < O.length; i++) for (let j = i + 1; j < O.length; j++) if (near(i, j, B) && sat(O[i], O[j]) >= -TOL) par[f(i)] = f(j);
    const g = grounded(B); const ok = new Set(); O.forEach((_, i) => { if (g[i]) ok.add(f(i)); });
    const groups = new Map(); O.forEach((_, i) => { if (!ok.has(f(i))) { const r = f(i); groups.set(r, [...(groups.get(r) || []), O[i].name]); } });
    return [...groups.values()];
  };
  for (const grp0 of components(rest, boxes)) { const grp = solid(grp0); if (!grp.length) continue; add('floating', 'error', `not connected to the ground: ${grp.slice(0, 6).join(', ')}${grp.length > 6 ? ` (+${grp.length - 6})` : ''}. Add a support, bracket or mount.`, grp); }

  // 4. stability: the centre of mass must sit over the ground contact
  const base = []; let M = 0, cx = 0, cz = 0;
  rest.forEach((o, i) => {
    const v = volume(o); M += v; cx += o.c.x * v; cz += o.c.z * v;
    if (boxes[i].min[1] <= TOL) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      // footprint corners of a grounded box (its bottom face, approximated by its AABB)
      base.push([sx < 0 ? boxes[i].min[0] : boxes[i].max[0], sz < 0 ? boxes[i].min[2] : boxes[i].max[2]]);
    }
  });
  if (M > 0 && base.length) {
    const h = hull(base); const d = insideDistance(h, [cx / M, cz / M]);
    if (d < rules.comMarginBlocks) add('stability', 'error', `centre of mass (${(cx / M).toFixed(2)}, ${(cz / M).toFixed(2)}) is ${d < 0 ? 'outside' : 'at the edge of'} the ground contact: it would tip over. Widen the base or add legs.`);
  }

  // 5. footprint: everything inside the block grid it claims
  const anims = json.animations || [];
  const sampleTimes = (an, hz) => { const L = an.length || 0; const k = Math.max(1, Math.ceil(L * hz)); return Array.from({ length: k + 1 }, (_, i) => (i / k) * L); };
  const env = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const grow = (B) => B.forEach((b) => { for (let k = 0; k < 3; k++) { env.min[k] = Math.min(env.min[k], b.min[k]); env.max[k] = Math.max(env.max[k], b.max[k]); } });
  grow(boxes);
  const out = new Map();
  const checkFoot = (O, B, t) => {
    if (!fp) return;
    const lim = { min: [-fp[0] / 2, 0, -fp[1] / 2], max: [fp[0] / 2, meta.height ?? Infinity, fp[1] / 2] };
    B.forEach((b, i) => {
      const over = [0, 1, 2].map((k) => Math.max(0, lim.min[k] - b.min[k], b.max[k] - lim.max[k]));
      const worst = Math.max(...over);
      const cur = out.get(O[i].name); if (worst > TOL && (!cur || worst > cur.worst + TOL)) out.set(O[i].name, { worst, t });
    });
  };
  checkFoot(rest, boxes, null);

  // 6. animation sweep: moving parts must not pass through anything, nor come loose
  const movers = new Set(sk.elements.map((e) => e.mover).filter(Boolean));
  for (const an of anims) {
    const hits = new Map();
    const times = sampleTimes(an, rules.sweepHz);
    for (const t of times) {
      poseAt(sk, Math.max(0, Math.min(t, (an.length || 0) - 1e-6)), an.name);
      const O = obbs(sk); const B = O.map(aabb); grow(B); checkFoot(O, B, t);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const mi = sk.elements[i].mover, mj = sk.elements[j].mover;
        if (mi === mj || (!mi && !mj)) continue; // no relative motion
        if (!near(i, j, B)) continue;
        const pen = sat(O[i], O[j]); if (pen <= EMBED) continue;
        const a = O[i].name, b = O[j].name;
        if (lightNames.has(a) || lightNames.has(b)) continue;
        if (stemOf(a) === stemOf(b) && a.includes('#')) continue;
        const w = waived(a, b, 'sweep') || waived(a, b, 'overlap'); if (w) { w.used++; continue; }
        const key = `${a}|${b}`; const h = hits.get(key);
        if (!h || pen > h.pen) hits.set(key, { a, b, pen, t, first: h ? h.first : t });
      }
      if (Math.abs(t * rules.detachHz - Math.round(t * rules.detachHz)) < 1e-6) {
        for (const grp0 of components(O, B)) { const grp = solid(grp0); if (grp.length && grp.some((nm) => sk.elements.find((e) => e.name === nm)?.mover)) {
          const key = `detach|${grp.join(',')}`;
          if (!hits.has(key)) hits.set(key, { detach: grp, t });
        } }
      }
    }
    for (const h of hits.values()) {
      if (h.detach) add('sweep', 'error', `${an.name}: ${h.detach.slice(0, 4).join(', ')} come loose at ${fmtT(h.t)} (no contact with the machine).`, h.detach, { t: h.t, anim: an.name });
      else add('sweep', 'error', `${an.name}: ${h.a} passes through ${h.b} (up to ${px(h.pen)} px at ${fmtT(h.t)}, first at ${fmtT(h.first)}).`, [h.a, h.b], { t: h.t, anim: an.name, depthPx: px(h.pen) });
    }
  }
  if (anims.length && !movers.size) add('sweep', 'warn', 'animations exist but no element is under an animated bone.');

  // thin moving parts (Brian, Nov 2026): a moving part thinner than minMovingPx reads as a wire. Prism slabs and
  // gear teeth are exempt: their compound (members turned about one shared origin) is the visible part.
  const same = (p, q) => p && q && p.every((v, k) => Math.abs(v - q[k]) < 1e-6);
  const sharedOrigin = (e) => sk.elements.some((o) => o !== e && stemOf(o.name) === stemOf(e.name) && same(o.el.origin, e.el.origin) && (o.el.rotation || e.el.rotation));
  for (let i = 0; i < n; i++) {
    const el = sk.elements[i]; if (!el.mover || sharedOrigin(el)) continue;
    const d = rest[i].e.map((v) => (v * 2) / PX).sort((a, b) => a - b), min = rules.minMovingPx ?? 2;
    const wire = d[1] < min, blade = d[0] < 1.5 && d[2] >= 4;
    if (!wire && !blade) continue;
    if (waivedOne(rest[i].name, 'thin')) continue;
    add('thin', 'warn', `${rest[i].name} moves and is ${d[0].toFixed(1)} x ${d[1].toFixed(1)} px in section: ${wire ? 'a wire' : 'a blade'}. Driving parts need ${min} px or more (3 px for cams, cranks, levers).`, [rest[i].name]);
  }

  // 6b. mechanics: cantilevers and seats, belts and gears, joint kinematics (tools/lint/mechanics.mjs)
  const mctx = { sk, json, meta, rest, boxes, rules, add, waivedOne, anims };
  checkCantilevers({ ...mctx, lightNames });
  checkBelts(mctx);
  checkKinematics(mctx);
  for (const [name, { worst, t }] of out) add('footprint', 'error', `${name} leaves the ${fp[0]}×${fp[1]}${meta.height ? `×${meta.height}` : ''} block grid by ${px(worst)} px${t !== null ? ` (during animation, ${fmtT(t)})` : ''}.`, [name]);
  if (fp && meta.height === undefined) add('meta', 'warn', 'arffornia.height is not set: the vertical size is not checked.');

  // 7. ports: on the boundary, centred on a block cell, with a collar element
  const ports = meta.ports || [];
  if (fp && !ports.length && meta.kind !== 'scenery') add('ports', 'warn', 'no ports declared: belts and pipes cannot be checked against this machine.');
  const FACE = { north: [2, -1], south: [2, 1], west: [0, -1], east: [0, 1], up: [1, 1], down: [1, -1] };
  for (const p of ports) {
    if (!fp || !FACE[p.face]) { add('ports', 'error', `port ${p.id}: unknown face ${p.face}.`); continue; }
    const [k, s] = FACE[p.face];
    const plane = k === 1 ? (s > 0 ? meta.height : 0) : s * fp[k === 0 ? 0 : 1] / 2;
    const cell = p.cell || [0, 0];
    // in-face axes: x/z faces use (other horizontal axis, y); up/down use (x, z)
    const centre = [0, 0, 0]; centre[k] = plane;
    const inPlane = k === 1 ? [0, 2] : [k === 0 ? 2 : 0, 1];
    inPlane.forEach((ax, q) => { centre[ax] = (ax === 1 ? 0 : -fp[ax === 0 ? 0 : 1] / 2) + cell[q] + 0.5; });
    const collar = rest.find((o) => o.name === `port_${p.id}` || o.name.startsWith(`port_${p.id}#`) || o.name.startsWith(`port_${p.id}_`));
    if (!collar) { add('ports', 'error', `port ${p.id} (${p.kind || 'item'}, ${p.face} [${cell}]) has no collar element named port_${p.id}.`); continue; }
    const b = aabb(collar);
    const flush = s > 0 ? b.max[k] : b.min[k];
    if (Math.abs(flush - plane) > TOL * 5) add('ports', 'error', `port ${p.id}: collar is ${px(Math.abs(flush - plane))} px from the ${p.face} boundary; a neighbour's belt or pipe will not meet it.`, [collar.name]);
    const off = inPlane.map((ax) => (b.min[ax] + b.max[ax]) / 2 - centre[ax]);
    if (Math.max(...off.map(Math.abs)) > rules.portCentreTolPx * PX) add('ports', 'error', `port ${p.id}: collar centre is off the block cell centre by (${off.map(px).join(', ')}) px.`, [collar.name]);
    const size = inPlane.map((ax) => (b.max[ax] - b.min[ax]) / PX);
    if (Math.min(...size) < rules.portMinPx || Math.max(...size) > 16 + TOL) add('ports', 'error', `port ${p.id}: collar is ${size.map((v) => v.toFixed(1)).join('×')} px; ports are ${rules.portMinPx}-16 px so they read at a glance.`, [collar.name]);
  }

  // 8. texel density
  const res = json.resolution || { width: 16, height: 16 };
  const target = meta.texelsPerBlock || rules.texelsPerBlock;
  const dens = []; let bad = 0, warn = 0; const worstEl = new Map();
  for (const x of sk.elements) {
    const el = x.el; const sz = [0, 1, 2].map((k) => Math.abs(el.to[k] - el.from[k]) + 2 * (el.inflate || 0));
    const dims = { north: [0, 1], south: [0, 1], east: [2, 1], west: [2, 1], up: [0, 2], down: [0, 2] };
    for (const [fname, f] of Object.entries(el.faces || {})) {
      if (!f || f.texture === null || f.texture === undefined || !f.uv) continue;
      const tex = (json.textures || [])[Number(f.texture) || 0] || {};
      const sx = (tex.width || res.width) / (tex.uv_width || res.width), sy = (tex.height || res.height) / (tex.uv_height || res.height);
      let [w, h] = dims[fname].map((k) => sz[k]);
      if (f.rotation === 90 || f.rotation === 270) [w, h] = [h, w];
      if (w < rules.texelMinFacePx || h < rules.texelMinFacePx) continue;
      const du = Math.abs(f.uv[2] - f.uv[0]) * sx / (w / 16), dv = Math.abs(f.uv[3] - f.uv[1]) * sy / (h / 16);
      for (const d of [du, dv]) {
        dens.push(d); const r = d / target;
        if (r < 1 - rules.texelErr || r > 1 + rules.texelErr) { bad++; const cur = worstEl.get(el.name); if (!cur || Math.abs(Math.log(r)) > Math.abs(Math.log(cur))) worstEl.set(el.name, r); }
        else if (r < 1 - rules.texelWarn || r > 1 + rules.texelWarn) warn++;
      }
    }
  }
  dens.sort((a, b) => a - b);
  const med = dens.length ? dens[Math.floor(dens.length / 2)] : 0;
  if (bad) {
    const worst = [...worstEl.entries()].sort((a, b) => Math.abs(Math.log(b[1])) - Math.abs(Math.log(a[1]))).slice(0, 5);
    add('texel', 'error', `${bad} of ${dens.length} face axes are off ${target} px/block by more than ${rules.texelErr * 100}% (median ${med.toFixed(1)}). Worst: ${worst.map(([nm, r]) => `${nm} ${(r * target).toFixed(1)}`).join(', ')}.`, worst.map(([nm]) => nm));
  } else if (warn) add('texel', 'warn', `${warn} of ${dens.length} face axes are off ${target} px/block by more than ${rules.texelWarn * 100}%.`);

  // 8b. deploy (P6, Brian 2026-11-01): every multiblock machine from tier 2 unfolds, Oritech-style:
  // a `packaged` pose, a `deploy` animation (whose seams the kinematics check verifies), then idle/working
  const cells = fp ? fp[0] * fp[1] : 0;
  if (cells > 1 && meta.kind !== 'scenery') {
    if (typeof meta.tier !== 'number') add('deploy', 'warn', `arffornia.tier is not set: the deploy rule (multiblocks from tier ${rules.deployFromTier}) is not checked.`);
    else if (meta.tier >= rules.deployFromTier) {
      const has = (re) => anims.some((x) => re.test(x.name.split('.').pop()));
      if (!has(/^(packaged|folded|crated)/i)) add('deploy', 'error', `tier ${meta.tier} multiblock with no \`packaged\` animation: multiblocks from tier ${rules.deployFromTier} start packaged and deploy (P6).`);
      if (!has(/^(deploy|setup|assemble|unfold)/i)) add('deploy', 'error', `tier ${meta.tier} multiblock with no \`deploy\` animation: multiblocks from tier ${rules.deployFromTier} unfold when they form (P6).`);
    }
  }

  // 9. budget
  const facesDrawn = sk.elements.reduce((s, x) => s + Object.values(x.el.faces || {}).filter((f) => f && f.texture !== null && f.texture !== undefined).length, 0);
  const area = fp ? fp[0] * fp[1] : 1;
  const cls = rules.budgets.find((b) => area <= b.maxArea) || rules.budgets[rules.budgets.length - 1];
  const texPx = (json.textures || []).reduce((s, t) => s + (t.width || res.width) * (t.height || res.height), 0);
  const stats = { elements: sk.elements.length, tris: facesDrawn * 2, bones: sk.bones.size, animatedBones: sk.animated.size, texturePx: texPx, animations: anims.length, budgetClass: cls.name };
  const over = (val, max, what) => { if (val > max) add('budget', 'error', `${what} ${val} over the ${cls.name} budget (${max}).`); else if (val > max * 0.8) add('budget', 'warn', `${what} ${val} is above 80% of the ${cls.name} budget (${max}).`); };
  over(stats.tris, cls.tris, 'triangles'); over(stats.elements, cls.elements, 'elements'); over(stats.animatedBones, cls.animatedBones, 'animated bones'); over(texPx, cls.texturePx, 'texture pixels');

  for (const w of waivers) if (!w.used) add('meta', 'warn', `waiver ${w.a} / ${w.b || '*'} matches nothing: remove it.`);
  stats.size = [0, 1, 2].map((k) => +(env.max[k] - env.min[k]).toFixed(3));
  stats.texelMedian = +med.toFixed(1);
  const gating = meta.status !== 'mock';
  const errors = findings.filter((f) => f.level === 'error').length, warnings = findings.filter((f) => f.level === 'warn').length;
  return { id, title: meta.title || id, status: meta.status || 'unknown', footprint: fp, height: meta.height, gating, pass: errors === 0, errors, warnings, stats, findings };
}
