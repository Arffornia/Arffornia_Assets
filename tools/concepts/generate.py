#!/usr/bin/env python3
"""Concept image batch for Arffornia machines (docs/PIPELINE.md, steps 1-3).

Composes the DA brief (brief.json) with the machines (machines.json) into prompts, then renders
every prompt with N seeds on a local image model. Resumable: existing images are skipped.

  python3 tools/concepts/generate.py prompts                      # write out/concepts/<round>/prompts.{jsonl,md}
  python3 tools/concepts/generate.py comfyui --workflow W.api.json  # ComfyUI HTTP API (stdlib only)
  python3 tools/concepts/generate.py diffusers --model Qwen/Qwen-Image-2.1    # needs torch + diffusers
  python3 tools/concepts/review.py out/concepts/r1                # the review page for the human pick

Common options: --round r1 --seeds 2 --only 'smelter/*' --palette orange|all --view hero|side|sheet
--scale 1.0 --dry-run. Output: out/concepts/<round>/<machine>/<mark>/<variation>-<palette>-<view>-s<seed>.png
and out/concepts/<round>/manifest.jsonl (one line per image: prompt, seed, model, settings, time).
"""
import argparse
import fnmatch
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))


def load(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return json.load(f)


def footprint_text(fp):
    w, d, h = fp
    shape = "Square footprint of {0} by {0} metres".format(w) if w == d else "Long rectangular footprint of {} by {} metres".format(min(w, d), max(w, d))
    return "{}, about {} metres tall.".format(shape, h)


def build_prompts(brief, machines, palettes, views):
    """Every (machine, mark, variation, palette, view): the model-agnostic text prompt and its metadata."""
    out = []
    for mid, m in machines["machines"].items():
        for mk, mark in m["marks"].items():
            tier = brief["tiers"][str(mark["tier"])]
            for vid, var in m["variations"].items():
                for pal in palettes:
                    for view in views:
                        palette = brief["palette"]["options"][pal].format(accent=tier["accent"])
                        light = brief["light"].format(power=brief["power"][mark["power"]])
                        text = " ".join([
                            brief["style"], "The machine: " + m["core"], mark["text"], "Design: " + var,
                            footprint_text(m["footprint"]), brief["scale"], palette, light, brief["views"][view],
                        ])
                        aspect = m["aspect"] if view == "hero" else ("16:9" if view == "sheet" else m["aspect"])
                        out.append({
                            "id": "{}/{}/{}-{}-{}".format(mid, mk, vid, pal, view),
                            "machine": mid, "mark": mk, "tier": mark["tier"], "variation": vid, "palette": pal, "view": view,
                            "title": "{} {} ({}), {}".format(m["title"], mk.upper(), mark["power"], var.split(",")[0].split(":")[0]),
                            "prompt": text, "negative": brief["negative"], "aspect": aspect,
                            "exception": "exception" in mark["text"].lower(),
                        })
    return out


def seeds_for(pid, n, base):
    # stable per prompt id: the same prompt gets the same seeds on every run and every machine
    h = int(hashlib.sha256(pid.encode()).hexdigest()[:8], 16) % 1_000_000
    return [base + h + i * 7919 for i in range(n)]


def size_for(brief, family, aspect, scale):
    w, h = brief["aspects"][family][aspect]
    return int(round(w * scale / 16)) * 16, int(round(h * scale / 16)) * 16


def out_path(args, p, seed):
    return os.path.join(args.out, args.round, p["machine"], p["mark"], "{}-{}-{}-s{}.png".format(p["variation"], p["palette"], p["view"], seed))


def write_prompts(args, prompts):
    d = os.path.join(args.out, args.round)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "prompts.jsonl"), "w", encoding="utf-8") as f:
        for p in prompts:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    with open(os.path.join(d, "prompts.md"), "w", encoding="utf-8") as f:
        f.write("# Concept prompts, round {}\n\nNegative prompt (all): `{}`\n\n".format(args.round, prompts[0]["negative"] if prompts else ""))
        for p in prompts:
            f.write("## {}\n\n{} (aspect {})\n\n> {}\n\n".format(p["id"], p["title"], p["aspect"], p["prompt"]))
    print("{} prompts -> {}/prompts.jsonl and prompts.md".format(len(prompts), d))


