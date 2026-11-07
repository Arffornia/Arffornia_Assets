// Mechanical checks for the model lint: cantilevers (overhang and seat strength), belts and gears
// (tangency, wrap angle, speed ratio), and joint kinematics (declared joints, limits, rigid motion,
// hinge pivots, loop seams, jumps, deploy animations). Rules and their reasons: docs/MODEL-RULES.md.
//
// These are heuristics, not a physics engine. They judge what a player reads as "this would bend",
// "this belt does not touch its wheel" or "this arm bends the wrong way", from the boxes alone.
import * as THREE from 'three';
import { sampleChannel } from '../../render/bbmodel.js';
import { PX, TOL, poseAt, obbs, aabb, sat, corners, volume, stemOf } from './geom.mjs';

const px = (blocks) => +(blocks / PX).toFixed(2);
const fmtT = (t) => `${t.toFixed(2)} s`;
const deg = THREE.MathUtils.radToDeg;
const AXES = { x: 0, y: 1, z: 2 };

// distance from a world point to an OBB (0 inside)
function distToObb(o, p) {
  const d = p.clone().sub(o.c);
  let s = 0;
  for (let k = 0; k < 3; k++) { const q = Math.abs(d.dot(o.u[k])) - o.e[k]; if (q > 0) s += q * q; }
  return Math.sqrt(s);
}

// Points on the surface of an OBB, about one per Blockbench px (capped), with the area each one stands for.
function surfaceSamples(o, cap = 24) {
  const pts = [];
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
    const [i, j] = [0, 1, 2].filter((q) => q !== k);
    const ni = Math.max(1, Math.min(cap, Math.round((2 * o.e[i]) / PX))), nj = Math.max(1, Math.min(cap, Math.round((2 * o.e[j]) / PX)));
    const da = (2 * o.e[i]) / ni, db = (2 * o.e[j]) / nj;
    for (let a = 0; a < ni; a++) for (let b = 0; b < nj; b++) {
      const p = o.c.clone().addScaledVector(o.u[k], s * o.e[k])
        .addScaledVector(o.u[i], -o.e[i] + (a + 0.5) * da).addScaledVector(o.u[j], -o.e[j] + (b + 0.5) * db);
      pts.push({ p, area: da * db });
    }
  }
  return pts;
}

// Group elements into solids: a compound (stem#n) is one node, every other element is its own.
function nodesOf(O) {
  const key = (o, i) => (o.name && o.name.includes('#') ? `c:${stemOf(o.name)}` : `e:${i}`);
  const map = new Map();
  O.forEach((o, i) => { const k = key(o, i); if (!map.has(k)) map.set(k, { name: k.startsWith('c:') ? stemOf(o.name) : o.name, members: [] }); map.get(k).members.push(i); });
  const nodes = [...map.values()];
  const nodeOf = new Array(O.length);
  nodes.forEach((n, ni) => n.members.forEach((i) => { nodeOf[i] = ni; }));
  return { nodes, nodeOf };
}

