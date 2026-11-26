"""Local web server: serves the UI and runs analysis. Binds to localhost only."""

from __future__ import annotations

import json
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .analysis import analyse
from .audio import TARGET_SR, load_audio
from .prosody import analyse_prosody
from .transcribe import Transcriber, make_transcriber

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
DATA = Path(os.environ.get("VOICECOACH_DATA", ROOT / "data")) / "sessions"

_transcriber: Transcriber | None = None
_status = {"state": "loading", "error": None}
_lock = threading.Lock()


def get_transcriber() -> Transcriber:
    global _transcriber
    with _lock:
        if _transcriber is None:
            _transcriber = make_transcriber()
    return _transcriber


def _warm_up() -> None:
    try:
        get_transcriber().warm_up()
        _status["state"] = "ready"
    except Exception as exc:  # surfaced in /api/health and the UI
        _status.update(state="error", error=f"{type(exc).__name__}: {exc}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    DATA.mkdir(parents=True, exist_ok=True)
    if os.environ.get("VOICECOACH_SKIP_WARMUP"):
        _status["state"] = "ready"
    else:
        threading.Thread(target=_warm_up, daemon=True).start()
    yield


app = FastAPI(title="Voice Coach", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict:
    t = get_transcriber()
    return {"state": _status["state"], "error": _status["error"], "asr": t.name, "model": t.model}


@app.post("/api/analyze")
def analyze(audio: UploadFile = File(...), script: str = Form(""), title: str = Form("")) -> dict:
    raw = audio.file.read()
    try:
        samples = load_audio(raw)
    except Exception as exc:
        raise HTTPException(400, f"Could not read audio: {exc}") from exc
    duration = len(samples) / TARGET_SR
    if duration < 1.0:
        raise HTTPException(400, "Recording is too short. Speak for at least a few seconds.")

    t0 = time.perf_counter()
    words = get_transcriber().transcribe(samples)
    t1 = time.perf_counter()
    prosody = analyse_prosody(samples)
    try:
        result = analyse(words, prosody, duration, script=script or None)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    t2 = time.perf_counter()

    sid = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    result.update(
        id=sid,
        title=title.strip() or _default_title(result),
        created=time.strftime("%Y-%m-%dT%H:%M:%S"),
        script=script,
        timing={"transcribe_s": round(t1 - t0, 2), "analyse_s": round(t2 - t1, 2)},
    )
    folder = DATA / sid
    folder.mkdir(parents=True)
    (folder / "audio.wav").write_bytes(raw)
    (folder / "result.json").write_text(json.dumps(result))
    return result


def _default_title(result: dict) -> str:
    text = " ".join(w["text"] for w in result["words"] if w["kind"] == "word")
    return (text[:48] + "…") if len(text) > 48 else text


@app.get("/api/sessions")
def sessions() -> list[dict]:
    out = []
    for f in sorted(DATA.glob("*/result.json"), reverse=True):
        try:
            r = json.loads(f.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        out.append({
            "id": r["id"], "title": r.get("title", ""), "created": r.get("created"),
            "duration": r.get("duration"),
            "dimensions": [{k: d[k] for k in ("key", "value", "status")} for d in r["dimensions"]],
        })
    return out


def _session_dir(sid: str) -> Path:
    folder = (DATA / sid).resolve()
    if folder.parent != DATA.resolve() or not folder.is_dir():
        raise HTTPException(404, "No such session")
    return folder


@app.get("/api/sessions/{sid}")
def session(sid: str) -> dict:
    return json.loads((_session_dir(sid) / "result.json").read_text())


@app.get("/api/sessions/{sid}/audio")
def session_audio(sid: str) -> FileResponse:
    return FileResponse(_session_dir(sid) / "audio.wav", media_type="audio/wav")


@app.delete("/api/sessions/{sid}")
def delete_session(sid: str) -> dict:
    folder = _session_dir(sid)
    for f in folder.iterdir():
        f.unlink()
    folder.rmdir()
    return {"deleted": sid}


app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
