# Ground-Truth Performance Analysis (`skill_demo_raw.csv`)

- **Detected Format:** `k6_csv`
- **Total Raw CSV Rows:** `22,082` *(Note: k6 CSV emits ~8-10 metric rows per HTTP request)*
- **Actual HTTP Requests:** `1,632`
- **Observed Duration:** `26 s`
- **Throughput:** Avg `62.769 req/s` | Peak 1s `88 req/s`
- **Server 5xx / Network Errors:** `0` (`0.0%`)
- **Flagged Failed / Non-Expected Responses:** `0` (`0.0%`)

## 1. Overall Latency (`http_req_duration`, ms)

| Samples | Min | Avg | Med (p50) | p90 | p95 | p99 | Max |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,632 | 0.51 | 16.876 | 12.354 | 33.998 | 44.005 | 71.589 | 178.744 |

## 2. End-to-End Iteration Duration (includes think-time, ms)

- Iterations: `272` | Avg: `605.624 ms` | Med: `594.237 ms` | p95: `709.682 ms` | Max: `845.99 ms`

## 3. HTTP Status Code Distribution

| HTTP Status | Count | Share (%) |
|---|---:|---:|
| `200` | 1,632 | 100.00% |

## 4. Per-Endpoint Latency Breakdown (ms)

| Endpoint | Samples | Avg | Med (p50) | p90 | p95 | p99 | Max | 5xx Rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `delete_product_id` | 272 | 13.007 | 10.147 | 24.308 | 29.226 | 47.233 | 83.484 | 0.0% |
| `get_products` | 272 | 17.88 | 15.224 | 36.407 | 43.039 | 72.273 | 79.147 | 0.0% |
| `post_bulk_import` | 272 | 30.079 | 25.06 | 53.207 | 59.813 | 87.501 | 178.744 | 0.0% |
| `post_login` | 272 | 12.486 | 7.166 | 26.433 | 33.532 | 100.333 | 132.156 | 0.0% |
| `post_products` | 272 | 13.627 | 9.612 | 28.289 | 35.262 | 45.343 | 107.704 | 0.0% |
| `put_product_id` | 272 | 14.176 | 9.691 | 26.449 | 33.941 | 59.247 | 152.442 | 0.0% |

## 5. Latency Trend Over Time (Soak / Stability Check)

| Window | Samples | Avg (ms) | p95 (ms) | Max (ms) |
|---|---:|---:|---:|---:|
| `0s-5s` | 212 | 10.826 | 26.684 | 55.179 |
| `5s-10s` | 398 | 15.516 | 43.199 | 86.347 |
| `10s-15s` | 376 | 20.757 | 55.191 | 164.226 |
| `15s-20s` | 396 | 16.17 | 39.007 | 83.484 |
| `20s-25s` | 246 | 19.589 | 49.592 | 178.744 |
| `25s-26s` | 4 | 11.165 | 14.681 | 14.857 |

