// The inquiry → draft pipeline. Two entry points:
//   runInquiry(email)  — ROUTED: triage the instrument, then run the matching
//                        extractor + engine + reply. Handles AXG and VY, and
//                        declines cleanly on anything it can't route.
//   runEmail(email)    — AXG-only shortcut (kept for callers that know it's a mag).
//
// In every case the LLM brackets the engine (extract before, reply after); every
// fact in the middle comes from the deterministic engine, never the model.

import { configureAxg } from '../../engine/src/axg.ts';
import { configureVy } from '../../engine/src/vy.ts';
import type { AxgInquiry, EngineResult, VyInquiry } from '../../engine/src/types.ts';
import type { LlmClient } from './client.ts';
import { extractInquiry, extractVyInquiry } from './extract.ts';
import { draftReply } from './reply.ts';
import { triageInstrument, type Instrument } from './triage.ts';

export interface PipelineOptions {
  client?: LlmClient;
}

// --- AXG-only shortcut (unchanged) ---
export interface PipelineResult {
  inquiry: AxgInquiry;
  result: EngineResult;
  draft: string;
}

export async function runEmail(emailText: string, opts: PipelineOptions = {}): Promise<PipelineResult> {
  const inquiry = await extractInquiry(emailText, { client: opts.client });
  const result = configureAxg(inquiry);
  const draft = await draftReply(emailText, result, { client: opts.client });
  return { inquiry, result, draft };
}

// --- Routed pipeline (handles AXG, VY, or a clean decline) ---
export interface RoutedResult {
  instrument: Instrument;
  triageReason: string;
  inquiry?: AxgInquiry | VyInquiry;
  result?: EngineResult;
  draft: string;
}

export async function runInquiry(emailText: string, opts: PipelineOptions = {}): Promise<RoutedResult> {
  const client = opts.client;
  const triage = await triageInstrument(emailText, { client });

  if (triage.instrument === 'axg') {
    const inquiry = await extractInquiry(emailText, { client });
    const result = configureAxg(inquiry);
    const draft = await draftReply(emailText, result, { client });
    return { instrument: 'axg', triageReason: triage.reason, inquiry, result, draft };
  }

  if (triage.instrument === 'vy') {
    const inquiry = await extractVyInquiry(emailText, { client });
    const result = configureVy(inquiry);
    const draft = await draftReply(emailText, result, { client });
    return { instrument: 'vy', triageReason: triage.reason, inquiry, result, draft };
  }

  // unrecognized — recognize and decline cleanly, don't force it into an extractor
  const draft =
    `Thanks for the inquiry. ${triage.reason} ` +
    `Could you confirm the instrument type — a magnetic flowmeter (for conductive liquids) ` +
    `or a vortex flowmeter (for steam/gas) — and the key process details? ` +
    `Then I can put together an accurate quote.\n\nBest regards,\nAllied Instrumentation`;
  return { instrument: 'unrecognized', triageReason: triage.reason, draft };
}
