# Concept-to-model pipeline (machines)

Status: **approved** by Brian on 2026-11-01, with his answers to P2–P7 (at the end); P1 is open. Owner: agents.
Images are made by Brian's [image-generation-lab](https://github.com/TheGostsniperfr/image-generation-lab)
(ComfyUI in Docker behind Caddy, his workflows and Go client); this repo only composes the prompts and files the results.
Research behind it: `_work/veille/concept-to-model.html` (tech-watch card, sources with dates).

## Why

Round 1 (`docs/DA.md`) built the five DA concepts directly in Blockbench boxes. Brian rejected
them (2026-11-01):
- they look like vanilla blocks rotated a bit, made under the constraint of block shapes and block
  colours;
- nothing reads as real machinery. Satisfactory has real arms and real mechanisms.

He proposed the method this document turns into a pipeline:
1. first, concept images in a Satisfactory-like style with our DA: several variants per machine and
   per tier, without any Minecraft constraint;
2. then, translate the chosen look into a Minecraft model (Blockbench/GeckoLib, our texel density,
   animations, a deploy animation like Oritech's).

The look is decided in 2D, where iterating is cheap. Blockbench only has to translate it, which is
easier than inventing a look.

## What the research changes (summary)

- **Oritech's machines are simple in geometry and rich in texture.** Its source (commit `6ba123c`,
  2026-10-29) has assembler 45 cubes, foundry 28, refinery 32 and centrifuge 25, on 128–256 px
  textures. The detail is painted.
  - Our round-1 concepts used 40–150 boxes painted with flat block colours: the opposite approach.
  - The Blockbench Minecraft style guide gives the same rule: shapes in cubes, detail in texture.
- **Oritech's deploy animation is a state machine.**
  - The states are `packaged` (held), then `deploy` (triggered once when the multiblock forms),
    then `idle` / `working`, with a 5-tick blend between states.
  - The `working` speed follows the recipe time.
  - The deploys last 4.3–5.8 s. Parts slide in (position) and unfold on hinges (rotation, −90° → 0)
    with `easeInOutExpo` / `easeOutQuint`, staggered over the whole length.
  - Some parts also scale (0.7 → 1, a cheat our lint flags unless it is waived).
- **Create animates its mechanisms in code, not in keyframes.**
  - Partial models (press head, arm segments) are moved by renderers.
  - The mechanical arm uses analytic 2-link inverse kinematics (law of cosines, links of 14/16 and
    15/16 block).
- **AI image-to-3D is not a Blockbench model.**
  - TRELLIS.2 (Dec 2025, MIT, 24 GB) and Hunyuan3D 2.1 (Jun 2025) produce dense marching-cubes
    meshes.
  - Voxelising them gives exactly the "vanilla blocks" look Brian rejected.
  - Useful outputs: proportions (a reference mesh behind the cubes), a turnaround to model from,
    and a part split (PartCrafter, Jun 2025: up to 16 parts from one image; Hunyuan3D-Omni,
    Sep 2025: bounding-box control).
  - Fitting primitives to a shape is research-grade (PrimitiveAnything, May 2025: cuboids,
    cylinders and ellipsoids from a point cloud).
- **Tier evolution has good references.**
  - Satisfactory's Miner Mk1–Mk3 keep one footprint (6 × 14 × 18 m) and change power and rate.
  - Its conveyor belts Mk1–Mk6 add one visible feature per mark: guardrails, LED size and count,
    studs, then a translucent glowing belt.
  - Mekanism colour-codes its tiers (basic green, advanced red, elite cyan, ultimate magenta).

## The pipeline

**Automated**: a script runs it, no judgement. **AI-assisted**: a model proposes and a human or a
gate decides. **Human**: Brian decides.

