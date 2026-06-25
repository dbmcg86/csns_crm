// Typed loaders for the VY vortex truth layer (data/vy_model_code.json). Sizes and
// Allied-confirmed default codes are read from the JSON — the single source of truth —
// not re-typed here.

import { readFileSync } from 'node:fs';

const dataFile = (name: string): string =>
  new URL(`../../data/${name}`, import.meta.url).pathname;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vy: any = JSON.parse(readFileSync(dataFile('vy_model_code.json'), 'utf8'));

export interface VySizeRow {
  code: string;
  mm: number;
  inch: number;
  dual: boolean;
}

function parseSizes(): VySizeRow[] {
  return Object.entries(vy.size_map)
    .filter(([k]) => k !== '_note')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(([code, v]: [string, any]) => ({ code, mm: v.mm, inch: v.inch, dual: !!v.dual }));
}
export const VY_SIZES: VySizeRow[] = parseSizes();

export function vyResolveSize(inq: { sizeMm?: number; sizeInch?: number }): VySizeRow | null {
  let inch = inq.sizeInch;
  if (inch == null && inq.sizeMm != null) inch = inq.sizeMm / 25.4;
  if (inch == null) return null;
  return VY_SIZES.reduce((a, b) => (Math.abs(b.inch - inch!) < Math.abs(a.inch - inch!) ? b : a));
}

// Allied-confirmed default codes (read from the JSON; leading '-' stripped).
const fixed = vy.allied_defaults_CONFIRMED.fixed_defaults;
const strip = (c: string) => c.replace(/^-/, '');
export const VY_DEFAULTS = {
  cert: strip(fixed['Certification'].code), // FF1
  body: strip(fixed['Body type'].code), // 0
  material: fixed['Body/shedder material'].code, // BL
  housing: strip(fixed['Housing/coating'].code), // 1
  cable: fixed['Cable entry'].code, // 2
  comm: fixed['Comm/IO'].code, // JA
  display: fixed['Display'].code, // 1
  flangeConn: 'BBA1', // ASME 150 flanged (plurality of inventory)
  waferConn: 'BAA1', // ASME 150 wafer (common alternative)
} as const;
