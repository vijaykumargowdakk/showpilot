"""Downloads the Kokoro model, the audition voices and the voice notes into HF_HOME (inside SHOWPILOT_HOME)."""
import json
import os
from pathlib import Path

from huggingface_hub import hf_hub_download

REPO = "hexgrad/Kokoro-82M"
CANDIDATES = json.loads((Path(__file__).parent / "candidates.json").read_text(encoding="utf-8"))

assert "SHOWPILOT_HOME" in os.environ, "Run this through `showpilot setup-voice`."

files = ["config.json", "kokoro-v1_0.pth", "VOICES.md"]
voices = {name for c in CANDIDATES["voices"] for name in c["mix"]}
files += [f"voices/{v}.pt" for v in sorted(voices)]
for f in files:
    print("fetched", hf_hub_download(REPO, f))
