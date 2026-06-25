// Structured-output schemas the extractors force the model to fill. Each mirrors an
// engine inquiry type. Every field is nullable and listed in `required` (the
// structured-outputs contract), so the model emits a complete object and signals
// "not stated" with null — which dropNulls then strips to undefined.

import type { AxgInquiry, EjaInquiry, ValveInquiry, VyInquiry } from '../../engine/src/types.ts';

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

export const VY_INQUIRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sizeInch', 'sizeMm', 'connectionType', 'connectionRating', 'area', 'fluid',
    'temperatureMaxC', 'flowGpm', 'steamPressurePsig', 'steamMassLbHr',
    'tempCompensated', 'mount', 'cableLengthM', 'outputType',
  ],
  properties: {
    sizeInch: nullable('number'),
    sizeMm: nullable('number'),
    connectionType: nullableEnum(['wafer', 'flange']),
    connectionRating: nullableEnum(['150', '300', '600']),
    area: nullableEnum(['general_purpose', 'hazardous']),
    fluid: nullable('string'),
    temperatureMaxC: nullable('number'),
    flowGpm: nullable('number'),
    steamPressurePsig: nullable('number'),
    steamMassLbHr: nullable('number'),
    tempCompensated: nullableEnum(['yes', 'no']),
    mount: nullableEnum(['integral', 'remote']),
    cableLengthM: nullable('number'),
    outputType: nullable('string'),
  },
} as const;

export const EJA_INQUIRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['requiredSpanPsi', 'area', 'fluid', 'temperatureMaxC', 'pressureConnection', 'bracket', 'indicator', 'outputType'],
  properties: {
    requiredSpanPsi: nullable('number'),
    area: nullableEnum(['general_purpose', 'hazardous']),
    fluid: nullable('string'),
    temperatureMaxC: nullable('number'),
    pressureConnection: nullableEnum(['female', 'male']),
    bracket: nullableEnum(['yes', 'no']),
    indicator: nullableEnum(['yes', 'no']),
    outputType: nullable('string'),
  },
} as const;

export const VALVE_INQUIRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['family', 'sizeInch', 'bodyStyle', 'package', 'airPressure', 'location', 'severeService'],
  properties: {
    family: nullableEnum(['WKM', 'FLOW-TEK']),
    sizeInch: nullable('number'),
    bodyStyle: nullableEnum(['lugged', 'wafer']),
    package: nullableEnum(['digital', 'control']),
    airPressure: nullableEnum(['80psi', '60psi']),
    location: nullableEnum(['south_digital', 'loudon_tn', 'decatur_il']),
    severeService: nullableEnum(['standard', 'dry_gas_or_slurry', 'low_temperature', 'emergency_shutdown']),
  },
} as const;

/** Drop nulls (the model's "not stated" signal). */
export function dropNulls(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

export const cleanInquiry = (raw: Record<string, unknown>): AxgInquiry => dropNulls(raw) as AxgInquiry;
export const cleanVyInquiry = (raw: Record<string, unknown>): VyInquiry => dropNulls(raw) as VyInquiry;
export const cleanEjaInquiry = (raw: Record<string, unknown>): EjaInquiry => dropNulls(raw) as EjaInquiry;
export const cleanValveInquiry = (raw: Record<string, unknown>): ValveInquiry => dropNulls(raw) as ValveInquiry;
