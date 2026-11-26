# Voice Coach

A public speaking practice tool that runs entirely on your own machine. Read a
passage (or just talk), watch your pitch draw as a live melody line, then get a
breakdown of how you sounded to a listener.

No accounts, no API keys, no cloud. Audio and transcripts stay in `data/`.

## What it measures

| Card | Musical idea | What it looks at |
|---|---|---|
| **Tempo** | Pace | Words per minute (fillers excluded), pace over time, rushed stretches |
| **Rests** | Pauses | Power pauses at sentence ends vs. hesitations mid-phrase, run-on sentences |
| **Melody** | Ups and downs | Pitch spread in semitones, flat stretches, statements that end rising |
| **Dynamics** | Volume | Loud/soft contrast, sentences that trail off at the end |
| **Clarity** | Enunciation | Fillers (um, uh), soft fillers (like, you know), low-confidence words, and words that didn't match your script |

The results page syncs everything to playback: click a word, a moment or a
point on the chart to hear that spot.

## Setup (macOS, Apple Silicon)

Needs Python 3.10+ (`brew install python@3.12` if you don't have one).

```bash
cd speaking-app
./setup.sh      # once: creates .venv and installs dependencies
./run.sh        # opens http://localhost:8000
```

The first run downloads the speech model (about 1.6 GB for Whisper large-v3
turbo) and caches it. After that everything works offline. The banner at the
top of the page shows when the model is ready.

Use Chrome or Safari and allow microphone access when prompted. A decent
headset or USB mic gives noticeably better pitch and loudness readings than a
laptop mic.

## How it works

```
Browser (localhost:8000)                Python server (127.0.0.1 only)
• mic capture (AudioWorklet)            • Whisper → words + timestamps
• live pitch line (YIN, in JS)  ─WAV─▶  • Praat (parselmouth) → pitch, loudness
• results, transcript, playback ◀─JSON─ • scoring → cards + timestamped moments
                                        • saves take to data/sessions/
```

- **Speech-to-text**: `mlx-whisper` on the Apple GPU by default; falls back to
  `faster-whisper` on CPU. Whisper normally deletes "um" and "uh", so the app
  primes it with a disfluent prompt to keep them.
- **Pitch and loudness**: Praat's autocorrelation pitch tracker via
  `parselmouth`, the standard tool in speech research.
- **Browser audio processing is turned off** (auto gain, noise suppression,
  echo cancellation) because auto gain flattens the very dynamics being measured.

### Settings

| Variable | Default | |
|---|---|---|
| `VOICECOACH_ASR` | `mlx` on Apple Silicon, else `faster` | Transcription backend |
| `VOICECOACH_MODEL` | `mlx-community/whisper-large-v3-turbo` / `small.en` | Any mlx-whisper repo or faster-whisper model name |
| `VOICECOACH_DATA` | `./data` | Where takes are stored |
| `PORT` | `8000` | |

Example: `VOICECOACH_ASR=faster VOICECOACH_MODEL=medium.en ./run.sh`

Scoring thresholds (what counts as fast, flat, a power pause, etc.) are in
`backend/voicecoach/config.py`. They're coaching heuristics; tune them once you
have a few of your own takes to compare.

## Tests

```bash
cd backend && ../.venv/bin/pytest        # analysis + server
cd frontend && node --test tests/*.mjs   # pitch detector
```

## Roadmap

- [x] Record → transcript, pace, pauses, pitch range, fillers, script match
- [x] Live melody line while recording
- [ ] Emphasis drill game ("I didn't say she stole the money")
- [ ] Local AI coach feedback (Ollama / LM Studio)
- [ ] Progress charts across takes
- [ ] Conductor mode: match a target pitch contour
- [ ] Phoneme-level enunciation scoring (forced alignment)
- [ ] Optional CrisperWhisper backend for more accurate filler detection
