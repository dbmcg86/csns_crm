# AXG Sales Assistant — agent guide

This repo is the **Allied Instrumentation AXG Sales Assistant**: it turns a customer
inquiry into a *validated* draft quote for Yokogawa instruments and quarter-turn valve
assemblies. Everything lives under `axg-sales-assistant/`.

(There is no web app or Next.js here — an unrelated CRM intake form was removed; ignore
any older instructions that mention Next.js or `node_modules/next`.)

## The one non-negotiable rule

**The model reads and phrases; the engine holds and validates every fact.** Model codes,
dimensions, ratings, part numbers, assembly numbers, and compatibility verdicts are
*looked up and computed by deterministic code*, never produced by the LLM. The LLM does
exactly two things, both phrasing-not-deciding: (1) read an email into a structured
inquiry, and (2) draft a reply from the engine's structured result. If you find yourself
letting the model generate a code or a number, stop — that's the core failure this project
is designed against.

## Layout

```
axg-sales-assistant/
├── engine/   Deterministic configurator (TypeScript, zero runtime deps)
│   ├── src/  per-instrument: axg, vy, eja, valve (+ *Truth.ts loaders), types.ts
│   ├── test/ node:test suites; *-demo.ts are CLI harnesses
├── llm/      Language layer (uses @anthropic-ai/sdk): triage → extract → reply
│   ├── src/  triage.ts, extract.ts, reply.ts, pipeline.ts (runInquiry), schema.ts
│   ├── test/ offline tests with an injected fake client
├── data/     JSON truth layer — one file set per instrument family (the source of truth)
├── docs/     AXG_Sales_Assistant_Pilot_Spec.md (the intent) + verification checklist
└── prototypes/  original standalone HTML prototypes (not engine-backed)
```

The engine is instrument-agnostic in shape: every `configure*` returns the shared
`EngineResult` contract (model code | computed sizing | multi-item assembly + gates,
flags, questions). Adding a result shape is additive — see how VY added `computed` and
valves added `assembly`/`assemblyNumber` without touching the others.

## Running things

Requires **Node ≥ 22** (runs the TypeScript directly via type-stripping). The engine needs
**no install**; the LLM layer needs `npm install` (the Anthropic SDK) and a key for live runs.

```bash
# engine — tests + interactive CLIs (no key, no network)
cd axg-sales-assistant/engine
node --test test/*.test.ts
node demo.ts          # AXG    node vy-demo.ts   # vortex
node eja-demo.ts      # pressure   node valve-demo.ts # valves

# llm — offline tests use a fake client (no key); live needs a key
cd axg-sales-assistant/llm
npm test
npm install && export ANTHROPIC_API_KEY=sk-ant-... && node run.ts "<inquiry>"
```

Use model `claude-opus-4-8` for any LLM work (see the `claude-api` skill before changing
API calls). LLM source must keep the SDK lazily imported / injectable so offline tests run
without a key.

## Conventions to preserve when extending

- **Truth in JSON, not code.** Read sizes, ranges, codes, and defaults from `data/*.json`.
  Don't hard-code facts that belong in the truth layer.
- **Defaults carry provenance** (`customer` / `default` / `rule` / `provisional`) and are
  override-only where safety is one-directional (AXG `-C`, VY `FF1`, EJA `/FU1`).
- **Lookup, never generate** verified part/assembly numbers; if none is on file, flag it.
- **Gates escalate, never decide** — especially chemical compatibility (must resolve
  against a verified resistance reference, which is still an open item).
- **Fatal, not a guess** — missing a required input (e.g. line size) returns `fatal`.
- Add a new instrument by adding `data/<x>.json` + `engine/src/<x>.ts` (+ `*Truth.ts`) +
  tests, then wiring it into `llm/src/triage.ts` + an extractor. Touch nothing else.

## Git

Work on the feature branch already in use. Run both test suites before committing; keep
`node_modules/` out of git (the llm package has its own `.gitignore`).
</content>
