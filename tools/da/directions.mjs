// The three candidate art directions as code: palettes (materials by role) and the style of the
// shared primitives (how a slab, a drum, a pipe, a lamp look in each). The machine layouts in
// machines.mjs are the same functional program for every direction, so the board compares style,
// not content. Principles in words: docs/DA.md.
import { M, stencil } from './kit.mjs';

export const DIRECTIONS = {
  // A. Heavy Industry: Satisfactory / Immersive Engineering lineage. Mechanism on show, painted steel,
  // signal orange bodies on gunmetal structure, warm sodium light, hazard where things move.
  industrial: {
    title: 'A · Heavy Industry', short: 'A',
    mat: {
      base: M.paint('#34393e', { grime: 0.55, grimeH: 6, wear: 0.06, noise: 0.12 }),
      body: M.paint('#d47a2a', { grime: 0.5, grimeH: 20, wear: 0.1, rivets: 16, panel: 32 }),
      body2: M.paint('#c9a23a', { grime: 0.45, wear: 0.2, panel: 32 }),
      frame: M.paint('#3c4248', { grime: 0.5, wear: 0.06 }),
      steel: M.metal('#8e979f', { bands: 10 }),
      dark: M.paint('#25292d', { grime: 0.3, wear: 0.05 }),
      pipe: M.metal('#7f878e', { bands: 14 }),
      pipe2: M.paint('#3f6f8f', { wear: 0.2, grime: 0.3 }),
      hazard: M.hazard(),
      grate: M.grate('#4a5057'),
      vent: M.grate('#3a3f45', { vertical: true }),
      glass: M.glass('#a9c7d6'),
      warm: M.glow('#ffb44a'),
      hot: M.glow('#ff6a1a', { flicker: true, core: '#ffd27a' }),
      energy: M.glow('#ffd24a'),
      fluid: M.glow('#ffb44a', { strength: 0.8 }),
      rubber: M.rubber(),
      ore: M.paint('#6b5a4c', { noise: 0.6 }),
      brick: M.brick('#8a4a32', '#2e2420', { heat: 0.9, heatY: 22 }),
      screen: M.screen('#10212a', '#5ce0a0'),
      ok: M.glow('#5cff8a'),
      accent: M.paint('#d8dde0', { wear: 0.1 }),
    },
    lamp: 'cage', drumSides: 12, chamfer: 0, wear: true,
    look: { bg: ['#2b3138', '#1d2228', '#15181c'], floorBase: '#3a3f46', floorLine: '#474e57', padColor: '#4a5058', keyColor: '#ffe2c4', rimColor: '#8fc8ff', bloom: 0.5, glow: 2.2 },
  },
  // B. Clean Orbital: Oritech / Mekanism / Dyson Sphere Program lineage. Monolithic ceramic shells with
  // chamfers, graphite structure, process visible behind glass, cyan energy lines, almost no wear.
  orbital: {
    title: 'B · Clean Orbital', short: 'B',
    mat: {
      base: M.paint('#2a2f36', { noise: 0.05 }),
      body: M.ceramic('#e3e6e9', { panel: 24, grime: 0.25 }),
      body2: M.ceramic('#c9ced3', { panel: 16 }),
      frame: M.paint('#2c3138', { noise: 0.05 }),
      steel: M.metal('#b7bfc7', { streak: 0.08 }),
      dark: M.paint('#1b1f24', { noise: 0.04 }),
      pipe: M.ceramic('#d4d9de', { panel: 12 }),
      pipe2: M.paint('#2c3138', { noise: 0.05 }),
      hazard: M.paint('#ff7a1a', { noise: 0.03 }),
      grate: M.grate('#2c3138', { glow: '#3fe0ff' }),
      vent: M.grate('#2c3138', { vertical: true }),
      glass: M.glass('#bfe9f5'),
      warm: M.glow('#3fe0ff'),
      hot: M.glow('#ff8a3a', { core: '#ffe0b0' }),
      energy: M.glow('#3fe0ff'),
      fluid: M.glow('#3fe0ff', { strength: 0.8 }),
      rubber: M.rubber('#22262b'),
      ore: M.paint('#5d636b', { noise: 0.5 }),
      brick: M.ceramic('#3a3f46', { panel: 8 }),
      screen: M.screen('#0d1a22', '#3fe0ff'),
      ok: M.glow('#3fe0ff'),
      accent: M.paint('#ff7a1a', { noise: 0.03 }),
    },
    lamp: 'strip', drumSides: 12, chamfer: 3, wear: false,
    look: { bg: ['#2a3340', '#1b222c', '#12171e'], floorBase: '#30363f', floorLine: '#3b434e', padColor: '#3a414b', keyColor: '#f2f6ff', rimColor: '#7fe9ff', bloom: 0.45, glow: 1.5 },
  },
  // C. Hex-Forge: Arffornia's own. Honeycomb plates and hexagonal prisms (the title screen's mosaic),
  // dark teal enamel, brass collars and copper pipes with patina, amber light through hex windows,
  // clockwork motion.
  hexforge: {
    title: 'C · Hex-Forge', short: 'C',
    mat: {
      base: M.paint('#23292c', { grime: 0.4, grimeH: 6, wear: 0.05 }),
      body: M.hexplate('#24504c', '#15302e', { size: 6 }),
      body2: M.paint('#2f5d58', { wear: 0.15, panel: 24 }),
      frame: M.paint('#2a3033', { grime: 0.35, wear: 0.06 }),
      steel: M.metal('#c9a24a', { streak: 0.25 }),
      dark: M.paint('#1d2224', { wear: 0.05 }),
      pipe: M.metal('#b8693c', { bands: 12, patina: 0.9 }),
      pipe2: M.metal('#c9a24a', { bands: 8 }),
      hazard: M.metal('#c9a24a', { bands: 4 }),
      grate: M.hexplate('#1d2224', '#0e1112', { size: 4, glow: '#ffb84a', glowP: 0.55 }),
      vent: M.grate('#2a3033', { vertical: true }),
      glass: M.glass('#ffd99a'),
      warm: M.glow('#ffc04a'),
      hot: M.glow('#ff7a2a', { flicker: true, core: '#ffe08a' }),
      energy: M.glow('#2fd1c1'),
      fluid: M.glow('#2fd1c1', { strength: 0.8 }),
      rubber: M.rubber('#1f2224'),
      ore: M.paint('#5e5248', { noise: 0.6 }),
      brick: M.brick('#5a3a2c', '#1f1916', { heat: 0.8, heatY: 22 }),
      screen: M.screen('#0d1f1d', '#ffc04a'),
      ok: M.glow('#2fd1c1'),
      accent: M.metal('#c9a24a', { streak: 0.2 }),
    },
    lamp: 'hex', drumSides: 6, chamfer: 0, wear: true,
    look: { bg: ['#23302f', '#182221', '#101615'], floorBase: '#2c3433', floorLine: '#38423f', padColor: '#36403e', keyColor: '#ffe6c2', rimColor: '#6fe6d6', bloom: 0.55, glow: 2.3 },
  },
  // D. Forge Mix (the art director's synthesis): A's structure and material discipline (60% dark
  // gunmetal, 30% painted cover panels, 10% accent), C's teal + brass only on cover panels, trims and
  // nameplates, hex as a brand mark (not wallpaper), amber = heat/process, cyan = power (high tier only).
  forgemix: {
    title: 'D · Forge Mix', short: 'D',
    mat: {
      base: M.paint('#2c3135', { grime: 0.5, grimeH: 6, wear: 0.05, noise: 0.12 }),
      body: M.paint('#355955', { grime: 0.45, grimeH: 18, wear: 0.08, rivets: 16, panel: 32 }),
      body2: M.hexplate('#2f4f4b', '#1b2e2c', { size: 5 }),
      frame: M.paint('#3a4045', { grime: 0.5, wear: 0.05 }),
      steel: M.metal('#8e979f', { bands: 10 }),
      dark: M.paint('#22262a', { grime: 0.3, wear: 0.03 }),
      pipe: M.metal('#a8653c', { bands: 14, patina: 0.5 }),
      pipe2: M.metal('#c9a24a', { bands: 8 }),
      hazard: M.hazard('#e0b030', '#1b1c1e'),
      grate: M.grate('#3a4045', { glow: '#ffb44a' }),
      vent: M.grate('#2c3135', { vertical: true }),
      glass: M.glass('#ffd99a'),
      warm: M.glow('#ffb44a'),
      hot: M.glow('#ff6a1a', { flicker: true, core: '#ffd27a' }),
      energy: M.glow('#ffb44a'),
      fluid: M.glow('#ffb44a', { strength: 0.8 }),
      rubber: M.rubber(),
      ore: M.paint('#6b5a4c', { noise: 0.6 }),
      brick: M.brick('#7a4430', '#2a201c', { heat: 0.9, heatY: 22 }),
      screen: M.screen('#10212a', '#ffb44a'),
      ok: M.glow('#5cff8a'),
      accent: M.metal('#c9a24a', { streak: 0.2 }),
    },
    lamp: 'cage', drumSides: 12, chamfer: 0, wear: true,
    look: { bg: ['#2a3034', '#1d2226', '#15181b'], floorBase: '#373c42', floorLine: '#444a51', padColor: '#454b52', keyColor: '#ffe2c4', rimColor: '#8fd8ff', bloom: 0.4, glow: 1.8 },
  },
};

