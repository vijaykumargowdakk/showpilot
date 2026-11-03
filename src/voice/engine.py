"""Kokoro: voice blending, pronunciation, synthesis and mastering. Shared by audition.py and tts.py.

Runs on an NVIDIA GPU (CUDA) when there is one, on Apple Silicon (MPS), or on the CPU, which is slower but works anywhere.
"""
import json
import os
import re
import subprocess
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from kokoro import KPipeline

REPO = "hexgrad/Kokoro-82M"
SAMPLE_RATE = 24000
HERE = Path(__file__).parent

# Broadcast chain: cut rumble, a little low-end warmth, presence at 3 kHz for a forward, confident voice,
# light compression, -16 LUFS.
MASTER = "highpass=f=70,bass=g=2.5:f=140:w=0.7,equalizer=f=3200:t=q:w=1.2:g=2,acompressor=threshold=-18dB:ratio=2.5:attack=10:release=120,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000"

if "SHOWPILOT_HOME" not in os.environ:
    raise SystemExit("Run this through the showpilot command, which keeps the model and caches in SHOWPILOT_HOME.")


def load_lexicon(paths) -> list:
    """Written → spoken pairs from each file in turn (later files win), longest written form first."""
    entries = {}
    for path in paths:
        entries.update(json.loads(Path(path).read_text(encoding="utf-8")))
    entries.pop("_note", None)
    return sorted(entries.items(), key=lambda kv: -len(kv[0]))


LEXICON = load_lexicon([HERE / "lexicon.json"])


def use_lexicon(paths) -> None:
    """Replaces the pronunciations used by spoken(), e.g. with the built-in list plus a project's own."""
    LEXICON[:] = load_lexicon(paths)


def spoken(text: str) -> str:
    """The text as Kokoro should say it. Already-spelled [word](/…/) spans are left alone."""
    for written, said in LEXICON:
        text = re.sub(rf"(?<![\w\[/]){re.escape(written)}(?![\w\]])", lambda _: said, text)
    return text


def best_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class Engine:
    def __init__(self):
        self.device = best_device()
        if self.device == "cpu":
            print("No GPU found: speaking on the CPU, which takes a few times longer.")
        self.pipelines = {}

    def pipeline(self, lang: str) -> KPipeline:
        if lang not in self.pipelines:
            self.pipelines[lang] = KPipeline(lang_code=lang, repo_id=REPO, device=self.device)
        return self.pipelines[lang]

    def voice(self, mix: dict) -> tuple:
        """Returns (lang_code, voice tensor) for a weighted mix such as {"am_michael": 0.6, "am_fenrir": 0.4}."""
        british = sum(w for v, w in mix.items() if v.startswith("b")) > 0.5
        pipe = self.pipeline("b" if british else "a")
        total = sum(mix.values())
        tensor = sum(pipe.load_voice(name) * (weight / total) for name, weight in mix.items())
        return ("b" if british else "a"), tensor

    def say(self, text: str, mix: dict, speed: float = 1.0, lexicon: bool = True):
        """Synthesises text. Returns (audio float32 @24 kHz, words [{w,start,end}], seconds taken).
        Pass lexicon=False when the text has already been through spoken()."""
        lang, tensor = self.voice(mix)
        pipe = self.pipeline(lang)
        started = time.perf_counter()
        chunks, words, offset = [], [], 0.0
        for result in pipe(spoken(text) if lexicon else text, voice=tensor, speed=speed, split_pattern=r"\n+"):
            audio = result.audio.cpu().numpy() if hasattr(result.audio, "cpu") else np.asarray(result.audio)
            for token in getattr(result, "tokens", None) or []:
                if token.start_ts is not None and token.end_ts is not None and token.text.strip():
                    words.append({"w": token.text, "start": round(offset + token.start_ts, 3), "end": round(offset + token.end_ts, 3)})
            chunks.append(audio)
            offset += len(audio) / SAMPLE_RATE
        if self.device == "cuda":
            torch.cuda.synchronize()
        return np.concatenate(chunks), words, time.perf_counter() - started


def master(audio: np.ndarray, out: Path) -> None:
    """Writes the mastered 48 kHz WAV next to a raw copy (the raw one is deleted afterwards)."""
    raw = out.with_suffix(".raw.wav")
    sf.write(raw, audio, SAMPLE_RATE)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", MASTER, "-c:a", "pcm_s16le", str(out)], check=True)
    raw.unlink()


def median_pitch(audio: np.ndarray) -> float:
    """Approximate median speaking pitch in Hz (frame autocorrelation over voiced frames). Lower sounds deeper."""
    frame, hop = 1024, 512
    lo, hi = SAMPLE_RATE // 300, SAMPLE_RATE // 60
    rms_floor = 0.25 * np.sqrt(np.mean(audio**2))
    pitches = []
    for start in range(0, len(audio) - frame, hop):
        x = audio[start : start + frame]
        if np.sqrt(np.mean(x**2)) < rms_floor:
            continue
        x = x - x.mean()
        ac = np.correlate(x, x, "full")[frame - 1 :]
        if ac[0] <= 0:
            continue
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] / ac[0] > 0.5:
            pitches.append(SAMPLE_RATE / lag)
    return float(np.median(pitches)) if pitches else 0.0