// ------------------------------------------------------------------ cantilevers
// For every solid that does not rest on the ground: what holds it (its supports: neighbours that still
// reach the ground without it), how far it reaches horizontally past that contact (overhang L) against
// its vertical thickness t, and the load on the seat: weight carried x lever arm / (contact area x
// contact depth). A long arm on a 1 px seat fails the second rule even when the first one passes.
export function cantileverScan(O, B, rules) {
  const n = O.length;
  const { nodes, nodeOf } = nodesOf(O);
  const N = nodes.length;
  const adj = Array.from({ length: N }, () => new Set());
  const near = (i, j) => [0, 1, 2].every((k) => B[i].min[k] - TOL <= B[j].max[k] && B[j].min[k] - TOL <= B[i].max[k]);
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (nodeOf[i] === nodeOf[j] || !near(i, j)) continue;
    if (sat(O[i], O[j]) >= -TOL) { adj[nodeOf[i]].add(nodeOf[j]); adj[nodeOf[j]].add(nodeOf[i]); pairs.push([i, j]); }
  }
  const grounded = nodes.map((nd) => nd.members.some((i) => B[i].min[1] <= TOL));
  const reach = (skip) => {
    const seen = new Uint8Array(N); const q = [];
    for (let k = 0; k < N; k++) if (grounded[k] && k !== skip) { seen[k] = 1; q.push(k); }
    while (q.length) { const k = q.pop(); for (const m of adj[k]) if (m !== skip && !seen[m]) { seen[m] = 1; q.push(m); } }
    return seen;
  };
  const base = reach(-1);
  const vol = nodes.map((nd) => nd.members.reduce((s, i) => s + volume(O[i]), 0));
  const out = [];
  for (let P = 0; P < N; P++) {
    if (grounded[P] || !base[P]) continue; // on the ground, or already reported as floating
    const without = reach(P);
    const carried = []; for (let k = 0; k < N; k++) if (k !== P && base[k] && !without[k]) carried.push(k);
    const supports = [...adj[P]].filter((k) => without[k]);
    if (!supports.length) continue;
    const supEls = supports.flatMap((k) => nodes[k].members);
    // contact patch: P's surface samples that lie on or in a support
    const contact = []; let area = 0;
    for (const i of nodes[P].members) for (const s of surfaceSamples(O[i])) {
      if (supEls.some((j) => distToObb(O[j], s.p) <= TOL * 2)) { contact.push(s.p); area += s.area; }
    }
    if (!contact.length) { // touching along an edge: take the closest corner as a point contact
      let best = null, bd = Infinity;
      for (const i of nodes[P].members) for (const c of corners(O[i])) { const d = Math.min(...supEls.map((j) => distToObb(O[j], c))); if (d < bd) { bd = d; best = c; } }
      contact.push(best); area = 0;
    }
    area = Math.max(area, (0.5 * PX) ** 2);
    // horizontal overhang of P's own corners past the contact patch
    const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    let L = 0;
    for (const i of nodes[P].members) for (const c of corners(O[i])) { const d = Math.min(...contact.map((q) => hdist(q, c))); if (d > L) L = d; }
    const thick = Math.max(...nodes[P].members.map((i) => [0, 1, 2].reduce((s, k) => s + 2 * O[i].e[k] * Math.abs(O[i].u[k].y), 0)));
    // load: weight of P and everything it carries, at its centre of mass, against the patch
    let W = vol[P], cx = 0, cz = 0;
    const acc = (k) => nodes[k].members.forEach((i) => { const v = volume(O[i]); cx += O[i].c.x * v; cz += O[i].c.z * v; });
    acc(P); for (const k of carried) { W += vol[k]; acc(k); }
    const com = new THREE.Vector3(cx / W, 0, cz / W);
    let lever = Infinity, dir = null;
    for (const q of contact) { const d = hdist(q, com); if (d < lever) { lever = d; dir = new THREE.Vector3(com.x - q.x, 0, com.z - q.z); } }
    // is the centre of mass over the patch? (horizontal hull test, cheap: within one sample spacing)
    if (lever <= PX) lever = 0;
    let depth = PX;
    if (contact.length > 1) {
      const ys = contact.map((q) => q.y); const vy = Math.max(...ys) - Math.min(...ys);
      let vl = 0;
      if (dir && dir.lengthSq() > 1e-12) { dir.normalize(); const ls = contact.map((q) => q.x * dir.x + q.z * dir.z); vl = Math.max(...ls) - Math.min(...ls); }
      depth = Math.max(PX, vy, vl);
    }
    // in Blockbench px so the numbers read: px^3 * px / (px^2 * px) = px
    const stress = ((W / PX ** 3) * (lever / PX)) / ((area / PX ** 2) * (depth / PX));
    out.push({ node: P, name: nodes[P].name, parts: nodes[P].members.map((i) => O[i].name), Lpx: L / PX, tpx: thick / PX, stress, carried: carried.map((k) => nodes[k].name), supports: supports.map((k) => nodes[k].name), areaPx: area / PX ** 2 });
  }
  return out;
}

export function checkCantilevers(ctx) {
  const { sk, rest, boxes, rules, add, waivedOne, anims } = ctx;
  const worst = new Map();
  const consider = (r, t, anim) => {
    if (ctx.lightNames && [r.name, ...(r.parts || [])].every((nm) => ctx.lightNames.has(nm))) return;
    const cur = worst.get(r.name);
    const score = Math.max(r.Lpx / Math.max(r.tpx, 1e-6) / rules.cantileverMax, r.stress / rules.seatStressMax);
    if (!cur || score > cur.score) worst.set(r.name, { ...r, t, anim, score });
  };
  for (const r of cantileverScan(rest, boxes, rules)) consider(r, null, null);
  const movers = new Set(sk.elements.map((e) => e.mover).filter(Boolean));
  if (movers.size) for (const an of anims) {
    const L = an.length || 0; const k = Math.max(1, Math.ceil(L * rules.cantileverHz));
    for (let s = 0; s <= k; s++) {
      const t = Math.min((s / k) * L, Math.max(0, L - 1e-6));
      poseAt(sk, t, an.name); const O = obbs(sk); const B = O.map(aabb);
      for (const r of cantileverScan(O, B, rules)) if (r.parts.some((nm) => sk.elements.find((e) => e.name === nm)?.mover)) consider(r, t, an.name);
    }
  }
  for (const r of worst.values()) {
    if (waivedOne(r.name, 'cantilever')) continue;
    const when = r.t !== null ? ` (${r.anim}, ${fmtT(r.t)})` : '';
    const ratio = r.Lpx / Math.max(r.tpx, 1e-6);
    if (r.Lpx >= rules.cantileverMinPx) {
      const msg = `${r.name} overhangs ${r.Lpx.toFixed(1)} px past its support (${r.supports.slice(0, 3).join(', ')}) for ${r.tpx.toFixed(1)} px of vertical thickness: ${ratio.toFixed(1)}:1${when}.`;
      if (ratio > rules.cantileverMax) add('cantilever', 'error', `${msg} Above ${rules.cantileverMax}:1 it reads as bending. Thicken it, add a strut or a bracket, or shorten it.`, r.parts, { t: r.t, ratio: +ratio.toFixed(2) });
      else if (ratio > rules.cantileverWarn) add('cantilever', 'warn', `${msg} Above ${rules.cantileverWarn}:1 it starts to look flimsy.`, r.parts, { t: r.t, ratio: +ratio.toFixed(2) });
    }
    const carried = r.carried.length ? ` and ${r.carried.length} part(s) it carries` : '';
    const smsg = `${r.name}${carried} hang on ${r.areaPx.toFixed(1)} px² of contact (seat load index ${r.stress.toFixed(0)})${when}.`;
    if (r.stress > rules.seatStressMax) add('cantilever', 'error', `${smsg} Above ${rules.seatStressMax} the seat would tear out. Seat it deeper, widen the flange, or add a support under the load.`, r.parts, { t: r.t, stress: Math.round(r.stress) });
    else if (r.stress > rules.seatStressWarn) add('cantilever', 'warn', `${smsg} Above ${rules.seatStressWarn} the joint looks undersized.`, r.parts, { t: r.t, stress: Math.round(r.stress) });
  }
}