| # | Step | Mode | Tool | Output | Gate |
|---|---|---|---|---|---|
| 0 | **DA brief**: style, palette, tier accents, glow rule, scale cue, negative prompt | Human + agent | `tools/concepts/brief.json` | the brief, versioned | Brian edits it after each round |
| 1 | **Prompt pack**: machine × mark × design variation × palette × view | Automated | `generate.py prompts` | `out/concepts/<round>/prompts.{jsonl,md}`, readable and model-agnostic | none |
| 2 | **Generate** on Brian's GPU: N stable seeds per prompt, resumable, with a manifest. First a 12-image smelter test, then the round (P2) | Automated | `generate.py lab`: the image-generation-lab client and workflow (`qwen21-q4` by default) | PNGs + `manifest.jsonl` | Brian looks at the 12 before the 112 |
| 3 | **Pre-sort** (optional): a vision model scores each image against a checklist (one machine, mechanism legible, footprint ratio, no text, scale figure) and the review page is sorted by score | AI-assisted | Claude on the PNGs (later: a headless session) | `scores.json` | not a gate, it only orders |
| 4 | **Pick**: one image per machine and mark, plus notes on what to change in the brief | Human | `review.py` page (rows = marks, so the tier evolution reads left to right) | `concepts/picks/<round>.json` | Brian. Loop to 0 until he likes a set |
| 5 | **Turnaround** of the picked image: front, side and top at the same scale | AI-assisted | `--view sheet`, or an image-edit workflow added to the lab later; optional image-to-3D (TRELLIS.2 / Hunyuan3D 2.1) as a proportion mesh, reference only (P5) | `concepts/<machine>/<mark>/sheet.png`, optional `ref.obj` | human check: same machine in every view |
| 6 | **Translation sheet**: the part list (each mechanism to cubes / n-gon compounds / texture), joints with axes and limits, ports on block cells, footprint, budget class, and what is painted rather than modelled | AI-assisted | agent draft, from the sheet and the rules below | `concepts/<machine>/<mark>/translation.md` | Brian approves |
| 7 | **Blockout**: primary shapes first, at 32 px/block, the concept and sheet as Blockbench reference images, the optional mesh as an underlay | AI-assisted | the kit (`tools/da/kit.mjs`) for generated models; Blockbench + MCP plugin to edit in the app | `.bbmodel` | lint after every pass |
| 8 | **Lint**: plausibility, grid, ports, sweeps, **cantilevers, belts, gears, joint kinematics** | Automated | `npm run lint` (CI gate) | `out/lint/<id>.{md,json,png}` | errors block the PR |
| 9 | **Texture**: project the concept onto the blockout faces as a base, quantise to the DA ramps, then paint by hand (bolts, seams, grime) and the glowmask | AI-assisted + human | projection script (to build, experimental) + Blockbench paint | texture + `_glowmask.png` | texel check (lint) |
| 10 | **Animation**: `working` / `idle` loops and `packaged` → `deploy` for multiblocks, with joints declared | AI-assisted | Blockbench animator or the kit; the lint's `kinematics` + `sweep` | animations in the `.bbmodel` | lint (no interpenetration, limits, seams, deploy ends at rest) |
| 11 | **Render**: hero, silhouette, turntable, a deploy clip and a **concept vs model** card side by side | Automated | `render/` (three.js + Playwright) | `out/models/<id>/…` | none |
| 12 | **Critique**: a headless art-director session compares the concept and the render | AI-assisted | `art-critique` (proposed skill) | `critique.md` next to the renders | advisory |
| 13 | **In game**: screenshot next to vanilla blocks, deploy recorded | Automated, once the GeckoLib exporter exists | NeoForge client harness (spec 007 harness pattern) | PNG + MP4 | DA5 "final" |
| 14 | **Approve** | Human | the PR with the before/after | merge | Brian |

What exists today:
- Steps 1, 2 and 4: `tools/concepts/` (this PR), on top of the lab.
- Step 8: `tools/lint/`, with the mechanics checks in PR #2.
- Step 11: `render/`.

Still to build:
- step 3 (the scorer);
- step 9 (the projection);
- step 13 (the exporter and the harness);
- the Blockbench MCP setup for step 7;
- an image-edit workflow in the lab for step 5 (a PR there, when the turnaround starts).

## Translation rules (concept to Minecraft)

These rules keep the look of the concept without the "rotated vanilla blocks" failure.

1. **Keep:**
   - the silhouette;
   - the one main mechanism (the thing that moves);
   - the proportions;
   - the colour blocking (60 / 30 / 10).
2. **Drop to texture:**
   - bolts, seams, vents and small pipes;
   - labels and grime;
   - anything under 2 px.
3. **Geometry budget, Oritech-like:**
   - about 25–60 cubes for a 3 × 3 machine;
   - one bone per moving part;
   - the lint budget classes stay the ceiling, not the target.
4. **Round things:**
   - an 8- or 12-gon compound (`name#n`) only where the part turns or is the hero of the
     silhouette (flywheel, crucible, column);
   - otherwise a square section with a painted bevel.
5. **Texel density** is 32 px/block everywhere (D5). Use one hue-shifted ramp per material (dark
   structure, painted panel, bare steel, accent), shaded from the top left as the style guide asks.
6. **Mechanisms must be real:**
   - every hinge on a pin;
   - every belt tangent;
   - every arm with a seat that can carry it.
   The lint enforces this (`cantilever`, `belt`, `kinematics`).
7. **Anti-pattern seen in round 1:** shapes built from many small rotated boxes painted with block
   colours, and noise as texture. When a part needs more than 4 boxes to approximate a curve, paint
   the curve.

## Tier evolution rules (P4: per machine, and coherent)

Brian (2026-11-01): we can test both ideas, but no machine is forced into a pattern that improves
per tier. It has to be coherent: a particle accelerator has no primitive tier that looks like a
particle accelerator.

So each machine declares its **lineage** in `machines.json`, with a reason:

