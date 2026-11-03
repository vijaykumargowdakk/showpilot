"""Voice audition: renders one line with each narrator and builds out/voices/index.html to compare them.

Usage: showpilot voices [--line "text"] [--voices all|male|female|id,id] [--speeds 1,0.92] [--energy 1]
The line may use the delivery marks (| breath, || beat, *stress*, <up>lift</up>); see delivery.py.
"""
import argparse
import html
import json
import os
import re
import time
from pathlib import Path

from delivery import perform
from engine import HERE, Engine, master, median_pitch

PHONEMES = re.compile(r"\[([^\]]+)\]\(/[^)]*/\)")
LINE = "Hi! | This is how I'd sound, walking people through your product. || Natural, *clear*, | and easy to follow."


def kokoro_grades() -> dict:
    """Overall grade per voice from Kokoro's own VOICES.md (the last grade-like cell of each table row)."""
    from huggingface_hub import hf_hub_download

    grades = {}
    for line in Path(hf_hub_download("hexgrad/Kokoro-82M", "VOICES.md")).read_text(encoding="utf-8").splitlines():
        cells = [c.strip(" *`") for c in line.split("|")]
        name = next((c for c in cells if re.fullmatch(r"[ab][fm]_\w+", c)), None)
        found = [c for c in cells if re.fullmatch(r"[A-F][+-]?", c)]
        if name and found:
            grades[name] = found[-1]
    return grades


def main():
    ap = argparse.ArgumentParser(prog="showpilot voices")
    ap.add_argument("--line", default=LINE)
    ap.add_argument("--voices", default="all", help="all, male, female, or voice ids separated by commas")
    ap.add_argument("--speeds", default=None, help="e.g. 1,0.92")
    ap.add_argument("--energy", type=float, default=1.0)
    opts = ap.parse_args()
    catalog = json.loads((HERE / "candidates.json").read_text(encoding="utf-8"))
    pick = opts.voices
    voices = [v for v in catalog["voices"] if pick == "all" or v["gender"] == pick or v["id"] in pick.split(",")]
    speeds = [float(x) for x in opts.speeds.split(",")] if opts.speeds else catalog["speeds"]
    out = Path(os.environ["SHOWPILOT_PROJECT"]) / "out" / "voices"
    out.mkdir(parents=True, exist_ok=True)

    grades = kokoro_grades()
    engine = Engine()
    print(f"{len(voices)} voices × {len(speeds)} speeds on {engine.device}\n")
    rows = []
    for voice in voices:
        for speed in speeds:
            file = f"{voice['id']}_{str(speed).replace('.', '')}.wav"
            started = time.perf_counter()
            audio = perform(engine, opts.line, voice["mix"], speed, opts.energy)[0]
            took = time.perf_counter() - started
            master(audio, out / file)
            row = {**voice, "variant": "", "note": "", "text": "", "speed": speed, "file": file, "seconds": len(audio) / 24000,
                   "pitch": median_pitch(audio), "grade": "/".join(grades.get(v, "?") for v in voice["mix"])}
            rows.append(row)
            print(f"  {voice['id']:<22} x{speed:<5} {row['seconds']:5.1f}s  ~{row['pitch']:4.0f} Hz  made in {took:4.1f}s")
    shown = re.sub(r"\s+", " ", re.sub(r"\[pause [\d.]+\]|\||\*|</?(slow|fast|up)>", " ", PHONEMES.sub(r"\1", opts.line))).strip()
    (out / "samples.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    (out / "index.html").write_text(page("Showpilot voice audition", shown, rows), encoding="utf-8")
    print(f"\nSamples: {out / 'index.html'}")


def page(title, line, rows) -> str:
    def mix(r):
        return " + ".join(f"{v} {round(w * 100)}%" for v, w in r["mix"].items()) if len(r["mix"]) > 1 else ""

    def card(r):
        meta = " · ".join(filter(None, [r["accent"], mix(r)]))
        note = f'<p class="note">{html.escape(r["note"])}</p>' if r["note"] else ""
        if r.get("text"):
            note += f'<p class="meta"><em>“{html.escape(r["text"])}”</em></p>'
        return f"""<article><header><h2>{html.escape(r['id'])}</h2><span class="speed">×{r['speed']}</span></header>
<p class="meta">{html.escape(meta)}</p>{note}
<audio controls preload="none" src="{r['file']}"></audio>
<dl><div><dt>Median pitch</dt><dd>~{r['pitch']:.0f} Hz</dd></div><div><dt>Kokoro grade</dt><dd>{r['grade']}</dd></div>
<div><dt>Length</dt><dd>{r['seconds']:.1f} s</dd></div></dl></article>"""

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Voice Audition</title><style>
:root{{--bg:#f6f7f9;--card:#fff;--ink:#14181f;--muted:#5b6472;--line:#e3e6eb;--accent:#2563eb}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0e1116;--card:#171b22;--ink:#e8ebf0;--muted:#9aa3b2;--line:#262c36;--accent:#6ea0ff}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}}
main{{max-width:1100px;margin:0 auto;padding:32px 16px}} h1{{margin:0 0 4px;font-size:26px}}
.line{{color:var(--muted);max-width:780px}} .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:24px}}
article{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}}
header{{display:flex;justify-content:space-between;align-items:baseline}} h2{{margin:0;font-size:17px}}
.speed{{color:var(--accent);font-weight:600}} .meta{{margin:2px 0 4px;color:var(--muted);font-size:13px}}
.note{{margin:0 0 10px;font-size:13px;font-weight:600}} audio{{width:100%;margin-top:6px}}
dl{{display:flex;gap:18px;margin:10px 0 0;font-size:13px}} dt{{color:var(--muted)}} dd{{margin:0;font-weight:600}}
</style></head><body><main><h1>{html.escape(title)}</h1>
<p class="line">Every sample reads the same line, mastered the way the final video will be. Lower median pitch generally sounds deeper.
Grades are Kokoro's own ratings from its VOICES.md. ×0.92 is slightly slower, which often sounds more authoritative.</p>
{f'<p class="line"><em>“{html.escape(line)}”</em></p>' if line else ''}<div class="grid">{''.join(card(r) for r in rows)}</div></main></body></html>"""


if __name__ == "__main__":
    main()
