// Instrument triage (Pilot Spec §15.1): a coarse routing pass BEFORE extraction.
// Different instruments share almost no fields, so we must know what kind of meter
// this is before running a specialized extractor. The rule is "recognize confidently,
// decline humbly" (§15.2) — bias toward "unrecognized" when genuinely unsure rather
// than forcing an inquiry into the wrong extractor.

import { defaultClient, firstText, MODEL, type LlmClient } from './client.ts';

export type Instrument = 'axg' | 'vy' | 'unrecognized';

export interface Triage {
  instrument: Instrument;
  reason: string;
}

const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['instrument', 'reason'],
  properties: {
    instrument: { type: 'string', enum: ['axg', 'vy', 'unrecognized'] },
    reason: { type: 'string' },
  },
} as const;

const SYSTEM = `You route an inbound flow-meter inquiry to the right instrument. You classify ONLY — you do not extract details or quote.

Choose one:
- "axg" — a MAGNETIC flowmeter (Yokogawa AXG). Mag meters measure CONDUCTIVE LIQUIDS (water, slurry, chemicals, wastewater). Pick this if the customer says "mag meter"/"magnetic", or describes a conductive liquid line and a mag is appropriate.
- "vy" — a VORTEX flowmeter (Yokogawa VY). Pick this for STEAM (saturated or superheated) or GAS — a magnetic meter physically CANNOT measure steam or gas (non-conductive). Also pick it if the customer explicitly says "vortex".
- "unrecognized" — anything else, or genuinely ambiguous: a different instrument (pressure, level, temperature, valve), a non-flow request, or not enough signal to tell mag vs vortex confidently.

KEY RULE: steam or gas => "vy", never "axg". A conductive liquid with no vortex cue => "axg". When you cannot tell confidently, choose "unrecognized" and say what you'd need — do NOT guess. A wrong route sends the inquiry to the wrong extractor and produces a plausible wrong answer.

Give a one-sentence reason.`;

export interface TriageOptions {
  client?: LlmClient;
}

export async function triageInstrument(emailText: string, opts: TriageOptions = {}): Promise<Triage> {
  const client = opts.client ?? (await defaultClient());
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: TRIAGE_SCHEMA } },
    messages: [{ role: 'user', content: emailText }],
  });
  return JSON.parse(firstText(resp)) as Triage;
}
