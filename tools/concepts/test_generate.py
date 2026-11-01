"""Tests for generate.py: python3 -m unittest discover -s tools/concepts

The end-to-end test builds the real image-generation-lab client (IMAGE_LAB_DIR, default
~/image-generation-lab) and runs the 12-image smelter test against a stub ComfyUI that checks the
bearer token like the lab's Caddy. It is skipped when Go or the lab checkout is missing.
"""
import copy
import http.server
import json
import os
import shutil
import struct
import tempfile
import threading
import unittest
import zlib

import generate as g

BRIEF, MACHINES = g.load("brief.json"), g.load("machines.json")


def prompts(only=None):
    ps = g.build_prompts(BRIEF, MACHINES, ["orange"], ["hero"])
    return [p for p in ps if only is None or p["machine"] == only]


class Prompts(unittest.TestCase):
    def test_round_sizes(self):
        # P2: the smelter test is 3 marks x 4 variations x 1 seed = 12; the round is 56 prompts x 2 seeds = 112
        self.assertEqual(len(prompts("smelter")), 12)
        self.assertEqual(len(prompts()), 56)

    def test_p3_machines(self):
        self.assertEqual(list(MACHINES["machines"]), ["smelter", "constructor", "assembler", "foundry", "refinery"])

    def test_lineage_is_valid(self):
        self.assertEqual(g.check_lineage(MACHINES), [])

    def test_shared_marks_reuse_mk1_seeds(self):
        by = {p["id"]: p for p in prompts()}
        s = lambda pid: g.seeds_for(by[pid]["seed_key"], 2, 1)
        self.assertEqual(s("smelter/mk2/v1-orange-hero"), s("smelter/mk1/v1-orange-hero"))
        self.assertNotEqual(s("foundry/mk3/v1-orange-hero"), s("foundry/mk1/v1-orange-hero"))  # new design
        self.assertNotEqual(s("smelter/mk1/v2-orange-hero"), s("smelter/mk1/v1-orange-hero"))

    def test_lineage_text_and_p7_palette(self):
        by = {p["id"]: p for p in prompts()}
        self.assertIn("it keeps the square steel frame", by["smelter/mk2/v1-orange-hero"]["prompt"])
        self.assertIn("A new design for this tier", by["assembler/mk3/v1-orange-hero"]["prompt"])
        self.assertNotIn("Same machine as", by["smelter/mk1/v1-orange-hero"]["prompt"])
        # P7: panels stay the house colour, trims and lights take the tier accent (mk3 = tier 8, violet)
        self.assertIn("house colour, the same at every tier", by["smelter/mk3/v1-orange-hero"]["prompt"])
        self.assertIn("trims and status lights in violet", by["smelter/mk3/v1-orange-hero"]["prompt"])

    def test_lineage_errors(self):
        cases = [
            (("smelter", "lineage"), {"mode": "single", "why": "x"}, "exactly one mark"),
            (("smelter", "lineage"), {"mode": "branches", "why": "x"}, "every mark shares"),
            (("foundry", "lineage"), {"mode": "evolves", "why": "x"}, "use 'branches'"),
            (("smelter", "lineage"), {"mode": "tiered", "why": "x"}, "lineage.mode"),
            (("smelter", "lineage"), {"mode": "evolves"}, "lineage.why"),
        ]
        for (mid, key), val, msg in cases:
            m = copy.deepcopy(MACHINES); m["machines"][mid][key] = val
            self.assertTrue(any(msg in b for b in g.check_lineage(m)), (mid, val, g.check_lineage(m)))
        m = copy.deepcopy(MACHINES); del m["machines"]["smelter"]["marks"]["mk2"]["keeps"]
        self.assertTrue(any("says what it keeps" in b for b in g.check_lineage(m)))
        # a particle accelerator: one mark, no primitive tier
        m = copy.deepcopy(MACHINES)
        m["machines"]["accelerator"] = dict(m["machines"]["refinery"], lineage={"mode": "single", "why": "no primitive accelerator"},
                                            marks={"mk1": m["machines"]["refinery"]["marks"]["mk1"]})
        self.assertEqual(g.check_lineage(m), [])

    def test_lab_sizes_are_multiples_of_16(self):
        for a, (w, h) in BRIEF["aspects"]["lab"].items():
            self.assertEqual((w % 16, h % 16), (0, 0), a)
            self.assertLess(abs(w * h / 1024 ** 2 - 1), 0.06, a)


