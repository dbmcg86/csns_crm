// Personal test harness for the VY vortex engine (sibling of demo.ts).
//
//   node vy-demo.ts                                   # built-in scenarios
//   node vy-demo.ts --size 3 --steam 150 --lbhr 5000  # steam low-flow check
//   node vy-demo.ts --size 6 --fluid water --gpm 400   # liquid low-flow check
//   node vy-demo.ts --size 4 --steam 150 --lbhr 6000 --remote --cable 18
//
// Flags: --size <in>/--size-mm <mm>, --conn wafer|flange, --rating 150|300|600,
//   --area gp|haz, --fluid "<text>", --temp <C>, --steam <psig>, --lbhr <lb/hr>,
//   --gpm <gpm>, --tempcomp yes|no, --remote, --cable <m>.

import { configureVy } from './src/vy.ts';
import type { EngineResult, VyInquiry } from './src/types.ts';

const useColor = !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const C = { dim: paint('2'), bold: paint('1'), green: paint('32'), yellow: paint('33'), red: paint('31'), cyan: paint('36') };
const TAG: Record<string, (s: string) => string> = { customer: C.cyan, default: C.dim, rule: C.green, provisional: C.yellow };

function render(title: string, r: EngineResult): void {
  console.log('\n' + C.bold('━'.repeat(72)));
  console.log(C.bold('  ' + title));
  console.log(C.bold('━'.repeat(72)));
  if (r.fatal) { console.log(C.red('  FATAL: ') + r.fatal); return; }

  if (r.modelCode) {
    console.log('  Part number: ' + C.bold(r.modelCode.partNumber) + (r.modelCode.provisional ? C.yellow('  [PROVISIONAL]') : ''));
    console.log('  ' + C.bold('Positions'));
    for (const p of r.modelCode.positions) {
      console.log(`    ${String(p.order).padStart(2)}  ${p.name.padEnd(22)} ${TAG[p.source](p.code.padEnd(7))} ${C.dim(p.description)}`);
    }
  }
  if (r.assembly) {
    console.log('  ' + C.bold('Assembly (' + r.assembly.length + ' line items)'));
    for (const a of r.assembly) {
      console.log(`    • ${a.title}: ${C.bold(a.partNumber)}${a.provisional ? C.yellow(' [provisional]') : ''}`);
      if (a.note) console.log('        ' + C.dim(a.note));
    }
  }
  if (r.computed) {
    const mark = r.computed.status === 'pass' ? C.green('PASS') : r.computed.status === 'fail' ? C.red('FAIL') : r.computed.status === 'caution' ? C.yellow('CAUTION') : C.cyan('N/A');
    console.log('\n  ' + C.bold('Computed sizing'));
    console.log(`    [${mark}] ${r.computed.detail}`);
    if (r.computed.metrics) console.log('    ' + C.dim(JSON.stringify(r.computed.metrics)));
  }
  if (r.gates.length) {
    console.log('\n  ' + C.bold('Gates'));
    for (const g of r.gates) {
      const mark = g.status === 'pass' ? C.green('PASS') : g.status === 'fail' ? C.red('FAIL') : g.status === 'caution' ? C.yellow('CAUTION') : C.cyan('ASK');
      console.log(`    [${mark}] ${g.detail}`);
    }
  }
  if (r.flags.length) {
    console.log('\n  ' + C.bold('Flags'));
    for (const f of r.flags) {
      const mark = f.severity === 'blocked' ? C.red('BLOCKED') : f.severity === 'warn' ? C.yellow('WARN') : C.dim('INFO');
      console.log(`    [${mark}] ${f.kind} — ${f.detail}`);
    }
  }
  if (r.questions.length) {
    console.log('\n  ' + C.bold('Open questions'));
    for (const q of r.questions) console.log('    • ' + q);
  }
  console.log('');
}

const SCENARIOS: { name: string; inq: VyInquiry }[] = [
  { name: 'Steam 5000 lb/hr @ 150 psig, 3" (the real quote)', inq: { sizeInch: 3, connectionType: 'flange', fluid: 'saturated steam', steamPressurePsig: 150, steamMassLbHr: 5000 } },
  { name: 'Liquid (condensate) 400 gpm, 6"', inq: { sizeInch: 6, connectionType: 'flange', fluid: 'condensate', flowGpm: 400 } },
  { name: 'Remote steam build, 4" @ 150 psig, 18 m cable', inq: { sizeInch: 4, fluid: 'saturated steam', steamPressurePsig: 150, steamMassLbHr: 6000, mount: 'remote', cableLengthM: 18 } },
];

function parseFlags(argv: string[]): VyInquiry {
  const inq: VyInquiry = {};
  const next = (i: number) => argv[i + 1];
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--size': inq.sizeInch = parseFloat(next(i)); i++; break;
      case '--size-mm': inq.sizeMm = parseFloat(next(i)); i++; break;
      case '--conn': inq.connectionType = next(i) as VyInquiry['connectionType']; i++; break;
      case '--rating': inq.connectionRating = next(i) as VyInquiry['connectionRating']; i++; break;
      case '--area': { const v = next(i); inq.area = v === 'gp' ? 'general_purpose' : v === 'haz' ? 'hazardous' : (v as VyInquiry['area']); i++; break; }
      case '--fluid': inq.fluid = next(i); i++; break;
      case '--temp': inq.temperatureMaxC = parseFloat(next(i)); i++; break;
      case '--steam': inq.steamPressurePsig = parseFloat(next(i)); i++; break;
      case '--lbhr': inq.steamMassLbHr = parseFloat(next(i)); i++; break;
      case '--gpm': inq.flowGpm = parseFloat(next(i)); i++; break;
      case '--tempcomp': inq.tempCompensated = next(i) as VyInquiry['tempCompensated']; i++; break;
      case '--remote': inq.mount = 'remote'; break;
      case '--cable': inq.cableLengthM = parseFloat(next(i)); i++; break;
      default: break;
    }
  }
  return inq;
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  for (const s of SCENARIOS) render(s.name, configureVy(s.inq));
} else {
  const inq = parseFlags(argv);
  render('Your VY inquiry', configureVy(inq));
  console.log(C.dim('  (input parsed as: ' + JSON.stringify(inq) + ')\n'));
}
