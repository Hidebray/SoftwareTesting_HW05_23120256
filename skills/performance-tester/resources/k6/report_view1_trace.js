/**
 * k6 Adapter — Report View 1: Per-Group & Assertion Check Trace HTML
 * (Equivalent to JMeter "View Results Tree" assertion/flow breakdown)
 *
 * Self-contained offline HTML report (zero external CDN dependencies).
 * Usage inside k6 `handleSummary(data)`:
 *   import { buildTraceHtmlReport } from '../skills/performance-tester/resources/k6/report_view1_trace.js';
 *   export function handleSummary(data) {
 *     return { 'html-reports/load-trace-report/index.html': buildTraceHtmlReport(data, { title: '...' }) };
 *   }
 */

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(val, digits = 2) {
  if (val === undefined || val === null || Number.isNaN(Number(val))) return "-";
  return Number(val).toFixed(digits);
}

function collectGroups(group, prefix = "") {
  const rows = [];
  const fullName = group.name ? (prefix ? `${prefix} > ${group.name}` : group.name) : (prefix || "Root");
  if (Array.isArray(group.checks) && group.checks.length > 0) {
    for (const c of group.checks) {
      const total = (c.passes || 0) + (c.fails || 0);
      const pct = total > 0 ? (c.passes / total) * 100 : 100;
      rows.push({
        group: fullName,
        check: c.name,
        passes: c.passes || 0,
        fails: c.fails || 0,
        total,
        pct,
      });
    }
  }
  if (Array.isArray(group.groups)) {
    for (const sub of group.groups) {
      rows.push(...collectGroups(sub, fullName === "Root" ? "" : fullName));
    }
  }
  return rows;
}

