"""Transcribes many narration clips with one model load: run by `showpilot listen <cut>`.

Usage: python listen.py <in.json> <out.json>   in: [{"id", "file"}], out: {"<id>": "what was heard"}
"""
import json
import sys

from faster_whisper import WhisperModel

from transcribe import load


def main():
    clips = json.load(open(sys.argv[1], encoding="utf-8"))
    try:
        import torch

        device, compute = ("cuda", "float16") if torch.cuda.is_available() else ("cpu", "int8")
    except Exception:
        device, compute = "cpu", "int8"
    try:
        whisper = WhisperModel("small.en", device=device, compute_type=compute)
        whisper.transcribe(load(clips[0]["file"]), language="en")
    except Exception:
        device, compute = "cpu", "int8"
        whisper = WhisperModel("small.en", device=device, compute_type=compute)
    heard = {}
    for c in clips:
        segments, _ = whisper.transcribe(load(c["file"]), language="en", beam_size=5)
        heard[c["id"]] = " ".join(s.text.strip() for s in segments)
    json.dump(heard, open(sys.argv[2], "w", encoding="utf-8"), indent=1)
    print(f"Listened to {len(clips)} lines on the {device.upper()}")


if __name__ == "__main__":
    main()
