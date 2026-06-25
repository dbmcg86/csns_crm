// Phase-4 tests for the EJA530E pressure-transmitter configurator: suffix-code
// assembly, the fail-safe /FU1 explosion default, and the range/span/turndown
// COMPUTED module (capsule selection + 3-point calibration), which rides the same
// result-contract slot as the vortex low-flow verdict.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureEja } from '../src/eja.ts';
import type { EngineResult } from '../src/types.ts';

const posCode = (r: EngineResult, order: number) =>
  r.modelCode!.positions.find((p) => p.order === order)?.code;

test('standard build: 100 psi span, hazardous → the documented Allied stock code', () => {
  const r = configureEja({ requiredSpanPsi: 100, area: 'hazardous' });
  assert.equal(r.modelCode!.partNumber, 'EJA530E-JBS4N-012EL/FU1/D1');
  assert.equal(posCode(r, 3), 'B'); // 100 psi → capsule B
  assert.equal(r.computed!.status, 'pass');
  assert.equal(r.computed!.metrics!.turndown, 2.9); // 290 / 100
});

test('unstated area holds /FU1 and asks (override-only fail-safe)', () => {
  const r = configureEja({ requiredSpanPsi: 100 });
  assert.equal(posCode(r, 10), '/FU1');
  assert.ok(r.questions.some((q) => /FU1|area/i.test(q)));
});

test('general-purpose drops the explosion code from the part number', () => {
  const r = configureEja({ requiredSpanPsi: 100, area: 'general_purpose' });
  assert.equal(posCode(r, 10), 'none');
  assert.equal(r.modelCode!.partNumber, 'EJA530E-JBS4N-012EL/D1'); // no /FU1
});

test('low span selects capsule A', () => {
  const r = configureEja({ requiredSpanPsi: 5, area: 'hazardous' });
  assert.equal(posCode(r, 3), 'A');
});

test('high span selects per-order capsule D and flags the lead time', () => {
  const r = configureEja({ requiredSpanPsi: 2000, area: 'hazardous' });
  assert.equal(posCode(r, 3), 'D');
  assert.ok(r.flags.some((f) => f.kind === 'CAPSULE' && f.severity === 'warn'));
});

test('span above the largest capsule is a fatal result, not a guess', () => {
  const r = configureEja({ requiredSpanPsi: 10000 });
  assert.ok(r.fatal);
  assert.equal(r.modelCode, undefined);
});

test('span below the smallest capsule is fatal', () => {
  const r = configureEja({ requiredSpanPsi: 0.5 });
  assert.ok(r.fatal);
});

test('no range stated → defaults to capsule B full span, provisional + asks', () => {
  const r = configureEja({ area: 'hazardous' });
  assert.equal(posCode(r, 3), 'B');
  assert.equal(r.computed!.status, 'caution');
  assert.equal(r.modelCode!.provisional, true);
  assert.ok(r.questions.some((q) => /range/i.test(q)));
});

test('male process connection switches the connection code to 7', () => {
  const r = configureEja({ requiredSpanPsi: 100, area: 'hazardous', pressureConnection: 'male' });
  assert.equal(posCode(r, 5), '7');
  assert.match(r.modelCode!.partNumber, /EJA530E-JBS7N-/);
});

test('aggressive fluid escalates the compatibility gate', () => {
  const r = configureEja({ requiredSpanPsi: 100, area: 'hazardous', fluid: 'sulfuric acid' });
  const g = r.gates.find((x) => x.id === 'compatibility');
  assert.equal(g!.status, 'fail');
});