// ------------------------------------------------------------------ belts and gears
// A wheel (pulley or gear) named in arffornia.belts / arffornia.gears: an element, a compound stem or a
// bone. Its axis is the one direction every member shares (for a single box, the one whose cross-section
// is square); its radius is the apothem (half the width across flats) unless the model gives r in px.
function wheel(ctx, spec) {
  const { sk, rest } = ctx;
  const part = typeof spec === 'string' ? spec : spec.part;
  const bone = sk.bones.get(part);
  const inBone = (x) => { let n = x.obj.parent; while (n) { if (n === bone) return true; n = n.parent; } return false; };
  const idx = rest.map((o, i) => i).filter((i) => rest[i].name === part || stemOf(rest[i].name) === part || (bone && inBone(sk.elements[i])));
  if (!idx.length) return null;
  const M = idx.map((i) => rest[i]);
  let axis = null;
  if (spec.axis && AXES[spec.axis] !== undefined) axis = new THREE.Vector3(...[0, 1, 2].map((k) => (k === AXES[spec.axis] ? 1 : 0))).applyQuaternion(bone ? bone.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion());
  else {
    const cand = [0, 1, 2].map((k) => M[0].u[k]).filter((u) => M.every((o) => o.u.some((v) => Math.abs(v.dot(u)) > 0.9998)));
    const roundness = (u) => M.reduce((s, o) => { const e = [0, 1, 2].filter((k) => Math.abs(o.u[k].dot(u)) < 0.9998).map((k) => o.e[k]); return s + Math.abs(e[0] - e[1]); }, 0);
    cand.sort((a, b) => roundness(a) - roundness(b));
    axis = cand[0] ? cand[0].clone() : M[0].u[1].clone();
  }
  axis.normalize();
  const c = M.reduce((s, o) => s.add(o.c), new THREE.Vector3()).multiplyScalar(1 / M.length);
  const ap = Math.min(...M.flatMap((o) => [0, 1, 2].filter((k) => Math.abs(o.u[k].dot(axis)) < 0.9998).map((k) => o.e[k])));
  const r = spec.r !== undefined ? spec.r * PX : ap;
  return { part, idx, axis, c, r };
}

// average angular speed (rad/s) of a wheel about its axis over an animation, from its first member's frame
function spin(ctx, w, an) {
  const { sk, rules } = ctx;
  const el = sk.elements[w.idx[0]];
  if (!el.mover) return 0;
  const L = an.length || 0; if (L <= 0) return 0;
  const k = Math.max(2, Math.ceil(L * rules.sweepHz));
  let prev = null, total = 0, col = -1;
  const ref = new THREE.Vector3();
  for (let s = 0; s <= k; s++) {
    poseAt(sk, Math.min((s / k) * L, L - 1e-6), an.name);
    const m = el.obj.matrixWorld; const cols = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]; m.extractBasis(...cols);
    cols.forEach((u) => u.normalize());
    // pick the reference column once: re-picking per frame jumps between two equally perpendicular columns
    if (col < 0) col = [0, 1, 2].sort((a, b) => Math.abs(cols[a].dot(w.axis)) - Math.abs(cols[b].dot(w.axis)))[0];
    const v = cols[col];
    ref.copy(v).addScaledVector(w.axis, -v.dot(w.axis)).normalize();
    if (prev) { const a = Math.atan2(prev.clone().cross(ref).dot(w.axis), prev.dot(ref)); total += a; }
    prev = ref.clone();
  }
  return total / L;
}

