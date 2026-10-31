# Arffornia assets

The 3D models of Arffornia (Blockbench `.bbmodel`) and the pipeline that turns each one into every
asset that shows it: icons, turntables, sprite sheets, animated SVG for the GitHub profile, glTF for
the launcher, title-screen loops and the early loading window. Change a model, push, and everything
made from it is re-exported.

```sh
npm ci
npm run render            # everything in pipeline.json  -> out/
npm run render:changed    # only what a model/scene change made stale
npm run check             # CI gate: fails if out/ is stale
node ui/render.mjs        # title/loading UI direction mock-ups -> out/ui/
sh early/run.sh           # early-window probes (static vs 20 fps animation) -> out/early/
```

Open a model live: serve the repo root (`npx serve .`) and visit
`render/stage.html?model=space-elevator` or `render/stage.html?scene=factory-line&cam=title`.

- [Spec and decisions](docs/SPEC.md)
- [Moodboard: the DA library](moodboard/README.md)
- Models: `models/` (the six tier 0–3 machine mocks from the loading-screen previews: Miner,
  Smelter, Constructor, Foundry, Assembler, Space Elevator)

Rules: free tools only (Blockbench, three.js, Playwright, ffmpeg; GitHub-hosted CI on a public
repo). Fonts are OFL and vendored in `ui/fonts/`. The logo is `brand/crafting-table.png`.
