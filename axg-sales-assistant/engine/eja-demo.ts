// Personal test harness for the EJA530E pressure-transmitter engine.
//
//   node eja-demo.ts                                  # built-in scenarios
//   node eja-demo.ts --span 100 --area haz            # 100 psi span, explosion-proof
//   node eja-demo.ts --span 2000                      # high span -> per-order capsule D
//   node eja-demo.ts --conn male --bracket no
//
// Flags: --span <psi>, --area gp|haz, --fluid "<text>", --temp <C>,
//   --conn female|male, --bracket yes|no, --indicator yes|no.

import { configureEja } from './src/eja.ts';
import type { EngineResult, EjaInquiry } from './src/types.ts';

const useColor = !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const C = { dim: paint('2'), bold: paint('1'), green: paint('32'), yellow: paint('33'), red: paint('31'), cyan: paint('36') };
const TAG: Record<string, (s: string) => string> = { customer: C.cyan, default: C.dim, rule: C.green, provisional: C.yellow };

function render(title: string, r: EngineResult): void {
  console.log('\n' + C.bold('━'.repeat(72)));
  console.log(C.bold('  ' + title));
  console.log(C.bold('━'.repeat(72)));
  if (r.fatal) { console.log(C.red('  FATAL: ') + r.fatal); return; }
  console.log('  Part number: ' + C.bold(r.modelCode!.partNumber) + (r.modelCode!.provisional ? C.yellow('  [PROVISIONAL]') : ''));
  console.log('  ' + C.bold('Positions'));
  for (const p of r.modelCode!.positions) {
    console.log(`    ${String(p.order).padStart(2)}  ${p.name.padEnd(20)} ${TAG[p.source](p.code.padEnd(8))} ${C.dim(p.description)}`);
  }
  if (r.computed) {
    const mark = r.computed.status === 'pass' ? C.green('PASS') : r.computed.status === 'fail' ? C.red('FAIL') : r.computed.status === 'caution' ? C.yellow('CAUTION') : C.cyan('N/A');
    console.log('\n  ' + C.bold('Computed range / span'));
    console.log(`    [${mark}] ${r.computed.detail}`);
    if (r.computed.metrics) console.log('    ' + C.dim(JSON.stringify(r.computed.metrics)));
  }
  if (r.gates.length) { console.log('\n  ' + C.bold('Gates')); for (const g of r.gates) { const m = g.status === 'pass' ? C.green('PASS') : g.status === 'fail' ? C.red('FAIL') : C.yellow(g.status.toUpperCase()); console.log(`    [${m}] ${g.detail}`); } }
  if (r.flags.length) { console.log('\n  ' + C.bold('Flags')); for (const f of r.flags) console.log(`    [${f.severity === 'warn' ? C.yellow('WARN') : C.dim('INFO')}] ${f.kind} — ${f.detail}`); }
  if (r.questions.length) { console.log('\n  ' + C.bold('Open questions')); for (const q of r.questions) console.log('    • ' + q); }
  console.log('');
}

const SCENARIOS: { name: string; inq: EjaInquiry }[] = [
  { name: '0–100 psi, explosion-proof (standard build)', inq: { requiredSpanPsi: 100, area: 'hazardous' } },
  { name: '0–2000 psi (per-order capsule D)', inq: { requiredSpanPsi: 2000, area: 'hazardous' } },
  { name: 'No range stated (defaults to capsule B full span)', inq: { area: 'hazardous' } },
];

function parseFlags(argv: string[]): EjaInquiry {
  const inq: EjaInquiry = {};
  const next = (i: number) => argv[i + 1];
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--span': inq.requiredSpanPsi = parseFloat(next(i)); i++; break;
      case '--area': { const v = next(i); inq.area = v === 'gp' ? 'general_purpose' : v === 'haz' ? 'hazardous' : (v as EjaInquiry['area']); i++; break; }
      case '--fluid': inq.fluid = next(i); i++; break;
      case '--temp': inq.temperatureMaxC = parseFloat(next(i)); i++; break;
      case '--conn': inq.pressureConnection = next(i) as EjaInquiry['pressureConnection']; i++; break;
      case '--bracket': inq.bracket = next(i) as EjaInquiry['bracket']; i++; break;
      case '--indicator': inq.indicator = next(i) as EjaInquiry['indicator']; i++; break;
      default: break;
    }
  }
  return inq;
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  for (const s of SCENARIOS) render(s.name, configureEja(s.inq));
} else {
  const inq = parseFlags(argv);
  render('Your EJA inquiry', configureEja(inq));
  console.log(C.dim('  (input parsed as: ' + JSON.stringify(inq) + ')\n'));
}
