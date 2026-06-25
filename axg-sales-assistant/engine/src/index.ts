// Public entry point for the AXG Sales Assistant engine (Phase 1).
export { configureAxg } from './axg.ts';
export { configureVy } from './vy.ts';
export { VY_SIZES, vyResolveSize } from './vyTruth.ts';
export { configureEja } from './eja.ts';
export { CAPSULES, selectCapsule } from './ejaTruth.ts';
export { configureValve } from './valve.ts';
export { FAMILIES, familySizes, rolledUpNumber } from './valveTruth.ts';
export * from './types.ts';
export {
  SIZES,
  resolveSize,
  connOptions,
  connectionValidAt,
  connectionAlternatives,
  conductivityFloor,
  layLength,
} from './truth.ts';
