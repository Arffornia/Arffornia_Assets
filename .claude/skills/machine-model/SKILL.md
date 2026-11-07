---
name: machine-model
description: Design and build an Arffornia machine (a Minecraft multiblock) as a Blockbench model with hand-designed pixel-art textures, at the quality of Oritech, Create or Immersive Engineering. Use when asked to model, redesign, texture or animate a machine or block, or to turn a concept image into a model.
---

# Machine model

You are the 3D artist. The bar is a machine from Oritech, Create or Immersive Engineering, seen in game.
Below that bar, the model is not finished, however clean the lint is.

## What makes those models good (measured, not guessed)

- **Few shapes, well composed.** Oritech machines have 25–45 cubes (assembler 45, foundry 28,
  refinery 32). The quality is not the cube count.
- **The texture is the art.** About 40 colours per machine. Every face has a light map (lighter at the
  top, darker at the bottom), a sparse texel jitter, and motifs placed on purpose: key-shaped "maze"
  strokes on painted plates, stripes on stone-like towers, checker on plinths, inset ports, screens,
  glowing windows. **No outline around each face**: the edge between two faces comes from the light,
  and an outline on every cube makes the model look like wooden crates (bench cycle 1).
- **Strong colour blocking.** One structure ramp (dark steel), one house colour (orange paint), one or
  two accents (copper, teal screens). Glow only where something is hot or powered.
- **A silhouette that says the function**, then a mechanism that moves and explains it.

Procedural noise, projected AI images and random rivets all looked wrong in tests (Nov 2026). Do not use them.
Vector-perfect faces look wrong too: Oritech textures have a texel variation of 0.38–0.46 (share of texels
that differ from their right neighbour). The default `mat()` surface (light map + jitter) plus grain
lands around 0.34; motifs bring it up.

