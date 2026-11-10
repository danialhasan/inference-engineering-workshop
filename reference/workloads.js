/*
 * Workloads, service-level indicators and scorecards for the workload-first workshop.
 *
 * Each experiment plays a small, fixed slice of customer work against a local model
 * server and records every request. The derive functions turn those records into
 * indicators (SLIs) and compare them with the HYPOTHETICAL objectives below.
 *
 * Shared by the browser lab and tools/capture.mjs, so live and recorded results
 * are produced and judged by the same code.
 */
(function (root) {
  'use strict';

  const Core = root.LabCore || (typeof require !== 'undefined' ? require('./core.js') : null);
  const { chat, warm, round, now, nonce } = Core;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ------------------------------------------------------------------ */
  /* Hypothetical objectives                                             */
  /* ------------------------------------------------------------------ */
  // Illustrative targets written for this workshop and sized for a laptop running a
  // 1.5B-parameter model. They are not taken from any real contract or product. The author
  // set them after trial runs so that the three recorded systems fall on different sides of them.
  const OBJ = {
    chat_start_ms: 1000,        // a chat answer must START within this, measured at the client
    chat_pct: 95,
    chat_quality_min: 0.9,      // share of answers that contain the fact from the supplied context
    completion_total_ms: 250,   // a code completion must ARRIVE WHOLE within this
    completion_pct: 95,
    agent_task_ms: 3500,        // a whole agent task (every model call plus every tool wait)
    agent_pct: 90,
    agent_valid_min: 0.9,       // share of tasks in which every tool call was valid
    batch_deadline_ms: 4000,    // the whole batch of notices
    batch_valid_min: 0.9,       // share of notices extracted correctly
    machine_rate_per_hour: 1.2, // hypothetical price of the machine, in dollars
    batch_cost_per_1000: 0.12,  // hypothetical cost limit, dollars per 1,000 correct notices
    load_users: 4,              // demand condition for the chat promise
    think_ms: 400,              // each simulated user pauses 0..think_ms before each question
  };

  /* ------------------------------------------------------------------ */
  /* Work items (written for this workshop; every organisation is fictional) */
  /* ------------------------------------------------------------------ */

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

  const AGENT_TOOLS = ['calendar_find_slots', 'calendar_create_event', 'notes_append'];
  const AGENT_SYSTEM = [
    'You are a personal assistant agent with access to tools.',
    'To use a tool, reply with a single JSON object and nothing else: {"tool": "<name>", "arguments": {...}}.',
    'Tools:',
    '- calendar_find_slots(person: string, duration_minutes: integer, week: string): returns free time slots shared with that person.',
    '- calendar_create_event(title: string, start: string, duration_minutes: integer, attendees: string[]): creates a calendar event.',
    '- notes_append(page: string, text: string): appends a line to a notes page.',
    'Rules: use calendar_find_slots before creating an event. Create the event in the first free slot. When the event exists, reply to the user in one short sentence without calling a tool.',
  ].join('\n');
  // Simulated tool latencies: fixed delays standing in for real calendar APIs. No real tool is called.
  const TOOL_WAIT_MS = [400, 1200];
  const AGENT_TASKS = [
    { who: 'Sam', topic: 'project sync', mins: 30, slot: 'Tuesday 10:00' },
    { who: 'Priya', topic: 'design review', mins: 45, slot: 'Wednesday 14:00' },
    { who: 'Omar', topic: 'budget check-in', mins: 30, slot: 'Thursday 09:30' },
    { who: 'Lena', topic: 'demo rehearsal', mins: 60, slot: 'Friday 13:00' },
  ];
  function agentMessages(task, step, session) {
    const m = [
      { role: 'system', content: 'Session ' + session + '\n' + AGENT_SYSTEM },
      { role: 'user', content: 'Book a ' + task.mins + '-minute ' + task.topic + ' with ' + task.who + ' this week.' },
    ];
    if (step >= 2) {
      m.push({ role: 'assistant', content: JSON.stringify({ tool: 'calendar_find_slots', arguments: { person: task.who, duration_minutes: task.mins, week: 'this week' } }) });
      m.push({ role: 'user', content: 'Tool result (calendar_find_slots): free slots are ' + task.slot + ', and Friday 16:00.' });
    }
    if (step >= 3) {
      m.push({ role: 'assistant', content: JSON.stringify({ tool: 'calendar_create_event', arguments: { title: task.topic, start: task.slot, duration_minutes: task.mins, attendees: [task.who] } }) });
      m.push({ role: 'user', content: 'Tool result (calendar_create_event): created event "' + task.topic + '" on ' + task.slot + '.' });
    }
    return m;
  }
  const AGENT_EXPECT = ['calendar_find_slots', 'calendar_create_event', null];
  function toolCallOf(text) {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try {
      const o = JSON.parse(text.slice(a, b + 1));
      return typeof o.tool === 'string' ? o.tool : null;
    } catch (_) {
      return null;
    }
  }

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
  const BATCH_SIZE = 12;
  function noticeOk(text, doc) {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b <= a) return false;
    try {
      const o = JSON.parse(text.slice(a, b + 1));
      return String(o.ref).trim() === doc.ref && String(o.deadline).trim() === doc.deadline && typeof o.agency === 'string' && o.agency.length > 0;
    } catch (_) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Request builders                                                    */
  /* ------------------------------------------------------------------ */

  // A fresh session tag keeps one request's context from being served from another's cache,
  // as in real retrieval, where each question brings different documents.
  async function chatRequest(cfg, hooks, itemIndex, tags, epoch) {
    const item = CHAT_ITEMS[itemIndex % CHAT_ITEMS.length];
    const rec = await chat(cfg, {
      label: 'chat', tags: Object.assign({ workload: 'chat', item: itemIndex % CHAT_ITEMS.length }, tags), epoch,
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
  async function noticeRequest(cfg, hooks, i, tags, epoch) {
    const doc = notice(i);
    const rec = await chat(cfg, {
      label: 'notice', tags: Object.assign({ workload: 'batch', doc: i }, tags), epoch,
      messages: [{ role: 'system', content: BATCH_SYSTEM }, { role: 'user', content: doc.text }],
      options: { num_predict: 64 }, signal: hooks.signal,
    });
    rec.tags.ok = noticeOk(rec.text, doc);
    return rec;
  }

  function envelope(cfg, experiment, params) {
    return { experiment, core_version: Core.CORE_VERSION, started_at: new Date().toISOString(), model: cfg.model, options: Object.assign({}, Core.BASE_OPTIONS, cfg.extraOptions || {}), params, records: [] };
  }
  function stepper(hooks, total) {
    let i = 0;
    return (label) => { i += 1; if (hooks.onStep) hooks.onStep({ i, n: total, label }); };
  }

  /* ------------------------------------------------------------------ */
  /* Lab 1 · one user, three kinds of "done"                             */
  /* ------------------------------------------------------------------ */
  async function runDone(cfg, hooks = {}) {
    // scale > 1 repeats the same work to collect more samples (used when recording reference systems).
    const scale = hooks.scale || 1;
    const nChat = 4 * scale, nComp = COMPLETION_ITEMS.length * scale, nTask = AGENT_TASKS.length * scale;
    const result = envelope(cfg, 'done', { scale, chat_requests: nChat, completion_requests: nComp, agent_tasks: nTask, tool_wait_ms: TOOL_WAIT_MS });
    result.tasks = [];
    const step = stepper(hooks, 1 + nChat + nComp + nTask);
    step('Warming up');
    await warm(cfg, hooks.signal);
    for (let i = 0; i < nChat; i++) {
      step('Chat: support question ' + (i + 1) + ' of ' + nChat);
      result.records.push(await chatRequest(cfg, hooks, i, { phase: 'single' }));
    }
    for (let i = 0; i < nComp; i++) {
      step('Code completion ' + (i + 1) + ' of ' + nComp);
      result.records.push(await completionRequest(cfg, hooks, i, { phase: 'single' }));
    }
    for (let t = 0; t < nTask; t++) {
      step('Agent task ' + (t + 1) + ' of ' + nTask + ': three model calls and two tool waits');
      const session = nonce(), t0 = now();
      let model_ms = 0, tool_ms = 0, valid = true;
      for (let s = 1; s <= 3; s++) {
        const rec = await chat(cfg, {
          label: 'agent', tags: { workload: 'agent', task: t, step: s, phase: 'single' },
          messages: agentMessages(AGENT_TASKS[t % AGENT_TASKS.length], s, session), options: { num_predict: s === 3 ? 40 : 64 }, onToken: hooks.onToken, signal: hooks.signal,
        });
        const tool = toolCallOf(rec.text);
        rec.tags.tool = tool;
        rec.tags.ok = AGENT_EXPECT[s - 1] ? tool === AGENT_EXPECT[s - 1] : tool === null && rec.text.trim().length > 0;
        if (!rec.tags.ok) valid = false;
        model_ms += rec.client.total_ms;
        result.records.push(rec);
        if (s < 3) { await sleep(TOOL_WAIT_MS[s - 1]); tool_ms += TOOL_WAIT_MS[s - 1]; }
      }
      result.tasks.push({ task: t, total_ms: round(now() - t0), model_ms: round(model_ms), tool_ms, valid });
    }
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* Lab 2 · the chat promise under concurrent users                     */
  /* ------------------------------------------------------------------ */
  const LOAD_LEVELS = [1, 2, 4];
  const LOAD_REQUESTS_EACH = 6;
  async function runLoad(cfg, hooks = {}) {
    const each = LOAD_REQUESTS_EACH * (hooks.scale || 1);
    const result = envelope(cfg, 'load', { scale: hooks.scale || 1, levels: LOAD_LEVELS, requests_per_user: each, think_ms: OBJ.think_ms });
    result.levels = [];
    const step = stepper(hooks, 1 + LOAD_LEVELS.length);
    step('Warming up');
    await warm(cfg, hooks.signal);
    for (const users of LOAD_LEVELS) {
      step(users + (users === 1 ? ' user' : ' users at once') + ', ' + each + ' questions each');
      const epoch = now();
      await Promise.all(Array.from({ length: users }, async (_, u) => {
        for (let r = 0; r < each; r++) {
          await sleep(Math.random() * OBJ.think_ms);
          result.records.push(await chatRequest(cfg, u === 0 ? hooks : { signal: hooks.signal }, u * each + r, { phase: 'load', users, user: u }, epoch));
        }
      }));
      result.levels.push({ users, wall_ms: round(now() - epoch) });
    }
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* Lab 3 · a batch deadline, and a chat user on the same server        */
  /* ------------------------------------------------------------------ */
  async function batch(cfg, hooks, result, phase, workers, epoch) {
    let next = 0;
    await Promise.all(Array.from({ length: workers }, async () => {
      while (next < BATCH_SIZE) {
        const i = next++;
        result.records.push(await noticeRequest(cfg, hooks, i, { phase, workers }, epoch));
      }
    }));
  }
  async function runMixed(cfg, hooks = {}) {
    const result = envelope(cfg, 'mixed', { batch_size: BATCH_SIZE, workers: [1, 4], probe_think_ms: 250 });
    result.phases = [];
    const step = stepper(hooks, 5);
    step('Warming up');
    await warm(cfg, hooks.signal);

    step('Chat user alone: 4 questions');
    let epoch = now();
    for (let i = 0; i < 4; i++) { await sleep(250); result.records.push(await chatRequest(cfg, hooks, i, { phase: 'chat-alone' }, epoch)); }
    result.phases.push({ phase: 'chat-alone', wall_ms: round(now() - epoch) });

    for (const workers of [1, 4]) {
      step('Batch alone: ' + BATCH_SIZE + ' notices, ' + workers + (workers === 1 ? ' at a time' : ' in parallel'));
      epoch = now();
      await batch(cfg, hooks, result, 'batch-' + workers, workers, epoch);
      result.phases.push({ phase: 'batch-' + workers, wall_ms: round(now() - epoch) });
    }

    step('Shared: the batch (4 in parallel) while a chat user keeps asking');
    epoch = now();
    let running = true, batchWall = 0;
    const job = batch(cfg, hooks, result, 'shared', 4, epoch).then(() => { running = false; batchWall = round(now() - epoch); });
    const probe = (async () => {
      for (let i = 0; i < 12 && (running || i < 3); i++) {
        await sleep(250);
        result.records.push(await chatRequest(cfg, hooks, i + 2, { phase: 'shared' }, epoch));
      }
    })();
    await Promise.all([job, probe]);
    result.phases.push({ phase: 'shared', wall_ms: batchWall });
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
  const need = (p) => Math.ceil(1 / (1 - p / 100)); // smallest n at which the percentile is not just the maximum
  const share = (xs) => (xs.length ? xs.filter(Boolean).length / xs.length : null);
  const med = (xs) => pct(xs, 50);

  /** A latency objective row: "p% of <things> within <limit>". With too few samples it is judged on the worst one and flagged thin. */
  function latencyRow(id, promise, values, p, limit) {
    const n = values.length;
    if (!n) return { id, promise, kind: 'latency', n: 0, status: 'no-data' };
    const thin = n < need(p);
    const value = thin ? Math.max(...values) : pct(values, p);
    return { id, promise, kind: 'latency', n, p, thin, value: round(value), limit, measured_as: thin ? 'worst of ' + n : 'p' + p + ' of ' + n, status: value <= limit ? 'met' : 'missed', p50: round(med(values)) };
  }
  function shareRow(id, promise, flags, min) {
    const n = flags.length;
    if (!n) return { id, promise, kind: 'share', n: 0, status: 'no-data' };
    const value = share(flags);
    return { id, promise, kind: 'share', n, value: round(value, 3), limit: min, measured_as: flags.filter(Boolean).length + ' of ' + n, status: value >= min ? 'met' : 'missed' };
  }
  const sec = (ms) => (ms / 1000).toFixed(ms % 1000 ? 1 : 0) + ' s';

  function deriveDone(result) {
    const R = result.records;
    const chatR = R.filter((r) => r.tags.workload === 'chat');
    const compR = R.filter((r) => r.tags.workload === 'completion');
    const agentR = R.filter((r) => r.tags.workload === 'agent');
    const tasks = result.tasks || [];
    const taskTotal = tasks.reduce((s, t) => s + t.total_ms, 0);
    const d = {
      chat: { n: chatR.length, ttft_p50: round(med(chatR.map((r) => r.client.ttft_ms))), total_p50: round(med(chatR.map((r) => r.client.total_ms))), quality: share(chatR.map((r) => r.tags.ok)) },
      completion: { n: compR.length, total_p50: round(med(compR.map((r) => r.client.total_ms))), total_max: compR.length ? Math.max(...compR.map((r) => r.client.total_ms)) : null, quality: share(compR.map((r) => r.tags.ok)) },
      agent: {
        n: tasks.length, calls: agentR.length,
        task_p50: round(med(tasks.map((t) => t.total_ms))),
        tool_share: taskTotal ? round(tasks.reduce((s, t) => s + t.tool_ms, 0) / taskTotal, 3) : null,
        model_share: taskTotal ? round(tasks.reduce((s, t) => s + t.model_ms, 0) / taskTotal, 3) : null,
        first_call_ms: round(med(agentR.filter((r) => r.tags.step === 1).map((r) => r.client.total_ms))),
        later_call_ms: round(med(agentR.filter((r) => r.tags.step > 1).map((r) => r.client.total_ms))),
        reused_known: agentR.every((r) => r.server.cached_tokens != null),
        later_reused: round(med(agentR.filter((r) => r.tags.step > 1).map((r) => (r.server.cached_tokens || 0) / (r.server.prompt_tokens || 1))), 2),
        tasks,
      },
    };
    d.scorecard = [
      latencyRow('chat_start', OBJ.chat_pct + '% of chat answers start within ' + sec(OBJ.chat_start_ms), chatR.map((r) => r.client.ttft_ms), OBJ.chat_pct, OBJ.chat_start_ms),
      shareRow('chat_quality', 'At least ' + OBJ.chat_quality_min * 100 + '% of chat answers contain the fact from the context', chatR.map((r) => r.tags.ok), OBJ.chat_quality_min),
      latencyRow('completion_total', OBJ.completion_pct + '% of completions arrive whole within ' + OBJ.completion_total_ms + ' ms', compR.map((r) => r.client.total_ms), OBJ.completion_pct, OBJ.completion_total_ms),
      latencyRow('agent_task', OBJ.agent_pct + '% of agent tasks finish within ' + sec(OBJ.agent_task_ms) + ', tool waits included', tasks.map((t) => t.total_ms), OBJ.agent_pct, OBJ.agent_task_ms),
      shareRow('agent_valid', 'At least ' + OBJ.agent_valid_min * 100 + '% of agent tasks have every tool call valid', tasks.map((t) => t.valid), OBJ.agent_valid_min),
    ];
    return d;
  }

  function deriveLoad(result) {
    const levels = (result.levels || []).map((lv) => {
      const rs = result.records.filter((r) => r.tags.users === lv.users);
      const ttft = rs.map((r) => r.client.ttft_ms), total = rs.map((r) => r.client.total_ms);
      const tokens = rs.reduce((s, r) => s + (r.server.output_tokens || 0), 0);
      return {
        users: lv.users, n: rs.length, wall_ms: lv.wall_ms,
        ttft_p50: round(med(ttft)), ttft_p95: round(pct(ttft, 95)), ttft_max: round(Math.max(...ttft)),
        total_p50: round(med(total)), total_p95: round(pct(total, 95)),
        // The server's own prefill time is inference-only; the client's first-token time is end-to-end. The gap is waiting.
        prefill_p50: round(med(rs.map((r) => r.server.prefill_ms))),
        wait_p50: round(med(rs.map((r) => Math.max(0, r.client.ttft_ms - (r.server.prefill_ms || 0))))),
        within: share(ttft.map((x) => x <= OBJ.chat_start_ms)),
        quality: share(rs.map((r) => r.tags.ok)),
        user_tps: round(med(rs.map((r) => (r.server.output_tokens && r.client.total_ms > r.client.ttft_ms ? (r.server.output_tokens / (r.client.total_ms - r.client.ttft_ms)) * 1000 : null)))),
        total_tps: lv.wall_ms ? round((tokens / lv.wall_ms) * 1000) : null,
        answers_per_min: lv.wall_ms ? round((rs.length / lv.wall_ms) * 60000) : null,
        row: latencyRow('chat_start_' + lv.users, OBJ.chat_pct + '% of chat answers start within ' + sec(OBJ.chat_start_ms) + ' with ' + lv.users + (lv.users === 1 ? ' user' : ' users at once'), ttft, OBJ.chat_pct, OBJ.chat_start_ms),
      };
    });
    const at = (u) => levels.find((l) => l.users === u);
    const one = at(1), top = at(OBJ.load_users);
    const d = { levels, one, top, slowdown_total: one && top ? round(top.total_p50 / one.total_p50, 1) : null, ttft_growth: one && top ? round(top.ttft_p95 / one.ttft_max, 1) : null };
    d.scorecard = levels.map((l) => l.row);
    if (top) d.scorecard.push(shareRow('chat_quality_load', 'At least ' + OBJ.chat_quality_min * 100 + '% of answers contain the fact, at ' + OBJ.load_users + ' users', result.records.filter((r) => r.tags.users === OBJ.load_users).map((r) => r.tags.ok), OBJ.chat_quality_min));
    d.promise_met = top ? top.row.status === 'met' : null;
    return d;
  }

  function deriveMixed(result) {
    const phase = (name) => (result.phases || []).find((p) => p.phase === name);
    const docs = (name) => result.records.filter((r) => r.tags.phase === name && r.tags.workload === 'batch');
    const chats = (name) => result.records.filter((r) => r.tags.phase === name && r.tags.workload === 'chat');
    const job = (name, label) => {
      const ph = phase(name), ds = docs(name);
      if (!ph || !ds.length) return null;
      const okN = ds.filter((r) => r.tags.ok).length;
      const cost = okN ? ((ph.wall_ms / 1000) * OBJ.machine_rate_per_hour / 3600 / okN) * 1000 : null;
      return {
        phase: name, label, n: ds.length, wall_ms: ph.wall_ms, ok: okN, valid: okN / ds.length,
        notices_per_min: round((ds.length / ph.wall_ms) * 60000), per_notice_p50: round(med(ds.map((r) => r.client.total_ms))),
        cost_per_1000: cost == null ? null : round(cost, 3),
        timeline: ds.map((r) => ({ start_ms: r.client.offset_ms, end_ms: round(r.client.offset_ms + r.client.total_ms) })),
      };
    };
    const jobs = [job('batch-1', 'Batch alone, 1 at a time'), job('batch-4', 'Batch alone, 4 in parallel'), job('shared', 'Batch, 4 in parallel, sharing with a chat user')].filter(Boolean);
    const chatStat = (name) => {
      const rs = chats(name);
      if (!rs.length) return null;
      const t = rs.map((r) => r.client.ttft_ms);
      return { phase: name, n: rs.length, ttft_p50: round(med(t)), ttft_max: round(Math.max(...t)), total_p50: round(med(rs.map((r) => r.client.total_ms))), quality: share(rs.map((r) => r.tags.ok)) };
    };
    const alone = chatStat('chat-alone'), shared = chatStat('shared');
    const b4 = jobs.find((j) => j.phase === 'batch-4'), b1 = jobs.find((j) => j.phase === 'batch-1'), sh = jobs.find((j) => j.phase === 'shared');
    const jobRow = (id, j, what) => (j ? { id, promise: 'All ' + BATCH_SIZE + ' notices processed within ' + sec(OBJ.batch_deadline_ms) + ' (' + what + ')', kind: 'deadline', n: j.n, value: j.wall_ms, limit: OBJ.batch_deadline_ms, measured_as: 'one job', status: j.wall_ms <= OBJ.batch_deadline_ms ? 'met' : 'missed' } : null);
    const d = { jobs, chat_alone: alone, chat_shared: shared, speedup: b1 && b4 ? round(b1.wall_ms / b4.wall_ms, 2) : null };
    d.scorecard = [
      jobRow('batch_deadline_1', b1, '1 at a time'),
      jobRow('batch_deadline_4', b4, '4 in parallel'),
      b4 ? shareRow('batch_valid', 'At least ' + OBJ.batch_valid_min * 100 + '% of notices extracted correctly', docs('batch-4').map((r) => r.tags.ok), OBJ.batch_valid_min) : null,
      b4 && b4.cost_per_1000 != null ? { id: 'batch_cost', promise: 'At most $' + OBJ.batch_cost_per_1000.toFixed(2) + ' per 1,000 correct notices at a hypothetical $' + OBJ.machine_rate_per_hour.toFixed(2) + ' per machine-hour', kind: 'cost', n: b4.ok, value: b4.cost_per_1000, limit: OBJ.batch_cost_per_1000, measured_as: b4.ok + ' correct notices', status: b4.cost_per_1000 <= OBJ.batch_cost_per_1000 ? 'met' : 'missed' } : null,
      alone ? latencyRow('chat_alone', 'Chat answers start within ' + sec(OBJ.chat_start_ms) + ' with the server to itself', chats('chat-alone').map((r) => r.client.ttft_ms), OBJ.chat_pct, OBJ.chat_start_ms) : null,
      shared ? latencyRow('chat_shared', 'Chat answers start within ' + sec(OBJ.chat_start_ms) + ' while the batch runs', chats('shared').map((r) => r.client.ttft_ms), OBJ.chat_pct, OBJ.chat_start_ms) : null,
      sh ? jobRow('batch_deadline_shared', sh, 'while sharing with chat') : null,
    ].filter(Boolean);
    return d;
  }

  Object.assign(Core, {
    OBJ, CHAT_ITEMS, COMPLETION_ITEMS, AGENT_TASKS, AGENT_TOOLS, TOOL_WAIT_MS, BATCH_SIZE, notice, pct, need,
    experiments: { done: runDone, load: runLoad, mixed: runMixed },
    derive: { done: deriveDone, load: deriveLoad, mixed: deriveMixed },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof globalThis !== 'undefined' ? globalThis : this);
