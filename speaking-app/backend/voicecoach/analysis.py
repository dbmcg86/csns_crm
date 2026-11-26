"""Turn words + prosody into coaching metrics.

Everything here is pure computation on plain data, so it is easy to test
without a speech model.
"""

from __future__ import annotations

import difflib
import math
import re
from dataclasses import dataclass, field

import numpy as np

from .config import DEFAULT, Thresholds
from .prosody import Prosody
from .transcribe import Word

HARD_FILLER = re.compile(r"^(u+[hm]+|e+r+m*|a+h+|h+m+|m+h*m+|uh+m+)$")
SOFT_SINGLE = {"basically", "literally", "actually", "totally", "honestly"}
SOFT_PHRASES = [("you", "know"), ("i", "mean"), ("sort", "of"), ("kind", "of")]
SENTENCE_END = re.compile(r"[.!?…]+[\"')\]]*$")
CLAUSE_END = re.compile(r"[,;:—–-]+[\"')\]]*$")


def norm(token: str) -> str:
    return re.sub(r"[^a-z0-9']", "", token.lower().replace("’", "'"))


class Status:
    STRONG = "strong"
    OK = "ok"
    WORK = "work"


@dataclass
class Note:
    t: float
    kind: str
    text: str
    tone: str  # "good" or "watch"
    end: float | None = None

    def to_dict(self) -> dict:
        d = {"t": round(self.t, 2), "kind": self.kind, "text": self.text, "tone": self.tone}
        if self.end is not None:
            d["end"] = round(self.end, 2)
        return d


@dataclass
class _Ctx:
    words: list[Word]
    prosody: Prosody
    th: Thresholds
    script: str | None
    kinds: list[str] = field(default_factory=list)
    notes: list[Note] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# Classification
# --------------------------------------------------------------------------- #


def classify_words(words: list[Word]) -> list[str]:
    """Label each word as 'word', 'filler' (um/uh) or 'soft' (like, you know...)."""
    toks = [norm(w.text) for w in words]
    kinds = ["word"] * len(words)
    for i, tok in enumerate(toks):
        if not tok:
            continue
        if HARD_FILLER.match(tok):
            kinds[i] = "filler"
        elif tok in SOFT_SINGLE:
            kinds[i] = "soft"
        elif tok == "like":
            # "like" is only a filler when it is set off: "was, like, huge" / "um like"
            prev_comma = i > 0 and CLAUSE_END.search(words[i - 1].text)
            own_comma = CLAUSE_END.search(words[i].text)
            prev_filler = i > 0 and kinds[i - 1] == "filler"
            if (prev_comma and own_comma) or prev_filler or (i == 0 and own_comma):
                kinds[i] = "soft"
    for a, b in SOFT_PHRASES:
        for i in range(len(toks) - 1):
            if toks[i] == a and toks[i + 1] == b and kinds[i] == kinds[i + 1] == "word":
                # Only when set off by punctuation or pauses: "it's, you know, hard"
                set_off = CLAUSE_END.search(words[i + 1].text) or (i > 0 and CLAUSE_END.search(words[i - 1].text))
                if set_off:
                    kinds[i] = kinds[i + 1] = "soft"
    return kinds


def split_sentences(words: list[Word], long_gap_s: float = 1.2) -> list[tuple[int, int]]:
    """Return (first, last) word indices for each sentence."""
    out, start = [], 0
    for i, w in enumerate(words):
        last = i == len(words) - 1
        gap = (words[i + 1].start - w.end) if not last else 0
        if last or SENTENCE_END.search(w.text) or gap >= long_gap_s:
            out.append((start, i))
            start = i + 1
    return out


# --------------------------------------------------------------------------- #
# Dimensions
# --------------------------------------------------------------------------- #


