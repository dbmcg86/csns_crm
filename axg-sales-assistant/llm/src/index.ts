// Public entry point for the AXG language layer (Phase 2/3).
export { extractInquiry } from './extract.ts';
export { draftReply, factsPacket } from './reply.ts';
export { runEmail } from './pipeline.ts';
export type { PipelineResult } from './pipeline.ts';
export { AXG_INQUIRY_SCHEMA, cleanInquiry } from './schema.ts';
export { MODEL, type LlmClient } from './client.ts';
