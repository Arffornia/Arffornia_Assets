#!/usr/bin/env python3
"""Static check for an early-window sprite sheet: no frame may touch its cell edge.

A frame whose opaque pixels reach the cell border is cut by the cell (round 3 bug: a straight edge
across the middle of the window), and with linear filtering it also bleeds into the next cell.
usage: check-sheet.py <sheet.png> <sheet.json> [--margin 4] [--max-size 4096]
Exit 1 with the offending frames and sides; 0 with the measured union box otherwise.
"""
import json, sys
from PIL import Image

def main():
    a = sys.argv[1:]
    margin = int(a[a.index('--margin') + 1]) if '--margin' in a else 4
    max_size = int(a[a.index('--max-size') + 1]) if '--max-size' in a else 4096
    im = Image.open(a[0]).convert('RGBA'); meta = json.load(open(a[1]))
    cw, ch = meta['cell']; cols = meta['cols']; errs = []
    if max(im.size) > max_size:
        errs.append(f'sheet {im.size[0]}x{im.size[1]} exceeds {max_size} px (GL 3.2 drivers may refuse it)')
    union = None
    for f in range(meta['frames']):
        x, y = (f % cols) * cw, (f // cols) * ch
        alpha = im.crop((x, y, x + cw, y + ch)).split()[3].point(lambda v: 255 if v > 8 else 0)
        b = alpha.getbbox()
        if not b: errs.append(f'frame {f}: empty'); continue
        union = b if union is None else (min(union[0], b[0]), min(union[1], b[1]), max(union[2], b[2]), max(union[3], b[3]))
        sides = [s for s, bad in (('left', b[0] < margin), ('top', b[1] < margin), ('right', b[2] > cw - margin), ('bottom', b[3] > ch - margin)) if bad]
        if sides: errs.append(f'frame {f}: content within {margin} px of the {", ".join(sides)} edge {b}')
    if errs:
        print('\n'.join(errs)); sys.exit(1)
    print(f'ok: {meta["frames"]} frames, cell {cw}x{ch}, content union {union}, margins l{union[0]} t{union[1]} r{cw - union[2]} b{ch - union[3]}')

if __name__ == '__main__':
    main()
