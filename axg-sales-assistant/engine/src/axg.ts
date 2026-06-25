// The AXG deterministic configurator (Pilot Spec Phase 1).
//
// Input: a structured AxgInquiry. Output: a normalized EngineResult with the
// assembled 16-position model code, ERP part number, application gates, deviation
// flags, companion items, and open questions. Every value is tagged with its
// provenance. NOTHING here is free-typed by a model — defaults and validity all
// resolve against the JSON truth layer (see truth.ts).

import type {
  AxgInquiry,
  CompanionItem,
  EngineResult,
  Flag,
  Gate,
  ModelCode,
  PositionResult,
  Source,
} from './types.ts';
import {
  axgModel,
  connectionAlternatives,
  connectionValidAt,
  conductivityFloor,
  connOptions,
  DROP_IN_TOLERANCE_IN,
  layLength,
  LOW_CONDUCTIVITY_WARN_BAND,
  resolveSize,
} from './truth.ts';

const POSITION_NAMES: string[] = [
  'Model (Size)', 'Use', 'Construction', 'Explosion Protection', 'Process Connection',
  'Lining', 'Electrode', 'Grounding Device', 'Housing and Coating', 'Cable Entry',
  'Accuracy', 'Power Supply', 'Communication and I/O', 'Transmitter Wiring Terminal',
  'Display', 'Optional Specification',
];

// Plain-English text for codes whose option entry is a pattern (e.g. comm "J#") and
// for optional /codes. Everything else is sourced from the JSON option descriptions.
const COMM_DESC: Record<string, string> = {
  JA: 'HART 7 + I/O Type A (4-20 mA + pulse/status)',
  NN: 'None (remote sensor)',
};
const OPT_DESC: Record<string, string> = {
  '/GRL': 'Grounding rings, plate type L (316L, thin)',
  '/GRH': 'Grounding rings, plate type H (Nickel Alloy)',
  '/GRV': 'Grounding rings, plate type V (Titanium)',
  '/HF2': 'Enhanced dual-frequency excitation (slurry / low-conductivity)',
  '/H': 'Vent hole (for permeable fluids)',
};
const ELEC_MAP: [string, string][] = [
  ['316l', 'L'], ['stainless', 'L'], ['hastelloy', 'H'], ['nickel', 'H'],
  ['tantalum', 'T'], ['titanium', 'V'], ['platinum', 'P'], ['tungsten', 'W'], ['316', 'L'],
];
const RING_FOR_ELECTRODE: Record<string, string> = {
  L: '/GRL', H: '/GRH', V: '/GRV', P: '/GRP', T: '/GRT',
};
const PERMEABLE = ['nitric', 'hydrofluoric', 'sodium hydroxide', 'caustic', 'black liquor'];

const CONSTRUCTION_CODE: Record<string, string> = {
  integral: 'A', remote_axfa11: 'D', remote_axg1a: 'E', remote_axg4a: 'G',
};

function descFor(order: number, code: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pos = axgModel.positions.find((p: any) => p.order === order);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opt = pos?.options.find((o: any) => o.code === code);
  if (opt) return opt.desc;
  if (order === 13) return COMM_DESC[code] || code;
  // fall back to the Allied default description for this position, if any
  const def = axgModel.allied_defaults[POSITION_NAMES[order - 1]];
  if (def && def.code === code) return def.desc;
  return code;
}

