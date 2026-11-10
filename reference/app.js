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
    { mode: null, base: Core.DEFAULT_BASE, model: Core.DEFAULT_MODEL, pred: {}, live: {}, revealed: {}, profile: {}, sheet: {} },
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
  const ui = { tab: 'setup', running: null, errors: {}, setup: null };
  const cfg = () => ({ base: state.base, model: state.model });
  const IS_FILE = location.protocol === 'file:';

  const profilesFor = (exp) => PROFILES.filter((pr) => pr.results && pr.results[exp]);
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
  const S = {
    model: { key: 'model', label: 'Model calls', color: COLORS.orange },
    tools: { key: 'tools', label: 'Waiting on tools (simulated)', color: COLORS.aqua },
    p50: { key: 'p50', label: 'Typical (p50)', color: COLORS.blue },
    p95: { key: 'p95', label: 'Slow tail (p95, or the worst when there are under 20 samples)', short: 'p95', color: COLORS.orange },
    job: { key: 'job', label: 'Job wall-clock', color: COLORS.blue },
  };

  function measuredText(r) {
    if (r.status === 'no-data') return 'no data';
    if (r.kind === 'share') return pctTxt(r.value) + ' (' + r.measured_as + ')';
    if (r.kind === 'cost') return money(r.value) + ' per 1,000';
    return fmtMs(r.value) + ' (' + r.measured_as + ')';
  }
  function targetText(r) {
    if (r.kind === 'share') return 'at least ' + pctTxt(r.limit);
    if (r.kind === 'cost') return 'at most ' + money(r.limit);
    return 'within ' + fmtMs(r.limit);
  }
  function badge(r) {
    if (!r || r.status === 'no-data') return h('span', { class: 'badge none', text: '– no data' });
    const b = h('span', { class: 'badge ' + r.status, text: r.status === 'met' ? '✓ MET' : '✕ MISSED' });
    return r.thin ? h('span', null, b, h('span', { class: 'thin', text: ' smoke test' })) : b;
  }
  function scorecard(rows) {
    const out = h('div', { class: 'scorecard' },
      table(['Promise (hypothetical)', 'Measured', 'Target', 'Verdict'], rows.map((r) => [r.promise, measuredText(r), targetText(r), badge(r)])));
    if (rows.some((r) => r.thin)) out.append(p('"Smoke test" marks a percentile promise judged on fewer samples than the percentile needs (20 for a p95, 10 for a p90). The worst sample is used instead. Passing a smoke test shows the promise is possible. It does not show the promise is kept.', 'note'));
    return out;
  }

  /* ---------- result renderers ---------- */
  const RENDER = {
    done(el, d) {
      el.appendChild(facts([
        [fmtMs(d.chat.ttft_p50), 'chat: typical wait for the first words'],
        [fmtMs(d.completion.total_p50), 'completion: typical wait for the whole suggestion'],
        [fmtMs(d.agent.task_p50), 'agent: typical time for the whole task'],
        d.agent.tool_share != null && [pctTxt(d.agent.tool_share), 'of agent task time was waiting on tools'],
      ]));
      el.appendChild(scorecard(d.scorecard));
      const tasks = d.agent.tasks.slice(0, 4);
      if (tasks.length) {
        bars(el, {
          title: 'Where an agent task spends its time (first ' + tasks.length + ' tasks)',
          series: [S.model, S.tools], labelWidth: 150, target: { value: OBJ.agent_task_ms, label: 'target ' + fmtMs(OBJ.agent_task_ms) },
          rows: tasks.map((t, i) => ({ label: 'Task ' + (i + 1) + (t.valid ? '' : ' (invalid)'), segments: [{ key: 'model', value: t.model_ms }, { key: 'tools', value: t.tool_ms }], end: fmtMs(t.total_ms) })),
        });
      }
      el.appendChild(table(['Workload', 'What "done" means', 'Samples', 'Typical', 'Quality check passed'], [
        ['Support chat', 'first words on screen', String(d.chat.n), fmtMs(d.chat.ttft_p50) + ' to first words; ' + fmtMs(d.chat.total_p50) + ' to the end', pctTxt(d.chat.quality)],
        ['Code completion', 'the whole suggestion', String(d.completion.n), fmtMs(d.completion.total_p50), pctTxt(d.completion.quality)],
        ['Agent task', '3 model calls + 2 tool waits', String(d.agent.n), fmtMs(d.agent.task_p50), pctTxt(d.agent.tasks.filter((t) => t.valid).length / Math.max(1, d.agent.n)) + ' of tasks'],
      ]));
      el.appendChild(p('Quality checks are simple and automatic: the chat answer must contain the fact from its context, the completion must contain the expected code, and an agent task counts only if both tool calls are valid JSON naming the right tool. Tool waits are fixed simulated delays of ' + Core.TOOL_WAIT_MS.join(' ms and ') + ' ms.', 'note'));
    },
    load(el, d) {
      const top = d.top, one = d.one;
      el.appendChild(facts([
        one && [fmtMs(one.ttft_p50), 'typical wait for first words, 1 user'],
        top && [fmtMs(top.ttft_p95), 'p95 wait for first words, ' + top.users + ' users'],
        top && [pctTxt(top.within), 'of answers started within ' + fmtMs(OBJ.chat_start_ms) + ' at ' + top.users + ' users'],
        top && one && [num(one.user_tps, 0) + ' → ' + num(top.user_tps, 0) + ' tok/s', 'speed each user sees, 1 → ' + top.users + ' users'],
      ]));
      el.appendChild(scorecard(d.scorecard));
      lines(el, {
        title: 'Wait for the first words as more users ask at once', xLabel: 'Users asking at once',
        categories: d.levels.map((l) => String(l.users)), target: { value: OBJ.chat_start_ms, label: 'target ' + fmtMs(OBJ.chat_start_ms) },
        series: [
          { key: 'p50', label: S.p50.label, short: 'p50', color: S.p50.color, values: d.levels.map((l) => l.ttft_p50) },
          { key: 'p95', label: S.p95.label, short: 'p95', color: S.p95.color, values: d.levels.map((l) => l.row.value) },
        ],
      });
      el.appendChild(table(['Users', 'Answers', 'First words p50', 'First words p95', 'Worst', 'Of which waiting in line (p50)', 'Whole answer p50', 'Speed per user', 'Server output', 'Answers per minute'],
        d.levels.map((l) => [String(l.users), String(l.n), fmtMs(l.ttft_p50), l.row.thin ? 'too few samples' : fmtMs(l.ttft_p95), fmtMs(l.ttft_max), fmtMs(l.wait_p50), fmtMs(l.total_p50), num(l.user_tps, 0) + ' tok/s', num(l.total_tps, 0) + ' tok/s', num(l.answers_per_min, 0)])));
      el.appendChild(p('"Waiting in line" is the client\'s end-to-end wait for the first words minus the server\'s own time reading the prompt. Each simulated user pauses 0 to ' + OBJ.think_ms + ' ms before each question.', 'note'));
    },
    mixed(el, d) {
      const b1 = d.jobs.find((j) => j.phase === 'batch-1'), b4 = d.jobs.find((j) => j.phase === 'batch-4');
      el.appendChild(facts([
        b1 && b4 && [fmtMs(b1.wall_ms) + ' → ' + fmtMs(b4.wall_ms), 'batch of ' + b4.n + ' notices, 1 worker → 4 workers'],
        b4 && [money(b4.cost_per_1000), 'hypothetical cost per 1,000 correct notices (4 workers)'],
        d.chat_alone && d.chat_shared && [fmtMs(d.chat_alone.ttft_max) + ' → ' + fmtMs(d.chat_shared.ttft_max), 'worst chat wait for first words, alone → sharing with the batch'],
        b4 && [b4.ok + ' of ' + b4.n, 'notices extracted correctly'],
      ]));
      el.appendChild(scorecard(d.scorecard));
      bars(el, {
        title: 'Time to finish the batch', series: [S.job], labelWidth: 290, target: { value: OBJ.batch_deadline_ms, label: 'deadline ' + fmtMs(OBJ.batch_deadline_ms) },
        rows: d.jobs.map((j) => ({ label: j.label, segments: [{ key: 'job', value: j.wall_ms }] })),
      });
      el.appendChild(table(['Batch run', 'Wall-clock', 'Notices per minute', 'Time per notice (p50)', 'Correct', 'Cost per 1,000 correct'],
        d.jobs.map((j) => [j.label, fmtMs(j.wall_ms), num(j.notices_per_min, 0), fmtMs(j.per_notice_p50), j.ok + ' of ' + j.n, money(j.cost_per_1000)])));
      const cs = [d.chat_alone && ['Chat user alone', d.chat_alone], d.chat_shared && ['Chat user while the batch runs', d.chat_shared]].filter(Boolean);
      el.appendChild(table(['Chat user', 'Questions', 'First words p50', 'First words, worst', 'Whole answer p50'], cs.map(([name, c]) => [name, String(c.n), fmtMs(c.ttft_p50), fmtMs(c.ttft_max), fmtMs(c.total_p50)])));
      el.appendChild(p('Cost uses a hypothetical machine price of ' + money(OBJ.machine_rate_per_hour) + ' per hour: job seconds × price ÷ correct notices. A notice counts as correct only if the reference and the deadline date both match.', 'note'));
    },
  };

  /* ---------- lab definitions ---------- */
  const SYS = (id) => PROFILES.find((pr) => pr.id === id);
  const D = (sysId, exp) => { const pr = SYS(sysId); return pr && pr.results[exp] ? Core.derive[exp](pr.results[exp]) : null; };
  const rowOf = (d, id) => (d ? d.scorecard.find((r) => r.id === id) : null);
  const met = (sysId, exp, rowId) => { const r = rowOf(D(sysId, exp), rowId); return r ? r.status === 'met' : null; };
  function which(a, b) { // answer key for "which of two systems meets it"
    if (a == null || b == null) return null;
    return a && b ? 'both' : a ? 'first' : b ? 'second' : 'neither';
  }
  const bucket = (x, cuts, values) => { if (x == null) return null; for (let i = 0; i < cuts.length; i++) if (x < cuts[i]) return values[i]; return values[values.length - 1]; };

  const LABS = {
    done: {
      tab: 'Lab 1 · Done?', title: 'Lab 1 · What counts as done?', clock: '6:34–6:44', runtime: '15–20 s on the reference laptop, about a minute without a GPU',
      chain: [
        ['The work', 'Three products share one model server: a support chat that answers from company documents, an editor that completes the line you are typing, and a personal agent that books a meeting through calendar tools.'],
        ['What makes the result useful', 'Chat: the first words appear quickly, then you read. Completion: the whole suggestion, before you type the next character. Agent: the meeting is really booked, which takes three model calls and two tool waits, and every tool call must be valid.'],
        ['Shape and demand', 'One user at a time. Short prompts, short outputs. This is the easiest condition the system will ever see.'],
        ['The promises (hypothetical)', OBJ.chat_pct + '% of chat answers start within ' + fmtMs(OBJ.chat_start_ms) + '. ' + OBJ.completion_pct + '% of completions arrive whole within ' + fmtMs(OBJ.completion_total_ms) + '. ' + OBJ.agent_pct + '% of agent tasks finish within ' + fmtMs(OBJ.agent_task_ms) + ', and at least ' + pctTxt(OBJ.agent_valid_min) + ' of tasks have every tool call valid.'],
        ['Systems to choose from', 'A: a GPU serving one request at a time. C: the same laptop with no GPU.'],
      ],
      questions: [
        { id: 'share', q: 'On System A, how much of an agent task\'s time is spent waiting on tools instead of the model?', options: [['low', 'under a third'], ['mid', 'between a third and two thirds'], ['high', 'over two thirds']] },
        { id: 'valid', q: 'System A finishes agent tasks well inside the time target. How many of those tasks have every tool call valid?', options: [['most', '90% or more: the promise is met'], ['some', 'somewhere in between'], ['few', 'under a quarter']] },
        { id: 'completion', q: 'Which systems meet the completion promise (the whole suggestion within ' + fmtMs(OBJ.completion_total_ms) + ')?', options: [['first', 'A only (GPU)'], ['both', 'both A and C'], ['second', 'C only (no GPU)'], ['neither', 'neither']] },
      ],
      measured() {
        const a = D('sys-a', 'done');
        if (!a) return {};
        const v = a.agent.tasks.filter((t) => t.valid).length / Math.max(1, a.agent.n);
        return { share: bucket(a.agent.tool_share, [1 / 3, 2 / 3], ['low', 'mid', 'high']), valid: v >= 0.9 ? 'most' : v < 0.25 ? 'few' : 'some', completion: which(met('sys-a', 'done', 'completion_total'), met('sys-c', 'done', 'completion_total')) };
      },
      matrix: ['chat_start', 'chat_quality', 'completion_total', 'agent_task', 'agent_valid'],
      discuss: [
        'For each of the three workloads, say in one sentence what "done" means to the person waiting. Which number on this page measures that?',
        'The agent met its time target. Would you ship it? What would a customer say the product failed to do?',
        'If you could make the model server twice as fast, how much sooner would an agent task finish? What else would you have to change?',
      ],
      reading() {
        const a = D('sys-a', 'done'), c = D('sys-c', 'done'), out = [];
        if (!a) return out;
        out.push('The three workloads need three different measurements. Chat is judged on the first words (' + fmtMs(a.chat.ttft_p50) + ' typical on System A), completion on the whole suggestion (' + fmtMs(a.completion.total_p50) + '), and the agent on the whole task (' + fmtMs(a.agent.task_p50) + '). One "latency" number would have hidden all of that.');
        const v = a.agent.tasks.filter((t) => t.valid).length;
        out.push('On System A the agent ' + (rowOf(a, 'agent_task').status === 'met' ? 'met' : 'missed') + ' its time target, and ' + v + ' of ' + a.agent.n + ' tasks had every tool call valid. Read the records: after finding a free slot, this small model with this prompt tells the user the meeting is booked without calling the tool that books it. A speed promise was met while the useful work did not happen. Speed and quality are separate promises and need separate measurements.');
        out.push(pctTxt(a.agent.tool_share) + ' of the agent\'s task time was waiting on tools. A model server twice as fast would shorten only the other ' + pctTxt(a.agent.model_share) + '. The promise is end to end, so the tools, the network and the application share responsibility for it.');
        if (c) {
          const ca = rowOf(a, 'completion_total'), cc = rowOf(c, 'completion_total');
          out.push('Completion is the tightest promise here. System A measured ' + fmtMs(ca.value) + ' at p' + ca.p + ' and System C ' + fmtMs(cc.value) + ', against a target of ' + fmtMs(OBJ.completion_total_ms) + '. The same code and model fit or miss the promise depending on the hardware underneath.');
        }
        out.push('Limit: this was one user at a time. It shows what is possible on an idle system and says nothing yet about a busy one. That is Lab 2.');
        return out;
      },
      why(d) {
        const out = ['The agent calls the model three times and re-sends the whole conversation each time. The server keeps its work on the part of the prompt it has just seen, so later calls only read what is new.'];
        if (d.agent.reused_known) out.push('In this run, later calls reused about ' + pctTxt(d.agent.later_reused) + ' of their prompt. The first call of a task took ' + fmtMs(d.agent.first_call_ms) + ' and later calls ' + fmtMs(d.agent.later_call_ms) + ' (medians).');
        out.push('Chat streams, so the user is served once the prompt has been read and the first token written. A completion or a tool call is useless until its last token, so the whole output counts.');
        return out;
      },
    },
    load: {
      tab: 'Lab 2 · Load', title: 'Lab 2 · Does the promise hold under load?', clock: '6:44–6:54', runtime: '25–45 s on the reference laptop, 1–2 minutes without a GPU',
      chain: [
        ['The work', 'The support chat from Lab 1. Each question arrives with its own retrieved document, so little can be reused between requests.'],
        ['What makes the result useful', 'The first words appear quickly for nearly everyone, not only for a typical user, and the answer contains the fact from the document.'],
        ['Shape and demand', 'Prompts of about 150 tokens, answers of up to 80. One, two, then four users asking at once, each pausing 0 to ' + OBJ.think_ms + ' ms between questions.'],
        ['The promise (hypothetical)', OBJ.chat_pct + '% of chat answers start within ' + fmtMs(OBJ.chat_start_ms) + ', measured at the client, with ' + OBJ.load_users + ' users asking at once. At least ' + pctTxt(OBJ.chat_quality_min) + ' of answers contain the fact.'],
        ['Systems to choose from', 'A: a GPU serving one request at a time. B: the same GPU serving four requests at once.'],
      ],
      questions: [
        { id: 'fit', q: 'With ' + OBJ.load_users + ' users asking at once, which systems keep the chat promise?', options: [['first', 'A only (one at a time)'], ['second', 'B only (four at once)'], ['both', 'both'], ['neither', 'neither']] },
        { id: 'slow', q: 'On System B with ' + OBJ.load_users + ' users, each user\'s complete answer takes how long compared with having the server alone?', options: [['same', 'about the same (under 1.3×)'], ['some', '1.3–3× as long'], ['much', 'more than 3× as long']] },
      ],
      measured() {
        const b = D('sys-b', 'load');
        return { fit: which(met('sys-a', 'load', 'chat_start_' + OBJ.load_users), met('sys-b', 'load', 'chat_start_' + OBJ.load_users)), slow: b ? bucket(b.slowdown_total, [1.3, 3], ['same', 'some', 'much']) : null };
      },
      matrix: ['chat_start_1', 'chat_start_2', 'chat_start_4', 'chat_quality_load'],
      discuss: [
        'Both systems pass with one user. What did that single-user result tell you about four users?',
        'System B serves more answers per minute and starts them sooner. What did each user give up? For which workload from Lab 1 would that be the wrong trade?',
        'The promise names a percentile, where it is measured, and how many users. Remove any one of those three. How could a vendor then "meet" it while users suffer?',
      ],
      reading() {
        const a = D('sys-a', 'load'), b = D('sys-b', 'load'), out = [];
        if (!a || !b) return out;
        out.push('With one user both systems start an answer in about ' + fmtMs(a.one.ttft_p50) + '. With ' + OBJ.load_users + ' users, System A\'s p95 wait for the first words was ' + fmtMs(a.top.ttft_p95) + ' and System B\'s was ' + fmtMs(b.top.ttft_p95) + ', against a target of ' + fmtMs(OBJ.chat_start_ms) + '. ' + pctTxt(a.top.within) + ' of System A\'s answers started in time and ' + pctTxt(b.top.within) + ' of System B\'s.');
        out.push('The single-user run could not have told you this. On System A the model was no slower under load; requests waited in line. The typical wait in line at ' + OBJ.load_users + ' users was ' + fmtMs(a.top.wait_p50) + ', while the server\'s own time to read a prompt stayed near ' + fmtMs(a.top.prefill_p50) + '.');
        out.push('System B paid for its short waits. Each user\'s text arrived at ' + num(b.top.user_tps, 0) + ' tokens per second instead of ' + num(b.one.user_tps, 0) + ', and a whole answer took ' + times(b.slowdown_total) + ' as long as with the server alone. The server as a whole produced more (' + num(b.one.total_tps, 0) + ' → ' + num(b.top.total_tps, 0) + ' tokens per second). Higher throughput and a slower experience for each user arrived together.');
        out.push('For chat, where the promise is about the first words, B is the better fit at this demand. For a workload judged on the whole output, such as completion or a tool call, the same change makes every result later. The workload decides which trade is right.');
        out.push('Limits: ' + a.top.n + ' answers per system at the top level, one laptop, one traffic pattern with very short pauses. A real promise would name a longer window and a traffic shape taken from production.');
        return out;
      },
      why(d) {
        const out = ['A model server works on a fixed number of requests at once. Call each place a slot. With one slot, a request that arrives while another is being answered waits in line, and that wait is added to its time to first words.'];
        if (d.top) out.push('In this run at ' + d.top.users + ' users the typical wait in line was ' + fmtMs(d.top.wait_p50) + ' and the server spent ' + fmtMs(d.top.prefill_p50) + ' reading each prompt.');
        out.push('With several slots the server starts every request at once and writes their tokens in the same passes. Nobody waits in line, and everybody\'s tokens come more slowly because the hardware is shared.');
        return out;
      },
    },
    mixed: {
      tab: 'Lab 3 · Share?', title: 'Lab 3 · Two workloads, one server?', clock: '6:54–7:03', runtime: '20–35 s on the reference laptop, about a minute without a GPU',
      chain: [
        ['The work', 'A procurement team wants key fields pulled from every new tender notice: reference, agency, closing date. This is a proposed use of a model for a contract scraper; scraping itself needs no model. The notices here are fictional.'],
        ['What makes the result useful', 'Every notice in the batch is processed before the deadline, the extracted fields are right, and the cost per correct notice stays under budget. Nobody watches individual requests.'],
        ['Shape and demand', BATCH_N() + ' notices of about 160 tokens each, about 50 tokens of JSON out. Run with one worker, then four workers in parallel, then four workers while a chat user keeps asking questions on the same server.'],
        ['The promises (hypothetical)', 'The batch finishes within ' + fmtMs(OBJ.batch_deadline_ms) + '. At least ' + pctTxt(OBJ.batch_valid_min) + ' of notices are extracted correctly. At most ' + money(OBJ.batch_cost_per_1000) + ' per 1,000 correct notices at ' + money(OBJ.machine_rate_per_hour) + ' per machine-hour. The chat promise from Lab 2 still applies to the chat user.'],
        ['Systems to choose from', 'A: a GPU serving one request at a time. B: the same GPU serving four at once.'],
      ],
      questions: [
        { id: 'deadline', q: 'With four parallel workers, which systems finish the batch by the deadline?', options: [['first', 'A only (one at a time)'], ['second', 'B only (four at once)'], ['both', 'both'], ['neither', 'neither']] },
        { id: 'share', q: 'On System B, does the chat promise survive while the batch runs on the same server?', options: [['yes', 'yes, answers still start within ' + fmtMs(OBJ.chat_start_ms)], ['no', 'no, the chat user waits longer than that']] },
      ],
      measured() {
        const s = met('sys-b', 'mixed', 'chat_shared');
        return { deadline: which(met('sys-a', 'mixed', 'batch_deadline_4'), met('sys-b', 'mixed', 'batch_deadline_4')), share: s == null ? null : s ? 'yes' : 'no' };
      },
      matrix: ['batch_deadline_1', 'batch_deadline_4', 'batch_valid', 'batch_cost', 'chat_alone', 'chat_shared'],
      discuss: [
        'The batch cares about notices per minute and cost per correct notice. The chat user cares about the first words. Which system setting helped one and hurt the other?',
        'Some notices were extracted wrongly. How does that change the cost per useful result, and who finds out?',
        'Would you run both workloads on one server, or give each its own? What would you need to know about volume and price to decide?',
      ],
      reading() {
        const a = D('sys-a', 'mixed'), b = D('sys-b', 'mixed'), out = [];
        if (!a || !b) return out;
        const j = (d, ph) => d.jobs.find((x) => x.phase === ph);
        out.push('Four workers did nothing for System A: ' + fmtMs(j(a, 'batch-1').wall_ms) + ' with one worker and ' + fmtMs(j(a, 'batch-4').wall_ms) + ' with four, because the server still handled one request at a time. On System B the same change took the batch from ' + fmtMs(j(b, 'batch-1').wall_ms) + ' to ' + fmtMs(j(b, 'batch-4').wall_ms) + ', while each notice individually took longer (' + fmtMs(j(b, 'batch-1').per_notice_p50) + ' → ' + fmtMs(j(b, 'batch-4').per_notice_p50) + '). For a batch that is a good trade: nobody is waiting on a single notice.');
        out.push('Cost follows throughput and quality together. At the hypothetical machine price, System B with four workers cost ' + money(j(b, 'batch-4').cost_per_1000) + ' per 1,000 correct notices and System A ' + money(j(a, 'batch-4').cost_per_1000) + '. ' + j(b, 'batch-4').ok + ' of ' + j(b, 'batch-4').n + ' notices were right on B; every wrong one was paid for and produced nothing useful.');
        if (a.chat_shared && b.chat_shared) out.push('Sharing hurt the chat user on both systems. Alone, the worst wait for first words was ' + fmtMs(a.chat_alone.ttft_max) + ' on A and ' + fmtMs(b.chat_alone.ttft_max) + ' on B. While the batch ran it was ' + fmtMs(a.chat_shared.ttft_max) + ' on A and ' + fmtMs(b.chat_shared.ttft_max) + ' on B. The batch workers filled the slots, and each chat question had to wait for one to free up. Against the ' + fmtMs(OBJ.chat_start_ms) + ' target that was a ' + (rowOf(a, 'chat_shared').status === 'met' ? 'pass' : 'miss') + ' on A and a ' + (rowOf(b, 'chat_shared').status === 'met' ? 'pass' : 'miss') + ' on B, judged on only ' + b.chat_shared.n + ' questions.');
        out.push('This is why a latency-sensitive workload and a throughput workload are often given separate deployments, or the batch is held to off-peak hours, or the batch is capped below the server\'s capacity. Which of those is right depends on volumes and prices that this lab does not have.');
        out.push('Limits: one batch run per setting, ' + (b.chat_shared ? b.chat_shared.n : 'a few') + ' chat questions during the shared run, a hypothetical price. The comparison shows the direction of each effect on this laptop and no more.');
        return out;
      },
      why(d) {
        const out = ['Four workers only help if the server has four slots. With one slot the extra workers wait in line, and the batch takes as long as before.'];
        if (d.speedup != null) out.push('In this run, going from one worker to four changed the batch time by a factor of ' + times(d.speedup) + '.');
        out.push('A chat request arriving during the batch competes for the same slots. It waits until a notice finishes, then shares the hardware with the remaining workers.');
        return out;
      },
    },
  };
  function BATCH_N() { return String(Core.BATCH_SIZE); }
  const TAB_ORDER = ['setup', 'done', 'load', 'mixed', 'clinic'];
  const hasResult = (id) => !!(state.live[id] || state.revealed[id]);

  /* ---------- header ---------- */
  function renderChrome() {
    const b = document.getElementById('mode-banner');
    b.className = 'banner ' + (state.mode || 'none');
    b.replaceChildren();
    if (state.mode === 'live') {
      b.append(h('strong', { text: '● LIVE' }), 'Runs happen on this laptop against ' + state.base + ' with ' + state.model + '.');
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
        h('label', { class: 'field' }, 'Ollama address', h('input', { type: 'text', id: 'f-base', value: state.base, spellcheck: 'false', onchange: (e) => { state.base = e.target.value.trim() || Core.DEFAULT_BASE; save(); renderChrome(); } })),
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
          p('Needs Ollama running with ' + state.model + ' already downloaded, and this page opened through the kit\'s start script. The three labs take well under five minutes of compute in total.'),
          h('button', { class: 'btn', id: 'btn-live', onclick: choose('live') }, state.mode === 'live' ? 'Chosen' : 'Use live runs')),
        h('div', { class: 'path-card' + (state.mode === 'recorded' ? ' chosen' : '') },
          h('h3', { text: '▣ Recorded data' }),
          p(PROFILES.length ? 'Needs nothing but this page. The runs were captured on ' + when(reference.captured_at) + ' on the presenter\'s laptop (' + refShort + '). They are labelled RECORDED wherever they appear and are never mixed with live results.' : 'No recorded data file was found next to this page.'),
          h('button', { class: 'btn', id: 'btn-recorded', disabled: !PROFILES.length, onclick: choose('recorded') }, state.mode === 'recorded' ? 'Chosen' : 'Use recorded data'))
      )
    ));

    main.append(h('div', { class: 'card' },
      h('h2', null, h('span', { class: 'step-no', text: '3' }), 'Then'),
      p('Open Lab 1 and wait for the presenter. Each lab starts from a piece of customer work and a promise, then asks you to predict which system fits, measure or inspect real records, and decide.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', id: 'btn-export', onclick: exportResults, disabled: !Object.keys(state.live).length }, 'Download my live results (JSON)'),
        h('button', { class: 'btn', id: 'btn-reset', onclick: () => { if (confirm('Clear your predictions and live results on this laptop?')) { localStorage.removeItem(KEY); location.reload(); } } }, 'Reset this lab')
      ),
      recordedProvenance()
    ));
  }

  function recordedProvenance() {
    if (!PROFILES.length) return null;
    return h('details', null, h('summary', { text: 'Where the recorded data comes from' }),
      h('div', { class: 'inner' },
        table(['System', 'Captured', 'Machine', 'OS', 'Ollama', 'Model digest', 'Sample scale', 'Labs'],
          PROFILES.map((pr) => [pr.label, when(pr.captured_at), pr.hardware.chip + ' (' + pr.hardware.machine + '), ' + pr.hardware.ram_gb + ' GB, ' + pr.hardware.power, pr.hardware.os, pr.server.ollama_version, pr.model.digest.slice(0, 12), pr.scale + '× the live run', Object.keys(pr.results).join(', ')])),
        p('Each system is the unedited output of `tools/capture.mjs`, stored in `lab/data/recorded/`. All three are the same laptop and the same model, configured three ways. Treat the numbers as honest samples and not as a benchmark. See `lab/data/PROVENANCE.md`.', 'note')));
  }

  function exportResults() {
    const blob = new Blob([JSON.stringify({ kind: 'live', exported_at: new Date().toISOString(), base: state.base, model: state.model, setup: state.setupResult || null, predictions: state.pred, results: state.live }, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'workload-lab-live-results.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- labs ---------- */
  function recordedBlock(id) {
    const list = profilesFor(id);
    if (!list.length) return h('div', { class: 'alert info' }, 'No recorded run of this lab is included in the kit.');
    const pr = chosenProfile(id);
    const block = h('div', { class: 'result-block recorded', id: 'recorded-' + id },
      h('div', { class: 'row' },
        h('span', { class: 'source recorded', text: '▣ RECORDED · NOT THIS LAPTOP' }),
        h('span', { class: 'seg', role: 'group', 'aria-label': 'Recorded system' }, list.map((x) =>
          h('button', { 'aria-pressed': String(x.id === pr.id), onclick: () => { state.profile[id] = x.id; save(); render(); } }, x.label)))),
      h('div', { class: 'source-line' }, 'Captured ' + when(pr.captured_at) + ' on the presenter\'s laptop (' + pr.hardware.chip + ', ' + pr.hardware.ram_gb + ' GB). Ollama ' + pr.server.ollama_version + ', ' + pr.model.name + '. Server: ' + pr.server.note + '. ' + pr.scale + '× the samples of a live run.'));
    RENDER[id](block, Core.derive[id](pr.results[id]));
    return block;
  }

  function liveBlock(id) {
    const { result, meta } = state.live[id];
    const d = Core.derive[id](result);
    const block = h('div', { class: 'result-block live', id: 'live-' + id },
      h('div', { class: 'row' }, h('span', { class: 'source live', text: '● LIVE · THIS LAPTOP' })),
      h('div', { class: 'source-line' }, 'Measured ' + when(meta.finished_at) + ' against ' + meta.base + '. Ollama ' + (meta.ollama_version || '?') + ', ' + result.model + '. One run.'));
    RENDER[id](block, d);
    block.append(h('details', { id: 'why-live-' + id }, h('summary', { text: 'Why did it behave that way? (the mechanics)' }), h('div', { class: 'inner' }, LABS[id].why(d).map((t) => p(t)))));
    return block;
  }

  // Promise-by-system table: the answer to "which system fits?" at a glance.
  function matrix(id) {
    const lab = LABS[id], systems = profilesFor(id).map((pr) => ({ head: '▣ ' + pr.short, d: Core.derive[id](pr.results[id]) }));
    if (state.mode === 'live' && state.live[id]) systems.unshift({ head: '● Your laptop (live)', d: Core.derive[id](state.live[id].result) });
    const first = systems[0].d;
    return h('div', { id: 'matrix-' + id },
      h('h3', { text: 'Which system keeps which promise' }),
      table(['Promise (hypothetical)'].concat(systems.map((s) => s.head)),
        lab.matrix.map((rid) => [(rowOf(first, rid) || systems.map((s) => rowOf(s.d, rid)).find(Boolean) || { promise: rid }).promise].concat(systems.map((s) => {
          const r = rowOf(s.d, rid);
          return r ? h('span', null, badge(r), h('span', { class: 'cellnote', text: ' ' + (r.status === 'no-data' ? '' : r.kind === 'share' ? pctTxt(r.value) : r.kind === 'cost' ? money(r.value) : fmtMs(r.value)) })) : '–';
        }))), 'matrix'),
      p('▣ columns are recordings from the presenter\'s laptop.' + (state.mode === 'live' && state.live[id] ? ' The ● column is your own run, with fewer samples.' : '') + ' All targets are hypothetical and were set by the workshop author after trial runs, so that the systems land on different sides of them.', 'note'));
  }

  function errorBox(id, e) {
    const fixes = {
      unreachable: 'Check that Ollama is still running and that the address on the Setup tab is right. If this page was opened as a file, start it through the kit\'s start script instead.',
      model_missing: 'The model is not on this server. `ollama pull ' + state.model + '` needs internet access, so on the day use the recorded systems.',
      stream: 'The server stopped mid-answer. It may have run out of memory or been restarted. Try once more.',
      http: 'The server refused the request. The detail below is its own message.',
      aborted: 'You stopped the run. Nothing was saved from it.',
    };
    return h('div', { class: 'alert error', id: 'error-' + id },
      h('h3', { text: e.kind === 'aborted' ? 'Run stopped' : 'The live run did not finish' }),
      p((e.message || String(e)) + ' ' + (fixes[e.kind] || '')),
      e.detail ? h('pre', { text: e.detail }) : null,
      p('No partial result was kept, so nothing on this page is a half-measured number. You can still reveal the recorded systems below.', 'note'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { delete ui.errors[id]; startRun(id); } }, 'Try again')));
  }

  async function startRun(id) {
    if (ui.running) return;
    const ctl = new AbortController();
    ui.running = { id, ctl, t0: Date.now() };
    delete ui.errors[id];
    render();
    const bar = document.getElementById('run-bar'), lab = document.getElementById('run-label'), stream = document.getElementById('run-stream');
    try {
      let version = null;
      try { version = await Core.getVersion(cfg()); } catch (_) { /* the experiment will report the real error */ }
      const result = await Core.experiments[id](cfg(), {
        signal: ctl.signal,
        onStep: ({ i, n, label }) => {
          if (bar) bar.style.width = Math.round(((i - 1) / n) * 100) + '%';
          if (lab) lab.textContent = 'Step ' + i + ' of ' + n + ' · ' + label;
          if (stream) stream.textContent = '';
        },
        onToken: (_, text) => { if (stream) stream.textContent = text.slice(-420); },
      });
      result.wall_ms = Date.now() - ui.running.t0;
      state.live[id] = { result, meta: { finished_at: new Date().toISOString(), base: state.base, ollama_version: version } };
      save();
    } catch (e) {
      ui.errors[id] = e instanceof Core.LabError ? e : new Core.LabError('stream', String((e && e.message) || e));
    } finally {
      ui.running = null;
      render();
    }
  }

  function renderLab(main, id) {
    const lab = LABS[id];
    const pred = state.pred[id] || (state.pred[id] = { answers: {}, committed: false });
    const revealed = !!state.revealed[id] && pred.committed;
    const measured = revealed ? lab.measured() : {};
    let n = 0;
    const stepNo = () => h('span', { class: 'step-no', text: String(++n) });

    main.append(h('div', { class: 'card', id: 'brief-' + id },
      h('h1', null, lab.title, ' ', h('span', { class: 'time-chip', text: lab.clock })),
      h('dl', { class: 'chain' }, lab.chain.map(([k, v]) => [h('dt', { text: k }), h('dd', null, rich(v))])),
      p('Every promise on this page is hypothetical: written for this workshop and sized for a laptop running a 1.5-billion-parameter model.', 'note')));

    /* predict */
    main.append(h('div', { class: 'card', id: 'predict-' + id },
      h('h2', null, stepNo(), 'Predict which system fits'),
      p('Commit before you see any numbers. The systems are described above; you will check your answers against their recordings.', 'muted'),
      lab.questions.map((q) => h('fieldset', { class: 'q', disabled: pred.committed },
        h('legend', { text: q.q }),
        q.options.map(([v, label]) => h('label', null,
          h('input', { type: 'radio', name: id + '-' + q.id, value: v, checked: pred.answers[q.id] === v, onchange: () => { pred.answers[q.id] = v; save(); const b = document.getElementById('btn-commit-' + id); if (b) b.disabled = !lab.questions.every((x) => pred.answers[x.id]); } }), label)),
        revealed ? h('div', { class: 'verdict' },
          'You predicted: ', h('b', { text: pred.answers[q.id] ? q.options.find((o) => o[0] === pred.answers[q.id])[1] : 'no answer' }), '. ',
          'In the recorded runs: ', h('b', { text: measured[q.id] ? q.options.find((o) => o[0] === measured[q.id])[1] : 'not determined' }), '.') : null)),
      pred.committed
        ? h('div', { class: 'row' }, h('span', { class: 'muted', text: pred.skipped ? 'Prediction skipped.' : 'Prediction locked in.' }), !revealed && !state.live[id] ? h('button', { class: 'link', onclick: () => { pred.committed = false; pred.skipped = false; save(); render(); } }, 'change it') : null)
        : h('div', { class: 'row' },
          h('button', { class: 'btn primary', id: 'btn-commit-' + id, disabled: !lab.questions.every((q) => pred.answers[q.id]), onclick: () => { pred.committed = true; save(); render(); } }, 'Lock in my prediction'),
          h('button', { class: 'link', id: 'btn-skip-' + id, onclick: () => { pred.committed = true; pred.skipped = true; save(); render(); } }, 'skip the prediction'))));

    if (!state.mode) {
      main.append(h('div', { class: 'card' }, h('h2', null, stepNo(), 'Measure'), p('Choose a path first.'), h('button', { class: 'btn', onclick: () => go('setup') }, 'Go to Setup')));
      return;
    }

    /* measure on this laptop (live path) */
    if (state.mode === 'live') {
      const run = h('div', { class: 'card', id: 'run-' + id }, h('h2', null, stepNo(), 'Measure your own laptop against the promises'));
      if (!pred.committed) run.append(p('Locked until you commit a prediction above.', 'muted'));
      else if (ui.running && ui.running.id === id) {
        run.append(h('div', { id: 'run-label', class: 'muted', text: 'Starting…' }), h('div', { class: 'progress' }, h('div', { id: 'run-bar' })),
          h('pre', { class: 'stream', id: 'run-stream', 'aria-live': 'off' }), h('button', { class: 'btn', id: 'btn-stop', onclick: () => ui.running && ui.running.ctl.abort() }, 'Stop'));
      } else {
        run.append(p('Plays the work described above against ' + state.base + '. Expect ' + lab.runtime + '. Your laptop is a fourth system: the promises were not sized for it, so a miss is a finding, not a fault.'),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', id: 'btn-run-' + id, onclick: () => startRun(id) }, state.live[id] ? 'Run again (replaces your result)' : 'Run on this laptop')));
        if (ui.errors[id]) run.append(errorBox(id, ui.errors[id]));
        if (state.live[id]) run.append(liveBlock(id));
      }
      main.append(run);
    }

    /* reveal the recorded reference systems */
    const rec = h('div', { class: 'card', id: 'reveal-' + id }, h('h2', null, stepNo(), state.mode === 'live' ? 'Reveal the reference systems' : 'Inspect the recorded systems'));
    if (!pred.committed) rec.append(p('Locked until you commit a prediction above.', 'muted'));
    else if (!state.revealed[id]) {
      rec.append(p('These are runs captured earlier on the presenter\'s laptop, configured ' + profilesFor(id).length + ' ways. They are not measurements of your laptop.'),
        h('button', { class: 'btn primary', id: 'btn-reveal-' + id, disabled: !profilesFor(id).length || (ui.running && ui.running.id === id), onclick: () => { state.revealed[id] = true; save(); render(); } }, 'Reveal recorded systems'));
    } else {
      rec.append(matrix(id), recordedBlock(id));
      const pr = chosenProfile(id);
      rec.append(h('details', { id: 'why-' + id }, h('summary', { text: 'Why did it behave that way? (the mechanics)' }), h('div', { class: 'inner' }, LABS[id].why(Core.derive[id](pr.results[id])).map((t) => p(t)))));
    }
    main.append(rec);

    /* decide */
    if (revealed) {
      main.append(h('div', { class: 'card', id: 'interpret-' + id },
        h('h2', null, stepNo(), 'Decide'),
        p('Talk these through with the person next to you. Three minutes.', 'muted'),
        h('ol', null, lab.discuss.map((q) => h('li', null, rich(q)))),
        h('details', { id: 'reading-' + id }, h('summary', { text: 'One reading of these results (open after you have talked)' }),
          h('div', { class: 'inner' }, p('Based on the recorded systems, not on this laptop.', 'note'), lab.reading().map((t) => p(t))))));
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
      p('A faster model server helps only where the model server is what stands between the work and the promise. The labs showed one case where it was (queueing in Lab 2) and one where it mostly was not (tool waits and invalid tool calls in Lab 1).', 'note')));
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
})();
