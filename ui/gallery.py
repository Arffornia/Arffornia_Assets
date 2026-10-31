#!/usr/bin/env python3
"""Build the review gallery (one self-contained HTML page) from the rendered outputs.

usage: python3 ui/gallery.py out/ui/gallery.html
Embeds downscaled WebP stills and animated WebP clips as data URIs (the review page cannot load
other files). Needs Pillow and ffmpeg.
"""
import base64, io, os, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
O = lambda *p: os.path.join(ROOT, 'out', *p)


def still(path, w=1280, q=80):
    im = Image.open(path).convert('RGB')
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def anim(src, w=640, q=62, fps=None, alpha=False):
    """src: a video file or a PNG sequence pattern; returns an animated WebP data URI."""
    with tempfile.TemporaryDirectory() as t:
        out = os.path.join(t, 'a.webp')
        vf = f"scale={w}:-1:flags=lanczos" + (f",fps={fps}" if fps else '')
        inp = ['-framerate', str(fps or 20), '-i', src] if '%' in src else ['-i', src]
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *inp, '-vf', vf, '-c:v', 'libwebp_anim', '-q:v', str(q), '-loop', '0', out], check=True)
        return 'data:image/webp;base64,' + base64.b64encode(open(out, 'rb').read()).decode()


DIRS = [
    ('a-honeycomb', 'A', 'Honeycomb', 'The menu is a mosaic of hexagonal tiles that continues the factory floor. The Play tile carries the Space Elevator. While loading, the six tiles around the centre fill clockwise.', 'The hex mosaic you liked in an old menu mod.'),
    ('b-drafting', 'B', 'Drafting sheet', 'The screen is an engineering drawing: leader lines name each machine and its tier, and the menu is the title block in the corner. Loading becomes a revision table.', 'Engineering-drawing conventions as the whole UI.'),
    ('c-launcher', 'C', 'Launcher continuity', "The launcher's own tokens (Montserrat, plum, orange): a floating dock, a news card, a server chip. Swap the tokens when the launcher changes.", 'No visual break between launcher and game.'),
    ('d-shift-board', 'D', 'Shift board', 'No panels and no boxed buttons: the menu is type, wide for actions and narrow for status. The six machines double as the six loading steps.', 'Typography only; the factory stays the hero.'),
    ('e-maquette', 'E', 'Model studio', 'Daylight. The factory is a scale model on a white table and the menu is a pinned spec sheet with keyboard hints.', 'A light theme for the game.'),
]
MACHINES = [('miner', 'Miner', 'Tier 0'), ('smelter', 'Smelter', 'Tier 0'), ('constructor', 'Constructor', 'Tier 1'),
            ('foundry', 'Foundry', 'Tier 2'), ('assembler', 'Assembler', 'Tier 2'), ('space-elevator', 'Space Elevator', 'Tier 3')]


