#!/usr/bin/env python3
"""Concept image batch for Arffornia machines (docs/PIPELINE.md, steps 1-3).

Composes the DA brief (brief.json) with the machines (machines.json) into prompts, then renders
every prompt with N stable seeds on Brian's image-generation-lab
(https://github.com/TheGostsniperfr/image-generation-lab): its ComfyUI behind Caddy, its workflows
and its Go client. Nothing here talks to ComfyUI directly. Resumable: existing images are skipped.

  python3 tools/concepts/generate.py prompts                         # out/concepts/<round>/prompts.{jsonl,md}
  python3 tools/concepts/generate.py check                           # validate machines.json (lineage, P4)
  LAB_URL=http://host:8080 LAB_TOKEN=... \\
  python3 tools/concepts/generate.py lab --only 'smelter/*' --seeds 1   # the 12-image smelter test
  python3 tools/concepts/generate.py lab                             # the round: 112 images
  python3 tools/concepts/review.py out/concepts/r1                   # the review page for the human pick

Lab options: --lab ~/image-generation-lab (or IMAGE_LAB_DIR), --workflow qwen21-q4 (a file name in
the lab's workflows/), LAB_URL and LAB_TOKEN as for the lab's own client.
Common options: --round r1 --seeds 2 --only 'smelter/*' --palette orange|all --view hero|side|sheet
--sizes lab|qwen-image-2.1 --scale 1.0 --dry-run.
Output: out/concepts/<round>/<machine>/<mark>/<variation>-<palette>-<view>-s<seed>.png and
out/concepts/<round>/manifest.jsonl (one line per image: prompt, seed, workflow, size, time).
"""
import argparse
import fnmatch
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))


def load(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------- lineage (P4)
def check_lineage(machines):
    """Each machine says how its tiers relate. Returns a list of problems (empty when valid)."""
    bad = []
    for mid, m in machines["machines"].items():
        lin, marks = m.get("lineage") or {}, list(m["marks"].items())
        mode = lin.get("mode")
        if mode not in ("evolves", "branches", "single"):
            bad.append("{}: lineage.mode must be evolves, branches or single (got {!r})".format(mid, mode))
            continue
        if not lin.get("why"):
            bad.append("{}: lineage.why is missing: say why the tiers relate this way".format(mid))
        if mode == "single" and len(marks) != 1:
            bad.append("{}: a 'single' machine has exactly one mark (has {})".format(mid, len(marks)))
        if mode != "single" and len(marks) < 2:
            bad.append("{}: '{}' needs at least two marks; use 'single' for one".format(mid, mode))
        for mk, mark in marks[1:]:
            ch = mark.get("chassis")
            if ch == "shared" and not mark.get("keeps"):
                bad.append("{}/{}: a shared chassis says what it keeps from {}".format(mid, mk, marks[0][0]))
            elif ch == "new" and not mark.get("why"):
                bad.append("{}/{}: a new design says why it breaks from {}".format(mid, mk, marks[0][0]))
            elif ch not in ("shared", "new"):
                bad.append("{}/{}: chassis must be shared or new".format(mid, mk))
        later = [mark.get("chassis") for _, mark in marks[1:]]
        if mode == "evolves" and "new" in later:
            bad.append("{}: 'evolves' but a mark is a new design; use 'branches'".format(mid))
        if mode == "branches" and "new" not in later:
            bad.append("{}: 'branches' but every mark shares the chassis; use 'evolves'".format(mid))
    return bad


def lineage_text(m, mk, mark, first):
    if mk == first:
        return ""
    if mark["chassis"] == "shared":
        return ("Same machine as the Mark 1 {}, same footprint and silhouette: it keeps {}; only the power "
                "module and the details change.").format(m["title"].lower(), mark["keeps"])
    return "A new design for this tier, not a variant of the earlier marks."


def footprint_text(fp):
    w, d, h = fp
    shape = "Square footprint of {0} by {0} metres".format(w) if w == d else "Long rectangular footprint of {} by {} metres".format(min(w, d), max(w, d))
    return "{}, about {} metres tall.".format(shape, h)


def build_prompts(brief, machines, palettes, views):
    """Every (machine, mark, variation, palette, view): the model-agnostic text prompt and its metadata."""
    out = []
    for mid, m in machines["machines"].items():
        first = next(iter(m["marks"]))
        for mk, mark in m["marks"].items():
            tier = brief["tiers"][str(mark["tier"])]
            chassis = "base" if mk == first else mark["chassis"]
            for vid, var in m["variations"].items():
                for pal in palettes:
                    for view in views:
                        palette = brief["palette"]["options"][pal].format(accent=tier["accent"])
                        light = brief["light"].format(power=brief["power"][mark["power"]])
                        text = " ".join(x for x in [
                            brief["style"], "The machine: " + m["core"], mark["text"], lineage_text(m, mk, mark, first),
                            "Design: " + var, footprint_text(m["footprint"]), brief["scale"], palette, light, brief["views"][view],
                        ] if x)
                        aspect = "16:9" if view == "sheet" else m["aspect"]
                        tail = "{}-{}-{}".format(vid, pal, view)
                        out.append({
                            "id": "{}/{}/{}".format(mid, mk, tail),
                            # shared marks reuse Mk1's seeds: the same variation starts from the same composition
                            "seed_key": "{}/{}/{}".format(mid, first if chassis == "shared" else mk, tail),
                            "machine": mid, "mark": mk, "tier": mark["tier"], "variation": vid, "palette": pal, "view": view,
                            "lineage": m["lineage"]["mode"], "chassis": chassis, "exception": chassis == "new",
                            "title": "{} {} ({}), {}".format(m["title"], mk.upper(), mark["power"], var.split(",")[0].split(":")[0]),
                            "prompt": text, "negative": brief["negative"], "aspect": aspect,
                        })
    return out


def seeds_for(key, n, base):
    # stable per seed key: the same prompt gets the same seeds on every run and every machine
    h = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16) % 1_000_000
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
            f.write("## {}\n\n{} (aspect {}, chassis {})\n\n> {}\n\n".format(p["id"], p["title"], p["aspect"], p["chassis"], p["prompt"]))
    print("{} prompts -> {}/prompts.jsonl and prompts.md".format(len(prompts), d))


