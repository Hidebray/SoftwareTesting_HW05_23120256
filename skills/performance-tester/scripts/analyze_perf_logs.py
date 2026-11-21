#!/usr/bin/env python3
"""
Universal Performance Raw-Log Ground-Truth Analyzer
Part of the `performance-tester` Agent Skill (zero external dependencies, Python 3 stdlib).

Auto-detects and analyzes:
  1. Grafana k6 raw CSV (`k6 run --out csv=...`)
  2. Apache JMeter raw JTL (`jmeter -n -t ... -l raw.jtl`)
  3. Generic HTTP benchmark CSV (timestamp, latency/elapsed, status, label/endpoint)

Computes exact ground-truth statistics to eliminate LLM log-reading hallucinations:
  - Total raw CSV rows vs. actual HTTP requests (prevents row-count conflation)
  - Overall & per-endpoint/per-group min, avg, med (p50), p90, p95, p99, max (ms)
  - Separate iteration_duration (with think-time) vs. pure http_req_duration
  - Exact HTTP status code distribution & separation of 5xx/network vs expected 4xx
  - Average RPS & Peak 1-second RPS
  - Time-window trend slices (useful for Endurance/Soak degradation tracking)
"""

import argparse
import csv
import json
import math
import os
import sys
from collections import Counter, defaultdict
from typing import Dict, List, Optional, Tuple


def percentile(sorted_vals: List[float], p: float) -> float:
    """Linear-interpolation percentile (matches k6 / NumPy default)."""
    if not sorted_vals:
        return 0.0
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    rank = (p / 100.0) * (n - 1)
    low = math.floor(rank)
    high = math.ceil(rank)
    if low == high:
        return sorted_vals[low]
    frac = rank - low
    return sorted_vals[low] + frac * (sorted_vals[high] - sorted_vals[low])


def summarize_samples(values: List[float]) -> Dict[str, float]:
    if not values:
        return {
            "count": 0,
            "min": 0.0,
            "avg": 0.0,
            "med": 0.0,
            "p90": 0.0,
            "p95": 0.0,
            "p99": 0.0,
            "max": 0.0,
        }
    s = sorted(values)
    total = sum(s)
    return {
        "count": len(s),
        "min": round(s[0], 3),
        "avg": round(total / len(s), 3),
        "med": round(percentile(s, 50), 3),
        "p90": round(percentile(s, 90), 3),
        "p95": round(percentile(s, 95), 3),
        "p99": round(percentile(s, 99), 3),
        "max": round(s[-1], 3),
    }


def parse_extra_tags(raw: str) -> Dict[str, str]:
    tags: Dict[str, str] = {}
    if not raw:
        return tags
    for pair in raw.replace(";", "&").split("&"):
        if "=" in pair:
            k, v = pair.split("=", 1)
            tags[k.strip()] = v.strip()
    return tags


def detect_format(fieldnames: List[str]) -> str:
    cols = {c.strip() for c in fieldnames}
    if {"metric_name", "timestamp", "metric_value"}.issubset(cols):
        return "k6_csv"
    if {"timeStamp", "elapsed", "label", "responseCode"}.issubset(cols):
        return "jmeter_jtl"
    return "generic_csv"


