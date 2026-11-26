import assert from "node:assert/strict";
import { test } from "node:test";
import { detectPitch, median, semitones } from "../js/pitch.js";

function voice(hz, sr = 48000, n = 2048) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    buf[i] = 0.3 * Math.sin(2 * Math.PI * hz * t) + 0.15 * Math.sin(4 * Math.PI * hz * t) + 0.05 * Math.sin(6 * Math.PI * hz * t);
  }
  return buf;
}

test("detects pitch across the speaking range", () => {
  for (const hz of [80, 110, 165, 220, 330]) {
    const p = detectPitch(voice(hz), 48000);
    assert.ok(p, `no pitch for ${hz}`);
    assert.ok(Math.abs(semitones(p.hz, hz)) < 0.3, `${hz} → ${p.hz}`);
  }
});

test("silence and noise are unvoiced", () => {
  assert.equal(detectPitch(new Float32Array(2048), 48000), null);
  let seed = 1;
  const noise = Float32Array.from({ length: 2048 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.5);
  assert.equal(detectPitch(noise, 48000), null);
});

test("median and semitones", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(semitones(220, 110), 12);
});
