# AXG Sales Assistant

This repository holds the **Allied Instrumentation AXG Sales Assistant** — a tool that
turns a customer inquiry into a *validated* draft quote for Yokogawa instruments and
quarter-turn valve assemblies, on a strict two-layer architecture: the LLM reads and
phrases; a deterministic engine holds and validates every fact.

Everything lives under [`axg-sales-assistant/`](axg-sales-assistant/) — start with its
[README](axg-sales-assistant/README.md) and [PLAN](axg-sales-assistant/PLAN.md).

```
axg-sales-assistant/
├── engine/   Deterministic configurator (TypeScript, zero-dep, tested) — AXG mag,
│             VY vortex, EJA530E pressure, quarter-turn valves
├── llm/      Language layer — triage routing + email extraction + reply drafting
├── data/     The JSON truth layer (one file set per instrument family)
├── prototypes/  Original standalone HTML prototypes
└── docs/     Pilot spec + verification checklist
```

> Note: this repo previously also contained an unrelated Central Service & Supply CRM
> intake form (a Next.js app). It was removed; its history remains in git.
</content>
