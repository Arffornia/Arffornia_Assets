# Concept images (pipeline steps 1–4)

These tools turn the DA brief into concept images on Brian's GPU. The images are references for
modelling only (P5) and are never shipped. The whole pipeline is described in
[docs/PIPELINE.md](../../docs/PIPELINE.md).

Images are made by **[image-generation-lab](https://github.com/TheGostsniperfr/image-generation-lab)**,
Brian's existing setup: ComfyUI in Docker behind Caddy, its workflows and its Go client. This
folder composes the prompts, calls the lab's client once per image, and files the results. It has no
ComfyUI graphs and no model code of its own.

| File | What |
|---|---|
| `brief.json` | The DA brief that every prompt shares: style, scale cue, palettes (panels stay the house colour, P7), tier accents for trims and lights, glow rule, views, negative prompt, and the image sizes (`lab`: about 1 MP, the lab workflows' size). |
| `machines.json` | The five machines from spec 002/003 (P3), their marks, four design variations, and their **lineage** (P4): how the tiers of that machine relate. |
| `generate.py` | `prompts` writes the prompt pack, `check` validates `machines.json`, `lab` renders through the lab. Resumable, stable seeds, a manifest per round. |
| `review.py` | The review page for the human pick: one row per mark, so the tier evolution reads left to right. It exports `picks.json`. |
| `test_generate.py` | `python3 -m unittest discover -s tools/concepts`. The end-to-end test runs the smelter test through the real lab client against a stub ComfyUI. |

## Lineage: how a machine's tiers relate (P4)

Brian's rule: not every machine needs a pattern that improves per tier, but it must be coherent.
Each machine in `machines.json` declares one mode, with a `why`:

- **`evolves`**: every later mark keeps the Mk1 chassis (`"chassis": "shared"` plus what it
  `keeps`), and only the power module and details change. Smelter, constructor, refinery.
- **`branches`**: a later mark becomes a new machine (`"chassis": "new"` plus `why`). Assembler
  and foundry at Mk3.
- **`single`**: one mark only, for machines with no believable primitive tier, such as a particle
  accelerator.

The prompt of a shared mark says what it keeps from Mk1, and it reuses Mk1's seeds, so a variation's
marks start from the same composition. `generate.py check` rejects a lineage that contradicts its
marks. The round therefore tests both ideas: same machine across tiers, and a new machine for a tier.

## Run it (Linux / NixOS, GPU)

```sh
# 0. the lab is up (in the lab: docker compose up -d) with the qwen21 models (./models.sh qwen21)
export IMAGE_LAB_DIR=~/image-generation-lab LAB_URL=http://127.0.0.1:8080 LAB_TOKEN=...   # API_TOKEN from the lab's .env

# 1. read the prompts first (no GPU): out/concepts/r1/prompts.md
python3 tools/concepts/generate.py prompts

# 2. the smelter test (P2): 3 marks x 4 variations x 1 seed = 12 images
python3 tools/concepts/generate.py lab --only 'smelter/*' --seeds 1
python3 tools/concepts/review.py out/concepts/r1        # open out/concepts/r1/index.html

# 3. after the test looks right: the round, 14 marks x 4 variations = 56 prompts x 2 seeds = 112 images
python3 tools/concepts/generate.py lab                  # resumes: the 12 test images are reused

# 4. pick, download picks.json, commit it as concepts/picks/r1.json with the notes
```

Useful options:
- `--workflow qwen21-bf16` (or any file name in the lab's `workflows/`). Default `qwen21-q4`.
- `--sizes qwen-image-2.1` for the model card's native 2K sizes (about 4× slower); `--scale 0.5` for drafts.
- `--palette all` renders the three house-colour candidates; `--view sheet` renders front, side and top.
- `--round r2` starts a new round in a new folder; `--dry-run` lists the images without rendering.

The negative prompt and the per-image output names need the lab client from
[image-generation-lab#1](https://github.com/TheGostsniperfr/image-generation-lab/pull/1)
(`-negative`, `-prefix`). With an older client the run still works; the manifest records
`"negative": false`. The qwen21 workflows sample at cfg 1, where a negative prompt has no effect anyway.

**Seeds** come from the prompt id (Mk1's id for shared marks), so `smelter/mk1/v2` gets the same
seeds on every machine and every run. Change `--base-seed` for new ones.

Licences: the lab's `qwen21` files are a community quantisation of Qwen-Image-2.1 (Qwen Research
Licence, non-commercial). Concept images stay internal references, so check the terms before any
image is published as Arffornia art.
