# Ground-Truth Performance Analysis (`23120256_Load_20261121.csv`)

- **Detected Format:** `k6_csv`
- **Total Raw CSV Rows:** `186,558` *(Note: k6 CSV emits ~8-10 metric rows per HTTP request)*
- **Actual HTTP Requests:** `14,814`
- **Observed Duration:** `182 s`
- **Throughput:** Avg `81.396 req/s` | Peak 1s `119 req/s`
- **Server 5xx / Network Errors:** `0` (`0.0%`)
- **Flagged Failed / Non-Expected Responses:** `0` (`0.0%`)

## 1. Overall Latency (`http_req_duration`, ms)

| Samples | Min | Avg | Med (p50) | p90 | p95 | p99 | Max |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 14,814 | 0.0 | 5.951 | 3.588 | 11.819 | 16.476 | 38.898 | 307.525 |

## 2. End-to-End Iteration Duration (includes think-time, ms)

- Iterations: `1,675` | Avg: `1811.531 ms` | Med: `1827.014 ms` | p95: `2209.826 ms` | Max: `2673.508 ms`

## 3. HTTP Status Code Distribution

| HTTP Status | Count | Share (%) |
|---|---:|---:|
| `200` | 12,878 | 86.93% |
| `400` | 261 | 1.76% |
| `404` | 1,675 | 11.31% |

## 4. Per-Endpoint Latency Breakdown (ms)

| Endpoint | Samples | Avg | Med (p50) | p90 | p95 | p99 | Max | 5xx Rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `delete_admin_coupon` | 1,675 | 8.59 | 6.584 | 14.894 | 19.89 | 38.666 | 130.525 | 0.0% |
| `get_admin_orders` | 1,675 | 3.914 | 2.45 | 8.167 | 13.406 | 25.225 | 63.077 | 0.0% |
| `get_coupons` | 1,675 | 5.108 | 2.457 | 8.203 | 13.865 | 60.872 | 283.502 | 0.0% |
| `get_users_me` | 1,675 | 3.914 | 2.107 | 8.088 | 13.317 | 27.427 | 122.097 | 0.0% |
| `post_admin_coupons` | 1,675 | 9.766 | 7.152 | 15.69 | 22.265 | 60.993 | 215.748 | 0.0% |
| `post_apply_coupon` | 1,675 | 5.188 | 2.996 | 11.188 | 17.218 | 34.871 | 69.919 | 0.0% |
| `post_coupon_usage` | 1,414 | 8.534 | 6.638 | 14.499 | 19.571 | 33.91 | 307.525 | 0.0% |
| `post_login` | 1,675 | 5.087 | 2.871 | 8.441 | 13.986 | 45.255 | 251.716 | 0.0% |
| `verify_coupon_revoked` | 1,675 | 3.863 | 2.166 | 8.325 | 12.531 | 24.75 | 84.313 | 0.0% |

## 5. Latency Trend Over Time (Soak / Stability Check)

| Window | Samples | Avg (ms) | p95 (ms) | Max (ms) |
|---|---:|---:|---:|---:|
| `0s-31s` | 1,536 | 3.986 | 9.613 | 71.464 |
| `31s-62s` | 3,061 | 3.501 | 8.424 | 66.83 |
| `62s-93s` | 3,035 | 3.676 | 9.643 | 108.425 |
| `93s-124s` | 2,978 | 8.906 | 25.469 | 139.279 |
| `124s-155s` | 3,002 | 8.866 | 24.497 | 307.525 |
| `155s-182s` | 1,202 | 5.844 | 15.059 | 59.557 |