| Mode | What it means | Machines in round 1 |
|---|---|---|
| `evolves` | Every later mark keeps the Mk1 chassis: footprint, silhouette and the parts listed in `keeps`. The power module and details change (Satisfactory's Miner Mk1–3, its belts Mk1–6). | smelter (coal → induction → plasma arc, always a crucible furnace), constructor (steam hammer → hydraulic press → servo cell), refinery (fired heater → catalytic cracker; it stops at Mk2, there is no believable plasma refinery) |
| `branches` | Some later mark is a new machine, because the process itself changes. The new mark says why. | assembler (Mk3 is a sealed micro-assembly pod), foundry (Mk3 holds the melt in a field, with no furnace walls to share) |
| `single` | One mark only: the machine has no believable earlier tier. | none in round 1; the particle accelerator when it comes |

How it reaches the images:
- A shared mark's prompt says what it keeps from Mk1, and it reuses Mk1's seeds, so a variation's
  marks start from the same composition. A new mark gets its own seeds and is prompted as a new design.
- `generate.py check` (and every run) rejects a lineage that contradicts its marks: `evolves` with a
  new design, `branches` with none, `single` with several marks, a shared mark without `keeps`.
- The review page shows the mode per machine and "same chassis" / "new design" per mark.
- Round 1 therefore tests both ideas at once (P4 "tests sur les 2"). The picks tell which reads better.

**Colour (P7, decided).** Trims and status lights follow the tier band of spec 003 (copper/orange 0–2,
steel 3–4, yellow 5–6, teal 7, violet 8, white/cyan 9). Panels stay the house colour at every tier, so
machines stay one family.

## Footprints

- Machines are not all square. Spec 002 already has 2 × 3 (constructor), 3 × 5 (assembler) and
  5 × 7 (refinery). Oritech's GeckoLib models declare bounds from 3 to 6 blocks wide.
- The prompts carry the footprint ("long rectangular footprint of 3 by 5 metres") and pick a wide
  aspect for long machines.
- The long axis follows the material flow: in at one end, out at the other, or ports on the long
  sides, as for the assembler.
- The lint already supports any `[w, d]` footprint. DA2 (scale up 2×) is still open and changes only
  the numbers in `machines.json`.

## Deploy animations: design and verification

- **Design** (Oritech's pattern, adapted):
  - `packaged` is a compact crate-like pose inside the footprint: arms folded, covers closed,
    columns retracted.
  - `deploy` lasts 3–6 s and unfolds in a believable order:
    1. structure first;
    2. then covers and walkways on hinges;
    3. then telescoping columns;
    4. then the mechanism;
    5. last, lights on.
  - Use ease-in-out on every move, no step keys, and a staggered start per part.
  - `idle` / `working` loops close on themselves.
- **Verification**, with what the lint does today:
  - `sweep` (80 Hz): no part passes through another during the deploy.
  - Detach checks: nothing floats during the deploy.
  - `footprint`: everything stays in the grid at every sample.
  - `kinematics`:
    - each moving bone is a declared joint (revolute or prismatic) with limits;
    - hinges have real pivots;
    - no part scales;
    - no jump above 2 px per 1/80 s;
    - `deploy` ends on the bind pose and starts where `packaged` ends.
  - `cantilever` at 4 Hz: an unfolding arm must be able to carry itself at every moment.
- **Not yet:** continuous collision between samples (fast thin parts can tunnel between two 80 Hz
  samples). The method exists: continuous collision detection for articulated models (Redon et al.,
  2004). If tunnelling shows up, the cheap fix is adaptive sampling (halve the step while any part
  moves more than its thickness).

## Decisions (Brian, 2026-11-01)

- **P1 Image model: open.** Brian answered "Other" with no text, and pointed to his
  image-generation-lab. The pipeline now uses the lab with its `qwen21-q4` workflow (Qwen-Image-2.1,
  community Q4 quantisation, fits a 16 GB GPU). `--workflow` picks any other lab workflow
  (`qwen21-bf16`, `qwen2512-fp8`, `zimage`, `flux2` once added). To ask: which model he means, or
  whether "the lab, whatever it runs" is the answer.
- **P2 Round size: a 12-image smelter test first, then 112 images (about 1 h of GPU).** The test is
  `--only 'smelter/*' --seeds 1`; the round reuses those 12.
- **P3 Machines: smelter, constructor, assembler, foundry, refinery.**
- **P4 Tier evolution: per machine, coherent, both ideas tested.** See the lineage table above.
- **P5 Image-to-3D: reference only.** A proportion underlay or turnaround, never the model.
- **P6 Deploy animations: every multiblock from tier 2, lint-checked.** The `deploy` check in
  `tools/lint` (rule in `docs/MODEL-RULES.md`) requires `packaged` and `deploy`; `kinematics` checks
  their seams.
- **P7 Tier colour: trims and lights follow the tier colour; panels stay the house colour.**
