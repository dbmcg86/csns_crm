// End-to-end runner: an email in, a drafted reply out. This makes LIVE Anthropic
// API calls — it needs the SDK installed and ANTHROPIC_API_KEY set:
//
//   cd axg-sales-assistant/llm && npm install
//   export ANTHROPIC_API_KEY=sk-ant-...
//   node run.ts "Need a 2-inch wafer mag, explosion proof, HART. 316 wetted fine."
//   node run.ts ./inquiry.txt          # or pass a file path
//   echo "..." | node run.ts           # or pipe on stdin

import { readFileSync, existsSync } from 'node:fs';
import { runEmail } from './src/pipeline.ts';

function readInput(): string {
  const arg = process.argv[2];
  if (arg) return existsSync(arg) ? readFileSync(arg, 'utf8') : arg;
  return readFileSync(0, 'utf8'); // stdin
}

const email = readInput().trim();
if (!email) {
  console.error('Provide an inquiry as an argument, a file path, or on stdin.');
  process.exit(1);
}

const { inquiry, result, draft } = await runEmail(email);

console.log('\n=== Extracted inquiry (LLM) ===');
console.log(JSON.stringify(inquiry, null, 2));

console.log('\n=== Engine result (deterministic) ===');
if (result.fatal) {
  console.log('FATAL: ' + result.fatal);
} else {
  console.log('Part number: ' + result.modelCode!.partNumber + (result.modelCode!.provisional ? '  [PROVISIONAL]' : ''));
  for (const g of result.gates) console.log(`  gate ${g.id}: ${g.status}`);
  for (const f of result.flags) console.log(`  flag ${f.kind}: ${f.severity}`);
}

console.log('\n=== Drafted reply (LLM — review before sending) ===');
console.log(draft);
console.log('');