export function configureAxg(inq: AxgInquiry): EngineResult {
  const gates: Gate[] = [];
  const flags: Flag[] = [];
  const questions: string[] = [];
  const companionItems: CompanionItem[] = [];

  const sz = resolveSize(inq);
  if (!sz) {
    return {
      instrument: 'AXG magnetic flowmeter',
      kind: 'model_code',
      companionItems,
      gates,
      flags,
      questions,
      fatal: 'No line size found in the inquiry. Add the meter/line size (e.g. "2 inch").',
    };
  }

  // codes[1..16] (1-indexed for readability; index 0 unused)
  const code: string[] = new Array(17).fill('');
  const src: Source[] = new Array(17).fill('default');
  const set = (pos: number, c: string, s: Source) => {
    code[pos] = c;
    src[pos] = s;
  };

  // 1 — Size
  set(1, sz.code, 'customer');

  // 2 + 4 — Use / Explosion (fail-safe -C, override-only)
  if (inq.area === 'general_purpose') {
    set(2, '-G', 'customer');
    set(4, '000', 'rule');
  } else if (inq.area === 'hazardous') {
    set(2, '-C', 'customer');
    set(4, 'FF2', 'default');
  } else {
    set(2, '-C', 'default');
    set(4, 'FF2', 'default');
    questions.push(
      'Confirm area classification — quoted explosion-proof (FM, safe anywhere); say the word to down-spec to general-purpose.',
    );
  }

  // 3 — Construction (+ remote-sensor interlocks)
  const isRemote = !!inq.construction && inq.construction !== 'integral';
  set(3, CONSTRUCTION_CODE[inq.construction || 'integral'], inq.construction ? 'customer' : 'default');

  // 5 — Process connection (+ size validity = blocked deviation)
  const connType = inq.connectionType || 'flange';
  const r300 = inq.connectionRating === '300';
  const connCode = connType === 'wafer' ? (r300 ? 'AA2' : 'AA1') : (r300 ? 'BA2' : 'BA1');
  let connSource: Source = inq.connectionType ? 'customer' : 'default';
  if (!inq.connectionType) {
    questions.push('Wafer or flanged connection? (defaulted to ASME Class 150 flange, BA1 — confirm.)');
  }
  if (!connectionValidAt(connCode, sz.mm)) {
    const alts = connectionAlternatives(connType, sz.mm).map((c) => `${c.code} (${c.desc})`);
    flags.push({
      kind: 'CONNECTION',
      severity: 'blocked',
      detail:
        `Connection ${connCode} is not available at ${sz.mm} mm (${sz.inch}"). ` +
        (alts.length
          ? `Choose a valid ${connType} connection for this size.`
          : `No ${connType} connection covers this size — a different connection standard is required; confirm with the customer.`),
      alternatives: alts,
    });
    connSource = 'provisional';
  }
  set(5, connCode, connSource);

  // 6 — Lining (PFA only)
  set(6, 'A', 'default');

  // 7 — Electrode
  let elec = 'L';
  let elecSource: Source = 'default';
  if (inq.electrodeMaterial) {
    const hit = ELEC_MAP.find(([k]) => inq.electrodeMaterial!.toLowerCase().includes(k));
    if (hit) {
      elec = hit[1];
      elecSource = 'customer';
    }
  }
  // tungsten small-size exclusion (cross-position rule)
  if (elec === 'W' && [2.5, 5, 10].includes(sz.mm)) {
    flags.push({
      kind: 'ELECTRODE',
      severity: 'blocked',
      detail: `Tungsten carbide (W) electrode is not available at ${sz.mm} mm. Choose another electrode material.`,
    });
    elecSource = 'provisional';
  }
  set(7, elec, elecSource);

  // 8 — Grounding device
  const wantRings = inq.groundingRings !== 'no';
  set(8, wantRings ? '2' : '1', inq.groundingRings ? 'customer' : 'default');

  // 9 — Housing
  set(9, '1', 'default');

  // 10 — Cable entry (FF2 mandates 2/NPT; also the Allied default)
  set(10, '2', code[4] !== '000' ? 'rule' : 'default');

  // 11 — Accuracy (+ High-Grade size restriction)
  if (inq.accuracy === 'high') {
    if (sz.mm >= 25 && sz.mm <= 200) {
      set(11, 'C', 'customer');
    } else {
      flags.push({
        kind: 'ACCURACY',
        severity: 'blocked',
        detail: `High-Grade accuracy (C) is restricted to 25–200 mm (1–8"). At ${sz.mm} mm only Standard (B) is available.`,
      });
      set(11, 'B', 'rule');
    }
  } else {
    set(11, 'B', 'default');
  }

  // 12/13/14/15 — Power / Comm / Wiring / Display (remote forces blanks)
  if (isRemote) {
    set(12, '-N', 'rule');
    set(13, 'NN', 'rule');
    set(14, 'N', 'rule');
    set(15, 'N', 'rule');
  } else {
    set(12, inq.powerSupply === 'dc_24' ? '-2' : '-1', inq.powerSupply ? 'customer' : 'default');
    set(13, 'JA', 'default');
    set(14, '1', 'default');
    set(15, '1', 'default');
  }

  // 16 — Optional specification
  const permeable = !!inq.fluid && PERMEABLE.some((p) => inq.fluid!.toLowerCase().includes(p));
  const opt: string[] = [];
  if (wantRings) {
    let ring = RING_FOR_ELECTRODE[elec] || '/GRL';
    if (permeable && (ring === '/GRP' || ring === '/GRT')) {
      ring = '/GRL'; // electrode-type rings are excluded for permeable fluids
      flags.push({
        kind: 'GROUNDING',
        severity: 'warn',
        detail: 'Electrode-type grounding rings are excluded for permeable fluids — using plate-type and flagging for review.',
      });
    }
    opt.push(ring);
  }
  if (inq.abrasiveOrSlurry) opt.push('/HF2');
  if (permeable) opt.push('/H');
  set(16, opt.join(' '), 'default');

  // ---- Application gates -------------------------------------------------------
  conductivityGate(inq, sz.mm, gates, questions);
  compatibilityGate(inq, code, src, flags, gates, questions);
  velocityGate(inq, sz.inch, gates);

  // ---- Companion items (remote sensor → signal cable) -------------------------
  if (isRemote) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = axgModel.companion_items.signal_cable.mapping.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => m.construction_code === code[3],
    );
    if (map) {
      companionItems.push({
        role: 'signal_cable',
        partNumber: map.cable,
        note: `Required for remote sensor (${map.construction_desc}); max length ${map.max_length_m} m.`,
      });
    }
  }

  // ---- Retrofit fit verdict ---------------------------------------------------
  retrofit(inq, sz.inch, flags);

  // ---- Standard open questions ------------------------------------------------
  if (!inq.outputType) questions.push('Output / signal type — 4-20 mA + HART? Pulse output for totalizing?');
  questions.push('Integral mount, or remote sensor + transmitter?');

  // ---- Assemble result --------------------------------------------------------
  const positions: PositionResult[] = [];
  for (let i = 1; i <= 16; i++) {
    if (i === 16 && !code[16]) continue; // no optional codes selected
    positions.push({
      order: i,
      name: POSITION_NAMES[i - 1],
      code: code[i],
      source: src[i],
      description: i === 16 ? optionalDesc(code[16]) : descFor(i, code[i]),
    });
  }

  const provisional = src.some((s) => s === 'provisional');
  const partNumber = buildPartNumber(code, src);

  const modelCode: ModelCode = { positions, partNumber, provisional };

  return {
    instrument: 'AXG magnetic flowmeter',
    kind: 'model_code',
    modelCode,
    companionItems,
    gates,
    flags,
    questions,
  };
}

