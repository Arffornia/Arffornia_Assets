#!/usr/bin/env python3
"""Second half of early/scene.mjs: crops the raw renders, grades the title's, writes scene.json.

usage: scene_pack.py <raw-dir> <out-dir>
Mattes are the still's pixels where a moving group's swept box is hidden (mask.*.png), cut from the
final (graded) still so they match it exactly.
"""
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw

PLUM = np.array([0x2A, 0x18, 0x38], dtype=np.float32) / 255
GRADE = 0.55  # ui/title/background.html .grade: plum, mix-blend-mode: color, opacity .55


def lum(c):
    return c[..., 0] * 0.3 + c[..., 1] * 0.59 + c[..., 2] * 0.11


def clip_color(c):
    l = lum(c)[..., None]
    n = c.min(axis=-1, keepdims=True)
    x = c.max(axis=-1, keepdims=True)
    c = np.where(n < 0, l + (c - l) * l / np.maximum(l - n, 1e-6), c)
    c = np.where(x > 1, l + (c - l) * (1 - l) / np.maximum(x - l, 1e-6), c)
    return c


def grade(rgb8):
    """CSS mix-blend-mode: color with the plum layer at 55 %, as the mock-up does."""
    cb = rgb8.astype(np.float32) / 255
    cs = np.broadcast_to(PLUM, cb.shape)
    blended = clip_color(cs + (lum(cb) - lum(cs))[..., None])
    out = cb * (1 - GRADE) + blended * GRADE
    return np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8)


def bbox(alpha, thr=2):
    ys, xs = np.nonzero(alpha > thr)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def main():
    raw, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    L = json.loads((raw / "layout.json").read_text())
    graded = L["grade"]
    static = np.asarray(Image.open(raw / "static.png").convert("RGBA")).copy()
    if graded:
        static[..., :3] = grade(static[..., :3])
        Image.fromarray(static[..., :3]).save(out / "static.jpg", quality=90, optimize=True)
        static_file = "static.jpg"
    else:
        Image.fromarray(static).save(out / "static.png", optimize=True)
        static_file = "static.png"

    def sprite_rgba(file):
        a = np.asarray(Image.open(raw / file).convert("RGBA")).copy()
        if graded:
            a[..., :3] = grade(a[..., :3])
        return a

    sprites = {}
    for name, meta in L["sprites"].items():
        if meta.get("frames"):
            n = meta["frames"]
            frames = [sprite_rgba(f"frame.{name}.{k:03d}.png") for k in range(n)]
            boxes = [b for b in (bbox(f[..., 3]) for f in frames) if b]
            x0 = min(b[0] for b in boxes) - 2
            y0 = min(b[1] for b in boxes) - 2
            x1 = max(b[2] for b in boxes) + 2
            y1 = max(b[3] for b in boxes) + 2
            cw, ch = x1 - x0, y1 - y0
            cols = math.ceil(math.sqrt(n))
            rows = math.ceil(n / cols)
            sheet = Image.new("RGBA", (cols * cw, rows * ch))
            for k, f in enumerate(frames):
                sheet.paste(Image.fromarray(f[y0:y1, x0:x1]), ((k % cols) * cw, (k // cols) * ch))
            sheet.save(out / f"sprite.{name}.png", optimize=True)
            sprites[name] = {"file": f"sprite.{name}.png", "x": x0, "y": y0, "w": cw, "h": ch, "pivot": [x0, y0],
                             "frames": {"count": n, "cols": cols}}
        else:
            a = sprite_rgba(f"sprite.{name}.png")
            b = bbox(a[..., 3])
            x0, y0, x1, y1 = b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2
            Image.fromarray(a[y0:y1, x0:x1]).save(out / f"sprite.{name}.png", optimize=True)
            sprites[name] = {"file": f"sprite.{name}.png", "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0,
                             "pivot": [round(v, 2) for v in meta["pivot"]]}

    chevron = Image.new("RGBA", (256, 128), (255, 255, 255, 0))
    d = ImageDraw.Draw(chevron)
    for s in (0, 128):
        d.line([(s + 16, 16), (s + 52, 64), (s + 16, 112)], fill=(255, 255, 255, 255), width=12, joint="curve")
    chevron.save(out / "chevron.png", optimize=True)

    groups = []
    for g in sorted(L["groups"], key=lambda g: g["depth"]):
        entry = {"id": g["id"], "elements": []}
        b = None
        if g.get("matte"):
            m = np.asarray(Image.open(raw / f"mask.{g['id']}.png").convert("RGB"))[..., 0]
            b = bbox(m, 8)
            glass = sprite_rgba(f"glass.{g['id']}.png")
            sil = np.asarray(Image.open(raw / f"sil.{g['id']}.png").convert("RGBA"))[..., 3]
            glass[..., 3] = (glass[..., 3].astype(np.uint16) * sil // 255).astype(np.uint8)
            gb = bbox(glass[..., 3], 1)
            if gb:
                Image.fromarray(glass[gb[1]:gb[3], gb[0]:gb[2]]).save(out / f"glass.{g['id']}.png", optimize=True)
                entry["glass"] = {"file": f"glass.{g['id']}.png", "x": gb[0], "y": gb[1], "w": gb[2] - gb[0], "h": gb[3] - gb[1]}
        if b:
            x0, y0, x1, y1 = b
            matte = static[y0:y1, x0:x1].copy()
            matte[..., 3] = (matte[..., 3].astype(np.uint16) * m[y0:y1, x0:x1] // 255).astype(np.uint8)
            Image.fromarray(matte).save(out / f"matte.{g['id']}.png", optimize=True)
            entry["matte"] = {"file": f"matte.{g['id']}.png", "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}
        if "beltTop" in g:
            t = g["beltTop"]
            cx = int((t["u0v0"][0] + t["u1v1"][0]) / 2)
            cy = int((t["u0v0"][1] + t["u1v1"][1]) / 2)
            base = static[cy - 4:cy + 5, cx - 4:cx + 5, :3].reshape(-1, 3).astype(np.float32).mean(axis=0)
            k = float(np.clip(base.mean() / np.mean([0x14, 0x1C, 0x22]), 0.4, 3.0))
            tint = np.clip(np.array([[[0x46, 0x56, 0x60]]], dtype=np.float32) * k, 0, 255).astype(np.uint8)
            if graded:
                tint = grade(tint)
            entry["belt"] = {"corners": [t["u0v0"], t["u1v0"], t["u0v1"], t["u1v1"]], "len": t["len"], "speed": t["speed"],
                             "tint": [int(c) for c in tint[0, 0]] + [96]}
        groups.append(entry)
    by_id = {g["id"]: g for g in groups}
    for e in L["elements"]:
        by_id[e["group"]]["elements"].append({
            "sprite": e["sprite"], "period": round(e["period"], 5), "rate": 60, "phases": [round(p, 5) for p in e["phases"]],
            "samples": [[round(v, 2) for v in s] for s in e["samples"]],
        })

    w, h = L["size"]
    scene = {"size": [w, h], "static": static_file, "chevron": "chevron.png", "sprites": sprites, "groups": groups}
    if graded:
        scene["overlay"] = "overlay.png"
    (out / "scene.json").write_text(json.dumps(scene, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
