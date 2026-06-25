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
 * The shape EVERY instrument engine returns. A transmitter populates `modelCode`
 * + `gates`; a valve (later) would populate computed-sizing + assembly + `gates`.
 */
export interface EngineResult {
  instrument: string;
  kind: 'model_code';
  modelCode?: ModelCode;
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
