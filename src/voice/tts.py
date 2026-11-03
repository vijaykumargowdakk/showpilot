"""Speaks every line of a cut: run by `showpilot voice <cut>` with out/<cut>/voice/manifest.json.

Writes out/<cut>/voice/voice.json: {beat id: {file, duration, captions}}. Audio is cached (manifest "cache", the
project's out/voice-cache) by a hash of the line, the voice settings, the pronunciations and the delivery code, so only
changed lines are spoken again.
"""
import hashlib
import json
import sys
import time
from pathlib import Path

import soundfile as sf

from delivery import captions, perform
from engine import HERE, Engine, master, use_lexicon


def main():
    manifest = Path(sys.argv[1])
    spec = json.loads(manifest.read_text(encoding="utf-8"))
    voice = spec["voice"]
    lexicons = [Path(p) for p in spec["lexicons"]]
    use_lexicon(lexicons)
    code = [HERE / "delivery.py", HERE / "engine.py"]
    fingerprint = hashlib.sha1(b"".join(p.read_bytes() for p in lexicons + code)).hexdigest()
    cache = Path(spec["cache"])
    cache.mkdir(parents=True, exist_ok=True)
    engine, results, made, started = None, {}, 0, time.perf_counter()
    for beat in spec["beats"]:
        key = hashlib.sha1(json.dumps([beat["say"], voice, fingerprint], sort_keys=True).encode()).hexdigest()[:20]
        wav, meta = cache / f"{key}.wav", cache / f"{key}.json"
        if not (wav.exists() and meta.exists()):
            engine = engine or Engine()
            audio, words = perform(engine, beat["say"], voice["mix"], voice["speed"], voice.get("energy", 0.0))
            master(audio, wav)
            meta.write_text(json.dumps({"words": words}), encoding="utf-8")
            made += 1
            print(f"  spoke {beat['id']}: {beat['say'][:70]}")
        words = json.loads(meta.read_text(encoding="utf-8"))["words"]
        results[beat["id"]] = {"file": str(wav), "duration": round(sf.info(wav).duration, 3), "captions": captions(beat["say"], words)}
    (manifest.parent / "voice.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    total = sum(r["duration"] for r in results.values())
    print(f"{len(results)} lines ({made} new, {len(results) - made} cached), {total:.1f} s of narration, in {time.perf_counter() - started:.1f} s")


if __name__ == "__main__":
    main()
