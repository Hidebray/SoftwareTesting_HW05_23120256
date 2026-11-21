# Workload Modeling & Stateful Risk Guide

Use this reference during **Phase 1 (SUT Discovery)** and **Phase 2 (Workload Modeling)** regardless of which load-testing tool is chosen.

---

## 1. Little's Law for Sizing Virtual Users

To avoid arbitrary VU numbers, derive concurrency from target throughput using **Little's Law**:

$$N = \lambda \times (R + Z)$$

Where:
- $N$: Concurrent Virtual Users (VUs / Threads).
- $\lambda$: Target throughput in complete user-journey iterations per second.
- $R$: Expected end-to-end response time of one iteration (sum of all API latencies in the journey, in seconds).
- $Z$: Total **think-time** per iteration (realistic pauses between user actions, in seconds).

**Practical rule for local single-host SUT benchmarking:**
- When both the load generator and the SUT share the same laptop/workstation, reserve at least **30–40% CPU headroom** for the OS + load generator + screen recorder so the load generator itself does not become the bottleneck (coordinated omission).
- Always include randomized think-time (e.g., `0.5s–2.5s` for Load, shorter `0.3s–1.0s` for Stress/Spike) to emulate human pacing and avoid artificial lockstep thundering-herd artifacts.

---

## 2. Canonical Test Profiles

| Profile | Primary Question Answered | Shape Pattern | Typical Duration (Local Benchmark) | Key Stopping / Pass Signals |
|---|---|---|---|---|
| **Load** | Does the SUT meet SLAs under normal expected traffic? | Smooth ramp-up → flat steady hold → ramp-down | 2–5 min steady hold | Stable `p95`, `< 1%` unexpected error rate, flat CPU/RAM |
| **Stress** | Where is the breaking point and how gracefully does the SUT degrade? | Stepwise staircase ramp (e.g., 20 → 50 → 100 → 150 → 200 VUs) → recovery | 3–6 min total | Knee of latency curve, onset of `5xx` / timeouts / lock errors, recovery speed |
| **Spike** | Can the SUT survive sudden burst traffic and recover afterward? | Low baseline → near-instant 10x–20x burst → short hold → drop back to baseline | 2–3 min total | Post-spike latency/error recovery back to baseline levels |
| **Endurance (Soak)** | Are there memory leaks, DB lock accumulation, or gradual table-scan slowdowns? | Moderate sustainable load (60–75% of breaking point) held continuously | 10–15+ min (dev) / hours (prod) | Slope of RAM (MB/min), slope of `p95` over time, max stable RPS |

---

## 3. Endpoint Workload Classification

Every end-to-end workflow should map requests cleanly to three workload categories:

1. **Auth-Heavy:** Exercises cryptographic verification (JWT sign/verify, password hashing), session lookups, and security state updates (login attempt counters, lockouts, audit logs).
2. **Read-Heavy:** Exercises query planner efficiency, table scans, `JOIN`s, serialization overhead, and payload transfer size.
3. **Transactional (Write-Heavy):** Exercises ACID transactions, row/table write locks, `UNIQUE` index checks, foreign key integrity, and state-machine transitions.

---

## 4. Stateful & Concurrency Risk Matrix (Audit in Phase 1)

Check the SUT source code for these recurring traps before generating scripts:

| Risk Pattern | Symptom Under Load | Mitigation in Test Design |
|---|---|---|
| **Account Lockout / Rate Limit** | Entire VU pool suddenly gets `403`/`429` after a few failed attempts | Separate CSV `user_pool` (valid credentials) from dedicated `lockout_probe` accounts; reset SUT state between runs |
| **`UNIQUE` Key Collision** | `500` / `409` duplicate key errors on concurrent `POST` | Append unique runtime tokens (e.g., `_${VU}_${ITER}_${TS}`) to CSV prefix templates |
| **Un-awaited Async DB Writes** | Immediate follow-up request fails with `SQLITE_BUSY` or stale reads | Document as a real concurrency defect; add realistic think-time between dependent steps |
| **Unbounded In-Memory State** | Node/JVM RSS memory grows linearly with iterations and never drops | Measure RSS every 2 min during Endurance/Soak test and file a Memory Leak defect |
| **Unindexed Growing Tables** | Read/validation latency degrades steadily across a 10–15 min Soak test | Log `p95` per time window to prove $O(N)$ full-table-scan degradation |
| **Negative Test Misclassification** | Intentional `400`/`401`/`403`/`404` checks inflate global `error_rate` | Configure tool-level expected status codes or separate `server_5xx_rate` from `business_4xx_rate` |
