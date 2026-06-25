// The VY vortex-flowmeter configurator. Same engine pattern as AXG — defaults with
// provenance, fail-safe certification, suffix-code assembly, gates — plus two things
// AXG didn't have, exercising the result contract (Pilot Spec §15.4):
//   1. a COMPUTED low-flow verdict (not a code position)
//   2. a 3-item REMOTE ASSEMBLY (sensor + VY4A transmitter + VY1C cable)
//
// All facts come from the truth layer / verified physics, never invented.

import type {
  AssemblyItem,
  ComputedSizing,
  EngineResult,
  Flag,
  Gate,
  PositionResult,
  Source,
  VyInquiry,
} from './types.ts';
import { VY_DEFAULTS, vyResolveSize, type VySizeRow } from './vyTruth.ts';

const POSITION_NAMES = [
  'Model (Size)', 'Certification', 'Body Type', 'Shedder Bar', 'Body/Shedder Material',
  'Process Connection', 'Housing & Coating', 'Cable Entry', 'Communication & I/O', 'Display',
];

const AGGRESSIVE = ['hydrochloric', 'sulfuric', 'hydrogen sulfide', 'sodium hypochlorite'];

// --- Steam physics (calibrated to real Yokogawa VY sizing outputs; see the
//     _computed_sizing notes in vy_model_code.json). ---
const STEAM_RHO: [number, number][] = [
  [0, 0.0373], [15, 0.0728], [30, 0.1076], [50, 0.1496], [75, 0.2014], [100, 0.2580],
  [125, 0.3096], [150, 0.3636], [200, 0.4694], [250, 0.5746], [300, 0.6796],
];
const VFLOOR_LIQUID_FTS = 1.0; // 0.305 m/s — Yokogawa-verified liquid mechanical floor
const RHOV2_K = 31.3; // Pa — gas/steam signal floor constant
const LIQ_FLOOR_MS = 0.305;

function steamDensity(psig: number): number {
  if (psig <= STEAM_RHO[0][0]) return STEAM_RHO[0][1];
  const last = STEAM_RHO[STEAM_RHO.length - 1];
  if (psig >= last[0]) return last[1];
  for (let i = 1; i < STEAM_RHO.length; i++) {
    if (psig <= STEAM_RHO[i][0]) {
      const [p0, r0] = STEAM_RHO[i - 1];
      const [p1, r1] = STEAM_RHO[i];
      return r0 + ((r1 - r0) * (psig - p0)) / (p1 - p0);
    }
  }
  return last[1];
}

function steamVfloorFts(rhoLbFt3: number): number {
  const rhoKg = rhoLbFt3 / 0.062428;
  const vMs = Math.max(LIQ_FLOOR_MS, Math.sqrt(RHOV2_K / rhoKg));
  return vMs * 3.28084;
}

const area_ft2 = (inch: number) => (Math.PI / 4) * Math.pow(inch / 12, 2);