// ---- helpers ------------------------------------------------------------------

function optionalDesc(joined: string): string {
  return joined
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => OPT_DESC[c] || 'Optional specification')
    .join('; ');
}

function buildPartNumber(code: string[], src: Source[]): string {
  let pn = '';
  for (let i = 1; i <= 16; i++) {
    if (!code[i]) continue;
    pn += src[i] === 'provisional' ? '[#]' : code[i];
  }
  return pn.replace(/\s+/g, '');
}

function conductivityGate(inq: AxgInquiry, mm: number, gates: Gate[], questions: string[]): void {
  const floor = conductivityFloor(mm);
  if (inq.conductivityUScm == null) {
    gates.push({
      id: 'conductivity',
      status: 'ask',
      title: 'Conductivity — ask',
      detail: 'Fluid conductivity not stated — required to confirm the meter can measure this fluid.',
    });
    questions.push('Fluid conductivity (µS/cm)?');
    return;
  }
  if (inq.conductivityUScm < floor) {
    gates.push({
      id: 'conductivity',
      status: 'fail',
      title: 'Conductivity — disqualify',
      detail: `${inq.conductivityUScm} µS/cm is below the ${floor} µS/cm floor for this size — a mag meter will not measure it. Escalate / consider another technology.`,
    });
  } else if (inq.conductivityUScm < LOW_CONDUCTIVITY_WARN_BAND) {
    gates.push({
      id: 'conductivity',
      status: 'caution',
      title: 'Conductivity — caution',
      detail: `${inq.conductivityUScm} µS/cm clears the ${floor} µS/cm floor but is below the 10 µS/cm caution band — low-conductivity handling applies. Flag for engineer.`,
    });
  } else {
    gates.push({
      id: 'conductivity',
      status: 'pass',
      title: 'Conductivity — pass',
      detail: `${inq.conductivityUScm} µS/cm — above the ${floor} µS/cm floor and the 10 µS/cm caution band.`,
    });
  }
}