def _pace(ctx: _Ctx, content_idx: list[int], speech_start: float, speech_end: float) -> dict:
    th, words = ctx.th, ctx.words
    span = max(speech_end - speech_start, 1e-6)
    n = len(content_idx)
    wpm = n * 60 / span

    gaps = sum(
        max(0.0, words[i + 1].start - words[i].end)
        for i in range(len(words) - 1)
        if words[i + 1].start - words[i].end >= th.pause_min_s
    )
    articulation = n * 60 / max(span - gaps, 1e-6)

    mids = np.array([(words[i].start + words[i].end) / 2 for i in content_idx])
    w = th.pace_window_s
    series = []
    if span <= w:
        series.append({"t": round((speech_start + speech_end) / 2, 2), "wpm": round(wpm, 1)})
    else:
        for c in np.arange(speech_start + w / 2, speech_end - w / 2 + 1e-9, 1.0):
            count = int(((mids >= c - w / 2) & (mids < c + w / 2)).sum())
            series.append({"t": round(float(c), 2), "wpm": round(count * 60 / w, 1)})

    # Merge rushed windows (bridging dips shorter than 3 s) into one note per stretch.
    runs: list[list[float]] = []
    for pt in series:
        if pt["wpm"] < th.rushed_window_wpm:
            continue
        if runs and pt["t"] - runs[-1][1] <= 3.0:
            runs[-1][1], runs[-1][2] = pt["t"], max(runs[-1][2], pt["wpm"])
        else:
            runs.append([pt["t"], pt["t"], pt["wpm"]])
    for a, b, peak in runs:
        ctx.notes.append(Note(max(speech_start, a - w / 2), "rushed", f"Rushing here (up to ~{peak:.0f} wpm). Let it breathe.",
                              "watch", end=min(speech_end, b + w / 2)))

    if wpm < th.pace_slow_wpm:
        status, headline = Status.WORK, "On the slow side"
        tip = "Slow is safer than fast, but pick up the connecting phrases so the key lines can stay slow."
    elif wpm > th.pace_fast_wpm:
        status, headline = Status.WORK, "Running fast"
        tip = "Aim for 140-160 wpm. Slow down most on the sentences that carry your point."
    else:
        status, headline = Status.STRONG, "Comfortable listening pace"
        tip = "Good tempo. Next step: vary it on purpose, faster for the story, slower for the point."
    if status == Status.STRONG and any(n.kind == "rushed" for n in ctx.notes):
        status, headline = Status.OK, "Good overall, with some rushed stretches"

    values = [p["wpm"] for p in series]
    variation = float(np.std(values)) if len(values) > 1 else 0.0
    return {
        "wpm": round(wpm, 1),
        "articulation_wpm": round(articulation, 1),
        "variation_wpm": round(variation, 1),
        "series": series,
        "dimension": dict(key="tempo", label="Tempo", analogy="Pace", value=round(wpm), unit="wpm",
                          status=status, headline=headline, tip=tip),
    }


def _rests(ctx: _Ctx, sentences: list[tuple[int, int]], duration_min: float) -> dict:
    th, words = ctx.th, ctx.words
    sentence_ends = {last for _, last in sentences}
    pauses = []
    for i in range(len(words) - 1):
        gap = words[i + 1].start - words[i].end
        if gap < th.pause_min_s:
            continue
        if i in sentence_ends:
            kind = "power" if gap >= th.power_pause_s else "sentence"
        elif CLAUSE_END.search(words[i].text):
            kind = "phrase"
        elif gap >= th.hesitation_s or ctx.kinds[i] == "filler" or ctx.kinds[i + 1] == "filler":
            kind = "hesitation"
        else:
            kind = "short"
        pauses.append({"start": round(words[i].end, 2), "end": round(words[i + 1].start, 2),
                       "dur": round(gap, 2), "after": i, "kind": kind})

    power = [p for p in pauses if p["kind"] == "power"]
    hes = [p for p in pauses if p["kind"] == "hesitation"]
    for p in power[:3]:
        ctx.notes.append(Note(p["start"], "power_pause", f"Nice rest ({p['dur']:.1f}s) after “{norm(words[p['after']].text)}”.", "good", end=p["end"]))
    for p in hes:
        ctx.notes.append(Note(p["start"], "hesitation", f"Hesitation mid-phrase ({p['dur']:.1f}s).", "watch", end=p["end"]))

    run_ons = 0
    for first, last in sentences[:-1]:
        nxt = last + 1
        if nxt < len(words) and words[nxt].start - words[last].end < 0.15 and last - first >= 3:
            run_ons += 1
            ctx.notes.append(Note(words[last].end, "run_on", "No breath between sentences. A beat here lets the line land.", "watch"))

    hes_rate = len(hes) / max(duration_min, 1e-6)
    if power and hes_rate <= 2 and run_ons <= 1:
        status, headline = Status.STRONG, f"{len(power)} power pause{'s' if len(power) != 1 else ''}"
        tip = "You're using silence. Try placing one right before your most important line."
    elif not power and len(sentences) > 2:
        status, headline = Status.WORK, "Few deliberate pauses"
        tip = "Hold a full second of silence after a key sentence. It feels long to you; it sounds confident to them."
    else:
        status, headline = Status.OK, f"{len(power)} power, {len(hes)} hesitation{'s' if len(hes) != 1 else ''}"
        tip = "Turn hesitations into choices: stop on purpose at the end of a thought instead of in the middle."
    return {
        "pauses": pauses,
        "power": len(power),
        "hesitations": len(hes),
        "run_ons": run_ons,
        "dimension": dict(key="rests", label="Rests", analogy="Pauses", value=len(power), unit="power pauses",
                          status=status, headline=headline, tip=tip),
    }


