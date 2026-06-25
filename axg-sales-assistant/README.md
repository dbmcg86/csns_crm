# AXG Sales Assistant

Working artifacts for **Allied Instrumentation's** sales/quoting assistant — a tool that
turns a customer inquiry (a pasted email or a nameplate photo) into a *validated* draft
quote for Yokogawa instruments and quarter-turn valve assemblies.

The guiding principle across all of this: **the model reads the inquiry; the engine holds
the facts.** Every model code, dimension, torque value, and rule comes from a verified
"truth layer" (the JSON data files), never from the model's memory. Outputs are always
drafts for human review.

## What's here

```
axg-sales-assistant/
├── prototypes/        Self-contained HTML prototypes (open in a browser)
│   ├── axg_quoting_tool.html      Live quoting assistant — paste an inquiry, get a model
│   │                              code + ERP part number. Covers AXG mag meters, EJA530E
│   │                              pressure transmitters, VY vortex meters, and valves.
│   ├── axg_demo.html              Scripted walkthrough demo (4 canned inquiries) showing
│   │                              the inbox → extract → defaults → interlocks → gates →
│   │                              drafted-reply pipeline with the reasoning surfaced.
│   └── datasheet_to_markdown.html PDF → Markdown ingest tool. Pulls text (or reads pages
│                                  visually), rebuilds tables, shows raw vs. clean so a
│                                  human can verify before onboarding a new instrument.
│
├── data/              The truth layer (verified reference data the engine reads from)
│   ├── axg_model_code.json        AXG mag meter: 16 ordered positions, allowed codes,
│   │                              cross-position interlocks, Allied house defaults (each
│   │                              source-tagged), companion items, optional codes, and the
│   │                              full explosion-protection restriction table.
│   ├── eja530e_model_code.json    EJA530E pressure transmitter model code + defaults.
│   ├── vy_model_code.json         VY vortex flowmeter model code + defaults.
│   └── valve_rules.json           Quarter-turn valve assemblies: torque tables, actuator
│                                  outputs, severe-service factors, field-proven stock
│                                  builds, trim packages, verified assembly numbers.
│
└── docs/
    ├── AXG_Sales_Assistant_Pilot_Spec.md   The product spec: the two-layer architecture
    │                                        (LLM language layer + deterministic truth-layer
    │                                        engine), pilot scope, deviation logic, the
    │                                        compatibility gate, and the platform/scaling plan.
    └── AXG_Verification_Checklist.md        The to-do list that moves the pilot data from
                                             "draft" to "trustworthy" — verified items vs.
                                             what still needs Allied sign-off.
```

## Truth-layer files

The configurator/model-code truth layers are now captured: `axg_model_code.json`,
`eja530e_model_code.json`, `vy_model_code.json`, and `valve_rules.json`.

Two files referenced by the spec and prototypes are **not yet in this repo**:

- `axg_dimensions_retrofit.json` — lay lengths + competitor cross-reference for retrofit fit
- `axg_application_rules.json` — application gates (conductivity, compatibility, red flags)

In the prototypes the AXG/EJA/VY data is currently *inlined* as JavaScript constants (e.g.
`DEF`, `COND_FLOOR`, `LAY`, `CAPSULES`, `VY_DEF`) rather than read from these JSON files.
Wiring the prototypes (or a real app) to load the JSON as the single source of truth — per
the spec's non-negotiable engine/content split — is the core of turning these into a product.

## Status

These are **prototypes**, not a deployed product. See `docs/AXG_Verification_Checklist.md`
for the open data-verification and business-judgment items. To run a prototype, just open
the `.html` file in a browser (the live tools call the Anthropic API for inquiry parsing).
</content>
</invoke>
