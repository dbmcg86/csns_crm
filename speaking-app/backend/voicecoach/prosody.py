"""Pitch and loudness tracks via Praat (parselmouth)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import parselmouth

from .audio import TARGET_SR

FRAME_S = 0.01


@dataclass
class Prosody:
    times: np.ndarray  # seconds, one per frame
    f0: np.ndarray  # Hz, NaN where unvoiced
    db: np.ndarray  # intensity in dB, same frames

    @property
    def voiced(self) -> np.ndarray:
        return ~np.isnan(self.f0)

    def median_f0(self) -> float:
        v = self.f0[self.voiced]
        return float(np.median(v)) if len(v) else float("nan")

    def semitones(self, ref_hz: float | None = None) -> np.ndarray:
        """Pitch in semitones relative to ``ref_hz`` (default: speaker median)."""
        ref = ref_hz or self.median_f0()
        with np.errstate(invalid="ignore", divide="ignore"):
            return 12 * np.log2(self.f0 / ref)

    def window(self, start: float, end: float) -> slice:
        i0 = int(np.searchsorted(self.times, start))
        i1 = int(np.searchsorted(self.times, end))
        return slice(i0, i1)


def analyse_prosody(audio: np.ndarray, sr: int = TARGET_SR) -> Prosody:
    snd = parselmouth.Sound(audio.astype(np.float64), sampling_frequency=sr)
    duration = snd.get_total_duration()
    times = np.arange(0, duration, FRAME_S)

    # A wide pitch range covers most adult voices; octave jumps are cleaned below.
    pitch = snd.to_pitch_ac(time_step=FRAME_S, pitch_floor=65.0, pitch_ceiling=550.0)
    f0_raw = pitch.selected_array["frequency"]
    f0_times = pitch.xs()
    f0_raw = np.where(f0_raw > 0, f0_raw, np.nan)
    f0 = _nearest(times, f0_times, f0_raw)  # no interpolation across voiced/unvoiced edges
    f0 = _remove_octave_errors(f0)

    if duration > 0.07:
        intensity = snd.to_intensity(minimum_pitch=65.0, time_step=FRAME_S)
        db = np.interp(times, intensity.xs(), intensity.values[0], left=np.nan, right=np.nan)
    else:
        db = np.full_like(times, np.nan)

    return Prosody(times=times, f0=f0, db=db)


def _nearest(times: np.ndarray, src_times: np.ndarray, values: np.ndarray) -> np.ndarray:
    out = np.full(len(times), np.nan)
    if len(src_times) == 0:
        return out
    idx = np.clip(np.searchsorted(src_times, times), 1, len(src_times) - 1)
    left_closer = (times - src_times[idx - 1]) < (src_times[idx] - times)
    idx = np.where(left_closer, idx - 1, idx)
    inside = (times >= src_times[0] - FRAME_S) & (times <= src_times[-1] + FRAME_S)
    out[inside] = values[idx[inside]]
    return out


def _remove_octave_errors(f0: np.ndarray) -> np.ndarray:
    """Drop frames more than ~an octave away from the local median (tracker glitches)."""
    out = f0.copy()
    voiced = ~np.isnan(f0)
    if voiced.sum() < 10:
        return out
    med = np.nanmedian(f0)
    with np.errstate(invalid="ignore"):
        st = 12 * np.log2(f0 / med)
    out[np.abs(st) > 14] = np.nan
    return out
