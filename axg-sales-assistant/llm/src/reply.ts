// LLM touchpoint #2: phrase a draft reply from the engine's structured result.
// The reply-writer conveys EXACTLY the facts the engine produced — the model
// code, part number, gate verdicts, flags, and open questions are fixed content
// it must carry, never generate (Pilot Spec §2, §14.4). It phrases and sets tone.

import type { EngineResult } from '../../engine/src/types.ts';
import { defaultClient, firstText, MODEL, type LlmClient } from './client.ts';

const SYSTEM = `You draft an Allied Instrumentation sales reply from a STRUCTURED RESULT a deterministic engine produced. A human reviews and sends it — you are writing a draft.

ABSOLUTE RULES:
- Convey EXACTLY the facts in the result. The model code, part number, position meanings, gate verdicts, flags, and open questions are FIXED CONTENT — carry them faithfully. NEVER invent, alter, or "correct" a code, part number, dimension, material, or verdict.
- Reproduce the part number CHARACTER-FOR-CHARACTER. If it is marked provisional, say the quote is provisional and why.
- If a gate is "ask" or "fail/escalate", do NOT claim that aspect is confirmed. An escalation must be surfaced honestly (e.g. materials routed to engineering), never smoothed over into a confident quote.
- Include every open question the result lists.
- If the result is fatal (no model code), explain what is needed and ask for it; do not fabricate a configuration.

STYLE: professional, concise, warm. Plain text email body only — no subject line, no markdown, no preamble like "Here is the draft". Sign as "Allied Instrumentation".`;

/** A compact, faithful packet of the engine's facts for the reply-writer to convey. */
export function factsPacket(result: EngineResult): string {
  const lines: string[] = [];
  lines.push(`instrument: ${result.instrument}`);
  if (result.fatal) lines.push(`FATAL (no model code): ${result.fatal}`);
  if (result.modelCode) {
    lines.push(`part_number: ${result.modelCode.partNumber}${result.modelCode.provisional ? ' (PROVISIONAL)' : ''}`);
    lines.push('positions:');
    for (const p of result.modelCode.positions) {
      lines.push(`  - ${p.name}: ${p.code} [${p.source}] — ${p.description}`);
    }
  }
  if (result.gates.length) {
    lines.push('gates:');
    for (const g of result.gates) lines.push(`  - ${g.id} [${g.status}]: ${g.detail}`);
  }
  if (result.flags.length) {
    lines.push('flags:');
    for (const f of result.flags) {
      lines.push(`  - ${f.kind} [${f.severity}]: ${f.detail}${f.alternatives?.length ? ` (alternatives: ${f.alternatives.join(', ')})` : ''}`);
    }
  }
  if (result.companionItems.length) {
    lines.push('companion_items:');
    for (const c of result.companionItems) lines.push(`  - ${c.role}: ${c.partNumber}${c.note ? ` — ${c.note}` : ''}`);
  }
  if (result.questions.length) {
    lines.push('open_questions:');
    for (const q of result.questions) lines.push(`  - ${q}`);
  }
  return lines.join('\n');
}

export interface ReplyOptions {
  client?: LlmClient;
}

export async function draftReply(
  emailText: string,
  result: EngineResult,
  opts: ReplyOptions = {},
): Promise<string> {
  const client = opts.client ?? (await defaultClient());
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content:
          `CUSTOMER INQUIRY:\n${emailText}\n\n` +
          `ENGINE RESULT (the facts you must convey — do not change any of them):\n${factsPacket(result)}\n\n` +
          `Write the draft reply.`,
      },
    ],
  });
  return firstText(resp).trim();
}
