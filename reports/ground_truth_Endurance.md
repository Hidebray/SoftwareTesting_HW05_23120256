# Ground-Truth Performance Analysis (`23120256_Endurance_20261122.csv`)

- **Detected Format:** `k6_csv`
- **Total Raw CSV Rows:** `2,334,720` *(Note: k6 CSV emits ~8-10 metric rows per HTTP request)*
- **Actual HTTP Requests:** `183,756`
- **Observed Duration:** `721 s`
- **Throughput:** Avg `254.863 req/s` | Peak 1s `322 req/s`
- **Server 5xx / Network Errors:** `0` (`0.0%`)
- **Flagged Failed / Non-Expected Responses:** `0` (`0.0%`)

## 1. Overall Latency (`http_req_duration`, ms)

| Samples | Min | Avg | Med (p50) | p90 | p95 | p99 | Max |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 183,756 | 0.0 | 14.408 | 7.177 | 29.184 | 42.336 | 128.697 | 1216.067 |

## 2. End-to-End Iteration Duration (includes think-time, ms)

- Iterations: `20,779` | Avg: `1330.52 ms` | Med: `1316.686 ms` | p95: `1646.752 ms` | Max: `3766.615 ms`

## 3. HTTP Status Code Distribution

| HTTP Status | Count | Share (%) |
|---|---:|---:|
| `200` | 159,722 | 86.92% |
| `400` | 3,255 | 1.77% |
| `404` | 20,779 | 11.31% |

## 4. Per-Endpoint Latency Breakdown (ms)

| Endpoint | Samples | Avg | Med (p50) | p90 | p95 | p99 | Max | 5xx Rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `delete_admin_coupon` | 20,779 | 14.824 | 9.715 | 29.75 | 39.457 | 68.142 | 1216.067 | 0.0% |
| `get_admin_orders` | 20,779 | 10.663 | 5.093 | 24.824 | 35.966 | 73.95 | 962.762 | 0.0% |
| `get_coupons` | 20,779 | 16.052 | 4.813 | 28.776 | 50.492 | 195.97 | 1075.846 | 0.0% |
| `get_users_me` | 20,779 | 10.483 | 4.95 | 25.017 | 36.178 | 70.448 | 532.592 | 0.0% |
| `post_admin_coupons` | 20,779 | 20.679 | 9.817 | 34.761 | 57.277 | 196.19 | 970.905 | 0.0% |
| `post_apply_coupon` | 20,779 | 16.612 | 8.666 | 37.992 | 53.352 | 99.509 | 1109.345 | 0.0% |
| `post_coupon_usage` | 17,524 | 14.718 | 9.348 | 29.249 | 39.929 | 69.523 | 1202.98 | 0.0% |
| `post_login` | 20,779 | 16.072 | 5.481 | 29.069 | 48.227 | 203.355 | 1007.601 | 0.0% |
| `verify_coupon_revoked` | 20,779 | 9.621 | 5.295 | 22.039 | 30.747 | 54.665 | 963.337 | 0.0% |

## 5. Latency Trend Over Time (Soak / Stability Check)

| Window | Samples | Avg (ms) | p95 (ms) | Max (ms) |
|---|---:|---:|---:|---:|
| `0s-121s` | 27,230 | 18.283 | 56.264 | 491.205 |
| `121s-242s` | 32,077 | 14.978 | 45.487 | 423.15 |
| `242s-363s` | 32,235 | 14.218 | 41.784 | 573.322 |
| `363s-484s` | 32,378 | 13.366 | 41.653 | 411.032 |
| `484s-605s` | 32,972 | 10.792 | 34.276 | 430.257 |
| `605s-721s` | 26,864 | 15.724 | 33.358 | 1216.067 |

