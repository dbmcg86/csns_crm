import numpy as np
import pytest

from voicecoach.analysis import analyse, classify_words, split_sentences, _match_script
from voicecoach.prosody import Prosody, analyse_prosody
from voicecoach.transcribe import Word


def words_from(text: str, start: float = 0.0, wps: float = 2.5, gaps: dict[int, float] | None = None, probs=None):
    """Build evenly spaced Word objects; ``gaps`` adds silence after word index i."""
    out, t = [], start
    for i, tok in enumerate(text.split()):
        dur = 1 / wps * 0.8
        out.append(Word(tok, t, t + dur, (probs or {}).get(i, 0.95)))
        t += 1 / wps + (gaps or {}).get(i, 0.0)
    return out


def flat_prosody(duration: float, hz: float = 120.0, db: float = 65.0, wobble_st: float = 0.0) -> Prosody:
    times = np.arange(0, duration, 0.01)
    st = wobble_st * np.sin(2 * np.pi * times / 1.7)
    f0 = hz * 2 ** (st / 12)
    return Prosody(times=times, f0=f0, db=np.full_like(times, db))


def kinds(r):
    return {n["kind"] for n in r["notes"]}


def test_fillers_and_soft_fillers():
    ws = words_from("So, um, it was, like, really uh good, you know, honestly.")
    k = classify_words(ws)
    assert k[1] == "filler" and k[6] == "filler"
    assert k[4] == "soft"  # set-off "like"
    assert k[8] == k[9] == "soft"  # "you know,"
    assert k[10] == "soft"


def test_like_as_a_verb_is_not_a_filler():
    ws = words_from("I like this plan a lot.")
    assert classify_words(ws)[1] == "word"


def test_sentences_split_on_punctuation_and_long_gaps():
    ws = words_from("One two. Three four five six", gaps={3: 1.5})
    assert split_sentences(ws) == [(0, 1), (2, 3), (4, 5)]


def test_pace_counts_without_fillers():
    text = " ".join(["word"] * 59 + ["end."])
    ws = words_from(text, wps=2.5)  # 150 wpm
    r = analyse(ws, flat_prosody(ws[-1].end + 0.5, wobble_st=3), ws[-1].end + 0.5)
    assert r["pace"]["wpm"] == pytest.approx(150, rel=0.05)
    assert r["dimensions"][0]["status"] == "strong"


def test_fast_speech_is_flagged_as_rushed():
    ws = words_from(" ".join(["fast"] * 80) + ".", wps=4)  # 240 wpm
    r = analyse(ws, flat_prosody(ws[-1].end + 0.5, wobble_st=3), ws[-1].end + 0.5)
    assert r["dimensions"][0]["status"] == "work"
    assert "rushed" in kinds(r)


def test_power_pause_and_hesitation():
    ws = words_from("This is the point. Now the next part of the story goes here.", gaps={3: 1.0, 7: 0.9})
    r = analyse(ws, flat_prosody(ws[-1].end + 0.5, wobble_st=3), ws[-1].end + 0.5)
    kinds_by_after = {p["after"]: p["kind"] for p in r["rests"]["pauses"]}
    assert kinds_by_after[3] == "power"
    assert kinds_by_after[7] == "hesitation"
    assert r["rests"]["power"] == 1


def test_monotone_vs_expressive():
    ws = words_from(" ".join(["la"] * 40) + ".")
    dur = ws[-1].end + 0.5
    flat = analyse(ws, flat_prosody(dur, wobble_st=0.2), dur)
    lively = analyse(ws, flat_prosody(dur, wobble_st=7), dur)
    assert flat["melody"]["std_st"] < 1 and flat["dimensions"][2]["status"] == "work"
    assert "monotone" in kinds(flat)
    assert lively["melody"]["std_st"] > 3.5 and lively["dimensions"][2]["status"] == "strong"


def test_trail_off_detected():
    ws = words_from("We need to finish every sentence with real energy at the end.")
    dur = ws[-1].end + 0.3
    pr = flat_prosody(dur, wobble_st=3)
    pr.db[pr.times > ws[-1].end - 1.2] = 50  # 15 dB drop at the end
    r = analyse(ws, pr, dur)
    assert r["dynamics"]["trail_offs"] == 1
    assert "trail_off" in kinds(r)


def test_uptalk_on_statement():
    ws = words_from("This is a plain statement of fact.")
    dur = ws[-1].end + 0.3
    pr = flat_prosody(dur, wobble_st=0.5)
    tail = pr.times > ws[-1].end - 0.35
    pr.f0[tail] = 120 * 2 ** (5 / 12)
    r = analyse(ws, pr, dur)
    assert r["sentences"][0]["ending"] == "rise"
    assert "uptalk" in kinds(r)


def test_script_matching_finds_swaps_and_misses():
    m = _match_script("the quick brown fox jumps over the lazy dog", "the quick brawn fox over the lazy dog".split())
    assert m["missed"] == ["jumps"]
    assert m["swapped"][0]["expected"] == "brown" and m["swapped"][0]["heard"] == "brawn"
    assert m["accuracy"] == pytest.approx(7 / 9, rel=1e-3)


def test_unclear_words_and_script_swap_notes():
    ws = words_from("Please pause here.", probs={1: 0.2})
    ws[1].text = "paws"
    r = analyse(ws, flat_prosody(ws[-1].end + 0.3, wobble_st=3), ws[-1].end + 0.3, script="Please pause here.")
    assert r["clarity"]["unclear_words"] == 1
    assert "swapped" in kinds(r) and "unclear" in kinds(r)


def test_no_words_raises():
    with pytest.raises(ValueError):
        analyse([], flat_prosody(2), 2)


def test_contour_serialises_unvoiced_as_null():
    pr = flat_prosody(1.0)
    pr.f0[:10] = np.nan
    ws = words_from("hello there.")
    r = analyse(ws, pr, 1.0)
    assert r["contour"]["pitch_st"][0] is None
    assert isinstance(r["contour"]["pitch_st"][-1], float)


def test_praat_tracks_a_real_glide():
    sr = 16_000
    t = np.arange(0, 2.0, 1 / sr)
    f = 110 * 2 ** (12 * t / 2.0 / 12)  # one octave glide up
    phase = 2 * np.pi * np.cumsum(f) / sr
    audio = (0.3 * np.sin(phase) + 0.1 * np.sin(2 * phase)).astype(np.float32)
    pr = analyse_prosody(audio, sr)
    st = pr.semitones(110)
    voiced = ~np.isnan(st)
    assert voiced.mean() > 0.8
    assert np.nanmax(st) - np.nanmin(st) == pytest.approx(12, abs=1.5)


def test_rushed_stretch_is_one_note():
    ws = words_from(" ".join(["fast"] * 120) + ".", wps=4)
    r = analyse(ws, flat_prosody(ws[-1].end + 0.5, wobble_st=3), ws[-1].end + 0.5)
    assert sum(n["kind"] == "rushed" for n in r["notes"]) == 1


def test_praat_track_has_no_dips_at_voicing_edges():
    sr = 16_000
    t = np.arange(0, 1.0, 1 / sr)
    tone = (0.3 * np.sin(2 * np.pi * 150 * t)).astype(np.float32)
    audio = np.concatenate([tone, np.zeros(sr // 2, np.float32), tone])
    st = analyse_prosody(audio, sr).semitones(150)
    v = st[~np.isnan(st)]
    assert np.abs(v).max() < 1.0
