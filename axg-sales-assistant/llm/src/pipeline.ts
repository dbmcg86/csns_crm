// The full inquiry → draft pipeline: email in, structured spec + validated result
// + drafted reply out. The LLM brackets the engine (extract before, reply after);
// every fact in the middle comes from the deterministic engine, never the model.

import { configureAxg } from '../../engine/src/axg.ts';
import type { AxgInquiry, EngineResult } from '../../engine/src/types.ts';
import type { LlmClient } from './client.ts';
import { extractInquiry } from './extract.ts';
import { draftReply } from './reply.ts';

export interface PipelineResult {
  inquiry: AxgInquiry;
  result: EngineResult;
  draft: string;
}

export interface PipelineOptions {
  client?: LlmClient;
}

export async function runEmail(emailText: string, opts: PipelineOptions = {}): Promise<PipelineResult> {
  const inquiry = await extractInquiry(emailText, { client: opts.client }); // LLM
  const result = configureAxg(inquiry); // deterministic engine — the source of every fact
  const draft = await draftReply(emailText, result, { client: opts.client }); // LLM
  return { inquiry, result, draft };
}