def analyze_k6_csv(filepath: str) -> Dict:
    total_csv_rows = 0
    http_reqs_count = 0
    http_req_durations: List[float] = []
    iteration_durations: List[float] = []
    per_endpoint: Dict[str, List[float]] = defaultdict(list)
    per_group_type: Dict[str, List[float]] = defaultdict(list)
    status_counts: Counter = Counter()
    endpoint_status: Dict[str, Counter] = defaultdict(Counter)
    expected_false_count = 0
    server_5xx_or_net_err = 0
    check_pass = 0
    check_fail = 0
    per_check: Dict[str, Dict[str, int]] = defaultdict(lambda: {"pass": 0, "fail": 0})
    rps_buckets: Counter = Counter()
    timestamps: List[int] = []
    time_series_latencies: List[Tuple[int, float]] = []

    with open(filepath, "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_csv_rows += 1
            mname = (row.get("metric_name") or "").strip()
            val_str = (row.get("metric_value") or "").strip()
            ts_str = (row.get("timestamp") or "").strip()

            try:
                val = float(val_str)
            except ValueError:
                continue

            ts_sec: Optional[int] = None
            if ts_str:
                try:
                    ts_sec = int(float(ts_str))
                except ValueError:
                    ts_sec = None

            extra = parse_extra_tags(row.get("extra_tags") or "")
            endpoint = (
                row.get("endpoint")
                or extra.get("endpoint")
                or row.get("name")
                or row.get("url")
                or "unknown"
            ).strip()
            group_type = (
                row.get("group_type")
                or extra.get("group_type")
                or (row.get("group") or "").lstrip(":")
                or "ungrouped"
            ).strip()

            if mname == "http_reqs":
                http_reqs_count += int(round(val))
                status = (row.get("status") or "0").strip() or "0"
                status_counts[status] += 1
                endpoint_status[endpoint][status] += 1
                exp = (row.get("expected_response") or "true").strip().lower()
                if exp == "false":
                    expected_false_count += 1
                if status == "0" or status.startswith("5") or (row.get("error") or "").strip():
                    server_5xx_or_net_err += 1
                if ts_sec is not None:
                    rps_buckets[ts_sec] += 1
                    timestamps.append(ts_sec)

            elif mname == "http_req_duration":
                http_req_durations.append(val)
                per_endpoint[endpoint].append(val)
                per_group_type[group_type].append(val)
                if ts_sec is not None:
                    time_series_latencies.append((ts_sec, val))

            elif mname == "iteration_duration":
                iteration_durations.append(val)

            elif mname == "checks":
                chk_name = (row.get("check") or "unnamed_check").strip()
                if val >= 1.0:
                    check_pass += 1
                    per_check[chk_name]["pass"] += 1
                else:
                    check_fail += 1
                    per_check[chk_name]["fail"] += 1

    duration_sec = (max(timestamps) - min(timestamps) + 1) if timestamps else 0
    avg_rps = round(http_reqs_count / duration_sec, 3) if duration_sec > 0 else 0.0
    peak_rps = max(rps_buckets.values()) if rps_buckets else 0

    # Time-window slices (up to 6 equal buckets for trend tracking)
    trend_slices = build_time_slices(time_series_latencies, num_slices=6)

    endpoint_summary = {}
    for ep, vals in sorted(per_endpoint.items()):
        st = summarize_samples(vals)
        ep_statuses = dict(endpoint_status[ep])
        ep_5xx = sum(cnt for code, cnt in ep_statuses.items() if code == "0" or code.startswith("5"))
        st["status_counts"] = ep_statuses
        st["server_5xx_count"] = ep_5xx
        st["server_5xx_rate_pct"] = round((ep_5xx / len(vals)) * 100.0, 3) if vals else 0.0
        endpoint_summary[ep] = st

    group_summary = {grp: summarize_samples(vals) for grp, vals in sorted(per_group_type.items())}

    return {
        "source_file": os.path.abspath(filepath),
        "detected_format": "k6_csv",
        "total_raw_csv_rows": total_csv_rows,
        "total_http_requests": http_reqs_count,
        "duration_seconds": duration_sec,
        "average_rps": avg_rps,
        "peak_1s_rps": peak_rps,
        "http_req_duration_ms": summarize_samples(http_req_durations),
        "iteration_duration_ms": summarize_samples(iteration_durations),
        "status_distribution": dict(sorted(status_counts.items())),
        "expected_response_false_count": expected_false_count,
        "expected_response_false_rate_pct": round((expected_false_count / http_reqs_count) * 100.0, 3) if http_reqs_count else 0.0,
        "server_5xx_or_network_errors": server_5xx_or_net_err,
        "server_5xx_error_rate_pct": round((server_5xx_or_net_err / http_reqs_count) * 100.0, 3) if http_reqs_count else 0.0,
        "checks": {
            "total": check_pass + check_fail,
            "passed": check_pass,
            "failed": check_fail,
            "pass_rate_pct": round((check_pass / (check_pass + check_fail)) * 100.0, 3) if (check_pass + check_fail) else 0.0,
            "details": dict(sorted(per_check.items())),
        },
        "per_group_type_ms": group_summary,
        "per_endpoint_ms": endpoint_summary,
        "latency_trend_slices": trend_slices,
    }


def analyze_jmeter_jtl(filepath: str) -> Dict:
    total_rows = 0
    latencies: List[float] = []
    per_endpoint: Dict[str, List[float]] = defaultdict(list)
    status_counts: Counter = Counter()
    endpoint_status: Dict[str, Counter] = defaultdict(Counter)
    failed_flag_count = 0
    server_5xx_or_net_err = 0
    rps_buckets: Counter = Counter()
    timestamps_ms: List[int] = []
    time_series_latencies: List[Tuple[int, float]] = []

    with open(filepath, "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_rows += 1
            label = (row.get("label") or "unknown").strip()
            code = (row.get("responseCode") or "0").strip() or "0"
            success = (row.get("success") or "true").strip().lower() == "true"

            try:
                elapsed = float(row.get("elapsed") or 0.0)
            except ValueError:
                continue

            ts_sec: Optional[int] = None
            try:
                ts_ms = int(float(row.get("timeStamp") or 0))
                timestamps_ms.append(ts_ms)
                ts_sec = ts_ms // 1000
                rps_buckets[ts_sec] += 1
            except ValueError:
                pass

            latencies.append(elapsed)
            per_endpoint[label].append(elapsed)
            status_counts[code] += 1
            endpoint_status[label][code] += 1
            if not success:
                failed_flag_count += 1
            if code == "0" or code.startswith("5") or not code.isdigit():
                server_5xx_or_net_err += 1
            if ts_sec is not None:
                time_series_latencies.append((ts_sec, elapsed))

    duration_sec = max(1, int(round((max(timestamps_ms) - min(timestamps_ms)) / 1000.0))) if len(timestamps_ms) >= 2 else (1 if timestamps_ms else 0)
    avg_rps = round(total_rows / duration_sec, 3) if duration_sec > 0 else 0.0
    peak_rps = max(rps_buckets.values()) if rps_buckets else 0

    endpoint_summary = {}
    for ep, vals in sorted(per_endpoint.items()):
        st = summarize_samples(vals)
        ep_statuses = dict(endpoint_status[ep])
        ep_5xx = sum(cnt for code, cnt in ep_statuses.items() if code == "0" or code.startswith("5") or not code.isdigit())
        st["status_counts"] = ep_statuses
        st["server_5xx_count"] = ep_5xx
        st["server_5xx_rate_pct"] = round((ep_5xx / len(vals)) * 100.0, 3) if vals else 0.0
        endpoint_summary[ep] = st

    return {
        "source_file": os.path.abspath(filepath),
        "detected_format": "jmeter_jtl",
        "total_raw_csv_rows": total_rows,
        "total_http_requests": total_rows,
        "duration_seconds": duration_sec,
        "average_rps": avg_rps,
        "peak_1s_rps": peak_rps,
        "http_req_duration_ms": summarize_samples(latencies),
        "iteration_duration_ms": None,
        "status_distribution": dict(sorted(status_counts.items())),
        "expected_response_false_count": failed_flag_count,
        "expected_response_false_rate_pct": round((failed_flag_count / total_rows) * 100.0, 3) if total_rows else 0.0,
        "server_5xx_or_network_errors": server_5xx_or_net_err,
        "server_5xx_error_rate_pct": round((server_5xx_or_net_err / total_rows) * 100.0, 3) if total_rows else 0.0,
        "checks": None,
        "per_group_type_ms": {},
        "per_endpoint_ms": endpoint_summary,
        "latency_trend_slices": build_time_slices(time_series_latencies, num_slices=6),
    }


def analyze_generic_csv(filepath: str) -> Dict:
    total_rows = 0
    latencies: List[float] = []
    per_endpoint: Dict[str, List[float]] = defaultdict(list)
    status_counts: Counter = Counter()

    with open(filepath, "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        fields = [c.lower() for c in (reader.fieldnames or [])]
        lat_col = next((c for c in (reader.fieldnames or []) if c.lower() in {"latency", "latency_ms", "elapsed", "duration", "duration_ms", "response_time"}), None)
        ep_col = next((c for c in (reader.fieldnames or []) if c.lower() in {"endpoint", "label", "name", "url", "path"}), None)
        st_col = next((c for c in (reader.fieldnames or []) if c.lower() in {"status", "status_code", "responsecode", "code"}), None)

        for row in reader:
            total_rows += 1
            ep = (row.get(ep_col) if ep_col else "default") or "default"
            st = (row.get(st_col) if st_col else "unknown") or "unknown"
            status_counts[st.strip()] += 1
            if lat_col and row.get(lat_col):
                try:
                    v = float(row[lat_col])
                    latencies.append(v)
                    per_endpoint[ep.strip()].append(v)
                except ValueError:
                    pass

    return {
        "source_file": os.path.abspath(filepath),
        "detected_format": "generic_csv",
        "total_raw_csv_rows": total_rows,
        "total_http_requests": total_rows,
        "duration_seconds": 0,
        "average_rps": 0.0,
        "peak_1s_rps": 0,
        "http_req_duration_ms": summarize_samples(latencies),
        "iteration_duration_ms": None,
        "status_distribution": dict(sorted(status_counts.items())),
        "expected_response_false_count": 0,
        "expected_response_false_rate_pct": 0.0,
        "server_5xx_or_network_errors": sum(c for k, c in status_counts.items() if k.startswith("5") or k == "0"),
        "server_5xx_error_rate_pct": 0.0,
        "checks": None,
        "per_group_type_ms": {},
        "per_endpoint_ms": {ep: summarize_samples(v) for ep, v in sorted(per_endpoint.items())},
        "latency_trend_slices": [],
    }


def build_time_slices(ts_latencies: List[Tuple[int, float]], num_slices: int = 6) -> List[Dict]:
    if not ts_latencies:
        return []
    min_t = min(t for t, _ in ts_latencies)
    max_t = max(t for t, _ in ts_latencies)
    span = max(1, max_t - min_t + 1)
    slice_w = max(1, math.ceil(span / num_slices))
    buckets: Dict[int, List[float]] = defaultdict(list)
    for t, lat in ts_latencies:
        idx = min(num_slices - 1, (t - min_t) // slice_w)
        buckets[idx].append(lat)

    out = []
    for idx in range(num_slices):
        vals = buckets.get(idx, [])
        if not vals:
            continue
        start_rel = idx * slice_w
        end_rel = min(span, (idx + 1) * slice_w)
        s = summarize_samples(vals)
        out.append({
            "window": f"{start_rel}s-{end_rel}s",
            "samples": s["count"],
            "avg_ms": s["avg"],
            "p95_ms": s["p95"],
            "max_ms": s["max"],
        })
    return out


def format_markdown(report: Dict) -> str:
    d = report["http_req_duration_ms"]
    row_note = " *(Note: k6 CSV emits ~8-10 metric rows per HTTP request)*" if report["detected_format"] == "k6_csv" else ""
    lines = [
        f"# Ground-Truth Performance Analysis (`{os.path.basename(report['source_file'])}`)",
        "",
        f"- **Detected Format:** `{report['detected_format']}`",
        f"- **Total Raw CSV Rows:** `{report['total_raw_csv_rows']:,}`{row_note}",
        f"- **Actual HTTP Requests:** `{report['total_http_requests']:,}`",
        f"- **Observed Duration:** `{report['duration_seconds']} s`",
        f"- **Throughput:** Avg `{report['average_rps']} req/s` | Peak 1s `{report['peak_1s_rps']} req/s`",
        f"- **Server 5xx / Network Errors:** `{report['server_5xx_or_network_errors']}` (`{report['server_5xx_error_rate_pct']}%`)",
        f"- **Flagged Failed / Non-Expected Responses:** `{report['expected_response_false_count']}` (`{report['expected_response_false_rate_pct']}%`)",
        "",
        "## 1. Overall Latency (`http_req_duration`, ms)",
        "",
        "| Samples | Min | Avg | Med (p50) | p90 | p95 | p99 | Max |",
        "|---:|---:|---:|---:|---:|---:|---:|---:|",
        f"| {d['count']:,} | {d['min']} | {d['avg']} | {d['med']} | {d['p90']} | {d['p95']} | {d['p99']} | {d['max']} |",
        "",
    ]

    if report.get("iteration_duration_ms") and report["iteration_duration_ms"]["count"] > 0:
        it = report["iteration_duration_ms"]
        lines += [
            "## 2. End-to-End Iteration Duration (includes think-time, ms)",
            "",
            f"- Iterations: `{it['count']:,}` | Avg: `{it['avg']} ms` | Med: `{it['med']} ms` | p95: `{it['p95']} ms` | Max: `{it['max']} ms`",
            "",
        ]

    lines += [
        "## 3. HTTP Status Code Distribution",
        "",
        "| HTTP Status | Count | Share (%) |",
        "|---|---:|---:|",
    ]
    tot = max(1, report["total_http_requests"])
    for code, cnt in report["status_distribution"].items():
        lines.append(f"| `{code}` | {cnt:,} | {(cnt / tot) * 100:.2f}% |")
    lines.append("")

    if report.get("per_endpoint_ms"):
        lines += [
            "## 4. Per-Endpoint Latency Breakdown (ms)",
            "",
            "| Endpoint | Samples | Avg | Med (p50) | p90 | p95 | p99 | Max | 5xx Rate |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
        for ep, s in report["per_endpoint_ms"].items():
            lines.append(
                f"| `{ep}` | {s['count']:,} | {s['avg']} | {s['med']} | {s['p90']} | {s['p95']} | {s['p99']} | {s['max']} | {s.get('server_5xx_rate_pct', 0.0)}% |"
            )
        lines.append("")

    if report.get("latency_trend_slices"):
        lines += [
            "## 5. Latency Trend Over Time (Soak / Stability Check)",
            "",
            "| Window | Samples | Avg (ms) | p95 (ms) | Max (ms) |",
            "|---|---:|---:|---:|---:|",
        ]
        for sl in report["latency_trend_slices"]:
            lines.append(f"| `{sl['window']}` | {sl['samples']:,} | {sl['avg_ms']} | {sl['p95_ms']} | {sl['max_ms']} |")
        lines.append("")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Universal ground-truth performance log analyzer (k6 CSV / JMeter JTL / Generic CSV).")
    parser.add_argument("logfile", help="Path to raw performance log (.csv or .jtl)")
    parser.add_argument("--json", dest="json_out", help="Optional path to write JSON output")
    parser.add_argument("--md", dest="md_out", help="Optional path to write Markdown summary")
    args = parser.parse_args()

    if not os.path.isfile(args.logfile):
        print(f"ERROR: File not found: {args.logfile}", file=sys.stderr)
        sys.exit(1)

    with open(args.logfile, "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.reader(f)
        header = next(reader, [])

    fmt = detect_format(header)
    if fmt == "k6_csv":
        report = analyze_k6_csv(args.logfile)
    elif fmt == "jmeter_jtl":
        report = analyze_jmeter_jtl(args.logfile)
    else:
        report = analyze_generic_csv(args.logfile)

    md_text = format_markdown(report)
    print(md_text)

    if args.json_out:
        os.makedirs(os.path.dirname(os.path.abspath(args.json_out)), exist_ok=True)
        with open(args.json_out, "w", encoding="utf-8") as jf:
            json.dump(report, jf, indent=2)

    if args.md_out:
        os.makedirs(os.path.dirname(os.path.abspath(args.md_out)), exist_ok=True)
        with open(args.md_out, "w", encoding="utf-8") as mf:
            mf.write(md_text + "\n")


if __name__ == "__main__":
    main()
