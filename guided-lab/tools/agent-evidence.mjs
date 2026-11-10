#!/usr/bin/env node
/*
 * Write a complete, auditable log of real agent tasks: every message the model saw, every reply,
 * every executed tool call with its real result, the final sandbox calendar, and the verdict.
 *
 *   node tools/agent-evidence.mjs [--base http://127.0.0.1:11434] [--tasks 4] [--prompt baseline|explicit] [--validate 1] [--out lab/data/evidence]
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
require(path.join(here, '..', 'lab', 'core.js'));
const C = require(path.join(here, '..', 'lab', 'workloads.js'));
const a = {};
for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const cfg = { base: a.base || C.DEFAULT_BASE, model: a.model || C.DEFAULT_MODEL };
const settings = { prompt: a.prompt || 'baseline', validate: a.validate === '1' };
const observed = await C.observeSystem(cfg);
const out = { kind: 'agent-evidence', written_at: new Date().toISOString(), settings, observed, system_prompt: C.AGENT_PROMPTS[settings.prompt], max_steps: C.MAX_AGENT_STEPS, tasks: [] };
for (let i = 0; i < Number(a.tasks || 4); i++) {
  const seed = C.seedStore(i);
  const r = await C.runAgentTask(cfg, {}, i, settings);
  out.tasks.push({ seeded_events: seed.events.length, task: r.task, model_records: r.records.map((x) => ({ step: x.tags.step, text: x.text, client: x.client, server: x.server })), final_store: r.final_store });
  console.log('task ' + i + ': ' + (r.task.outcome ? 'BOOKED' : 'not booked: ' + r.task.reason) + ' | calls: ' + (r.task.calls.map((c) => (c.name || 'unusable') + (c.ok ? ' ok' : ' rejected')).join(', ') || 'none'));
}
const dir = path.resolve(a.out || path.join(here, '..', 'lab', 'data', 'evidence'));
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'agent-' + settings.prompt + (settings.validate ? '-checked' : '') + '.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log('wrote ' + file);
