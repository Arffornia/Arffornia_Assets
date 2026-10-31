# Spec: Arffornia 3D assets and the render pipeline

Status: **proposed** (needs Brian's decisions D1 to D7 below). Owner: agents. Date: 2026-10-31.

## Problem

The machine models Brian liked exist only as JavaScript drawing code inside the loading-screen
previews (docs PR #7). The banner, the ecosystem map, the docs, the launcher and the mod each
redraw Arffornia's look on their own. When a model changes, nothing updates the GIFs, sprite
sheets or banners made from it.

## Goal

One source of truth for every 3D model: a Blockbench `.bbmodel` per model in this repository.
One deterministic pipeline turns each model into every derived asset (stills, turntables,
sprite sheets, animated SVG, glTF, title-screen loops, early-window frames). Changing a model and
pushing it is enough to re-export everything that depends on it.

Non-goals: picking the final art direction for blocks (Brian has not chosen yet, which is why
the pipeline matters). Shipping assets to players from here (the consumers do that).

## Layout

```
models/<id>/<id>.bbmodel     source of truth (Blockbench 4.10+, opens in the desktop or web app)
models/<id>/<id>.png         the same texture, outside the .bbmodel, for review diffs
scenes/<name>.json           compositions: model placements, belts, lights, named cameras
pipeline.json                what to export for every model and scene, and where it is published
render/                      the renderer: bbmodel.js (loader + animation), stage.js (three.js scene), build.mjs
ui/                          title/loading UI direction mock-ups rendered over the scenes
early/                       early-window (pre-Minecraft) feasibility probes
moodboard/                   the DA library: references, palettes, decisions
brand/                       logo (crafting table) and brand files
legacy/ + tools/             the preview engine the first models were extracted from, and the extractor
out/                         derived assets (see D3) + manifest.json (input hashes)
```

## Model conventions

- 16 Blockbench pixels = 1 block. The footprint is centred on the origin; y is up.
- Format `free` (Generic Model) for now, so arbitrary rotations work. See D2 for in-game use.
- One texture atlas per model, `box_uv: false`, per-face UVs. 32 px per block on the extracted mocks.
- Moving parts are groups (bones) with a pivot. Animations are Blockbench animations
  (position / rotation / scale; linear, step or catmullrom). No Molang expressions yet.
- Elements whose name starts with `glass` render translucent. Saturated bright texels (light
  strips, molten metal, screens) are emissive. Both are renderer conventions, documented here
  because Blockbench has no material model.
- `arffornia` block in the file: title, one-line role, footprint, status (`mock`, `wip`, `final`).

## Pipeline

```
models/*.bbmodel ─┐
scenes/*.json ────┼─> render/build.mjs ──> headless Chromium (SwiftShader, CPU) ──> three.js stage
pipeline.json ────┘          │                  renderFrame(t): pure function of t
                             └──> ffmpeg (bit-exact flags) ──> PNG, MP4, animated WebP, sprite sheet + JSON,
                                                               animated SVG (sheet + CSS steps), GLB with clips
```

- **Deterministic**: no clock, no randomness; each frame is a function of `t`. CPU rendering
  (SwiftShader) and bit-exact encoder flags; same inputs and same container image give the same
  bytes. `out/manifest.json` stores a hash of every job's inputs (model, scene, job spec,
  renderer code, lockfile).
- **Incremental**: `npm run render:changed` rebuilds only stale jobs; `npm run check` fails when
  an output is stale (CI gate).
- **Why not Blockbench headless**: Blockbench has no supported CLI export; it is an Electron app.
  Reading `.bbmodel` directly in three.js avoids a manual export step and keeps the pipeline
  scriptable. Blockbench stays the editor.
- **Outputs per model** (pipeline.json `model`): transparent icon 1024², night card 1200×900,
  turntable MP4 + animated WebP (loops on the animation length), sprite sheet + JSON (20 fps,
  for the early window and the launcher), animated SVG (for READMEs and the GitHub profile),
  GLB with baked animation clips (for the launcher or the website, three.js).
- **Outputs per scene**: title-screen stills (night, maquette), a 6 s loop, an early-window
  sheet, UI backgrounds (stills + PNG sequences).

## Consumers

| Consumer | Uses | How it gets them |
|---|---|---|
| GitHub profile (`Arffornia/.github`) | animated SVG, stills | `publish` map in pipeline.json, copied by a PR (D4) |
| Docs (`Arffornia/docs`) | icons, turntables | same |
| Launcher | title loop MP4 / GLB, sprite sheets | same; later the launcher can render the GLB live |
| Loading and title screens (spec 007) | early-window sheet, title backgrounds or live models | same |
| Mod (`Arffornia_Mods`) | the models themselves, as in-game blocks | exporter to GeckoLib `.geo.json` + `.animation.json` (D2), not built yet |

## Decisions for Brian (defaults in bold)

- **D1 Repo**: name **`Arffornia/arffornia-assets`** (or `Arffornia/assets`); visibility **public**
  (free Actions minutes, free LFS-less storage, art is meant to be seen; the mocks contain nothing
  private) / private.
- **D2 In-game format**: **GeckoLib** (animated block entities, arbitrary rotations, multiblock
  sizes; the exporter turns our `.bbmodel` into `.geo.json` + `.animation.json`) / vanilla JSON
  block models (no animation, 3×3×3 bounds, rotations in 22.5° steps) / both (static parts
  vanilla, moving parts GeckoLib).
- **D3 Where derived assets live** (the scaffold tracks only `out/manifest.json` until this is decided): **committed under `out/`** for small files (reviewable diffs,
  consumers copy by path) and **GitHub Releases** for video and large sheets / everything in
  Releases only / Git LFS (costs money above the free quota, so no).
- **D4 Publishing to other repos**: **CI opens a PR in the consumer repo** with a fine-grained
  token stored as a secret (needs Brian to create it) / consumers pull a pinned release with a
  script (no cross-repo token) / manual copy.
- **D5 Texture resolution of the mocks**: **32 px per block** (keeps the decals readable) / 16 px
  (vanilla look, decals mostly vanish).
- **D6 CI renderer**: **GitHub-hosted `ubuntu-latest` with SwiftShader** (free for a public
  repo, about 8 min for a full rebuild today) / the homelab runner (not up 24/7).
- **D7 Moodboard images**: **links and our own renders only** (no third-party images committed)
  / allow committed references with their licence noted.

## Work breakdown

1. Brian creates the repo; push the scaffold (this commit history).
2. CI workflow (already in `.github/workflows/render.yml`): render changed jobs, upload the
   outputs, fail on stale `out/`.
3. Publish step per D4.
4. GeckoLib exporter (`render/export-geckolib.mjs`) and a golden test that the mod loads it.
5. DA research card: three block styles for the same Smelter (Satisfactory-futurist, clean
   industrial, chunky voxel), rendered by this pipeline, for Brian to choose.
6. Texture variants per look (the maquette look currently reuses the night palette).

## Not verified

- The extracted `.bbmodel` files were rendered by our loader only; opening them in the
  Blockbench app was not tried here (no Blockbench in this environment). The animation sign
  convention (position x and rotation x/y negated) follows Blockbench's bedrock-style animator
  from memory.
- Byte-identical output across machines: verified only as "same container, same bytes" in
  principle; two consecutive runs were not diffed for every job.
