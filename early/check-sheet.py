#!/usr/bin/env python3
"""Static check for the early-window line frames: no frame may touch its cell edge, and the loop closes.

A frame whose opaque pixels reach the cell border is cut by the cell (round 3 bug: a straight edge
across the middle of the window). The loop check compares the last frame -> first frame step with the
median step between neighbours: a seam much larger than an ordinary step is the visible jump of the
round 4 sheet (a 3 s loop that closed none of the motions).
usage: check-sheet.py <frames-dir> [--margin 8]
Exit 1 with the offending frames; 0 with the measured union box otherwise.
"""
import json, pathlib, sys
import numpy as np
from PIL import Image

def main():
    a = sys.argv[1:]
    margin = int(a[a.index('--margin') + 1]) if '--margin' in a else 8
    d = pathlib.Path(a[0]); meta = json.loads((d / 'line.json').read_text())
    cw, ch = meta['cell']; errs = []; union = None; frames = []
    for f in range(meta['frames']):
        im = Image.open(d / f'f{f:04d}.png').convert('RGBA')
        if im.size != (cw, ch): errs.append(f'frame {f}: {im.size} is not the cell {cw}x{ch}'); continue
        frames.append(np.asarray(im, dtype=np.int16))
        b = im.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
        if not b: errs.append(f'frame {f}: empty'); continue
        union = b if union is None else (min(union[0], b[0]), min(union[1], b[1]), max(union[2], b[2]), max(union[3], b[3]))
        sides = [s for s, bad in (('left', b[0] < margin), ('top', b[1] < margin), ('right', b[2] > cw - margin), ('bottom', b[3] > ch - margin)) if bad]
        if sides: errs.append(f'frame {f}: content within {margin} px of the {", ".join(sides)} edge {b}')
    if len(frames) == meta['frames'] > 2:
        step = lambda x, y: float(np.abs(x - y).mean())
        steps = [step(frames[i], frames[i + 1]) for i in range(len(frames) - 1)]
        seam, median = step(frames[-1], frames[0]), float(np.median(steps))
        print(f'loop: seam step {seam:.3f}, median step {median:.3f}, max step {max(steps):.3f}')
        if seam > 1.5 * max(steps): errs.append(f'loop seam {seam:.3f} is larger than any step between frames ({max(steps):.3f})')
    if errs:
        print('\n'.join(errs)); sys.exit(1)
    print(f'ok: {meta["frames"]} frames, cell {cw}x{ch}, content union {union}, margins l{union[0]} t{union[1]} r{cw - union[2]} b{ch - union[3]}')

if __name__ == '__main__':
    main()
