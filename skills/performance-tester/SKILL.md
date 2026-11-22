---
name: performance-tester
description: >-
  Design, review, execute, and analyze backend API performance tests (Load,
  Stress, Spike, Endurance/Soak) using any load-testing tool (k6, JMeter,
  Locust, Artillery, etc.). Guides SUT risk auditing, workload modeling via
  Little's Law, CSV data-driven design, human-in-the-loop pre-flight review,
  ground-truth raw-log verification, bottleneck root-cause & optimization
  feasibility auditing, and Continuous Performance Testing (CPT) architecture.
---

# Performance Tester Agent Skill (v1.1)

A universal, **tool-agnostic** engineering protocol for planning, executing, verifying, and auditing backend API performance tests. Grounded in the **ISTQB Performance Testing Syllabus**, **Little's Law**, and the **RED / USE observability methods**, this skill separates core methodology from execution tooling via pluggable adapters.

> **v1.1 Upgrades (Field-Validated Lessons):** Added URL high-cardinality grouping guard (preventing `>100k` metric time series), dual-stack (IPv4/IPv6) local SUT reset hygiene, expected-status error taxonomy (`5xx` vs. intentional `4xx`), and DBMS-hallucination verification rules.

---

## Skill Architecture (Progressive Disclosure)

```text
performance-tester/
├── SKILL.md                                # Core 6-Phase tool-agnostic protocol (this file)
├── references/
│   ├── workload_modeling_guide.md          # Little's Law, 4 test profiles, stateful risk matrix
│   ├── optimization_audit_rubric.md        # AI misinterpretation traps & Feasible vs. Hallucinated audit
│   └── adapters/
│       ├── k6_adapter.md                   # Tool adapter: Grafana k6
│       └── jmeter_adapter.md               # Tool adapter: Apache JMeter
├── scripts/
│   ├── analyze_perf_logs.py                # Universal raw-log analyzer (auto-detects k6 CSV, JMeter .jtl, Generic CSV)
│   └── convert_k6_to_jtl.py                # Deterministic 1:1 k6 raw CSV -> JTL converter
└── resources/
    ├── report_template.md                  # Tool-agnostic performance test report template
    └── k6/
        ├── report_view1_trace.js           # Offline HTML View 1: Group & Assertion Trace (k6)
        └── report_view3_aggregate.js       # Offline HTML View 3: Aggregate Percentile Matrix (k6)
```

> **Extensibility:** To support another tool (Locust, Artillery, Gatling, Vegeta), add `references/adapters/<tool>_adapter.md` without modifying `SKILL.md`.

---

## Core Operating Rules

1. **Step-by-Step, Never Black-Box:** Progress gate-by-gate and pause for human confirmation at every review checkpoint. Never generate an entire test suite from a single generic prompt without inspecting the SUT first.
2. **Evidence Over Estimation:** Never eyeball percentiles or throughput from truncated log snippets. Always compute exact metrics from full raw per-request logs using [analyze_perf_logs.py](./scripts/analyze_perf_logs.py).
3. **Code-Grounded Recommendations:** Every optimization recommendation MUST cite verified architecture/source evidence (DB engine, indexing, locking, auth hashing, memory structures) before being judged feasible.
4. **Clean State Isolation:** Reset stateful side effects (account lockouts, rate-limit counters, ephemeral test records, in-memory caches) between scenarios and document the reset procedure.

---

## The 6-Phase Performance Testing Protocol

### Phase 1 — SUT Discovery & Risk Audit
Before designing any load profile, inspect the target repository, API routes, database schema, and middleware:
1. Map endpoints across the three canonical workload classes:
   - **Auth-heavy:** login, token verification, session refresh, password recovery.
   - **Read-heavy:** catalog/list queries, search, joins, detail lookups.
   - **Transactional (Write-heavy):** create/update/delete, cart/checkout, coupon redemption, state transitions.
2. Audit **stateful & concurrency risks** in source code:
   - Account lockout / rate-limiting counters (avoid locking out the primary VU pool).
   - `UNIQUE` constraints on created records (require per-VU/per-iteration unique suffixes).
   - Database locking & indexing (single-file SQLite WAL/busy timeout, unindexed `WHERE`/`COUNT(*)` scans, un-awaited writes).
   - Unbounded in-memory objects (potential memory leaks observable under Soak/Endurance load).
3. **Human Checkpoint 1:** Confirm the end-to-end user journey, endpoint coverage, and risk register before modeling load.

