/**
 * k6 Adapter — Report View 3: Aggregate Percentile Distribution Matrix HTML
 * (Equivalent to JMeter "Aggregate Report" with inline SVG percentile visualization)
 *
 * Self-contained offline HTML report (zero external CDN dependencies).
 * Reads standard `http_req_duration` + any custom Trend metrics named `ep_*` or `grp_*`.
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

export function buildAggregateHtmlReport(data, meta = {}) {
  const title = meta.title || "k6 Performance Report — View 3: Aggregate Percentile Matrix";
  const scenario = meta.scenario || "Spike Test";
  const workflow = meta.workflow || "End-to-End API Workflow";
  const generatedAt = new Date().toISOString();

  const metrics = data.metrics || {};
  const trendRows = [];

  for (const [key, m] of Object.entries(metrics)) {
    if (m.type !== "trend") continue;
    const isCore = key === "http_req_duration" || key === "iteration_duration";
    const isCustom = key.startsWith("ep_") || key.startsWith("grp_") || key.includes("{");
    if (!isCore && !isCustom) continue;

    const v = m.values || {};
    trendRows.push({
      label: key,
      min: v.min ?? 0,
      avg: v.avg ?? 0,
      med: v.med ?? 0,
      p90: v["p(90)"] ?? 0,
      p95: v["p(95)"] ?? 0,
      p99: v["p(99)"] ?? v.max ?? 0,
      max: v.max ?? 0,
    });
  }

  // Sort: http_req_duration first, then grp_*, then ep_*, then iteration_duration
  trendRows.sort((a, b) => {
    const rank = (s) => (s === "http_req_duration" ? 0 : s.startsWith("grp_") ? 1 : s.startsWith("ep_") ? 2 : s === "iteration_duration" ? 4 : 3);
    return rank(a.label) - rank(b.label) || a.label.localeCompare(b.label);
  });

  const chartRows = trendRows.filter((r) => r.label !== "iteration_duration");
  const maxP95 = Math.max(10, ...chartRows.map((r) => r.p95));

  const httpReqs = metrics.http_reqs?.values?.count || 0;
  const rps = metrics.http_reqs?.values?.rate || 0;
  const errPct = (metrics.http_req_failed?.values?.rate || 0) * 100;
  const dataRxMb = (metrics.data_received?.values?.count || 0) / (1024 * 1024);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
  .wrap { max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 6px; color: #0f172a; }
  h2 { font-size: 16px; margin: 24px 0 10px; color: #1d4ed8; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  .meta { font-size: 13px; color: #475569; margin-bottom: 18px; }
  .kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; box-shadow: 0 1px 2px rgba(15,23,42,0.04); }
  .box .k { font-size: 12px; color: #64748b; }
  .box .v { font-size: 22px; font-weight: 700; margin-top: 4px; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; font-size: 13px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  th { background: #1e293b; color: #f8fafc; font-weight: 600; }
  tr:nth-child(even) td { background: #f8fafc; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .p95 { font-weight: 700; color: #b45309; }
  .chart { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; }
  .bar-row { display: grid; grid-template-columns: 230px 1fr 90px; align-items: center; gap: 12px; margin: 8px 0; font-size: 12px; }
  .track { background: #e2e8f0; height: 14px; border-radius: 7px; position: relative; overflow: hidden; }
  .fill-p95 { background: #f59e0b; height: 100%; position: absolute; left: 0; top: 0; border-radius: 7px; }
  .fill-p50 { background: #2563eb; height: 100%; position: absolute; left: 0; top: 0; border-radius: 7px; }
  .legend { font-size: 12px; color: #475569; margin-bottom: 10px; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: middle; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${esc(title)}</h1>
  <div class="meta">Scenario: <b>${esc(scenario)}</b> &bull; Workflow: <b>${esc(workflow)}</b> &bull; Generated: ${esc(generatedAt)} &bull; View Type: <b>View 3 (Aggregate Percentile Distribution)</b></div>

  <div class="kpi">
    <div class="box"><div class="k">Total Samples (HTTP Reqs)</div><div class="v">${httpReqs.toLocaleString()}</div></div>
    <div class="box"><div class="k">Aggregate Throughput</div><div class="v">${fmt(rps)} req/s</div></div>
    <div class="box"><div class="k">Unexpected Error Rate</div><div class="v">${fmt(errPct)}%</div></div>
    <div class="box"><div class="k">Total Data Received</div><div class="v">${fmt(dataRxMb)} MB</div></div>
  </div>

  <h2>1. Aggregate Latency Distribution Matrix (ms)</h2>
  <table>
    <thead>
      <tr>
        <th>Metric / Endpoint / Group</th>
        <th class="num">Min</th>
        <th class="num">Average</th>
        <th class="num">Median (p50)</th>
        <th class="num">90% Line</th>
        <th class="num">95% Line</th>
        <th class="num">99% / Tail</th>
        <th class="num">Max</th>
      </tr>
    </thead>
    <tbody>
      ${trendRows.map(r => `
        <tr>
          <td><code>${esc(r.label)}</code></td>
          <td class="num">${fmt(r.min)}</td>
          <td class="num">${fmt(r.avg)}</td>
          <td class="num">${fmt(r.med)}</td>
          <td class="num">${fmt(r.p90)}</td>
          <td class="num p95">${fmt(r.p95)}</td>
          <td class="num">${fmt(r.p99)}</td>
          <td class="num">${fmt(r.max)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <h2>2. Visual Percentile Comparison (Median p50 vs. 95th Percentile)</h2>
  <div class="chart">
    <div class="legend">
      <span class="dot" style="background:#2563eb"></span>Median (p50) &nbsp;&nbsp;
      <span class="dot" style="background:#f59e0b"></span>95th Percentile (p95)
    </div>
    ${chartRows.map(r => {
      const w95 = Math.min(100, (r.p95 / maxP95) * 100);
      const w50 = Math.min(100, (r.med / maxP95) * 100);
      return `<div class="bar-row">
        <div><code>${esc(r.label)}</code></div>
        <div class="track">
          <div class="fill-p95" style="width:${fmt(w95, 1)}%"></div>
          <div class="fill-p50" style="width:${fmt(w50, 1)}%"></div>
        </div>
        <div class="num">${fmt(r.p95)} ms</div>
      </div>`;
    }).join("")}
  </div>
</div>
</body>
</html>`;
}

