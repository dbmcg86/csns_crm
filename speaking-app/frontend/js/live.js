// The live melody line: your pitch drawn as you speak, on a scrolling window.
import { cssVar, fitCanvas } from "./canvas.js";
import { median, semitones } from "./pitch.js";

const WINDOW_S = 10;
const RANGE_ST = 12; // ± semitones shown

export class LiveMelody {
  constructor(canvas, { onStats } = {}) {
    this.canvas = canvas;
    this.onStats = onStats;
    this.reset();
    this._raf = null;
  }

  reset() {
    this.frames = []; // {t, hz, level}
    this.voicedHz = [];
    this.ref = null;
    this.lastStats = 0;
  }

  start() {
    this.reset();
    const loop = () => {
      this.draw();
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    cancelAnimationFrame(this._raf);
    this._raf = null;
    this.draw();
  }

  push(frame) {
    this.frames.push(frame);
    if (frame.hz) {
      this.voicedHz.push(frame.hz);
      // Baseline settles after the first couple of seconds of voice
      if (this.voicedHz.length % 25 === 0 || !this.ref) this.ref = median(this.voicedHz.slice(-1500));
    }
    const cutoff = frame.t - WINDOW_S - 1;
    while (this.frames.length && this.frames[0].t < cutoff) this.frames.shift();

    if (frame.t - this.lastStats > 0.5) {
      this.lastStats = frame.t;
      this.onStats?.(this.stats(frame));
    }
  }

  stats(frame) {
    const recent = this.frames.filter((f) => f.hz && f.t > frame.t - WINDOW_S).map((f) => semitones(f.hz, this.ref));
    let spread = null;
    if (recent.length > 30) {
      const s = [...recent].sort((a, b) => a - b);
      spread = s[Math.floor(s.length * 0.9)] - s[Math.floor(s.length * 0.1)];
    }
    return { t: frame.t, hz: frame.hz, level: frame.level, spread, ref: this.ref };
  }

  draw() {
    const { ctx, width, height } = fitCanvas(this.canvas);
    const grid = cssVar("--grid");
    const muted = cssVar("--text-muted");
    const accent = cssVar("--accent");
    const band = cssVar("--band");
    ctx.clearRect(0, 0, width, height);

    const y = (st) => height / 2 - (st / RANGE_ST) * (height / 2 - 12);

    // Monotone band: ±1 semitone around your centre
    ctx.fillStyle = band;
    ctx.fillRect(0, y(1), width, y(-1) - y(1));

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = muted;
    for (const st of [-12, -6, 0, 6, 12]) {
      ctx.beginPath();
      ctx.moveTo(0, y(st));
      ctx.lineTo(width, y(st));
      ctx.stroke();
    }
    ctx.fillText("higher", 8, 16);
    ctx.fillText("lower", 8, height - 8);

    const last = this.frames.length ? this.frames[this.frames.length - 1].t : 0;
    const t0 = Math.max(0, last - WINDOW_S);
    const x = (t) => ((t - t0) / WINDOW_S) * width;

    if (!this.ref) {
      ctx.fillStyle = muted;
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this._raf ? "Start speaking…" : "Your melody line will draw here", width / 2, height / 2 - 20);
      ctx.textAlign = "start";
      return;
    }

    ctx.strokeStyle = accent;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let prev = null;
    for (const f of this.frames) {
      if (f.t < t0 || !f.hz) continue; // short gaps are bridged below
      const st = Math.max(-RANGE_ST, Math.min(RANGE_ST, semitones(f.hz, this.ref)));
      const pt = { x: x(f.t), y: y(st), w: 2 + Math.min(1, f.level * 12) * 6 };
      if (prev && f.t - prev.t < 0.12) {
        ctx.lineWidth = pt.w;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
      prev = { ...pt, t: f.t };
    }
    if (prev && last - prev.t < 0.1) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(prev.x, prev.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
