#!/usr/bin/env python3
"""Reference compositor for out/scene/<screen>/scene.json: what the mod draws at time t, as PNGs.

usage: scene_preview.py <scene-dir> <out-dir> <t0> <t1> <fps>
The mod's Java renderers do the same: static, then per group (back to front) the belt chevrons,
the group's sprites at their sampled offsets, the group's matte; then the overlay.
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image


def sample(e, t, phase):
    period, rate, s = e["period"], e["rate"], e["samples"]
    x = ((t + phase) % period) * rate
    i = int(x) % len(s)
    j = (i + 1) % len(s)
    f = x - int(x)
    return [a + (b - a) * f for a, b in zip(s[i], s[j])]


def main():
    d, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    t0, t1, fps = float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
    out.mkdir(parents=True, exist_ok=True)
    sc = json.loads((d / "scene.json").read_text())
    w, h = sc["size"]
    static = Image.open(d / sc["static"]).convert("RGBA")
    imgs = {n: Image.open(d / s["file"]).convert("RGBA") for n, s in sc["sprites"].items()}
    mattes = {g["id"]: Image.open(d / g["matte"]["file"]).convert("RGBA") for g in sc["groups"] if "matte" in g}
    glasses = {g["id"]: Image.open(d / g["glass"]["file"]).convert("RGBA") for g in sc["groups"] if "glass" in g}
    chevron = np.asarray(Image.open(d / sc["chevron"]).convert("RGBA"))
    overlay = Image.open(d / sc["overlay"]).convert("RGBA").resize((w, h)) if "overlay" in sc else None
    n = int(round((t1 - t0) * fps))
    for k in range(n):
        t = t0 + k / fps
        frame = Image.new("RGBA", (w, h), (11, 17, 22, 255))
        frame.alpha_composite(static)
        for g in sc["groups"]:
            if "belt" in g:
                frame.alpha_composite(belt_layer(g["belt"], chevron, t, w, h))
            for e in g["elements"]:
                sp = sc["sprites"][e["sprite"]]
                for ph in e["phases"]:
                    dx, dy, s, a, fr = sample(e, t, ph)
                    if a <= 0.01 or s <= 0.01:
                        continue
                    img = imgs[e["sprite"]]
                    if "frames" in sp:
                        c = int(fr) % sp["frames"]["count"]
                        cols = sp["frames"]["cols"]
                        img = img.crop(((c % cols) * sp["w"], (c // cols) * sp["h"], (c % cols + 1) * sp["w"], (c // cols + 1) * sp["h"]))
                    px, py = sp["pivot"]
                    x = px + (sp["x"] - px) * s + dx
                    y = py + (sp["y"] - py) * s + dy
                    im = img.resize((max(1, round(sp["w"] * s)), max(1, round(sp["h"] * s))), Image.BILINEAR) if s != 1 else img
                    if a < 1:
                        arr = np.asarray(im).copy()
                        arr[..., 3] = (arr[..., 3] * a).astype(np.uint8)
                        im = Image.fromarray(arr)
                    layer = Image.new("RGBA", (w, h))
                    layer.paste(im, (round(x), round(y)))
                    frame.alpha_composite(layer)
            if g["id"] in glasses:
                frame.alpha_composite(glasses[g["id"]], (g["glass"]["x"], g["glass"]["y"]))
            if g["id"] in mattes:
                m = g["matte"]
                frame.alpha_composite(mattes[g["id"]], (m["x"], m["y"]))
        if overlay:
            frame.alpha_composite(overlay)
        frame.convert("RGB").save(out / f"f{k:04d}.png")


def belt_layer(b, chevron, t, w, h):
    """Affine-maps the chevron strip onto the belt top, scrolled by t * speed."""
    (x00, y00), (x10, y10), (x01, y01), _ = b["corners"]
    ux, uy = (x10 - x00) / b["len"], (y10 - y00) / b["len"]  # screen px per block along u
    vx, vy = x01 - x00, y01 - y00  # across, v 0..1
    xs = [x00, x10, x01, x10 + vx]
    ys = [y00, y10, y01, y10 + vy]
    bx0, bx1 = max(0, int(min(xs))), min(w, int(max(xs)) + 1)
    by0, by1 = max(0, int(min(ys))), min(h, int(max(ys)) + 1)
    yy, xx = np.mgrid[by0:by1, bx0:bx1].astype(np.float32)
    det = ux * vy - uy * vx
    px, py = xx - x00, yy - y00
    u = (px * vy - py * vx) / det
    v = (ux * py - uy * px) / det
    inside = (u >= 0) & (u <= b["len"]) & (v >= 0) & (v <= 1)
    ch, cw = chevron.shape[:2]
    tu = (((u - t * b["speed"]) % 1) * cw).astype(int) % cw
    tv = np.clip((v * ch).astype(int), 0, ch - 1)
    alpha = chevron[tv, tu, 3].astype(np.float32) / 255 * (b["tint"][3] / 255) * inside
    layer = np.zeros((h, w, 4), np.uint8)
    sub = layer[by0:by1, bx0:bx1]
    sub[..., 0], sub[..., 1], sub[..., 2] = b["tint"][:3]
    sub[..., 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(layer)


if __name__ == "__main__":
    main()
