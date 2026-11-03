"""Natural delivery for Kokoro narration: pauses, emphasis and pace, written as light markup in the script.

    |              a breath (0.22 s)
    ||             a beat (0.55 s)
    [pause 1.2]    a pause of exactly that many seconds
    *words*        emphasis: a tiny lead-in pause, then the words slightly slower and a little louder
    <slow>…</slow> whole sentences read slower (×0.88); <fast>…</fast> quicker (×1.07); <up>…</up> lifted (×1.04)

energy (0–1) livens the whole read: a slightly quicker pace, a small pitch lift (formants kept), shorter
breaths and stronger contrast on emphasised words.

Each block of sentences is synthesised in one piece so Kokoro keeps natural sentence intonation. Pauses are
then cut in at the quietest point between the two words, located with Kokoro's word timestamps. Splitting
a sentence into separately synthesised fragments would make every fragment fall in pitch as if it were ending.
"""
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from engine import SAMPLE_RATE, Engine, spoken

BREATH, BEAT = 0.22, 0.55
EMPHASIS_LEAD = 0.09
PACE = {"slow": 0.88, "fast": 1.07, "up": 1.04}
BLOCK_GAP = 0.12


def style(energy: float) -> dict:
    return {
        "pace": 1 + 0.07 * energy,
        "pitch_semitones": 0.9 * energy,
        "breath": BREATH * (1 - 0.2 * energy),
        "emphasis_tempo": 0.93 - 0.03 * energy,
        "emphasis_gain_db": 1.5 + 2.0 * energy,
    }
FADE = int(0.006 * SAMPLE_RATE)
SPELLED = re.compile(r"\[([^\]]+)\]\(/[^)]*/\)")
MARK = re.compile(r"\[pause ([\d.]+)\]|\|\||\||\*")


def letters(s: str) -> int:
    """Length of s in letters and digits only, reading [word](/phonemes/) as just the word."""
    return len(re.sub(r"[^0-9a-z]", "", SPELLED.sub(r"\1", s).lower()))


def parse(block: str, breath: float = BREATH):
    """Strips markup from a block. Returns (clean text, pauses [(pos, seconds)], emphasis [(pos_from, pos_to)]),
    where positions count letters and digits from the start of the block."""
    clean, pauses, emphasis, opened, last = "", [], [], None, 0
    for m in MARK.finditer(block):
        clean += block[last : m.start()]
        last = m.end()
        pos = letters(clean)
        token = m.group(0)
        if m.group(1):
            pauses.append((pos, float(m.group(1))))
        elif token == "||":
            pauses.append((pos, BEAT))
        elif token == "|":
            pauses.append((pos, breath))
        elif opened is None:
            opened = pos
        else:
            emphasis.append((opened, pos))
            opened = None
    clean += block[last:]
    return re.sub(r"\s+", " ", clean).strip(), pauses, emphasis


def quietest(audio: np.ndarray, start: float, end: float) -> int:
    """Sample index of the quietest 10 ms window between two times (seconds)."""
    a, b = int(start * SAMPLE_RATE), int(end * SAMPLE_RATE)
    if b - a < 480:
        return (a + b) // 2
    win = 240
    energy = np.convolve(audio[a:b] ** 2, np.ones(win), "valid")
    return a + int(np.argmin(energy)) + win // 2


def _has_rubberband() -> bool:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-h", "filter=rubberband"], capture_output=True, text=True)
    if "Filter rubberband" in r.stdout:
        return True
    print("ffmpeg has no Rubber Band filter: emphasis and the energy lift are left out (a full ffmpeg build adds them).")
    return False


HAS_RUBBERBAND = _has_rubberband()


def rubberband(audio: np.ndarray, tempo: float = 1.0, pitch: float = 1.0) -> np.ndarray:
    """Time-stretches and/or pitch-shifts with formants preserved (ffmpeg's Rubber Band filter).
    Without the filter the audio is returned as it is: plainer, but the timing and words are unchanged."""
    if not HAS_RUBBERBAND:
        return audio
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp, "in.wav"), Path(tmp, "out.wav")
        sf.write(src, audio, SAMPLE_RATE)
        af = f"rubberband=tempo={tempo}:pitch={pitch}:formant=preserved:pitchq=quality"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", af, str(dst)], check=True)
        return sf.read(dst, dtype="float32")[0]


