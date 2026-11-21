# Performance Testing Report Template

> **Project / SUT:** `<SUT Name & Repository>`  
> **Load Testing Tool:** `<k6 / JMeter / Locust / ...>`  
> **Author:** `<Name / ID>`  
> **Test Host:** `<Hostname + CPU / RAM / OS>`

---

## 1. Executive Summary
- **End-to-End Workflow Tested:** `<Brief summary covering Auth-heavy, Read-heavy, Transactional>`
- **Key Findings:** `<Top 3 quantitative findings>`
- **Endurance Hardware Threshold:** `<Max stable RPS, p95 ceiling, CPU/RAM limits>`
- **Defects Logged:** `<Count & link to issue tracker>`

---

## 2. Scope, Workload Model & Test Data
### 2.1 Endpoint Classification & Stateful Risk Audit
| Step | Endpoint | Workload Class | Stateful / Concurrency Risk |
|---|---|---|---|
| 1 | `...` | Auth-heavy | `...` |

### 2.2 Scenario Parameters (Little's Law Justification)
| Scenario | VUs / Threads | Ramp-Up | Hold | Think-Time | Distinct Report View |
|---|---|---|---|---|---|
| Load | | | | | View 1: Trace / Assertions |
| Stress | | | | | View 2: Time-Series / Summary |
| Spike | | | | | View 3: Aggregate Percentiles |
| Endurance | | | | | Soak Stability Trend |

### 2.3 Human Pre-Flight Review (AI Draft vs. Final Fixes)
| # | Issue Missed by AI Draft | Root Cause (Prompt / Model / SUT) | Fix Applied |
|---|---|---|---|

---

## 3. Test Environment & State Reset Procedure
- Hardware spec table + raw `dxdiag` / `screenfetch` proof.
- Exact state/lockout reset commands executed between scenarios.

---

## 4. Execution Results & Ground-Truth Metrics
*(Include raw log paths, HTML report links, synchronized Tool + Resource Monitor screenshots, and ground-truth tables from `scripts/analyze_perf_logs.py` for Load, Stress, Spike, and Endurance.)*

---

## 5. AI Log Analysis, Misinterpretation Hunt & Feasibility Audit
### 5.1 Misinterpretation Hunt
| # | AI Claim | Ground-Truth Value (Raw Log Citation) | Explanation of Error |
|---|---|---|---|

### 5.2 Optimization Feasibility Audit
| # | AI Recommendation | Verdict (`Feasible` / `Hallucinated`) | Source Code / Metric Evidence |
|---|---|---|---|

---

## 6. Continuous Performance Testing (CPT) Proposal
- Tiered commit trigger policy.
- Mermaid Flowchart (`flowchart TD`).
- Statistical `p95` regression detection formula.
- Trade-off analysis (Cost vs. Coverage, False Alarms vs. False Negatives).