export function buildTraceHtmlReport(data, meta = {}) {
  const title = meta.title || "k6 Performance Report — View 1: Per-Group & Check Trace";
  const scenario = meta.scenario || "Load Test";
  const workflow = meta.workflow || "End-to-End API Workflow";
  const generatedAt = new Date().toISOString();

  const metrics = data.metrics || {};
  const httpReqs = metrics.http_reqs?.values?.count || 0;
  const rps = metrics.http_reqs?.values?.rate || 0;
  const httpDur = metrics.http_req_duration?.values || {};
  const iterDur = metrics.iteration_duration?.values || {};
  const iters = metrics.iterations?.values?.count || 0;
  const failedRate = (metrics.http_req_failed?.values?.rate || 0) * 100;
  const checksRate = (metrics.checks?.values?.rate || 0) * 100;

  const checkRows = collectGroups(data.root_group || {});
  const thresholds = [];
  for (const [mName, mObj] of Object.entries(metrics)) {
    if (mObj.thresholds) {
      for (const [expr, res] of Object.entries(mObj.thresholds)) {
        thresholds.push({ metric: mName, expression: expr, ok: Boolean(res.ok) });
      }
    }
  }

  const customCounters = Object.entries(metrics)
    .filter(([k, v]) => v.type === "counter" && !["http_reqs", "iterations", "data_sent", "data_received"].includes(k))
    .map(([k, v]) => ({ name: k, count: v.values?.count || 0, rate: v.values?.rate || 0 }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px; }
  .wrap { max-width: 1180px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 6px; color: #f8fafc; }
  h2 { font-size: 16px; margin: 24px 0 10px; color: #93c5fd; border-bottom: 1px solid #334155; padding-bottom: 6px; }
  .meta { font-size: 13px; color: #94a3b8; margin-bottom: 18px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px; }
  .card .lbl { font-size: 12px; color: #94a3b8; }
  .card .val { font-size: 22px; font-weight: 700; margin-top: 4px; color: #f8fafc; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; font-size: 13px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #334155; text-align: left; }
  th { background: #0b1220; color: #cbd5e1; font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .pass { background: #064e3b; color: #6ee7b7; }
  .fail { background: #7f1d1d; color: #fca5a5; }
  .bar-bg { width: 110px; height: 8px; background: #334155; border-radius: 4px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 6px; }
  .bar-fill { height: 100%; background: #10b981; }
  .bar-fill.warn { background: #f59e0b; }
  .bar-fill.err { background: #ef4444; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${esc(title)}</h1>
  <div class="meta">Scenario: <b>${esc(scenario)}</b> &bull; Workflow: <b>${esc(workflow)}</b> &bull; Generated: ${esc(generatedAt)} &bull; View Type: <b>View 1 (Per-Group &amp; Assertion Trace)</b></div>

  <div class="cards">
    <div class="card"><div class="lbl">Total HTTP Requests</div><div class="val">${httpReqs.toLocaleString()}</div></div>
    <div class="card"><div class="lbl">Completed Iterations</div><div class="val">${iters.toLocaleString()}</div></div>
    <div class="card"><div class="lbl">Throughput (RPS)</div><div class="val">${fmt(rps)} /s</div></div>
    <div class="card"><div class="lbl">HTTP p95 Latency</div><div class="val">${fmt(httpDur["p(95)"])} ms</div></div>
    <div class="card"><div class="lbl">Check Pass Rate</div><div class="val">${fmt(checksRate)}%</div></div>
    <div class="card"><div class="lbl">Unexpected Error Rate</div><div class="val">${fmt(failedRate)}%</div></div>
  </div>

  <h2>1. Per-Group Assertion &amp; Check Trace</h2>
  <table>
    <thead>
      <tr>
        <th>Group</th>
        <th>Assertion Check</th>
        <th class="num">Passed</th>
        <th class="num">Failed</th>
        <th class="num">Pass Rate</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${checkRows.length === 0 ? `<tr><td colspan="6">No checks recorded.</td></tr>` : checkRows.map(r => {
        const barCls = r.pct === 100 ? "" : r.pct >= 90 ? "warn" : "err";
        return `<tr>
          <td><code>${esc(r.group)}</code></td>
          <td>${esc(r.check)}</td>
          <td class="num">${r.passes.toLocaleString()}</td>
          <td class="num">${r.fails.toLocaleString()}</td>
          <td class="num"><span class="bar-bg"><span class="bar-fill ${barCls}" style="width:${fmt(r.pct, 1)}%"></span></span>${fmt(r.pct, 2)}%</td>
          <td><span class="badge ${r.fails === 0 ? "pass" : "fail"}">${r.fails === 0 ? "PASS" : "FAIL"}</span></td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>

  <h2>2. Thresholds Gate Evaluation</h2>
  <table>
    <thead><tr><th>Metric</th><th>Threshold Rule</th><th>Result</th></tr></thead>
    <tbody>
      ${thresholds.length === 0 ? `<tr><td colspan="3">No thresholds configured.</td></tr>` : thresholds.map(t => `
        <tr>
          <td><code>${esc(t.metric)}</code></td>
          <td><code>${esc(t.expression)}</code></td>
          <td><span class="badge ${t.ok ? "pass" : "fail"}">${t.ok ? "PASSED" : "BREACHED"}</span></td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <h2>3. Timing &amp; Custom Diagnostic Counters</h2>
  <table>
    <thead><tr><th>Metric</th><th class="num">Value</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td><code>http_req_duration</code> (avg / p95 / max)</td><td class="num">${fmt(httpDur.avg)} / ${fmt(httpDur["p(95)"])} / ${fmt(httpDur.max)} ms</td><td>Pure HTTP request latency (excludes think-time)</td></tr>
      <tr><td><code>iteration_duration</code> (avg / p95 / max)</td><td class="num">${fmt(iterDur.avg)} / ${fmt(iterDur["p(95)"])} / ${fmt(iterDur.max)} ms</td><td>Full end-to-end user journey (includes think-time)</td></tr>
      ${customCounters.map(c => `<tr><td><code>${esc(c.name)}</code></td><td class="num">${c.count.toLocaleString()} (${fmt(c.rate)}/s)</td><td>Custom diagnostic counter</td></tr>`).join("")}
    </tbody>
  </table>
</div>
</body>
</html>`;
}
