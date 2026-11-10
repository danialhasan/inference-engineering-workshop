/* Lab UI. Workloads, indicators and scorecards live in workloads.js; this file asks, runs, draws and explains. */
(function () {
  'use strict';

  const Core = window.LabCore;
  const { bars, lines, fmtMs, COLORS } = window.Charts;
  const PROFILES = window.RECORDED_PROFILES || [];
  const KEY = 'workload-lab.v1';

  /* ---------- tiny DOM helper ---------- */
  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return n;
  }
  // Inline `code` spans inside otherwise plain strings.
  function rich(text) {
    return String(text).split(/(`[^`]+`)/).map((part) =>
      part.startsWith('`') && part.endsWith('`') ? h('code', { text: part.slice(1, -1) }) : part
    );
  }
  const p = (text, cls) => h('p', { class: cls }, rich(text));
  const num = (x, d = 0) => (x == null || !isFinite(x) ? '–' : Number(x).toLocaleString('en-CA', { maximumFractionDigits: d, minimumFractionDigits: d }));
  const times = (x) => (x == null ? '–' : num(x, x < 10 ? 1 : 0) + '×');
  const when = (iso) => new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

  /* ---------- state ---------- */
  const params = new URLSearchParams(location.search);
  const state = Object.assign(
    { mode: null, base: Core.DEFAULT_BASE, model: Core.DEFAULT_MODEL, pred: {}, live: {}, revealed: {}, profile: {}, sheet: {}, runs: {}, settings: {}, observed: {}, sel: {}, baseline: {}, recRun: {}, n: Core.SAMPLE.standard, cpu: false },
    (() => {
      try {
        return JSON.parse(localStorage.getItem(KEY) || '{}');
      } catch (_) {
        return {};
      }
    })()
  );
  if (params.get('base')) state.base = params.get('base');
  if (params.get('model')) state.model = params.get('model');
  if (params.get('mode') === 'live' || params.get('mode') === 'recorded') state.mode = params.get('mode');
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {
      /* private mode or full storage: the lab still works for this page view */
    }
  }
  // Quick runs saved by the earlier version of this lab used small samples and a different format.
  // They are kept for export but no longer shown as results.
  if (state.live && Object.keys(state.live).length) { state.legacyLive = Object.assign({}, state.legacyLive, state.live); state.live = {}; }
  const ui = { tab: 'setup', running: null, errors: {}, setup: null, owned: [], api: null };
  const cfg = () => ({ base: state.base, model: state.model });
  const IS_FILE = location.protocol === 'file:';

  const profilesFor = (exp) => PROFILES.filter((pr) => pr.runs && pr.runs[exp] && pr.runs[exp].length);
  function chosenProfile(exp) {
    const list = profilesFor(exp);
    return list.find((pr) => pr.id === state.profile[exp]) || list[0] || null;
  }
  const reference = PROFILES[0];
  const refShort = reference ? reference.hardware.chip + ', ' + reference.hardware.ram_gb + ' GB' : 'the presenter laptop';

  /* ---------- shared pieces ---------- */
  const OBJ = Core.OBJ;
  const pctTxt = (x) => (x == null ? '–' : Math.round(x * 100) + '%');
  const money = (x) => (x == null ? '–' : '$' + Number(x).toFixed(2));
  function table(head, rows, cls) {
    return h('div', { class: 'table-wrap' },
      h('table', { class: 'data' + (cls ? ' ' + cls : '') },
        h('thead', null, h('tr', null, head.map((c) => h('th', null, c)))),
        h('tbody', null, rows.map((r) => h('tr', null, r.map((c) => h('td', null, c == null ? '–' : c)))))
      ));
  }
  function facts(items) {
    return h('div', { class: 'facts' }, items.filter(Boolean).map(([v, k]) => h('div', { class: 'fact' }, h('div', { class: 'v', text: v }), h('div', { class: 'k', text: k }))));
  }
  const valText = (r) => (r.value == null ? '' : r.kind === 'share' ? pctTxt(r.value) : r.kind === 'cost' ? money(r.value) : fmtMs(r.value));
  function measuredText(r) {
    if (r.status === 'too-few') return 'not enough samples (' + r.measured_as + ')';
    return valText(r) + (r.kind === 'cost' ? ' per 1,000' : '') + ' (' + r.measured_as + ')';
  }
  function targetText(r) {
    if (r.kind === 'share') return 'at least ' + pctTxt(r.limit);
    if (r.kind === 'cost') return 'at most ' + money(r.limit);
    return 'within ' + fmtMs(r.limit);
  }
  function badge(r) {
    if (!r) return h('span', { class: 'badge none', text: '–' });
    if (r.status === 'too-few') return h('span', { class: 'badge none', text: 'NO VERDICT' });
    return h('span', { class: 'badge ' + r.status, text: r.status === 'met' ? '✓ MET' : '✕ MISSED' });
  }
  function scorecard(rows) {
    return h('div', { class: 'scorecard' }, table(['Promise (hypothetical)', 'Measured', 'Target', 'Verdict'], rows.map((r) => [r.promise, measuredText(r), targetText(r), badge(r)])));
  }

  /* ---------- systems: recorded references and this laptop ---------- */
  const LETTER = { 'sys-a': 'A', 'sys-b': 'B', 'sys-c': 'C' };
  const sysLetter = (pr) => LETTER[pr.id] || pr.id;
  const sysName = (pr) => sysLetter(pr) + ' · ' + pr.name; // e.g. "A · GPU · 1 serving slot"
  const SYS = (id) => PROFILES.find((pr) => pr.id === id);
  // The three reference setups are fixed definitions, so they can be named even when a recording is missing.
  const SYSDEF = { 'sys-a': 'GPU · 1 serving slot', 'sys-b': 'GPU · 4 serving slots', 'sys-c': 'CPU · 1 serving slot' };
  const sysShort = (id) => (LETTER[id] || id) + ' · ' + (SYS(id) ? SYS(id).name : SYSDEF[id] || '');
  const MODEL_LINE = 'Qwen2.5 1.5B (4-bit)';
  function slotsText(o) { return o && o.slots_observed != null ? o.slots_observed + (o.slots_observed >= o.probe_count ? '+' : '') + ' at once' : 'not observed'; }
  function effectiveText(o) {
    if (!o) return 'not observed';
    return o.processor + ' · serving ' + slotsText(o);
  }
  function settingsText(id, s) {
    if (id === 'done') return (s.prompt === 'explicit' ? 'step-by-step prompt' : 'baseline prompt') + (s.validate ? ' · calendar check on' : '');
    if (id === 'load') return s.users + (s.users === 1 ? ' user' : ' users at once');
    return s.workers + (s.workers === 1 ? ' client worker' : ' client workers') + (s.share ? ' · chat user sharing' : ' · batch alone') + (s.json ? ' · JSON mode' : '');
  }
  // The recorded run of each system that a lab's promise is judged on.
  const REF_SETTINGS = { done: () => true, load: (s) => s.users === OBJ.load_users, mixed: (s) => s.workers === 4 && s.share };
  const refRun = (pr, id, pick) => (pr && pr.runs && pr.runs[id] ? pr.runs[id].find((r) => (pick || REF_SETTINGS[id])(r.settings)) : null);
  const D = (sysId, id, pick) => { const r = refRun(SYS(sysId), id, pick); return r ? Core.derive[id](r.result) : null; };
  const rowOf = (d, rid) => (d ? d.scorecard.find((r) => r.id === rid) : null);
  const met = (sysId, id, rid) => { const r = rowOf(D(sysId, id), rid); return r && r.status !== 'too-few' ? r.status === 'met' : null; };
  function which(a, b) { if (a == null || b == null) return null; return a && b ? 'both' : a ? 'first' : b ? 'second' : 'neither'; }
  const bucket = (x, cuts, values) => { if (x == null) return null; for (let i = 0; i < cuts.length; i++) if (x < cuts[i]) return values[i]; return values[values.length - 1]; };
  const REASON_KEY = (r) => (!r ? null : /any tool/.test(r) ? 'none' : /without calling the tool that books/.test(r) ? 'claims' : /invalid|rejected/.test(r) ? 'invalid' : /steps/.test(r) ? 'steps' : 'other');

  const S = {
    p95: { key: 'p95', label: 'p95 wait for the first words', color: COLORS.orange },
    job: { key: 'job', label: 'Batch wall-clock', color: COLORS.blue },
    model: { key: 'model', label: 'Model calls', color: COLORS.orange },
    tools: { key: 'tools', label: 'Local tools', color: COLORS.aqua },
  };

  /* ---------- result renderers (one run) ---------- */
  const RENDER = {
    done(el, d) {
      el.appendChild(facts([
        [fmtMs(d.chat.ttft_p50), 'chat: typical wait for the first words'],
        [fmtMs(d.completion.total_p50), 'completion: typical wait for the whole suggestion'],
        [fmtMs(d.agent.task_p50), 'agent: typical time for the whole task'],
        [d.agent.booked + ' of ' + d.agent.n, 'agent tasks ended with the right meeting in the calendar'],
      ]));
      el.appendChild(scorecard(d.scorecard));
      if (d.agent.reasons.length) el.appendChild(table(['Why agent tasks failed', 'Tasks'], d.agent.reasons.map(([why, k]) => [why, String(k)])));
      el.appendChild(h('h3', { text: 'What the agent really did (first tasks)' }));
      el.appendChild(table(['Request', 'Tool calls the model made', 'Calendar afterwards', 'Outcome'], d.agent.examples.map((t) => [
        t.request.mins + ' min ' + t.request.topic + ' with ' + t.request.who,
        t.calls.length ? t.calls.map((c) => (c.name || 'unusable reply') + (c.ok ? ' ✓' + (c.result && c.result.slots ? ' [' + c.result.slots.join(', ') + ']' : '') : ' ✕ ' + (c.error || ''))).join(' → ') : 'none',
        t.created.length ? t.created.map((e) => e.start + ', ' + e.duration_minutes + ' min, ' + e.attendees.filter((a) => a !== 'me').join(', ')).join('; ') : 'no new event',
        t.outcome ? h('span', { class: 'badge met', text: '✓ BOOKED' }) : h('span', null, h('span', { class: 'badge missed', text: '✕ NOT BOOKED' }), h('span', { class: 'cellnote', text: ' ' + t.reason })),
      ]), 'trace'));
      const ex = d.agent.examples[0];
      if (ex && ex.transcript) el.appendChild(h('details', { class: 'transcript' }, h('summary', { text: 'Full transcript of the first task: what the model saw and said' }),
        h('div', { class: 'inner' }, ex.transcript.map((m) => h('pre', null, h('b', { text: (m.role === 'assistant' ? 'model' : m.content.startsWith('Tool ') ? 'tool result' : m.content.startsWith('Check failed') ? 'application check' : 'user') + ': ' }), m.content)))));
      el.appendChild(p('The tools are real functions on a calendar owned by this lab. A tool runs only when the model sends a valid call, the model sees its real result, and the outcome is read from the calendar: one new event with the requested title, person and length, in the first free slot from a matching lookup. Typical tool time here: ' + (d.agent.tool_ms_p50 < 1 ? 'under 1 ms' : fmtMs(d.agent.tool_ms_p50)) + ' per task, because the tools are local; ' + pctTxt(d.agent.model_share) + ' of task time was the model. Each task used ' + d.agent.steps_p50 + ' model calls (median) of at most ' + Core.MAX_AGENT_STEPS + '.', 'note'));
    },
    load(el, d) {
      el.appendChild(facts([
        [fmtMs(d.ttft_p50), 'typical wait for the first words'],
        [fmtMs(d.ttft_p95), 'p95 wait for the first words'],
        [pctTxt(d.within), 'of answers started within ' + fmtMs(OBJ.chat_start_ms)],
        [num(d.user_tps, 0) + ' tok/s', 'speed each user sees while reading'],
      ]));
      el.appendChild(scorecard(d.scorecard));
      el.appendChild(table(['Users at once', 'Answers', 'First words p50', 'p95', 'Worst', 'Outside prompt reading (p50)', 'Whole answer p50', 'Speed per user', 'Server output', 'Answers per minute'],
        [[String(d.users), String(d.n), fmtMs(d.ttft_p50), fmtMs(d.ttft_p95), fmtMs(d.ttft_max), fmtMs(d.outside_prefill_p50), fmtMs(d.total_p50), num(d.user_tps, 0) + ' tok/s', num(d.total_tps, 0) + ' tok/s', num(d.answers_per_min, 0)]]));
      el.appendChild(p('"Outside prompt reading" is the wait for the first words minus the server\'s own time reading the prompt (' + fmtMs(d.prefill_p50) + ' here). When the server is busy it is mostly time in line; it also contains transport and the first token, so read it as an upper bound on queueing.', 'note'));
    },
    mixed(el, d) {
      el.appendChild(facts([
        [fmtMs(d.wall_ms), 'to finish ' + d.n + ' notices with ' + d.workers + (d.workers === 1 ? ' client worker' : ' client workers')],
        [d.ok + ' of ' + d.n, 'notices with every field correct'],
        [money(d.cost_per_1000), 'per 1,000 correct notices (hypothetical price)'],
        d.chat_shared && d.chat_alone && [fmtMs(d.chat_alone.ttft_p95) + ' → ' + fmtMs(d.chat_shared.ttft_p95), 'chat p95 wait for first words, alone → during the batch'],
      ]));
      el.appendChild(scorecard(d.scorecard));
      el.appendChild(table(['Notices', 'Client workers', 'Wall-clock', 'Notices per minute', 'Time per notice (p50)', 'All fields correct', 'Cost per 1,000 correct'],
        [[String(d.n), String(d.workers), fmtMs(d.wall_ms), num(d.notices_per_min, 0), fmtMs(d.per_notice_p50), d.ok + ' of ' + d.n, money(d.cost_per_1000)]]));
      const cs = [d.chat_alone && ['Chat user alone, before the batch', d.chat_alone], d.chat_shared && ['Chat user while the batch runs', d.chat_shared]].filter(Boolean);
      if (cs.length) el.appendChild(table(['Chat user', 'Questions', 'First words p50', 'p95', 'Worst'], cs.map(([name, c]) => [name, String(c.n), fmtMs(c.ttft_p50), c.n >= 20 ? fmtMs(c.ttft_p95) : 'needs 20', fmtMs(c.ttft_max)])));
      el.appendChild(p('A notice counts only if reference, agency and closing date all match. Cost = batch seconds × ' + money(OBJ.machine_rate_per_hour) + ' per machine-hour ÷ correct notices.', 'note'));
    },
  };

  /* ---------- lab definitions ---------- */
  const LABS = {
    done: {
      tab: 'Lab 1 · Done?', title: 'Lab 1 · What counts as done?', clock: '10 minutes',
      chain: [
        ['The work', 'Three products share one model server: a support chat that answers from company documents, an editor that completes the line you are typing, and an agent that books a meeting in a calendar.'],
        ['What makes it useful', 'Chat: the first words appear quickly. Completion: the whole suggestion, before you type on. Agent: the right meeting really exists in the calendar afterwards.'],
        ['Demand', 'One user at a time.'],
        ['Promises (hypothetical)', OBJ.chat_pct + '% of chat answers start within ' + fmtMs(OBJ.chat_start_ms) + '. ' + OBJ.completion_pct + '% of completions arrive whole within ' + fmtMs(OBJ.completion_total_ms) + '. ' + OBJ.agent_pct + '% of agent tasks finish within ' + fmtMs(OBJ.agent_task_ms) + ', and at least ' + pctTxt(OBJ.agent_outcome_min) + ' end with the right meeting booked.'],
      ],
      questions: () => [
        { id: 'booked', q: 'On ' + sysShort('sys-a') + ', with the baseline prompt, how many agent tasks end with the right meeting in the calendar?', options: [['most', '90% or more: the promise is kept'], ['some', 'somewhere in between'], ['few', 'under a quarter']] },
        { id: 'why', q: 'When the agent fails on that system, what does it most often do?', options: [['none', 'never calls a tool'], ['claims', 'checks free slots, then says it is booked without booking'], ['invalid', 'sends booking calls that are rejected as invalid'], ['steps', 'runs out of steps']] },
        { id: 'completion', q: 'Which systems keep the completion promise (whole suggestion within ' + fmtMs(OBJ.completion_total_ms) + ')?', options: [['first', sysShort('sys-a') + ' only'], ['both', 'both ' + sysShort('sys-a') + ' and ' + sysShort('sys-c')], ['second', sysShort('sys-c') + ' only'], ['neither', 'neither']] },
      ],
      measured() {
        const a = D('sys-a', 'done');
        if (!a) return {};
        const v = a.agent.booked / Math.max(1, a.agent.n);
        return { booked: v >= 0.9 ? 'most' : v < 0.25 ? 'few' : 'some', why: REASON_KEY(a.agent.top_reason), completion: which(met('sys-a', 'done', 'completion_total'), met('sys-c', 'done', 'completion_total')) };
      },
      matrix: ['chat_start', 'chat_quality', 'completion_total', 'completion_quality', 'agent_task', 'agent_outcome'],
      levers: [
        { key: 'prompt', kind: 'application', label: 'Agent prompt', options: [['baseline', 'baseline'], ['explicit', 'step-by-step, with a rule against claiming success']] },
        { key: 'validate', kind: 'application', label: 'Check the calendar before accepting "done"', options: [[false, 'off'], [true, 'on: ask once more if no event exists']] },
      ],
      discuss: [
        'What does "done" mean to the person waiting in each of the three workloads, and which row measures it?',
        'The agent can be fast and still not book the meeting. Which lever is that: serving or application? Change it and rerun.',
        'Would a faster model server have fixed the agent? What did the time split between model and tools tell you?',
      ],
      reading() {
        const a = D('sys-a', 'done'), c = D('sys-c', 'done'), out = [];
        if (!a) return out;
        out.push('Three workloads, three measurements: first words for chat (' + fmtMs(a.chat.ttft_p50) + ' typical on ' + sysShort('sys-a') + '), the whole suggestion for completion (' + fmtMs(a.completion.total_p50) + '), the whole task and its result for the agent (' + fmtMs(a.agent.task_p50) + ').');
        out.push('With the baseline prompt, ' + a.agent.booked + ' of ' + a.agent.n + ' agent tasks ended with the right meeting in the calendar.' + (a.agent.top_reason ? ' The usual failure: the agent ' + a.agent.top_reason + '.' : '') + ' The time promise and the outcome promise are separate, and only the calendar can tell you about the second.');
        out.push('That is an application problem. No serving change on this page fixes it. The prompt and the calendar check are the levers; try them and compare with your baseline.');
        if (c) { const ca = rowOf(a, 'completion_total'), cc = rowOf(c, 'completion_total'); out.push('Completion is the tight speed promise: ' + valText(ca) + ' at p95 on ' + sysShort('sys-a') + ' and ' + valText(cc) + ' on ' + sysShort('sys-c') + ', against ' + fmtMs(OBJ.completion_total_ms) + '. That one is a serving matter: same model, different processor.'); }
        return out;
      },
    },
    load: {
      tab: 'Lab 2 · Load', title: 'Lab 2 · Does the promise hold under load?', clock: '10 minutes',
      chain: [
        ['The work', 'The support chat from Lab 1. Each question brings its own document.'],
        ['What makes it useful', 'The first words appear quickly for nearly everyone, and the answer contains the fact from the document.'],
        ['Demand', 'Several users asking at once, each pausing 0 to ' + OBJ.think_ms + ' ms between questions. The promise is stated at ' + OBJ.load_users + ' users.'],
        ['Promise (hypothetical)', OBJ.chat_pct + '% of answers start within ' + fmtMs(OBJ.chat_start_ms) + ', measured here in the browser, with ' + OBJ.load_users + ' users asking at once. At least ' + pctTxt(OBJ.chat_quality_min) + ' of answers contain the fact.'],
      ],
      questions: () => [
        { id: 'fit', q: 'With ' + OBJ.load_users + ' users asking at once, which systems keep the chat promise?', options: [['first', sysShort('sys-a') + ' only'], ['second', sysShort('sys-b') + ' only'], ['both', 'both'], ['neither', 'neither']] },
        { id: 'slow', q: 'On ' + sysShort('sys-b') + ' with ' + OBJ.load_users + ' users, a complete answer takes how long compared with one user alone?', options: [['same', 'about the same (under 1.3×)'], ['some', '1.3–3× as long'], ['much', 'more than 3× as long']] },
      ],
      measured() {
        const b4 = D('sys-b', 'load'), b1 = D('sys-b', 'load', (s) => s.users === 1);
        return { fit: which(met('sys-a', 'load', 'chat_start'), met('sys-b', 'load', 'chat_start')), slow: b4 && b1 ? bucket(b4.total_p50 / b1.total_p50, [1.3, 3], ['same', 'some', 'much']) : null };
      },
      matrix: ['chat_start', 'chat_quality'],
      levers: [{ key: 'users', kind: 'demand', label: 'Users asking at once', options: [[1, '1'], [2, '2'], [4, '4 (the promise)'], [8, '8']] }],
      discuss: [
        'Run with 1 user, then with 4. What did the 1-user result tell you about 4?',
        'More serving slots start answers sooner and make each one slower to finish. For which workload from Lab 1 is that the wrong trade?',
        'Compare the number of users you asked for with the slots your server was observed to have. What happens to the rest?',
      ],
      reading() {
        const a = D('sys-a', 'load'), b = D('sys-b', 'load'), a1 = D('sys-a', 'load', (s) => s.users === 1), b1 = D('sys-b', 'load', (s) => s.users === 1), out = [];
        if (!a || !b || !a1 || !b1) return out;
        out.push('Alone, both GPU systems start an answer in about ' + fmtMs(a1.ttft_p50) + '. With ' + OBJ.load_users + ' users the p95 wait was ' + fmtMs(a.ttft_p95) + ' on ' + sysShort('sys-a') + ' and ' + fmtMs(b.ttft_p95) + ' on ' + sysShort('sys-b') + ', against ' + fmtMs(OBJ.chat_start_ms) + '.');
        out.push('On one slot the model did not get slower. Its prompt-reading time stayed near ' + fmtMs(a.prefill_p50) + ' while the wait outside it grew to ' + fmtMs(a.outside_prefill_p50) + ' (typical): requests stood in line.');
        out.push('Four slots removed the line and shared the processor. Each user\'s text arrived at ' + num(b.user_tps, 0) + ' tokens per second instead of ' + num(b1.user_tps, 0) + ', and a whole answer took ' + times(b.total_p50 / b1.total_p50) + ' as long, while the server produced ' + num(b1.total_tps, 0) + ' → ' + num(b.total_tps, 0) + ' tokens per second overall.');
        out.push('For chat, judged on the first words, more slots fit this demand. For a completion or a tool call, judged on the whole output, the same change makes every result later.');
        return out;
      },
    },
    mixed: {
      tab: 'Lab 3 · Share?', title: 'Lab 3 · Two workloads, one server?', clock: '9 minutes',
      chain: [
        ['The work', 'Pull reference, agency and closing date out of a batch of tender notices. A proposed model use for a contract scraper; the notices are fictional.'],
        ['What makes it useful', 'The whole batch is done by the deadline, every field is right, and the cost per correct notice is in budget. Nobody watches single requests.'],
        ['Demand', 'A batch of notices sent by a number of client workers you choose, with or without a chat user asking questions on the same server.'],
        ['Promises (hypothetical)', '100 notices within ' + fmtMs(OBJ.batch_deadline_ms_per_100) + '. At least ' + pctTxt(OBJ.batch_valid_min) + ' fully correct. At most ' + money(OBJ.batch_cost_per_1000) + ' per 1,000 correct notices at ' + money(OBJ.machine_rate_per_hour) + ' per machine-hour. The chat promise from Lab 2 still holds for the chat user.'],
      ],
      questions: () => [
        { id: 'deadline', q: 'With 4 client workers and a chat user sharing, which systems finish the batch by the deadline?', options: [['first', sysShort('sys-a') + ' only'], ['second', sysShort('sys-b') + ' only'], ['both', 'both'], ['neither', 'neither']] },
        { id: 'share', q: 'On ' + sysShort('sys-b') + ', does the chat promise survive while the batch runs?', options: [['yes', 'yes: 95% of answers still start within ' + fmtMs(OBJ.chat_start_ms)], ['no', 'no']] },
      ],
      measured() {
        const s = met('sys-b', 'mixed', 'chat_shared');
        return { deadline: which(met('sys-a', 'mixed', 'batch_deadline'), met('sys-b', 'mixed', 'batch_deadline')), share: s == null ? null : s ? 'yes' : 'no' };
      },
      matrix: ['batch_deadline', 'batch_valid', 'batch_cost', 'chat_shared'],
      levers: [
        { key: 'workers', kind: 'application', label: 'Client workers sending notices', options: [[1, '1'], [2, '2'], [4, '4'], [8, '8']] },
        { key: 'share', kind: 'demand', label: 'A chat user on the same server', options: [[true, 'yes'], [false, 'no, batch alone']] },
        { key: 'json', kind: 'application', label: 'Ask the server for JSON-only output', options: [[false, 'off'], [true, 'on']] },
      ],
      discuss: [
        'Client workers are your setting. Serving slots are the server\'s. What happened when you had more workers than slots?',
        'Wrong notices are paid for and deliver nothing. Which lever changed how many were right?',
        'Would you give the batch and the chat user one server or two? What volumes and prices would decide it?',
      ],
      reading() {
        const a = D('sys-a', 'mixed'), b = D('sys-b', 'mixed'), a1 = D('sys-a', 'mixed', (s) => s.workers === 1), b1 = D('sys-b', 'mixed', (s) => s.workers === 1), out = [];
        if (!a || !b || !a1 || !b1) return out;
        out.push('One client worker took ' + fmtMs(a1.wall_ms) + ' on ' + sysShort('sys-a') + ' and ' + fmtMs(b1.wall_ms) + ' on ' + sysShort('sys-b') + '. Four workers (with a chat user sharing) took ' + fmtMs(a.wall_ms) + ' and ' + fmtMs(b.wall_ms) + '. Extra workers only help when the server has slots for them.');
        out.push(b.ok + ' of ' + b.n + ' notices had every field right. At the hypothetical price that made ' + money(b.cost_per_1000) + ' per 1,000 correct notices on ' + sysShort('sys-b') + ' and ' + money(a.cost_per_1000) + ' on ' + sysShort('sys-a') + '. Cost per useful result moves with throughput and with quality.');
        if (a.chat_shared && b.chat_shared && a.chat_alone && b.chat_alone) out.push('The chat user paid for sharing: p95 wait for first words went from ' + fmtMs(a.chat_alone.ttft_p95) + ' to ' + fmtMs(a.chat_shared.ttft_p95) + ' on ' + sysShort('sys-a') + ' (' + a.chat_shared.n + ' questions) and from ' + fmtMs(b.chat_alone.ttft_p95) + ' to ' + fmtMs(b.chat_shared.ttft_p95) + ' on ' + sysShort('sys-b') + ' (' + b.chat_shared.n + ').');
        out.push('A waiting user and a batch want opposite things from one server. Separate deployments, an off-peak batch, or a cap on batch workers are the usual answers; volumes and prices decide between them.');
        return out;
      },
    },
  };
  const TAB_ORDER = ['setup', 'done', 'load', 'mixed', 'clinic'];
  const runsOf = (id) => (state.runs[id] = state.runs[id] || []);
  const hasResult = (id) => runsOf(id).length > 0 || !!state.revealed[id];

  /* ---------- header ---------- */
  function renderChrome() {
    const b = document.getElementById('mode-banner');
    b.className = 'banner ' + (state.mode || 'none');
    b.replaceChildren();
    if (state.mode === 'live') {
      b.append(h('strong', { text: '● LIVE' }), 'Runs happen on this laptop against ' + (state.endpoint || state.base) + ' with ' + state.model + '.');
    } else if (state.mode === 'recorded') {
      b.append(h('strong', { text: '▣ RECORDED' }), 'You are inspecting runs captured on ' + (reference ? when(reference.captured_at) : 'an earlier date') + ' on another machine (' + refShort + '). Nothing shown here was measured on this laptop.');
    } else {
      b.append('No path chosen yet. Run the setup check, or pick recorded data, on the Setup tab.');
    }
    const tabs = document.getElementById('tabs');
    tabs.replaceChildren(...TAB_ORDER.map((id) => {
      const label = id === 'setup' ? 'Setup' : id === 'clinic' ? 'Your promise' : LABS[id].tab;
      const done = LABS[id] && hasResult(id);
      return h('button', { 'aria-current': ui.tab === id ? 'page' : null, disabled: !!ui.running && ui.tab !== id, onclick: () => go(id) }, label, done ? h('span', { class: 'done-mark', title: 'result available', text: '✓' }) : null);
    }));
  }
  function go(id) {
    if (ui.running) return;
    ui.tab = id;
    history.replaceState(null, '', '#' + id);
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- setup ---------- */
  const START_HINT = IS_FILE
    ? 'This page was opened as a file. Browsers give file pages no origin that Ollama accepts, so live runs are blocked here (the server answers HTTP 403). Start the kit\'s local page server instead: macOS double-click `start.command`; Linux run `./start.sh`; Windows double-click `start.bat`. Then open the address it prints. Recorded data works from this file as it is.'
    : null;

  async function runSetupCheck() {
    const checks = [
      { id: 'origin', title: 'This page is served from a loopback http address', status: 'pending' },
      { id: 'server', title: 'The Ollama server answers at ' + state.base, status: 'pending' },
      { id: 'model', title: 'The model ' + state.model + ' is installed', status: 'pending' },
      { id: 'gen', title: 'A short generation completes', status: 'pending' },
    ];
    ui.setup = { checks, done: false, ok: false };
    const set = (id, status, detail) => { Object.assign(checks.find((c) => c.id === id), { status, detail }); render(); };
    const skipRest = (from) => { let seen = false; for (const c of checks) { if (seen) c.status = 'skipped'; if (c.id === from) seen = true; } };
    const finish = (ok) => { ui.setup.done = true; ui.setup.ok = ok; if (ok) { state.mode = 'live'; save(); } render(); };
    render();

    if (IS_FILE) { set('origin', 'fail', START_HINT); skipRest('origin'); return finish(false); }
    const loop = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
    set('origin', loop ? 'ok' : 'warn', loop ? location.origin : 'Served from ' + location.origin + '. Ollama only accepts browser requests from loopback origins unless OLLAMA_ORIGINS says otherwise.');

    let version;
    try {
      version = await Core.getVersion(cfg());
      set('server', 'ok', 'Ollama ' + version);
    } catch (e) {
      set('server', 'fail', 'No answer. Start Ollama (open the app, or run `ollama serve` in a terminal) and try again. If you changed the port, correct the address above. ' + (e.detail ? '[' + e.detail + ']' : ''));
      skipRest('server'); return finish(false);
    }
    try {
      const models = await Core.listModels(cfg());
      if (!Core.hasModel(models, state.model)) {
        set('model', 'fail', 'Not installed. With internet access, run `ollama pull ' + state.model + '` (about 1 GB). This must happen before the event; the venue network will not manage it. Installed here: ' + (models.map((m) => m.name).join(', ') || 'no models') + '.');
        skipRest('model'); return finish(false);
      }
      const m = models.find((x) => x.name === state.model) || {};
      set('model', 'ok', (m.details && m.details.parameter_size ? m.details.parameter_size + ', ' + m.details.quantization_level + ', ' : '') + (m.size ? (m.size / 1e9).toFixed(2) + ' GB on disk' : ''));
    } catch (e) {
      set('model', 'fail', e.message + ' ' + (e.detail || '')); skipRest('model'); return finish(false);
    }
    try {
      const r = await Core.chat(cfg(), { messages: [{ role: 'user', content: 'Say "ready" and then count from one to ten in words.' }], options: { num_predict: 24 } });
      const tps = r.server.output_tokens && r.server.decode_ms ? (r.server.output_tokens / r.server.decode_ms) * 1000 : null;
      state.setupResult = { at: new Date().toISOString(), version, tps: Core.round(tps), load_ms: r.server.load_ms, total_ms: r.client.total_ms };
      set('gen', 'ok', num(r.server.output_tokens) + ' tokens in ' + fmtMs(r.client.total_ms) + (tps ? ' · ' + num(tps, 0) + ' tokens per second' : '') + (r.server.load_ms > 100 ? ' · model load took ' + fmtMs(r.server.load_ms) : '') + ' · measured on this laptop just now');
    } catch (e) {
      set('gen', 'fail', e.message + ' ' + (e.detail || '')); return finish(false);
    }
    finish(true);
  }

  function renderSetup(main) {
    main.append(h('div', { class: 'card' },
      h('h1', { text: 'Setup' }),
      p('Two ways through the hour. On the live path you play small slices of customer work against a small model on your own laptop and check them against a promise. On the recorded path you make the same predictions and inspect runs of three reference systems captured earlier on the presenter\'s laptop. Both paths work with Wi-Fi off.', 'lead')
    ));

    const s = ui.setup;
    const icon = { pending: '…', ok: '✓', fail: '✕', warn: '!', skipped: '–' };
    main.append(h('div', { class: 'card' },
      h('h2', null, h('span', { class: 'step-no', text: '1' }), 'Check this laptop'),
      IS_FILE ? h('div', { class: 'alert info' }, rich(START_HINT)) : null,
      h('div', { class: 'row' },
        h('label', { class: 'field' }, 'Ollama address', h('input', { type: 'text', id: 'f-base', value: state.base, spellcheck: 'false', onchange: (e) => { state.base = e.target.value.trim() || Core.DEFAULT_BASE; state.endpoint = state.base; save(); renderChrome(); } })),
        h('label', { class: 'field' }, 'Model', h('input', { type: 'text', id: 'f-model', value: state.model, spellcheck: 'false', onchange: (e) => { state.model = e.target.value.trim() || Core.DEFAULT_MODEL; save(); renderChrome(); } }))
      ),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', id: 'btn-check', disabled: s && !s.done, onclick: runSetupCheck }, s && !s.done ? 'Checking…' : 'Run setup check')
      ),
      s ? h('ul', { class: 'checks', id: 'checks' }, s.checks.map((c) => h('li', { class: c.status },
        h('span', { class: 'ico', text: icon[c.status] }), h('span', { text: c.title + (c.status === 'skipped' ? ' (not reached)' : '') }),
        c.detail ? h('span', { class: 'detail' }, rich(c.detail)) : null))) : null,
      s && s.done && s.ok ? h('div', { class: 'alert ok', id: 'setup-ok' }, h('h3', { text: 'Ready for the live path' }), p('Leave Ollama running. For a real pre-event test, switch Wi-Fi off and run this check once more.')) : null,
      s && s.done && !s.ok ? h('div', { class: 'alert error', id: 'setup-fail' }, h('h3', { text: 'The live path is not ready' }), p('Fix the failed item above and run the check again, or continue with recorded data. You lose nothing in the discussion by using the recording.'),
        h('button', { class: 'btn', onclick: () => { state.mode = 'recorded'; save(); render(); } }, 'Use recorded data')) : null
    ));

    const choose = (mode) => () => { state.mode = mode; save(); render(); };
    main.append(h('div', { class: 'card' },
      h('h2', null, h('span', { class: 'step-no', text: '2' }), 'Choose your path'),
      h('div', { class: 'grid-2' },
        h('div', { class: 'path-card' + (state.mode === 'live' ? ' chosen' : '') },
          h('h3', { text: '● Live on this laptop' }),
          p('Needs Ollama running with ' + state.model + ' already downloaded, and this page opened through the kit\'s start script. A standard run measures 100 requests per condition (40 agent tasks in Lab 1). Expect a few minutes; the time depends on your hardware.'),
          h('button', { class: 'btn', id: 'btn-live', onclick: choose('live') }, state.mode === 'live' ? 'Chosen' : 'Use live runs')),
        h('div', { class: 'path-card' + (state.mode === 'recorded' ? ' chosen' : '') },
          h('h3', { text: '▣ Recorded data' }),
          p(PROFILES.length ? 'Needs nothing but this page. The runs were captured on ' + when(reference.captured_at) + ' on the presenter\'s laptop (' + refShort + '). They are the same Qwen2.5 1.5B model in three serving setups (A, B, C), labelled RECORDED wherever they appear.' : 'No recorded data file was found next to this page.'),
          h('button', { class: 'btn', id: 'btn-recorded', disabled: !PROFILES.length, onclick: choose('recorded') }, state.mode === 'recorded' ? 'Chosen' : 'Use recorded data'))
      )
    ));

    main.append(h('div', { class: 'card' },
      h('h2', null, h('span', { class: 'step-no', text: '3' }), 'Then'),
      p('Open Lab 1 and wait for the presenter. Each lab starts from a piece of customer work and a promise, then asks you to predict which system fits, measure or inspect real records, and decide.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', id: 'btn-export', onclick: exportResults, disabled: !TAB_ORDER.some((x) => LABS[x] && runsOf(x).length) }, 'Download my runs (JSON)'),
        h('button', { class: 'btn', id: 'btn-reset', onclick: () => { if (confirm('Reset EVERYTHING in this lab: all three exercises, every run, and your worksheet?')) { localStorage.removeItem(KEY); location.reload(); } } }, 'Reset everything (all exercises and the worksheet)')
      ),
      recordedProvenance()
    ));
  }

  function recordedProvenance() {
    if (!PROFILES.length) return null;
    return h('details', null, h('summary', { text: 'Where the recorded data comes from' }),
      h('div', { class: 'inner' },
        table(['System', 'Recorded', 'Machine', 'OS', 'Ollama', 'Model digest', 'Samples per condition', 'Observed serving setup'],
          PROFILES.map((pr) => [sysName(pr), when(pr.captured_at), pr.hardware.chip + ' (' + pr.hardware.machine + '), ' + pr.hardware.ram_gb + ' GB, ' + pr.hardware.power, pr.hardware.os, pr.observed.ollama_version, pr.model.digest.slice(0, 12), String(pr.n), effectiveText(pr.observed)])),
        p('Each system is the unedited output of `tools/capture.mjs`, stored in `lab/data/recorded/`. All three are the same laptop and the same model, configured three ways. Treat the numbers as honest samples and not as a benchmark. See `lab/data/PROVENANCE.md`.', 'note')));
  }

  function exportResults() {
    const blob = new Blob([JSON.stringify({ kind: 'live', exported_at: new Date().toISOString(), base: state.base, model: state.model, setup: state.setupResult || null, predictions: state.pred, settings: state.settings, baselines: state.baseline, observed: state.observed, runs: state.runs, earlier_quick_runs: state.legacyLive || null, worksheet: state.sheet }, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'workload-lab-live-results.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- serving setup: what is requested, and what was observed ---------- */
  state.endpoint = state.endpoint || state.base;
  if (params.get('base')) state.endpoint = state.base;
  const endpoints = () => [...new Set([state.base].concat((window.LAB_ENDPOINTS || []).map((e) => e.base), ui.owned.map((o) => o.base), [state.endpoint]))].filter(Boolean);
  const runCfg = () => ({ base: state.endpoint, model: state.model, extraOptions: state.cpu ? { num_gpu: 0 } : {} });
  const obsKey = () => state.endpoint + (state.cpu ? '|cpu' : '');
  const settingsFor = (id) => Object.assign({}, Core.DEFAULTS[id], state.settings[id]);
  // ?n= is a developer override for quick interface tests. Small values produce no percentile verdicts.
  const TEST_N = Number(params.get('n')) || null;
  const sampleN = () => TEST_N || (Core.SAMPLE.choices.includes(state.n) ? state.n : Core.SAMPLE.standard);

  // The kit's own page server can start extra Ollama processes that this lab owns. It never touches other servers.
  async function loadOwned() {
    if (IS_FILE) { ui.api = false; return; }
    try {
      const r = await fetch('/lab-api/servers');
      if (!r.ok) throw new Error('no api');
      ui.owned = (await r.json()).servers || [];
      ui.api = true;
    } catch (_) { ui.api = false; }
    render();
  }
  async function startOwned(slots) {
    if (ui.running || ui.spawning || ui.observing) return;
    ui.spawning = 'Starting an owned model server with ' + slots + ' serving slot' + (slots === 1 ? '' : 's') + '…';
    render();
    try {
      const r = await fetch('/lab-api/servers?slots=' + slots, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'the page server could not start it');
      ui.owned = j.servers;
      state.endpoint = j.base;
      ui.spawning = null;
      save();
      await observeNow();
    } catch (e) {
      ui.spawning = null;
      ui.spawnError = String(e.message || e);
      render();
    }
  }
  async function observeNow() {
    if (ui.running || ui.observing || ui.spawning) return;
    const observedKey = obsKey(), observedCfg = runCfg();
    ui.observing = true; ui.observeError = null;
    render();
    try {
      state.observed[observedKey] = await Core.observeSystem(observedCfg);
      save();
    } catch (e) { ui.observeError = (e.message || String(e)) + (e.detail ? ' ' + e.detail : ''); }
    ui.observing = false;
    render();
  }

  function systemsCard(id, stepNo) {
    const rows = Object.keys(SYSDEF).map((sid) => { const pr = profilesFor(id).find((x) => x.id === sid); return pr ? ['▣ ' + sysName(pr), pr.observed.processor, slotsText(pr.observed), 'recorded ' + when(pr.captured_at)] : ['▣ ' + sysShort(sid), SYSDEF[sid].split(' · ')[0], SYSDEF[sid].split(' · ')[1].replace(' serving', ''), 'no recording in this copy']; });
    const o = state.observed[obsKey()];
    if (state.mode === 'live') rows.push(['● This laptop, ' + state.endpoint + (state.cpu ? ', CPU requested' : ''), o ? o.processor : 'not observed yet', o ? slotsText(o) : 'not observed yet', o ? 'observed ' + when(o.observed_at) : '–']);
    const ref = profilesFor(id)[0];
    return h('div', { class: 'card', id: 'systems-' + id },
      h('h2', null, stepNo(), 'Know the systems'),
      p('A, B and C are not different models. Each is ' + MODEL_LINE + (ref ? ' on the same ' + ref.hardware.chip + ' laptop with ' + ref.hardware.ram_gb + ' GB' : ' on one laptop') + ', recorded earlier. Only the serving setup differs: which processor runs the model, and how many requests the server works on at once (its serving slots).'),
      table(['System', 'Processor running the model', 'Requests served at once', 'When'], rows, 'left'),
      state.mode === 'live' ? h('div', { class: 'row' },
        h('button', { class: 'btn', id: 'btn-observe-' + id, disabled: !!ui.running || !!ui.spawning || !!ui.observing, onclick: observeNow }, ui.observing ? 'Observing…' : 'Observe this laptop\'s serving setup'),
        h('span', { class: 'note', text: 'Sends four short requests together and counts how many were being answered at the same moment, then asks Ollama which processor holds the model. Observed, not assumed.' })) : null,
      ui.observeError ? h('div', { class: 'alert error' }, ui.observeError) : null);
  }

  function leverSelect(idAttr, value, options, onpick, disabled) {
    return h('select', { id: idAttr, disabled, onchange: (e) => onpick(options[e.target.selectedIndex][0]) }, options.map(([v, label]) => h('option', { selected: v === value }, label)));
  }
  function leversCard(id, stepNo) {
    const lab = LABS[id], s = settingsFor(id), busy = !!ui.running || !!ui.spawning || !!ui.observing;
    const setLab = (k, v) => { state.settings[id] = Object.assign({}, state.settings[id], { [k]: v }); save(); render(); };
    const o = state.observed[obsKey()];
    const kindLabel = { application: 'application lever', serving: 'serving lever', demand: 'demand' };
    const lever = (kind, label, control, noteText) => h('div', { class: 'lever' }, h('span', { class: 'lever-kind ' + kind, text: kindLabel[kind] }), h('label', { class: 'field' }, label, control), noteText ? h('span', { class: 'note', text: noteText }) : null);
    return h('div', { class: 'card', id: 'levers-' + id },
      h('h2', null, stepNo(), 'Choose your settings'),
      p('Run once with the defaults: that is your baseline. Then change one thing and run again.', 'muted'),
      h('div', { class: 'levers' },
        lab.levers.map((lv) => lever(lv.kind, lv.label, leverSelect('lv-' + id + '-' + lv.key, s[lv.key], lv.options, (v) => setLab(lv.key, v), busy))),
        lever('serving', 'Model server', leverSelect('lv-endpoint', state.endpoint, endpoints().map((b) => [b, b + (ui.owned.find((x) => x.base === b) ? ' (owned by this lab)' : '')]), (v) => { state.endpoint = v; save(); render(); }, busy),
          o ? 'Observed: ' + effectiveText(o) + '.' : 'Not observed yet. Each run observes it first.'),
        lever('serving', 'Processor', leverSelect('lv-cpu', !!state.cpu, [[false, 'server default (GPU when it has one)'], [true, 'CPU only']], (v) => { state.cpu = v; save(); render(); }, busy),
          state.cpu ? 'Requested per request. The run reports what the server actually did.' : null),
        lever('demand', 'Samples per measured condition', leverSelect('lv-n', sampleN(), Core.SAMPLE.choices.map((n) => [n, n + (n === Core.SAMPLE.standard ? ' (standard)' : '')]), (v) => { state.n = v; save(); render(); }, busy),
          'A p95 from ' + sampleN() + ' samples has ' + Math.floor(sampleN() * 0.05) + ' slower samples behind it. A bounded experiment, not proof of a monthly promise.')),
      ui.api ? h('div', { class: 'row' },
        h('span', { class: 'lever-kind serving', text: 'serving lever' }), 'Start another model server owned by this lab, with',
        [1, 2, 4].map((k) => h('button', { class: 'btn', id: 'btn-own-' + k, disabled: busy || !!ui.spawning, onclick: () => startOwned(k) }, k + (k === 1 ? ' slot' : ' slots'))),
        h('span', { class: 'note', text: ui.spawning || 'A new Ollama process on its own port. Your existing server is not restarted. It stops when the kit\'s page server stops.' })) :
        (ui.api === false ? p('To change serving slots, start a second server yourself (`sh tools/four-slot-server.sh`) and add its address on the Setup tab, or start the kit with `python3 tools/serve.py`, which can start owned servers for you.', 'note') : null),
      ui.spawnError ? h('div', { class: 'alert error' }, 'Could not start an owned server: ' + ui.spawnError) : null);
  }

  /* ---------- running ---------- */
  function paintProgress() {
    const r = ui.running;
    if (!r) return;
    const bar = document.getElementById('run-bar'), lab = document.getElementById('run-label'), stream = document.getElementById('run-stream'), count = document.getElementById('run-count');
    if (bar) bar.style.width = (r.n ? Math.round((r.i / r.n) * 100) : 0) + '%';
    if (lab) lab.textContent = r.label;
    if (count) count.textContent = r.n ? r.i + ' of ' + r.n + ' · ' + Math.round((Date.now() - r.t0) / 1000) + ' s' : '';
    if (stream) stream.textContent = r.text;
  }
  function persist() {
    for (let tries = 0; tries < 12; tries++) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (_) {
        // Storage is full: drop the oldest run that is not a baseline, then try again.
        const victim = TAB_ORDER.filter((x) => LABS[x]).flatMap((x) => runsOf(x).map((r) => ({ x, r }))).filter(({ x, r }) => state.baseline[x] !== r.id).sort((a, b) => a.r.at.localeCompare(b.r.at))[0];
        if (!victim) return false;
        state.runs[victim.x] = runsOf(victim.x).filter((r) => r !== victim.r);
      }
    }
    return false;
  }
  async function startRun(id) {
    if (ui.running || ui.spawning || ui.observing) return;
    const ctl = new AbortController(), cfg = runCfg(), settings = settingsFor(id), n = sampleN(), observedKey = obsKey();
    // Every callback checks that it still belongs to this run, so a failed or stopped run can never
    // write into a later one.
    const me = { id, ctl, t0: Date.now(), i: 0, n: 0, label: 'Observing the serving setup (four probe requests)…', text: '' };
    const mine = () => ui.running === me;
    ui.running = me;
    delete ui.errors[id];
    render();
    try {
      const effective = await Core.observeSystem(cfg, ctl.signal);
      state.observed[observedKey] = effective;
      const result = await Core.experiments[id](cfg, {
        n, settings, signal: ctl.signal,
        onStep: ({ i, n: total, label }) => { if (!mine()) return; Object.assign(me, { i, n: total, label, text: '' }); paintProgress(); },
        onToken: (_, text) => { if (!mine()) return; me.text = text.slice(-420); paintProgress(); },
      });
      const run = { id: id + '-' + Date.now().toString(36), at: new Date().toISOString(), source: 'live', settings: result.settings, n, base: cfg.base, cpu_requested: !!(cfg.extraOptions && cfg.extraOptions.num_gpu === 0), effective, wall_ms: Date.now() - me.t0, result };
      runsOf(id).push(run);
      if (!state.baseline[id]) state.baseline[id] = run.id;
      while (runsOf(id).length > 6) state.runs[id].splice(state.runs[id].findIndex((r) => r.id !== state.baseline[id]), 1);
      state.sel[id] = run.id;
      if (!persist()) ui.errors[id] = new Core.LabError('http', 'The run finished, but this browser\'s storage is full, so it will be lost on reload. Download your runs from the Setup tab.');
    } catch (e) {
      ui.errors[id] = e instanceof Core.LabError ? e : new Core.LabError('stream', String((e && e.message) || e));
    } finally {
      ctl.abort(); // stops any sibling requests still in flight after a failure; harmless after success
      if (mine()) ui.running = null;
      render();
    }
  }
  function runPlan(id) {
    const n = sampleN(), s = settingsFor(id);
    if (id === 'done') return n + ' chat questions, ' + n + ' completions and ' + Core.agentCount(n) + ' agent tasks, one at a time';
    if (id === 'load') return n + ' chat questions from ' + s.users + (s.users === 1 ? ' user' : ' users asking at once');
    return n + ' notices from ' + s.workers + (s.workers === 1 ? ' client worker' : ' client workers') + (s.share ? ', after ' + Core.CHAT_ALONE_N + ' chat questions alone, with a chat user asking throughout the batch (as many questions as fit)' : '');
  }
  function errorBox(id, e) {
    const fixes = {
      unreachable: 'Check that the model server is still running and that its address is right. If this page was opened as a file, start it through the kit\'s start script instead.',
      model_missing: 'The model is not on this server. `ollama pull ' + state.model + '` needs internet access, so on the day use the recorded systems.',
      stream: 'The server stopped mid-answer. It may have run out of memory or been restarted. Try once more.',
      http: '', aborted: 'You stopped the run. Nothing from it was kept.',
    };
    return h('div', { class: 'alert error', id: 'error-' + id },
      h('h3', { text: e.kind === 'aborted' ? 'Run stopped' : 'The run did not finish' }),
      p((e.message || String(e)) + ' ' + (fixes[e.kind] || '')), e.detail ? h('pre', { text: e.detail }) : null,
      p('No partial result was kept. Earlier runs are untouched.', 'note'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { delete ui.errors[id]; startRun(id); } }, 'Try again')));
  }

  /* ---------- results ---------- */
  const runHead = (id, run, i) => '● Run ' + (i + 1) + (state.baseline[id] === run.id ? ' (baseline)' : '');
  function runsCard(id) {
    const runs = runsOf(id);
    if (!runs.length) return null;
    const lab = LABS[id], ds = runs.map((r) => Core.derive[id](r.result));
    const sel = runs.find((r) => r.id === state.sel[id]) || runs[runs.length - 1], si = runs.indexOf(sel);
    const cell = (r) => (r ? h('span', null, badge(r), h('span', { class: 'cellnote', text: ' ' + valText(r) })) : '–');
    const card = h('div', { class: 'result-block live', id: 'live-' + id },
      h('div', { class: 'row' }, h('span', { class: 'source live', text: '● LIVE · THIS LAPTOP' }), h('span', { class: 'muted', text: runs.length + (runs.length === 1 ? ' run kept' : ' runs kept') + ' (the newest six, baseline always)' })),
      table([''].concat(runs.map((r, i) => runHead(id, r, i))), [
        ['Settings'].concat(runs.map((r) => settingsText(id, r.settings))),
        ['Serving setup, observed'].concat(runs.map((r) => effectiveText(r.effective) + (r.cpu_requested && r.effective.processor !== 'CPU' ? ' (CPU was requested but not applied)' : ''))),
        ['Model server'].concat(runs.map((r) => r.base)),
        ['Samples per condition'].concat(runs.map((r) => String(r.n))),
      ].concat(lab.matrix.map((rid) => [(ds.map((d) => rowOf(d, rid)).find(Boolean) || { promise: rid }).promise].concat(ds.map((d) => cell(rowOf(d, rid)))))), 'matrix'),
      h('div', { class: 'row' },
        h('span', { class: 'muted', text: 'Details for' }),
        h('span', { class: 'seg', role: 'group' }, runs.map((r, i) => h('button', { 'aria-pressed': String(r === sel), onclick: () => { state.sel[id] = r.id; save(); render(); } }, 'Run ' + (i + 1)))),
        state.baseline[id] !== sel.id ? h('button', { class: 'link', id: 'btn-baseline-' + id, onclick: () => { state.baseline[id] = sel.id; save(); render(); } }, 'make this the baseline') : null,
        h('button', { class: 'link', id: 'btn-delete-run-' + id, onclick: () => { state.runs[id] = runs.filter((r) => r !== sel); if (state.baseline[id] === sel.id) state.baseline[id] = (state.runs[id][0] || {}).id || null; save(); render(); } }, 'delete this run')),
      h('div', { class: 'source-line' }, 'Run ' + (si + 1) + ': measured ' + when(sel.at) + ' against ' + sel.base + ', ' + sel.result.model + ', Ollama ' + (sel.effective.ollama_version || '?') + '. ' + settingsText(id, sel.settings) + '. Observed serving setup: ' + effectiveText(sel.effective) + '. Took ' + Math.round(sel.wall_ms / 1000) + ' s.'));
    RENDER[id](card, ds[si]);
    return card;
  }

  function recordedBlock(id) {
    const list = profilesFor(id);
    if (!list.length) return h('div', { class: 'alert info' }, 'No recorded run of this lab is included in the kit.');
    const pr = chosenProfile(id), runs = pr.runs[id];
    const run = runs.find((r) => r.id === state.recRun[id]) || refRun(pr, id) || runs[0];
    const block = h('div', { class: 'result-block recorded', id: 'recorded-' + id },
      h('div', { class: 'row' }, h('span', { class: 'source recorded', text: '▣ RECORDED · NOT THIS LAPTOP' }),
        h('span', { class: 'seg', role: 'group', 'aria-label': 'Recorded system' }, list.map((x) => h('button', { 'aria-pressed': String(x.id === pr.id), onclick: () => { state.profile[id] = x.id; state.recRun[id] = null; save(); render(); } }, sysName(x))))),
      runs.length > 1 ? h('div', { class: 'row' }, h('span', { class: 'muted', text: 'Recorded run' }), h('span', { class: 'seg', role: 'group' }, runs.map((r) => h('button', { 'aria-pressed': String(r === run), onclick: () => { state.recRun[id] = r.id; save(); render(); } }, settingsText(id, r.settings))))) : null,
      h('div', { class: 'source-line' }, 'Recorded ' + when(run.at) + ' on the presenter\'s laptop (' + pr.hardware.chip + ', ' + pr.hardware.ram_gb + ' GB), ' + MODEL_LINE + ', Ollama ' + pr.observed.ollama_version + '. Observed serving setup: ' + effectiveText(pr.observed) + '. ' + settingsText(id, run.settings) + ', ' + run.n + ' samples per condition.'));
    RENDER[id](block, Core.derive[id](run.result));
    return block;
  }

  // Promise-by-system table: the answer to "which system keeps which promise" at a glance.
  function matrix(id) {
    const lab = LABS[id], runs = runsOf(id);
    const cols = profilesFor(id).map((pr) => { const r = refRun(pr, id); return r ? { head: '▣ ' + sysName(pr), sub: settingsText(id, r.settings), d: Core.derive[id](r.result) } : null; }).filter(Boolean);
    if (state.mode === 'live' && runs.length) {
      const base = runs.find((r) => r.id === state.baseline[id]) || runs[0], last = runs[runs.length - 1];
      for (const [r, name] of base === last ? [[base, 'baseline']] : [[base, 'baseline'], [last, 'latest run']]) cols.push({ head: '● This laptop, ' + name, sub: settingsText(id, r.settings) + ' · ' + effectiveText(r.effective), d: Core.derive[id](r.result) });
    }
    const cell = (r) => (r ? h('span', null, badge(r), h('span', { class: 'cellnote', text: ' ' + valText(r) })) : '–');
    return h('div', { id: 'matrix-' + id },
      h('h3', { text: 'Which system keeps which promise' }),
      table(['Promise (hypothetical)'].concat(cols.map((c) => h('span', null, c.head, h('br'), h('span', { class: 'cellnote', text: c.sub })))),
        lab.matrix.map((rid) => [(cols.map((c) => rowOf(c.d, rid)).find(Boolean) || { promise: rid }).promise].concat(cols.map((c) => cell(rowOf(c.d, rid))))), 'matrix'),
      p('▣ columns: the same ' + MODEL_LINE + ' on the presenter\'s laptop, recorded earlier with the serving setup named in the heading.' + (cols.some((c) => c.head[0] === '●') ? ' ● columns: your own runs, with their settings and the serving setup that was observed.' : '') + ' Targets are hypothetical.', 'note'));
  }

  function resetLab(id) {
    if (!confirm('Clear this exercise only: its prediction, your runs and the reveal? Other exercises and your worksheet are kept.')) return;
    for (const k of ['pred', 'runs', 'revealed', 'settings', 'sel', 'baseline', 'recRun', 'profile']) delete state[k][id];
    delete ui.errors[id];
    save();
    render();
  }

  function renderLab(main, id) {
    const lab = LABS[id], questions = lab.questions();
    const pred = state.pred[id] || (state.pred[id] = { answers: {}, committed: false });
    const revealed = !!state.revealed[id] && pred.committed;
    const measured = revealed ? lab.measured() : {};
    let n = 0;
    const stepNo = () => h('span', { class: 'step-no', text: String(++n) });

    main.append(h('div', { class: 'card', id: 'brief-' + id },
      h('h1', null, lab.title, ' ', h('span', { class: 'time-chip', text: lab.clock })),
      h('dl', { class: 'chain' }, lab.chain.map(([k, v]) => [h('dt', { text: k }), h('dd', null, rich(v))])),
      h('div', { class: 'row' }, h('span', { class: 'note', text: 'Promises are hypothetical, written for this workshop.' }), h('button', { class: 'link', id: 'btn-reset-' + id, disabled: !!ui.running, onclick: () => resetLab(id) }, 'Reset this exercise'))));

    main.append(systemsCard(id, stepNo));

    main.append(h('div', { class: 'card', id: 'predict-' + id },
      h('h2', null, stepNo(), 'Predict'),
      p('Commit before you see any numbers.', 'muted'),
      questions.map((q) => h('fieldset', { class: 'q', disabled: pred.committed },
        h('legend', { text: q.q }),
        q.options.map(([v, label]) => h('label', null,
          h('input', { type: 'radio', name: id + '-' + q.id, value: v, checked: pred.answers[q.id] === v, onchange: () => { pred.answers[q.id] = v; save(); const b = document.getElementById('btn-commit-' + id); if (b) b.disabled = !questions.every((x) => pred.answers[x.id]); } }), label)),
        revealed ? h('div', { class: 'verdict' },
          'You predicted: ', h('b', { text: pred.answers[q.id] ? (q.options.find((o) => o[0] === pred.answers[q.id]) || [0, 'no answer'])[1] : 'no answer' }), '. ',
          'In the recorded runs: ', h('b', { text: measured[q.id] ? (q.options.find((o) => o[0] === measured[q.id]) || [0, 'something else'])[1] : 'not determined' }), '.') : null)),
      pred.committed
        ? h('div', { class: 'row' }, h('span', { class: 'muted', text: pred.skipped ? 'Prediction skipped.' : 'Prediction locked in.' }), !revealed && !runsOf(id).length && !ui.running ? h('button', { class: 'link', id: 'btn-change-' + id, onclick: () => { pred.committed = false; pred.skipped = false; save(); render(); } }, 'change it') : null)
        : h('div', { class: 'row' },
          h('button', { class: 'btn primary', id: 'btn-commit-' + id, disabled: !questions.every((q) => pred.answers[q.id]), onclick: () => { pred.committed = true; save(); render(); } }, 'Lock in my prediction'),
          h('button', { class: 'link', id: 'btn-skip-' + id, onclick: () => { pred.committed = true; pred.skipped = true; save(); render(); } }, 'skip the prediction'))));

    if (!state.mode) {
      main.append(h('div', { class: 'card' }, h('h2', null, stepNo(), 'Measure'), p('Choose a path first.'), h('button', { class: 'btn', onclick: () => go('setup') }, 'Go to Setup')));
      return;
    }

    if (state.mode === 'live') {
      if (pred.committed || (ui.running && ui.running.id === id)) main.append(leversCard(id, stepNo));
      const run = h('div', { class: 'card', id: 'run-' + id }, h('h2', null, stepNo(), 'Run it on this laptop'));
      if (ui.running && ui.running.id === id) {
        run.append(h('div', { class: 'row' }, h('b', { id: 'run-count' }), h('span', { id: 'run-label', class: 'muted' })), h('div', { class: 'progress' }, h('div', { id: 'run-bar' })),
          h('pre', { class: 'stream', id: 'run-stream', 'aria-live': 'off' }), h('button', { class: 'btn', id: 'btn-stop', onclick: () => ui.running && ui.running.ctl.abort() }, 'Stop'));
      } else if (!pred.committed) run.append(p('Locked until you commit a prediction above.', 'muted'));
      else {
        const last = runsOf(id)[runsOf(id).length - 1];
        run.append(p('This run: ' + runPlan(id) + '. Every request is real.' + (last ? ' Your last run took ' + Math.round(last.wall_ms / 1000) + ' s.' : ' As a rough guide it took two to four minutes on the presenter\'s laptop while that laptop was busy; yours will differ.') + ' You can stop at any time; a stopped run keeps nothing.'),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', id: 'btn-run-' + id, disabled: !!ui.spawning || !!ui.observing, onclick: () => startRun(id) }, runsOf(id).length ? 'Run again with these settings (keeps earlier runs)' : 'Run the baseline')));
        if (ui.errors[id]) run.append(errorBox(id, ui.errors[id]));
      }
      const rc = runsCard(id);
      if (rc) run.append(rc);
      main.append(run);
      if (ui.running && ui.running.id === id) paintProgress();
    }

    const rec = h('div', { class: 'card', id: 'reveal-' + id }, h('h2', null, stepNo(), state.mode === 'live' ? 'Compare with the recorded systems' : 'Inspect the recorded systems'));
    if (!pred.committed) rec.append(p('Locked until you commit a prediction above.', 'muted'));
    else if (!state.revealed[id]) {
      rec.append(p('Runs of systems A, B and C recorded earlier on the presenter\'s laptop. They are not measurements of your laptop.'),
        h('button', { class: 'btn primary', id: 'btn-reveal-' + id, disabled: !profilesFor(id).length, onclick: () => { state.revealed[id] = true; save(); render(); } }, 'Reveal recorded systems'));
    } else rec.append(matrix(id), recordedBlock(id));
    main.append(rec);

    if (revealed) {
      main.append(h('div', { class: 'card', id: 'interpret-' + id },
        h('h2', null, stepNo(), 'Decide'),
        h('ol', null, lab.discuss.map((q) => h('li', null, rich(q)))),
        h('details', { id: 'reading-' + id }, h('summary', { text: 'One reading of the recorded results (open after you have talked)' }),
          h('div', { class: 'inner' }, lab.reading().map((t) => p(t))))));
    }
  }

  /* ---------- your promise (worksheet) ---------- */
  const SHEET_FIELDS = [
    ['work', 'The work', 'Who is the customer and what are they trying to get done?'],
    ['useful', 'What makes the result useful', 'What must be true of the result for them to keep using it? Include what "right" means.'],
    ['shape', 'Workload shape and demand', 'Online or offline? Input and output sizes. How many calls per user action? How many users at once, and when?'],
    ['sli', 'The measurement (SLI)', 'What exactly is measured, and where: at the user, at your service edge, or at the model server?'],
    ['slo', 'The target (SLO)', 'A percentile or share, a threshold, a window, and the demand it holds under.'],
    ['sla', 'The promise and its consequence (SLA), if any', 'Is this target promised to anyone? What happens when it is missed? "Internal only" is a valid answer.'],
    ['others', 'Who else is on the hook', 'Which parts besides the model server decide whether this is met: tools, retrieval, network, queues, people?'],
    ['measure', 'What you would measure first', 'One test under representative traffic that could show the promise is not being kept.'],
  ];
  // Starters drawn from projects in the room. Model uses are proposals for discussion, not descriptions of anyone's system.
  const STARTERS = [
    { id: 'blank', name: 'Start blank', v: {} },
    { id: 'rag', name: 'RAG pipeline for company documents', v: {
      work: 'Staff ask questions and get answers grounded in internal documents.',
      useful: 'The answer starts quickly, cites the right document, and does not invent policy.',
      shape: 'Online. A few thousand tokens of retrieved text in, a few hundred out. One model call per question after one retrieval call. Busy in working hours.',
      sli: 'Time from pressing Enter to the first words, measured in the browser. Share of answers that cite a retrieved passage.',
      slo: '95% of answers start within 2 s over a working week at up to 20 people asking at once (hypothetical).',
      sla: 'Internal target only. No contract.', others: 'Retrieval latency, document freshness, the network path to the model, the web app.',
      measure: 'Replay a day of real questions at the busiest hour\'s rate and record time to first words at the browser.' } },
    { id: 'agent', name: 'Personal agent (calendar, notes, home)', v: {
      work: 'One person asks for an errand that needs several tools.',
      useful: 'The errand is really done. A fast wrong action is worse than a slow right one.',
      shape: 'Online but not typed-speed. Several model calls and tool waits per request. One user, bursts of activity.',
      sli: 'Time from request to finished errand, tool waits included. Share of errands where every tool call was valid and the final state is correct.',
      slo: '90% of errands finish within 20 s and 95% end in the right state, over a month (hypothetical).',
      sla: 'None. A personal project still benefits from writing the target down.', others: 'Each tool\'s API latency and rate limits, the MCP server, home network.',
      measure: 'Twenty scripted errands with the real tools, timing each call and checking the final calendar state.' } },
    { id: 'contracts', name: 'Contract scraper (proposed: field extraction)', v: {
      work: 'A team collects tender notices and wants key fields in a table. Scraping itself needs no model; extraction from free text is a proposed model use.',
      useful: 'Every notice collected today is in the table by morning with the right reference and dates.',
      shape: 'Offline batch. Thousands of short documents a night, small JSON out. Nobody waits on a single request.',
      sli: 'Share of the night\'s notices processed by 06:00. Share with correct fields on a labelled sample. Cost per correct notice.',
      slo: '100% of notices received by 22:00 are processed by 06:00; 98% of sampled fields correct; cost under a set budget (hypothetical).',
      sla: 'Possibly promised to the internal team that uses the table.', others: 'The scraper, source site outages, the review step for low-confidence extractions.',
      measure: 'One full night\'s volume through the pipeline, with a hand-checked sample of 200 notices.' } },
    { id: 'research', name: 'Enterprise research assistant (long documents)', v: {
      work: 'An analyst asks for a summary across long reports.',
      useful: 'The summary is faithful to the sources and arrives while the analyst still has the question in mind.',
      shape: 'Online with long inputs: tens of thousands of tokens in, a page out. Low request rate, large requests.',
      sli: 'Time to the complete summary. Share of summaries with no unsupported claim on a reviewed sample.',
      slo: '90% of summaries complete within 60 s for inputs up to a stated size, over a month (hypothetical).',
      sla: 'Enterprise buyers often ask for availability and response-time commitments; correctness is usually not guaranteed.', others: 'Document parsing, retrieval, upload size limits, the reviewer.',
      measure: 'A set of real long documents at the stated size limit, sent at the expected hourly rate.' } },
    { id: 'ids', name: 'Intrusion detection (may not be generative)', v: {
      work: 'Flag suspicious network events for an operator.',
      useful: 'True attacks are flagged in time to act, with few false alarms.',
      shape: 'High-volume stream. The detector may be a classical or small non-generative model; a language model is a proposed add-on for explaining alerts.',
      sli: 'Detection delay, events per second handled, false-alarm rate.',
      slo: '99% of events scored within 1 s at peak event rate, over a week (hypothetical).',
      sla: 'Internal security objective.', others: 'Log collection, feature pipelines, the operator\'s queue.',
      measure: 'Replay a recorded peak hour of traffic and measure scoring delay and dropped events.' } },
  ];
  function renderClinic(main) {
    const sheet = state.sheet;
    const set = (k, v) => { sheet[k] = v; save(); };
    main.append(h('div', { class: 'card' },
      h('h1', null, 'Your promise ', h('span', { class: 'time-chip', text: '7:07–7:13' })),
      p('Walk your own project down the same chain the labs used: the work, what makes the result useful, the shape of the workload, a measurement, a target, and who would be told if it were missed. Six minutes, then swap with your neighbour and look for the missing piece.', 'lead')));

    main.append(h('div', { class: 'card', id: 'sheet' },
      h('h2', null, h('span', { class: 'step-no', text: '1' }), 'Fill the chain'),
      h('div', { class: 'row' },
        h('label', { class: 'field' }, 'Start from an example (you can edit everything)', h('select', { id: 'sheet-starter', onchange: (e) => {
          const st = STARTERS.find((x) => x.id === e.target.value);
          if (Object.keys(sheet).some((k) => sheet[k]) && !confirm('Replace what you have written?')) { e.target.value = 'blank'; return; }
          state.sheet = Object.assign({}, st.v); save(); render();
        } }, STARTERS.map((st) => h('option', { value: st.id }, st.name)))),
        h('button', { class: 'btn', id: 'sheet-export', onclick: exportSheet }, 'Download as Markdown')),
      p('The examples are starting points written for this workshop. Their numbers are hypothetical, and where a model is only one possible approach the example says so.', 'note'),
      SHEET_FIELDS.map(([k, label, hint]) => h('label', { class: 'sheet-field' }, h('span', { class: 'sheet-label', text: label }), h('span', { class: 'note', text: hint }),
        h('textarea', { id: 'sheet-' + k, rows: '2', oninput: (e) => set(k, e.target.value) }, sheet[k] || '')))));

    main.append(h('div', { class: 'card', id: 'sheet-check' },
      h('h2', null, h('span', { class: 'step-no', text: '2' }), 'Check it with your neighbour'),
      h('ul', null, [
        'Does the measurement describe the useful result, or only something easy to measure?',
        'Does the target name a percentile or share, a threshold, a window, and the demand it holds under?',
        'Is quality written as its own target, separate from speed?',
        'If there is a promise to someone else, what happens when it is missed? If nothing happens, it is an objective and not an agreement.',
        'Which part of the chain is outside the model server, and who owns it?',
      ].map((t) => h('li', { text: t }))),
      p('A faster model server helps only where the model server is what stands between the work and the promise. The labs showed one case where it was (queueing in Lab 2) and one where it mostly was not (outcome validation and invalid actions in Lab 1).', 'note')));
  }
  function exportSheet() {
    const md = '# My workload and promise\n\n' + SHEET_FIELDS.map(([k, label]) => '## ' + label + '\n\n' + (state.sheet[k] || '_not filled in_') + '\n').join('\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([md], { type: 'text/markdown' })), download: 'my-workload-promise.md' });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- render ---------- */
  function render() {
    renderChrome();
    const main = document.getElementById('main');
    main.replaceChildren();
    if (ui.tab === 'setup') renderSetup(main);
    else if (ui.tab === 'clinic') renderClinic(main);
    else renderLab(main, ui.tab);
  }

  const start = location.hash.slice(1);
  if (TAB_ORDER.includes(start)) ui.tab = start;
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TAB_ORDER.includes(t) && t !== ui.tab && !ui.running) { ui.tab = t; render(); } });
  render();
  loadOwned();
})();
