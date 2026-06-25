// The structured-output schema the extractor forces the model to fill. Mirrors
// the engine's AxgInquiry. Every field is nullable and listed in `required` (the
// structured-outputs contract), so the model emits a complete object and signals
// "not stated" with null — which cleanInquiry then drops to undefined.

import type { AxgInquiry } from '../../engine/src/types.ts';

const nullable = (type: string) => ({ type: [type, 'null'] });
const nullableEnum = (values: string[]) => ({
  anyOf: [{ type: 'string', enum: values }, { type: 'null' }],
});

export const AXG_INQUIRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sizeInch', 'sizeMm', 'connectionType', 'connectionRating', 'area',
    'electrodeMaterial', 'groundingRings', 'powerSupply', 'construction',
    'accuracy', 'fluid', 'temperatureMaxC', 'conductivityUScm', 'flowGpm',
    'abrasiveOrSlurry', 'outputType', 'competitorBrand', 'competitorModel',
  ],
  properties: {
    sizeInch: nullable('number'),
    sizeMm: nullable('number'),
    connectionType: nullableEnum(['wafer', 'flange']),
    connectionRating: nullableEnum(['150', '300']),
    area: nullableEnum(['general_purpose', 'hazardous']),
    electrodeMaterial: nullable('string'),
    groundingRings: nullableEnum(['yes', 'no']),
    powerSupply: nullableEnum(['ac', 'dc_24']),
    construction: nullableEnum(['integral', 'remote_axg1a', 'remote_axg4a', 'remote_axfa11']),
    accuracy: nullableEnum(['standard', 'high']),
    fluid: nullable('string'),
    temperatureMaxC: nullable('number'),
    conductivityUScm: nullable('number'),
    flowGpm: nullable('number'),
    abrasiveOrSlurry: nullable('boolean'),
    outputType: nullable('string'),
    competitorBrand: nullable('string'),
    competitorModel: nullable('string'),
  },
} as const;

/** Drop nulls (the model's "not stated" signal) so the engine sees only stated fields. */
export function cleanInquiry(raw: Record<string, unknown>): AxgInquiry {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as AxgInquiry;
}
