// Personal test harness for the AXG engine. Throw inquiries at the real Phase-1
// configurator and see the validated output (model code, gates, flags, questions).
//
// Usage (Node >= 22, no install needed):
//   node demo.ts                      # run all built-in demo scenarios
//   node demo.ts list                 # list built-in scenarios
//   node demo.ts scenario 3           # run one built-in scenario
//   node demo.ts --size 6 --conn flange --area haz --fluid "nitric acid" --temp 80
//
// Flags:
//   --size <in>            line size in inches        --size-mm <mm>
//   --conn wafer|flange    process connection         --rating 150|300
//   --area gp|haz          area classification (omit = unstated → holds -C)
//   --fluid "<text>"       process fluid              --temp <C>   max temperature
//   --cond <uS/cm>         conductivity               --flow <gpm> design flow
//   --abrasive             abrasive / slurry service
//   --electrode "<mat>"    e.g. 316L, hastelloy, tantalum, tungsten
//   --construction integral|remote_axg1a|remote_axg4a|remote_axfa11
//   --accuracy standard|high   --grounding yes|no    --power ac|dc_24
//   --competitor "<brand>" e.g. rosemount_8705, foxboro, endress
//   --output "<text>"      e.g. HART

import { configureAxg } from './src/axg.ts';
import type { AxgInquiry, EngineResult } from './src/types.ts';

// Color only on an interactive terminal; honor NO_COLOR so piped/redirected
// output stays clean plain text.
const useColor = !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const C = {
  dim: paint('2'),
  bold: paint('1'),
  green: paint('32'),
  yellow: paint('33'),
  red: paint('31'),
  cyan: paint('36'),
};

const SOURCE_TAG: Record<string, (s: string) => string> = {
  customer: C.cyan,
  default: C.dim,
  rule: C.green,
  provisional: C.yellow,
};

const SCENARIOS: { name: string; inq: AxgInquiry }[] = [
  {
    name: 'Rosemount 10" GP retrofit',
    inq: { sizeInch: 10, connectionType: 'flange', area: 'general_purpose', fluid: 'city water', temperatureMaxC: 25, conductivityUScm: 600, competitorBrand: 'rosemount_8705', outputType: 'HART' },
  },
  {
    name: '2" XP wafer, HART, fluid not named',
    inq: { sizeInch: 2, connectionType: 'wafer', area: 'hazardous', electrodeMaterial: '316', accuracy: 'standard', outputType: 'HART' },
  },
  {
    name: '3" 50% nitric acid @ 80C (permeable)',
    inq: { sizeInch: 3, connectionType: 'flange', area: 'hazardous', fluid: '50% nitric acid', temperatureMaxC: 80, outputType: 'HART' },
  },
  {
    name: 'Ottumwa basin 6" abrasive, area unstated',
    inq: { sizeInch: 6, connectionType: 'flange', fluid: 'high-pH coal-ash rinse water', temperatureMaxC: 66, conductivityUScm: 5000, flowGpm: 600, abrasiveOrSlurry: true },
  },
];

