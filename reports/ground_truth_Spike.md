# Ground-Truth Performance Analysis (`23120256_Spike_20261121.csv`)

- **Detected Format:** `k6_csv`
- **Total Raw CSV Rows:** `513,104` *(Note: k6 CSV emits ~8-10 metric rows per HTTP request)*
- **Actual HTTP Requests:** `40,445`
- **Observed Duration:** `158 s`
- **Throughput:** Avg `255.981 req/s` | Peak 1s `946 req/s`
- **Server 5xx / Network Errors:** `0` (`0.0%`)
- **Flagged Failed / Non-Expected Responses:** `0` (`0.0%`)

## 1. Overall Latency (`http_req_duration`, ms)

| Samples | Min | Avg | Med (p50) | p90 | p95 | p99 | Max |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 40,445 | 0.0 | 217.128 | 200.374 | 471.021 | 532.45 | 658.807 | 984.082 |

## 2. End-to-End Iteration Duration (includes think-time, ms)

- Iterations: `4,573` | Avg: `2477.16 ms` | Med: `2848.369 ms` | p95: `4246.448 ms` | Max: `4802.843 ms`

## 3. HTTP Status Code Distribution

| HTTP Status | Count | Share (%) |
|---|---:|---:|
| `200` | 35,166 | 86.95% |
| `400` | 697 | 1.72% |
| `401` | 6 | 0.01% |
| `403` | 6 | 0.01% |
| `404` | 4,570 | 11.30% |

## 4. Per-Endpoint Latency Breakdown (ms)

| Endpoint | Samples | Avg | Med (p50) | p90 | p95 | p99 | Max | 5xx Rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `delete_admin_coupon` | 4,570 | 232.975 | 217.021 | 489.607 | 540.031 | 625.093 | 918.011 | 0.0% |
| `get_admin_orders` | 4,570 | 190.033 | 187.816 | 396.393 | 459.182 | 581.446 | 729.668 | 0.0% |
| `get_coupons` | 4,570 | 236.462 | 232.175 | 488.609 | 527.737 | 667.109 | 930.236 | 0.0% |
| `get_users_me` | 4,570 | 179.739 | 171.623 | 379.224 | 447.148 | 584.513 | 838.667 | 0.0% |
| `post_admin_coupons` | 4,570 | 235.72 | 232.307 | 482.87 | 525.103 | 671.0 | 943.824 | 0.0% |
| `post_apply_coupon` | 4,570 | 275.827 | 273.279 | 578.296 | 648.924 | 810.122 | 984.082 | 0.0% |
| `post_coupon_usage` | 3,873 | 182.305 | 167.439 | 395.944 | 457.447 | 608.713 | 788.552 | 0.0% |
| `post_login` | 4,570 | 239.277 | 227.738 | 493.103 | 543.469 | 667.591 | 932.584 | 0.0% |
| `post_login_lockout_probe` | 12 | 308.405 | 295.797 | 420.629 | 421.024 | 421.25 | 421.307 | 0.0% |
| `verify_coupon_revoked` | 4,570 | 176.264 | 167.011 | 379.243 | 448.2 | 582.737 | 742.192 | 0.0% |

## 5. Latency Trend Over Time (Soak / Stability Check)

| Window | Samples | Avg (ms) | p95 (ms) | Max (ms) |
|---|---:|---:|---:|---:|
| `0s-27s` | 1,973 | 5.06 | 13.567 | 64.605 |
| `27s-54s` | 11,303 | 282.518 | 572.434 | 943.824 |
| `54s-81s` | 13,258 | 304.266 | 546.917 | 984.082 |
| `81s-108s` | 8,105 | 183.052 | 487.131 | 909.147 |
| `108s-135s` | 3,786 | 8.039 | 21.511 | 340.523 |
| `135s-158s` | 2,020 | 15.065 | 57.65 | 478.506 |

