# Concept images (pipeline steps 1–4)

These tools turn the DA brief into concept images on a local GPU. The images are references for
modelling and are never shipped. The whole pipeline is described in [docs/PIPELINE.md](../../docs/PIPELINE.md).

| File | What |
|---|---|
| `brief.json` | The DA brief that every prompt shares: style, scale cue, palettes, tier accents, glow rule, views and negative prompt. |
| `machines.json` | The five machines from spec 002/003, each with its marks (Mk1 coal or steam, Mk2 electric, Mk3 plasma, plus the exceptions) and four design variations. |
| `generate.py` | Composes the prompts and renders them with ComfyUI (HTTP API, Python stdlib only) or diffusers. It can resume a run. |
| `review.py` | Builds the review page for the human pick: one row per mark, so the tier evolution reads left to right. It exports `picks.json`. |
| `workflows/qwen-image-2.1.api.json` | The default. ComfyUI API-format graph following Comfy-Org's official *Qwen Image 2.1: Text to Image* template: `TextEncodeQwenImage21`, KSampler with 25 steps, cfg 1, euler and simple, int8 files. |
| `workflows/qwen-image-2512.api.json` | The same for Qwen-Image-2512 (Apache-2.0): ModelSamplingAuraFlow 3.1, cfg 2.5. |

## Run it (Linux / NixOS, GPU)

```sh
# 0. read the prompts first (no GPU): out/concepts/r1/prompts.md
python3 tools/concepts/generate.py prompts

# 1. ComfyUI must be running (any install: nixified-ai, a venv, the desktop app) with the
#    Comfy-Org/Qwen-Image-2.1 files. The default template uses the int8 files.
python3 tools/concepts/generate.py comfyui --only 'smelter/*' --seeds 1     # first look, 12 images
python3 tools/concepts/generate.py comfyui                                  # the round: 112 images

#    If your files or nodes differ, use YOUR working workflow: in ComfyUI choose Workflow > Export
#    (API) and save it as tools/concepts/workflows/local.api.json (git-ignored). The script finds
#    the prompt, negative, seed, size and SaveImage nodes by itself.
python3 tools/concepts/generate.py comfyui --workflow tools/concepts/workflows/local.api.json --sizes qwen-image-2.1

# 2. the review page (open the file in a browser), then commit the picks
python3 tools/concepts/review.py out/concepts/r1
#    -> download picks.json, commit it as concepts/picks/r1.json with the notes
```

Useful options:
- `--palette all` renders the three palettes in `brief.json`.
- `--view sheet` renders the orthographic sheet (front, side, top) for the translation step.
- `--scale 0.5` gives quick 1K drafts. Sizes come from `brief.json` `aspects`, per model family.
- `--set KSampler.steps=25 --set KSampler.cfg=1` overrides a node input.
- `--round r2` starts a new round in a new folder.
- `COMFYUI_URL` overrides the server address.

Without ComfyUI: `python3 tools/concepts/generate.py diffusers --model Qwen/Qwen-Image-2.1 --offload`
needs `torch accelerate` and diffusers from git (`QwenImage21Pipeline`, 40 steps, per the model
card). `--model Qwen/Qwen-Image-2512` uses `true_cfg_scale` 4.0 and 50 steps. The script passes only
the arguments the pipeline accepts. On NixOS, run it in the shell or venv you already use for the
model.

**Seeds** are derived from the prompt id, so `smelter/mk1/v2` gets the same seeds on every
machine and every run. Change `--base-seed` for new ones. Everything lands in
`out/concepts/<round>/` with a `manifest.jsonl` (prompt, seed, model, settings, time per image).

## The template workflows

They were checked against the official sources on 2026-11-01: the Comfy-Org/Qwen-Image-2.1 file
list, the `TextEncodeQwenImage21` node in ComfyUI (`comfy_extras/nodes_qwen.py`), and the Comfy-Org
workflow template `image_qwen_image_2_1_t2i.json`. They were not run on a GPU here. The official
template also has an optional prompt enhancer (Qwen3.5 9B) and a KV cache node; both are left out.
To change a file name, use `--set UNETLoader.unet_name=qwen_image_2.1_bf16.safetensors`.

Licences: Qwen-Image and Qwen-Image-2512 are Apache-2.0. Qwen-Image-2.1 is under the Qwen Research
Licence (non-commercial). Concept images stay internal references, so check the terms before an
image is published as Arffornia art.
