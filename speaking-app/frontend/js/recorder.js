// Microphone capture: raw PCM for analysis plus a live pitch/level feed.
import { detectPitch, rms } from "./pitch.js";

export const UPLOAD_SR = 16000;

export class Recorder {
  constructor() {
    this.chunks = [];
    this.ctx = null;
  }

  /** Start recording; `onFrame({t, hz, level})` fires ~every 21 ms at 48 kHz. */
  async start(onFrame) {
    // Turn off the browser's "helpful" processing: auto gain control in
    // particular flattens the volume changes we want to measure.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule(new URL("./worklet.js", import.meta.url));
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "capture");
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    source.connect(this.node).connect(mute).connect(this.ctx.destination);

    const sr = this.ctx.sampleRate;
    const win = new Float32Array(2048);
    let samples = 0;
    this.chunks = [];
    this.node.port.onmessage = ({ data }) => {
      this.chunks.push(data);
      samples += data.length;
      win.copyWithin(0, data.length);
      win.set(data, win.length - data.length);
      const p = detectPitch(win, sr);
      onFrame?.({ t: samples / sr, hz: p ? p.hz : null, level: rms(data) });
    };
  }

  /** Stop and return { blob: 16 kHz mono WAV, duration }. */
  async stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    const sr = this.ctx.sampleRate;
    await this.ctx.close();
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const pcm = new Float32Array(total);
    let off = 0;
    for (const c of this.chunks) {
      pcm.set(c, off);
      off += c.length;
    }
    this.chunks = [];
    const down = await resample(pcm, sr, UPLOAD_SR);
    return { blob: encodeWav(down, UPLOAD_SR), duration: total / sr };
  }
}

async function resample(pcm, fromSr, toSr) {
  if (fromSr === toSr || pcm.length === 0) return pcm;
  const len = Math.max(1, Math.ceil((pcm.length * toSr) / fromSr));
  const off = new OfflineAudioContext(1, len, toSr);
  const buf = off.createBuffer(1, pcm.length, fromSr);
  buf.copyToChannel(pcm, 0);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

export function encodeWav(samples, sr) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const str = (o, s) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}
