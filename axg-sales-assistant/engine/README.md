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
