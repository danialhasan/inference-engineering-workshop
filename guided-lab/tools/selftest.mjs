#!/usr/bin/env node
// Regression checks for the lab's validators and local tools. No model needed: node tools/selftest.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
require(path.join(here, '..', 'lab', 'core.js'));
const C = require(path.join(here, '..', 'lab', 'workloads.js'));
let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name); };
const call = (store, name, args) => C.execTool(store, { name, args }).result;

// notices: every promised field is checked
const doc = C.notice(3);
t('notice: all three fields right is accepted', C.noticeOk(JSON.stringify({ ref: doc.ref, agency: doc.agency, deadline: doc.deadline }), doc));
t('notice: wrong agency is rejected', !C.noticeOk(JSON.stringify({ ref: doc.ref, agency: 'Some Other Agency', deadline: doc.deadline }), doc));
t('notice: any non-empty agency no longer passes', !C.noticeOk(JSON.stringify({ ref: doc.ref, agency: 'x', deadline: doc.deadline }), doc));
t('notice: wrong date is rejected', !C.noticeOk(JSON.stringify({ ref: doc.ref, agency: doc.agency, deadline: '2026-01-01' }), doc));
t('notice: fenced JSON is accepted', C.noticeOk('```json\n' + JSON.stringify({ ref: doc.ref, agency: doc.agency, deadline: doc.deadline }) + '\n```', doc));
t('notice: prose is rejected', !C.noticeOk('The reference is ' + doc.ref, doc));

// tool-call parsing
t('parse: prose is not a call', C.parseToolCall('The meeting is booked.') === null);
t('parse: unknown tool is an error', !!C.parseToolCall('{"tool":"send_email","arguments":{}}').error);
t('parse: missing arguments object is an error', !!C.parseToolCall('{"tool":"calendar_create_event"}').error);
t('parse: a tool call cut off before its closing brace is an invalid call, not prose', /cut off/.test((C.parseToolCall('{"tool": "calendar_find_slots", "arguments": {') || {}).error || ''));
t('parse: prose that merely mentions a brace is still prose', C.parseToolCall('I will use the { symbol later') === null);
t('parse: two calls in one reply are rejected with the reason', /more than one tool call/.test(C.parseToolCall('{"tool":"calendar_find_slots","arguments":{"person":"Sam","duration_minutes":30}}\n{"tool":"calendar_create_event","arguments":{}}').error));

// tools validate their arguments
const task = C.agentTask(0);
let s = C.seedStore(0);
t('create: empty arguments are rejected (was counted valid before)', call(s, 'calendar_create_event', {}).ok === false);
t('create: rejected call changes nothing', s.events.filter((e) => e.by === 'agent').length === 0);
t('find: wrong type for duration is rejected', call(s, 'calendar_find_slots', { person: task.who, duration_minutes: '30' }).ok === false);
t('find: unknown person is rejected', call(s, 'calendar_find_slots', { person: 'Nobody', duration_minutes: 30 }).ok === false);
const found = call(s, 'calendar_find_slots', { person: task.who, duration_minutes: task.mins });
t('find: returns real free slots', found.ok && found.slots.length === 3 && found.slots.every((x) => C.parseSlot(x) != null));
t('create: malformed start is rejected', call(s, 'calendar_create_event', { title: 'x', start: 'tomorrow', duration_minutes: task.mins, attendees: [task.who] }).ok === false);
const busy = s.events.find((e) => e.attendees.includes('me'));
t('create: a busy time is rejected', call(s, 'calendar_create_event', { title: 'x', start: C.fmtSlot(busy.start), duration_minutes: 30, attendees: [task.who] }).ok === false);
const made = call(s, 'calendar_create_event', { title: task.topic, start: found.slots[0], duration_minutes: task.mins, attendees: [task.who] });
t('create: a valid call creates the event', made.ok && s.events.filter((e) => e.by === 'agent').length === 1);
t('create: the same slot cannot be booked twice', call(s, 'calendar_create_event', { title: 'again', start: found.slots[0], duration_minutes: task.mins, attendees: [task.who] }).ok === false);