export function checkBelts(ctx) {
  const { meta, rest, rules, add, anims } = ctx;
  const tol = rules.beltTolPx * PX;
  const planeOk = (a, b, what) => {
    if (Math.abs(a.axis.dot(b.axis)) < Math.cos(THREE.MathUtils.degToRad(rules.beltAxisDeg))) { add('belt', 'error', `${what}: ${a.part} and ${b.part} turn about axes ${deg(Math.acos(Math.min(1, Math.abs(a.axis.dot(b.axis))))).toFixed(1)}° apart; a belt or a gear pair needs parallel shafts.`, [a.part, b.part]); return false; }
    const off = Math.abs(b.c.clone().sub(a.c).dot(a.axis));
    if (off > tol * 2) add('belt', 'error', `${what}: ${b.part} is ${px(off)} px out of the plane of ${a.part}; the belt would walk off.`, [a.part, b.part]);
    return true;
  };
  const speedCheck = (what, a, b, sign, ratioTo) => {
    for (const an of anims) {
      const wa = spin(ctx, a, an), wb = spin(ctx, b, an) * Math.sign(a.axis.dot(b.axis) || 1);
      if (Math.abs(wa) < 1e-3 && Math.abs(wb) < 1e-3) continue;
      if (Math.abs(wa) < 1e-3 || Math.abs(wb) < 1e-3) { add('belt', 'error', `${what} (${an.name}): ${Math.abs(wa) < 1e-3 ? a.part : b.part} does not turn while ${Math.abs(wa) < 1e-3 ? b.part : a.part} does; the drive would slip or stall.`, [a.part, b.part], { anim: an.name }); continue; }
      const va = wa * a.r, vb = wb * ratioTo(b);
      if (Math.sign(va) !== sign * Math.sign(vb)) add('belt', 'error', `${what} (${an.name}): ${a.part} and ${b.part} turn the ${sign > 0 ? 'opposite' : 'same'} way; ${sign > 0 ? 'an open belt keeps' : 'meshing gears and a crossed belt reverse'} the direction.`, [a.part, b.part], { anim: an.name });
      else if (Math.abs(Math.abs(va) / Math.abs(vb) - 1) > rules.beltSpeedTol) add('belt', 'error', `${what} (${an.name}): rim speeds differ by ${(100 * Math.abs(Math.abs(va) / Math.abs(vb) - 1)).toFixed(0)}% (${a.part} ${deg(Math.abs(wa)).toFixed(0)}°/s at r ${px(a.r)} px, ${b.part} ${deg(Math.abs(wb)).toFixed(0)}°/s at r ${px(ratioTo(b))} px); ω·r must match or the belt slips.`, [a.part, b.part], { anim: an.name });
    }
  };

  for (const belt of meta.belts || []) {
    const what = `belt ${belt.id || '?'}`;
    const W = (belt.pulleys || []).map((p) => ({ spec: p, w: wheel(ctx, p) }));
    for (const x of W) if (!x.w) add('belt', 'error', `${what}: pulley ${typeof x.spec === 'string' ? x.spec : x.spec.part} matches no element, compound or bone.`);
    const P = W.map((x) => x.w).filter(Boolean);
    if (P.length < 2) { add('belt', 'error', `${what}: needs at least two pulleys.`); continue; }
    let ok = true; for (let i = 1; i < P.length; i++) ok = planeOk(P[0], P[i], what) && ok;
    if (!ok) continue;
    const axis = P[0].axis;
    const segs = (belt.segments || []).map((nm) => ({ nm, o: rest.find((o) => o.name === nm) }));
    for (const s of segs) if (!s.o) add('belt', 'error', `${what}: segment ${s.nm} matches no element.`);
    // tangency: every straight run touches two pulleys on its inner face, and reaches them
    const tangentTo = new Map(P.map((p) => [p.part, 0]));
    for (const { nm, o } of segs.filter((s) => s.o)) {
      const ks = [0, 1, 2].filter((k) => Math.abs(o.u[k].dot(axis)) < 0.9998);
      if (ks.length !== 2) { add('belt', 'error', `${what}: ${nm} is not in the pulley plane (rotated off the shaft axis).`, [nm]); continue; }
      const [kd, kn] = o.e[ks[0]] >= o.e[ks[1]] ? ks : [ks[1], ks[0]];
      const d = o.u[kd], nrm = o.u[kn];
      const off = Math.abs(o.c.clone().sub(P[0].c).dot(axis));
      if (off > tol * 2) add('belt', 'error', `${what}: ${nm} is ${px(off)} px out of the pulley plane.`, [nm]);
      const res = P.map((p) => {
        const v = p.c.clone().sub(o.c); v.addScaledVector(axis, -v.dot(axis));
        const along = v.dot(d); const across = Math.abs(v.dot(nrm));
        return { p, residual: across - o.e[kn] - p.r, along, short: Math.max(0, Math.abs(along) - o.e[kd]) };
      }).sort((a, b) => Math.abs(a.residual) - Math.abs(b.residual));
      const touching = res.filter((r) => Math.abs(r.residual) <= tol);
      if (touching.length < 2) {
        const [a, b] = res;
        add('belt', 'error', `${what}: ${nm} is not tangent to two pulleys (off ${px(a.residual)} px from ${a.p.part}${b ? `, ${px(b.residual)} px from ${b.p.part}` : ''}; ${px(tol)} px allowed). A straight run must leave each wheel along its tangent.`, [nm, ...res.slice(0, 2).map((r) => r.p.part)]);
      }
      for (const r of touching) {
        tangentTo.set(r.p.part, tangentTo.get(r.p.part) + 1);
        if (r.short > rules.beltGapPx * PX) add('belt', 'error', `${what}: ${nm} stops ${px(r.short)} px short of its tangent point on ${r.p.part}; the belt has a gap.`, [nm, r.p.part]);
      }
    }
    if (segs.length) for (const [part, k] of tangentTo) if (k < 2) add('belt', 'error', `${what}: ${part} has ${k} straight run(s) on it; a closed belt arrives and leaves (2).`, [part]);
    // wrap angle and centre distance (two-pulley drives)
    if (P.length === 2) {
      const [a, b] = P; const C = a.c.clone().sub(b.c).addScaledVector(axis, -a.c.clone().sub(b.c).dot(axis)).length();
      const R = Math.max(a.r, b.r), r = Math.min(a.r, b.r); const small = a.r <= b.r ? a : b;
      if (C <= R + r + PX) add('belt', 'error', `${what}: the pulleys are ${px(C)} px apart for radii ${px(R)} + ${px(r)} px; they touch, so this is a gear, not a belt.`, [a.part, b.part]);
      else {
        const wrap = belt.crossed ? 180 + 2 * deg(Math.asin(Math.min(1, (R + r) / C))) : 180 - 2 * deg(Math.asin(Math.min(1, (R - r) / C)));
        if (wrap < rules.beltWrapMinDeg) add('belt', 'error', `${what}: the belt wraps ${wrap.toFixed(0)}° of ${small.part} (minimum ${rules.beltWrapMinDeg}°); it would slip. Move the pulleys apart, add an idler, or bring the radii closer.`, [small.part], { wrap: +wrap.toFixed(1) });
        else if (wrap < rules.beltWrapWarnDeg) add('belt', 'warn', `${what}: the belt wraps ${wrap.toFixed(0)}° of ${small.part} (aim for ${rules.beltWrapWarnDeg}° or more).`, [small.part], { wrap: +wrap.toFixed(1) });
      }
      speedCheck(what, a, b, belt.crossed ? -1 : 1, (w) => w.r);
    }
  }

  for (const g of meta.gears || []) {
    const what = `gears ${g.a}/${g.b}`;
    const a = wheel(ctx, g.ra !== undefined ? { part: g.a, r: g.ra } : g.a), b = wheel(ctx, g.rb !== undefined ? { part: g.b, r: g.rb } : g.b);
    if (!a || !b) { add('belt', 'error', `${what}: ${!a ? g.a : g.b} matches no element, compound or bone.`); continue; }
    if (!planeOk(a, b, what)) continue;
    // pitch radius: the given one, or the apothem (the teeth are the parts outside it)
    const C = a.c.clone().sub(b.c).addScaledVector(a.axis, -a.c.clone().sub(b.c).dot(a.axis)).length();
    if (Math.abs(C - (a.r + b.r)) > tol * 2) add('belt', 'error', `${what}: centres are ${px(C)} px apart, pitch radii add to ${px(a.r + b.r)} px; the teeth ${C > a.r + b.r ? 'do not reach each other' : 'cut into each other'}.`, [g.a, g.b]);
    // meshing gears share one tooth pitch (arc length per tooth on the pitch circle); otherwise the teeth
    // cannot fit into each other, whatever the radii
    if (g.ta && g.tb) {
      const pa = (2 * Math.PI * a.r) / g.ta, pb = (2 * Math.PI * b.r) / g.tb;
      if (Math.abs(pa - pb) > 0.05 * Math.max(pa, pb)) add('belt', 'error', `${what}: tooth pitch ${px(pa)} px vs ${px(pb)} px (${g.ta} and ${g.tb} teeth); meshing gears need the same pitch, so teeth must be in the ratio of the radii (${(a.r / b.r).toFixed(2)}).`, [g.a, g.b]);
    }
    speedCheck(what, a, b, -1, (w) => w.r);
  }

  // Drivetrain: every part that keeps turning in a working loop must be driven, through declared gears,
  // belts or drives (a closed gearbox: { a, b, ratio, via }), from a power source: a rotation port's `bone`
  // or a meta.sources entry ({ bone, why }). A drive's ratio (signed, b turns per a turn) is measured.
  for (const d of meta.drives || []) {
    const what = `drive ${d.a}->${d.b}${d.via ? ` (${d.via})` : ''}`;
    const a = wheel(ctx, { part: d.a, axis: (meta.joints || {})[d.a]?.axis }), b = wheel(ctx, { part: d.b, axis: (meta.joints || {})[d.b]?.axis });
    if (!a || !b) { add('drivetrain', 'error', `${what}: ${!a ? d.a : d.b} matches no element, compound or bone.`); continue; }
    if (typeof d.ratio !== 'number') { add('drivetrain', 'error', `${what}: needs a numeric ratio (turns of ${d.b} per turn of ${d.a}, negative when it reverses).`); continue; }
    for (const an of anims) {
      const wa = spin(ctx, a, an), wb = spin(ctx, b, an) * Math.sign(a.axis.dot(b.axis) || 1);
      if (Math.abs(wa) < 1e-3 && Math.abs(wb) < 1e-3) continue;
      const got = Math.abs(wa) < 1e-3 ? Infinity : wb / wa;
      if (Math.abs(got - d.ratio) > 0.05 * Math.abs(d.ratio) + 1e-3) add('drivetrain', 'error', `${what} (${an.name}): ${d.b} turns ${Number.isFinite(got) ? got.toFixed(2) : 'while the input stands still'} per turn of ${d.a}; the declared ratio is ${d.ratio}.`, [d.a, d.b], { anim: an.name });
    }
  }
  const sources = [...(meta.ports || []).filter((p) => p.kind === 'rotation' && p.bone).map((p) => p.bone), ...(meta.sources || []).map((x) => x.bone)];
  for (const x of meta.sources || []) if (!x.why) add('drivetrain', 'error', `source ${x.bone}: an internal power source needs a why (what turns it).`);
  const working = anims.filter((an) => /^(working|idle|run)/i.test(an.name));
  // a spinner keeps turning relative to its parent: a crucible that only tilts on a turning carousel is not one
  const localTurns = (bn, axis, an) => {
    const bone = ctx.sk.bones.get(bn); if (!bone) return 0;
    const k = Math.max(2, Math.ceil((an.length || 0) * rules.sweepHz)), ax = AXES[axis] ?? 0; let prev = null, total = 0;
    for (let s = 0; s <= k; s++) {
      poseAt(ctx.sk, Math.min((s / k) * an.length, an.length - 1e-6), an.name);
      const q = bone.quaternion, v = [q.x, q.y, q.z][ax], a = 2 * Math.atan2(v, q.w);
      if (prev !== null) { let d = a - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; total += d; }
      prev = a;
    }
    return Math.abs(total) / (2 * Math.PI);
  };
  const spinners = Object.entries(meta.joints || {}).filter(([, j]) => j.type === 'revolute').map(([bn, j]) => ({ bn, j }))
    .filter(({ bn, j }) => working.some((an) => localTurns(bn, j.axis, an) >= 0.95));
  if (spinners.length) {
    const edges = new Map();
    const link = (x, y) => { for (const [p, q] of [[x, y], [y, x]]) { if (!edges.has(p)) edges.set(p, new Set()); edges.get(p).add(q); } };
    const boneOf = (part) => { const el = rest.find((o) => o.name === part || stemOf(o.name) === part); if (!el) return part; let n = ctx.sk.elements[rest.indexOf(el)].obj.parent; while (n) { if (meta.joints && meta.joints[n.name]) return n.name; n = n.parent; } return part; };
    for (const g of meta.gears || []) link(boneOf(g.a), boneOf(g.b));
    for (const d of meta.drives || []) link(boneOf(d.a), boneOf(d.b));
    for (const bt of meta.belts || []) { const ps = (bt.pulleys || []).map((p) => boneOf(typeof p === 'string' ? p : p.part)); for (let i = 1; i < ps.length; i++) link(ps[0], ps[i]); }
    const reached = new Set(sources); const stack = [...sources];
    while (stack.length) { const n = stack.pop(); for (const m of edges.get(n) || []) if (!reached.has(m)) { reached.add(m); stack.push(m); } }
    if (!sources.length) add('drivetrain', 'warn', `${spinners.length} part(s) turn but no power source is declared: give the rotation port a \`bone\`, or add meta.sources with a why.`);
    else for (const { bn } of spinners) if (!reached.has(bn)) add('drivetrain', 'error', `${bn} turns in the working loop but nothing drives it: link it to a power source through meta.gears, meta.belts or meta.drives.`, [bn]);
  }
}