def _melody(ctx: _Ctx, sentences: list[tuple[int, int]], speech_start: float, speech_end: float) -> tuple[dict, list[dict]]:
    th, pr, words = ctx.th, ctx.prosody, ctx.words
    st = pr.semitones()
    speech = pr.window(speech_start, speech_end)
    voiced_st = st[speech][~np.isnan(st[speech])]
    if len(voiced_st) < 20:
        dim = dict(key="melody", label="Melody", analogy="Ups and downs", value=None, unit="st",
                   status=Status.OK, headline="Not enough voiced speech to measure", tip="Try a longer passage.")
        return {"median_hz": None, "std_st": None, "range_st": None, "monotone_spans": [], "dimension": dim}, []

    std = float(np.std(voiced_st))
    rng = float(np.percentile(voiced_st, 95) - np.percentile(voiced_st, 5))

    # Flat stretches
    spans: list[list[float]] = []
    w = th.monotone_window_s
    for t0 in np.arange(speech_start, max(speech_start, speech_end - w) + 1e-9, 0.5):
        seg = st[pr.window(t0, t0 + w)]
        v = seg[~np.isnan(seg)]
        if len(v) >= 0.35 * len(seg) and len(seg) > 0 and np.std(v) < th.monotone_window_std:
            if spans and t0 <= spans[-1][1]:
                spans[-1][1] = t0 + w
            else:
                spans.append([float(t0), float(t0 + w)])
    for a, b in spans:
        ctx.notes.append(Note(a, "monotone", "Flat stretch. Lift a key word or drop your pitch at the end.", "watch", end=b))

    # Per-sentence shape
    sent_info = []
    for first, last in sentences:
        s0, s1 = words[first].start, words[last].end
        seg = st[pr.window(s0, s1)]
        v = seg[~np.isnan(seg)]
        info = {"first": first, "last": last, "start": round(s0, 2), "end": round(s1, 2),
                "pitch_std": round(float(np.std(v)), 2) if len(v) > 5 else None, "ending": None, "trail_off": False}
        tail = st[pr.window(max(s0, s1 - 0.35), s1)]
        tv = tail[~np.isnan(tail)]
        if len(v) > 10 and len(tv) >= 3:
            delta = float(np.median(tv) - np.median(v))
            info["ending"] = "rise" if delta > th.rising_end_st else "fall" if delta < -th.rising_end_st else "level"
            if info["ending"] == "rise" and words[last].text.rstrip("\"')").endswith(".") and last - first >= 3:
                ctx.notes.append(Note(s1 - 0.35, "uptalk", "Statement ended rising, so it sounds like a question. Land it with a drop.", "watch", end=s1))
        sent_info.append(info)

    # Where the voice really moved: a strong emphasis peak
    best = max((s for s in sent_info if s["pitch_std"]), key=lambda s: s["pitch_std"], default=None)
    if best and best["pitch_std"] >= th.pitch_expressive_std:
        ctx.notes.append(Note(best["start"], "melody_peak", "Most expressive line. This is your voice singing.", "good", end=best["end"]))

    if std < th.pitch_flat_std:
        status, headline = Status.WORK, "Fairly flat"
        tip = "Pick one word per sentence to lift. Questions up, conclusions down."
    elif std >= th.pitch_expressive_std:
        status, headline = Status.STRONG, "Expressive range"
        tip = "Lots of movement. Make sure the peaks land on the words that matter."
    else:
        status, headline = Status.OK, "Conversational"
        tip = "A natural range. Stretch it on your key lines: higher on the setup, lower on the payoff."
    if spans and status == Status.STRONG:
        status = Status.OK

    return {
        "median_hz": round(pr.median_f0(), 1),
        "std_st": round(std, 2),
        "range_st": round(rng, 1),
        "monotone_spans": [{"start": round(a, 2), "end": round(b, 2)} for a, b in spans],
        "dimension": dict(key="melody", label="Melody", analogy="Ups and downs", value=round(std, 1), unit="st spread",
                          status=status, headline=headline, tip=tip),
    }, sent_info


