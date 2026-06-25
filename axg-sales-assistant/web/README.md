# AXG Sales Assistant — Web UI (Phase 4)

A small web front end for the assistant. A **zero-dependency Node server** (`node:http`)
serves one self-contained page and runs the logic behind it. The LLM pipeline runs
**server-side**, so the API key never reaches the browser.

## Run it

Requires Node ≥ 22. The engine path needs no install; the email path reuses the LLM
package's `node_modules` (run `npm install` in `../llm` once) and a key.

```bash
cd axg-sales-assistant/web

# engine works immediately (no key); "Build by fields" tab is fully functional
node server.ts                                  # → http://localhost:8787

# full paste-an-email → drafted-reply flow (server-side LLM)
( cd ../llm && npm install )                     # once, if not already done
ANTHROPIC_API_KEY=sk-ant-... node server.ts
```

Open http://localhost:8787.

## Two modes

- **Paste an email** → `POST /api/quote` → `runInquiry()` (triage → extract → engine →
  draft). Needs `ANTHROPIC_API_KEY` on the server. Renders the routing, the extracted
  spec, the validated result, and the drafted reply.
- **Build by fields** → `POST /api/configure` → the matching `configure*` engine function.
  No key, no LLM — runs the validated engine directly and renders the result. Use this to
  exercise the engine in a browser without a key.

Both render the same result view: model code (color-coded by provenance) or assembly +
rolled-up number, computed sizing, gates, flags, and open questions.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | the single-page UI |
| GET | `/api/health` | `{ ok, hasKey }` (drives the no-key banner) |
| POST | `/api/configure` | `{ instrument, inquiry }` → `{ result }` (engine only) |
| POST | `/api/quote` | `{ email }` → routed result + draft (LLM; 503 without a key) |

## Design notes

- No framework, no bundler, no build step — the page is static HTML/CSS/JS, the server is
  plain `node:http`, and both run on Node's TypeScript type-stripping like the rest of the
  project.
- Every output is a **draft for human review** — nothing is sent or ordered automatically.
</content>
