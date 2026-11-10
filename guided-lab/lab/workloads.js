/*
 * Workloads, service-level indicators and scorecards for the workload-first workshop.
 *
 * Each experiment plays a real slice of customer work against a local model server and keeps
 * every request. Derive functions turn the records into indicators (SLIs) and compare them
 * with the HYPOTHETICAL objectives below. Nothing is simulated: the agent's tools are real
 * functions on a lab-owned JSON calendar, and outcomes are read from that calendar.
 *
 * Shared by the browser lab, tools/capture.mjs and tools/selftest.mjs.
 */
(function (root) {
  'use strict';

  const Core = root.LabCore || (typeof require !== 'undefined' ? require('./core.js') : null);
  const { chat, round, now, nonce } = Core;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Illustrative targets written for this workshop and sized for a laptop running a
  // 1.5B-parameter model. They are not taken from any real contract or product. The author
  // set them after recording the reference systems, so that the systems differ against them.
  const OBJ = {
    chat_start_ms: 1000, chat_pct: 95, chat_quality_min: 0.9,
    completion_total_ms: 250, completion_pct: 95, completion_quality_min: 0.9,
    agent_task_ms: 3500, agent_pct: 90, agent_outcome_min: 0.9,
    batch_deadline_ms_per_100: 30000, batch_valid_min: 0.9,
    machine_rate_per_hour: 1.2, batch_cost_per_1000: 0.12,
    load_users: 4, think_ms: 400,
  };
  // How many observations a measured condition gets. A p95 read from 100 samples has five slower
  // samples behind it; from 40 it has two. Fewer than 20 cannot show a p95 at all.
  const SAMPLE = { standard: 100, choices: [40, 100, 200] };

  const CHAT_SYSTEM = 'You are a support assistant. Answer the question using only the context. Give the answer, then explain the relevant rule in two or three sentences.';
  const CHAT_ITEMS = [
    { q: 'How many days do customers have to request a refund?', expect: /\b30\b|thirty/i,
      ctx: 'Refund policy. Customers may request a refund within 30 days of purchase if the product is unused. Refunds are issued to the original payment method within five business days of approval. Gift cards and downloadable software are not refundable. Shipping fees are refunded only when the return is caused by our error. Requests are made through the orders page or by writing to the support desk.' },
    { q: 'Who must approve a production deploy on a Friday?', expect: /on-?call lead/i,
      ctx: 'Deploy policy. Production deploys run Monday to Thursday between 09:00 and 16:00 without extra approval. A deploy on a Friday must be approved by the on-call lead before it starts. Deploys on weekends are allowed only for incident fixes. Every deploy needs a linked ticket and a rollback plan. The release channel is notified automatically when a deploy begins and when it ends.' },
    { q: 'What is the nightly limit for hotel expenses?', expect: /180/,
      ctx: 'Travel expenses. Staff may book economy flights for trips under six hours. Hotel expenses are limited to 180 dollars per night unless a director approves a higher rate in advance. Meals are reimbursed up to 60 dollars per day with receipts. Taxis are reimbursed when public transport is unavailable. Expense reports are due within two weeks of returning.' },
    { q: 'How long are application logs kept?', expect: /\b90\b|ninety/i,
      ctx: 'Data retention. Application logs are kept for 90 days and then deleted automatically. Audit logs are kept for seven years. Customer uploads are kept until the customer deletes them or closes the account. Backups are encrypted and stored in two regions. Requests to delete personal data are completed within one month.' },
    { q: 'Which port does the internal VPN use?', expect: /51820/,
      ctx: 'Remote access. The internal VPN uses port 51820 and requires a hardware key at sign-in. Sessions end after twelve hours and must be started again. Personal devices are allowed only after enrolment with the device management tool. Contractors receive access to the staging network only. Lost hardware keys must be reported to the help desk the same day.' },
    { q: 'How far ahead can a lab room be booked?', expect: /two weeks|2 weeks|14 days|fourteen/i,
      ctx: 'Lab booking. Lab rooms can be booked up to two weeks ahead through the facilities calendar. A booking lasts at most four hours. Groups larger than eight people need the large lab on the second floor. Bookings that are not claimed within fifteen minutes are released. Food and drink are not allowed near the equipment benches.' },
  ];

  const COMPLETION_SYSTEM = 'You are a code completion engine inside an editor. Continue the code from exactly where it stops. Output only the rest of the current line. No explanation, no code fences.';
  const FILE_HEADER = '# utils.py - small helpers used across the billing service.\n# Keep functions pure and covered by tests.\n\nimport json\nimport math\n\n';
  const COMPLETION_ITEMS = [
    { prefix: 'def add(a, b):\n    return ', expect: /a\s*\+\s*b/ },
    { prefix: 'def is_even(n):\n    return n % 2 ', expect: /==\s*0/ },
    { prefix: 'def square(x):\n    return x ', expect: /\*\s*x|\*\*\s*2/ },
    { prefix: 'def load(path):\n    with open(path) as f:\n        return json.', expect: /load\(f\)/ },
    { prefix: 'def larger(a, b):\n    if a > b:\n        return a\n    return ', expect: /^\s*b\b/ },
    { prefix: 'def area_of_circle(r):\n    return math.pi * r ', expect: /\*\*\s*2|\*\s*r/ },
    { prefix: 'def greet(name):\n    return "Hello, " + ', expect: /name/ },
    { prefix: 'def first(items):\n    return items[', expect: /^\s*0\s*\]/ },
  ];

  const BATCH_SYSTEM = 'Extract fields from the procurement notice. Reply with one JSON object with exactly these keys: "ref", "agency", "deadline". Write the deadline as YYYY-MM-DD. No other text.';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const AGENCIES = ['Northern Rivers Water Board', 'Lakeshore Transit Authority', 'Eastfield Health District', 'Pinecrest School Board', 'Harbour City Parks Office', 'Midland Roads Agency'];
  const GOODS = ['water testing kits', 'bus shelter repairs', 'clinic waiting-room furniture', 'classroom projectors', 'playground resurfacing', 'road salt storage', 'laboratory freezers', 'ticket machine maintenance', 'mobile vaccination tents', 'library shelving', 'trail signage', 'bridge inspection services'];
  /** Twelve fictional procurement notices. Deterministic: same index, same text. */
  function notice(i) {
    const day = 3 + ((i * 7) % 25), month = (i * 5 + 10) % 12, year = month >= 10 ? 2026 : 2027;
    const ref = 'RFQ-' + year + '-' + String(1043 + i * 37).padStart(4, '0');
    const agency = AGENCIES[i % AGENCIES.length];
    const text = 'Request for quotation ' + ref + '. The ' + agency + ' invites quotations for ' + GOODS[i % GOODS.length] +
      '. Suppliers must be registered in the regional vendor list and hold valid insurance. Quotations must be received no later than ' +
      day + ' ' + MONTHS[month] + ' ' + year + ' at 17:00 local time. Questions may be sent to the procurement desk until five days before the closing date. ' +
      'The estimated contract value is ' + (20 + i * 15) + ',000 dollars. Late submissions will not be opened.';
    return { ref, agency, deadline: year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'), text };
  }
  function noticeOk(text, doc) {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b <= a) return false;
    try {
      const o = JSON.parse(text.slice(a, b + 1));
      const same = (x, y) => typeof x === 'string' && x.trim().toLowerCase() === y.toLowerCase();
      // Every promised field must be right: reference, agency and closing date.
      return same(o.ref, doc.ref) && same(o.agency, doc.agency) && same(o.deadline, doc.deadline);
    } catch (_) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* A real, sandboxed calendar the agent works on                       */
  /* ------------------------------------------------------------------ */
  // The store is a plain JSON object owned by the lab. Tools are ordinary functions that
  // read and change it. Nothing outside the lab is touched, and nothing is simulated:
  // a tool runs only when the model emits a valid call, and its real result is fed back.
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const PEOPLE = ['Sam', 'Priya', 'Omar', 'Lena', 'Chen', 'Aisha'];
  const TOPICS = ['project sync', 'design review', 'budget check-in', 'demo rehearsal', 'hiring debrief'];
  const DURATIONS = [30, 45, 60];
  const AGENT_TOOLS = ['calendar_find_slots', 'calendar_create_event', 'notes_append'];
  const MAX_AGENT_STEPS = 6;

  const fmtSlot = (min) => DAYS[Math.floor(min / 1440)] + ' ' + String(Math.floor((min % 1440) / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  function parseSlot(s) {
    const m = /^\s*(mon|tue|wed|thu|fri)[a-z]*\.?,?\s+(\d{1,2}):(\d{2})\s*$/i.exec(String(s));
    if (!m) return null;
    const d = DAYS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()), h = +m[2], mi = +m[3];
    return h > 23 || mi > 59 ? null : d * 1440 + h * 60 + mi;
  }
  function agentTask(i) {
    return { id: i, who: PEOPLE[i % PEOPLE.length], topic: TOPICS[(i * 3) % TOPICS.length], mins: DURATIONS[(i * 5) % DURATIONS.length] };
  }
  /** A fresh calendar for task i, with existing meetings for "me" and the other person. Deterministic. */
  function seedStore(i) {
    const who = agentTask(i).who, events = [];
    for (let d = 0; d < 5; d++) for (let h = 9; h < 17; h++) {
      if ((i * 7 + d * 3 + h * 5) % 3 === 0) events.push({ id: 'seed-' + events.length, title: 'busy', start: d * 1440 + h * 60, duration_minutes: 60, attendees: ['me'], by: 'seed' });
      if ((i * 5 + d * 7 + h * 3) % 4 === 0) events.push({ id: 'seed-' + events.length, title: 'busy', start: d * 1440 + h * 60, duration_minutes: 60, attendees: [who], by: 'seed' });
    }
    return { people: ['me'].concat(PEOPLE), events, notes: Object.create(null) };
  }
  function isFree(store, people, start, dur) {
    if (start % 1440 < 9 * 60 || (start % 1440) + dur > 17 * 60) return false;
    return !store.events.some((e) => e.attendees.some((a) => people.includes(a)) && start < e.start + e.duration_minutes && e.start < start + dur);
  }
  const isInt = (x) => typeof x === 'number' && Number.isInteger(x);
  const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
  const TOOLS = {
    calendar_find_slots(store, a) {
      if (!isStr(a.person)) return { ok: false, error: 'person must be a non-empty string' };
      const person = store.people.find((p) => p.toLowerCase() === a.person.trim().toLowerCase());
      if (!person || person === 'me') return { ok: false, error: 'unknown person: ' + a.person };
      if (!isInt(a.duration_minutes) || a.duration_minutes < 15 || a.duration_minutes > 240) return { ok: false, error: 'duration_minutes must be an integer between 15 and 240' };
      const slots = [];
      for (let d = 0; d < 5 && slots.length < 3; d++) for (let m = 9 * 60; m < 17 * 60 && slots.length < 3; m += 30) {
        if (isFree(store, ['me', person], d * 1440 + m, a.duration_minutes)) slots.push(fmtSlot(d * 1440 + m));
      }
      return { ok: true, slots };
    },
    calendar_create_event(store, a) {
      if (!isStr(a.title)) return { ok: false, error: 'title must be a non-empty string' };
      const start = parseSlot(a.start);
      if (start == null) return { ok: false, error: 'start must look like "Tue 10:00"' };
      if (!isInt(a.duration_minutes) || a.duration_minutes < 15 || a.duration_minutes > 240) return { ok: false, error: 'duration_minutes must be an integer between 15 and 240' };
      if (!Array.isArray(a.attendees) || !a.attendees.length || !a.attendees.every(isStr)) return { ok: false, error: 'attendees must be a non-empty list of names' };
      const attendees = [];
      for (const n of a.attendees) {
        const p = store.people.find((x) => x.toLowerCase() === n.trim().toLowerCase());
        if (!p) return { ok: false, error: 'unknown person: ' + n };
        if (p !== 'me') attendees.push(p);
      }
      if (!attendees.length) return { ok: false, error: 'attendees must include the other person' };
      if (!isFree(store, ['me'].concat(attendees), start, a.duration_minutes)) return { ok: false, error: 'that time is not free for everyone' };
      const ev = { id: 'ev-' + (store.events.length + 1), title: a.title.trim(), start, duration_minutes: a.duration_minutes, attendees: ['me'].concat(attendees), by: 'agent' };
      store.events.push(ev);
      return { ok: true, event_id: ev.id, start: fmtSlot(start), duration_minutes: ev.duration_minutes, attendees: ev.attendees };
    },
    notes_append(store, a) {
      if (!isStr(a.page) || !isStr(a.text)) return { ok: false, error: 'page and text must be non-empty strings' };
      const page = a.page.trim();
      // Page names are data, never property names on a shared prototype.
      if (page === '__proto__' || page === 'constructor' || page === 'prototype') return { ok: false, error: 'that page name is reserved' };
      if (!Object.prototype.hasOwnProperty.call(store.notes, page)) store.notes[page] = [];
      store.notes[page].push(a.text);
      return { ok: true };
    },
  };
  /** Parse the model's reply. Returns null for plain prose, or { name, args } / { error } for an attempted call. */
  function parseToolCall(text) {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a >= 0 && b <= a) return /"tool"/.test(text) || text.trim().startsWith('{') ? { error: 'the tool call was cut off before its closing brace' } : null;
    if (a < 0) return null;
    let o;
    try { o = JSON.parse(text.slice(a, b + 1)); } catch (_) {
      // Two calls in one reply is the usual cause. Say so, and execute neither: the contract is one call per reply.
      const many = (text.match(/"tool"\s*:/g) || []).length > 1;
      return { error: many ? 'more than one tool call in one reply; send exactly one JSON object' : 'the reply contained braces but was not valid JSON' };
    }
    if (!o || typeof o !== 'object' || !('tool' in o)) return { error: 'a tool call needs a "tool" field' };
    if (!AGENT_TOOLS.includes(o.tool)) return { error: 'unknown tool: ' + String(o.tool) };
    if (!o.arguments || typeof o.arguments !== 'object' || Array.isArray(o.arguments)) return { error: '"arguments" must be an object' };
    return { name: o.tool, args: o.arguments };
  }
  /** Run one tool for real and time it. */
  function execTool(store, call) {
    const t0 = now();
    let result;
    // A tool that fails is a logged tool error the model can see, never an uncaught exception in a measured run.
    try { result = TOOLS[call.name](store, call.args); } catch (err) { result = { ok: false, error: 'tool failed: ' + String((err && err.message) || err) }; }
    return { result, ms: now() - t0 };
  }
  /**
   * Did the requested outcome really happen? Judged from the calendar and the log of executed calls and their
   * real results, never from what the model says. The request is exact: one new event, with the requested
   * topic, only the requested person, the requested length, in the first slot returned by a lookup for that
   * same person and length.
   */
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function verifyOutcome(store, task, calls) {
    const made = store.events.filter((e) => e.by === 'agent');
    if (!made.length) return { ok: false, why: null };
    if (made.length > 1) return { ok: false, why: 'more than one event was created' };
    const ev = made[0];
    const others = ev.attendees.filter((a) => a !== 'me');
    if (others.length !== 1 || others[0] !== task.who) return { ok: false, why: 'the event has the wrong people' };
    if (ev.duration_minutes !== task.mins) return { ok: false, why: 'the event has the wrong length' };
    if (norm(ev.title) !== norm(task.topic)) return { ok: false, why: 'the event has the wrong title' };
    const created = calls.findIndex((c) => c.name === 'calendar_create_event' && c.ok);
    const lookup = calls.slice(0, created < 0 ? calls.length : created).filter((c) => c.name === 'calendar_find_slots' && c.ok && c.args &&
      norm(c.args.person) === norm(task.who) && c.args.duration_minutes === task.mins).pop();
    if (!lookup) return { ok: false, why: 'it booked without first looking up free slots for this person and length' };
    if (!lookup.result || !lookup.result.slots || parseSlot(lookup.result.slots[0]) !== ev.start) return { ok: false, why: 'the event is not in the first free slot' };
    return { ok: true, why: null };
  }

  const AGENT_PROMPTS = {
    baseline: [
      'You are a personal assistant agent with access to tools.',
      'To use a tool, reply with a single JSON object and nothing else: {"tool": "<name>", "arguments": {...}}.',
      'Tools:',
      '- calendar_find_slots(person: string, duration_minutes: integer): returns free time slots shared with that person this week.',
      '- calendar_create_event(title: string, start: string like "Tue 10:00", duration_minutes: integer, attendees: string[]): creates a calendar event.',
      '- notes_append(page: string, text: string): appends a line to a notes page.',
      'Use calendar_find_slots before creating an event. Create the event in the first free slot. When the event exists, reply to the user in one short sentence without calling a tool.',
    ].join('\n'),
  };
  AGENT_PROMPTS.explicit = AGENT_PROMPTS.baseline + '\n' + [
    'Follow these steps exactly, one tool call per reply:',
    'Step 1: reply with a calendar_find_slots call.',
    'Step 2: after you receive the slots, reply with a calendar_create_event call. Use the first slot as "start", the requested length as "duration_minutes", and the other person in "attendees".',
    'Step 3: only after calendar_create_event returns "ok": true, tell the user the meeting is booked.',
    'Never say a meeting is booked unless calendar_create_event returned "ok": true. If a tool returns an error, fix the call and try again.',
  ].join('\n');

  /** One agent task: a bounded loop of model calls and real tool executions. */
  async function runAgentTask(cfg, hooks, i, settings) {
    const task = agentTask(i), store = seedStore(i), calls = [], records = [];
    const messages = [
      { role: 'system', content: 'Session ' + nonce() + '\n' + (AGENT_PROMPTS[settings.prompt] || AGENT_PROMPTS.baseline) },
      { role: 'user', content: 'Book a ' + task.mins + '-minute ' + task.topic + ' with ' + task.who + ' in the first slot this week that is free for both of us. Title the event "' + task.topic + '".' },
    ];
    const t0 = now();
    let model_ms = 0, tool_ms = 0, steps = 0, finalText = '', stop = 'step_limit', checked = false, invalid = 0;
    while (steps < MAX_AGENT_STEPS) {
      steps += 1;
      const rec = await chat(cfg, { label: 'agent', tags: { workload: 'agent', task: i, step: steps }, messages, options: { num_predict: 96 }, onToken: hooks.onToken, signal: hooks.signal });
      records.push(rec);
      model_ms += rec.client.total_ms;
      messages.push({ role: 'assistant', content: rec.text });
      const call = parseToolCall(rec.text);
      if (call === null) {
        finalText = rec.text.trim();
        // Application lever: check the real calendar before believing the model, and say so once.
        if (settings.validate && !checked && !verifyOutcome(store, task, calls).ok) {
          checked = true;
          messages.push({ role: 'user', content: 'Check failed: the calendar has no matching event for this request yet. Do not answer in words. Reply with the next tool call as a JSON object.' });
          continue;
        }
        stop = 'answered';
        break;
      }
      if (call.error) {
        invalid += 1;
        calls.push({ name: null, ok: false, error: call.error, raw: rec.text });
        messages.push({ role: 'user', content: 'Tool error: ' + call.error + '.' });
        continue;
      }
      const { result, ms } = execTool(store, call);
      tool_ms += ms;
      if (!result.ok) invalid += 1;
      calls.push({ name: call.name, ok: !!result.ok, error: result.error || null, args: call.args, result, tool_ms: round(ms, 3) });
      messages.push({ role: 'user', content: 'Tool result (' + call.name + '): ' + JSON.stringify(result) });
    }
    const outcome = verifyOutcome(store, task, calls);
    let reason = null;
    if (!outcome.ok) {
      if (outcome.why) reason = outcome.why;
      else if (stop === 'step_limit') reason = 'ran out of steps (' + MAX_AGENT_STEPS + ') without booking';
      else if (!calls.length) reason = 'answered without calling any tool';
      else if (!calls.some((c) => c.name === 'calendar_create_event')) reason = 'said it was done without calling the tool that books';
      else reason = 'its booking calls were rejected as invalid';
    }
    return {
      records,
      task: {
        task: i, request: task, total_ms: round(now() - t0), model_ms: round(model_ms), tool_ms: round(tool_ms, 3), steps, model_calls: records.length,
        calls, invalid_calls: invalid, stop, rechecked: checked, outcome: outcome.ok, reason, final_text: finalText,
        created: store.events.filter((e) => e.by === 'agent').map((e) => ({ title: e.title, start: fmtSlot(e.start), duration_minutes: e.duration_minutes, attendees: e.attendees })),
        notes: Object.assign({}, store.notes), prompt: settings.prompt || 'baseline',
        // Everything after the system prompt, exactly as the model saw it: request, its replies, real tool results.
        transcript: messages.slice(1),
      },
      // The whole sandbox after the task (seeded and created events), for audits and the evidence tool.
      final_store: { events: store.events.map((e) => Object.assign({}, e, { start: fmtSlot(e.start) })), notes: Object.assign({}, store.notes) },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Request builders                                                    */
  /* ------------------------------------------------------------------ */
  async function chatRequest(cfg, hooks, itemIndex, tags, epoch) {
    const item = CHAT_ITEMS[itemIndex % CHAT_ITEMS.length];
    const rec = await chat(cfg, {
      label: 'chat', tags: Object.assign({ workload: 'chat', item: itemIndex % CHAT_ITEMS.length }, tags), epoch,
      // A fresh session tag stops one request being served from another's cached prompt, as with real retrieval.
      messages: [{ role: 'system', content: CHAT_SYSTEM }, { role: 'user', content: 'Session ' + nonce() + '\nContext:\n' + item.ctx + '\n\nQuestion: ' + item.q }],
      options: { num_predict: 80 }, onToken: hooks.onToken, signal: hooks.signal,
    });
    rec.tags.ok = item.expect.test(rec.text);
    return rec;
  }
  async function completionRequest(cfg, hooks, i, tags) {
    const item = COMPLETION_ITEMS[i % COMPLETION_ITEMS.length];
    const rec = await chat(cfg, {
      label: 'completion', tags: Object.assign({ workload: 'completion', item: i % COMPLETION_ITEMS.length }, tags),
      messages: [{ role: 'system', content: COMPLETION_SYSTEM }, { role: 'user', content: '# session ' + nonce() + '\n' + FILE_HEADER + item.prefix }],
      options: { num_predict: 16, stop: ['\n'] }, onToken: hooks.onToken, signal: hooks.signal,
    });
    rec.tags.ok = item.expect.test(rec.text.replace(/`/g, ''));
    return rec;
  }
  async function noticeRequest(cfg, hooks, i, tags, epoch, json) {
    const doc = notice(i);
    const rec = await chat(cfg, {
      label: 'notice', tags: Object.assign({ workload: 'batch', doc: i }, tags), epoch, format: json ? 'json' : undefined,
      messages: [{ role: 'system', content: BATCH_SYSTEM }, { role: 'user', content: doc.text }],
      options: { num_predict: 64 }, signal: hooks.signal,
    });
    rec.tags.ok = noticeOk(rec.text, doc);
    return rec;
  }

  // Stored records drop Ollama's raw counters block; the full model text, timings and checks are kept.
  function slim(rec) {
    return { label: rec.label, tags: rec.tags, client: rec.client, server: rec.server, done_reason: rec.done_reason, text: rec.text };
  }
  function envelope(cfg, experiment, settings, n) {
    return { experiment, core_version: Core.CORE_VERSION, started_at: new Date().toISOString(), model: cfg.model, options: Object.assign({}, Core.BASE_OPTIONS, cfg.extraOptions || {}), settings, n, records: [] };
  }
  function counter(hooks, total) {
    let i = 0;
    return (label) => { i += 1; if (hooks.onStep) hooks.onStep({ i, n: total, label }); };
  }
  const warm = (cfg, hooks) => Core.warm(cfg, hooks.signal);

  /* ------------------------------------------------------------------ */
  /* What the server is really doing                                     */
  /* ------------------------------------------------------------------ */
  /**
   * Observe the serving configuration instead of trusting a setting: which processor holds the
   * model (from Ollama's own report) and how many requests it serves at once (four probes fired
   * together; count how many were being answered at the same moment).
   */
  async function observeSystem(cfg, signal) {
    const out = { base: cfg.base, model: cfg.model, requested_cpu: !!(cfg.extraOptions && cfg.extraOptions.num_gpu === 0), observed_at: new Date().toISOString() };
    out.ollama_version = await Core.getVersion(cfg);
    const loaded = async () => (await Core.loadedModels(cfg)).find((x) => x.name === cfg.model || x.name === cfg.model + ':latest');
    // Ollama keeps a CPU runner alive for later requests that no longer ask for CPU. If the default was asked
    // for and the model is sitting entirely on the CPU, unload it so the server places it afresh.
    const before = await loaded();
    if (!out.requested_cpu && before && before.size && before.size_vram === 0) { out.reloaded_for_default = await Core.unload(cfg); }
    await Core.warm(cfg, signal);
    const epoch = now();
    const probes = await Promise.all([0, 1, 2, 3].map((k) => chat(cfg, { epoch, messages: [{ role: 'user', content: 'Probe ' + nonce() + '. Count from one to thirty in words.' }], options: { num_predict: 32 }, signal })));
    const firstEnd = Math.min(...probes.map((r) => r.client.offset_ms + r.client.total_ms));
    out.slots_observed = probes.filter((r) => r.client.offset_ms + r.client.ttft_ms < firstEnd).length;
    out.probe_count = probes.length;
    const m = await loaded();
    if (m) {
      out.model_bytes = m.size; out.gpu_bytes = m.size_vram; out.context_length = m.context_length;
      out.gpu_share = m.size ? round(m.size_vram / m.size, 2) : null;
      out.processor = out.gpu_share == null ? 'unknown' : out.gpu_share >= 0.99 ? 'GPU' : out.gpu_share <= 0.01 ? 'CPU' : 'GPU + CPU';
    } else out.processor = 'unknown';
    out.decode_tps = round(pct(probes.map((r) => (r.server.output_tokens && r.server.decode_ms ? (r.server.output_tokens / r.server.decode_ms) * 1000 : null)), 50));
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Lab 1 · one user, three kinds of "done"                             */
  /* ------------------------------------------------------------------ */
  const DEFAULTS = { done: { prompt: 'baseline', validate: false }, load: { users: 4 }, mixed: { workers: 4, share: true, json: false } };
  const agentCount = (n) => Math.max(10, Math.round(n * 0.4));
  async function runDone(cfg, hooks = {}) {
    const n = hooks.n || SAMPLE.standard, settings = Object.assign({}, DEFAULTS.done, hooks.settings), nTask = agentCount(n);
    const result = envelope(cfg, 'done', settings, n);
    result.tasks = [];
    const step = counter(hooks, 2 * n + nTask);
    await warm(cfg, hooks);
    for (let i = 0; i < n; i++) { step('Support chat: question ' + (i + 1) + ' of ' + n); result.records.push(slim(await chatRequest(cfg, hooks, i, {}))); }
    for (let i = 0; i < n; i++) { step('Code completion ' + (i + 1) + ' of ' + n); result.records.push(slim(await completionRequest(cfg, hooks, i, {}))); }
    for (let t = 0; t < nTask; t++) {
      step('Agent task ' + (t + 1) + ' of ' + nTask + ': model calls and real calendar tools');
      const r = await runAgentTask(cfg, hooks, t, settings);
      result.records.push(...r.records.map(slim));
      result.tasks.push(Object.assign({}, r.task, { final_store: r.final_store }));
    }
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* Lab 2 · the chat promise at a chosen number of concurrent users     */
  /* ------------------------------------------------------------------ */
  async function runLoad(cfg, hooks = {}) {
    const n = hooks.n || SAMPLE.standard, settings = Object.assign({}, DEFAULTS.load, hooks.settings), users = settings.users;
    const result = envelope(cfg, 'load', settings, n);
    const step = counter(hooks, n);
    await warm(cfg, hooks);
    let next = 0;
    const epoch = now();
    let failed = false;
    await Promise.all(Array.from({ length: users }, async (_, u) => {
      while (next < n && !failed) {
        const i = next++;
        await sleep(Math.random() * OBJ.think_ms);
        if (failed) return;
        let rec;
        try { rec = await chatRequest(cfg, u === 0 ? hooks : { signal: hooks.signal }, i, { users, user: u }, epoch); } catch (err) { failed = true; throw err; }
        if (failed) return; // a sibling failed while this request was in flight: report nothing further
        result.records.push(slim(rec));
        step('Answer ' + result.records.length + ' of ' + n + ' with ' + users + (users === 1 ? ' user' : ' users asking at once'));
      }
    }));
    result.wall_ms = round(now() - epoch);
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* Lab 3 · a batch against a deadline, with or without a chat user     */
  /* ------------------------------------------------------------------ */
  const CHAT_ALONE_N = 20;
  async function runMixed(cfg, hooks = {}) {
    const n = hooks.n || SAMPLE.standard, settings = Object.assign({}, DEFAULTS.mixed, hooks.settings);
    const result = envelope(cfg, 'mixed', settings, n);
    const step = counter(hooks, n + (settings.share ? CHAT_ALONE_N : 0));
    await warm(cfg, hooks);
    if (settings.share) {
      for (let i = 0; i < CHAT_ALONE_N; i++) {
        step('Chat user alone, before the batch: question ' + (i + 1) + ' of ' + CHAT_ALONE_N);
        await sleep(100);
        result.records.push(slim(await chatRequest(cfg, hooks, i, { phase: 'chat-alone' })));
      }
    }
    const epoch = now();
    let next = 0, running = true, done = 0, failed = false;
    const job = Promise.all(Array.from({ length: settings.workers }, async () => {
      while (next < n && !failed) {
        const i = next++;
        let rec;
        try { rec = await noticeRequest(cfg, hooks, i, { phase: 'batch' }, epoch, settings.json); } catch (err) { failed = true; running = false; throw err; }
        if (failed) return;
        result.records.push(slim(rec));
        done += 1;
        step('Notice ' + done + ' of ' + n + ' with ' + settings.workers + (settings.workers === 1 ? ' client worker' : ' client workers'));
      }
    })).then(() => { running = false; result.batch_wall_ms = round(now() - epoch); });
    const probe = (async () => {
      for (let i = 0; settings.share && running; i++) {
        await sleep(250);
        if (!running) break;
        const rec = await chatRequest(cfg, hooks, i + 3, { phase: 'chat-shared' }, epoch);
        if (failed) return;
        result.records.push(slim(rec));
      }
    })();
    await Promise.all([job, probe]);
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* Indicators and scorecards (pure)                                    */
  /* ------------------------------------------------------------------ */
  /** Nearest-rank percentile. */
  function pct(values, p) {
    const v = values.filter((x) => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)];
  }
  const need = (p) => Math.ceil(100 / (100 - p) - 1e-9); // smallest sample in which the percentile is not just the maximum
  const share = (xs) => (xs.length ? xs.filter(Boolean).length / xs.length : null);
  const med = (xs) => pct(xs, 50);
  const sec = (ms) => (ms % 1000 ? (ms / 1000).toFixed(1) : ms / 1000) + ' s';

  /** "p% of <things> within <limit>". With fewer samples than the percentile needs there is no verdict at all. */
  function latencyRow(id, promise, values, p, limit) {
    const n = values.length;
    if (n < need(p)) return { id, promise, kind: 'latency', n, p, limit, status: 'too-few', measured_as: n + ' of the ' + need(p) + ' needed' };
    const value = pct(values, p);
    return { id, promise, kind: 'latency', n, p, value: round(value), limit, measured_as: 'p' + p + ' of ' + n, status: value <= limit ? 'met' : 'missed', p50: round(med(values)) };
  }
  function shareRow(id, promise, flags, min) {
    const n = flags.length;
    if (!n) return { id, promise, kind: 'share', n: 0, limit: min, status: 'too-few', measured_as: 'no samples' };
    const value = share(flags);
    return { id, promise, kind: 'share', n, value: round(value, 3), limit: min, measured_as: flags.filter(Boolean).length + ' of ' + n, status: value >= min ? 'met' : 'missed' };
  }

  function deriveDone(result) {
    const R = result.records, tasks = result.tasks || [];
    const chatR = R.filter((r) => r.tags.workload === 'chat'), compR = R.filter((r) => r.tags.workload === 'completion');
    const reasons = {};
    for (const t of tasks) if (!t.outcome) reasons[t.reason] = (reasons[t.reason] || 0) + 1;
    const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
    const sum = (k) => tasks.reduce((s, t) => s + t[k], 0);
    const d = {
      chat: { n: chatR.length, ttft_p50: round(med(chatR.map((r) => r.client.ttft_ms))), total_p50: round(med(chatR.map((r) => r.client.total_ms))), quality: share(chatR.map((r) => r.tags.ok)) },
      completion: { n: compR.length, total_p50: round(med(compR.map((r) => r.client.total_ms))), quality: share(compR.map((r) => r.tags.ok)) },
      agent: {
        n: tasks.length, booked: tasks.filter((t) => t.outcome).length, task_p50: round(med(tasks.map((t) => t.total_ms))),
        steps_p50: med(tasks.map((t) => t.model_calls)), tool_ms_p50: round(med(tasks.map((t) => t.tool_ms)), 3),
        model_share: sum('total_ms') ? round(sum('model_ms') / sum('total_ms'), 3) : null,
        invalid_calls: sum('invalid_calls'), rechecked: tasks.filter((t) => t.rechecked).length,
        reasons: top, top_reason: top.length ? top[0][0] : null, examples: tasks.slice(0, 4),
      },
    };
    d.scorecard = [
      latencyRow('chat_start', OBJ.chat_pct + '% of chat answers start within ' + sec(OBJ.chat_start_ms), chatR.map((r) => r.client.ttft_ms), OBJ.chat_pct, OBJ.chat_start_ms),
      shareRow('chat_quality', 'At least ' + OBJ.chat_quality_min * 100 + '% of chat answers contain the fact from the context', chatR.map((r) => r.tags.ok), OBJ.chat_quality_min),
      latencyRow('completion_total', OBJ.completion_pct + '% of completions arrive whole within ' + OBJ.completion_total_ms + ' ms', compR.map((r) => r.client.total_ms), OBJ.completion_pct, OBJ.completion_total_ms),
      shareRow('completion_quality', 'At least ' + OBJ.completion_quality_min * 100 + '% of completions contain the expected code', compR.map((r) => r.tags.ok), OBJ.completion_quality_min),
      latencyRow('agent_task', OBJ.agent_pct + '% of agent tasks finish within ' + sec(OBJ.agent_task_ms) + ', tools included', tasks.map((t) => t.total_ms), OBJ.agent_pct, OBJ.agent_task_ms),
      shareRow('agent_outcome', 'At least ' + OBJ.agent_outcome_min * 100 + '% of agent tasks end with the right meeting in the calendar', tasks.map((t) => t.outcome), OBJ.agent_outcome_min),
    ];
    return d;
  }

  function deriveLoad(result) {
    const rs = result.records, users = result.settings.users;
    const ttft = rs.map((r) => r.client.ttft_ms), total = rs.map((r) => r.client.total_ms);
    const tokens = rs.reduce((s, r) => s + (r.server.output_tokens || 0), 0);
    const d = {
      users, n: rs.length, wall_ms: result.wall_ms,
      ttft_p50: round(med(ttft)), ttft_p95: round(pct(ttft, 95)), ttft_max: round(Math.max(...ttft)),
      total_p50: round(med(total)), total_p95: round(pct(total, 95)),
      prefill_p50: round(med(rs.map((r) => r.server.prefill_ms))),
      // Client first-word wait minus the server's prompt-reading time. Mostly time in line when the server
      // is busy, but it also contains transport and the first decode step, so it is not a pure queue timer.
      outside_prefill_p50: round(med(rs.map((r) => Math.max(0, r.client.ttft_ms - (r.server.prefill_ms || 0))))),
      within: share(ttft.map((x) => x <= OBJ.chat_start_ms)), quality: share(rs.map((r) => r.tags.ok)),
      user_tps: round(med(rs.map((r) => (r.server.output_tokens && r.client.total_ms > r.client.ttft_ms ? (r.server.output_tokens / (r.client.total_ms - r.client.ttft_ms)) * 1000 : null)))),
      total_tps: result.wall_ms ? round((tokens / result.wall_ms) * 1000) : null,
      answers_per_min: result.wall_ms ? round((rs.length / result.wall_ms) * 60000) : null,
    };
    d.scorecard = [
      latencyRow('chat_start', OBJ.chat_pct + '% of chat answers start within ' + sec(OBJ.chat_start_ms), ttft, OBJ.chat_pct, OBJ.chat_start_ms),
      shareRow('chat_quality', 'At least ' + OBJ.chat_quality_min * 100 + '% of answers contain the fact from the context', rs.map((r) => r.tags.ok), OBJ.chat_quality_min),
    ];
    return d;
  }

  function deriveMixed(result) {
    const docs = result.records.filter((r) => r.tags.workload === 'batch');
    const chats = (ph) => result.records.filter((r) => r.tags.phase === ph);
    const okN = docs.filter((r) => r.tags.ok).length, wall = result.batch_wall_ms;
    const cost = okN && wall ? ((wall / 1000) * OBJ.machine_rate_per_hour / 3600 / okN) * 1000 : null;
    const stat = (ph) => {
      const rs = chats(ph);
      if (!rs.length) return null;
      const t = rs.map((r) => r.client.ttft_ms);
      return { n: rs.length, ttft_p50: round(med(t)), ttft_p95: round(pct(t, 95)), ttft_max: round(Math.max(...t)), total_p50: round(med(rs.map((r) => r.client.total_ms))) };
    };
    const limit = Math.round((OBJ.batch_deadline_ms_per_100 * docs.length) / 100);
    const d = {
      workers: result.settings.workers, share: !!result.settings.share, json: !!result.settings.json, n: docs.length, wall_ms: wall, ok: okN,
      notices_per_min: wall ? round((docs.length / wall) * 60000) : null, per_notice_p50: round(med(docs.map((r) => r.client.total_ms))),
      cost_per_1000: cost == null ? null : round(cost, 3), deadline_ms: limit, chat_alone: stat('chat-alone'), chat_shared: stat('chat-shared'),
    };
    d.scorecard = [
      { id: 'batch_deadline', promise: 'All ' + docs.length + ' notices processed within ' + sec(limit), kind: 'deadline', n: docs.length, value: wall, limit, measured_as: 'one batch of ' + docs.length, status: wall <= limit ? 'met' : 'missed' },
      shareRow('batch_valid', 'At least ' + OBJ.batch_valid_min * 100 + '% of notices have reference, agency and date all correct', docs.map((r) => r.tags.ok), OBJ.batch_valid_min),
      cost == null
        ? { id: 'batch_cost', promise: 'At most $' + OBJ.batch_cost_per_1000.toFixed(2) + ' per 1,000 correct notices', kind: 'cost', n: 0, limit: OBJ.batch_cost_per_1000, status: 'too-few', measured_as: 'no correct notices' }
        : { id: 'batch_cost', promise: 'At most $' + OBJ.batch_cost_per_1000.toFixed(2) + ' per 1,000 correct notices, at $' + OBJ.machine_rate_per_hour.toFixed(2) + ' per machine-hour', kind: 'cost', n: okN, value: d.cost_per_1000, limit: OBJ.batch_cost_per_1000, measured_as: okN + ' correct notices', status: d.cost_per_1000 <= OBJ.batch_cost_per_1000 ? 'met' : 'missed' },
    ];
    if (d.share) d.scorecard.push(latencyRow('chat_shared', OBJ.chat_pct + '% of chat answers start within ' + sec(OBJ.chat_start_ms) + ' while the batch runs', chats('chat-shared').map((r) => r.client.ttft_ms), OBJ.chat_pct, OBJ.chat_start_ms));
    return d;
  }

  Object.assign(Core, {
    OBJ, SAMPLE, DEFAULTS, CHAT_ITEMS, COMPLETION_ITEMS, AGENT_TOOLS, AGENT_PROMPTS, MAX_AGENT_STEPS, CHAT_ALONE_N,
    notice, noticeOk, pct, need, agentCount, agentTask, seedStore, TOOLS, parseToolCall, execTool, verifyOutcome, parseSlot, fmtSlot, runAgentTask, observeSystem,
    experiments: { done: runDone, load: runLoad, mixed: runMixed },
    derive: { done: deriveDone, load: deriveLoad, mixed: deriveMixed },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof globalThis !== 'undefined' ? globalThis : this);
