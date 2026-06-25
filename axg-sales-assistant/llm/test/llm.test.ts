// Offline tests for the language layer. A fake LlmClient stands in for the
// Anthropic SDK — no key, no network. These verify the wiring: extraction maps
// the model's JSON into an AxgInquiry, the engine produces the facts, and those
// exact facts are handed to the reply-writer. They do NOT test model quality
// (that needs live calls + the validation set from Pilot Spec §10).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractInquiry } from '../src/extract.ts';
import { runEmail } from '../src/pipeline.ts';
import { factsPacket } from '../src/reply.ts';
import { AXG_INQUIRY_SCHEMA } from '../src/schema.ts';
import { configureAxg } from '../../engine/src/axg.ts';
import type { LlmClient } from '../src/client.ts';

// A 2" XP wafer inquiry as the extractor would return it (nulls = "not stated").
const WAFER_XP_JSON = {
  sizeInch: 2, sizeMm: null, connectionType: 'wafer', connectionRating: null,
  area: 'hazardous', electrodeMaterial: '316', groundingRings: null, powerSupply: null,
  construction: null, accuracy: 'standard', fluid: null, temperatureMaxC: null,
  conductivityUScm: null, flowGpm: null, abrasiveOrSlurry: null, outputType: 'HART',
  competitorBrand: null, competitorModel: null,
};

function fakeClient(inquiryJson: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any[] = [];
  const client: LlmClient = {
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: async (params: any) => {
        calls.push(params);
        // extraction calls carry output_config (structured output); reply calls don't
        if (params.output_config) {
          return { content: [{ type: 'text', text: JSON.stringify(inquiryJson) }] };
        }
        return { content: [{ type: 'text', text: 'DRAFT REPLY' }] };
      },
    },
  };
  return { client, calls };
}

test('extraction maps the model JSON to an AxgInquiry and drops "not stated" nulls', async () => {
  const { client } = fakeClient(WAFER_XP_JSON);
  const inq = await extractInquiry('Need a 2" XP wafer mag, HART, 316 wetted, standard accuracy.', { client });
  assert.equal(inq.sizeInch, 2);
  assert.equal(inq.connectionType, 'wafer');
  assert.equal(inq.area, 'hazardous');
  assert.equal(inq.electrodeMaterial, '316');
  assert.equal(inq.outputType, 'HART');
  assert.ok(!('fluid' in inq), 'null fields must be dropped, not passed as null');
  assert.ok(!('sizeMm' in inq));
});

test('extraction uses the structured-output schema and the configured model', async () => {
  const { client, calls } = fakeClient(WAFER_XP_JSON);
  await extractInquiry('anything', { client });
  assert.equal(calls[0].model, 'claude-opus-4-8');
  assert.equal(calls[0].output_config.format.type, 'json_schema');
});

test('pipeline runs extract → engine → reply, and the engine facts reach the reply-writer', async () => {
  const { client, calls } = fakeClient(WAFER_XP_JSON);
  const { inquiry, result, draft } = await runEmail('Need a 2" XP wafer mag, HART.', { client });

  // engine produced the validated facts (not the model)
  assert.equal(result.modelCode!.partNumber, 'AXG050-CAFF2AA1AL212B-1JA11/GRL');
  assert.equal(inquiry.connectionType, 'wafer');
  assert.equal(draft, 'DRAFT REPLY');

  // the reply call (second create, no output_config) must carry the engine's exact part number
  const replyCall = calls.find((c) => !c.output_config);
  assert.ok(replyCall, 'expected a reply-writer call');
  assert.match(replyCall.messages[0].content, /AXG050-CAFF2AA1AL212B-1JA11\/GRL/);
});

test('factsPacket carries the part number, a gate, and the open questions', () => {
  const result = configureAxg({ sizeInch: 3, connectionType: 'flange', area: 'hazardous', fluid: '50% nitric acid', temperatureMaxC: 80 });
  const packet = factsPacket(result);
  assert.match(packet, /part_number:/);
  assert.match(packet, /compatibility \[fail\]/); // permeable fluid escalates — must surface honestly
  assert.match(packet, /open_questions:/);
});

test('inquiry schema is well-formed structured output (all properties required + closed)', () => {
  assert.equal(AXG_INQUIRY_SCHEMA.additionalProperties, false);
  const props = Object.keys(AXG_INQUIRY_SCHEMA.properties);
  assert.deepEqual([...AXG_INQUIRY_SCHEMA.required].sort(), props.sort());
});
