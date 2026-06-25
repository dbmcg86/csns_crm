// Phase-4 tests for the quarter-turn valve configurator — the non-suffix-code
// instrument. Verifies the field-proven BOM lookup, verified rolled-up assembly
// numbers (looked up, never generated), assume-and-flag defaults, and severe service
// being FLAGGED rather than auto-upsized.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureValve } from '../src/valve.ts';
import type { EngineResult } from '../src/types.ts';

const item = (r: EngineResult, role: string) => r.assembly!.find((a) => a.role === role);
const hasFlag = (r: EngineResult, kind: string) => r.flags.some((f) => f.kind === kind);

test('WKM 6" digital (all defaults) → field-proven build + verified rolled-up number', () => {
  const r = configureValve({ family: 'WKM', sizeInch: 6 });
  assert.equal(r.kind, 'assembly');
  assert.equal(r.assemblyNumber, '6-B5120LOSRTVFDXTK');
  assert.match(item(r, 'Valve')!.partNumber, /B5123.*lugged/); // lugged default
  assert.equal(item(r, 'Actuator')!.partNumber, 'XL426SR80'); // digital / 80psi / 6"
  assert.equal(item(r, 'Lockable linkage kit')!.partNumber, 'LKO-6-B5120-F10');
  // unstated dimensions are flagged, not silently chosen
  for (const k of ['AIR-PRESSURE', 'PACKAGE', 'BODY-STYLE', 'LOCATION']) assert.ok(hasFlag(r, k), `expected ${k} flag`);
});

test('wafer body override swaps only the valve body code', () => {
  const r = configureValve({ family: 'WKM', sizeInch: 6, bodyStyle: 'wafer' });
  assert.match(item(r, 'Valve')!.partNumber, /B5120.*wafer/);
  assert.ok(!hasFlag(r, 'BODY-STYLE')); // explicitly stated → not flagged
});

test('60 psi couples to Decatur and upsizes the actuator', () => {
  const r = configureValve({ family: 'WKM', sizeInch: 8, airPressure: '60psi' });
  assert.equal(item(r, 'Actuator')!.partNumber, 'XL1127SR60');
  assert.equal(r.assemblyNumber, '8-B5120LOS6TVFDXTK');
});

test('FLOW-TEK 2" digital → its own field-proven build + rolled-up number', () => {
  const r = configureValve({ family: 'FLOW-TEK', sizeInch: 2 });
  assert.match(item(r, 'Valve')!.partNumber, /FLOW-TEK RF15-316/);
  assert.equal(item(r, 'Actuator')!.partNumber, 'XL131SR80');
  assert.equal(r.assemblyNumber, '2-RF15LOSRTVFDXTK');
});

test('FLOW-TEK control uses V-PORT and has no verified rolled-up number (data gap, flagged)', () => {
  const r = configureValve({ family: 'FLOW-TEK', sizeInch: 4, package: 'control' });
  assert.match(item(r, 'Valve')!.partNumber, /V PORT/);
  assert.equal(r.assemblyNumber, undefined);
  assert.ok(hasFlag(r, 'ASSEMBLY-NUMBER')); // looked up, not generated
});

test('control package swaps the solenoid for a positioner', () => {
  const r = configureValve({ family: 'WKM', sizeInch: 6, package: 'control' });
  assert.ok(item(r, 'Positioner'), 'expected a positioner');
  assert.ok(!item(r, 'Solenoid'), 'control package has no solenoid');
});

test('severe service is FLAGGED, not auto-upsized', () => {
  const std = configureValve({ family: 'WKM', sizeInch: 6 });
  const esd = configureValve({ family: 'WKM', sizeInch: 6, severeService: 'emergency_shutdown' });
  assert.ok(hasFlag(esd, 'SEVERE-SERVICE'));
  // actuator unchanged from the standard field-proven build — not auto-resized
  assert.equal(item(esd, 'Actuator')!.partNumber, item(std, 'Actuator')!.partNumber);
});

test('unrecognized family is fatal', () => {
  const r = configureValve({ sizeInch: 6 });
  assert.ok(r.fatal);
});

test('no size is fatal', () => {
  const r = configureValve({ family: 'WKM' });
  assert.ok(r.fatal);
});

test('a non-stocked requested size snaps to the nearest field-proven size and flags it', () => {
  const r = configureValve({ family: 'WKM', sizeInch: 7 });
  assert.ok(hasFlag(r, 'SIZE'));
  assert.ok(r.assembly, 'still produces a build at the nearest field-proven size');
});
