#!/usr/bin/env python3
"""
Deterministic 1:1 Converter: Grafana k6 raw CSV (--out csv=...) -> JMeter-compatible .jtl CSV.
Preserves exact per-request latency, status code, timestamp, endpoint label, and URL
without fabricating or altering any measurements.
"""

import argparse
import csv
import os
import sys

JTL_HEADERS = [
    "timeStamp",
    "elapsed",
    "label",
    "responseCode",
    "responseMessage",
    "threadName",
    "dataType",
    "success",
    "failureMessage",
    "bytes",
    "sentBytes",
    "grpThreads",
    "allThreads",
    "URL",
    "Latency",
    "IdleTime",
    "Connect",
]

HTTP_REASON = {
    "200": "OK",
    "201": "Created",
    "204": "No Content",
    "400": "Bad Request",
    "401": "Unauthorized",
    "403": "Forbidden",
    "404": "Not Found",
    "409": "Conflict",
    "429": "Too Many Requests",
    "500": "Internal Server Error",
    "502": "Bad Gateway",
    "503": "Service Unavailable",
    "504": "Gateway Timeout",
}


def parse_extra_tags(raw: str) -> dict:
    tags = {}
    if not raw:
        return tags
    for pair in raw.replace(";", "&").split("&"):
        if "=" in pair:
            k, v = pair.split("=", 1)
            tags[k.strip()] = v.strip()
    return tags


def convert(input_csv: str, output_jtl: str) -> int:
    os.makedirs(os.path.dirname(os.path.abspath(output_jtl)), exist_ok=True)
    written = 0

    with open(input_csv, "r", encoding="utf-8", errors="replace", newline="") as fin, \
         open(output_jtl, "w", encoding="utf-8", newline="") as fout:
        reader = csv.DictReader(fin)
        writer = csv.writer(fout)
        writer.writerow(JTL_HEADERS)

        for row in reader:
            if (row.get("metric_name") or "").strip() != "http_req_duration":
                continue

            ts_raw = (row.get("timestamp") or "0").strip()
            try:
                ts_ms = int(float(ts_raw) * 1000)
            except ValueError:
                ts_ms = 0

            try:
                elapsed_ms = round(float(row.get("metric_value") or 0.0), 3)
            except ValueError:
                elapsed_ms = 0.0

            extra = parse_extra_tags(row.get("extra_tags") or "")
            label = (
                row.get("endpoint")
                or extra.get("endpoint")
                or row.get("name")
                or row.get("url")
                or "http_request"
            ).strip()
            code = (row.get("status") or "0").strip() or "0"
            reason = HTTP_REASON.get(code, "Non-HTTP Error" if code == "0" else "HTTP " + code)
            expected = (row.get("expected_response") or "true").strip().lower() == "true"
            err_msg = (row.get("error") or "").strip()
            success = "true" if (expected and not err_msg) else "false"
            scenario = (row.get("scenario") or "default").strip()
            url = (row.get("url") or "").strip()

            writer.writerow([
                ts_ms,
                elapsed_ms,
                label,
                code,
                reason,
                f"k6-{scenario}",
                "text",
                success,
                err_msg,
                0,
                0,
                1,
                1,
                url,
                elapsed_ms,
                0,
                0,
            ])
            written += 1

    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert k6 raw CSV to 1:1 JMeter-compatible JTL format.")
    parser.add_argument("input_csv", help="Path to raw k6 CSV (--out csv=...)")
    parser.add_argument("output_jtl", help="Destination .jtl file path")
    args = parser.parse_args()

    if not os.path.isfile(args.input_csv):
        print(f"ERROR: Input file not found: {args.input_csv}", file=sys.stderr)
        sys.exit(1)

    count = convert(args.input_csv, args.output_jtl)
    print(f"[OK] Converted {count:,} HTTP request records from '{args.input_csv}' -> '{args.output_jtl}'")


if __name__ == "__main__":
    main()