// ------------------------------------------------------------------ joint kinematics
// arffornia.joints: { "<bone>": { type: "revolute"|"prismatic"|"fixed"|"free", axis: "x"|"y"|"z",
//   min, max (degrees or px, in the bone's own channel values), why (required for "free") } }
export function checkKinematics(ctx) {
  const { sk, json, meta, rules, add, anims } = ctx;
  const joints = meta.joints || {};
  const animated = new Set();
  for (const an of anims) for (const a of Object.values(an.animators || {})) if ((a.keyframes || []).length) animated.add(a.name);
  for (const [b, j] of Object.entries(joints)) {
    if (!sk.bones.has(b)) add('kinematics', 'error', `joint ${b}: no bone of that name.`);
    if (j.type === 'free' && !j.why) add('kinematics', 'error', `joint ${b} is "free" (no rigid-motion check) without a "why".`);
    if ((j.type === 'revolute' || j.type === 'prismatic') && AXES[j.axis] === undefined) add('kinematics', 'error', `joint ${b}: ${j.type} needs an axis (x, y or z).`);
  }
  const undeclared = [...animated].filter((b) => !joints[b]);
  if (undeclared.length) add('kinematics', 'warn', `animated bone(s) with no joint in arffornia.joints, so their limits are not checked: ${undeclared.slice(0, 6).join(', ')}${undeclared.length > 6 ? ` (+${undeclared.length - 6})` : ''}.`, undeclared);

  // the hinge must exist: a revolute pivot sits in (or on) a part that moves and a part that holds it
  const restPose = () => { for (const g of sk.bones.values()) { const r = g.userData.rest; g.position.copy(r.p); g.rotation.copy(r.r); g.scale.copy(r.s); } sk.root.updateMatrixWorld(true); };
  restPose();
  const O = obbs(sk);
  const under = (bone) => { const set = new Set(); sk.elements.forEach((x, i) => { let n = x.obj.parent; while (n) { if (n === bone) { set.add(i); break; } n = n.parent; } }); return set; };
  for (const [b, j] of Object.entries(joints)) {
    if (j.type !== 'revolute' || !sk.bones.has(b) || !animated.has(b)) continue;
    const g = sk.bones.get(b); const pivot = g.getWorldPosition(new THREE.Vector3());
    const inside = under(g);
    const dIn = Math.min(Infinity, ...[...inside].map((i) => distToObb(O[i], pivot)));
    const dOut = Math.min(Infinity, ...O.map((o, i) => (inside.has(i) ? Infinity : distToObb(o, pivot))));
    const lim = rules.jointPivotTolPx * PX;
    if (dIn > lim || dOut > lim) add('kinematics', 'error', `joint ${b}: the hinge pivot is in thin air (${dIn > lim ? `${px(dIn)} px from the moving part` : `${px(dOut)} px from anything that holds it`}). Put the pivot on a pin, an axle or a bearing.`, [b]);
  }

  // motion: rigid, about/along the declared axis, inside the limits, no jumps, closed loops
  const tolDeg = rules.jointTolDeg, tolPx = rules.jointTolPx;
  for (const an of anims) {
    const L = an.length || 0; const k = Math.max(2, Math.ceil(L * rules.sweepHz));
    for (const a of Object.values(an.animators || {})) {
      const kf = a.keyframes || []; if (!kf.length) continue;
      const ch = (c) => kf.filter((x) => x.channel === c).sort((x, y) => x.time - y.time);
      const pos = ch('position'), rot = ch('rotation'), scl = ch('scale');
      const j = joints[a.name];
      let worst = null; const flag = (msg, t) => { if (!worst) worst = { msg, t }; };
      let maxScale = 0;
      for (let s = 0; s <= k; s++) {
        const t = (s / k) * L;
        const p = sampleChannel(pos, t) || [0, 0, 0], r = sampleChannel(rot, t) || [0, 0, 0], sc = sampleChannel(scl, t) || [1, 1, 1];
        maxScale = Math.max(maxScale, ...sc.map((v) => Math.abs(v - 1)));
        if (!j || j.type === 'free') continue;
        const ax = AXES[j.axis];
        if (j.type === 'fixed') { if (Math.max(...p.map(Math.abs)) > tolPx || Math.max(...r.map(Math.abs)) > tolDeg) flag(`joint ${a.name} is fixed but moves`, t); continue; }
        if (j.type === 'revolute') {
          if (Math.max(...p.map(Math.abs)) > tolPx) flag(`hinge ${a.name} translates by ${Math.max(...p.map(Math.abs)).toFixed(2)} px; a hinge only turns`, t);
          const off = [0, 1, 2].filter((q) => q !== ax).map((q) => Math.abs(r[q])); if (Math.max(...off) > tolDeg) flag(`hinge ${a.name} turns ${Math.max(...off).toFixed(1)}° off its ${j.axis} axis`, t);
          if (j.min !== undefined && r[ax] < j.min - tolDeg) flag(`hinge ${a.name} reaches ${r[ax].toFixed(1)}°, below its limit ${j.min}°`, t);
          if (j.max !== undefined && r[ax] > j.max + tolDeg) flag(`hinge ${a.name} reaches ${r[ax].toFixed(1)}°, above its limit ${j.max}°`, t);
        }
        if (j.type === 'prismatic') {
          if (Math.max(...r.map(Math.abs)) > tolDeg) flag(`slide ${a.name} rotates by ${Math.max(...r.map(Math.abs)).toFixed(1)}°; a slide only translates`, t);
          const off = [0, 1, 2].filter((q) => q !== ax).map((q) => Math.abs(p[q])); if (Math.max(...off) > tolPx) flag(`slide ${a.name} moves ${Math.max(...off).toFixed(2)} px off its ${j.axis} axis`, t);
          if (j.min !== undefined && p[ax] < j.min - tolPx) flag(`slide ${a.name} reaches ${p[ax].toFixed(2)} px, below its limit ${j.min} px`, t);
          if (j.max !== undefined && p[ax] > j.max + tolPx) flag(`slide ${a.name} reaches ${p[ax].toFixed(2)} px, above its limit ${j.max} px`, t);
        }
      }
      if (worst) add('kinematics', 'error', `${an.name}: ${worst.msg} (first at ${fmtT(worst.t)}).`, [a.name], { anim: an.name, t: worst.t });
      if (maxScale > rules.scaleTol && !(j && j.type === 'free')) add('kinematics', 'error', `${an.name}: ${a.name} scales by ${(100 * maxScale).toFixed(0)}%; parts do not grow or shrink (${(100 * rules.scaleTol).toFixed(0)}% squash allowed). Slide it in, unfold it, or declare the joint "free" with a why (light, fluid, glow).`, [a.name], { anim: an.name });
    }

    // whole-model motion: jumps between 80 Hz samples, the loop seam, deploy ending at rest
    const snap = (t) => { poseAt(sk, Math.max(0, Math.min(t, L - 1e-6)), an.name); return obbs(sk).map((o) => corners(o)); };
    const moved = (A, Bc) => { let m = 0, who = -1; A.forEach((cs, i) => cs.forEach((c, q) => { const d = c.distanceTo(Bc[i][q]); if (d > m) { m = d; who = i; } })); return { m, who }; };
    if (L > 0) {
      // a work piece that respawns (joint free + respawn: true) may teleport, but only while hidden (scaled to 5% or less)
      const boneOfEl = (i) => { let n = sk.elements[i].obj.parent; while (n) { if (joints[n.name]) return n.name; n = n.parent; } return null; };
      const respawn = new Set(sk.elements.map((_, i) => i).filter((i) => { const bn = boneOfEl(i); return bn && joints[bn].type === 'free' && joints[bn].respawn; }));
      const keepOut = (A) => A.map((cs, i) => (respawn.has(i) ? cs.map(() => new THREE.Vector3()) : cs));
      let prev = snap(0); let jump = null;
      for (let s = 1; s <= k; s++) {
        const t = (s / k) * L; const cur = snap(t);
        for (const i of respawn) {
          const d = Math.max(...cur[i].map((c, q) => c.distanceTo(prev[i][q])));
          if (d > rules.maxJumpPx * PX && sk.elements[i].obj.getWorldScale(new THREE.Vector3()).length() > 0.05 * Math.sqrt(3)) add('kinematics', 'error', `${an.name}: ${sk.elements[i].name} respawns ${px(d)} px away at ${fmtT(t)} while visible; scale it below 5% first.`, [sk.elements[i].name], { anim: an.name, t });
        }
        const { m, who } = moved(keepOut(prev), keepOut(cur)); if (m > rules.maxJumpPx * PX && (!jump || m > jump.m)) jump = { m, who, t }; prev = cur;
      }
      if (jump) add('kinematics', 'error', `${an.name}: ${sk.elements[jump.who].name} jumps ${px(jump.m)} px in one 1/${rules.sweepHz} s step at ${fmtT(jump.t)}; real parts accelerate (no step keys, no teleport).`, [sk.elements[jump.who].name], { anim: an.name, t: jump.t });
      if (an.loop === 'loop' || an.loop === true) {
        // the seam: the pose just before the end against the pose at 0, minus one step of normal motion
        const a0 = snap(0), a1 = snap(L / k), aEnd = snap(L - 1e-6);
        const step = moved(a0, a1).m; const seam = moved(aEnd, a0);
        if (seam.m > Math.max(rules.loopSeamPx * PX, 3 * step)) add('kinematics', 'error', `${an.name}: the loop does not close; ${sk.elements[seam.who].name} jumps ${px(seam.m)} px when it restarts.`, [sk.elements[seam.who].name], { anim: an.name });
      }
      if (/^(deploy|setup|assemble|unfold)/i.test(an.name.split('.').pop())) {
        const end = snap(L - 1e-6); restPose(); const restC = obbs(sk).map((o) => corners(o)); const d = moved(end, restC);
        if (d.m > rules.loopSeamPx * PX) add('kinematics', 'error', `${an.name}: the deploy ends ${px(d.m)} px from the bind pose (${sk.elements[d.who].name}); the idle animation would snap.`, [sk.elements[d.who].name], { anim: an.name });
        const packed = anims.find((x) => /^(packaged|folded|crated)/i.test(x.name.split('.').pop()));
        if (packed) {
          poseAt(sk, Math.max(0, (packed.length || 0) - 1e-6), packed.name); const pc = obbs(sk).map((o) => corners(o)); const st = snap(0); const dd = moved(st, pc);
          if (dd.m > rules.loopSeamPx * PX) add('kinematics', 'error', `${an.name} starts ${px(dd.m)} px from the end of ${packed.name} (${sk.elements[dd.who].name}); the unfold would snap.`, [sk.elements[dd.who].name], { anim: an.name });
        }
      }
    }
  }
  restPose();
  void json;
}
