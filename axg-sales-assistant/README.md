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
│   └── valve_rules.json           Quarter-turn valve assemblies: torque tables, actuator
│                                  outputs, severe-service factors, field-proven stock
│                                  builds, trim packages, verified assembly numbers.
│
└── docs/
    └── AXG_Verification_Checklist.md   The to-do list that moves the pilot data from
                                        "draft" to "trustworthy" — what's verified vs.
                                        what still needs Allied sign-off.
```

## Truth-layer files

`valve_rules.json` is the only truth-layer file currently captured here. The prototypes
and checklist reference sibling files that are **not yet in this repo**:

- `axg_model_code.json` — AXG mag meter 16-position model code, defaults, interlocks
- `axg_dimensions_retrofit.json` — lay lengths + competitor cross-reference for retrofit fit
- `axg_application_rules.json` — application gates (conductivity, compatibility, red flags)
- `vy_model_code.json` — VY vortex model code

In the prototypes these are currently inlined as JavaScript constants (e.g. `DEF`,
`COND_FLOOR`, `LAY`, `CAPSULES`, `VY_DEF`). Promoting them to standalone JSON, like
`valve_rules.json`, is part of turning these prototypes into a real app.

## Status

These are **prototypes**, not a deployed product. See `docs/AXG_Verification_Checklist.md`
for the open data-verification and business-judgment items. To run a prototype, just open
the `.html` file in a browser (the live tools call the Anthropic API for inquiry parsing).
</content>
</invoke>
