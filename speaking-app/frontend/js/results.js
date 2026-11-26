// Results view: scorecards, the melody timeline, pace, transcript and notes,
// all synced to audio playback.
import { cssVar, fitCanvas, fmtTime } from "./canvas.js";

const STATUS_LABEL = { strong: "Strong", ok: "Solid", work: "Work on" };
const NOTE_ICON = { good: "✓", watch: "!" };

export class ResultsView {
  constructor(root) {
    this.root = root;
    this.audio = root.querySelector("#playback");
    this.timeline = root.querySelector("#timeline");
    this.paceCanvas = root.querySelector("#pace");
    this.r = null;
    this._raf = null;

    for (const c of [this.timeline, this.paceCanvas]) {
      c.addEventListener("click", (e) => {
        const rect = c.getBoundingClientRect();
        this.seek(((e.clientX - rect.left) / rect.width) * this.r.duration);
      });
    }
    this.audio.addEventListener("play", () => this._tick());
    this.audio.addEventListener("pause", () => cancelAnimationFrame(this._raf));
    this.audio.addEventListener("seeked", () => this.drawAll());
    window.addEventListener("resize", () => this.r && this.drawAll());
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.r && this.drawAll());
  }

  show(result, audioUrl) {
    this.r = result;
    this.audio.src = audioUrl;
    this.root.querySelector("#result-title").textContent = result.title || "Untitled run";
    this.root.querySelector("#result-meta").textContent = [
      result.created ? new Date(result.created).toLocaleString() : "",
      `${fmtTime(result.duration)} long`,
      `${result.word_count} words`,
    ].filter(Boolean).join(" · ");
    this.renderCards();
    this.renderTranscript();
    this.renderNotes();
    this.renderScript();
    requestAnimationFrame(() => this.drawAll());
  }

  seek(t) {
    this.audio.currentTime = Math.max(0, Math.min(this.r.duration, t));
    this.drawAll();
  }

  _tick() {
    this.drawAll();
    if (!this.audio.paused) this._raf = requestAnimationFrame(() => this._tick());
  }

  drawAll() {
    if (!this.r) return;
    this.drawTimeline();
    this.drawPace();
    this.highlightWord();
  }

  // ------------------------------------------------------------------ cards
  renderCards() {
    const el = this.root.querySelector("#cards");
    el.replaceChildren(
      ...this.r.dimensions.map((d) => {
        const card = document.createElement("article");
        card.className = `card status-${d.status}`;
        card.innerHTML = `
          <header><span class="dim-label"></span><span class="pill"></span></header>
          <div class="dim-value"><span class="num"></span> <span class="unit"></span></div>
          <p class="headline"></p>
          <p class="tip"></p>`;
        card.querySelector(".dim-label").textContent = `${d.label} · ${d.analogy}`;
        card.querySelector(".pill").textContent = STATUS_LABEL[d.status] || d.status;
        card.querySelector(".num").textContent = d.value ?? "–";
        card.querySelector(".unit").textContent = d.unit;
        card.querySelector(".headline").textContent = d.headline;
        card.querySelector(".tip").textContent = d.tip;
        return card;
      })
    );
  }

  // ------------------------------------------------------------- transcript
  renderTranscript() {
    const el = this.root.querySelector("#transcript");
    const pauseAfter = new Map(this.r.rests.pauses.map((p) => [p.after, p]));
    const frag = document.createDocumentFragment();
    this.wordEls = this.r.words.map((w, i) => {
      const span = document.createElement("span");
      span.className = `w ${w.kind}${w.unclear ? " unclear" : ""}`;
      span.textContent = w.text;
      span.title = `${fmtTime(w.start)} · confidence ${(w.prob * 100).toFixed(0)}%`;
      span.addEventListener("click", () => {
        this.seek(w.start);
        this.audio.play();
      });
      frag.append(span, " ");
      const p = pauseAfter.get(i);
      if (p && p.kind !== "short") {
        const mark = document.createElement("span");
        mark.className = `pause ${p.kind}`;
        mark.style.setProperty("--len", Math.min(4, p.dur).toFixed(2));
        mark.title = `${p.dur.toFixed(1)}s ${p.kind === "power" ? "power pause" : p.kind}`;
        frag.append(mark, " ");
      }
      return span;
    });
    el.replaceChildren(frag);
  }

  highlightWord() {
    const t = this.audio.currentTime;
    const idx = this.r.words.findIndex((w) => t >= w.start && t <= w.end + 0.05);
    if (idx === this._current) return;
    this.wordEls?.[this._current]?.classList.remove("now");
    this.wordEls?.[idx]?.classList.add("now");
    this._current = idx;
  }

  // ------------------------------------------------------------------ notes
  renderNotes() {
    const el = this.root.querySelector("#notes");
    if (!this.r.notes.length) {
      el.innerHTML = `<li class="empty">Nothing flagged. Clean run.</li>`;
      return;
    }
    el.replaceChildren(
      ...this.r.notes.map((n) => {
        const li = document.createElement("li");
        li.className = `note ${n.tone}`;
        li.innerHTML = `<span class="icon"></span><button class="time"></button><span class="text"></span>`;
        li.querySelector(".icon").textContent = NOTE_ICON[n.tone] || "•";
        li.querySelector(".time").textContent = fmtTime(n.t);
        li.querySelector(".text").textContent = n.text;
        li.querySelector(".time").addEventListener("click", () => {
          this.seek(Math.max(0, n.t - 1));
          this.audio.play();
        });
        return li;
      })
    );
  }

  renderScript() {
    const el = this.root.querySelector("#script-match");
    const s = this.r.clarity.script;
    if (!s) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const parts = [`<strong>${Math.round(s.accuracy * 100)}%</strong> of your script came through as written.`];
    if (s.swapped.length) parts.push(`Heard differently: ${s.swapped.map((x) => `“${esc(x.expected)}” → “${esc(x.heard)}”`).join(", ")}.`);
    if (s.missed.length) parts.push(`Missing: ${s.missed.map(esc).join(", ")}.`);
    el.innerHTML = parts.join(" ");
  }

  // --------------------------------------------------------------- timeline
  drawTimeline() {
    const { ctx, width, height } = fitCanvas(this.timeline);
    const r = this.r;
    const c = colors();
    const x = (t) => (t / r.duration) * width;
    const RANGE = 12;
    const top = 18, bottom = height - 22;
    const y = (st) => (top + bottom) / 2 - (st / RANGE) * ((bottom - top) / 2);
    ctx.clearRect(0, 0, width, height);

    // Pauses as rests
    for (const p of r.rests.pauses) {
      if (p.kind === "short") continue;
      ctx.fillStyle = p.kind === "power" ? c.good : p.kind === "hesitation" ? c.warn : c.band;
      ctx.globalAlpha = p.kind === "power" || p.kind === "hesitation" ? 0.16 : 1;
      ctx.fillRect(x(p.start), top, Math.max(2, x(p.end) - x(p.start)), bottom - top);
      ctx.globalAlpha = 1;
    }
    // Flat stretches
    for (const s of r.melody.monotone_spans) {
      ctx.fillStyle = c.warn;
      ctx.fillRect(x(s.start), bottom + 4, x(s.end) - x(s.start), 3);
    }

    // Loudness as a soft area along the bottom
    const { step, pitch_st, db } = r.contour;
    const dbVals = db.filter((v) => v != null);
    if (dbVals.length) {
      const lo = Math.min(...dbVals), hi = Math.max(...dbVals);
      ctx.fillStyle = c.band;
      ctx.beginPath();
      ctx.moveTo(0, bottom);
      db.forEach((v, i) => ctx.lineTo(x(i * step), bottom - (v == null ? 0 : ((v - lo) / (hi - lo || 1)) * (bottom - top) * 0.35)));
      ctx.lineTo(width, bottom);
      ctx.fill();
    }

    // Grid
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    for (const st of [-12, -6, 0, 6, 12]) {
      ctx.beginPath();
      ctx.moveTo(0, y(st));
      ctx.lineTo(width, y(st));
      ctx.stroke();
    }

    // Melody line
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.beginPath();
    let pen = false;
    pitch_st.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      const px = x(i * step), py = y(Math.max(-RANGE, Math.min(RANGE, v)));
      pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      pen = true;
    });
    ctx.stroke();

    // Note markers
    for (const n of r.notes) {
      ctx.fillStyle = n.tone === "good" ? c.good : c.warn;
      ctx.beginPath();
      ctx.arc(x(n.t), 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Time axis
    ctx.fillStyle = c.muted;
    ctx.font = "11px system-ui, sans-serif";
    const every = r.duration > 90 ? 15 : r.duration > 30 ? 5 : 2;
    for (let t = 0; t <= r.duration; t += every) ctx.fillText(fmtTime(t), x(t) + 3, height - 4);

    this._playhead(ctx, x, height, c);
  }

  drawPace() {
    const { ctx, width, height } = fitCanvas(this.paceCanvas);
    const r = this.r;
    const c = colors();
    const x = (t) => (t / r.duration) * width;
    const lo = 60, hi = 240;
    const y = (w) => height - 6 - ((Math.max(lo, Math.min(hi, w)) - lo) / (hi - lo)) * (height - 12);
    ctx.clearRect(0, 0, width, height);

    // Target band 140–160 wpm
    ctx.fillStyle = c.goodBand;
    ctx.fillRect(0, y(160), width, y(140) - y(160));
    ctx.fillStyle = c.muted;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("140–160 wpm", 6, y(160) - 4);

    const pts = r.pace.series;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p.wpm)) : ctx.moveTo(x(p.t), y(p.wpm))));
    ctx.stroke();
    for (const n of r.notes.filter((n) => n.kind === "rushed")) {
      ctx.fillStyle = c.warn;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x(n.t), 0, x(n.end) - x(n.t), height);
      ctx.globalAlpha = 1;
    }
    this._playhead(ctx, x, height, c);
  }

  _playhead(ctx, x, height, c) {
    const px = x(this.audio.currentTime || 0);
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
    ctx.stroke();
  }
}

function colors() {
  return {
    accent: cssVar("--accent"),
    good: cssVar("--good"),
    goodBand: cssVar("--good-band"),
    warn: cssVar("--warn"),
    band: cssVar("--band"),
    grid: cssVar("--grid"),
    muted: cssVar("--text-muted"),
    ink: cssVar("--text"),
  };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}
