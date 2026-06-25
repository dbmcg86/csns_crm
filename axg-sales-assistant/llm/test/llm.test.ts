// Offline tests for the language layer. A fake LlmClient stands in for the
// Anthropic SDK — no key, no network. These verify the wiring: triage routes to
// the right instrument, extraction maps the model's JSON into an inquiry, the engine
// produces the facts, and those exact facts reach the reply-writer. They do NOT test
// model quality (that needs live calls + the validation set from Pilot Spec §10).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractInquiry, extractVyInquiry } from '../src/extract.ts';
import { runEmail, runInquiry } from '../src/pipeline.ts';
import { factsPacket } from '../src/reply.ts';
import { AXG_INQUIRY_SCHEMA, VY_INQUIRY_SCHEMA, EJA_INQUIRY_SCHEMA, VALVE_INQUIRY_SCHEMA } from '../src/schema.ts';
import { configureAxg } from '../../engine/src/axg.ts';
import type { LlmClient } from '../src/client.ts';

const WAFER_XP_JSON = {
  sizeInch: 2, sizeMm: null, connectionType: 'wafer', connectionRating: null,
  area: 'hazardous', electrodeMaterial: '316', groundingRings: null, powerSupply: null,
  construction: null, accuracy: 'standard', fluid: null, temperatureMaxC: null,
  conductivityUScm: null, flowGpm: null, abrasiveOrSlurry: null, outputType: 'HART',
  competitorBrand: null, competitorModel: null,
};

const VY_STEAM_JSON = {
  sizeInch: 3, sizeMm: null, connectionType: 'flange', connectionRating: null, area: null,
  fluid: 'saturated steam', temperatureMaxC: null, flowGpm: null, steamPressurePsig: 150,
  steamMassLbHr: 5000, tempCompensated: null, mount: null, cableLengthM: null, outputType: null,
};

const EJA_JSON = {
  requiredSpanPsi: 100, area: 'hazardous', fluid: null, temperatureMaxC: null,
  pressureConnection: null, bracket: null, indicator: null, outputType: null,
};

const VALVE_JSON = {
  family: 'WKM', sizeInch: 6, bodyStyle: null, package: null,
  airPressure: null, location: null, severeService: null,
};

// A fake client that answers all three call types: triage (schema has `instrument`),
// extraction (has output_config), and reply (neither).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeClient(opts: any) {
  const inquiryJson = opts.inquiryJson ?? opts;
  const instrument = opts.instrument ?? 'axg';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any[] = [];
  const client: LlmClient = {
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: async (params: any) => {
        calls.push(params);
        const schema = params.output_config?.format?.schema;
        if (schema?.properties?.instrument) {
          return { content: [{ type: 'text', text: JSON.stringify({ instrument, reason: 'test triage' }) }] };
        }
        if (params.output_config) {
          return { content: [{ type: 'text', text: JSON.stringify(inquiryJson) }] };
        }
        return { content: [{ type: 'text', text: 'DRAFT REPLY' }] };
      },
    },
  };
  return { client, calls };
}

// ---- extraction ----
test('AXG extraction maps the model JSON to an inquiry and drops nulls', async () => {
  const { client } = fakeClient(WAFER_XP_JSON);
  const inq = await extractInquiry('2" XP wafer mag, HART, 316.', { client });
  assert.equal(inq.sizeInch, 2);
  assert.equal(inq.area, 'hazardous');
  assert.ok(!('fluid' in inq));
});

test('VY extraction maps steam fields (pressure + lb/hr)', async () => {
  const { client } = fakeClient({ instrument: 'vy', inquiryJson: VY_STEAM_JSON });
  const inq = await extractVyInquiry('vortex, steam 5000 lb/hr, 150 psig, 3 inch', { client });
  assert.equal(inq.sizeInch, 3);
  assert.equal(inq.steamPressurePsig, 150);
  assert.equal(inq.steamMassLbHr, 5000);
  assert.ok(!('mount' in inq));
});

test('extraction uses structured output + the configured model', async () => {
  const { client, calls } = fakeClient(WAFER_XP_JSON);
  await extractInquiry('anything', { client });
  assert.equal(calls[0].model, 'claude-opus-4-8');
  assert.equal(calls[0].output_config.format.type, 'json_schema');
});

// ---- routed pipeline ----
test('routed pipeline sends a mag inquiry through AXG', async () => {
  const { client } = fakeClient({ instrument: 'axg', inquiryJson: WAFER_XP_JSON });
  const routed = await runInquiry('Need a 2" XP wafer mag, HART.', { client });
  assert.equal(routed.instrument, 'axg');
  assert.equal(routed.result!.modelCode!.partNumber, 'AXG050-CAFF2AA1AL212B-1JA11/GRL');
  assert.equal(routed.draft, 'DRAFT REPLY');
});

