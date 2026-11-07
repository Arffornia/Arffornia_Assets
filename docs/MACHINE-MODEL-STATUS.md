# Machine models: status and handoff (2026-11-07, evening)

Where the concept-to-model work stands, so the next session can resume. Branch `feat/machine-model-skill`,
nothing committed yet. The method is the skill `.claude/skills/machine-model/SKILL.md`; read it first.

## The process today

1. **Concepts**: Claude writes prompts that describe the mechanism; `tools/pix/lab.sh` renders them on
   Brian's GPU (image-generation-lab, `qwen21-q4`, ~30 s/image; `qwen21-bf16` spills into RAM and fails).
   Brian picks.
2. **Model**: an agent following the skill writes `tools/pix/machines/<id>.mjs`: cubes and bones (kit
   `tools/da/kit.mjs`), every face painted in pixel art by code (`tools/pix/pix.mjs`, geometry helpers in
   `tools/pix/parts.mjs`), animations as keyframes (`working`, and `packaged` + `deploy` from tier 2).
3. **Build**: `node tools/pix/build.mjs <id>` writes `concepts/pix/<id>/<id>.bbmodel` (+ texture, glowmask),
   runs the lint (physics, gears, joints, footprint over the animation), prints the bare share (flatness;
   Oritech 0.30–0.60, target ≤ 0.55) and renders `out/pix/<id>/sheet.jpg`. `node tools/pix/gif.mjs <id> <anim>`
   makes a GIF.
4. **Bench** (to improve the skill): `tools/pix/bench/bench.mjs ref|score` reproduces Oritech machines (CC0)
   from images only and measures the gap.

No Blockbench app or MCP is used yet; nothing has been seen in game (no GeckoLib export).
On NixOS set `CHROME_PATH=/etc/profiles/per-user/brian/bin/google-chrome-stable` for every render.

## Since the morning

- Concept rounds are versioned TSVs (`tools/pix/rounds/`, `tools/pix/round.sh`) and Brian picks in the Concept
  Picker artifact (https://claude.ai/artifact/3DnNBp4zKLCzcBVTymABMU; `tools/pix/picker/`, `pack.mjs`), with my
  predictions scored. r4: 50 concepts by tier; r5: 38 concepts by furnace family.
- Retained per family (r5): simple furnace S1 (t0), S3 (t2); electric T1 (T2, T4 maybe); forge line F3, F4 (t2),
  F6, F8 (t6); alloy L1, L2 (t2), L3 (t3), L4 (t7), L8 maybe; endgame M1 (as a circle), M3, M4, M8, M2 maybe.
- Process sheets (skill): Claude validates them alone, max 3 loops, escalates on failure; Brian reviews models.
- **S3 validated by Brian**: `smelter_kiln_s3` (indirect-fired kiln, tier 2): shaft port and gearbox, fire trough
  with flickering flames, gravity coal chute at the back, folding discharge chute for deploy, smoke and spark
  emitters in `meta.fx` (previewed by `tools/view/view.js`; heat haze needs shaders, not done).
- Lint: tooth pitch (`ta`/`tb`), drivetrain (`drives`, power sources, ratio measured), stable spin measure.
  Fixed tooth phase in every kiln (the "meshing teeth" waiver hid a pinion cutting into the ring gear).
- Colour studies (undecided, Brian is asking around): `tools/pix/palettes.mjs`, board `docs/palettes/s3_palettes.jpg`.
- Next: F3 (steam hammer and rolling line), then the other retained concepts.

## Results

| Machine | Lineage | File | Notes |
|---|---|---|---|
| Rotary kiln smelter v2 (tier 0) | base | `smelter_kiln_v2` | Brian: "very good base"; arrows removed, richer drum |
| Kiln Mk2 (tier 4) / Mk3 (tier 8) | reskin | `smelter_kiln_mk2`, `_mk3` | Brian likes Mk3 a lot; Mk2 too close to Mk1 |
| Bloomery (t0) / arc furnace (t4) / levitation (t7) | rethink | `smelter_bloomery`, `_arc`, `_levitation` | waiting for Brian's verdict |
| Kiln x2 / x4 | scale | `smelter_kiln_x2`, `_x4` | x4 looks busy (bare share 0.17) |
| Oritech bench copies | bench | `bench_*` | foundry, centrifuge, assembler (c2 → c3 improved IoU 0.877 → 0.908) |

Boards and GIFs (git-ignored, rebuild with the commands above): `out/pix/tiers/`, `out/pix/lineages/`.
Concept images: `out/concepts/r2/` (smelter variants, tier variants), `out/concepts/r3/` (lineages).

## Decisions taken with Brian

- Quality bar: Oritech / Create / Immersive Engineering in game. Impressive, not "middle".
- Texel density 16 px/block for these models (per-model `texelsPerBlock`; the old D5 rule said 32).
- House colour orange stays at every tier (P7); tiers change materials, trims, shapes and power (DA table in the skill).
- Three lineage modes, chosen per machine: `reskin`, `scale`, `rethink`; about 3 marks per machine, 4 at most.
- Avoid looking like an Oritech copy: anthracite structure (not navy), no maze glyphs, hex mark as the brand.

## Open

- Brian's verdict on the rethink vs scale boards.
- Whether orange stays dominant up to tier 9 or becomes an accent from tier 7.
- Consolidate the helpers the agents wrote into the shared API: `tools/pix/arc_helpers.mjs` (dial, leds, tween,
  steps), `lev_helpers.mjs` (2-link IK, track, ringOfBoxes, voxelBall), `medieval.mjs` (masonry, planks,
  leather, clay, straps), plus nameplate text, the kiln unit as an importable module for `scale` marks.
- Lint gaps: z-fighting is checked at rest only; levitating parts cannot waive `floating`; hinge limits use
  Blockbench's sign; a possible rim-speed false positive at high gear ratios; bare share counts faces hidden
  inside compounds.
- Open a `.bbmodel` in the Blockbench app to confirm it loads; consider Blockbench MCP (sosadly/blockbench-mcp)
  for manual touch-ups and GeckoLib export.
- GeckoLib exporter and an in-game check (depends on the machine framework decision, Mods issue #17).
- Shared tooling changes on this branch: `tools/da/kit.mjs` (texel density per model), `tools/lint/checks.mjs`
  (per-model texel target), `tools/view/driver.mjs` (`CHROME_PATH`); `npm test` passes (15/15).
