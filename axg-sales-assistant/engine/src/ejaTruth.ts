// Typed loaders for the EJA530E truth layer (data/eja530e_model_code.json). Capsule
// span ranges and Allied-confirmed default codes are read from the JSON, not re-typed.

import { readFileSync } from 'node:fs';

const dataFile = (name: string): string =>
  new URL(`../../data/${name}`, import.meta.url).pathname;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eja: any = JSON.parse(readFileSync(dataFile('eja530e_model_code.json'), 'utf8'));

export interface Capsule {
  code: string;
  minPsi: number;
  maxPsi: number;
  desc: string;
  stocked: boolean;
}

function parseCapsules(): Capsule[] {
  const stocked: string[] = eja.allied_defaults.customer_driven_variables['Measurement span (capsule)'].stocked;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromPositions: any[] = eja.positions.find((p: any) => p.position === 3).codes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return eja.range_span_module.capsules.map((c: any) => ({
    code: c.code,
    minPsi: c.min_span_psi,
    maxPsi: c.max_span_psi,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    desc: (fromPositions.find((p: any) => p.code === c.code)?.desc) || '',
    stocked: stocked.includes(c.code),
  })).sort((a: Capsule, b: Capsule) => a.minPsi - b.minPsi);
}
export const CAPSULES: Capsule[] = parseCapsules();

const fixed = eja.allied_defaults.fixed_defaults;
const cdv = eja.allied_defaults.customer_driven_variables;
const strip = (c: string) => c.replace(/^[-/]/, '');
export const EJA_DEFAULTS = {
  output: strip(fixed['Output signal'].code), // J
  wetted: fixed['Wetted parts material'].code, // S
  amp: fixed['Amplifier housing'].code, // 1
  elec: fixed['Electrical connection'].code, // 2
  indicator: fixed['Integral indicator'].code, // E
  bracket: cdv['Mounting bracket'].default_if_unspecified, // L
  procConn: cdv['Process connections'].default_if_unspecified, // 4
  capsuleDefault: cdv['Measurement span (capsule)'].default_if_unspecified, // B
  explosion: fixed['Explosion protection (optional code)'].code, // /FU1
  calibration: '/D1', // psi calibration units — Allied standard
} as const;

export interface CapsulePick {
  cap?: Capsule;
  turndown?: number;
  perOrder?: boolean;
  err?: string;
}

/** Pick the smallest stocked capsule whose span range contains the required span. */
export function selectCapsule(spanPsi: number): CapsulePick {
  const fit = CAPSULES.filter((c) => spanPsi >= c.minPsi && spanPsi <= c.maxPsi);
  if (!fit.length) {
    if (spanPsi < CAPSULES[0].minPsi) {
      return { err: `Required span ${spanPsi} psi is below the smallest capsule minimum (${CAPSULES[0].minPsi} psi). Confirm the range — this may need a different transmitter.` };
    }
    const top = CAPSULES[CAPSULES.length - 1].maxPsi;
    return { err: `Required span ${spanPsi} psi exceeds the largest capsule (${top} psi). Confirm the range or consider a high-pressure model.` };
  }
  const stockedFit = fit.filter((c) => c.stocked);
  const pick = (stockedFit.length ? stockedFit : fit).reduce((a, b) => (a.maxPsi < b.maxPsi ? a : b));
  return { cap: pick, turndown: +(pick.maxPsi / spanPsi).toFixed(1), perOrder: !pick.stocked };
}
