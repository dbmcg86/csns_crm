# AXG Language Layer (Phase 2/3)

The LLM half of the system. Per the Pilot Spec's non-negotiable two-layer split,
the model does **exactly two things, both phrasing not deciding**:

1. **Extract** — read a messy inquiry email into a structured `AxgInquiry`.
2. **Reply** — phrase a draft reply from the engine's structured result.

It **never** produces a model code, dimension, rating, or compatibility verdict.
Those come from the deterministic engine (`../engine`), which sits between the two
LLM calls. Every fact in the drafted reply originates in the engine, not the model.

```
                ┌─ axg ─▶ extractInquiry   ─▶ configureAxg ─┐
email ─▶ triage ┼─ vy  ─▶ extractVyInquiry ─▶ configureVy  ─┼─▶ draftReply (LLM) ─▶ draft
        (LLM)   └─ unrecognized ─▶ clean decline ───────────┘   conveys facts verbatim
```

`triageInstrument` is a coarse router (Pilot Spec §15.1): it picks the instrument
*before* extraction, because a vortex inquiry and a mag inquiry share almost no fields.
It is biased to **decline when unsure** (§15.2) — steam/gas → vortex, conductive liquid
→ mag, anything ambiguous or out-of-scope → a clean "which instrument did you mean?"
reply instead of a forced wrong answer. `runInquiry(email)` runs the whole routed flow;
`runEmail(email)` is the AXG-only shortcut.

## How the anti-hallucination guarantee is enforced here

- **Extraction** uses Anthropic **structured outputs** (`output_config.format` with a
  JSON schema mirroring `AxgInquiry`). The model returns only schema-valid fields and
  signals "not stated" with `null` — it is prompted to never infer or fill defaults.
- **Reply** is handed a *facts packet* built from the engine result and is constrained
  to convey it verbatim — reproduce the part number character-for-character, surface
  escalations honestly, never claim a gate that says "ask/escalate" is confirmed.

Model: `claude-opus-4-8`.

## Run it (live)

Needs the SDK installed and a key:

```bash
cd axg-sales-assistant/llm
npm install
export ANTHROPIC_API_KEY=sk-ant-...

node run.ts "Need a 2-inch wafer mag, explosion proof, HART. 316 wetted fine."
node run.ts ./inquiry.txt      # a file path
echo "..." | node run.ts       # or stdin
```

Prints the extracted inquiry, the engine result, and the drafted reply (for review).

## Test it (offline, no key)

```bash
npm test     # node --test test/*.test.ts
```

The tests inject a **fake client**, so they run with no SDK call and no key. They
verify the wiring — extraction maps the model's JSON into an `AxgInquiry`, the engine
produces the facts, and those exact facts reach the reply-writer. They deliberately do
**not** test model output quality; that needs live calls against the validation set
(Pilot Spec §10: 10 real inquiry emails, judged by a salesperson).

## Files

- `src/schema.ts` — the structured-output schema + `cleanInquiry` (null → undefined).
- `src/extract.ts` — `extractInquiry(email)` → `AxgInquiry`.
- `src/reply.ts` — `draftReply(email, result)` + `factsPacket`.
- `src/pipeline.ts` — `runEmail(email)` → `{ inquiry, result, draft }`.
- `src/client.ts` — injectable `LlmClient`; lazy default Anthropic client.
- `run.ts` — CLI. `test/llm.test.ts` — offline wiring tests.
</content>
