// YIN pitch detection (de Cheveigné & Kawahara, 2002), small enough to run
// every ~20 ms on the main thread.

export function rms(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

/**
 * Estimate the fundamental frequency of `buf`.
 * Returns { hz, clarity } or null when the frame is unvoiced or too quiet.
 */
export function detectPitch(buf, sampleRate, { minHz = 65, maxHz = 550, threshold = 0.2, minRms = 0.008 } = {}) {
  if (rms(buf) < minRms) return null;
  const half = Math.floor(buf.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(half - 1, Math.ceil(sampleRate / minHz));
  if (tauMax <= tauMin) return null;

  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < half; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // Cumulative mean normalised difference
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // Parabolic interpolation for sub-sample accuracy
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const denom = a + c - 2 * b;
    if (denom !== 0) better = tau + (a - c) / (2 * denom);
  }
  return { hz: sampleRate / better, clarity: 1 - d[tau] };
}

export function semitones(hz, refHz) {
  return 12 * Math.log2(hz / refHz);
}

export function median(values) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