def main(out):
    css = open(os.path.join(ROOT, 'ui', 'gallery.css')).read()
    h = ['<title>Title Screen Directions</title>', '<meta name="claude:viewport-fit-sides" content="cover">',
         '<link rel="preconnect" href="https://fonts.googleapis.com">',
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Chakra+Petch:wght@600;700&display=swap">',
         f'<style>{css}</style>', '<div class="wrap">']
    h.append('''<header class="hero"><div class="eyebrow">Spec 007, round 2</div>
<h1>Five ways to put a menu on the factory</h1>
<p>You liked the machines and not the buttons on top of them. Same factory, now a real 3D scene rendered from Blockbench models, with five UI directions over it. Each shows the title screen, the loading state and the intro motion. Pick one, or a mix.</p>
<nav class="jump" aria-label="Directions">''' + ''.join(f'<a href="#dir-{k}"><b>{k}</b>{n}</a>' for _, k, n, _, _ in DIRS) + '</nav></header>')
    for slug, k, name, idea, bold in DIRS:
        d = O('ui', slug)
        h.append(f'''<section class="dir" id="dir-{k}"><div class="head"><span class="key">{k}</span><div><h2>{name}</h2><p>{idea}</p><p class="bold">{bold}</p></div></div>
<figure class="main"><img src="{still(os.path.join(d, 'title.png'))}" alt="{name}: title screen" loading="lazy"><figcaption>Title screen</figcaption></figure>
<div class="pair"><figure><img src="{still(os.path.join(d, 'loading.png'), 900, 76)}" alt="{name}: loading state" loading="lazy"><figcaption>Loading state</figcaption></figure>
<figure><img src="{anim(os.path.join(d, 'title.mp4'))}" alt="{name}: intro motion, 4 seconds" loading="lazy"><figcaption>Intro motion, 4 s loop</figcaption></figure></div></section>''')
    e = O('early')
    h.append(f'''<section class="band"><div class="inner"><div class="eyebrow">Before Minecraft starts</div><h2>Yes, the anvil can come back</h2>
<p>The first window (854×480, redrawn 20 times a second) cannot show 3D, but it can play a sprite loop. Proof below: on the left, our renderer drawing what our own early-window provider would draw; on the right, the real NeoForge early window playing our Constructor press where the fox normally runs.</p>
<div class="pair"><figure><img src="{anim(os.path.join(e, 'early-anim.20fps.mp4'), 640, 70)}" alt="Arffornia early window: press loop at 20 fps" loading="lazy"><figcaption>Our provider, 20 fps: 10 ms per frame on a software GPU (budget 50 ms)</figcaption></figure>
<figure><img src="{anim(os.path.join(e, 'fml-real-window.20fps.mp4'), 640, 70)}" alt="Real FML early window playing the Arffornia press" loading="lazy"><figcaption>The real FML 4.0.39 window, unchanged except our sprite strip</figcaption></figure></div>
<p class="note">A static branded image is the fallback: same backdrop, no sprite. Recommendation: the press loop, as the homage to Forge 1.7.10's hammer and anvil.</p></div></section>''')
    h.append('<section><div class="eyebrow">One source of truth</div><h2>The machines are Blockbench models now</h2><p class="lede">Each machine below is a <code>.bbmodel</code> file. Change one and the pipeline re-exports its icon, turntable, sprite sheet, animated SVG and glTF, and every scene it appears in, including the screens above.</p><div class="grid">')
    for slug, name, tier in MACHINES:
        h.append(f'<figure><img src="{anim(O("models", slug, slug + ".turntable.mp4"), 360, 60)}" alt="{name} turntable" loading="lazy"><figcaption><b>{name}</b> {tier}</figcaption></figure>')
    h.append('</div></section>')
    h.append('''<section class="decide"><div class="eyebrow">What I need from you</div><h2>Decisions</h2><dl>
<div><dt>UI direction</dt><dd>A, B, C, D, E, or a mix (for example D's type with A's tiles). <b>Default: D Shift board</b>, with A Honeycomb as the alternative.</dd></div>
<div><dt>Early window</dt><dd>Press loop at 20 fps, or a static branded image. <b>Default: the press loop.</b></dd></div>
<div><dt>Web menus (Paladium-style)</dt><dd>Native screens with TesseraUI templates for menus and machine GUIs; a browser (MCEF/WebGUI, about 150 MB per player) only for content pages such as shop or news, if ever. <b>Default: native.</b></dd></div>
<div><dt>Assets repository</dt><dd><code>Arffornia/Arffornia_Assets</code>, public (created by Brian, 2026-10-31).</dd></div>
</dl></section>''')
    h.append('<footer>Rendered 31 October 2026 by the Arffornia_Assets pipeline (three.js on a software GPU, deterministic). Screens are mock-ups: server status, players and news are example data.</footer></div>')
    open(out, 'w').write('\n'.join(h))
    print(out, round(os.path.getsize(out) / 1e6, 2), 'MB')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else O('ui', 'gallery.html'))
