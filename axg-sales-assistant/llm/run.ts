// End-to-end runner: an email in, a routed + drafted reply out. Triages the
// instrument (mag vs vortex vs decline), then extracts → engine → reply. Makes
// LIVE Anthropic API calls — needs the SDK installed and ANTHROPIC_API_KEY set:
//
//   cd axg-sales-assistant/llm && npm install
//   export ANTHROPIC_API_KEY=sk-ant-...
//   node run.ts "Vortex on steam, 5000 lb/hr, 150 psig, 3 inch."
//   node run.ts ./inquiry.txt          # or a file path
//   echo "..." | node run.ts           # or stdin

import { readFileSync, existsSync } from 'node:fs';
import { runInquiry } from './src/pipeline.ts';

function readInput(): string {
  const arg = process.argv[2];
  if (arg) return existsSync(arg) ? readFileSync(arg, 'utf8') : arg;
  return readFileSync(0, 'utf8');
}

const email = readInput().trim();
if (!email) {
  console.error('Provide an inquiry as an argument, a file path, or on stdin.');
  process.exit(1);
}

const routed = await runInquiry(email);

console.log('\n=== Triage (LLM router) ===');
console.log(`instrument: ${routed.instrument} — ${routed.triageReason}`);

if (routed.inquiry) {
  console.log('\n=== Extracted inquiry (LLM) ===');
  console.log(JSON.stringify(routed.inquiry, null, 2));
}

if (routed.result) {
  const r = routed.result;
  console.log('\n=== Engine result (deterministic) ===');
  if (r.fatal) {
    console.log('FATAL: ' + r.fatal);
  } else {
    if (r.modelCode) console.log('Part number: ' + r.modelCode.partNumber + (r.modelCode.provisional ? '  [PROVISIONAL]' : ''));
    if (r.assembly) for (const a of r.assembly) console.log(`  item ${a.title}: ${a.partNumber}`);
    if (r.computed) console.log(`  computed ${r.computed.id}: ${r.computed.status}`);
    for (const g of r.gates) console.log(`  gate ${g.id}: ${g.status}`);
  }
}

console.log('\n=== Drafted reply (LLM — review before sending) ===');
console.log(routed.draft);
console.log('');
