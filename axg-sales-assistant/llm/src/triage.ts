// Instrument triage (Pilot Spec §15.1): a coarse routing pass BEFORE extraction.
// Different instruments share almost no fields, so we must know what kind of meter
// this is before running a specialized extractor. The rule is "recognize confidently,
// decline humbly" (§15.2) — bias toward "unrecognized" when genuinely unsure rather
// than forcing an inquiry into the wrong extractor.

import { defaultClient, firstText, MODEL, type LlmClient } from './client.ts';

export type Instrument = 'axg' | 'vy' | 'eja' | 'unrecognized';

export interface Triage {
  instrument: Instrument;
  reason: string;
}

const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['instrument', 'reason'],
  properties: {
    instrument: { type: 'string', enum: ['axg', 'vy', 'eja', 'unrecognized'] },
    reason: { type: 'string' },
  },
} as const;

const SYSTEM = `You route an inbound instrument inquiry to the right product. You classify ONLY — you do not extract details or quote.

Choose one:
- "axg" — a MAGNETIC flowmeter (Yokogawa AXG). Mag meters measure FLOW of CONDUCTIVE LIQUIDS (water, slurry, chemicals, wastewater). Pick this for "mag meter"/"magnetic", or a conductive liquid flow line where a mag is appropriate.
- "vy" — a VORTEX flowmeter (Yokogawa VY). Pick this for FLOW of STEAM (saturated or superheated) or GAS — a magnetic meter physically CANNOT measure steam or gas (non-conductive). Also pick it if the customer says "vortex".
- "eja" — a PRESSURE TRANSMITTER (Yokogawa EJA530E). Pick this when the customer is measuring PRESSURE (gauge pressure), gives a pressure range/span (e.g. "0-100 psi transmitter"), or asks for a "pressure transmitter"/"pressure gauge transmitter". This measures pressure, NOT flow.
- "unrecognized" — anything else, or genuinely ambiguous: a different instrument (level, temperature, valve, DP/flow-via-DP), a non-instrument request, or not enough signal to tell confidently.

KEY RULES: flow of steam or gas => "vy", never "axg". Flow of a conductive liquid => "axg". A PRESSURE measurement (not flow) => "eja". When you cannot tell confidently, choose "unrecognized" and say what you'd need — do NOT guess. A wrong route sends the inquiry to the wrong extractor and produces a plausible wrong answer.

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