test('routed pipeline sends a steam inquiry through VY, and the computed verdict reaches the reply', async () => {
  const { client, calls } = fakeClient({ instrument: 'vy', inquiryJson: VY_STEAM_JSON });
  const routed = await runInquiry('Vortex on steam, 5000 lb/hr, 150 psig, 3 inch.', { client });

  assert.equal(routed.instrument, 'vy');
  assert.equal(routed.result!.modelCode!.partNumber, 'VY080-FF1-0ABLBBA1-12JA100');
  assert.equal(routed.result!.computed!.status, 'pass');

  // the reply call must carry the VY part number AND the computed low-flow verdict
  const replyCall = calls.find((c) => !c.output_config);
  assert.match(replyCall.messages[0].content, /VY080-FF1-0ABLBBA1-12JA100/);
  assert.match(replyCall.messages[0].content, /computed_sizing: low_flow \[pass\]/);
});

test('routed pipeline sends a pressure inquiry through EJA, and the computed range verdict reaches the reply', async () => {
  const { client, calls } = fakeClient({ instrument: 'eja', inquiryJson: EJA_JSON });
  const routed = await runInquiry('Need a pressure transmitter, 0-100 psi, explosion proof.', { client });

  assert.equal(routed.instrument, 'eja');
  assert.equal(routed.result!.modelCode!.partNumber, 'EJA530E-JBS4N-012EL/FU1/D1');
  assert.equal(routed.result!.computed!.status, 'pass');

  const replyCall = calls.find((c) => !c.output_config);
  assert.match(replyCall.messages[0].content, /EJA530E-JBS4N-012EL\/FU1\/D1/);
  assert.match(replyCall.messages[0].content, /computed_sizing: range_span/);
});

test('routed pipeline sends a valve inquiry through the valve engine, and the assembly reaches the reply', async () => {
  const { client, calls } = fakeClient({ instrument: 'valve', inquiryJson: VALVE_JSON });
  const routed = await runInquiry('Need a 6" WKM butterfly valve, actuated.', { client });

  assert.equal(routed.instrument, 'valve');
  assert.equal(routed.result!.kind, 'assembly');
  assert.equal(routed.result!.assemblyNumber, '6-B5120LOSRTVFDXTK');

  const replyCall = calls.find((c) => !c.output_config);
  assert.match(replyCall.messages[0].content, /assembly_number: 6-B5120LOSRTVFDXTK/);
  assert.match(replyCall.messages[0].content, /Actuator: XL426SR80/);
});

test('routed pipeline declines cleanly on an unrecognized inquiry — no engine, no extractor call', async () => {
  const { client, calls } = fakeClient({ instrument: 'unrecognized', inquiryJson: {} });
  const routed = await runInquiry('Do you sell pressure gauges?', { client });
  assert.equal(routed.instrument, 'unrecognized');
  assert.equal(routed.result, undefined);
  assert.match(routed.draft, /confirm the instrument type/i);
  // only the triage call should have happened (no extractor, no reply-writer)
  assert.equal(calls.length, 1);
});

test('AXG-only shortcut still works', async () => {
  const { client } = fakeClient(WAFER_XP_JSON);
  const { result } = await runEmail('2" XP wafer mag.', { client });
  assert.equal(result.modelCode!.partNumber, 'AXG050-CAFF2AA1AL212B-1JA11/GRL');
});

// ---- facts packet conveys VY computed + assembly ----
test('factsPacket carries computed sizing and assembly items for a remote VY result', async () => {
  const { configureVy } = await import('../../engine/src/vy.ts');
  const result = configureVy({ sizeInch: 4, fluid: 'steam', steamPressurePsig: 150, steamMassLbHr: 6000, mount: 'remote', cableLengthM: 18 });
  const packet = factsPacket(result);
  assert.match(packet, /assembly_items/);
  assert.match(packet, /VY1C-1-20M/);
  assert.match(packet, /computed_sizing: low_flow/);
});

// ---- schemas well-formed ----
test('all inquiry schemas are well-formed structured output (all properties required + closed)', () => {
  for (const schema of [AXG_INQUIRY_SCHEMA, VY_INQUIRY_SCHEMA, EJA_INQUIRY_SCHEMA, VALVE_INQUIRY_SCHEMA]) {
    assert.equal(schema.additionalProperties, false);
    const props = Object.keys(schema.properties);
    assert.deepEqual([...schema.required].sort(), props.sort());
  }
});
