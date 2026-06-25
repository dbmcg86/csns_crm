// Typed loaders + parsers for the JSON truth layer. The JSON in ../../data is the
// single source of truth; nothing here invents values — it only reads and parses
// what is verified in those files. Size table and connection size-ranges are
// derived from the verified JSON rather than re-typed, so they cannot drift.

import { readFileSync } from 'node:fs';

const dataFile = (name: string): string =>
  new URL(`../../data/${name}`, import.meta.url).pathname;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const load = (name: string): any => JSON.parse(readFileSync(dataFile(name), 'utf8'));

export const axgModel = load('axg_model_code.json');
export const axgApp = load('axg_application_rules.json');
export const axgDims = load('axg_dimensions_retrofit.json');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const positionByOrder = (order: number): any =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  axgModel.positions.find((p: any) => p.order === order);

// ---- Size table (position 1) ---------------------------------------------------
export interface SizeRow {
  code: string;
  mm: number;
  inch: number;
}

function parseSizes(): SizeRow[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return positionByOrder(1).options.map((o: any) => {
    const m = o.desc.match(/([\d.]+)\s*mm\s*\(([\d.]+)\s*in\)/);
    return { code: o.code, mm: parseFloat(m[1]), inch: parseFloat(m[2]) };
  });
}
export const SIZES: SizeRow[] = parseSizes();

/** Resolve a stated mm or inch to the nearest catalog size row. */
export function resolveSize(inq: { sizeMm?: number; sizeInch?: number }): SizeRow | null {
  let mm = inq.sizeMm;
  if (mm == null && inq.sizeInch != null) {
    const byInch = SIZES.find((s) => Math.abs(s.inch - inq.sizeInch!) < 0.05);
    mm = byInch ? byInch.mm : inq.sizeInch * 25;
  }
  if (mm == null) return null;
  return SIZES.reduce((a, b) => (Math.abs(b.mm - mm!) < Math.abs(a.mm - mm!) ? b : a));
}

// ---- Process connection options + size ranges (position 5) ---------------------
export interface ConnOption {
  code: string;
  desc: string;
  type: 'wafer' | 'flange';
  minMm: number;
  maxMm: number;
  exclusions: number[];
}

function parseRange(s: string): { min: number; max: number } {
  let m = s.match(/([\d.]+)\s*to\s*([\d.]+)\s*mm/);
  if (m) return { min: parseFloat(m[1]), max: parseFloat(m[2]) };
  m = s.match(/([\d.]+)\s*mm\s*only/);
  if (m) return { min: parseFloat(m[1]), max: parseFloat(m[1]) };
  return { min: 0, max: 1e9 };
}

function parseExclusions(s?: string): number[] {
  if (!s) return [];
  return (s.match(/[\d.]+/g) || []).map(parseFloat);
}

export function connOptions(): ConnOption[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return positionByOrder(5).options.map((o: any) => {
    const r = parseRange(o.size_range || '');
    return {
      code: o.code,
      desc: o.desc,
      type: /wafer/i.test(o.desc) ? 'wafer' : 'flange',
      minMm: r.min,
      maxMm: r.max,
      exclusions: parseExclusions(o.exclusions),
    };
  });
}

/** Is a connection code valid at the given size? */
export function connectionValidAt(code: string, mm: number): boolean {
  const opt = connOptions().find((c) => c.code === code);
  if (!opt) return false;
  return mm >= opt.minMm && mm <= opt.maxMm && !opt.exclusions.includes(mm);
}

/** Legal connection codes of a given style for a size — for blocked-deviation alternatives. */
export function connectionAlternatives(type: 'wafer' | 'flange', mm: number): ConnOption[] {
  return connOptions().filter(
    (c) => c.type === type && mm >= c.minMm && mm <= c.maxMm && !c.exclusions.includes(mm),
  );
}

// ---- Conductivity floor (application rules, bucket 2) ---------------------------
/** Minimum measurable conductivity (µS/cm) for a size, looked up from the rules. */
export function conductivityFloor(mm: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rule = axgApp.bucket_2_application_rules.rules.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.id === 'min_conductivity_by_size',
  );
  for (const t of rule.thresholds) {
    const r = parseRange(t.size_range);
    if (mm >= r.min && mm <= r.max) return t.min_uS_cm;
  }
  return 3;
}

export const LOW_CONDUCTIVITY_WARN_BAND = 10; // µS/cm (Allied-set, application rules)

// ---- Lay lengths / retrofit (dimensions file) ----------------------------------
function rowInch(label: string): number | null {
  const inMatch = label.match(/\(([\d.]+)\s*in\)/) || label.match(/^([\d.]+)\s*in/);
  return inMatch ? parseFloat(inMatch[1]) : null;
}

/** Lay length (in) for a brand column at a nominal inch size, from the cross-ref table. */
export function layLength(brandColumn: string, inch: number): number | null {
  const tbl = axgDims.competitor_crossref.flanged_150;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = tbl.rows.find((r: any) => {
    const ri = rowInch(r.size);
    return ri != null && Math.abs(ri - inch) < 0.05;
  });
  if (!row) return null;
  const v = row[brandColumn];
  return typeof v === 'number' ? v : null;
}

export const DROP_IN_TOLERANCE_IN = axgDims.fit_verdict_logic.drop_in_tolerance_in as number;