export function configureVy(inq: VyInquiry): EngineResult {
  const gates: Gate[] = [];
  const flags: Flag[] = [];
  const questions: string[] = [];

  const sz = vyResolveSize(inq);
  if (!sz) {
    return {
      instrument: 'VY vortex flowmeter',
      kind: 'model_code',
      companionItems: [],
      gates,
      flags,
      questions,
      fatal: 'No line size found. Give the line size (e.g. 3-inch / DN80) so the VY size code can be set.',
    };
  }

  // Certification — fail-safe FF1, override-only (AXG -C analog)
  let cert = VY_DEFAULTS.cert;
  let certSrc: Source = 'default';
  if (inq.area === 'general_purpose') {
    cert = '001';
    certSrc = 'customer';
  } else if (inq.area === 'hazardous') {
    certSrc = 'customer';
  } else {
    questions.push('Area classification not stated — holding FM explosionproof (FF1) as the fail-safe. Confirm general-purpose to drop to 001 (Non-Ex, CE).');
  }

  // Process connection
  const connType = inq.connectionType || 'flange';
  const dig = inq.connectionRating === '300' ? '2' : inq.connectionRating === '600' ? '4' : '1';
  const conn = (connType === 'wafer' ? 'BAA' : 'BBA') + dig;
  const connSrc: Source = inq.connectionType || inq.connectionRating ? 'customer' : 'default';
  if (!inq.connectionType) {
    questions.push('Confirm process connection (flanged ASME 150 / BBA1 default; wafer or other rating if needed).');
  }

  // Shedder bar — default A (general); recommend B (temp sensor) only on steam/mass/energy signals
  const fluid = (inq.fluid || '').toLowerCase();
  const steamSignal = fluid.includes('steam');
  let shedder = 'A';
  let shedderSrc: Source = 'default';
  let shedderAsk = false;
  if (inq.tempCompensated === 'yes') {
    shedder = 'B';
    shedderSrc = 'customer';
  } else if (inq.tempCompensated === 'no') {
    shedderSrc = 'customer';
  } else if (steamSignal) {
    shedderAsk = true;
    questions.push('Temperature compensation? Steam service often wants the B shedder bar (built-in Pt1000) for mass/energy flow — confirm, or keep general (A).');
  }

  // Wetted-parts gate
  if (inq.fluid) {
    const aggressive = AGGRESSIVE.some((x) => fluid.includes(x)) || (steamSignal && (inq.temperatureMaxC ?? 0) >= 150);
    gates.push(
      aggressive
        ? {
            id: 'wetted_parts',
            status: 'fail',
            title: 'Wetted parts — escalate',
            detail: `${inq.fluid} is on Yokogawa's caution list (datasheet *4) for the CF8M/Duplex wetted parts — verify against chemical-resistance data or consider a nickel-alloy body/shedder. Route to engineering.`,
          }
        : {
            id: 'wetted_parts',
            status: 'pass',
            title: 'Wetted parts — pass',
            detail: `${inq.fluid} — standard CF8M body / Duplex shedder generally suitable; confirm for anything aggressive.`,
          },
    );
  }

  // Computed low-flow verdict (the §15.4 seam)
  const computed = lowFlow(inq, sz);

  // VY part-number grouping is flagged needs-verification in the truth layer
  flags.push({
    kind: 'PART-NUMBER',
    severity: 'info',
    detail: 'VY part-number hyphen grouping is per the datasheet header and not yet verified against a real VY order code — confirm placement before ordering.',
  });

  const fixedTail = '00';

  if (inq.mount === 'remote') {
    // ---- REMOTE: 3-item assembly ----
    const sensorPositions = buildPositions(sz, cert, certSrc, shedder, shedderSrc, conn, connSrc, 'N');
    const sensorPn = partNumber(sz, cert, shedder, conn, 'N', fixedTail);
    const txPn = `VY4A-${cert}-1${VY_DEFAULTS.cable}${VY_DEFAULTS.comm}100`;
    const lenCode = inq.cableLengthM
      ? '-' + String(Math.min(50, Math.ceil(inq.cableLengthM / 5) * 5)).padStart(2, '0') + 'M'
      : '-[LEN]';
    const cablePn = `VY1C-1${lenCode}`;

    const assembly: AssemblyItem[] = [
      { role: 'remote_sensor', title: `Remote sensor (VY ${sz.inch}")`, partNumber: sensorPn, positions: sensorPositions },
      {
        role: 'remote_transmitter',
        title: 'Remote transmitter (VY4A)',
        partNumber: txPn,
        provisional: true,
        note: `Certification (${cert}) and comm (${VY_DEFAULTS.comm}) MUST match the sensor.`,
      },
      {
        role: 'signal_cable',
        title: 'Signal cable (VY1C)',
        partNumber: cablePn,
        provisional: !inq.cableLengthM,
        note: inq.cableLengthM ? `${inq.cableLengthM} m (rounded up to 5 m step; max 50 m).` : 'Cable length required (sensor→transmitter, 5–50 m).',
      },
    ];

    flags.push({
      kind: 'ASSEMBLY',
      severity: 'warn',
      detail: 'Remote install = THREE line items. Cross-component rules (sensor↔transmitter cert/comm match) are reasoned from the datasheet, not verified against a stocked remote build — confirm before quoting.',
    });
    if (!inq.cableLengthM) questions.push('Cable length (sensor→transmitter distance, 5–50 m) — required for the VY1C, no default.');

    return {
      instrument: 'VY vortex flowmeter (remote)',
      kind: 'assembly',
      assembly,
      computed,
      companionItems: [],
      gates,
      flags,
      questions,
    };
  }

  // ---- INTEGRAL: single unit ----
  const positions = buildPositions(sz, cert, certSrc, shedder, shedderSrc, conn, connSrc, VY_DEFAULTS.display);
  const pn = partNumber(sz, cert, shedder, conn, VY_DEFAULTS.display, fixedTail);

  return {
    instrument: 'VY vortex flowmeter',
    kind: 'model_code',
    modelCode: { positions, partNumber: pn, provisional: shedderAsk },
    computed,
    companionItems: [],
    gates,
    flags,
    questions,
  };
}

// --- helpers ---

function partNumber(sz: VySizeRow, cert: string, shedder: string, conn: string, display: string, tail: string): string {
  return `${sz.code}-${cert}-${VY_DEFAULTS.body}${shedder}${VY_DEFAULTS.material}${conn}-${VY_DEFAULTS.housing}${VY_DEFAULTS.cable}${VY_DEFAULTS.comm}${display}${tail}`;
}

