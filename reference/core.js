/*
 * Transport for the workload-first inference workshop: one timed, streamed request
 * to a local Ollama server, plus small server queries. The workloads, service
 * indicators and scorecards live in workloads.js.
 *
 * Used by the browser lab (lab/index.html) and by tools/capture.mjs.
 */
(function (root) {
  'use strict';

  const CORE_VERSION = '2.0.0';
  const DEFAULT_MODEL = 'qwen2.5:1.5b';
  const DEFAULT_BASE = 'http://127.0.0.1:11434';
  // Fixed in every request so the server never reloads the model mid-workshop.
  const BASE_OPTIONS = { temperature: 0, seed: 7, num_ctx: 4096 };
  const KEEP_ALIVE = '30m';

  class LabError extends Error {
    constructor(kind, message, detail) {
      super(message);
      this.name = 'LabError';
      this.kind = kind; // unreachable | model_missing | http | stream | aborted
      this.detail = detail || '';
    }
  }

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const nonce = () => Math.random().toString(16).slice(2, 8).padStart(6, '0');
  const round = (x, d = 1) => (x == null || !isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
  const nsToMs = (ns) => (typeof ns === 'number' ? ns / 1e6 : null);

  function median(xs) {
    const v = xs.filter((x) => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  function cleanBase(base) {
    return String(base || DEFAULT_BASE).trim().replace(/\/+$/, '');
  }

  async function http(cfg, path, init) {
    let res;
    try {
      res = await fetch(cleanBase(cfg.base) + path, init);
    } catch (err) {
      if (err && err.name === 'AbortError') throw new LabError('aborted', 'Stopped.');
      throw new LabError(
        'unreachable',
        'Cannot reach the Ollama server at ' + cleanBase(cfg.base) + '.',
        String((err && err.message) || err)
      );
    }
    if (!res.ok) {
      let msg = '';
      try {
        msg = (await res.json()).error || '';
      } catch (_) {
        /* body was not JSON */
      }
      if (res.status === 404 && /not found/i.test(msg)) {
        throw new LabError('model_missing', 'Model "' + cfg.model + '" is not installed on this server.', msg);
      }
      throw new LabError('http', 'The server answered HTTP ' + res.status + '.', msg);
    }
    return res;
  }

  /** One streamed chat request, timed on the client and annotated with the server's own counters. */
  async function chat(cfg, req) {
    const body = {
      model: cfg.model,
      messages: req.messages,
      stream: true,
      keep_alive: KEEP_ALIVE,
      options: Object.assign({}, BASE_OPTIONS, cfg.extraOptions || {}, req.options || {}),
    };
    const startedAt = new Date().toISOString();
    const t0 = now();
    const res = await http(cfg, '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let text = '';
    let tFirst = null;
    let final = null;
    const handle = (line) => {
      if (!line.trim()) return;
      const msg = JSON.parse(line);
      if (msg.error) throw new LabError('stream', 'The server reported an error mid-stream.', msg.error);
      const piece = (msg.message && msg.message.content) || '';
      if (piece) {
        if (tFirst === null) tFirst = now();
        text += piece;
        if (req.onToken) req.onToken(piece, text);
      }
      if (msg.done) final = msg;
    };
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          handle(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
        }
      }
      handle(buf);
    } catch (err) {
      if (err instanceof LabError) throw err;
      if (err && err.name === 'AbortError') throw new LabError('aborted', 'Stopped.');
      throw new LabError('stream', 'The response stream broke before it finished.', String((err && err.message) || err));
    }
    const tEnd = now();
    if (!final) throw new LabError('stream', 'The response ended without a final record.', '');

    const raw = Object.assign({}, final);
    delete raw.message;
    const cached = typeof final.prompt_eval_cached_count === 'number' ? final.prompt_eval_cached_count : null;
    return {
      label: req.label || '',
      tags: req.tags || {},
      started_at: startedAt,
      client: {
        offset_ms: req.epoch != null ? round(t0 - req.epoch) : 0,
        ttft_ms: round((tFirst === null ? tEnd : tFirst) - t0),
        total_ms: round(tEnd - t0),
      },
      server: {
        load_ms: round(nsToMs(final.load_duration)),
        prompt_tokens: final.prompt_eval_count == null ? null : final.prompt_eval_count,
        cached_tokens: cached, // null when this Ollama version does not report it
        prefill_ms: round(nsToMs(final.prompt_eval_duration)),
        output_tokens: final.eval_count == null ? null : final.eval_count,
        decode_ms: round(nsToMs(final.eval_duration)),
        total_ms: round(nsToMs(final.total_duration)),
      },
      done_reason: final.done_reason || '',
      text,
      raw_final: raw,
    };
  }

  async function getVersion(cfg) {
    return (await (await http(cfg, '/api/version')).json()).version;
  }
  async function listModels(cfg) {
    return ((await (await http(cfg, '/api/tags')).json()).models || []).map((m) => ({
      name: m.name,
      digest: m.digest,
      size: m.size,
      details: m.details || {},
    }));
  }
  async function loadedModels(cfg) {
    return ((await (await http(cfg, '/api/ps')).json()).models || []).map((m) => ({
      name: m.name,
      size: m.size,
      size_vram: m.size_vram,
      context_length: m.context_length,
    }));
  }
  function hasModel(models, name) {
    return models.some((m) => m.name === name || m.name === name + ':latest');
  }

  async function unload(cfg) {
    await http(cfg, '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, keep_alive: 0 }),
    });
    for (let i = 0; i < 40; i++) {
      const up = await loadedModels(cfg);
      if (!hasModel(up, cfg.model)) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  }

  async function warm(cfg, signal) {
    return chat(cfg, {
      label: 'warm-up',
      messages: [{ role: 'user', content: 'Reply with OK.' }],
      options: { num_predict: 1 },
      signal,
    });
  }

  const Core = {
    CORE_VERSION, DEFAULT_MODEL, DEFAULT_BASE, BASE_OPTIONS, LabError,
    chat, getVersion, listModels, loadedModels, hasModel, unload, warm,
    median, round, now, nonce,
  };

  root.LabCore = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof globalThis !== 'undefined' ? globalThis : this);
