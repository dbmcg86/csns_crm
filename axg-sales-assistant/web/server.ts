// Minimal zero-dependency web server for the AXG Sales Assistant (Phase 4 UI).
// Runs the LLM pipeline SERVER-SIDE so the API key never reaches the browser, and
// also exposes the deterministic engine directly so the UI works with no key.
//
//   cd axg-sales-assistant/web
//   node server.ts                       # engine works now; email parsing needs a key
//   ANTHROPIC_API_KEY=sk-ant-... node server.ts   # full email -> draft pipeline
//
// (No install needed for the engine path; the LLM path reuses ../llm/node_modules.)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { configureAxg } from '../engine/src/axg.ts';
import { configureVy } from '../engine/src/vy.ts';
import { configureEja } from '../engine/src/eja.ts';
import { configureValve } from '../engine/src/valve.ts';
import { runInquiry } from '../llm/src/pipeline.ts';

const PORT = Number(process.env.PORT || 8787);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENGINES: Record<string, (inq: any) => unknown> = {
  axg: configureAxg, vy: configureVy, eja: configureEja, valve: configureValve,
};
const indexUrl = new URL('./public/index.html', import.meta.url);

function sendJson(res: ServerResponse, code: number, obj: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  try {
    const url = req.url || '/';
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      const html = await readFile(indexUrl);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (req.method === 'GET' && url === '/api/health') {
      return sendJson(res, 200, { ok: true, hasKey: !!process.env.ANTHROPIC_API_KEY });
    }
    // Engine path — deterministic, no LLM, no key required.
    if (req.method === 'POST' && url === '/api/configure') {
      const { instrument, inquiry } = JSON.parse((await readBody(req)) || '{}');
      const fn = ENGINES[instrument];
      if (!fn) return sendJson(res, 400, { error: `Unknown instrument "${instrument}". Use axg | vy | eja | valve.` });
      return sendJson(res, 200, { result: fn(inquiry || {}) });
    }
    // Full pipeline — triage + extract + reply. Needs a key.
    if (req.method === 'POST' && url === '/api/quote') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return sendJson(res, 503, { error: 'Live email parsing needs ANTHROPIC_API_KEY on the server. Use the "Build by fields" tab to run the validated engine without a key.' });
      }
      const { email } = JSON.parse((await readBody(req)) || '{}');
      if (!email || !String(email).trim()) return sendJson(res, 400, { error: 'Provide an inquiry email.' });
      const routed = await runInquiry(String(email));
      return sendJson(res, 200, routed);
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  } catch (e) {
    sendJson(res, 500, { error: String((e as Error)?.message || e) });
  }
});

server.listen(PORT, () => console.log(`AXG Sales Assistant UI → http://localhost:${PORT}`));
