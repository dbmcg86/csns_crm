// LLM touchpoint #1: read a messy inquiry into a structured AxgInquiry.
// The model maps plain English onto the product taxonomy and identifies what is
// missing — it does NOT infer engineering facts, fill defaults, or produce codes.
// Defaults and validation are the engine's job (Pilot Spec §2, §6).

import type { AxgInquiry } from '../../engine/src/types.ts';
import { defaultClient, firstText, MODEL, type LlmClient } from './client.ts';
import { AXG_INQUIRY_SCHEMA, cleanInquiry } from './schema.ts';

const SYSTEM = `You read inbound sales inquiries for Yokogawa AXG magnetic flowmeters and extract a STRUCTURED SPECIFICATION. You are a careful reader, not an engineer.

STRICT RULES:
- Extract ONLY what the customer explicitly states or unambiguously means. Map plain English onto the fields (e.g. "explosion proof" / "XP" / "hazardous area" -> area: "hazardous"; "general purpose" / "non-hazardous" -> area: "general_purpose"; "2 inch" -> sizeInch: 2; "316 / 316L / stainless" -> electrodeMaterial as written).
- If something is NOT stated, return null for that field. NEVER guess, infer, or fill a default. "Probably" is not stated.
- Do NOT decide materials, model codes, ratings, or suitability — that is done downstream by a deterministic engine. You only transcribe what the customer said into fields.
- area is "hazardous" only if the customer indicates a classified/explosion-proof area; "general_purpose" only if they say it is non-hazardous/general-purpose; otherwise null.
- abrasiveOrSlurry: true only if the fluid is described as abrasive, slurry, or carrying suspended solids; otherwise null.
- competitorBrand/Model: only if they mention replacing an existing meter.

Return the structured object. Use null for every field the customer did not state.`;

export interface ExtractOptions {
  client?: LlmClient;
}

export async function extractInquiry(emailText: string, opts: ExtractOptions = {}): Promise<AxgInquiry> {
  const client = opts.client ?? (await defaultClient());
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: AXG_INQUIRY_SCHEMA } },
    messages: [{ role: 'user', content: emailText }],
  });
  const raw = JSON.parse(firstText(resp)) as Record<string, unknown>;
  return cleanInquiry(raw);
}
