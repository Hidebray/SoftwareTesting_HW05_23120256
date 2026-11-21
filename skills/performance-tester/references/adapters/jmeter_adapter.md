# Tool Adapter: Apache JMeter

Load this adapter during **Phase 3 (Implementation)** and **Phase 4 (Execution)** when the chosen load-testing tool is **Apache JMeter** (`>= 5.6.x`).

---

## 1. Idiomatic JMeter Test Plan Standards (`.jmx`)

1. **Non-GUI Execution Only for Real Runs:**
   - Use JMeter GUI strictly for authoring and 1–2 thread smoke debugging.
   - Always execute Load, Stress, Spike, and Endurance tests in **CLI Non-GUI mode** (`-n`) to prevent Swing UI overhead from skewing latency measurements.
2. **Data-Driven Configuration:**
   - Attach **CSV Data Set Config** elements with `Recycle on EOF = True`, `Stop thread on EOF = False`, `Sharing mode = All threads`.
   - Use **HTTP Header Manager** (`Content-Type: application/json`, `Authorization: Bearer ${jwt_token}`) and **HTTP Request Defaults** (`localhost`, port, protocol).
3. **Correlation & Assertions:**
   - Extract auth tokens and created record IDs with **JSON Extractor** (`$.token`, `$.id`).
   - Add **Response Assertion** (HTTP code + JSON structure/field checks) and **JSR223 Assertion** for semantic math/type checks (not just HTTP `200`).
4. **Realistic Pacing:**
   - Add **Uniform Random Timer** or **Gaussian Random Timer** between requests to simulate think-time.
5. **Scenario Shaping:**
   - **Load:** Standard `Thread Group` (e.g., 20 threads, 30s ramp-up, loop/scheduler 120s).
   - **Stress:** `Ultimate Thread Group` / `Stepping Thread Group` (jp@gc plugin) or multiple staged Thread Groups.
   - **Spike:** `Synchronizing Timer` or `Ultimate Thread Group` with abrupt 5–10s ramp-up and rapid drop.

---

## 2. Three Distinct Report Listeners (No Repetition)

Assign **one unique listener type per test plan** (disabled during heavy CLI runs or saved only as configuration while CLI generates full `.jtl` + HTML dashboard):

| Scenario | Listener / View | Primary Purpose |
|---|---|---|
| **Load** | **View Results Tree** | Detailed per-request headers, payloads, and assertion pass/fail trace |
| **Stress** | **Summary Report** | Compact tabular summary of samples, avg, min, max, error %, throughput |
| **Spike** | **Aggregate Report** | Full percentile distribution (`Median`, `90% Line`, `95% Line`, `99% Line`) |

---

## 3. Standard Non-GUI Execution Commands

```bash
# Produce full raw .jtl log AND JMeter HTML Dashboard folder
jmeter -n -t test-plans/<ID>_Load_<YYYYMMDD>.jmx \
       -l raw-logs/<ID>_Load_<YYYYMMDD>.jtl \
       -e -o html-reports/load-html-report
```

> Ensure the target HTML output directory (`-o`) is empty before each run; JMeter refuses to overwrite non-empty folders.

---

## 4. Ground-Truth Log Verification
Feed the raw `.jtl` file directly into the universal analyzer (auto-detects JMeter JTL headers):
```bash
python skills/performance-tester/scripts/analyze_perf_logs.py raw-logs/<ID>_Load_<YYYYMMDD>.jtl --md summary.md --json summary.json
```