# ---------------------------------------------------------------- ComfyUI (HTTP API, stdlib only)
def http(method, url, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def follow(graph, link, want):
    """From a [node_id, output] link, walk upstream to the first node that has one of the inputs in want."""
    seen = set()
    while isinstance(link, list) and link and str(link[0]) in graph and str(link[0]) not in seen:
        nid = str(link[0]); seen.add(nid)
        node = graph[nid]
        if node.get("class_type") == "ConditioningZeroOut":
            return None  # a zeroed negative has no text to set
        if any(k in node.get("inputs", {}) and not isinstance(node["inputs"][k], list) for k in want):
            return nid
        nxt = [v for k, v in node.get("inputs", {}).items() if isinstance(v, list) and k in ("conditioning", "conditioning_1", "positive", "negative", "samples", "latent", "latent_image")]
        link = nxt[0] if nxt else None
    return None


def patch_workflow(graph, prompt, negative, seed, width, height, prefix, sets):
    """Set the prompt, negative, seed, size and output prefix in a ComfyUI API-format graph, wherever they are."""
    g = json.loads(json.dumps(graph))
    samplers = [k for k, n in g.items() if "positive" in n.get("inputs", {}) and "negative" in n.get("inputs", {})]
    guiders = [k for k, n in g.items() if n.get("class_type") in ("CFGGuider", "BasicGuider")]
    pos_ids, neg_ids = set(), set()
    for k in samplers + guiders:
        ins = g[k]["inputs"]
        for key, bucket in (("positive", pos_ids), ("conditioning", pos_ids), ("negative", neg_ids)):
            if key in ins:
                nid = follow(g, ins[key], ("text", "prompt"))
                if nid:
                    bucket.add(nid)
    if not pos_ids:  # fall back on titles: a node titled "positive" / "negative"
        for k, n in g.items():
            t = (n.get("_meta", {}).get("title") or "").lower()
            if "text" in n.get("inputs", {}):
                (neg_ids if "neg" in t else pos_ids).add(k)
    if not pos_ids:
        raise SystemExit("workflow: no text-encode node found for the positive prompt. Export the workflow with 'Export (API)'.")
    both = {k for k in pos_ids | neg_ids if "negative_prompt" in g[k]["inputs"] and not isinstance(g[k]["inputs"]["negative_prompt"], list)}
    for k in both:  # one encoder node with both texts (TextEncodeQwenImage21)
        g[k]["inputs"]["prompt" if "prompt" in g[k]["inputs"] else "text"] = prompt
        g[k]["inputs"]["negative_prompt"] = negative
    pos_ids, neg_ids = pos_ids - both, neg_ids - both
    for k in pos_ids - neg_ids:
        g[k]["inputs"]["text" if "text" in g[k]["inputs"] else "prompt"] = prompt
    for k in neg_ids - pos_ids:
        g[k]["inputs"]["text" if "text" in g[k]["inputs"] else "prompt"] = negative
    for n in g.values():
        ins = n.get("inputs", {})
        for key in ("seed", "noise_seed"):
            if key in ins and not isinstance(ins[key], list):
                ins[key] = seed
        if "width" in ins and "height" in ins and "Latent" in n.get("class_type", "") and not isinstance(ins["width"], list):
            ins["width"], ins["height"] = width, height
            if "batch_size" in ins:
                ins["batch_size"] = 1
        if n.get("class_type") == "SaveImage":
            ins["filename_prefix"] = prefix
    for s in sets:  # --set ClassOrTitle.input=value
        lhs, val = s.split("=", 1)
        cls, key = lhs.rsplit(".", 1)
        try:
            val = json.loads(val)
        except ValueError:
            pass
        hit = [n for n in g.values() if n.get("class_type") == cls or n.get("_meta", {}).get("title") == cls]
        if not hit:
            raise SystemExit("--set {}: no node of class or title {}".format(s, cls))
        for n in hit:
            n["inputs"][key] = val
    return g


def run_comfyui(args, jobs):
    with open(args.workflow, encoding="utf-8") as f:
        graph = json.load(f)
    if "nodes" in graph and "links" in graph:
        raise SystemExit("{} is a UI workflow. In ComfyUI use Workflow > Export (API) and pass that file.".format(args.workflow))
    server = args.server.rstrip("/")
    try:
        http("GET", server + "/system_stats", timeout=5)
    except (urllib.error.URLError, OSError) as e:
        raise SystemExit("ComfyUI is not reachable at {} ({}). Start it, or pass --server.".format(server, e))
    client = str(uuid.uuid4())
    for i, (p, seed, path, (w, h)) in enumerate(jobs, 1):
        g = patch_workflow(graph, p["prompt"], p["negative"], seed, w, h, "arffornia/{}/{}".format(args.round, p["id"].replace("/", "_")), args.set)
        t0 = time.time()
        pid = json.loads(http("POST", server + "/prompt", {"prompt": g, "client_id": client}))["prompt_id"]
        while True:
            hist = json.loads(http("GET", "{}/history/{}".format(server, pid)))
            if pid in hist:
                break
            time.sleep(1.0)
        status = hist[pid].get("status", {})
        if status.get("status_str") == "error":
            raise SystemExit("ComfyUI failed on {}: {}".format(p["id"], json.dumps(status.get("messages", []))[:800]))
        imgs = [im for o in hist[pid].get("outputs", {}).values() for im in o.get("images", []) if im.get("type") == "output"]
        if not imgs:
            raise SystemExit("ComfyUI returned no output image for {} (is there a SaveImage node?)".format(p["id"]))
        im = imgs[0]
        q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im.get("subfolder", ""), "type": im["type"]})
        data = http("GET", "{}/view?{}".format(server, q), timeout=120)
        save(args, p, seed, path, data, {"backend": "comfyui", "workflow": os.path.basename(args.workflow), "size": [w, h], "set": args.set}, t0, i, len(jobs))