// outcome is read from the store and the log of executed calls with their real results
const play = (i, steps) => { const st = C.seedStore(i), log = []; for (const [name, args] of steps) { const { result } = C.execTool(st, { name, args }); log.push({ name, ok: !!result.ok, args, result }); } return { st, log }; };
const first = found.slots[0], second = found.slots[1];
const good = (over = {}) => Object.assign({ title: task.topic, start: first, duration_minutes: task.mins, attendees: [task.who] }, over);
const lookup = ['calendar_find_slots', { person: task.who, duration_minutes: task.mins }];
let g = play(0, [lookup, ['calendar_create_event', good()]]);
t('outcome: the exact request (topic, person, length, first slot after a matching lookup) is a success', C.verifyOutcome(g.st, task, g.log).ok);
t('outcome: no event means failure, whatever the model said', !C.verifyOutcome(C.seedStore(0), task, []).ok);
g = play(0, [lookup, ['calendar_create_event', good({ title: 'Lunch' })]]);
t('outcome: an unrelated title fails', !C.verifyOutcome(g.st, task, g.log).ok && /title/.test(C.verifyOutcome(g.st, task, g.log).why));
g = play(0, [lookup, ['calendar_create_event', good({ title: 'Do NOT attend ' + task.topic })]]);
t('outcome: a contradictory title containing the requested words fails', !C.verifyOutcome(g.st, task, g.log).ok);
g = play(0, [lookup, ['calendar_create_event', good({ start: second })]]);
t('outcome: the second offered slot fails', !C.verifyOutcome(g.st, task, g.log).ok && /first free slot/.test(C.verifyOutcome(g.st, task, g.log).why));
const other = ['Sam', 'Priya', 'Omar', 'Lena', 'Chen', 'Aisha'].find((x) => x !== task.who);
g = play(0, [['calendar_find_slots', { person: other, duration_minutes: task.mins }], ['calendar_create_event', good()]]);
t('outcome: a lookup for another person does not count', !C.verifyOutcome(g.st, task, g.log).ok);
g = play(0, [['calendar_find_slots', { person: task.who, duration_minutes: task.mins + 15 }], ['calendar_create_event', good()]]);
t('outcome: a lookup for another length does not count', !C.verifyOutcome(g.st, task, g.log).ok);
g = play(0, [lookup, ['calendar_create_event', good({ attendees: [task.who, other] })]]);
t('outcome: an extra participant fails', g.st.events.filter((e) => e.by === 'agent').length === 0 || !C.verifyOutcome(g.st, task, g.log).ok);
g = play(0, [['calendar_create_event', good()]]);
t('outcome: booking without any lookup fails on sequencing', !C.verifyOutcome(g.st, task, g.log).ok);
g = play(0, [lookup, ['calendar_create_event', good({ duration_minutes: task.mins === 15 ? 30 : 15 })]]);
t('outcome: the wrong length fails', !C.verifyOutcome(g.st, task, g.log).ok);
g = play(0, [lookup, ['calendar_create_event', good()], ['calendar_create_event', good({ start: second })]]);
t('outcome: two created events fail', !C.verifyOutcome(g.st, task, g.log).ok);

// notes: page names are data
s = C.seedStore(0);
t('notes: a reserved page name is a tool error, not a crash', C.execTool(s, { name: 'notes_append', args: { page: '__proto__', text: 'x' } }).result.ok === false && ({}).polluted === undefined);
t('notes: "constructor" is rejected too', C.execTool(s, { name: 'notes_append', args: { page: 'constructor', text: 'x' } }).result.ok === false);
t('notes: an ordinary page works and is stored', C.execTool(s, { name: 'notes_append', args: { page: 'Meetings', text: 'booked' } }).result.ok && s.notes.Meetings.length === 1);
t('tools: an exception inside a tool becomes a logged error', C.execTool(s, { name: 'calendar_find_slots', args: null }).result.ok === false);
t('samples: a p90 needs 10 and a p95 needs 20', C.need(90) === 10 && C.need(95) === 20);

// percentiles need enough samples; no verdict otherwise
const few = C.derive.load({ settings: { users: 1 }, wall_ms: 1000, records: Array.from({ length: 8 }, () => ({ tags: { ok: true }, client: { ttft_ms: 50, total_ms: 100 }, server: { prefill_ms: 10, output_tokens: 5 } })) });
t('percentile: 8 samples give no p95 verdict', few.scorecard[0].status === 'too-few');
const many = C.derive.load({ settings: { users: 1 }, wall_ms: 1000, records: Array.from({ length: 40 }, (_, i) => ({ tags: { ok: true }, client: { ttft_ms: i < 37 ? 50 : 5000, total_ms: 100 }, server: { prefill_ms: 10, output_tokens: 5 } })) });
t('percentile: 3 slow answers in 40 miss a p95 target', many.scorecard[0].status === 'missed' && many.scorecard[0].n === 40);

// the agent loop is bounded and never invents a tool call (stubbed model that only talks)
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response('{"message":{"content":"The meeting is booked."},"done":false}\n{"done":true,"done_reason":"stop","prompt_eval_count":10,"eval_count":5,"prompt_eval_duration":1,"eval_duration":1,"total_duration":2,"load_duration":0}\n');
let r = await C.runAgentTask({ base: 'http://stub', model: 'stub' }, {}, 0, { prompt: 'baseline', validate: false });
t('agent: a model that only talks books nothing and is marked failed', r.task.outcome === false && r.task.created.length === 0 && /without calling any tool/.test(r.task.reason));
const fullRun = await C.experiments.done({ base: 'http://stub', model: 'stub' }, { n: 1, settings: { prompt: 'baseline', validate: false } });
t('agent: the measured run retains every complete final sandbox for export', fullRun.tasks.length === C.agentCount(1) && fullRun.tasks.every((task) => task.final_store && Array.isArray(task.final_store.events) && task.final_store.events.length > 0 && task.final_store.notes));
r = await C.runAgentTask({ base: 'http://stub', model: 'stub' }, {}, 0, { prompt: 'baseline', validate: true });
t('agent: the calendar check asks once, then stops', r.task.rechecked === true && r.task.model_calls === 2 && r.task.outcome === false);
globalThis.fetch = async () => new Response('{"message":{"content":"{\\"tool\\":\\"calendar_create_event\\",\\"arguments\\":{}}"},"done":false}\n{"done":true,"done_reason":"stop","prompt_eval_count":10,"eval_count":5,"prompt_eval_duration":1,"eval_duration":1,"total_duration":2,"load_duration":0}\n');
r = await C.runAgentTask({ base: 'http://stub', model: 'stub' }, {}, 0, { prompt: 'baseline', validate: false });
t('agent: endless invalid calls stop at the step limit with nothing booked', r.task.model_calls === C.MAX_AGENT_STEPS && r.task.outcome === false && /ran out of steps/.test(r.task.reason) && r.task.invalid_calls === C.MAX_AGENT_STEPS);
globalThis.fetch = realFetch;

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