// The compatibility gate FLAGS and ROUTES — it never decides compatibility itself
// (Pilot Spec §8: must resolve against a verified resistance reference, not memory).
function compatibilityGate(
  inq: AxgInquiry,
  code: string[],
  src: Source[],
  flags: Flag[],
  gates: Gate[],
  questions: string[],
): void {
  if (!inq.fluid) {
    gates.push({
      id: 'compatibility',
      status: 'ask',
      title: 'Compatibility — ask',
      detail: 'Fluid not named — the wetted-materials check (electrode, lining, ring) cannot run. Must ask before confirming materials.',
    });
    questions.push('What is the fluid? (drives the wetted-materials check.)');
    return;
  }
  const permeable = PERMEABLE.some((p) => inq.fluid!.toLowerCase().includes(p));
  if (permeable) {
    // electrode held provisional pending materials review
    code[7] = code[7];
    src[7] = 'provisional';
    gates.push({
      id: 'compatibility',
      status: 'fail',
      title: 'Compatibility — escalate',
      detail: `${inq.fluid} is permeable/aggressive. Default 316L must be verified against the chemical-resistance reference — not auto-quoted. Vent hole (/H) added; recommend acid/alkali gasket; block electrode-type & built-in grounding. Route to engineering.`,
    });
    flags.push({
      kind: 'COMPATIBILITY',
      severity: 'warn',
      detail: 'Electrode held provisional pending materials review against a verified resistance source.',
    });
    return;
  }
  if (inq.temperatureMaxC == null) {
    gates.push({
      id: 'compatibility',
      status: 'ask',
      title: 'Compatibility — ask',
      detail: `${inq.fluid} is likely fine with 316L/PFA at ambient, but process temperature wasn't stated — compatibility is temperature-dependent, so confirm before locking materials.`,
    });
    questions.push('Process (fluid) temperature, including maximum?');
    return;
  }
  gates.push({
    id: 'compatibility',
    status: 'pass',
    title: 'Compatibility — pass (confirm against resistance data)',
    detail: `${inq.fluid} with 316L/PFA at up to ${inq.temperatureMaxC} °C — generally compatible. Confirm against the resistance reference for anything aggressive.`,
  });
}

function velocityGate(inq: AxgInquiry, inch: number, gates: Gate[]): void {
  if (inq.flowGpm == null) return;
  const v = +(0.4085 * inq.flowGpm / (inch * inch)).toFixed(1);
  if (inq.abrasiveOrSlurry && v > 7) {
    gates.push({
      id: 'velocity',
      status: 'caution',
      title: 'Velocity — high for abrasive service',
      detail: `At ${inq.flowGpm} gpm, ${inch}" runs ${v} ft/s — high for abrasive service (liner/electrode wear). Consider a larger line.`,
    });
  } else if (v < 1.5) {
    gates.push({
      id: 'velocity',
      status: 'caution',
      title: 'Velocity — low',
      detail: `At ${inq.flowGpm} gpm, ${inch}" runs ${v} ft/s — below ~1.5 ft/s, low-flow performance suffers. Consider a smaller line.`,
    });
  } else {
    gates.push({
      id: 'velocity',
      status: 'pass',
      title: 'Velocity — within range',
      detail: `At ${inq.flowGpm} gpm, ${inch}" runs ${v} ft/s — within range.`,
    });
  }
}

const COMPETITOR_COLUMN: Record<string, string> = {
  rosemount: 'rosemount_8705',
  rosemount_8705: 'rosemount_8705',
  '8705': 'rosemount_8705',
  foxboro: 'foxboro_9700',
  endress: 'endress',
};

function retrofit(inq: AxgInquiry, inch: number, flags: Flag[]): void {
  if (!inq.competitorBrand) return;
  const key = inq.competitorBrand.toLowerCase().replace(/\s+/g, '_');
  const column =
    COMPETITOR_COLUMN[key] ||
    COMPETITOR_COLUMN[Object.keys(COMPETITOR_COLUMN).find((k) => key.includes(k)) || ''] ||
    null;
  const yk = layLength('yokogawa', inch);
  const comp = column ? layLength(column, inch) : null;
  if (yk == null || comp == null) {
    flags.push({
      kind: 'RETROFIT',
      severity: 'warn',
      detail: `Replacing ${inq.competitorBrand}${inq.competitorModel ? ' ' + inq.competitorModel : ''} — lay-length data not available for this size/brand. Confirm the AXG fits the existing spool before promising a drop-in.`,
    });
    return;
  }
  const delta = +(yk - comp).toFixed(2);
  if (delta > DROP_IN_TOLERANCE_IN) {
    flags.push({
      kind: 'RETROFIT',
      severity: 'warn',
      detail: `AXG lay length ${yk}" vs ${inq.competitorBrand} ${comp}" — ${delta > 0 ? '+' : ''}${delta}" longer. Existing spool is too short; pipe modification needed. Flag as added cost, not a clean drop-in.`,
    });
  } else if (delta < -DROP_IN_TOLERANCE_IN) {
    flags.push({
      kind: 'RETROFIT',
      severity: 'info',
      detail: `AXG lay length ${yk}" vs ${inq.competitorBrand} ${comp}" — ${delta}" shorter. Fits, but leaves a gap; a spacer spool or longer studs are needed.`,
    });
  } else {
    flags.push({
      kind: 'RETROFIT',
      severity: 'info',
      detail: `AXG lay length ${yk}" vs ${inq.competitorBrand} ${comp}" — within ¼" tolerance. Direct drop-in; fits the existing spool.`,
    });
  }
}