# ---------------------------------------------------------------- the lab (Brian's image-generation-lab)
class Lab:
    """The lab's Go client, built once from the lab checkout, called once per image."""

    def __init__(self, args):
        self.dir = os.path.abspath(os.path.expanduser(args.lab))
        self.workflow = args.workflow if args.workflow.endswith(".json") else os.path.join(self.dir, "workflows", args.workflow + ".json")
        if not os.path.isfile(os.path.join(self.dir, "client", "main.go")):
            raise SystemExit("--lab {}: not an image-generation-lab checkout (no client/main.go). Clone "
                             "https://github.com/TheGostsniperfr/image-generation-lab or set IMAGE_LAB_DIR.".format(self.dir))
        if not os.path.isfile(self.workflow):
            names = sorted(f[:-5] for f in os.listdir(os.path.join(self.dir, "workflows")) if f.endswith(".json"))
            raise SystemExit("--workflow {}: not found. The lab has: {}".format(args.workflow, ", ".join(names)))
        self.url, self.token = os.environ.get("LAB_URL", ""), os.environ.get("LAB_TOKEN", "")
        self.bin = os.path.join(os.path.abspath(args.out), ".lab-client")
        self.flags = set()

    def ready(self):
        if not self.url or not self.token:
            raise SystemExit("set LAB_URL and LAB_TOKEN, as for the lab's client (the token is API_TOKEN in the lab's .env).")
        req = urllib.request.Request(self.url.rstrip("/") + "/system_stats", headers={"Authorization": "Bearer " + self.token})
        try:
            urllib.request.urlopen(req, timeout=10).read()
        except urllib.error.HTTPError as e:
            raise SystemExit("the lab answered {} at {}: check LAB_TOKEN.".format(e.code, self.url))
        except (urllib.error.URLError, OSError) as e:
            raise SystemExit("the lab is not reachable at {} ({}). Start it: docker compose up -d in the lab.".format(self.url, e))
        os.makedirs(os.path.dirname(self.bin), exist_ok=True)
        if not shutil.which("go"):
            raise SystemExit("the lab's client needs Go (on NixOS: nix shell nixpkgs#go).")
        subprocess.run(["go", "build", "-o", self.bin, "."], cwd=os.path.join(self.dir, "client"), check=True)
        self.detect()

    def detect(self):
        # -negative and -prefix come with image-generation-lab PR #1; older clients work without them
        usage = subprocess.run([self.bin, "-h"], capture_output=True, text=True)
        self.flags = {f for f in ("negative", "prefix") if "-" + f + " " in usage.stderr + usage.stdout}

    def command(self, p, seed, w, h, outdir, rnd):
        cmd = [self.bin, "-server", self.url, "-workflow", self.workflow, "-prompt", p["prompt"],
               "-seed", str(seed), "-width", str(w), "-height", str(h), "-out", outdir]
        if "negative" in self.flags:
            cmd += ["-negative", p["negative"]]
        if "prefix" in self.flags:
            cmd += ["-prefix", "arffornia/{}/{}".format(rnd, p["id"].replace("/", "_"))]
        return cmd

    def render(self, p, seed, w, h, rnd):
        tmp = tempfile.mkdtemp(prefix="arf-lab-")
        try:
            r = subprocess.run(self.command(p, seed, w, h, tmp, rnd), capture_output=True, text=True)
            if r.returncode != 0:
                raise SystemExit("the lab failed on {} s{}: {}".format(p["id"], seed, (r.stderr or r.stdout).strip()[:800]))
            pngs = [ln.strip() for ln in r.stdout.splitlines() if ln.strip().endswith(".png")]
            if not pngs:
                raise SystemExit("the lab returned no image for {} (is there a SaveImage node?)".format(p["id"]))
            with open(pngs[0], "rb") as f:
                return f.read()
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


