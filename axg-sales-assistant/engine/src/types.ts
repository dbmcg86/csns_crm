// The normalized result contract (Pilot Spec §15.4) and the structured inquiry
// the engine consumes. These are intentionally instrument-agnostic where possible:
// EngineResult is the shared shape every instrument's engine returns, so the
// renderer and future instruments (EJA, VY, valves) plug in without a rewrite.

/** Where a resolved value came from. The whole point of the system: provenance. */
export type Source = 'customer' | 'default' | 'rule' | 'provisional';

/** One resolved position of a model code. */
export interface PositionResult {
  order: number;
  name: string;
  code: string;
  source: Source;
  description: string;
}

export interface ModelCode {
  positions: PositionResult[];
  /** ERP part number — positions concatenated, provisional values shown as [#]. */
  partNumber: string;
  /** True if any position is unconfirmed (e.g. electrode pending materials review). */
  provisional: boolean;
}

/** An application-suitability check: ask → look up → pass/caution/fail. */
export interface Gate {
  id: string;
  status: 'pass' | 'caution' | 'fail' | 'ask';
  title: string;
  detail: string;
}

/** A warning, escalation, or a blocked illegal combination. */
export interface Flag {
  kind: string;
  severity: 'info' | 'warn' | 'blocked';
  detail: string;
  /** For blocked deviations: the legal alternatives to offer instead. */
  alternatives?: string[];
}

/** A non-model-code item that must ship with the order (e.g. signal cable). */
export interface CompanionItem {
  role: string;
  partNumber: string;
  note?: string;
}

/**
 * A sizing outcome the engine CALCULATED — not a code position (Pilot Spec §15.4).
 * The vortex low-flow/Reynolds verdict is the first of these; a valve Cv result
 * would be another. This is the seam that lets non-suffix-code instruments plug in.
 */
export interface ComputedSizing {
  id: string;
  status: 'pass' | 'caution' | 'fail' | 'unavailable';
  title: string;
  detail: string;
  /** Optional numeric outputs (velocity, density, cutoff, …). */
  metrics?: Record<string, string | number>;
}

/** One item in a multi-component, possibly multi-vendor assembly (Pilot Spec §14.7). */
export interface AssemblyItem {
  role: string;
  title: string;
  partNumber: string;
  provisional?: boolean;
  positions?: PositionResult[];
  note?: string;
}

/**
 * The shape EVERY instrument engine returns. A transmitter populates `modelCode`
 * + `gates`; a vortex adds `computed`; a remote/multi-vendor build uses `assembly`.
 * A result may use any subset — the renderer accommodates all of them.
 */
export interface EngineResult {
  instrument: string;
  kind: 'model_code' | 'assembly';
  modelCode?: ModelCode;
  /** A computed sizing verdict (e.g. vortex low-flow) that is not a code position. */
  computed?: ComputedSizing;
  /** N linked items (e.g. remote vortex sensor + transmitter + cable; or a valve BOM). */
  assembly?: AssemblyItem[];
  /** Verified rolled-up order number for an assembly (looked up, never generated). */
  assemblyNumber?: string;
  companionItems: CompanionItem[];
  gates: Gate[];
  flags: Flag[];
  questions: string[];
  /** Set when the engine cannot proceed at all (e.g. no line size given). */
  fatal?: string;
}

/** The structured spec the engine consumes (what the LLM extractor would produce). */
export interface AxgInquiry {
  sizeInch?: number;
  sizeMm?: number;
  connectionType?: 'wafer' | 'flange';
  connectionRating?: '150' | '300';
  /** Undefined = unstated → fail-safe holds -C and asks. */
  area?: 'general_purpose' | 'hazardous';
  electrodeMaterial?: string;
  groundingRings?: 'yes' | 'no';
  powerSupply?: 'ac' | 'dc_24';
  construction?: 'integral' | 'remote_axg1a' | 'remote_axg4a' | 'remote_axfa11';
  accuracy?: 'standard' | 'high';
  fluid?: string;
  temperatureMaxC?: number;
  conductivityUScm?: number;
  flowGpm?: number;
  abrasiveOrSlurry?: boolean;
  outputType?: string;
  competitorBrand?: string;
  competitorModel?: string;
}

/** The structured spec the VY vortex engine consumes. */
export interface VyInquiry {
  sizeInch?: number;
  sizeMm?: number;
  connectionType?: 'wafer' | 'flange';
  connectionRating?: '150' | '300' | '600';
  /** Undefined = unstated → fail-safe holds FF1 and asks. */
  area?: 'general_purpose' | 'hazardous';
  fluid?: string;
  temperatureMaxC?: number;
  /** Liquid volumetric flow, for the liquid low-flow screen. */
  flowGpm?: number;
  /** Saturated-steam line pressure (psig), for the steam low-flow screen. */
  steamPressurePsig?: number;
  /** Steam mass flow (lb/hr), to check it clears the computed cutoff. */
  steamMassLbHr?: number;
  /** Force the temperature-compensated (B) shedder, or keep general (A). */
  tempCompensated?: 'yes' | 'no';
  mount?: 'integral' | 'remote';
  /** Remote only: sensor→transmitter cable length (m). */
  cableLengthM?: number;
  outputType?: string;
}

/** The structured spec the EJA530E pressure-transmitter engine consumes. */
export interface EjaInquiry {
  /** Required pressure span / range top in psi (ranges assumed zero-start). */
  requiredSpanPsi?: number;
  /** Undefined = unstated → fail-safe holds /FU1 and asks. */
  area?: 'general_purpose' | 'hazardous';
  fluid?: string;
  temperatureMaxC?: number;
  pressureConnection?: 'female' | 'male';
  bracket?: 'yes' | 'no';
  indicator?: 'yes' | 'no';
  outputType?: string;
}

/** The structured spec the quarter-turn valve engine consumes. */
export interface ValveInquiry {
  family?: 'WKM' | 'FLOW-TEK';
  sizeInch?: number;
  /** WKM only: lugged (B5123) vs wafer (B5120). */
  bodyStyle?: 'lugged' | 'wafer';
  package?: 'digital' | 'control';
  airPressure?: '80psi' | '60psi';
  location?: 'south_digital' | 'loudon_tn' | 'decatur_il';
  severeService?: 'standard' | 'dry_gas_or_slurry' | 'low_temperature' | 'emergency_shutdown';
}
