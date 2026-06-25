// Typed loaders for the quarter-turn valve truth layer (data/valve_rules.json).
// Valves are field-proven STOCK BUILDS: the engine LOOKS UP what Allied carries and
// the verified rolled-up assembly numbers — it never generates them.

import { readFileSync } from 'node:fs';

const dataFile = (name: string): string =>
  new URL(`../../data/${name}`, import.meta.url).pathname;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VALVE: any = JSON.parse(readFileSync(dataFile('valve_rules.json'), 'utf8'));

export interface ValveFamily {
  key: string; // field_proven_core key
  label: string;
  bodyCodes: Record<string, string> | null; // WKM lugged/wafer body codes
  bodyDefault: string;
}

export const FAMILIES: Record<string, ValveFamily> = {
  WKM: { key: 'WKM_B5120', label: 'WKM butterfly', bodyCodes: { lugged: 'B5123', wafer: 'B5120' }, bodyDefault: 'lugged' },
  'FLOW-TEK': { key: 'FLOW_TEK_F15', label: 'FLOW-TEK ball', bodyCodes: null, bodyDefault: 'flanged' },
};

export function resolveFamily(input?: string): keyof typeof FAMILIES | null {
  if (!input) return null;
  return /flow|tek|ball/i.test(input) ? 'FLOW-TEK' : /wkm|butterfly/i.test(input) ? 'WKM' : null;
}

/** Field-proven sizes (numeric) for a family, from field_proven_core. */
export function familySizes(familyKey: string): number[] {
  return Object.keys(VALVE.field_proven_core[familyKey])
    .filter((k) => !k.startsWith('_'))
    .map(Number)
    .sort((a, b) => a - b);
}

export function nearestSize(familyKey: string, reqInch: number): number {
  return familySizes(familyKey).reduce((a, b) => (Math.abs(b - reqInch) < Math.abs(a - reqInch) ? b : a));
}

/** Build sizes use bare-number string keys ("0.5", "3", "12"). */
export function sizeKey(n: number): string {
  return String(n);
}

export function fmtSize(n: number): string {
  return n === 0.5 ? '1/2' : n === 0.75 ? '3/4' : n === 1.5 ? '1-1/2' : String(n);
}

// Map (family, package, air, location) → the verified_assembly_numbers table key.
const ASM_TABLE: Record<string, string> = {
  'WKM_B5120|digital|80psi|south_digital': 'south_digital_WKM',
  'WKM_B5120|digital|80psi|loudon_tn': 'loudon_WKM',
  'WKM_B5120|control|80psi|south_digital': 'control_WKM',
  'WKM_B5120|control|80psi|loudon_tn': 'control_WKM',
  'WKM_B5120|digital|60psi|decatur_il': 'decatur_60psi_WKM',
  'WKM_B5120|control|60psi|decatur_il': 'decatur_60psi_control_WKM',
  'FLOW_TEK_F15|digital|80psi|south_digital': 'south_digital_FLOWTEK',
  'FLOW_TEK_F15|digital|60psi|decatur_il': 'decatur_60psi_FLOWTEK',
};

/** Verified rolled-up assembly number, or null when none is on file (never generated). */
export function rolledUpNumber(familyKey: string, pkg: string, air: string, location: string, szKey: string): string | null {
  const tableKey = ASM_TABLE[`${familyKey}|${pkg}|${air}|${location}`];
  if (!tableKey) return null;
  const tbl = VALVE.verified_assembly_numbers[tableKey];
  const v = tbl?.[szKey];
  return typeof v === 'string' ? v : null;
}