def _dynamics(ctx: _Ctx, sent_info: list[dict], speech_start: float, speech_end: float) -> dict:
    th, pr = ctx.th, ctx.prosody
    speech = pr.window(speech_start, speech_end)
    db = pr.db[speech]
    voiced = pr.voiced[speech] & ~np.isnan(db)
    v = db[voiced]
    if len(v) < 20:
        dim = dict(key="dynamics", label="Dynamics", analogy="Volume", value=None, unit="dB",
                   status=Status.OK, headline="Not enough speech to measure", tip="Try a longer passage.")
        return {"range_db": None, "trail_offs": 0, "dimension": dim}
    rng = float(np.percentile(v, 90) - np.percentile(v, 10))

    trail = 0
    for s in sent_info:
        dur = s["end"] - s["start"]
        if dur < 1.2 or s["last"] - s["first"] < 3:
            continue
        cut = s["end"] - max(0.4, 0.25 * dur)
        body = pr.db[pr.window(s["start"], cut)]
        end = pr.db[pr.window(cut, s["end"])]
        bm = pr.voiced[pr.window(s["start"], cut)]
        em = pr.voiced[pr.window(cut, s["end"])]
        if bm.sum() < 5 or em.sum() < 3:
            continue
        drop = float(np.nanmean(body[bm]) - np.nanmean(end[em]))
        if drop > th.trail_off_db:
            s["trail_off"] = True
            trail += 1
            ctx.notes.append(Note(cut, "trail_off", f"Trailed off ({drop:.0f} dB quieter) on “{norm(ctx.words[s['last']].text)}”. Keep energy to the last word.", "watch", end=s["end"]))

    if trail > max(1, len(sent_info) // 3):
        status, headline = Status.WORK, f"Trailing off on {trail} sentences"
        tip = "The end of a sentence is usually the point. Support it with breath and finish at full volume."
    elif rng < th.dynamics_narrow_db:
        status, headline = Status.OK, "Even volume"
        tip = "Steady is fine. For contrast, try dropping quieter (not mumbling) before a big moment."
    else:
        status, headline = Status.STRONG, "Good light and shade"
        tip = "Nice contrast. Keep the loud moments for emphasis, not volume for its own sake."
    return {
        "range_db": round(rng, 1),
        "trail_offs": trail,
        "dimension": dict(key="dynamics", label="Dynamics", analogy="Volume", value=round(rng), unit="dB range",
                          status=status, headline=headline, tip=tip),
    }


def _clarity(ctx: _Ctx, duration_min: float) -> dict:
    th, words, kinds = ctx.th, ctx.words, ctx.kinds
    fillers = [i for i, k in enumerate(kinds) if k == "filler"]
    soft = [i for i, k in enumerate(kinds) if k == "soft"]
    unclear = [i for i, k in enumerate(kinds) if k == "word" and words[i].prob < th.unclear_word_prob]
    rate = len(fillers) / max(duration_min, 1e-6)

    for i in fillers:
        ctx.notes.append(Note(words[i].start, "filler", f"Filler “{norm(words[i].text)}”. A silent pause does the same job.", "watch", end=words[i].end))
    for i in unclear:
        ctx.notes.append(Note(words[i].start, "unclear", f"“{norm(words[i].text)}” may not have come through clearly.", "watch", end=words[i].end))

    script = None
    if ctx.script and ctx.script.strip():
        spoken_idx = [i for i, k in enumerate(kinds) if k != "filler" and norm(words[i].text)]
        script = _match_script(ctx.script, [norm(words[i].text) for i in spoken_idx])
        for sw in script["swapped"]:
            if sw["at"] is not None:
                w = words[spoken_idx[sw["at"]]]
                ctx.notes.append(Note(w.start, "swapped", f"Expected “{sw['expected']}”, heard “{sw['heard']}”. Over-articulate this one.", "watch", end=w.end))
            sw.pop("at")

    problems = rate + 0.5 * len(unclear) / max(duration_min, 1e-6)
    if script and script["accuracy"] < 0.9:
        problems += 4
    if problems <= th.fillers_per_min_ok:
        status, headline = Status.STRONG, "Clean and clear"
        tip = "Crisp. Try a tongue twister at speed to keep the articulation sharp."
    elif problems <= th.fillers_per_min_bad:
        status, headline = Status.OK, f"{len(fillers)} filler{'s' if len(fillers) != 1 else ''}, {len(unclear)} unclear"
        tip = "When you feel an “um” coming, close your mouth and pause instead."
    else:
        status, headline = Status.WORK, "Fillers and blurred words"
        tip = "Slow down slightly and finish each consonant, especially final t, d and k sounds."
    return {
        "fillers": len(fillers),
        "soft_fillers": len(soft),
        "fillers_per_min": round(rate, 1),
        "unclear_words": len(unclear),
        "script": script,
        "dimension": dict(key="clarity", label="Clarity", analogy="Enunciation", value=round(rate, 1), unit="fillers/min",
                          status=status, headline=headline, tip=tip),
    }


def _match_script(script: str, spoken: list[str]) -> dict:
    """Align the spoken words to the intended script (``spoken`` must be pre-normalised, non-empty)."""
    target = [t for t in (norm(x) for x in script.split()) if t]
    sm = difflib.SequenceMatcher(a=target, b=spoken, autojunk=False)
    matched, missed, swapped = 0, [], []
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == "equal":
            matched += a1 - a0
        elif op == "delete":
            missed.extend(target[a0:a1])
        elif op == "replace":
            swapped.append({"expected": " ".join(target[a0:a1]), "heard": " ".join(spoken[b0:b1]), "at": b0})
    return {
        "accuracy": round(matched / max(len(target), 1), 3),
        "missed": missed[:30],
        "swapped": swapped[:30],
    }


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #


def analyse(words: list[Word], prosody: Prosody, duration: float, script: str | None = None,
            th: Thresholds = DEFAULT) -> dict:
    if not words:
        raise ValueError("No speech detected. Check your microphone and try again.")

    ctx = _Ctx(words=words, prosody=prosody, th=th, script=script)
    ctx.kinds = classify_words(words)
    content_idx = [i for i, k in enumerate(ctx.kinds) if k != "filler"]
    speech_start, speech_end = words[0].start, words[-1].end
    duration_min = max(speech_end - speech_start, 1.0) / 60
    sentences = split_sentences(words)

    pace = _pace(ctx, content_idx, speech_start, speech_end)
    rests = _rests(ctx, sentences, duration_min)
    melody, sent_info = _melody(ctx, sentences, speech_start, speech_end)
    dynamics = _dynamics(ctx, sent_info, speech_start, speech_end)
    clarity = _clarity(ctx, duration_min)

    sentence_of = {}
    for si, (a, b) in enumerate(sentences):
        for i in range(a, b + 1):
            sentence_of[i] = si

    dims = [pace.pop("dimension"), rests.pop("dimension"), melody.pop("dimension"),
            dynamics.pop("dimension"), clarity.pop("dimension")]

    return {
        "duration": round(duration, 2),
        "speech_start": round(speech_start, 2),
        "speech_end": round(speech_end, 2),
        "word_count": len(content_idx),
        "dimensions": dims,
        "pace": pace,
        "rests": rests,
        "melody": melody,
        "dynamics": dynamics,
        "clarity": clarity,
        "sentences": sent_info,
        "words": [
            {**w.to_dict(), "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.prob, 3),
             "kind": ctx.kinds[i], "unclear": ctx.kinds[i] == "word" and w.prob < th.unclear_word_prob,
             "sentence": sentence_of.get(i, 0)}
            for i, w in enumerate(words)
        ],
        "notes": [n.to_dict() for n in sorted(ctx.notes, key=lambda n: n.t)],
        "contour": contour(prosody),
    }


def contour(prosody: Prosody, step: int = 2) -> dict:
    """Downsampled pitch (semitones from median) and loudness tracks for plotting."""
    st = prosody.semitones()[::step]
    db = prosody.db[::step]

    def clean(a, nd):
        return [None if (x is None or math.isnan(x)) else round(float(x), nd) for x in a]

    return {"step": round(0.01 * step, 3), "median_hz": round(prosody.median_f0(), 1) if prosody.voiced.any() else None,
            "pitch_st": clean(st, 2), "db": clean(db, 1)}
