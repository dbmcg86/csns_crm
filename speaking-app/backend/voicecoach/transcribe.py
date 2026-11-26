"""Local speech-to-text with per-word timestamps.

Two interchangeable backends:

* ``mlx``     - mlx-whisper, runs on the Apple Silicon GPU (default on a Mac).
* ``faster``  - faster-whisper (CTranslate2), runs on any CPU.

Pick one with VOICECOACH_ASR=mlx|faster and a model with VOICECOACH_MODEL.
Nothing leaves the machine; models download once from Hugging Face and are
cached.
"""

from __future__ import annotations

import os
import platform
import threading
from dataclasses import asdict, dataclass

import numpy as np

# Whisper is trained on cleaned-up transcripts and tends to delete "um" and
# "uh". Priming it with a disfluent prompt makes it much more likely to keep
# them, which we need for filler counting.
FILLER_PROMPT = "Umm, let me think like, hmm... Okay, here's what I'm, like, thinking. Uh, so, you know."

DEFAULT_MODELS = {
    "mlx": "mlx-community/whisper-large-v3-turbo",
    "faster": "small.en",
}


@dataclass
class Word:
    text: str  # as spoken, with any punctuation Whisper attached
    start: float
    end: float
    prob: float

    def to_dict(self) -> dict:
        return asdict(self)


class Transcriber:
    name = "base"

    def __init__(self, model: str):
        self.model = model

    def transcribe(self, audio: np.ndarray) -> list[Word]:  # pragma: no cover - interface
        raise NotImplementedError

    def warm_up(self) -> None:
        self.transcribe(np.zeros(16_000, dtype=np.float32))


class MlxTranscriber(Transcriber):
    name = "mlx"

    def transcribe(self, audio: np.ndarray) -> list[Word]:
        import mlx_whisper

        result = mlx_whisper.transcribe(
            audio,
            path_or_hf_repo=self.model,
            word_timestamps=True,
            initial_prompt=FILLER_PROMPT,
            condition_on_previous_text=False,
            language="en",
        )
        return [
            Word(w["word"].strip(), float(w["start"]), float(w["end"]), float(w.get("probability", 1.0)))
            for seg in result.get("segments", [])
            for w in seg.get("words", [])
            if w["word"].strip()
        ]


class FasterTranscriber(Transcriber):
    name = "faster"

    def __init__(self, model: str):
        super().__init__(model)
        self._model = None
        self._lock = threading.Lock()

    def _load(self):
        with self._lock:
            if self._model is None:
                from faster_whisper import WhisperModel

                self._model = WhisperModel(self.model, device="cpu", compute_type="int8")
        return self._model

    def transcribe(self, audio: np.ndarray) -> list[Word]:
        model = self._load()
        segments, _info = model.transcribe(
            audio,
            word_timestamps=True,
            initial_prompt=FILLER_PROMPT,
            condition_on_previous_text=False,
            language="en",
            vad_filter=False,  # VAD would cut the pauses we want to measure
        )
        return [
            Word(w.word.strip(), float(w.start), float(w.end), float(w.probability))
            for seg in segments
            for w in (seg.words or [])
            if w.word.strip()
        ]


def _mlx_available() -> bool:
    if platform.system() != "Darwin" or platform.machine() != "arm64":
        return False
    try:
        import mlx_whisper  # noqa: F401
    except ImportError:
        return False
    return True


def make_transcriber() -> Transcriber:
    backend = os.environ.get("VOICECOACH_ASR") or ("mlx" if _mlx_available() else "faster")
    model = os.environ.get("VOICECOACH_MODEL") or DEFAULT_MODELS[backend]
    if backend == "mlx":
        return MlxTranscriber(model)
    if backend == "faster":
        return FasterTranscriber(model)
    raise ValueError(f"Unknown VOICECOACH_ASR backend: {backend!r} (use 'mlx' or 'faster')")
