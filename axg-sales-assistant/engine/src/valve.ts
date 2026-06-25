// The quarter-turn valve configurator — the structurally different instrument the
// result contract was designed to carry (Pilot Spec §15.4). Not a suffix code: a
// multi-component ASSEMBLY (valve body + linkage + actuator + mounting + trim +
// control element) resolved from FIELD-PROVEN STOCK BUILDS, with the verified
// rolled-up assembly number LOOKED UP (never generated).
//
// Standard service only: severe service is FLAGGED for human confirmation, never
// auto-upsized (matches valve_rules.json pending_confirmations).

import type { AssemblyItem, EngineResult, Flag } from './types.ts';
import type { ValveInquiry } from './types.ts';
import {
  FAMILIES, VALVE, fmtSize, familySizes, nearestSize, resolveFamily, rolledUpNumber, sizeKey,
} from './valveTruth.ts';

export function configureValve(inq: ValveInquiry): EngineResult {
  const flags: Flag[] = [];
  const questions: string[] = [];
  const base = (extra: Partial<EngineResult> = {}): EngineResult => ({
    instrument: 'Quarter-turn valve assembly',
    kind: 'assembly',
    companionItems: [],
    gates: [],
    flags,
    questions,
    ...extra,
  });

  // --- family ---
  const famName = resolveFamily(inq.family);
  if (!famName) {
    return base({ fatal: 'Valve family not recognized. Specify WKM (butterfly) or FLOW-TEK (ball).' });
  }
  const fam = FAMILIES[famName];
  const core = VALVE.field_proven_core[fam.key];

  // --- size (nearest field-proven) ---
  if (inq.sizeInch == null) {
    return base({ fatal: `No valve size found. Give a line size (field-proven ${famName} sizes: ${familySizes(fam.key).map(fmtSize).join(', ')} in).` });
  }
  const sz = nearestSize(fam.key, inq.sizeInch);
  const szKey = sizeKey(sz);
  if (!core[szKey]) {
    return base({ fatal: `No field-proven build for ${fmtSize(sz)}" ${famName}.` });
  }
  const sizeFlagged = Math.abs(sz - inq.sizeInch) > 0.01;

  // --- assume-and-flag dimensions (air/location coupled: Decatur = 60 psi) ---
  const pkg = inq.package === 'control' ? 'control' : 'digital';
  const pkgDefaulted = !inq.package;
  const location = inq.location || (inq.airPressure === '60psi' ? 'decatur_il' : 'south_digital');
  const locationDefaulted = !inq.location;
  const air = inq.airPressure || (location === 'decatur_il' ? '60psi' : '80psi');
  const airDefaulted = !inq.airPressure;
  const trim = VALVE.trim_packages[location];

  // --- body style (WKM only) ---
  let bodyStyle = fam.bodyDefault;
  let bodyDefaulted = false;
  if (fam.bodyCodes) {
    bodyStyle = inq.bodyStyle === 'wafer' ? 'wafer' : 'lugged';
    bodyDefaulted = !inq.bodyStyle;
  }

  // --- actuator: family x package x air x size (the sizing-critical pick) ---
  const actBank = VALVE.field_proven_core.actuator_by_package[fam.key]?.[pkg]?.[air];
  let actuator: string = actBank?.[szKey];
  let actNote: string | null = null;
  if (!actuator) {
    actuator =
      VALVE.field_proven_core.actuator_by_package[fam.key]?.[pkg]?.['80psi']?.[szKey] ||
      core[szKey].actuator;
    actNote = `No exact field-proven actuator for ${pkg}/${air}/${fmtSize(sz)}"; showing the closest field-proven actuator — confirm.`;
  }

  // --- valve body line ---
  let valveLine: string;
  if (fam.bodyCodes) {
    valveLine = `${fmtSize(sz)}" WKM ${fam.bodyCodes[bodyStyle]}-02-S02-11/00 (${bodyStyle} butterfly)`;
  } else {
    valveLine = core[szKey].valve + (pkg === 'control' ? ' (V PORT)' : '');
  }

  // --- mounting kit (from the location's trim, by size) ---
  const mount = sz >= 10 ? trim.mounting_kit['10in_up'] : trim.mounting_kit['to_8in'];

  // --- BOM ---
  const bom: AssemblyItem[] = [];
  const add = (role: string, partNumber: string) => bom.push({ role, title: role, partNumber });
  add('Valve', valveLine);
  add('Lockable linkage kit', core[szKey].linkage);
  add('Actuator', actuator);
  add('Mounting kit', mount);
  if (pkg === 'digital') {
    add('Limit switch', trim.limit_switch);
    add('Solenoid', VALVE.control_element_by_package.digital.solenoid);
    add('Solenoid cordset', VALVE.control_element_by_package.digital.cordset);
  } else {
    const posByLoc = VALVE.control_element_by_package.control._positioner_by_location;
    add('Positioner', posByLoc[location] || posByLoc.default);
    add('Fitting / tubing', VALVE.control_element_by_package.control.fitting_tubing);
  }

  // --- verified rolled-up assembly number (lookup only) ---
  const asmNumber = rolledUpNumber(fam.key, pkg, air, location, szKey);
  if (!asmNumber) {
    flags.push({
      kind: 'ASSEMBLY-NUMBER',
      severity: 'warn',
      detail: 'No verified rolled-up assembly number on file for this exact combination — the component BOM is field-proven; assign the assembly number per Allied numbering (not auto-generated).',
    });
  }

  // --- assume-and-flag notices ---
  if (airDefaulted) flags.push({ kind: 'AIR-PRESSURE', severity: 'warn', detail: 'Air pressure not stated — assumed 80 psi (South Digital / Loudon standard). At 60 psi (Decatur) the actuator upsizes. Confirm.' });
  if (pkgDefaulted) flags.push({ kind: 'PACKAGE', severity: 'warn', detail: 'Assumed digital (on/off). Say "control" for a modulating package (positioner instead of solenoid).' });
  if (bodyDefaulted) flags.push({ kind: 'BODY-STYLE', severity: 'warn', detail: 'Body style not stated — assumed lugged (B5123). Wafer (B5120) available; both share all accessories/actuators, only the valve body differs.' });
  if (locationDefaulted) flags.push({ kind: 'LOCATION', severity: 'warn', detail: 'Trim/location not stated — assumed South Digital (TVF limit switch, AV-TA01 mounting). Loudon (NXL2100/HY-STOOL) or Decatur (60 psi) available.' });
  if (sizeFlagged) flags.push({ kind: 'SIZE', severity: 'warn', detail: `Requested ${inq.sizeInch}" — nearest field-proven ${famName} size is ${fmtSize(sz)}". Confirm.` });
  if (actNote) flags.push({ kind: 'ACTUATOR', severity: 'warn', detail: actNote });
  if (famName === 'FLOW-TEK' && pkg === 'control') flags.push({ kind: 'CONTROL', severity: 'info', detail: 'Control package — FLOW-TEK control valve uses V-PORT trim (modulating) and the upsized control actuator. A standard on/off ball cannot modulate.' });

  // --- severe service: FLAG, never auto-upsize ---
  if (inq.severeService && inq.severeService !== 'standard') {
    const f = VALVE.severe_service_factors[inq.severeService];
    flags.push({
      kind: 'SEVERE-SERVICE',
      severity: 'warn',
      detail: `Service flagged "${inq.severeService}"${typeof f === 'number' ? ` (×${f})` : ''}. The field-proven build is sized for STANDARD service — severe duty may need a larger actuator. Verify against the torque chart before quoting. NOT auto-upsized.`,
    });
  }

  questions.push('Confirm family, body style, package type, air pressure, and location/trim — defaults assumed where not stated (see flags).');

  return base({
    instrument: `${fmtSize(sz)}" ${fam.label} — ${pkg} package`,
    assembly: bom,
    assemblyNumber: asmNumber ?? undefined,
  });
}
