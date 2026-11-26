import io

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from voicecoach.transcribe import Transcriber, Word


class FakeTranscriber(Transcriber):
    name = "fake"

    def __init__(self):
        super().__init__("fake")

    def transcribe(self, audio):
        return [Word("Hello", 0.2, 0.6, 0.9), Word("um,", 0.8, 1.0, 0.9), Word("world.", 1.1, 1.6, 0.9)]


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("VOICECOACH_DATA", str(tmp_path))
    monkeypatch.setenv("VOICECOACH_SKIP_WARMUP", "1")
    import importlib

    import voicecoach.server as server

    server = importlib.reload(server)
    server._transcriber = FakeTranscriber()
    with TestClient(server.app) as c:
        yield c


def wav_bytes(seconds=2.0, sr=48_000):
    t = np.arange(0, seconds, 1 / sr)
    buf = io.BytesIO()
    sf.write(buf, (0.2 * np.sin(2 * np.pi * 140 * t)).astype(np.float32), sr, format="WAV")
    return buf.getvalue()


def test_analyze_saves_and_lists_sessions(client):
    r = client.post("/api/analyze", files={"audio": ("a.wav", wav_bytes(), "audio/wav")}, data={"script": "Hello world."})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["clarity"]["fillers"] == 1
    assert body["clarity"]["script"]["accuracy"] == 1.0
    sid = body["id"]

    listed = client.get("/api/sessions").json()
    assert [s["id"] for s in listed] == [sid]
    assert client.get(f"/api/sessions/{sid}").json()["id"] == sid
    audio = client.get(f"/api/sessions/{sid}/audio")
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/wav"

    assert client.delete(f"/api/sessions/{sid}").status_code == 200
    assert client.get("/api/sessions").json() == []


def test_rejects_short_and_bad_audio(client):
    assert client.post("/api/analyze", files={"audio": ("a.wav", wav_bytes(0.3), "audio/wav")}).status_code == 400
    assert client.post("/api/analyze", files={"audio": ("a.wav", b"nope", "audio/wav")}).status_code == 400


def test_session_paths_cannot_escape(client):
    assert client.get("/api/sessions/..%2F..%2Fetc").status_code == 404


def test_serves_frontend(client):
    r = client.get("/")
    assert r.status_code == 200 and "<html" in r.text.lower()
