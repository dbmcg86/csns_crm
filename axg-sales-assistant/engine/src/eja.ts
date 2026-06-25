// The EJA530E pressure-transmitter configurator. Same engine pattern as AXG/VY —
// defaults with provenance, fail-safe explosion protection, suffix-code assembly,
// wetted-parts gate — plus the range/span/turndown capability: the customer's
// required span selects the capsule and becomes the factory-calibrated range, with
// turndown computed. That verdict rides the same `computed` result-contract slot the
// vortex low-flow used (Pilot Spec §15.4). All facts come from the truth layer.

import type { ComputedSizing, EjaInquiry, EngineResult, Flag, Gate, PositionResult, Source } from './types.ts';
import { CAPSULES, EJA_DEFAULTS, selectCapsule } from './ejaTruth.ts';

const POSITION_NAMES = [
  'Model', 'Output Signal', 'Measurement Span', 'Wetted Parts', 'Process Connection',
  'Amplifier Housing', 'Electrical Connection', 'Integral Indicator', 'Mounting Bracket',
  'Explosion Protection', 'Calibration Units',
];
const AGGRESSIVE = ['hydrochloric', 'sulfuric', 'hydrogen sulfide', 'sodium hypochlorite'];
const TURNDOWN_CAUTION = 10;

export function configureEja(inq: EjaInquiry): EngineResult {
  const gates: Gate[] = [];
  const flags: Flag[] = [];
  const questions: string[] = [];

  // --- Range / span → capsule + calibration (the computed module) ---
  let capsuleCode = EJA_DEFAULTS.capsuleDefault;
  let capsuleSrc: Source = 'default';
  let computed: ComputedSizing;
  let provisional = false;

  if (inq.requiredSpanPsi == null) {
    const capB = CAPSULES.find((c) => c.code === EJA_DEFAULTS.capsuleDefault)!;
    const full = capB.maxPsi;
    computed = {
      id: 'range_span',
      status: 'caution',
      title: 'Range — defaulted to full capsule span',
      detail: `No pressure range stated — defaulted to capsule ${capB.code}, calibrated to full span 0 / ${+(full / 2).toFixed(1)} / ${full} psi (field-rerangeable). Give the range to ship it calibrated to the customer's span.`,
      metrics: { capsule: capB.code, calibrated_psi: `0 / ${+(full / 2).toFixed(1)} / ${full}` },
    };
    provisional = true;
    questions.push('Calibrated range — defaulted to capsule B full span (0–290 psi). Give the required range and the unit ships factory-calibrated to it.');
  } else {
    const pick = selectCapsule(inq.requiredSpanPsi);
    if (pick.err) {
      return { instrument: 'EJA530E gauge pressure transmitter', kind: 'model_code', companionItems: [], gates, flags, questions, fatal: pick.err };
    }
    capsuleCode = pick.cap!.code;
    capsuleSrc = 'customer';
    const span = inq.requiredSpanPsi;
    const mid = +(span / 2).toFixed(2);
    const highTurndown = (pick.turndown ?? 0) > TURNDOWN_CAUTION;
    computed = {
      id: 'range_span',
      status: highTurndown ? 'caution' : 'pass',
      title: highTurndown ? 'Range fits — high turndown' : 'Range fits capsule',
      detail:
        `Required span ${span} psi fits capsule ${capsuleCode} (${pick.cap!.desc}); ` +
        `ships factory-calibrated 0 / ${mid} / ${span} psi (3-point); turndown ${pick.turndown}:1.` +
        (pick.perOrder ? ' Capsule is per-order (not stocked) — expect a longer lead time.' : '') +
        (highTurndown ? ' High turndown degrades accuracy — confirm acceptable or use a smaller capsule if the range allows.' : ''),
      metrics: { required_span_psi: span, capsule: capsuleCode, turndown: pick.turndown!, calibrated_psi: `0 / ${mid} / ${span}` },
    };
    if (pick.perOrder) flags.push({ kind: 'CAPSULE', severity: 'warn', detail: `Capsule ${capsuleCode} is per-order (A/B/C are stocked) — longer lead time.` });
  }

  // --- Explosion protection — fail-safe /FU1, override-only (AXG -C analog) ---
  let explosion: string | null = EJA_DEFAULTS.explosion; // /FU1
  let explSrc: Source = 'default';
  if (inq.area === 'general_purpose') {
    explosion = null;
    explSrc = 'customer';
  } else if (inq.area === 'hazardous') {
    explSrc = 'customer';
  } else {
    questions.push('Area classification not stated — holding /FU1 (FM explosionproof + intrinsically safe, safe anywhere). Confirm general-purpose to drop it.');
  }

  // --- Customer-driven positions ---
  const conn = inq.pressureConnection === 'male' ? '7' : '4';
  const connSrc: Source = inq.pressureConnection ? 'customer' : 'default';
  const bracket = inq.bracket === 'no' ? 'N' : EJA_DEFAULTS.bracket;
  const indicator = inq.indicator === 'no' ? 'N' : EJA_DEFAULTS.indicator;

  // --- Wetted-parts compatibility gate ---
  if (inq.fluid) {
    const f = inq.fluid.toLowerCase();
    const aggressive = AGGRESSIVE.some((x) => f.includes(x)) || (f.includes('steam') && (inq.temperatureMaxC ?? 0) >= 150);
    gates.push(
      aggressive
        ? { id: 'compatibility', status: 'fail', title: 'Compatibility — escalate', detail: `${inq.fluid} is on Yokogawa's caution list (datasheet *2) for the 316L connector / Hastelloy C-276 diaphragm — verify against chemical-resistance data before quoting. Route to engineering.` }
        : { id: 'compatibility', status: 'pass', title: 'Compatibility — pass', detail: `${inq.fluid} — 316L connector / Hastelloy C-276 diaphragm generally suitable; confirm against resistance data for anything aggressive.` },
    );
  }

  // --- Assemble positions + part number ---
  const explCode = explosion ?? 'none';
  const rows: Array<[string, Source, string]> = [
    ['EJA530E', 'customer', 'Gauge pressure transmitter'],
    [EJA_DEFAULTS.output, 'default', 'HART 7 + 4-20 mA (confirm HART 5 vs 7)'],
    [capsuleCode, capsuleSrc, `Capsule ${capsuleCode} — ${CAPSULES.find((c) => c.code === capsuleCode)?.desc}`],
    [EJA_DEFAULTS.wetted, 'default', '316L process connector, Hastelloy C-276 diaphragm'],
    [conn, connSrc, conn === '7' ? '1/2 NPT male process connection' : '1/2 NPT female process connection'],
    [EJA_DEFAULTS.amp, 'default', 'Cast aluminum amplifier housing'],
    [EJA_DEFAULTS.elec, 'default', '1/2 NPT, dual electrical connection (explosion-ready)'],
    [indicator, indicator === 'N' ? 'customer' : 'default', indicator === 'N' ? 'No integral indicator' : 'Digital indicator with range-setting buttons'],
    [bracket, bracket === 'N' ? 'customer' : 'default', bracket === 'N' ? 'No mounting bracket' : '316 SST 2-inch pipe mounting bracket'],
    [explCode, explSrc, explosion ? 'FM explosionproof + intrinsically safe (combined /FU1)' : 'General-purpose (no explosion protection)'],
    [EJA_DEFAULTS.calibration, 'default', 'Calibration in psi (Allied standard)'],
  ];
  const positions: PositionResult[] = rows.map(([code, source, description], i) => ({ order: i + 1, name: POSITION_NAMES[i], code, source, description }));

  const partNumber =
    `EJA530E-${EJA_DEFAULTS.output}${capsuleCode}${EJA_DEFAULTS.wetted}${conn}N` +
    `-0${EJA_DEFAULTS.amp}${EJA_DEFAULTS.elec}${indicator}${bracket}` +
    `${explosion ?? ''}${EJA_DEFAULTS.calibration}`;

  // --- Standard open questions ---
  if (!inq.outputType) questions.push('Output — HART (our standard J), or another protocol?');
  questions.push('Confirm process connection (1/2 NPT female 4 / male 7) and whether a mounting bracket is needed.');

  return {
    instrument: 'EJA530E gauge pressure transmitter',
    kind: 'model_code',
    modelCode: { positions, partNumber, provisional },
    computed,
    companionItems: [],
    gates,
    flags,
    questions,
  };
}