Texture rules (from Oritech, and from 3dixel's rules for Blockbench art):
- Ramps are hue-shifted: shadows lean cooler, lights warmer. Keep saturation even through the middle shades.
- Detail is strongest in the light and fades in the shadow. One tone up or down for engraving and
  strokes; strong steps everywhere read as noise.
- No face is flat, including undersides, inner faces and small parts. Before showing, name the
  detail on each visible face of each part; a face with nothing to name is not done.
- No single-colour area much larger than the detail around it: it reads as one giant pixel.
- Glow is an accent: the core of a window, a screen line, a tip. Not whole faces or every seam.
- **Bare share** (printed by `build.mjs`): the share of 8×8 tiles (8×N strips on narrow faces) that hold
  only the light map. Oritech machines measure 0.30–0.60; keep ≤ 0.55. Brian's verdict on the first kiln,
  which measured 0.74: "the long faces look too flat, the pipe running all along has only 2 px of texture".
- **Long runs**: no part longer than about 12 texels runs without a feature. A drum gets plate seams with
  weld beads and rivet rows, segment bands, inspection hatches and wear; a pipe gets flanges every 8–12 px
  (as 1 px larger rings in geometry), brackets to the structure, a valve or a bend. Tyres, gears and
  rollers get tread, teeth faces, hubs and spokes, not a flat fill.

## Geometry: build in four layers

A model that is one box per function reads as a placeholder, whatever its texture. Build in layers:

1. **Masses** (2–4 cubes): the main volumes, in proportions taken from the concept.
2. **Structure**: plinth steps, frames, posts, caps that overhang a mass by 1 px, ribs and beams.
   No large mass stands alone: it sits on something and is capped by something.
3. **Function**: the hero part that says what the machine does (crucible, press head, rotor, gantry)
   and the moving bones.
4. **Detail geometry** (1–3 px parts, about a third of the cubes): handles, brackets, pipe flanges, short
   pipes, lamps, cable runs, latches. These catch light and shadow; painted detail cannot.

Reading order to check: silhouette from 10 m, then the hero part, then the detail at 2 m.

## Arffornia DA by tier

The house colour (signal-orange panels) stays at every tier (decision P7): machines stay one family. What
changes with the tier is the material, the trim and light colour (spec 003 bands), the shapes and the
power source. The player reads progress at a glance: riveted heavy industry, then clean engineering, then energy.

| Tiers | Era | Structure | Panels | Trims and lights | Shapes and detail | Power reads as |
|---|---|---|---|---|---|---|
| 0–2 | Heavy industry | warm anthracite, rivets, welds | orange paint, chipped, grime | copper, amber heat glow | thick plates, open mechanisms, pipes with flanges | fire, smoke, molten metal |
| 3–4 | Clean engineering | brushed steel, blue-grey | orange enamel, clean seams, no grime | steel and blue-grey trims, white status LEDs | closed housings, cable trays, bolted covers, gauges | coils, cables, electric arcs |
| 5–6 | Mass production | dark steel | orange with black hazard edges on moving parts | industrial yellow | stacked modules, conveyors, robot arms | motors, hydraulics |
| 7 | Control | graphite | orange with glass inserts | teal lights and screens | screens, sensor heads, glass panels | data, fluids in glass |
| 8 | Particles | graphite, polished | orange ceramic, smooth bevels | violet energy conduits | rings, levitating parts, field emitters | violet plasma, fields |
| 9 | Quantum | white ceramic and graphite | orange as a thin accent band only | white and cyan | monolithic shells, floating parts, few seams | light itself |

## Lineage: how a machine changes across tiers (choose per machine, write the reason)

| Mode | What changes | Use it for | Example |
|---|---|---|---|
| `reskin` | Same chassis and footprint; power module, materials and trims follow the tier table | machines whose principle does not change: batteries, tanks, pipes, storage, simple processors | Smelter kiln Mk1 → Mk2 induction → Mk3 plasma core (Nov 2026 board) |
| `scale` | The same unit, multiplied on a shared frame: x1 → x2 → x4, or more lanes, slots, heads | throughput upgrades; the player sees "more of it" | Mekanism factories run 3, 5, 7, 9 processes in parallel |
| `rethink` | A different technology for the same function, a new silhouette and mechanism per era | flagship machines where history (or plausible fiction) has distinct technologies | Smelting: bloomery → coke blast furnace → electric arc furnace → levitation melting → plasma / electron beam |

Rules:
- Reskin: a later mark keeps the Mk1 silhouette; the change must still read from 10 m (a new hero part:
  thick coil bands that stand out, a plasma window), not only from colours (Brian on Mk2: "too close to Mk1").
- Scale: repeat the hero unit, not the whole machine; share the frame, drive and ports so it reads as one
  machine. Keep the footprint rule: the multiblock grows by whole blocks.
- Rethink: ground each mark in a real technology of its era when one exists (it gives a mechanism people
  recognise and a believable animation), then push it to Arffornia's style. What stays across marks is the
  family signature: house-colour panels, the port collars and their faces, the hex mark, the nameplate.
  Never make a primitive tier of something that only exists advanced (no medieval particle accelerator).
- How many marks: about 3 per machine, 4 at most (Brian). Five distinct machines for one function is too
  many to learn; spread them over the eras (for example tiers 0, 4, 7).
- Family signature for every mode, so the player connects the marks: the same port collar design and faces,
  the hex mark once, a nameplate with the machine name, house-colour panels.
- The tier table above still applies inside every mode: materials, trims and glow follow the tier.

## Tools

| Command | What |
|---|---|
| `tools/pix/lab.sh <seed> <dir> "<prompt>"` | One concept image on Brian's GPU (image-generation-lab, `qwen21-q4`, ~30 s). |
| `node tools/pix/build.mjs <id>` | Builds `tools/pix/machines/<id>.mjs` into `concepts/pix/<id>/`, lints it, renders two views to `out/pix/<id>/sheet.jpg`. |
| `node tools/pix/geo2bb.mjs <geo.json> <png> <out.bbmodel>` | A GeckoLib model as a reference render (Oritech is CC0: `gh api repos/Rearth/Oritech/contents/...`). |

On NixOS, Playwright's own Chromium misses system libraries: set
`CHROME_PATH=/etc/profiles/per-user/brian/bin/google-chrome-stable`.

A machine module exports `meta`, an optional `look`, and `build(b, { mat })`. See `tools/pix/machines/smelter.mjs`.
- `b.box(name, from, to, material)`, `b.prism(...)`, `b.group(bone, pivot, fn)`, `b.anim(name, len, tracks)`
  come from `tools/da/kit.mjs`. Units are px: 16 px = 1 block, origin at the footprint centre, y up.
- `mat(ramp, design, opts)` comes from `tools/pix/pix.mjs`. It paints a lit `surface()` of the ramp
  (`opts.surface`: `{ motif: 'maze'|'slots'|'rivet', cell, skip, line, flat }`), adds grain, then runs
  `design.all`, `design.side` or `design.top`, then `design[face]`, with a drawing API `d`:
  `surface`-like fills via `rect`, and `plate` (raised, outlined: for panels and small parts only),
  `inset`, `bolt`, `vent`, `window`, `screen`, `hazard`, `hline`, `vline`, `px`. `d.seed`, `d.side`,
  `d.y0`/`d.y1` (world height of the part) are there for your own patterns; `hsh(x, y, seed)` is exported.
  Coordinates are texels on that face, from its top left as seen from outside.
- `opts.plate: true` gives the old outlined plate; `opts.clean: true` skips grain; `opts.flat` is one shade.
- Ramps: `addRamp(name, [5 shades darkest first], grain?)` in your module, then use the name. Add motifs
  to `MOTIFS` (5×5 glyphs) when a machine needs its own.
- Shared helpers on `d`: `sub(x, y, w, h)` (a clipped region with its own origin: `surface(d.sub(...), ramp)`
  paints only there), `fill((x, y) => [ramp, shade] | null)`, `rings(x, y, w, h, [[ramp, k], ...])` (nested
  1-texel frames, Oritech's main panel motif), `checker`, `courses` (staggered bricks or plates).
- More helpers on `d`: `radial(fn(r, angle))` for prism caps (bolt circles, spokes, hubs; a 30° period lines up
  across a 12-gon's slabs), `brokenRings`, `stripes(x, y, w, h, [rampA, kA], [rampB, kB])` (warning stripes in
  house colours), `weld` (a bead line), `rivets` (a row), `hexMark` (the Arffornia emblem, 9×8: needs a face at
  least 10 px wide; use it once per machine, as a brand mark).
- Geometry helpers in `tools/pix/parts.mjs`: `pipe(b, ...)` (straight run with flange rings and hidden end faces)
  and `teeth(b, ...)` (gear teeth). Faces hidden inside a compound (tooth middles) still count in the bare
  share: hide them (`{ hide: [...] }`) or paint them.
- Lighting: the viewer has a cool sky and a blue rim light; warm grey ramps slightly on purpose so the
  anthracite structure does not drift to blue.
- Glow: a ramp glows when registered with `addRamp(name, shades, grain, { glow: true })` (`hot` and `teal` do).
- Orientation:

  | View (yaw) | Faces you see | Near corner |
  |---|---|---|
  | 38 | south (+z), east (+x) | +x +z |
  | 128 | east (+x), north (−z) | +x −z |
  | 218 | north (−z), west (−x) | −x −z |
  | 308 | west (−x), south (+z) | −x +z |

  `size.json` and footprints are `[x, y, z]` / `[x, z]`.
- Rotations: element `rotation` is in degrees around its `origin`, three.js / Blockbench sense: +z lifts
  the +x end, +x lifts the −z end, +y turns +x towards −z. `b.anim` tracks take the same world sense
  (the kit converts to Blockbench's keyframe signs).
- Footprint: Arffornia machines stay inside their block grid (the lint enforces it, multiblocks are
  placed on it). Oritech lets caps and ports overhang; in a bench run declare the next larger footprint
  (`footprint: [3, 2]` instead of `[2, 1]`; the origin stays the centre of the new grid) and say so.

## Brian's review rules (Nov 2026, from S3 and F3)

- **No belts.** Belts look wrong in Minecraft, worst at low tiers. Transmit with gears (a big gear on a
  small one reads well) or a chain; a long shaft with bevel boxes is fine too.
- **No thin moving parts.** A part that drives or lifts something is at least 3 px thick (a cam, a crank,
  a tappet, a lever). At tiers 0–2 prefer wood for big mechanical parts: a cam made of a log, like a fence
  post, reads as hand-built and heavy.
- **Rich textures everywhere.** Brian found the S3 drum and all of F3 "not rich": large faces need more
  than a fill and a frame. Every face 8 px or more gets a material story (plates and seams, bolts, wear,
  stains, scorch, paint chips, grain on wood) and the bare share should land near 0.40, not just under 0.55.

## Mechanics must be proven, not eyeballed

Brian's rule (Nov 2026): every mechanism follows real-world physics, and a deterministic check proves it.
A mechanism with no check is not finished: add the check to `tools/lint` (with a test) before shipping it.
What the lint proves today, from the declarations in `meta`:

| Mechanism | Declare | Proven |
|---|---|---|
| Meshing gears | `gears: [{ a, b, ra, rb, ta, tb }]` | centre distance = ra + rb, opposite rotation, ω·r equal, same tooth pitch (ta/tb = ra/rb); tooth phase through the overlap and sweep checks (never waive them) |
| Friction wheels (tyres on rollers) | `gears` without `ta`/`tb` | contact (centre distance), opposite rotation, no slip (ω·r equal) |
| Belts and chains | `belts: [{ pulleys, segments }]` | parallel shafts, same plane, tangent runs, no gap, same direction, ω·r equal |
| Closed gearbox, hidden shafts | `drives: [{ a, b, ratio, via }]` | measured turns of b per turn of a = ratio (signed) in every animation |
| Power flow | a rotation port with `bone`, or `sources: [{ bone, why }]` | every part that keeps turning in a working loop is linked to a source through gears, belts or drives |
| Rotation loops | `joints` revolute | whole turns per loop, no stall |
| Hinges, slides | `joints` with limits | pivot in a moving part and a static part, limits, rigid motion |
| Everything | | no floating, no tearing seat, no interpenetration over the whole animation, stays in its block grid |

Not proven yet (check by hand, then add a check): material flows downhill (chutes, pours), fluid levels,
a hidden transmission's tooth count, perpendicular drives (bevel gears). Prefer a design the lint can prove:
the kiln's coal screw had nothing to drive it, so it became a gravity chute.

## The lint, and how to satisfy it

`build.mjs` runs `tools/lint`; errors block. What trips people:
- **Overlap**: parts may touch or seat ≤ 1 px into each other. Deeper: make them one compound by naming
  them `stem#1`, `stem#2` (a carriage of three boxes around a rail is `carriage#1..3`), or waive.
- **Z-fighting**: two coplanar drawn faces flicker. Offset one by 0.01 px (`7.99`), or hide a face.
- **Floating**: everything connects to the ground through touching parts, at rest and during every animation.
- **Footprint** is checked over the whole animation sweep: a rotor of tanks must fit while it spins
  (radius + half the part width ≤ half the footprint).
- **Cantilever / seat load**: a long part on a small contact tears; seat it deeper, widen the contact or add a strut.
- **Joints**: every animated bone is declared in `meta.joints` (`revolute` or `prismatic` with an `axis`).
  A bone moving inside another moving bone is checked against its parent; keep nested motion small.
- **Ports**: each `meta.ports` entry needs a collar `port_<id>` on the boundary, centred on a block cell, 6–16 px.
- **Hinges**: a revolute pivot must sit in or on a part that moves *and* a static part that holds it
  (a hollow drum needs a static spout or axle on its axis).
- **Gears**: declare meshing pairs in `meta.gears` (`[{ a: 'bone', b: 'bone', ra: px, rb: px, ta: teeth, tb: teeth }]`);
  the lint checks opposite rotation, equal rim speed (`ωa·ra = ωb·rb`) and, with `ta`/`tb`, the same tooth pitch.
  Never waive overlap between meshing teeth: the overlap and sweep checks are what prove the teeth fall into
  each other's gaps. Set the `teeth()` phase so that, on the line between the centres, one gear shows a tooth
  and the other a gap (kiln Nov 2026: a pinion 7.5° off cut into the ring gear and the waiver hid it).
- **Waivers**, when the design is right and the rule is not: `meta.lint = { allow: [{ a: 'glob', b: 'glob', check: 'overlap', why: '...' }] }`.
  Globs match full element names: a compound is `shell#*`, not `shell`. A waiver always has a reason.
- **Moving surfaces**: details seated on a rotating part (strakes, hatches on a drum) need ≥ 0.05 px of
  clearance, not 0.01, or they flicker while it turns. The lint checks z-fighting at rest only: look at
  `anim.jpg` frames for stripes.
- **Tier 2 and up need `packaged` and `deploy`** animations (decision P6, checked by the `deploy` rule): a compact
  folded pose, then a 3–6 s unfold that ends on the bind pose. Hinge `min`/`max` limits are read in
  Blockbench's keyframe sign, not the world sense used by `b.anim` (a fold animated at −90 is declared
  `min: 0, max: 90`): check the lint message when a limit fails.
- **Chains and belts**: declare them in `meta.belts` so the lint checks tangency and rim speed; a chain that
  "runs" can slide by one link and snap back, which reads as motion.
- **Loops**: every rotating bone must make whole 360° turns over the loop, not just an angle that looks the same.
- **Levitating parts** cannot be waived out of the floating check yet: give them a believable contact (a beam,
  a field emitter touching them) and say so in the model.
- Pieces that appear during an animation (an arc, a pour) are scaled from near zero on a `free` joint with a reason.
- Side-face port `cell` is `[the other horizontal axis, y]` in blocks from the face's left as seen from outside.
- `b.group(name, pivot, fn, rotation)` takes an optional rest rotation as a 4th argument (a tilted drum).
- `d.hazard()` is yellow and black: outside the Arffornia palette. Paint warning stripes in house colours with `fill`.
- A 12-gon `prism` costs 6 cubes: budget them (a drum, tyres and a girth gear reach 100+ cubes quickly),
  and paint its caps radially (`d.fill` with the distance from the centre), not as strips.
- Texel density is 16 px/block (`texelsPerBlock: 16`), like Oritech and vanilla.

## Process sheet: the machine must work before it is drawn

Brian rejects machines whose mechanism he cannot follow from outside, even when they look good
(round r5: a water wheel in the middle of a furnace, water next to molten metal, twin kilns at tier 0).
Write the sheet in `tools/pix/machines/<id>.process.md` before any concept:

| Step | What happens | Real-world basis | Part in the model | Animation |
|---|---|---|---|---|
| Power in | mechanical shaft, cable or fuel enters | | the port and its face | shaft turns, cable glows |
| Load | ore arrives | hopper, chute, belt | | ore drops |
| Heat or work | ... | | hero part | |
| Output | product leaves | | | |
| Byproduct | slag, steam, ash, if any | | | |

Then check it, and fix the machine, not the wording:
- The player follows the material from the input port to the output port by looking. Each step has a
  part and, while working, a motion or glow. A step with no visible part is hidden in a closed box.
- Power comes in through a port, Create-style. A machine never contains its own water wheel,
  windmill or generator: those are separate blocks that feed shafts or cables to the machine.
- Physical plausibility for its era: no water or wood touching molten metal without a barrier that
  era could build; heat goes from the source to what it heats (flames under the drum); molten metal
  flows downhill into something that holds it.
- Tier 0 is one simple unit. Doubling, mixing and chains come at the next tiers, and each unlocks
  from an earlier machine (twin kilns are the tier 1 alloy branch of the tier 0 kiln).

## Workflow

1. **Process sheet** (see the section below). Claude writes and validates it alone; Brian does not
   review sheets, he reviews 3D models. Every concept prompt is derived from a sheet, never from a
   mechanism name alone. Loop at most 3 times: write, check the four rules, fix the machine (or try
   a variant process). The sheet passes when all four checks pass. If it still fails after 3 loops,
   stop and ask Brian, with the failing check and two or three directions to choose from.
   Also escalate when Brian rejects every model built from a sheet: the sheet is the suspect.
2. **Concepts.** Generate 6–10 images with the lab. Most stay in the DA, two or three are risks.
   Vary the silhouette, the mechanism and the era, not just the colours. Prompt the Minecraft-mod
   style directly ("a modded Minecraft machine made in Blockbench, Oritech style, crisp 16x16
   pixel-art textures…") and describe the mechanism explicitly. Otherwise the model draws a crate.
   Look at them yourself (a contact sheet costs about 2k tokens) and drop near-duplicates.
   Brian picks.
3. **Part plan.** Before any code, list the parts in a table: name, size in px, ramp, which faces carry
   which motifs, and which bone moves. Aim for 25–50 cubes. Each part earns its place in the
   silhouette, or becomes texture.
4. **Silhouette pass.** Build the parts with plain `mat(ramp)`. Render. The machine must not read as
   a cube with things on it. Break the volume: step the height, cut corners, expose the
   mechanism, let one hero element dominate (a crucible, a flywheel, a column).
5. **Face pass.** Design every visible face. A large flat area with no motif is a bug. Avoid
   repeating the same motif on all four sides: front, service side and back differ.
6. **Mechanism and animation.** One bone per moving part, joints in `meta.joints`, a closed loop for
   `working`. From tier 2, add `packaged` and `deploy` (see `docs/PIPELINE.md`).
7. **Build, lint, render.** `node tools/pix/build.mjs <id>`. Lint errors block. Then look at the sheet.
8. **Self-critique against a reference.** Render an Oritech machine of similar size next to yours
   and answer the checklist below honestly. Iterate at least twice before showing Brian.

## Bench (improving this skill)

`node tools/pix/bench/bench.mjs ref <target>` renders an Oritech machine (`tools/pix/bench/targets.json`)
into `out/bench/<target>/ref/`. An artist reproduces it from those images and `brief.txt` only (never
from `out/bench/<target>/src/`), as `tools/pix/machines/bench_<target>_<run>.mjs`. Then
`bench.mjs score <target> <id>` writes `compare.jpg` (reference left) and `score.json`: silhouette IoU per
view, aspect ratios, cube count, colours and texel variation. IoU is a guard (two boxy machines already
score about 0.7); the side-by-side judgement decides. Every gap found goes back into this file.
`compare.jpg` has three columns per view: reference, candidate, silhouette overlay (white = both,
magenta = mass you are missing, green = mass you added). Read the overlay first. `anim.jpg` shows 8 frames
of the first animation.

Reading a reference: the floor grid is 1 block per tile. Count blocks for the footprint and height, then
measure parts in px against the block (16 px). Note the colour families and which motif each surface
carries before you write code.

## Checklist before showing anything

- [ ] Seen from 10 m, the silhouette says what the machine does.
- [ ] No face larger than about 12×12 texels is an empty fill.
- [ ] Every visible face has a light map and a named detail. Nothing looks like a flat placeholder or a crate.
- [ ] At most 3 colour families plus glow. Glow is only hot, powered or a screen.
- [ ] The moving part is visible from the default three-quarter view.
- [ ] Side by side with the Oritech reference, the detail density and contrast are comparable.
- [ ] `build.mjs` reports 0 errors.

## Do not

- Do not texture with random noise or downscaled AI images, and do not outline every face.
- Do not stack many small rotated boxes to fake a curve. Paint it, or use a 12-gon `prism` for parts that turn.
- Do not reuse the round-1 kit materials in `tools/da/directions.mjs`. They are the rejected look.
