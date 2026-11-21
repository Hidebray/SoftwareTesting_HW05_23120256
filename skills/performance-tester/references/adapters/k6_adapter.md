# Tool Adapter: Grafana k6

Load this adapter during **Phase 3 (Implementation)** and **Phase 4 (Execution)** when the chosen load-testing tool is **Grafana k6** (`k6 >= v0.49` / `v2.x`).

---

## 1. Idiomatic k6 Implementation Standards

1. **Zero-Waste CSV Data-Driven Loading (`SharedArray`):**
   - Always load CSV files inside `new SharedArray(...)` during init context so memory is shared across VUs rather than duplicated per VU.
   - Use a lightweight zero-dependency CSV parser (trimming `\r\n` and skipping empty lines) so scripts run offline without npm bundles.
2. **Clean Scenario Shaping (`options.stages` or `options.scenarios`):**
   - **Load:** `stages: [{ duration: '30s', target: 20 }, { duration: '2m', target: 20 }, { duration: '30s', target: 0 }]`
   - **Stress:** Stepwise stages ramping past capacity (e.g., `20 -> 50 -> 100 -> 150 -> 200 -> 0`).
   - **Spike:** Low baseline → sharp 10s surge → short hold → fast drop → baseline recovery.
   - **Endurance (Soak):** Short ramp-up → 10–15m sustained constant VUs → ramp-down.
3. **Request Tagging & Custom Metrics:**
   - Pass `{ tags: { group_type: 'auth|read|transactional|verification', endpoint: '<name>' } }` to every `http.*()` call.
   - Define per-group `Trend` metrics (`auth_duration`, `read_duration`, `tx_duration`) and per-endpoint `Trend` + `Counter` metrics so `handleSummary(data)` can build rich aggregate tables.
4. **Expected Status Handling (Preventing False Error Inflation):**
   - For intentional negative/verification probes (e.g., `404` after deletion, `401`/`403` lockout probe), pass `responseCallback: http.expectedStatuses(404)` (or `http.expectedStatuses(401, 403)`) on that specific request so k6's `http_req_failed` accurately reflects **unexpected** failures while assertions still verify exact status codes!

---

## 2. Three Distinct Report Views (No Repetition)

| Scenario | Report View | Implementation | Equivalent JMeter Listener |
|---|---|---|---|
| **Load** | **View 1: Per-Group & Check Trace HTML** | Import `../../skills/performance-tester/resources/k6/report_view1_trace.js` in `handleSummary(data)` | View Results Tree |
| **Stress** | **View 2: Built-in k6 Web Dashboard Time-Series HTML** | Set `K6_WEB_DASHBOARD=true` and `K6_WEB_DASHBOARD_EXPORT=<path>/index.html` | Summary Report |
| **Spike** | **View 3: Aggregate Percentile Matrix HTML** | Import `../../skills/performance-tester/resources/k6/report_view3_aggregate.js` in `handleSummary(data)` | Aggregate Report |

---

## 3. Standard Execution Commands (Full Raw Logs + HTML)

### Load (View 1)
```powershell
k6 run --out csv=raw-logs/<ID>_Load_<YYYYMMDD>.csv test-plans/<ID>_Load_<YYYYMMDD>.js
```

### Stress (View 2 — Built-in Web Dashboard)
```powershell
$env:K6_WEB_DASHBOARD = "true"
$env:K6_WEB_DASHBOARD_EXPORT = "html-reports/stress-dashboard-report/index.html"
k6 run --out csv=raw-logs/<ID>_Stress_<YYYYMMDD>.csv test-plans/<ID>_Stress_<YYYYMMDD>.js
Remove-Item Env:K6_WEB_DASHBOARD, Env:K6_WEB_DASHBOARD_EXPORT -ErrorAction SilentlyContinue
```

### Spike (View 3)
```powershell
k6 run --out csv=raw-logs/<ID>_Spike_<YYYYMMDD>.csv test-plans/<ID>_Spike_<YYYYMMDD>.js
```

### Optional 1:1 `.jtl` Compatibility Export
Preserve the original `--out csv` untouched, and optionally generate a transparent 1:1 JTL export:
```powershell
python skills/performance-tester/scripts/convert_k6_to_jtl.py raw-logs/<file>.csv raw-logs/<file>.jtl
```

---

## 4. Smoke Verification Command (Pre-Flight)
Before running full Load/Stress/Spike, always dry-run with minimal VUs:
```powershell
k6 run --vus 2 --iterations 2 test-plans/<script>.js
```