### Phase 2 — Workload Modeling & Data-Driven Design
Read [workload_modeling_guide.md](./references/workload_modeling_guide.md) when sizing parameters.
1. Define realistic parameters (`VUs`, `ramp-up`, `hold`, `ramp-down`, `think-time`, target `RPS` via Little's Law $N = \lambda \cdot (R + Z)$) for all required profiles:
   - **Load** (expected steady production load)
   - **Stress** (stepwise ramp beyond capacity to locate breaking point)
   - **Spike** (sudden burst + drop to verify shock absorption & recovery)
   - **Endurance / Soak** (sustained moderate load for 10–15+ min to find hardware/memory/table-growth ceiling)
2. Externalize inputs into **CSV datasets**, isolating normal user pools from negative/lockout probes so error-injection does not poison happy-path throughput.
3. **Human Checkpoint 2:** Review load parameters and CSV schemas for realism against the test machine's hardware specs.

### Phase 3 — Tool Adapter Implementation & Multi-View Reporting
Select and read the matching tool adapter from `references/adapters/`:
- **Grafana k6:** [k6_adapter.md](./references/adapters/k6_adapter.md)
- **Apache JMeter:** [jmeter_adapter.md](./references/adapters/jmeter_adapter.md)

Enforce these universal implementation standards regardless of tool:
1. **Consistent Naming:** Follow the project/assignment naming convention (e.g., `{ID}_{ScenarioType}_{YYYYMMDD}`).
2. **Semantic Tagging:** Tag every request with both its workload class (`auth`, `read`, `transactional`, `verification`) and endpoint name so latency & error rates can be segmented cleanly.
3. **3 Distinct Report Perspectives (No Repetition):** Configure three complementary report views across Load, Stress, and Spike:
   - **Trace / Assertion View** (per-group & per-check breakdown — e.g., View Results Tree / Trace HTML)
   - **Time-Series / Summary View** (temporal VUs, RPS, latency, errors — e.g., Summary Report / Web Dashboard)
   - **Aggregate Percentile View** (`min/avg/p50/p90/p95/p99/max` matrix per endpoint — e.g., Aggregate Report / Percentile HTML)
4. **Full Raw Telemetry:** Always enable full per-request raw logging (`.jtl`, `--out csv`, etc.), never summary-only output.

### Phase 4 — Human Pre-Flight Review & Controlled Execution
1. Run a low-concurrency **smoke test** (1–2 VUs, 2 iterations) to verify syntax, auth tokens, CSV parsing, and cleanup.
2. Perform the **Pre-Flight Human Review** and explicitly document any AI-generated defects fixed before full execution:
   - Weak assertions (checking only HTTP `200` while ignoring corrupted payload fields or wrong discount math).
   - Shared-account lockout contamination or colliding `UNIQUE` keys.
   - Missing expected-status handling for intentional `401`/`403`/`404` probes.
   - Unrealistic zero think-time or instantaneous ramp-up on a local SUT.
3. **Controlled Run Loop (repeat per scenario):**
   - Execute the documented SUT reset & seed procedure.
   - Run the scenario while capturing synchronized **Tool + OS Resource Monitor** (`Task Manager` / `htop` / `Activity Monitor`) screenshots (RAW, unedited) and recording hardware specs.
   - Archive raw logs and HTML report folders intact.

### Phase 5 — Ground-Truth Raw Log Verification & Optimization Audit
Read [optimization_audit_rubric.md](./references/optimization_audit_rubric.md) before auditing results.
1. *(Optional for AI-Critique / Misinterpretation workflows)* Capture an unassisted AI reading of the logs first so misinterpretations can be audited transparently.
2. Run the universal ground-truth analyzer on every full raw log file:
   ```bash
   python scripts/analyze_perf_logs.py <path-to-raw-log.csv-or-.jtl> --json <output.json> --md <output.md>
   ```
3. Cross-check every reported figure (`total requests`, `avg/p90/p95/p99`, `RPS`, `status breakdown`, `5xx vs expected 4xx`) against the ground-truth output and document any misreadings with exact raw-log citations.
4. Classify each proposed optimization as **Feasible** or **Hallucinated** strictly against observed source code, database engine, and measured bottlenecks.

### Phase 6 — Continuous Performance Testing (CPT) & Final Reporting
1. Use [report_template.md](./resources/report_template.md) to compile findings, hardware endurance thresholds, bug reports, and trade-off analysis.
2. Design a **Continuous Performance Testing (CPT)** pipeline tailored to the SUT:
   - Tiered commit triggers (Skip docs/UI-only → PR Smoke Gate → Nightly/Release Full Load & Soak).
   - Statistical `p95` regression detection using rolling baselines, relative + absolute delta guards, and auto-retry confirmation to control CI noise.
   - Explicit trade-off analysis balancing compute/developer-wait cost against false alarms and false negatives.
3. **Iterative Skill Feedback:** Record newly discovered pitfalls back into `references/` so future engagements benefit automatically.