function render(title: string, r: EngineResult): void {
  console.log('\n' + C.bold('━'.repeat(72)));
  console.log(C.bold('  ' + title));
  console.log(C.bold('━'.repeat(72)));

  if (r.fatal) {
    console.log(C.red('  FATAL: ') + r.fatal);
    return;
  }
  const mc = r.modelCode!;
  const codeLine = mc.positions.map((p) => SOURCE_TAG[p.source](p.code)).join(' ');
  console.log('  Model code:  ' + codeLine);
  console.log('  Part number: ' + C.bold(mc.partNumber) + (mc.provisional ? C.yellow('  [PROVISIONAL]') : ''));
  console.log(C.dim('  legend: ') + C.cyan('customer') + '  ' + C.dim('default') + '  ' + C.green('rule') + '  ' + C.yellow('provisional'));

  console.log('\n  ' + C.bold('Positions'));
  for (const p of mc.positions) {
    const code = SOURCE_TAG[p.source](p.code.padEnd(7));
    console.log(`    ${String(p.order).padStart(2)}  ${p.name.padEnd(26)} ${code} ${C.dim(p.description)}`);
  }

  if (r.gates.length) {
    console.log('\n  ' + C.bold('Gates'));
    for (const g of r.gates) {
      const mark = g.status === 'pass' ? C.green('PASS')
        : g.status === 'fail' ? C.red('FAIL')
        : g.status === 'caution' ? C.yellow('CAUTION') : C.cyan('ASK');
      console.log(`    [${mark}] ${g.detail}`);
    }
  }

  if (r.flags.length) {
    console.log('\n  ' + C.bold('Flags'));
    for (const f of r.flags) {
      const mark = f.severity === 'blocked' ? C.red('BLOCKED') : f.severity === 'warn' ? C.yellow('WARN') : C.dim('INFO');
      console.log(`    [${mark}] ${f.kind} — ${f.detail}`);
      if (f.alternatives && f.alternatives.length) {
        console.log(C.dim('       alternatives: ') + f.alternatives.join(', '));
      }
    }
  }

  if (r.companionItems.length) {
    console.log('\n  ' + C.bold('Companion items'));
    for (const c of r.companionItems) {
      console.log(`    ${c.role}  ${C.bold(c.partNumber)}  ${C.dim(c.note || '')}`);
    }
  }

  if (r.questions.length) {
    console.log('\n  ' + C.bold('Open questions for the reply'));
    for (const q of r.questions) console.log('    • ' + q);
  }
  console.log('');
}

function parseFlags(argv: string[]): AxgInquiry {
  const inq: AxgInquiry = {};
  const next = (i: number) => argv[i + 1];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--size': inq.sizeInch = parseFloat(next(i)); i++; break;
      case '--size-mm': inq.sizeMm = parseFloat(next(i)); i++; break;
      case '--conn': inq.connectionType = next(i) as AxgInquiry['connectionType']; i++; break;
      case '--rating': inq.connectionRating = next(i) as AxgInquiry['connectionRating']; i++; break;
      case '--area': inq.area = next(i) === 'gp' ? 'general_purpose' : next(i) === 'haz' ? 'hazardous' : (next(i) as AxgInquiry['area']); i++; break;
      case '--fluid': inq.fluid = next(i); i++; break;
      case '--temp': inq.temperatureMaxC = parseFloat(next(i)); i++; break;
      case '--cond': inq.conductivityUScm = parseFloat(next(i)); i++; break;
      case '--flow': inq.flowGpm = parseFloat(next(i)); i++; break;
      case '--abrasive': inq.abrasiveOrSlurry = true; break;
      case '--electrode': inq.electrodeMaterial = next(i); i++; break;
      case '--construction': inq.construction = next(i) as AxgInquiry['construction']; i++; break;
      case '--accuracy': inq.accuracy = next(i) as AxgInquiry['accuracy']; i++; break;
      case '--grounding': inq.groundingRings = next(i) as AxgInquiry['groundingRings']; i++; break;
      case '--power': inq.powerSupply = next(i) as AxgInquiry['powerSupply']; i++; break;
      case '--competitor': inq.competitorBrand = next(i); i++; break;
      case '--output': inq.outputType = next(i); i++; break;
      default: break;
    }
  }
  return inq;
}

const argv = process.argv.slice(2);

if (argv[0] === 'list') {
  console.log('Built-in scenarios:');
  SCENARIOS.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));
} else if (argv[0] === 'scenario') {
  const n = parseInt(argv[1], 10);
  const s = SCENARIOS[n - 1];
  if (!s) { console.error(`No scenario ${n}. Run "node demo.ts list".`); process.exit(1); }
  render(s.name, configureAxg(s.inq));
} else if (argv.length === 0) {
  for (const s of SCENARIOS) render(s.name, configureAxg(s.inq));
} else {
  const inq = parseFlags(argv);
  render('Your inquiry', configureAxg(inq));
  console.log(C.dim('  (input parsed as: ' + JSON.stringify(inq) + ')\n'));
}
