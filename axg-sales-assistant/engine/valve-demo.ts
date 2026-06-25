// Personal test harness for the quarter-turn valve engine.
//
//   node valve-demo.ts                                          # built-in scenarios
//   node valve-demo.ts --family WKM --size 6                    # field-proven build
//   node valve-demo.ts --family WKM --size 8 --air 60psi        # Decatur 60psi
//   node valve-demo.ts --family FLOW-TEK --size 4 --package control
//   node valve-demo.ts --family WKM --size 6 --severe emergency_shutdown
//
// Flags: --family WKM|FLOW-TEK, --size <in>, --body lugged|wafer,
//   --package digital|control, --air 80psi|60psi,
//   --location south_digital|loudon_tn|decatur_il, --severe <code>.

import { configureValve } from './src/valve.ts';
import type { EngineResult, ValveInquiry } from './src/types.ts';

const useColor = !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const C = { dim: paint('2'), bold: paint('1'), yellow: paint('33'), red: paint('31'), cyan: paint('36') };

function render(title: string, r: EngineResult): void {
  console.log('\n' + C.bold('━'.repeat(72)));
  console.log(C.bold('  ' + title));
  console.log(C.bold('━'.repeat(72)));
  if (r.fatal) { console.log(C.red('  FATAL: ') + r.fatal); return; }
  console.log('  ' + C.bold(r.instrument));
  console.log('  Assembly number: ' + (r.assemblyNumber ? C.bold(r.assemblyNumber) : C.yellow('to be assigned (no verified number on file)')));
  console.log('  ' + C.bold('Bill of materials'));
  for (const a of r.assembly || []) {
    console.log(`    ${a.role.padEnd(20)} ${C.cyan(a.partNumber)}`);
  }
  if (r.flags.length) {
    console.log('\n  ' + C.bold('Flags'));
    for (const f of r.flags) console.log(`    [${f.severity === 'warn' ? C.yellow('WARN') : C.dim('INFO')}] ${f.kind} — ${f.detail}`);
  }
  if (r.questions.length) {
    console.log('\n  ' + C.bold('Open questions'));
    for (const q of r.questions) console.log('    • ' + q);
  }
  console.log('');
}

const SCENARIOS: { name: string; inq: ValveInquiry }[] = [
  { name: 'WKM 6" (all defaults — digital, 80psi, lugged, South Digital)', inq: { family: 'WKM', sizeInch: 6 } },
  { name: 'WKM 8" at 60 psi (Decatur)', inq: { family: 'WKM', sizeInch: 8, airPressure: '60psi' } },
  { name: 'FLOW-TEK 4" control (V-port)', inq: { family: 'FLOW-TEK', sizeInch: 4, package: 'control' } },
];

function parseFlags(argv: string[]): ValveInquiry {
  const inq: ValveInquiry = {};
  const next = (i: number) => argv[i + 1];
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--family': inq.family = next(i) as ValveInquiry['family']; i++; break;
      case '--size': inq.sizeInch = parseFloat(next(i)); i++; break;
      case '--body': inq.bodyStyle = next(i) as ValveInquiry['bodyStyle']; i++; break;
      case '--package': inq.package = next(i) as ValveInquiry['package']; i++; break;
      case '--air': inq.airPressure = next(i) as ValveInquiry['airPressure']; i++; break;
      case '--location': inq.location = next(i) as ValveInquiry['location']; i++; break;
      case '--severe': inq.severeService = next(i) as ValveInquiry['severeService']; i++; break;
      default: break;
    }
  }
  return inq;
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  for (const s of SCENARIOS) render(s.name, configureValve(s.inq));
} else {
  const inq = parseFlags(argv);
  render('Your valve inquiry', configureValve(inq));
  console.log(C.dim('  (input parsed as: ' + JSON.stringify(inq) + ')\n'));
}
