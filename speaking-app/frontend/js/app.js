import { fmtTime } from "./canvas.js";
import { LiveMelody } from "./live.js";
import { PASSAGES } from "./passages.js";
import { Recorder } from "./recorder.js";
import { ResultsView } from "./results.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  practice: $("#practice"),
  results: $("#results"),
  passage: $("#passage"),
  focus: $("#passage-focus"),
  hint: $("#passage-hint"),
  script: $("#script"),
  record: $("#record"),
  recordLabel: $("#record-label"),
  timer: $("#timer"),
  level: $("#level-fill"),
  spread: $("#live-spread"),
  hz: $("#live-hz"),
  status: $("#status"),
  history: $("#history"),
  again: $("#again"),
  modelBanner: $("#model-banner"),
};

const recorder = new Recorder();
const live = new LiveMelody($("#live"), { onStats: showLiveStats });
const results = new ResultsView(els.results);
let recording = false;
let recordStarted = 0;
let timerId = null;

// ----------------------------------------------------------------- passages
for (const p of PASSAGES) els.passage.add(new Option(p.title, p.id));
els.passage.addEventListener("change", () => loadPassage(els.passage.value));
function loadPassage(id) {
  const p = PASSAGES.find((x) => x.id === id) || PASSAGES[0];
  els.passage.value = p.id;
  els.focus.textContent = p.focus;
  els.hint.textContent = p.hint;
  els.script.value = p.text;
  els.script.placeholder = p.text ? "" : "No script: just talk. Or paste your own talk here.";
  try {
    localStorage.setItem("vc.passage", p.id);
  } catch {}
}
loadPassage(safeGet("vc.passage") || PASSAGES[0].id);

// ---------------------------------------------------------------- recording
els.record.addEventListener("click", () => (recording ? stopRecording() : startRecording()));
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !els.practice.hidden && document.activeElement !== els.script && !e.repeat) {
    e.preventDefault();
    els.record.click();
  }
});

async function startRecording() {
  setStatus("");
  try {
    live.start();
    await recorder.start((f) => live.push(f));
  } catch (err) {
    live.stop();
    setStatus(err.name === "NotAllowedError" ? "Microphone access was blocked. Allow it in the browser and try again." : `Could not start the microphone: ${err.message}`, "error");
    return;
  }
  recording = true;
  recordStarted = performance.now();
  document.body.classList.add("is-recording");
  els.recordLabel.textContent = "Stop";
  timerId = setInterval(() => (els.timer.textContent = fmtTime((performance.now() - recordStarted) / 1000)), 250);
}

async function stopRecording() {
  recording = false;
  clearInterval(timerId);
  live.stop();
  document.body.classList.remove("is-recording");
  els.recordLabel.textContent = "Record";
  els.record.disabled = true;
  setStatus("Listening back to your take…", "busy");
  try {
    const { blob, duration } = await recorder.stop();
    if (duration < 2) throw new Error("That was very short. Speak for at least a few seconds.");
    const form = new FormData();
    form.append("audio", blob, "take.wav");
    form.append("script", els.script.value);
    const passage = PASSAGES.find((p) => p.id === els.passage.value);
    if (passage && passage.text && els.script.value === passage.text) form.append("title", passage.title);
    const res = await fetch("/api/analyze", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || `Analysis failed (${res.status})`);
    setStatus("");
    openResult(body);
    refreshHistory();
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    els.record.disabled = false;
  }
}

function showLiveStats({ spread, hz, level }) {
  els.level.style.transform = `scaleX(${Math.min(1, level * 8).toFixed(3)})`;
  els.hz.textContent = hz ? `${Math.round(hz)} Hz` : "–";
  if (spread == null) {
    els.spread.textContent = "–";
    els.spread.dataset.tone = "";
  } else {
    els.spread.textContent = `${spread.toFixed(1)} st`;
    els.spread.dataset.tone = spread < 4 ? "flat" : spread > 8 ? "lively" : "ok";
  }
}

// ------------------------------------------------------------------ views
function openResult(r) {
  els.practice.hidden = true;
  els.results.hidden = false;
  results.show(r, `/api/sessions/${encodeURIComponent(r.id)}/audio`);
  markActive(r.id);
  history.replaceState(null, "", `#${r.id}`);
  window.scrollTo({ top: 0 });
}

function openPractice() {
  els.results.hidden = true;
  els.practice.hidden = false;
  results.audio.pause();
  markActive(null);
  history.replaceState(null, "", location.pathname);
  live.reset();
  live.draw();
}
els.again.addEventListener("click", openPractice);
$("#new-run").addEventListener("click", openPractice);

// ----------------------------------------------------------------- history
async function refreshHistory() {
  let list = [];
  try {
    list = await (await fetch("/api/sessions")).json();
  } catch {
    return;
  }
  if (!list.length) {
    els.history.innerHTML = `<li class="empty">Your takes will show up here.</li>`;
    return;
  }
  els.history.replaceChildren(
    ...list.map((s) => {
      const li = document.createElement("li");
      li.dataset.id = s.id;
      const dims = Object.fromEntries(s.dimensions.map((d) => [d.key, d]));
      li.innerHTML = `<button class="open"><span class="h-title"></span><span class="h-meta"></span><span class="dots"></span></button><button class="del" title="Delete take" aria-label="Delete take">×</button>`;
      li.querySelector(".h-title").textContent = s.title || "Untitled";
      li.querySelector(".h-meta").textContent = `${new Date(s.created).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${fmtTime(s.duration)} · ${dims.tempo?.value ?? "–"} wpm`;
      li.querySelector(".dots").replaceChildren(
        ...s.dimensions.map((d) => {
          const dot = document.createElement("i");
          dot.className = `dot status-${d.status}`;
          dot.title = `${d.key}: ${d.status}`;
          return dot;
        })
      );
      li.querySelector(".open").addEventListener("click", () => loadSession(s.id));
      li.querySelector(".del").addEventListener("click", async () => {
        if (!confirm("Delete this take and its recording?")) return;
        await fetch(`/api/sessions/${encodeURIComponent(s.id)}`, { method: "DELETE" });
        if (location.hash === `#${s.id}`) openPractice();
        refreshHistory();
      });
      return li;
    })
  );
  markActive(location.hash.slice(1) || null);
}

async function loadSession(id) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
  if (res.ok) openResult(await res.json());
}

function markActive(id) {
  for (const li of els.history.querySelectorAll("li[data-id]")) li.classList.toggle("active", li.dataset.id === id);
}

// ------------------------------------------------------------------ status
function setStatus(msg, kind = "") {
  els.status.textContent = msg;
  els.status.dataset.kind = kind;
  els.status.hidden = !msg;
}

async function watchModel() {
  try {
    const h = await (await fetch("/api/health")).json();
    if (h.state === "ready") {
      els.modelBanner.hidden = true;
      return;
    }
    els.modelBanner.hidden = false;
    els.modelBanner.textContent = h.state === "error"
      ? `Speech model failed to load: ${h.error}`
      : `Loading the speech model (${h.model})… the first run downloads it once.`;
    if (h.state !== "error") setTimeout(watchModel, 2000);
  } catch {
    els.modelBanner.hidden = false;
    els.modelBanner.textContent = "Can't reach the local server. Is ./run.sh running?";
    setTimeout(watchModel, 3000);
  }
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

watchModel();
refreshHistory();
live.draw();
if (location.hash.length > 1) loadSession(location.hash.slice(1));
