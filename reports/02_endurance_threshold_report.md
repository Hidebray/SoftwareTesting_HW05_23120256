# 02 — Endurance / Soak Test & Hardware Threshold Report (12 Minutes)

> **Bài tập:** HW05 – Performance Testing (Task 1 — Determine Endurance Threshold)  
> **Sinh viên:** Trần Đại Hiệp (`23120256`)  
> **Máy kiểm thử:** `TRAN_DAI_HIEP` (Intel Core i7-13620H 10C/16T, 16 GB RAM, Windows 11 Home 64-bit)  
> **Kịch bản:** [23120256_Endurance_20261122.js](../test-plans/23120256_Endurance_20261122.js) — `0 → 40 VUs (30s)` → `Hold 40 VUs (11m)` → `40 → 0 (30s)` *(tổng 12 phút)*  
> **Bằng chứng:** [endurance_mid_monitor.jpg](../proof-image/endurance_mid_monitor.jpg), [endurance_summary.jpg](../proof-image/endurance_summary.jpg), [endurance_resource_log.csv](endurance_resource_log.csv), [ground_truth_Endurance.md](ground_truth_Endurance.md), [endurance-soak-report/index.html](../html-reports/endurance-soak-report/index.html)

---

## 1. Kết Luận Ngưỡng Chịu Tải Thực Nghiệm Trên Phần Cứng `TRAN_DAI_HIEP`

| Chỉ số ngưỡng phần cứng (Hardware Endurance Threshold) | Giá trị thực nghiệm đo được | Diễn giải kỹ thuật |
|---|---|---|
| **Tổng khối lượng xử lý (12 phút)** | **`183,756` HTTP requests** (`20,779` iterations, `2,334,720` raw CSV rows) | 0 iteration bị ngắt, `0.00%` lỗi 5xx/network |
| **Max Stable Sustained RPS (Endurance 12m)** | **`254.86 req/s`** *(Peak 1s: **`322 req/s`**)* | Duy trì bền vững 12 phút ở `40 VUs` không sập, `p95 = 42.34 ms` |
| **Short-Burst Ceiling (đối chiếu từ Stress)** | **`600.25 req/s`** avg *(Peak 1s: **`1,278 req/s`**)* | Tại `150–200 VUs`, `p95` trượt lên `146–197 ms` và 1 nhân Node.js chạm trần |
| **Độ trễ ổn định (Overall Endurance Latency)** | `avg = 14.41 ms` \| `p50 = 7.18 ms` \| **`p95 = 42.34 ms`** \| `p99 = 128.70 ms` | Đạt chuẩn SLA (`p95 < 500 ms`), nhưng xuất hiện tail spike `max = 1,216.07 ms` ở phút 10–12 |
| **CPU Ceiling (`node.exe`, PID `6304`)** | **Avg `3.70%` \| Peak `4.47%`** *(tổng CPU 16 luồng)* | Tương đương **~`71.5%` công suất 1 nhân logic** (Node.js single-threaded event loop) |
| **Memory Ceiling (`node.exe`, PID `6304`)** | **Idle `55.41 MB` → Warm `172.40 MB` → Peak `177.11 MB` Working Set** *(Private Mem peak `213.23 MB`)* | Sau pha warm-up 60s, mức tăng chỉ **`+0.45 MB/phút`** (`+4.71 MB` / 10.5 phút), Handles ổn định `249–250` → **không có memory leak mất kiểm soát** trên luồng Coupon/Order |

---

## 2. Diễn Biến Độ Trễ Theo 6 Cửa Sổ Thời Gian (2 Phút / Cửa Sổ)

| Cửa sổ thời gian | Samples | Avg (ms) | p95 (ms) | Max (ms) | Nhận xét |
|---|---:|---:|---:|---:|---|
| `0s – 121s` | 27,230 | 18.28 | 56.26 | 491.21 | Pha ramp-up & V8 JIT warm-up (RAM tăng 55 → 172 MB) |
| `121s – 242s` | 32,077 | 14.98 | 45.49 | 423.15 | Ổn định tốt ở 40 VUs |
| `242s – 363s` | 32,235 | 14.22 | 41.78 | 573.32 | Ổn định tốt |
| `363s – 484s` | 32,378 | 13.37 | 41.65 | 411.03 | Ổn định tốt |
| `484s – 605s` | 32,972 | 10.79 | 34.28 | 430.26 | Hiệu năng tối ưu nhất sau JIT warm-up |
| `605s – 721s` | 26,864 | **15.72** | 33.36 | **1,216.07** | Xuất hiện **tail spike `1.22s`** (V8 major GC / SQLite sync flush khi `coupon_usage` đạt `17,524` dòng) |

---

## 3. Hồ Sơ Tài Nguyên Phần Cứng Theo Thời Gian (`endurance_resource_log.csv` — 24 mẫu)

| Mốc thời gian | Elapsed (s) | CPU % (16T System) | Working Set RAM (MB) | Private Mem (MB) | Threads | Handles |
|---|---:|---:|---:|---:|---:|---:|
| `16:24:32` | 0 | 0.00% | 55.41 | 63.91 | 16 | 214 |
| `16:25:02` | 30 | 2.73% | 117.02 | 141.43 | 13 | 250 |
| `16:25:32` | 60 | 3.99% | 172.40 | 209.22 | 13 | 249 |
| `16:27:32` | 180 | **4.47%** *(Peak)* | 173.02 | 208.87 | 12 | 250 |
| `16:29:32` | 300 | 4.05% | 174.32 | 210.70 | 13 | 249 |
| `16:31:32` | 420 | 3.63% | 174.02 | 209.75 | 12 | 249 |
| `16:33:32` | 541 | 3.49% | 173.62 | 209.43 | 12 | 250 |
| `16:35:32` | 661 | 3.77% | **177.11** *(Peak)* | 213.21 | 13 | 250 |
| `16:36:02` | 691 | 3.18% | 176.72 | 212.88 | 12 | 249 |

---

## 4. Cải Tiến Kỹ Thuật Từ Stress → Endurance (Đầu vào nâng cấp Skill `v1.1`)
Bằng cách bổ sung thẻ `tags: { name: "DELETE /api/admin/coupons/:id" }` vào request xóa coupon theo ID động trong kịch bản Endurance, **cảnh báo `>100,000 unique time series`** gặp phải ở bài Stress đã được **loại bỏ hoàn toàn** dù bài Endurance gửi tới `183,756` requests (nhiều hơn Stress `20.5%`!).
