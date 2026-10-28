"""Podcast audio: read a generated podcast script aloud with text-to-speech.

Uses Kokoro, a small open text-to-speech model that runs locally on the CPU,
so audio is free and the script never leaves the computer. Each speaker
(HOST A, HOST B, ...) gets their own voice.
"""

import io
import os
import re
import threading
import wave

import numpy as np

from config import TTS_DIR

MODEL_PATH = os.path.join(TTS_DIR, "kokoro-v1.0.int8.onnx")
VOICES_PATH = os.path.join(TTS_DIR, "voices-v1.0.bin")
# British English voices, given to speakers in the order they first speak
VOICES = ["bf_emma", "bm_george", "bf_isabella", "bm_lewis"]
LANGUAGE = "en-gb"
PAUSE_SECONDS = 0.4  # silence between speakers

_kokoro = None
_load_lock = threading.Lock()


def _model():
    """Load the model once, on first use (about half a second)."""
    global _kokoro
    with _load_lock:
        if _kokoro is None:
            if not (os.path.exists(MODEL_PATH) and os.path.exists(VOICES_PATH)):
                raise FileNotFoundError(
                    "The text-to-speech model isn't installed. See 'Podcast audio' in the README."
                )
            from kokoro_onnx import Kokoro
            _kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
    return _kokoro


# "HOST A: Hello", "**HOST A:** Hello", "- **Host B**: Hi" -> (speaker, text)
_SPEAKER_LINE = re.compile(
    r"^[\s>*-]*\**\s*([A-Z][A-Za-z0-9.'’ -]{0,24}?)\s*\**\s*:\s*\**\s*(.*)$"
)


def _speakable(text):
    """Remove what shouldn't be read out: stage directions and Markdown symbols."""
    text = re.sub(r"\[[^\]]*\]|\([^)]*\)", " ", text)  # [Intro music], (laughs)
    text = re.sub(r"[*_`#|]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _script_text(material):
    """The body of the "Script" section, or the whole material if there is none."""
    match = re.search(r"^## [^\n]*script[^\n]*\n(.*?)(?=^## |\Z)", material, re.I | re.M | re.S)
    return match.group(1) if match else material


def parse_script(material):
    """Return [(speaker, text)] for each spoken turn in the material's script.

    Lines without a speaker label continue the previous speaker's turn.
    """
    turns = []
    for line in _script_text(material).split("\n"):
        match = _SPEAKER_LINE.match(line)
        if match and len(match.group(1).split()) <= 3:
            speaker, text = match.group(1).strip().upper(), match.group(2)
            turns.append([speaker, _speakable(text)])
        elif turns and line.strip():
            turns[-1][1] = f"{turns[-1][1]} {_speakable(line)}".strip()
    return [(speaker, text) for speaker, text in turns if text]


def synthesise(material):
    """Read the material's script aloud. Returns (WAV bytes, speakers in order)."""
    turns = parse_script(material)
    if not turns:
        raise ValueError(
            "No spoken lines found. Each line of the Script section should start "
            "with a speaker label, e.g. 'HOST A:'."
        )

    kokoro = _model()
    voices, parts, rate = {}, [], 24000
    for speaker, text in turns:
        voice = voices.setdefault(speaker, VOICES[len(voices) % len(VOICES)])
        samples, rate = kokoro.create(text, voice=voice, speed=1.0, lang=LANGUAGE)
        parts += [samples, np.zeros(int(rate * PAUSE_SECONDS), dtype=np.float32)]

    audio = np.concatenate(parts)
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(pcm.tobytes())
    return buffer.getvalue(), list(voices)
