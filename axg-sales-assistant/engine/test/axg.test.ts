// Phase-1 acceptance tests for the AXG configurator.
//
// Two kinds of test:
//  1. The 4 prototype demo scenarios — known-good reference outputs.
//  2. Rule-derived edge cases — illegal combinations the engine MUST reject,
//     and gates that must fire.
//
// NOTE (Pilot Spec §10): real production acceptance needs ≥20 historically-quoted
// codes + 10 real inquiry emails from Allied. These tests prove the engine is
// self-consistent against the truth layer; they are not a substitute for that set.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureAxg } from '../src/axg.ts';
import type { EngineResult } from '../src/types.ts';

const pn = (r: EngineResult) => r.modelCode!.partNumber;
const gate = (r: EngineResult, id: string) => r.gates.find((g) => g.id === id);
const posCode = (r: EngineResult, order: number) =>
  r.modelCode!.positions.find((p) => p.order === order)?.code;
const hasFlag = (r: EngineResult, kind: string, sev?: string) =>
  r.flags.some((f) => f.kind === kind && (!sev || f.severity === sev));

// ---- Demo scenario 1: Rosemount 10" retrofit, general-purpose -----------------
test('scenario 1 — Rosemount 10" GP retrofit assembles the expected code', () => {
  const r = configureAxg({
    sizeInch: 10,
    connectionType: 'flange',
    area: 'general_purpose',
    fluid: 'city water',
    temperatureMaxC: 25,
    conductivityUScm: 600,
    competitorBrand: 'rosemount_8705',
    outputType: 'HART',
  });
  assert.equal(pn(r), 'AXG250-GA000BA1AL212B-1JA11/GRL');
  assert.equal(posCode(r, 2), '-G');
  assert.equal(posCode(r, 4), '000');
  assert.equal(gate(r, 'conductivity')!.status, 'pass');
  // 10" Rosemount 8705 is the classic short-spool retrofit
  assert.ok(hasFlag(r, 'RETROFIT', 'warn'));
});

// ---- Demo scenario 2: 2" XP wafer, HART, fluid not named ----------------------
test('scenario 2 — 2" XP wafer assembles the expected code and asks for fluid', () => {
  const r = configureAxg({
    sizeInch: 2,
    connectionType: 'wafer',
    area: 'hazardous',
    electrodeMaterial: '316',
    accuracy: 'standard',
    outputType: 'HART',
  });
  assert.equal(pn(r), 'AXG050-CAFF2AA1AL212B-1JA11/GRL');
  assert.equal(gate(r, 'compatibility')!.status, 'ask'); // fluid not named
  assert.equal(gate(r, 'conductivity')!.status, 'ask'); // conductivity not stated
});

// ---- Demo scenario 3: 50% nitric acid, 80°C — permeable, escalate -------------
test('scenario 3 — nitric acid escalates, holds electrode provisional, adds /H', () => {
  const r = configureAxg({
    sizeInch: 3,
    connectionType: 'flange',
    area: 'hazardous',
    fluid: '50% nitric acid',
    temperatureMaxC: 80,
    outputType: 'HART',
  });
  assert.equal(gate(r, 'compatibility')!.status, 'fail');
  assert.equal(r.modelCode!.provisional, true);
  const elec = r.modelCode!.positions.find((p) => p.order === 7)!;
  assert.equal(elec.source, 'provisional');
  // vent hole recommended for permeable fluids
  assert.ok(posCode(r, 16)!.includes('/H'));
  // part number cannot finalize while a position is provisional
  assert.ok(pn(r).includes('[#]'));
});

// ---- Demo scenario 4: Ottumwa basin, area unstated → hold -C ------------------
test('scenario 4 — area unstated holds -C, abrasive slurry adds /HF2, velocity computed', () => {
  const r = configureAxg({
    sizeInch: 6,
    connectionType: 'flange',
    fluid: 'high-pH coal-ash rinse water',
    temperatureMaxC: 66,
    conductivityUScm: 5000,
    flowGpm: 600,
    abrasiveOrSlurry: true,
  });
  assert.equal(posCode(r, 2), '-C'); // held, not inferred down
  assert.ok(r.questions.some((q) => /area classification/i.test(q)));
  assert.ok(posCode(r, 16)!.includes('/HF2'));
  assert.equal(gate(r, 'velocity')!.status, 'pass'); // 6" @ 600 gpm ≈ 6.8 ft/s
});

// ---- Fail-safe default --------------------------------------------------------
test('unstated area defaults to explosion-proof -C / FF2 and asks', () => {
  const r = configureAxg({ sizeInch: 4, connectionType: 'flange' });
  assert.equal(posCode(r, 2), '-C');
  assert.equal(posCode(r, 4), 'FF2');
  assert.ok(r.questions.some((q) => /area/i.test(q)));
});

// ---- Blocked illegal combinations ---------------------------------------------
test('wafer above 8" (200 mm) is blocked with alternatives', () => {
  const r = configureAxg({ sizeInch: 10, connectionType: 'wafer' });
  const f = r.flags.find((x) => x.kind === 'CONNECTION');
  assert.ok(f, 'expected a CONNECTION flag');
  assert.equal(f!.severity, 'blocked');
});

test('High-Grade accuracy outside 25–200 mm is blocked and falls back to B', () => {
  const r = configureAxg({ sizeInch: 12, connectionType: 'flange', accuracy: 'high' });
  assert.ok(hasFlag(r, 'ACCURACY', 'blocked'));
  assert.equal(posCode(r, 11), 'B');
});

test('tungsten electrode on a tiny size is blocked', () => {
  const r = configureAxg({ sizeMm: 5, connectionType: 'flange', electrodeMaterial: 'tungsten' });
  assert.ok(hasFlag(r, 'ELECTRODE', 'blocked'));
});

test('no line size is a fatal result, not a guess', () => {
  const r = configureAxg({ fluid: 'water' });
  assert.ok(r.fatal);
  assert.equal(r.modelCode, undefined);
});

// ---- Conductivity floor (size-dependent, non-monotonic) -----------------------
test('conductivity gate: below floor fails, below band cautions, above band passes', () => {
  const base = { sizeInch: 6, connectionType: 'flange' } as const; // 150 mm → floor 3
  assert.equal(gate(configureAxg({ ...base, conductivityUScm: 2 }), 'conductivity')!.status, 'fail');
  assert.equal(gate(configureAxg({ ...base, conductivityUScm: 8 }), 'conductivity')!.status, 'caution');
  assert.equal(gate(configureAxg({ ...base, conductivityUScm: 50 }), 'conductivity')!.status, 'pass');
});

// ---- Remote sensor forces blanks + adds a companion cable ---------------------
test('remote sensor forces blank power/comm/wiring/display and quotes a signal cable', () => {
  const r = configureAxg({ sizeInch: 4, connectionType: 'flange', construction: 'remote_axg1a' });
  assert.equal(posCode(r, 12), '-N');
  assert.equal(posCode(r, 13), 'NN');
  assert.equal(posCode(r, 14), 'N');
  assert.equal(posCode(r, 15), 'N');
  const cable = r.companionItems.find((c) => c.role === 'signal_cable');
  assert.ok(cable, 'expected a signal cable companion item');
  assert.equal(cable!.partNumber, 'AX01C-B'); // construction E → AX01C-B
});