def run_lab(args, jobs):
    lab = Lab(args)
    if args.dry_run:
        for p, s, path, (w, h) in jobs[:10]:
            print("  {} s{} {}x{} -> {}".format(p["id"], s, w, h, os.path.relpath(path, ROOT)))
        print("  workflow: {}".format(lab.workflow))
        return
    lab.ready()
    for i, (p, seed, path, (w, h)) in enumerate(jobs, 1):
        t0 = time.time()
        data = lab.render(p, seed, w, h, args.round)
        save(args, p, seed, path, data, {"backend": "image-generation-lab", "workflow": os.path.basename(lab.workflow), "size": [w, h],
                                          "negative": "negative" in lab.flags}, t0, i, len(jobs))


def save(args, p, seed, path, data, settings, t0, i, n):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    rec = dict(p, seed=seed, file=os.path.relpath(path, os.path.join(args.out, args.round)), settings=settings,
               seconds=round(time.time() - t0, 1), at=time.strftime("%Y-%m-%dT%H:%M:%S"))
    with open(os.path.join(args.out, args.round, "manifest.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print("[{}/{}] {} s{} ({:.0f} s)".format(i, n, p["id"], seed, time.time() - t0), flush=True)


def plan(args, brief, prompts):
    jobs = []
    for p in prompts:
        for s in seeds_for(p["seed_key"], args.seeds, args.base_seed):
            path = out_path(args, p, s)
            if not os.path.exists(path):
                jobs.append((p, s, path, size_for(brief, args.sizes, p["aspect"], args.scale)))
    return jobs


def parse(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("backend", choices=["prompts", "check", "lab"])
    ap.add_argument("--round", default="r1", help="round name: one folder per review round")
    ap.add_argument("--out", default=os.path.join(ROOT, "out", "concepts"))
    ap.add_argument("--only", action="append", default=[], help="glob on machine/mark/variation, e.g. 'smelter/*' or '*/mk1/v2'")
    ap.add_argument("--palette", default=None, help="palette name from brief.json, or 'all' (default: the brief's default)")
    ap.add_argument("--view", default="hero", help="hero, side, sheet, or a comma list")
    ap.add_argument("--seeds", type=int, default=2)
    ap.add_argument("--base-seed", type=int, default=20261101)
    ap.add_argument("--scale", type=float, default=1.0, help="size multiplier (0.5 for quick drafts)")
    ap.add_argument("--sizes", default="lab", help="size family in brief.json aspects: lab (about 1 MP, default), qwen-image, qwen-image-2.1")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--lab", default=os.environ.get("IMAGE_LAB_DIR", "~/image-generation-lab"), help="the image-generation-lab checkout")
    ap.add_argument("--workflow", default="qwen21-q4", help="a workflow name from the lab's workflows/ (or a path to an API-format JSON)")
    return ap.parse_args(argv)


def main(argv=None):
    args = parse(argv)
    brief, machines = load("brief.json"), load("machines.json")
    bad = check_lineage(machines)
    if bad:
        raise SystemExit("machines.json:\n  " + "\n  ".join(bad))
    if args.backend == "check":
        print("machines.json: {} machines, lineage ok".format(len(machines["machines"])))
        return
    palettes = list(brief["palette"]["options"]) if args.palette == "all" else [args.palette or brief["palette"]["default"]]
    views = args.view.split(",")
    for v in views:
        if v not in brief["views"]:
            raise SystemExit("unknown view {} (brief.json views: {})".format(v, ", ".join(brief["views"])))
    if args.sizes.startswith("$") or args.sizes not in brief["aspects"]:
        raise SystemExit("--sizes {}: brief.json has {}".format(args.sizes, ", ".join(k for k in brief["aspects"] if not k.startswith("$"))))
    prompts = build_prompts(brief, machines, palettes, views)
    if args.only:
        prompts = [p for p in prompts if any(fnmatch.fnmatch("{}/{}/{}".format(p["machine"], p["mark"], p["variation"]), g) for g in args.only)]
    write_prompts(args, prompts)
    if args.backend == "prompts":
        return
    jobs = plan(args, brief, prompts)
    print("{} images to render ({} prompts x {} seeds, {} already done)".format(len(jobs), len(prompts), args.seeds, len(prompts) * args.seeds - len(jobs)))
    if jobs:
        run_lab(args, jobs)
    if jobs and not args.dry_run:
        print("done. Review: python3 tools/concepts/review.py {}".format(os.path.join(args.out, args.round)))


if __name__ == "__main__":
    sys.exit(main())
