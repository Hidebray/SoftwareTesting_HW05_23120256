# Ground-Truth Verification & Optimization Audit Rubric

Use this reference during **Phase 5 (Raw Log Analysis, Misinterpretation Hunt & Feasibility Audit)**.

---

## 1. Common AI Raw-Log Misinterpretation Traps

When an LLM is asked to read raw performance logs (k6 CSV or JMeter `.jtl`) directly, systematically hunt for these 7 recurring failure modes:

| Trap ID | Misinterpretation Pattern | Why LLMs Make This Mistake | How to Verify with Ground Truth |
|---|---|---|---|
| **M-01** | **CSV Row Count ≠ HTTP Request Count** | k6 `--out csv` writes 8–10 metric rows per single HTTP request (`http_reqs`, `http_req_duration`, `http_req_waiting`, `http_req_tls_handshaking`, etc.). LLMs often treat `wc -l` as total requests. | Count strictly `metric_name == 'http_reqs'` (k6) or data rows (JMeter `.jtl`). |
| **M-02** | **Conflating `iteration_duration` with `http_req_duration`** | LLMs cite multi-second `iteration_duration` (which includes `sleep()` think-time + all workflow steps) as "slow API response time". | Separate `http_req_duration` per endpoint from `iteration_duration`. |
| **M-03** | **Truncation & Sampling Bias on Percentiles** | LLMs only see the first/last N lines of a large raw log and hallucinate or extrapolate `p95`/`p99` from ramp-up samples. | Compute exact nearest-rank/linear percentiles across 100% of rows via `scripts/analyze_perf_logs.py`. |
| **M-04** | **Mixing Expected Negative Statuses (`400`/`401`/`403`/`404`) with Server Failures (`5xx`)** | Intentional lockout probes or post-delete `404` verification checks get counted as "system crashes / high error rate". | Break down exact counts by HTTP status code and separate `5xx` + network errors from expected `4xx`. |
| **M-05** | **Average RPS vs. Peak RPS Confusion** | Dividing total requests by full test duration (including ramp-up/down) understates the real peak load during Stress/Spike bursts. | Compute 1-second time-bucket throughput to report both **Average RPS** and **Peak 1s RPS**. |
| **M-06** | **Unit Confusion (ms vs. s vs. µs)** | Mixing milliseconds in raw CSV with seconds displayed in CLI summaries. | Verify raw unit specification (`ms` in both k6 CSV `http_req_duration` and JMeter `elapsed`). |
| **M-07** | **Averaging Percentiles Across Scenarios** | Taking the arithmetic mean of `p95` across endpoints or runs (statistically invalid). | Always recompute percentiles from pooled raw latency samples. |

---

## 2. Optimization Feasibility Rubric (Feasible vs. Hallucinated)

Every optimization recommended by AI MUST be audited against the **actual codebase, database engine, runtime, and observed bottleneck**:

### Criteria for `FEASIBLE`
1. **Stack-Accurate:** Applies directly to the real tech stack found in the repository (e.g., `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;` for SQLite3; `CREATE INDEX` on an actually unindexed query column; clearing an actually leaking in-memory map).
2. **Bottleneck-Aligned:** Directly addresses a measured symptom in the raw logs or resource monitor (e.g., `SQLITE_BUSY` `500` errors, growing `p95` on a `COUNT(*)` query, rising RSS memory).
3. **Proportional Complexity:** Realistic to implement without rewriting the entire system out of scope.

### Criteria for `HALLUCINATED` (or Misaligned)
1. **Phantom Technology:** Recommends tuning a component that does not exist in the codebase (e.g., reducing `bcrypt` salt rounds when passwords are compared in plaintext; tuning PostgreSQL `pg-pool` / HikariCP when the SUT uses single-file `sqlite3`; optimizing GraphQL resolvers on a REST Express app).
2. **Phantom Query / Code Path:** Claims a heavy `JOIN` or `N+1` loop exists on an endpoint that actually runs a single trivial query.
3. **Unjustified Over-Engineering:** Recommends multi-region Kubernetes autoscaling, Kafka, or Redis Cluster to fix a single-node locking bug or missing SQL index.

### Standard Audit Table Format

| # | AI Recommendation | Classification | Code / Metric Evidence | Engineering Rationale |
|:---:|---|:---:|---|---|
| 1 | *(Proposal)* | **Feasible** / **Hallucinated** | `file.js:Lxx` + raw metric | Concise justification |

---

## 3. Continuous Performance Testing (CPT) Trade-Off Checklist (Phase 6)

When proposing a CPT model in CI/CD, address all four trade-off axes:
1. **Compute Cost & PR Latency** vs. **Early Defect Detection** → solve via tiered execution (Skip docs → PR Quick Smoke → Nightly/Release Full Load + Soak).
2. **False Alarms (CI Runner Noise)** vs. **False Negatives (Missed Regressions)** → solve via rolling baselines (last 5 `main` runs), dual thresholds (e.g., `> +15%` AND `> +20ms` absolute delta), warm-up exclusion, and automatic 1x retry confirmation before failing a build.
3. **Environment Parity** → compare shared cloud runners (cheap, noisy) vs. dedicated self-hosted perf runners (stable, higher cost).
4. **Baseline Drift** → guard against slow creep ("death by 1000 cuts" where each PR adds +3% latency) by comparing against both the rolling 5-run window and the last tagged release baseline.
