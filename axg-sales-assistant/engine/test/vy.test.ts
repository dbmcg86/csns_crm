// Phase-4 tests for the VY vortex configurator: suffix-code assembly, the fail-safe
// certification, the COMPUTED low-flow verdict (the §15.4 seam), and the 3-item
// remote assembly. The steam-physics anchors come from real Yokogawa sizing outputs
// (see vy_model_code.json _computed_sizing) — so the steam floor is checked against
// the verified 7.61 ft/s @ 150 psig point.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureVy } from '../src/vy.ts';
import type { EngineResult } from '../src/types.ts';

const posCode = (r: EngineResult, order: number) =>
  r.modelCode!.positions.find((p) => p.order === order)?.code;

test('integral build assembles the Allied standard VY code', () => {
  // VY050-FF1-0ABLBBA1-12JA100 is the documented standard build shape
  const r = configureVy({ sizeInch: 2, connectionType: 'flange', area: 'hazardous', fluid: 'water', flowGpm: 200 });
  assert.equal(r.kind, 'model_code');
  assert.equal(r.modelCode!.partNumber, 'VY050-FF1-0ABLBBA1-12JA100');
  assert.equal(posCode(r, 1), 'VY050');
  assert.equal(posCode(r, 2), 'FF1'); // fail-safe explosionproof
});

test('unstated area holds FF1 and asks (override-only fail-safe)', () => {
  const r = configureVy({ sizeInch: 3, fluid: 'water', flowGpm: 300 });
  assert.equal(posCode(r, 2), 'FF1');
  assert.ok(r.questions.some((q) => /FF1|area/i.test(q)));
});

test('general-purpose drops certification to 001', () => {
  const r = configureVy({ sizeInch: 3, area: 'general_purpose', fluid: 'water', flowGpm: 300 });
  assert.equal(posCode(r, 2), '001');
});

test('no line size is a fatal result, not a guess', () => {
  const r = configureVy({ fluid: 'steam', steamPressurePsig: 150 });
  assert.ok(r.fatal);
  assert.equal(r.modelCode, undefined);
});

// ---- the computed low-flow seam ----
test('steam low-flow: 5000 lb/hr at 150 psig clears the cutoff on a 3" (the real quote)', () => {
  const r = configureVy({ sizeInch: 3, fluid: 'saturated steam', steamPressurePsig: 150, steamMassLbHr: 5000 });
  assert.ok(r.computed, 'expected a computed sizing verdict');
  assert.equal(r.computed!.id, 'low_flow');
  assert.equal(r.computed!.status, 'pass');
  // verified physics anchor: ~7.6 ft/s velocity floor at 150 psig saturated steam
  assert.equal(r.computed!.metrics!.min_velocity_ft_s, 7.6);
});

test('steam low-flow: a tiny flow on a big line FAILS the cutoff', () => {
  const r = configureVy({ sizeInch: 10, fluid: 'saturated steam', steamPressurePsig: 150, steamMassLbHr: 200 });
  assert.equal(r.computed!.status, 'fail');
});

test('steam low-flow needs the steam pressure to compute', () => {
  const r = configureVy({ sizeInch: 3, fluid: 'steam' });
  assert.equal(r.computed!.status, 'unavailable');
});

test('liquid low-flow: an oversized line is flagged as caution', () => {
  // 2 gpm on a 6" line is far below the screening floor
  const r = configureVy({ sizeInch: 6, fluid: 'condensate', flowGpm: 2 });
  assert.equal(r.computed!.status, 'caution');
});

test('steam service prompts for temperature compensation (B shedder)', () => {
  const r = configureVy({ sizeInch: 3, fluid: 'steam', steamPressurePsig: 150, steamMassLbHr: 5000 });
  assert.ok(r.questions.some((q) => /temperature compensation/i.test(q)));
  assert.equal(posCode(r, 4), 'A'); // stays general unless confirmed
});

test('explicit temp compensation selects the B shedder bar', () => {
  const r = configureVy({ sizeInch: 3, fluid: 'steam', steamPressurePsig: 150, steamMassLbHr: 5000, tempCompensated: 'yes' });
  assert.equal(posCode(r, 4), 'B');
});

// ---- the multi-component assembly seam ----
test('remote mount returns a 3-item assembly (sensor + VY4A + VY1C)', () => {
  const r = configureVy({ sizeInch: 4, connectionType: 'flange', area: 'hazardous', fluid: 'steam', steamPressurePsig: 150, steamMassLbHr: 6000, mount: 'remote', cableLengthM: 18 });
  assert.equal(r.kind, 'assembly');
  assert.equal(r.assembly!.length, 3);
  const [sensor, tx, cable] = r.assembly!;
  assert.match(sensor.partNumber, /VY100-FF1-0ABLBBA1-12JAN00/); // display N on the remote sensor
  assert.match(tx.partNumber, /^VY4A-FF1-/);
  assert.match(cable.partNumber, /VY1C-1-20M/); // 18 m rounds up to the 20 m step
  assert.ok(r.computed, 'remote build still carries the computed low-flow verdict');
});

test('remote without cable length flags the cable provisional and asks', () => {
  const r = configureVy({ sizeInch: 4, fluid: 'steam', steamPressurePsig: 150, steamMassLbHr: 6000, mount: 'remote' });
  const cable = r.assembly!.find((a) => a.role === 'signal_cable')!;
  assert.equal(cable.provisional, true);
  assert.ok(r.questions.some((q) => /cable length/i.test(q)));
});
