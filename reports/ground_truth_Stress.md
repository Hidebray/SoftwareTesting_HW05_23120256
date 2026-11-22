# Ground-Truth Performance Analysis (`23120256_Stress_20261121.csv`)

- **Detected Format:** `k6_csv`
- **Total Raw CSV Rows:** `1,801,175` *(Note: k6 CSV emits ~8-10 metric rows per HTTP request)*
- **Actual HTTP Requests:** `152,463`
- **Observed Duration:** `254 s`
- **Throughput:** Avg `600.248 req/s` | Peak 1s `1278 req/s`
- **Server 5xx / Network Errors:** `0` (`0.0%`)
- **Flagged Failed / Non-Expected Responses:** `0` (`0.0%`)

## 1. Overall Latency (`http_req_duration`, ms)

| Samples | Min | Avg | Med (p50) | p90 | p95 | p99 | Max |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 152,463 | 0.0 | 47.563 | 31.635 | 110.3 | 146.013 | 269.887 | 592.84 |

## 2. End-to-End Iteration Duration (includes think-time, ms)

- Iterations: `17,239` | Avg: `1272.094 ms` | Med: `1242.982 ms` | p95: `1895.98 ms` | Max: `2396.238 ms`

## 3. HTTP Status Code Distribution

| HTTP Status | Count | Share (%) |
|---|---:|---:|
| `200` | 132,542 | 86.93% |
| `400` | 2,673 | 1.75% |
| `401` | 3 | 0.00% |
| `403` | 9 | 0.01% |
| `404` | 17,236 | 11.31% |

## 4. Per-Endpoint Latency Breakdown (ms)

| Endpoint | Samples | Avg | Med (p50) | p90 | p95 | p99 | Max | 5xx Rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `delete_admin_coupon` | 17,236 | 49.837 | 37.355 | 111.371 | 139.065 | 223.569 | 523.417 | 0.0% |
| `get_admin_orders` | 17,236 | 37.546 | 24.42 | 87.164 | 113.508 | 191.075 | 526.006 | 0.0% |
| `get_coupons` | 17,236 | 42.874 | 24.735 | 100.667 | 150.881 | 297.47 | 527.565 | 0.0% |
| `get_users_me` | 17,236 | 37.36 | 23.196 | 88.123 | 113.509 | 188.8 | 522.291 | 0.0% |
| `post_admin_coupons` | 17,236 | 53.874 | 36.418 | 121.207 | 175.808 | 316.521 | 527.209 | 0.0% |
| `post_apply_coupon` | 17,236 | 71.028 | 54.058 | 159.268 | 202.496 | 349.498 | 592.84 | 0.0% |
| `post_coupon_usage` | 14,563 | 48.935 | 37.885 | 108.692 | 136.083 | 211.657 | 528.829 | 0.0% |
| `post_login` | 17,236 | 42.851 | 25.655 | 98.991 | 138.506 | 276.552 | 528.296 | 0.0% |
| `post_login_lockout_probe` | 12 | 3.646 | 3.738 | 4.836 | 4.887 | 4.887 | 4.887 | 0.0% |
| `verify_coupon_revoked` | 17,236 | 44.006 | 32.579 | 102.862 | 126.296 | 199.705 | 523.92 | 0.0% |

## 5. Latency Trend Over Time (Soak / Stability Check)

| Window | Samples | Avg (ms) | p95 (ms) | Max (ms) |
|---|---:|---:|---:|---:|
| `0s-43s` | 4,137 | 3.761 | 7.786 | 99.572 |
| `43s-86s` | 13,934 | 7.321 | 16.966 | 389.032 |
| `86s-129s` | 27,098 | 16.033 | 53.162 | 262.042 |
| `129s-172s` | 34,950 | 49.206 | 123.393 | 532.521 |
| `172s-215s` | 43,083 | 69.311 | 168.744 | 592.84 |
| `215s-254s` | 29,261 | 68.135 | 197.15 | 585.751 |