function buildPositions(
  sz: VySizeRow, cert: string, certSrc: Source, shedder: string, shedderSrc: Source,
  conn: string, connSrc: Source, display: string,
): PositionResult[] {
  const ratingDesc = ({ '1': '150', '2': '300', '4': '600' } as Record<string, string>)[conn.slice(-1)] || '150';
  const rows: Array<[string, Source, string]> = [
    [sz.code, 'customer', `${sz.inch}" (DN${sz.mm}) vortex flow tube`],
    [cert, certSrc, cert === 'FF1' ? 'FM explosionproof (dual-seal) — Allied fail-safe default' : cert === '001' ? 'Non-Ex, CE marking' : 'Certification'],
    [VY_DEFAULTS.body, 'default', 'General body type'],
    [shedder, shedderSrc, shedder === 'B' ? 'General shedder bar WITH built-in Pt1000 temperature sensor (mass/energy flow)' : 'General shedder bar'],
    [VY_DEFAULTS.material, 'default', 'Body CF8M / shedder Duplex 1.4517 (316-class stainless)'],
    [conn, connSrc, `${conn.startsWith('BA') ? 'Wafer' : 'Flanged'} process connection, ASME ${ratingDesc}#`],
    [VY_DEFAULTS.housing, 'default', 'Standard material, standard coating'],
    [VY_DEFAULTS.cable, 'default', 'ASME 1/2" NPT cable entry, one connection'],
    [VY_DEFAULTS.comm, 'default', 'HART 7, 4-20 mA, pulse/status output'],
    [display, display === '1' ? 'default' : 'rule', display === '1' ? 'With 2-line LCD display + config buttons' : 'No display (remote sensor — display on the VY4A transmitter)'],
  ];
  return rows.map(([code, source, description], i) => ({ order: i + 1, name: POSITION_NAMES[i], code, source, description }));
}

function lowFlow(inq: VyInquiry, sz: VySizeRow): ComputedSizing {
  const inch = sz.inch;
  const A = area_ft2(inch);
  if (!inq.fluid) {
    return { id: 'low_flow', status: 'unavailable', title: 'Low-flow check — needs fluid', detail: 'Give the fluid (and steam pressure, if steam) to screen the low-flow cutoff.' };
  }
  const isSteam = inq.fluid.toLowerCase().includes('steam');
  if (isSteam) {
    if (inq.steamPressurePsig == null) {
      return { id: 'low_flow', status: 'unavailable', title: 'Low-flow check — needs steam pressure', detail: 'Give the saturated-steam pressure (psig) to compute the lb/hr cutoff (lower pressure → higher velocity floor).' };
    }
    const rho = steamDensity(inq.steamPressurePsig);
    const vmin = steamVfloorFts(rho);
    const cutoff = rho * vmin * A * 3600;
    const cutR = Math.round(cutoff / 10) * 10;
    const metrics: Record<string, string | number> = {
      density_lb_ft3: +rho.toFixed(3),
      min_velocity_ft_s: +vmin.toFixed(1),
      min_flow_lb_hr: cutR,
    };
    if (inq.steamMassLbHr != null) {
      if (inq.steamMassLbHr < cutoff) {
        return { id: 'low_flow', status: 'fail', title: 'Low-flow — BELOW cutoff', detail: `${inq.steamMassLbHr} lb/hr is below the ~${cutR} lb/hr minimum for ${inch}" at ${inq.steamPressurePsig} psig — the meter may not shed reliably. Use a smaller line/meter. Screening estimate — verify in Yokogawa's sizing tool.`, metrics };
      }
      const v = inq.steamMassLbHr / (rho * A * 3600);
      metrics.operating_velocity_ft_s = +v.toFixed(1);
      return { id: 'low_flow', status: 'pass', title: 'Low-flow — clears cutoff', detail: `${inq.steamMassLbHr} lb/hr clears the ~${cutR} lb/hr minimum for ${inch}" at ${inq.steamPressurePsig} psig (runs ~${v.toFixed(1)} ft/s). Screening estimate — verify in Yokogawa's sizing tool.`, metrics };
    }
    return { id: 'low_flow', status: 'caution', title: 'Low-flow cutoff computed', detail: `Below ~${cutR} lb/hr this ${inch}" may not read reliably (saturated steam ${inq.steamPressurePsig} psig). Give the steam flow (lb/hr) to confirm it clears. Screening estimate.`, metrics };
  }
  // liquid
  const vmin = VFLOOR_LIQUID_FTS;
  const qGpm = vmin * A * 448.831;
  const minR = Math.round(qGpm);
  const metrics: Record<string, string | number> = { min_velocity_ft_s: vmin, min_flow_gpm: minR };
  if (inq.flowGpm != null) {
    if (inq.flowGpm < qGpm) {
      return { id: 'low_flow', status: 'caution', title: 'Possibly oversized', detail: `${inq.flowGpm} gpm is below the ~${minR} gpm screening floor for ${inch}" — likely oversized; consider a smaller line/meter. Screening estimate.`, metrics };
    }
    const v = (0.4085 * inq.flowGpm) / (inch * inch);
    metrics.operating_velocity_ft_s = +v.toFixed(1);
    return { id: 'low_flow', status: 'pass', title: 'Clears low-flow floor', detail: `${inq.flowGpm} gpm clears the ~${minR} gpm floor for ${inch}" (runs ~${v.toFixed(1)} ft/s). Screening estimate — verify in Yokogawa's sizing tool.`, metrics };
  }
  return { id: 'low_flow', status: 'caution', title: 'Low-flow floor computed', detail: `Below ~${minR} gpm this ${inch}" may not read reliably. Give the flow (gpm) to confirm. Screening estimate.`, metrics };
}