def faded(piece: np.ndarray) -> np.ndarray:
    piece = piece.copy()
    n = min(FADE, len(piece) // 2)
    if n:
        ramp = np.linspace(0, 1, n, dtype=np.float32)
        piece[:n] *= ramp
        piece[-n:] *= ramp[::-1]
    return piece


def perform_block(engine: Engine, block: str, mix: dict, speed: float, look: dict):
    clean, pauses, emphasis = parse(block, look["breath"])
    audio, tokens, _ = engine.say(clean, mix, speed, lexicon=False)

    # Letter positions of each timed token, to find the word a marker sits after.
    spans, pos = [], 0
    for t in tokens:
        n = letters(t["w"])
        if n:
            spans.append((pos, pos + n, t))
            pos += n
    total = letters(clean)
    if pos != total:
        print(f"    note: word timings cover {pos} of {total} letters; markers placed approximately")
        scale = pos / total if total else 1
        pauses = [(p * scale, s) for p, s in pauses]
        emphasis = [(a * scale, b * scale) for a, b in emphasis]

    def cut_after(p: float) -> int:
        """Sample index of the gap after the word that ends at letter position p."""
        before = [s for s in spans if s[1] <= p + 0.5]
        after = [s for s in spans if s[0] >= p - 0.5]
        if not before:
            return 0
        if not after:
            return len(audio)
        return quietest(audio, before[-1][2]["end"] - 0.02, after[0][2]["start"] + 0.02)

    # Cut points: (sample, pause seconds, emphasis starts here?, emphasis ends here?)
    cuts = {}
    for p, seconds in pauses:
        cuts.setdefault(cut_after(p), [0.0, False, False])[0] += seconds
    for a, b in emphasis:
        start = cut_after(a)
        cuts.setdefault(start, [0.0, False, False])[1] = True
        cuts[start][0] = max(cuts[start][0], EMPHASIS_LEAD)
        cuts.setdefault(cut_after(b), [0.0, False, False])[2] = True

    # Rebuild: audio pieces between cuts, with silence inserted and emphasised pieces stretched.
    out, timeline, cursor, emphatic = [], [], 0, False  # timeline: (source sample, output sample, tempo)
    out_len = 0
    for at in sorted(cuts) + [len(audio)]:
        piece = audio[cursor:at]
        tempo = look["emphasis_tempo"] if emphatic else 1.0
        if len(piece):
            if emphatic:
                piece = rubberband(piece, tempo=tempo) * 10 ** (look["emphasis_gain_db"] / 20)
            timeline.append((cursor, out_len, tempo))
            out.append(faded(piece))
            out_len += len(piece)
        if at in cuts:
            gap, starts, ends = cuts[at]
            if gap:
                out.append(np.zeros(int(gap * SAMPLE_RATE), dtype=np.float32))
                out_len += int(gap * SAMPLE_RATE)
            emphatic = (emphatic and not ends) or starts
        cursor = at

    def remap(t: float) -> float:
        s = t * SAMPLE_RATE
        for src, dst, tempo in reversed(timeline):
            if s >= src:
                return round((dst + (s - src) / tempo) / SAMPLE_RATE, 3)
        return t

    words = [{"w": t["w"], "start": remap(t["start"]), "end": remap(t["end"])} for t in tokens]
    return np.concatenate(out) if out else audio, words


def perform(engine: Engine, script: str, mix: dict, speed: float, energy: float = 0.0):
    """Speaks a marked-up script. Returns (audio float32 @24 kHz, words with timings)."""
    look = style(energy)
    speed *= look["pace"]
    text = spoken(script)
    blocks, last = [], 0
    for m in re.finditer(r"<(slow|fast|up)>(.*?)</\1>", text, re.S):
        blocks.append((1.0, text[last : m.start()]))
        blocks.append((PACE[m.group(1)], m.group(2)))
        last = m.end()
    blocks.append((1.0, text[last:]))

    pieces, words, offset = [], [], 0.0
    for pace, block in blocks:
        if not re.search(r"\w", block):
            pause = sum(float(p) for p in re.findall(r"\[pause ([\d.]+)\]", block)) + BEAT * block.count("||")
            if pause:
                pieces.append(np.zeros(int(pause * SAMPLE_RATE), dtype=np.float32))
                offset += pause
            continue
        if pieces:
            pieces.append(np.zeros(int(BLOCK_GAP * SAMPLE_RATE), dtype=np.float32))
            offset += BLOCK_GAP
        audio, said = perform_block(engine, block, mix, speed * pace, look)
        words += [{**w, "start": round(w["start"] + offset, 3), "end": round(w["end"] + offset, 3)} for w in said]
        pieces.append(audio)
        offset += len(audio) / SAMPLE_RATE
    audio = np.concatenate(pieces)
    if look["pitch_semitones"]:
        audio = rubberband(audio, pitch=2 ** (look["pitch_semitones"] / 12))[: len(audio)]
    return audio + room_tone(len(audio)), words


def room_tone(n: int, dbfs: float = -66.0) -> np.ndarray:
    """Very faint pink noise under the narration, so pauses never drop to dead digital silence."""
    rng = np.random.default_rng(7)
    spectrum = np.fft.rfft(rng.standard_normal(n))
    spectrum /= np.sqrt(np.maximum(np.arange(len(spectrum)), 1))
    noise = np.fft.irfft(spectrum, n).astype(np.float32)
    return noise / (np.sqrt(np.mean(noise**2)) + 1e-12) * 10 ** (dbfs / 20)


BREAK = re.compile(r"\[pause [\d.]+\]|\|\|?")
SENTENCE_END = re.compile(r"[.!?…]['\"”’)]*$")


def captions(script: str, said: list) -> list:
    """Written words of a script with times taken from the spoken words, and where caption phrases break.
    Returns [{w, start, end, brk}]; brk marks the last word of a phrase (at a pause or a sentence end)."""
    text = re.sub(r"</?(slow|fast|up)>", " ", script)
    words, breaks = [], set()
    for part in re.split(f"({BREAK.pattern})", text):
        if BREAK.fullmatch(part or ""):
            if words:
                breaks.add(len(words) - 1)
            continue
        for w in (part or "").split():
            w = SPELLED.sub(r"\1", w).replace("*", "")
            if w:
                words.append(w)
                if SENTENCE_END.search(w):
                    breaks.add(len(words) - 1)

    spans, pos = [], 0
    for t in said:
        n = letters(t["w"])
        if n:
            spans.append((pos, pos + n, t["start"], t["end"]))
            pos += n
    if not spans:
        return []
    out, start_pos, last_end = [], 0, 0.0
    for i, w in enumerate(words):
        end_pos = max(start_pos, letters(spoken(" ".join(words[: i + 1]))))
        first = next((s for s in spans if s[1] > start_pos), spans[-1])
        last = next((s for s in reversed(spans) if s[0] < end_pos), first)
        start = max(last_end, first[2])
        end = max(start, last[3])
        out.append({"w": w, "start": round(start, 3), "end": round(end, 3), "brk": i in breaks})
        start_pos, last_end = end_pos, end
    return out
