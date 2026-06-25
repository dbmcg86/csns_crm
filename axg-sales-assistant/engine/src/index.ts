// Public entry point for the AXG Sales Assistant engine (Phase 1).
export { configureAxg } from './axg.ts';
export { configureVy } from './vy.ts';
export { VY_SIZES, vyResolveSize } from './vyTruth.ts';
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
