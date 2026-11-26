"""Load audio as mono float32 at 16 kHz, the rate Whisper expects."""

from __future__ import annotations

import io

import numpy as np
import soundfile as sf

TARGET_SR = 16_000


def load_audio(data: bytes | str) -> np.ndarray:
    """Read WAV/FLAC/OGG bytes or a path; return mono float32 samples at 16 kHz."""
    source = io.BytesIO(data) if isinstance(data, (bytes, bytearray)) else data
    samples, sr = sf.read(source, dtype="float32", always_2d=True)
    mono = samples.mean(axis=1)
    if sr != TARGET_SR:
        mono = resample(mono, sr, TARGET_SR)
    return mono.astype(np.float32)


def resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    """Resample with a windowed-sinc low-pass then linear interpolation.

    Good enough for speech analysis; the browser already sends 16 kHz, so this
    only runs for files dropped in from elsewhere.
    """
    if sr_in == sr_out or len(x) == 0:
        return x
    if sr_out < sr_in:
        cutoff = 0.45 * sr_out / sr_in  # normalised to sr_in
        taps = 101
        n = np.arange(taps) - (taps - 1) / 2
        kernel = 2 * cutoff * np.sinc(2 * cutoff * n) * np.hamming(taps)
        kernel /= kernel.sum()
        x = np.convolve(x, kernel, mode="same")
    duration = len(x) / sr_in
    t_out = np.arange(int(round(duration * sr_out))) / sr_out
    t_in = np.arange(len(x)) / sr_in
    return np.interp(t_out, t_in, x).astype(np.float32)
