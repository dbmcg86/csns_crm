// Public entry point for the AXG/VY language layer (Phase 2/3 + routing).
export { extractInquiry, extractVyInquiry } from './extract.ts';
export { triageInstrument, type Instrument, type Triage } from './triage.ts';
export { draftReply, factsPacket } from './reply.ts';
export { runEmail, runInquiry } from './pipeline.ts';
export type { PipelineResult, RoutedResult } from './pipeline.ts';
export { AXG_INQUIRY_SCHEMA, VY_INQUIRY_SCHEMA, cleanInquiry, cleanVyInquiry } from './schema.ts';
export { MODEL, type LlmClient } from './client.ts';
