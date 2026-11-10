/* Small dependency-free SVG charts shared by the lab and the slides. */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const W = 720;

  function svg(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function html(tag, cls, text, parent) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function fmtMs(ms) {
    if (ms == null || !isFinite(ms)) return '–';
    if (ms >= 10000) return (ms / 1000).toFixed(1) + ' s';
    if (ms >= 1000) return (ms / 1000).toFixed(2) + ' s';
    if (ms >= 100) return Math.round(ms) + ' ms';
    return (Math.round(ms * 10) / 10) + ' ms';
  }

  function niceTicks(max, count) {
    if (!(max > 0)) return [0, 1];
    const raw = max / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    const ticks = [];
    for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  let tip;
  function showTip(evt, lines) {
    if (!tip) tip = html('div', 'viz-tip', null, document.body);
    tip.innerHTML = '';
    lines.forEach((l, i) => html('div', i === 0 ? 'viz-tip-head' : 'viz-tip-row', l, tip));
    tip.style.display = 'block';
    const pad = 12;
    const r = tip.getBoundingClientRect();
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + r.width > window.innerWidth - 4) x = evt.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 4) y = evt.clientY - r.height - pad;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top = Math.max(4, y) + 'px';
  }
  function hideTip() {
    if (tip) tip.style.display = 'none';
  }

  function legend(parent, series) {
    if (series.length < 2) return;
    const box = html('div', 'viz-legend', null, parent);
    for (const s of series) {
      const item = html('span', 'viz-legend-item', null, box);
      const sw = html('span', 'viz-swatch', null, item);
      sw.style.background = s.color;
      html('span', null, s.label, item);
    }
  }

  // Right end rounded (the data end); left end square (the baseline side).
  function barPath(x, y, w, h, roundRight) {
    const r = roundRight ? Math.min(4, w, h / 2) : 0;
    return 'M' + x + ',' + y + 'h' + (w - r) + (r ? 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r : '') +
      'v' + (h - 2 * r) + (r ? 'a' + r + ',' + r + ' 0 0 1 ' + -r + ',' + r : '') + 'h' + -(w - r) + 'z';
  }

  /**
   * Horizontal stacked bars on a shared time axis.
   * opts: { title, rows: [{ label, offset?, segments: [{key, value}], end? }], series: [{key,label,color}], xMax? }
   */
  function bars(el, opts) {
    const root0 = html('figure', 'viz', null, el);
    if (opts.title) html('figcaption', 'viz-title', opts.title, root0);
    legend(root0, opts.series);
    const rows = opts.rows;
    const left = opts.labelWidth || 170, right = 78, top = opts.target ? 22 : 6, rowH = 32, barH = 18, axisH = 26;
    const H = top + rows.length * rowH + axisH;
    const total = (r) => (r.offset || 0) + r.segments.reduce((s, g) => s + (g.value || 0), 0);
    const ticks = niceTicks(Math.max(opts.xMax || 0, ...rows.map(total), opts.target ? opts.target.value * 1.05 : 0, 1e-9), 5);
    const xMax = ticks[ticks.length - 1];
    const plotW = W - left - right;
    const x = (v) => left + (v / xMax) * plotW;
    const s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.title || 'bar chart' }, root0);

    for (const t of ticks) {
      svg('line', { x1: x(t), x2: x(t), y1: top, y2: top + rows.length * rowH, class: t === 0 ? 'viz-axis' : 'viz-grid' }, s);
      const lab = svg('text', { x: x(t), y: H - 8, class: 'viz-tick', 'text-anchor': 'middle' }, s);
      lab.textContent = fmtMs(t);
    }
    rows.forEach((r, i) => {
      const y = top + i * rowH + (rowH - barH) / 2;
      const lab = svg('text', { x: left - 10, y: y + barH / 2 + 4, class: 'viz-label', 'text-anchor': 'end' }, s);
      lab.textContent = r.label;
      let cursor = r.offset || 0;
      const live = r.segments.filter((g) => g.value > 0);
      live.forEach((g, j) => {
        const ser = opts.series.find((z) => z.key === g.key);
        const lastSeg = j === live.length - 1;
        const x0 = x(cursor);
        let w = Math.max(1.5, x(cursor + g.value) - x0);
        if (!lastSeg && w > 4) w -= 2; // surface gap between touching segments
        svg('path', { d: barPath(x0, y, w, barH, lastSeg), fill: ser.color }, s);
        const hit = svg('rect', { x: x0, y: top + i * rowH, width: Math.max(w, 6), height: rowH, fill: 'transparent' }, s);
        const lines = [r.label, ser.label + ': ' + fmtMs(g.value)];
        if (r.offset) lines.push('started at ' + fmtMs(r.offset));
        hit.addEventListener('mousemove', (e) => showTip(e, lines));
        hit.addEventListener('mouseleave', hideTip);
        cursor += g.value;
      });
      const end = svg('text', { x: x(cursor) + 8, y: y + barH / 2 + 4, class: 'viz-value' }, s);
      end.textContent = r.end != null ? r.end : fmtMs(total(r) - (r.offset || 0));
    });
    if (opts.target) {
      svg('line', { x1: x(opts.target.value), x2: x(opts.target.value), y1: top - 4, y2: top + rows.length * rowH, class: 'viz-target' }, s);
      const tl = svg('text', { x: x(opts.target.value), y: 12, class: 'viz-target-label', 'text-anchor': 'middle' }, s);
      tl.textContent = opts.target.label;
    }
    return root0;
  }

  /**
   * Line chart over ordered categories.
   * opts: { title, xLabel, categories: [..], series: [{key,label,color,values:[..]}] }
   */
  function lines(el, opts) {
    const root0 = html('figure', 'viz', null, el);
    if (opts.title) html('figcaption', 'viz-title', opts.title, root0);
    legend(root0, opts.series);
    const left = 64, right = 150, top = 12, H = 280, bottom = 44;
    const plotW = W - left - right, plotH = H - top - bottom;
    const all = opts.series.flatMap((z) => z.values).filter((v) => v != null);
    const ticks = niceTicks(Math.max(...all, opts.target ? opts.target.value * 1.05 : 0, 1e-9), 4);
    const yMax = ticks[ticks.length - 1];
    const n = opts.categories.length;
    const x = (i) => left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = (v) => top + plotH - (v / yMax) * plotH;
    const s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.title || 'line chart' }, root0);

    for (const t of ticks) {
      svg('line', { x1: left, x2: left + plotW, y1: y(t), y2: y(t), class: t === 0 ? 'viz-axis' : 'viz-grid' }, s);
      const lab = svg('text', { x: left - 8, y: y(t) + 4, class: 'viz-tick', 'text-anchor': 'end' }, s);
      lab.textContent = fmtMs(t);
    }
    opts.categories.forEach((c, i) => {
      const lab = svg('text', { x: x(i), y: H - bottom + 18, class: 'viz-tick', 'text-anchor': 'middle' }, s);
      lab.textContent = c;
    });
    if (opts.xLabel) {
      const xl = svg('text', { x: left + plotW / 2, y: H - 6, class: 'viz-tick', 'text-anchor': 'middle' }, s);
      xl.textContent = opts.xLabel;
    }
    if (opts.target) {
      svg('line', { x1: left, x2: left + plotW, y1: y(opts.target.value), y2: y(opts.target.value), class: 'viz-target' }, s);
      const tl = svg('text', { x: left + 6, y: y(opts.target.value) - 6, class: 'viz-target-label' }, s);
      tl.textContent = opts.target.label;
    }
    const cross = svg('line', { y1: top, y2: top + plotH, class: 'viz-cross', visibility: 'hidden' }, s);
    for (const z of opts.series) {
      const pts = z.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
      svg('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(''), fill: 'none', stroke: z.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, s);
      for (const p of pts) svg('circle', { cx: p[0], cy: p[1], r: 4, fill: z.color, class: 'viz-dot' }, s);
    }
    // End labels: series that finish within 16px of each other share one label instead of colliding.
    const ends = opts.series
      .map((z) => ({ z, v: z.values[z.values.length - 1] }))
      .filter((e) => e.v != null)
      .sort((a, b) => b.v - a.v);
    const groups = [];
    for (const e of ends) {
      const g = groups[groups.length - 1];
      if (g && Math.abs(y(g.v) - y(e.v)) < 16) g.items.push(e);
      else groups.push({ v: e.v, items: [e] });
    }
    for (const g of groups) {
      const lab = svg('text', { x: left + plotW + 10, y: y(g.v) + 4, class: 'viz-value' }, s);
      lab.textContent = g.items.map((e) => e.z.short || e.z.label).join(' ≈ ') + '  ' + fmtMs(g.items[0].v);
    }
    opts.categories.forEach((c, i) => {
      const half = n === 1 ? plotW / 2 : plotW / (n - 1) / 2;
      const hit = svg('rect', { x: x(i) - half, y: top, width: half * 2, height: plotH, fill: 'transparent' }, s);
      hit.addEventListener('mousemove', (e) => {
        cross.setAttribute('x1', x(i));
        cross.setAttribute('x2', x(i));
        cross.setAttribute('visibility', 'visible');
        showTip(e, [(opts.xLabel ? opts.xLabel + ' ' : '') + c].concat(opts.series.map((z) => z.label + ': ' + fmtMs(z.values[i]))));
      });
      hit.addEventListener('mouseleave', () => {
        cross.setAttribute('visibility', 'hidden');
        hideTip();
      });
    });
    return root0;
  }

  const COLORS = { blue: 'var(--series-1)', orange: 'var(--series-2)', aqua: 'var(--series-3)' };

  root.Charts = { bars, lines, fmtMs, COLORS };
})(window);
