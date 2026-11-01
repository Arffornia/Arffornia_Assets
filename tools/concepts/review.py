#!/usr/bin/env python3
"""Review page for a concept round (docs/PIPELINE.md, step 4: the human pick).

  python3 tools/concepts/review.py out/concepts/r1     # writes out/concepts/r1/index.html

Open the page in a browser (file:// works). One section per machine, one row per mark, so the
tier evolution reads left to right. Click an image to enlarge it and read its prompt. Mark each
image pick (one per machine and mark), keep, or drop, and add notes. "Download picks.json" saves
the verdict; commit it as concepts/picks/<round>.json. Choices are kept in the browser between
visits (localStorage), so the page can be closed and reopened.
"""
import html
import json
import os
import sys

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Concept review __ROUND__</title>
<style>
:root{--bg:#f4f2ee;--fg:#1d1b19;--mut:#6b655e;--card:#fff;--line:#e2ddd5;--acc:#e8711c;--ok:#2f8f5b;--no:#b23a3a}
@media (prefers-color-scheme:dark){:root{--bg:#151413;--fg:#efebe5;--mut:#a39b91;--card:#1f1d1b;--line:#34302c;--acc:#f28c28;--ok:#5cc58b;--no:#e06a6a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:17px;margin:0}header .sp{flex:1}button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:6px;padding:5px 10px;cursor:pointer}
button.on{border-color:var(--acc);color:var(--acc)}main{padding:16px;max-width:1800px;margin:auto}
section{margin:0 0 28px}h2{font-size:16px;margin:0 0 8px}.row{display:flex;gap:10px;align-items:flex-start;margin:0 0 12px}
.lab{flex:0 0 120px;color:var(--mut);font-size:12px}.lab b{display:block;color:var(--fg);font-size:14px}.chip{display:inline-block;margin-top:4px;padding:1px 6px;border-radius:9px;border:1px solid var(--line)}
.cells{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}.cell{flex:0 0 220px;background:var(--card);border:2px solid var(--line);border-radius:8px;overflow:hidden}
.cell img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;cursor:zoom-in;background:#888}.cell .meta{padding:5px 7px;font-size:12px;color:var(--mut);display:flex;gap:4px;align-items:center}
.cell .meta span{flex:1}.cell.pick{border-color:var(--acc)}.cell.keep{border-color:var(--ok)}.cell.drop{opacity:.35}
.cell button{padding:1px 6px;font-size:12px}textarea{width:100%;min-height:44px;font:inherit;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px}
dialog{max-width:min(1400px,96vw);border:0;border-radius:10px;background:var(--card);color:var(--fg);padding:12px}dialog img{max-width:100%;max-height:72vh;display:block;margin:auto}
dialog p{font-size:12px;color:var(--mut);max-height:18vh;overflow:auto}.exc{color:var(--acc)}
@media (max-width:700px){.row{flex-direction:column}.lab{flex:none}.cell{flex-basis:160px}}
</style></head><body>
<header><h1>Concept review: __ROUND__</h1><span id="count" class="sp"></span>
<button id="only">Show picks only</button><button id="dl">Download picks.json</button></header>
<main id="m"></main><dialog id="d"><img id="di" alt=""><p id="dp"></p><button onclick="d.close()">Close</button></dialog>
<script>
const ROUND = __ROUNDJSON__, ITEMS = __ITEMS__;
const KEY = 'arffornia-concepts-' + ROUND; let st = {};
try { st = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} render(); };
st.marks ||= {}; st.notes ||= {};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let onlyPicks = false;
function render() {
  const by = {}; for (const it of ITEMS) ((by[it.machine] ||= {})[it.mark] ||= []).push(it);
  let html = '';
  for (const [m, marks] of Object.entries(by)) {
    html += `<section><h2>${esc(m)}</h2>`;
    for (const [mk, items] of Object.entries(marks)) {
      const t = items[0];
      html += `<div class="row"><div class="lab"><b>${esc(mk.toUpperCase())}</b>tier ${t.tier}<br><span class="chip">${esc(t.band)}</span>${t.exception ? '<br><span class="exc">exception</span>' : ''}</div><div class="cells">`;
      for (const it of items) {
        const s = st.marks[it.file] || '';
        if (onlyPicks && s !== 'pick' && s !== 'keep') continue;
        html += `<div class="cell ${s}"><img loading="lazy" src="${esc(it.file)}" data-f="${esc(it.file)}" alt="${esc(it.id)}"><div class="meta"><span>${esc(it.variation)} · s${it.seed}</span>`
          + `<button data-a="pick" data-f="${esc(it.file)}" title="the one for this mark">★</button><button data-a="keep" data-f="${esc(it.file)}" title="worth keeping">✓</button><button data-a="drop" data-f="${esc(it.file)}" title="drop">✗</button></div></div>`;
      }
      html += `</div></div>`;
    }
    html += `<textarea data-n="${esc(m)}" placeholder="Notes on ${esc(m)}: what to keep, what to change in the brief">${esc(st.notes[m] || '')}</textarea></section>`;
  }
  document.getElementById('m').innerHTML = html;
  const n = Object.values(st.marks).filter((v) => v === 'pick').length;
  document.getElementById('count').textContent = `${ITEMS.length} images · ${n} picked`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]');
  if (b) {
    const f = b.dataset.f, a = b.dataset.a, it = ITEMS.find((x) => x.file === f);
    if (a === 'pick') for (const x of ITEMS) if (x.machine === it.machine && x.mark === it.mark && st.marks[x.file] === 'pick') st.marks[x.file] = 'keep';
    st.marks[f] = st.marks[f] === a ? '' : a; save(); return;
  }
  const img = e.target.closest('img[data-f]');
  if (img) { const it = ITEMS.find((x) => x.file === img.dataset.f); di.src = it.file; dp.textContent = `${it.id} · seed ${it.seed} · ${it.prompt}`; d.showModal(); }
});
document.addEventListener('input', (e) => { if (e.target.dataset.n) { st.notes[e.target.dataset.n] = e.target.value; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (x) {} } });
document.getElementById('only').onclick = (e) => { onlyPicks = !onlyPicks; e.target.classList.toggle('on', onlyPicks); render(); };
document.getElementById('dl').onclick = () => {
  const out = { round: ROUND, at: new Date().toISOString(), notes: st.notes, images: ITEMS.filter((x) => st.marks[x.file]).map((x) => ({ id: x.id, seed: x.seed, file: x.file, verdict: st.marks[x.file] })) };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })); a.download = `picks-${ROUND}.json`; a.click();
};
render();
</script></body></html>
"""


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    d = os.path.abspath(sys.argv[1])
    man = os.path.join(d, "manifest.jsonl")
    if not os.path.exists(man):
        raise SystemExit("no manifest.jsonl in {}: run generate.py first".format(d))
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "brief.json"), encoding="utf-8") as f:
        tiers = json.load(f)["tiers"]
    items, seen = [], set()
    with open(man, encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r["file"] in seen or not os.path.exists(os.path.join(d, r["file"])):
                continue
            seen.add(r["file"])
            r["band"] = tiers[str(r["tier"])]["band"]
            items.append({k: r[k] for k in ("id", "machine", "mark", "tier", "variation", "palette", "view", "seed", "file", "prompt", "band", "exception")})
    items.sort(key=lambda r: (r["machine"], r["mark"], r["variation"], r["seed"]))
    rnd = os.path.basename(d)
    page = (PAGE.replace("__ROUNDJSON__", json.dumps(rnd)).replace("__ROUND__", html.escape(rnd))
            .replace("__ITEMS__", json.dumps(items, ensure_ascii=False).replace("</", "<\\/")))
    with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
        f.write(page)
    print("{} images -> {}".format(len(items), os.path.join(d, "index.html")))


if __name__ == "__main__":
    main()
