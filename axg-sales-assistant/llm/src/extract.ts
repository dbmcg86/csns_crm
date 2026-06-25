// LLM touchpoint #1: read a messy inquiry into a structured engine inquiry.
// The model maps plain English onto the product taxonomy and identifies what is
// missing — it does NOT infer engineering facts, fill defaults, or produce codes.
// Defaults and validation are the engine's job (Pilot Spec §2, §6).

import type { AxgInquiry, EjaInquiry, VyInquiry } from '../../engine/src/types.ts';
import { defaultClient, firstText, MODEL, type LlmClient } from './client.ts';
import { AXG_INQUIRY_SCHEMA, EJA_INQUIRY_SCHEMA, VY_INQUIRY_SCHEMA, cleanInquiry, cleanEjaInquiry, cleanVyInquiry } from './schema.ts';

export interface ExtractOptions {
  client?: LlmClient;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractWith(emailText: string, system: string, schema: any, client: LlmClient): Promise<Record<string, unknown>> {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: emailText }],
  });
  return JSON.parse(firstText(resp)) as Record<string, unknown>;
}

const AXG_SYSTEM = `You read inbound sales inquiries for Yokogawa AXG magnetic flowmeters and extract a STRUCTURED SPECIFICATION. You are a careful reader, not an engineer.

STRICT RULES:
- Extract ONLY what the customer explicitly states or unambiguously means. Map plain English onto the fields (e.g. "explosion proof" / "XP" / "hazardous area" -> area: "hazardous"; "general purpose" / "non-hazardous" -> area: "general_purpose"; "2 inch" -> sizeInch: 2; "316 / 316L / stainless" -> electrodeMaterial as written).
- If something is NOT stated, return null for that field. NEVER guess, infer, or fill a default.
- Do NOT decide materials, model codes, ratings, or suitability — that is done downstream by a deterministic engine. You only transcribe what the customer said into fields.
- area is "hazardous" only if the customer indicates a classified/explosion-proof area; "general_purpose" only if they say it is non-hazardous/general-purpose; otherwise null.
- abrasiveOrSlurry: true only if the fluid is described as abrasive, slurry, or carrying suspended solids; otherwise null.
- competitorBrand/Model: only if they mention replacing an existing meter.

Return the structured object. Use null for every field the customer did not state.`;

const VY_SYSTEM = `You read inbound sales inquiries for Yokogawa VY vortex flowmeters and extract a STRUCTURED SPECIFICATION. You are a careful reader, not an engineer.

STRICT RULES:
- Extract ONLY what the customer explicitly states or unambiguously means. Map plain English onto the fields:
  - "3 inch" / "DN80" -> sizeInch / sizeMm.
  - steam pressure like "150 psi steam" / "150 psig saturated steam" -> steamPressurePsig: 150.
  - a steam mass flow like "5000 lb/hr" / "5000 pounds per hour" / "5000 #/hr" -> steamMassLbHr: 5000.
  - a liquid volumetric flow like "70 gpm" -> flowGpm: 70.
  - "explosion proof" / "hazardous" -> area: "hazardous"; "general purpose" -> "general_purpose".
  - "remote mount" / "transmitter mounted away" -> mount: "remote"; a cable run like "60 ft" / "18 m" -> cableLengthM (convert feet to metres if needed).
  - "mass flow" / "energy flow" / "temperature compensated" -> tempCompensated: "yes" only if explicitly required.
- If something is NOT stated, return null for that field. NEVER guess, infer, or fill a default.
- Do NOT decide materials, codes, sizing, or whether the meter will read — that is the deterministic engine's job. You only transcribe.

Return the structured object. Use null for every field the customer did not state.`;

const EJA_SYSTEM = `You read inbound sales inquiries for Yokogawa EJA530E gauge pressure transmitters and extract a STRUCTURED SPECIFICATION. You are a careful reader, not an engineer.

STRICT RULES:
- Extract ONLY what the customer explicitly states or unambiguously means. Map plain English onto the fields:
  - a pressure range/span like "0-100 psi" / "100 psi range" / "span of 100 psi" -> requiredSpanPsi: 100 (the top of a zero-start range). Convert other units to psi if needed (1 bar ≈ 14.5 psi, 1 MPa ≈ 145 psi, 1 kPa ≈ 0.145 psi).
  - "explosion proof" / "hazardous" -> area: "hazardous"; "general purpose" -> "general_purpose".
  - "1/2 NPT male" -> pressureConnection: "male"; "1/2 NPT female" -> "female".
  - "mounting bracket" / "pipe mount" -> bracket: "yes"; "no bracket" -> "no".
  - "no display" -> indicator: "no".
- If something is NOT stated, return null for that field. NEVER guess, infer, or fill a default.
- Do NOT decide the capsule, code, calibration, or turndown — the deterministic engine does that from the span. You only transcribe.

Return the structured object. Use null for every field the customer did not state.`;

export async function extractInquiry(emailText: string, opts: ExtractOptions = {}): Promise<AxgInquiry> {
  const client = opts.client ?? (await defaultClient());
  return cleanInquiry(await extractWith(emailText, AXG_SYSTEM, AXG_INQUIRY_SCHEMA, client));
}

export async function extractEjaInquiry(emailText: string, opts: ExtractOptions = {}): Promise<EjaInquiry> {
  const client = opts.client ?? (await defaultClient());
  return cleanEjaInquiry(await extractWith(emailText, EJA_SYSTEM, EJA_INQUIRY_SCHEMA, client));
}

export async function extractVyInquiry(emailText: string, opts: ExtractOptions = {}): Promise<VyInquiry> {
  const client = opts.client ?? (await defaultClient());
  return cleanVyInquiry(await extractWith(emailText, VY_SYSTEM, VY_INQUIRY_SCHEMA, client));
}