# ---------------------------------------------------------------- diffusers (Python, GPU)
def run_diffusers(args, jobs):
    try:
        import torch
        from diffusers import DiffusionPipeline
    except ImportError:
        raise SystemExit("diffusers backend: pip install torch diffusers transformers accelerate (or use the comfyui backend).")
    dtype = {"bf16": torch.bfloat16, "fp16": torch.float16, "fp32": torch.float32}[args.dtype]
    pipe = DiffusionPipeline.from_pretrained(args.model, torch_dtype=dtype)
    if args.offload:
        pipe.enable_model_cpu_offload()
    else:
        pipe.to("cuda")
    import inspect
    sig = inspect.signature(pipe.__call__).parameters
    accepted, takes_kwargs = set(sig), any(v.kind == v.VAR_KEYWORD for v in sig.values())
    steps = args.steps or (40 if "2.1" in args.model else 50)
    for i, (p, seed, path, (w, h)) in enumerate(jobs, 1):
        t0 = time.time()
        kw = dict(prompt=p["prompt"], negative_prompt=p["negative"], width=w, height=h, num_inference_steps=steps,
                  generator=torch.Generator(device="cuda").manual_seed(seed), true_cfg_scale=args.cfg, guidance_scale=args.cfg)
        # pass only what this pipeline takes: Qwen-Image takes true_cfg_scale (model card 4.0), 2.1 shows neither
        if not takes_kwargs:
            kw = {k: v for k, v in kw.items() if k in accepted}
        if "true_cfg_scale" in kw and "guidance_scale" in kw:
            del kw["guidance_scale"]
        image = pipe(**kw).images[0]
        import io
        buf = io.BytesIO(); image.save(buf, format="PNG")
        save(args, p, seed, path, buf.getvalue(), {"backend": "diffusers", "model": args.model, "steps": steps, "cfg": args.cfg, "size": [w, h]}, t0, i, len(jobs))


