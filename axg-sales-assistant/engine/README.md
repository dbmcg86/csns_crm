# AXG Engine (Phase 1)

The deterministic configurator from the Pilot Spec — the project's "trust foundation."
It assembles and validates the AXG model code **in code, reading the JSON truth layer**
(`../data/*.json`); no LLM, no network, fully deterministic.

## Run the tests

Requires Node ≥ 22 (runs TypeScript directly via type-stripping; no install needed):

```bash
cd axg-sales-assistant/engine
npm test          # → node --test test/*.test.ts
```

## Try it yourself (interactive)

`demo.ts` is a personal test harness — throw inquiries at the real engine and see the
validated output (model code with per-position provenance, part number, gates, flags,
open questions):

```bash
cd axg-sales-assistant/engine

node demo.ts                      # run all 4 built-in demo scenarios
node demo.ts list                 # list the built-in scenarios
node demo.ts scenario 3           # run one of them

# build your own inquiry from flags:
node demo.ts --size 6 --conn flange --area haz --fluid "nitric acid" --temp 80 --output HART
node demo.ts --size 10 --conn wafer        # watch an illegal combo get BLOCKED
node demo.ts --size 4 --conn flange --construction remote_axg1a   # remote → signal cable
```

Flags: `--size <in>` / `--size-mm <mm>`, `--conn wafer|flange`, `--rating 150|300`,
`--area gp|haz` (omit = unstated → holds `-C`), `--fluid "…"`, `--temp <C>`,
`--cond <µS/cm>`, `--flow <gpm>`, `--abrasive`, `--electrode "…"`,
`--construction integral|remote_axg1a|remote_axg4a|remote_axfa11`,
`--accuracy standard|high`, `--grounding yes|no`, `--power ac|dc_24`,
`--competitor "rosemount_8705|foxboro|endress"`, `--output "…"`.

## Use it

```ts
import { configureAxg } from './src/index.ts';

const result = configureAxg({
  sizeInch: 6,
  connectionType: 'flange',
  fluid: 'high-pH coal-ash rinse water',
  temperatureMaxC: 66,
  conductivityUScm: 5000,
  flowGpm: 600,
  abrasiveOrSlurry: true,
});

console.log(result.modelCode?.partNumber); // assembled ERP part number
console.log(result.gates);                 // conductivity / compatibility / velocity
console.log(result.flags);                 // warnings + blocked deviations
console.log(result.questions);             // open questions for the reply
```

## What it does (and deliberately does not)

Does: defaults with `customer > default > ask` precedence and provenance tags; fail-safe
`-C`; 16-position assembly; cross-position validation (connection size ranges + exclusions,
tungsten small-size, accuracy-C restriction, use↔explosion, remote-sensor blanks);
blocked-with-alternatives deviations; companion signal cable; conductivity / compatibility /
velocity gates; competitor retrofit fit verdict; normalized `EngineResult`.

Does **not** decide chemical compatibility — the compatibility gate *flags and routes to a
human*, per Spec §8. It must resolve against a verified resistance reference, never memory.

## Files

- `src/types.ts` — the result contract (`EngineResult`) + the `AxgInquiry` input.
- `src/truth.ts` — typed loaders/parsers over `../data/*.json` (single source of truth).
- `src/axg.ts` — the AXG configurator + gates.
- `test/axg.test.ts` — demo-scenario reproductions + rule-derived edge cases.

## Limit

These tests prove self-consistency against the truth layer. Production acceptance
(Spec §10) still needs ≥20 historically-quoted codes + 10 real inquiry emails from Allied.
</content>