def png(w=8, h=8):
    raw = b"".join(b"\x00" + b"\x80\x40\x20" * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


class StubComfy(http.server.BaseHTTPRequestHandler):
    """ComfyUI's /prompt, /history and /view behind the lab's bearer check."""
    token, seen = "t0k", []

    def log_message(self, *a):
        pass

    def reply(self, code, body, ctype="application/json"):
        self.send_response(code); self.send_header("Content-Type", ctype); self.end_headers(); self.wfile.write(body)

    def authed(self):
        if self.headers.get("Authorization") != "Bearer " + self.token:
            self.reply(401, b"{}"); return False
        return True

    def do_POST(self):
        if not self.authed():
            return
        wf = json.loads(self.rfile.read(int(self.headers["Content-Length"])))["prompt"]
        StubComfy.seen.append(wf)
        self.reply(200, json.dumps({"prompt_id": str(len(StubComfy.seen))}).encode())

    def do_GET(self):
        if not self.authed():
            return
        if self.path.startswith("/system_stats"):
            return self.reply(200, b"{}")
        if self.path.startswith("/history/"):
            pid = self.path.rsplit("/", 1)[1]
            out = {"11": {"images": [{"filename": "img_{}.png".format(pid), "subfolder": "", "type": "output"}]}}
            return self.reply(200, json.dumps({pid: {"status": {"status_str": "success"}, "outputs": out}}).encode())
        if self.path.startswith("/view"):
            return self.reply(200, png(), "image/png")
        self.reply(404, b"{}")


LAB = os.path.expanduser(os.environ.get("IMAGE_LAB_DIR", "~/image-generation-lab"))


@unittest.skipUnless(shutil.which("go") and os.path.isfile(os.path.join(LAB, "client", "main.go")), "needs Go and an image-generation-lab checkout")
class EndToEnd(unittest.TestCase):
    def test_smelter_test_run_through_the_lab_client(self):
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), StubComfy)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        out = tempfile.mkdtemp(prefix="arf-concepts-")
        env = {"LAB_URL": "http://127.0.0.1:{}".format(srv.server_address[1]), "LAB_TOKEN": StubComfy.token}
        old = {k: os.environ.get(k) for k in env}
        os.environ.update(env)
        try:
            StubComfy.seen = []
            g.main(["lab", "--only", "smelter/*", "--seeds", "1", "--out", out, "--lab", LAB])
            lines = open(os.path.join(out, "r1", "manifest.jsonl")).read().splitlines()
            self.assertEqual(len(lines), 12)
            self.assertEqual(len(StubComfy.seen), 12)
            wf = StubComfy.seen[0]
            self.assertIn("ore smelter", wf["6"]["inputs"]["text"])
            self.assertEqual((wf["8"]["inputs"]["width"], wf["8"]["inputs"]["height"]), (1152, 864))  # smelter is 4:3
            rec = json.loads(lines[0])
            self.assertEqual(rec["settings"]["workflow"], "qwen21-q4.json")
            if rec["settings"]["negative"]:  # the lab client with PR #1: negative and prefix reach the graph
                self.assertIn("minecraft, voxel", wf["7"]["inputs"]["text"])
                self.assertTrue(wf["11"]["inputs"]["filename_prefix"].startswith("arffornia/r1/smelter_"))
            # resumable: a second run renders nothing
            g.main(["lab", "--only", "smelter/*", "--seeds", "1", "--out", out, "--lab", LAB])
            self.assertEqual(len(StubComfy.seen), 12)
        finally:
            srv.shutdown()
            for k, v in old.items():
                os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)
            shutil.rmtree(out, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