def save(args, p, seed, path, data, settings, t0, i, n):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    rec = dict(p, seed=seed, file=os.path.relpath(path, os.path.join(args.out, args.round)), settings=settings,
               seconds=round(time.time() - t0, 1), at=time.strftime("%Y-%m-%dT%H:%M:%S"))
    with open(os.path.join(args.out, args.round, "manifest.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print("[{}/{}] {} s{} ({:.0f} s)".format(i, n, p["id"], seed, time.time() - t0), flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("backend", choices=["prompts", "comfyui", "diffusers"])
    ap.add_argument("--round", default="r1", help="round name: one folder per review round")
    ap.add_argument("--out", default=os.path.join(ROOT, "out", "concepts"))
    ap.add_argument("--only", action="append", default=[], help="glob on machine/mark/variation, e.g. 'smelter/*' or '*/mk1/v2'")
    ap.add_argument("--palette", default=None, help="palette name from brief.json, or 'all' (default: the brief's default)")
    ap.add_argument("--view", default="hero", help="hero, side, sheet, or a comma list")
    ap.add_argument("--seeds", type=int, default=2)
    ap.add_argument("--base-seed", type=int, default=20261101)
    ap.add_argument("--scale", type=float, default=1.0, help="size multiplier (0.5 for quick drafts)")
    ap.add_argument("--sizes", default=None, help="aspect table in brief.json: qwen-image or qwen-image-2.1 (default: from the workflow/model name)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--server", default=os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188"))
    ap.add_argument("--workflow", default=os.path.join(HERE, "workflows", "qwen-image-2.1.api.json"))
    ap.add_argument("--set", action="append", default=[], help="override a node input: KSampler.steps=30, UNETLoader.unet_name=...")
    ap.add_argument("--model", default="Qwen/Qwen-Image-2.1")
    ap.add_argument("--steps", type=int, default=None, help="diffusers: default 40 for Qwen-Image-2.1, 50 otherwise (model cards)")
    ap.add_argument("--cfg", type=float, default=4.0, help="diffusers: true_cfg_scale / guidance_scale when the pipeline takes one")
    ap.add_argument("--dtype", default="bf16", choices=["bf16", "fp16", "fp32"])
    ap.add_argument("--offload", action="store_true", help="diffusers: CPU offload for GPUs under ~40 GB")
    args = ap.parse_args()

    brief, machines = load("brief.json"), load("machines.json")
    palettes = list(brief["palette"]["options"]) if args.palette == "all" else [args.palette or brief["palette"]["default"]]
    views = args.view.split(",")
    for v in views:
        if v not in brief["views"]:
            raise SystemExit("unknown view {} (brief.json views: {})".format(v, ", ".join(brief["views"])))
    prompts = build_prompts(brief, machines, palettes, views)
    if args.only:
        prompts = [p for p in prompts if any(fnmatch.fnmatch("{}/{}/{}".format(p["machine"], p["mark"], p["variation"]), g) for g in args.only)]
    write_prompts(args, prompts)
    if args.backend == "prompts":
        return
    family = args.sizes or ("qwen-image-2.1" if "2.1" in (args.workflow if args.backend == "comfyui" else args.model) else "qwen-image")
    if family not in brief["aspects"]:
        raise SystemExit("--sizes {}: brief.json has {}".format(family, ", ".join(k for k in brief["aspects"] if not k.startswith("$"))))
    jobs = []
    for p in prompts:
        for s in seeds_for(p["id"], args.seeds, args.base_seed):
            path = out_path(args, p, s)
            if not os.path.exists(path):
                jobs.append((p, s, path, size_for(brief, family, p["aspect"], args.scale)))
    print("{} images to render ({} prompts x {} seeds, {} already done)".format(len(jobs), len(prompts), args.seeds, len(prompts) * args.seeds - len(jobs)))
    if args.dry_run or not jobs:
        for p, s, path, (w, h) in jobs[:10]:
            print("  {} s{} {}x{} -> {}".format(p["id"], s, w, h, os.path.relpath(path, ROOT)))
        return
    (run_comfyui if args.backend == "comfyui" else run_diffusers)(args, jobs)
    print("done. Review: python3 tools/concepts/review.py {}".format(os.path.join(args.out, args.round)))


if __name__ == "__main__":
    sys.exit(main())
