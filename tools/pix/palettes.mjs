// House colour studies (Brian, 2026-11-07): alternatives to the signal-orange paint and copper trims, sent
// round for opinions. Each entry replaces ramps by name (sig = house paint, gun = structure, cu = trims).
// Apply one to a machine with KILN_PALETTE=<name> (smelter_kiln_s3) or by calling addRamp for each entry.
// Board: docs/palettes/s3_palettes.jpg (cuivre = the current house look, then oxyde, vert, ocre).
const BRASS = ['#2e2108', '#5e4511', '#9a7420', '#c9a23e', '#eedb8a'];
export const PALETTES = {
  oxyde: { sig: ['#2e0d0b', '#5e1a15', '#8a2a20', '#b0432e', '#d9734e'], cu: BRASS },
  vert: { sig: ['#0f1f17', '#1d3a2a', '#2e5a3f', '#4a7c55', '#7fa574'], gun: ['#0e0e0f', '#1b1b1d', '#2a2a2d', '#3e3e42', '#5c5b5f'], cu: BRASS },
  ocre: { sig: ['#3a2508', '#7a4d10', '#b8801c', '#dcab3a', '#f2d77a'], gun: ['#14171b', '#252a31', '#3a414a', '#56606b', '#7d8792'] },
};
