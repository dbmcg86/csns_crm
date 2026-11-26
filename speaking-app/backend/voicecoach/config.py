"""Tunable thresholds for the analysis.

These are coaching heuristics, not science. Adjust them to taste once you have
a few of your own recordings to compare against.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Thresholds:
    # Tempo (words per minute, fillers excluded)
    pace_slow_wpm: float = 110
    pace_fast_wpm: float = 175
    rushed_window_wpm: float = 195  # a sliding window this fast gets flagged
    pace_window_s: float = 8.0

    # Rests (gaps between words, seconds)
    pause_min_s: float = 0.25  # shorter gaps are just articulation
    power_pause_s: float = 0.7  # a deliberate pause at a sentence boundary
    hesitation_s: float = 0.6  # a gap this long mid-phrase reads as hesitation

    # Melody (semitones)
    pitch_flat_std: float = 2.0  # below this the voice sounds flat
    pitch_expressive_std: float = 3.5
    monotone_window_s: float = 4.0
    monotone_window_std: float = 1.3
    rising_end_st: float = 2.0  # a statement ending this much higher sounds like a question

    # Dynamics (dB)
    dynamics_narrow_db: float = 8.0
    trail_off_db: float = 6.0

    # Clarity
    unclear_word_prob: float = 0.45  # recogniser confidence below this is flagged
    fillers_per_min_ok: float = 3.0
    fillers_per_min_bad: float = 8.0


DEFAULT = Thresholds()