// Style-aware primitives. Every helper takes px coordinates (16 = 1 block).
export function kit(b, D) {
  const m = D.mat;
  const K = {
    m, D,
    // a structural or body slab: plain (A, C) or chamfered (B)
    slab(name, from, to, role = 'body', o = {}) {
      const big = Math.min(to[0] - from[0], to[2] - from[2]) >= 10;
      if (D.chamfer && big && !o.square) return b.chamfer(name, from, to, m[role], D.chamfer, o);
      return [b.box(name, from, to, m[role], o)];
    },
    // a drum / tank / roller: 12-gon (A, B) or hexagon (C); flat = axis direction that must be flat
    drum(name, c, r, len, axis, role = 'steel', o = {}) {
      const sides = o.sides || D.drumSides;
      let spin = o.spin || 0;
      if (sides === 6 && o.flat === 'z' && axis === 'y') spin += 30;
      if (sides === 6 && o.flat === 'y' && axis !== 'y') spin += 30;
      return b.prism(name, c, r, len, axis, m[role], sides, { ...o, spin });
    },
    // pipe run through axis-aligned points; joints get a flange (A, C) or a sleeve (B)
    pipe(name, pts, r, role = 'pipe', o = {}) {
      const out = []; const j = r + 0.6; const last = pts.length - 2;
      for (let i = 0; i <= last; i++) {
        const a = pts[i], z = pts[i + 1]; const ax = [0, 1, 2].find((k) => a[k] !== z[k]); const dir = Math.sign(z[ax] - a[ax]);
        const s0 = a[ax] + (i === 0 ? 0 : dir * j), s1 = z[ax] - (i === last ? 0 : dir * j);
        const c = [...a]; c[ax] = (s0 + s1) / 2; const len = Math.abs(s1 - s0);
        if (D.short === 'B') { const f = c.map((v, k) => (k === ax ? Math.min(s0, s1) : v - r)), t = c.map((v, k) => (k === ax ? Math.max(s0, s1) : v + r)); out.push(b.box(`${name}_${i}`, f, t, m[role])); }
        else out.push(...b.prism(`${name}_${i}`, c, r, len, 'xyz'[ax], m[role], 8));
        if (i > 0) out.push(b.box(`${name}_j${i}`, a.map((v) => v - j), a.map((v) => v + j), D.short === 'B' ? m.frame : m[o.flange || 'steel']));
      }
      return out;
    },
    // a lamp sitting on a surface (on: top face point), the style's light language
    lamp(name, at, role = 'warm') {
      const [x, y, z] = at;
      if (D.lamp === 'cage') { b.box(`${name}_base`, [x - 2, y, z - 2], [x + 2, y + 1, z + 2], m.dark); b.box(`${name}_bulb`, [x - 1.5, y + 1, z - 1.5], [x + 1.5, y + 4, z + 1.5], m[role]); b.box(`${name}_cap`, [x - 2, y + 4, z - 2], [x + 2, y + 5, z + 2], m.dark); }
      else if (D.lamp === 'strip') { b.box(`${name}_base`, [x - 3, y, z - 3], [x + 3, y + 1, z + 3], m.frame); b.box(`${name}_bulb`, [x - 2, y + 1, z - 2], [x + 2, y + 2.5, z + 2], m.energy); }
      else { b.prism(`${name}_base`, [x, y + 0.5, z], 3, 1, 'y', m.steel, 6); b.prism(`${name}_bulb`, [x, y + 2.5, z], 2.2, 3, 'y', m[role], 6); }
    },
    // a port collar on the footprint boundary (lint: on a block cell centre, 6-16 px)
    port(id, face, centre, kind = 'item', size = 8, depth = 2) {
      const [x, y, z] = centre; const h = size / 2;
      const role = kind === 'fluid' ? 'pipe2' : kind === 'energy' ? 'energy' : 'hazard';
      const F = { north: [[x - h, y - h, z], [x + h, y + h, z + depth]], south: [[x - h, y - h, z - depth], [x + h, y + h, z]], west: [[x, y - h, z - h], [x + depth, y + h, z + h]], east: [[x - depth, y - h, z - h], [x, y + h, z + h]] }[face];
      b.box(`port_${id}`, F[0], F[1], m[role]);
    },
    tag: (txt) => stencil(txt, D.short === 'B' ? '#2c3138' : D.short === 'C' ? '#c9a24a' : '#1b1c1e'),
  };
  return K;
}
