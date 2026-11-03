"""Transcribes a recording on this computer with faster-whisper (nothing is sent anywhere).

Usage (run by `showpilot dictate` and `showpilot align`): python transcribe.py <audio> <out.json> [model] [language]
Writes {"words": [{"w", "start", "end"}], "text": "..."}. Uses the NVIDIA GPU when it can, otherwise the CPU.
Install with `showpilot setup-voice --dictation`; the model downloads into SHOWPILOT_HOME on first use.
"""
import json
import os
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

assert "SHOWPILOT_HOME" in os.environ, "Run this through the showpilot command."


def load(path: str) -> np.ndarray:
    """The recording as 16 kHz mono floats, decoded by ffmpeg (faster-whisper's own decoder, PyAV, changes its API often)."""
    raw = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def transcribe(audio: np.ndarray, model: str, language):
    try:
        import torch

        tries = [("cuda", "float16"), ("cpu", "int8")] if torch.cuda.is_available() else [("cpu", "int8")]
    except Exception:
        tries = [("cpu", "int8")]
    for device, compute in tries:
        try:
            whisper = WhisperModel(model, device=device, compute_type=compute)
            segments, _ = whisper.transcribe(audio, word_timestamps=True, vad_filter=True, language=language)
            words = [{"w": w.word, "start": round(w.start, 3), "end": round(w.end, 3)} for s in segments for w in (s.words or [])]
            print(f"Transcribed on the {device.upper()}: {len(words)} words")
            return words
        except Exception as e:  # e.g. CUDA libraries that ctranslate2 can't find: the CPU still works
            print(f"Could not transcribe on the {device.upper()}: {e}")
    raise SystemExit("Transcription failed.")


def main():
    audio, out = sys.argv[1], sys.argv[2]
    model = sys.argv[3] if len(sys.argv) > 3 else "small.en"
    language = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else ("en" if model.endswith(".en") else None)
    words = transcribe(load(audio), model, language)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"words": words, "text": "".join(w["w"] for w in words).strip()}, f, indent=1)


if __name__ == "__main__":
    main()
