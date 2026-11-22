# HW05 – Performance Testing on EShop REST Backend API (k6)

> **Môn học:** Kiểm thử phần mềm (Software Testing) – FIT@HCMUS  
> **Bài tập:** HW05 – Performance Testing (AI-First + Human Review)  
> **Sinh viên:** Trần Đại Hiệp  
> **Mã số sinh viên (MSSV):** `23120256`  
> **Email:** `23120256@student.hcmus.edu.vn`  
> **Hệ thống kiểm thử (SUT):** [EShop Backend API (`eshop-sut/backend`)](https://github.com/ttbhanh/eshop-sut)  
> **Công cụ kiểm thử:** Grafana `k6 v2.4.0` *(Bonus Tool)*  
> **Workflow kiểm thử:** **Coupon Campaign, Discount Redemption & Order Monitoring** *(Pool A FR-02/FR-04 + Pool B FR-09 + Pool C FR-17/FR-18 — 0% trùng lặp nhóm)*  
> **Public GitHub Repository:** [https://github.com/Hidebray/SoftwareTesting_HW05_23120256](https://github.com/Hidebray/SoftwareTesting_HW05_23120256)  
> **GitHub Issues (4 Lỗi Thực Nghiệm):** [https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues](https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues)  
> **Video Demo Chính (YouTube Unlisted, ≥ 6 phút):** [https://youtu.be/bVsE9-UECbU](https://youtu.be/bVsE9-UECbU)  
> **Video Demo Agent Skill (Mục 7):** *Không quay video riêng (đã tự trừ 5/10 điểm ở tiêu chí Agent Skills; vẫn nộp đủ Skill `v1.1` và bằng chứng chạy thực tế end-to-end tại `skill-demo/`)*

---

## 1. Bảng Tự Đánh Giá (Self-Assessment Table — Mục 15)

| No. | Criteria | Grade | Self-Assessed Grade |
|:---:|---|:---:|:---:|
| 1 | Task 1 — Load testing *(kèm Endurance, Hardware, Bug Report, Video Demo)* | 30 | **30** |
| 2 | Task 1 — Stress testing | 20 | **20** |
| 3 | Task 1 — Spike testing | 20 | **20** |
| 4 | Task 2 — AI analysis + misinterpretation hunt (with correct values from raw logs) | 10 | **10** |
| 5 | Task 3 — Continuous Performance Testing proposal (G9.6) | 10 | **10** |
| 6 | Agent Skills *(trừ 5đ do không quay video demo riêng cho Skill theo Mục 7)* | 10 | **5** |
| | **Total** | **100** | **095** |

> **Tên file nộp bài chuẩn:** `23120256_HW05_AI_Performance_095.zip`

---

## 2. Test Summary Report (Mục 14)

### 2.1 Các Kịch Bản Đã Thực Thi & Kết Quả Ground-Truth (`analyze_perf_logs.py`)

| Scenario | Test Plan File | HTTP Reqs | Avg / Peak 1s RPS | Avg / p50 / p95 / p99 / Max (ms) | 5xx Errors | Distinct Report View |
|---|---|---:|---:|---|---:|---|
| **Load** *(20 VUs, 3m)* | `test-plans/23120256_Load_20261121.js` | `14,814` | `81.40` / `119` | `5.95` / `3.59` / **`16.48`** / `38.90` / `307.53` | `0` (`0.0%`) | View 1: `html-reports/load-trace-report/index.html` |
| **Stress** *(→200 VUs, 4m15s)* | `test-plans/23120256_Stress_20261121.js` | `152,463` | `600.25` / **`1,278`** | `47.56` / `31.64` / **`146.01`** / `269.89` / `592.84` | `0` (`0.0%`) | View 2: `html-reports/stress-dashboard-report/index.html` |
| **Spike** *(10→180→10 VUs, 2m40s)* | `test-plans/23120256_Spike_20261121.js` | `40,445` | `255.98` / **`946`** | `217.13` / `200.37` / **`532.45`** / `658.81` / `984.08` | `0` (`0.0%`) | View 3: `html-reports/spike-aggregate-report/index.html` |
| **Endurance** *(40 VUs, 12m)* | `test-plans/23120256_Endurance_20261122.js` | `183,756` | `254.86` / `322` | `14.41` / `7.18` / **`42.34`** / `128.70` / `1,216.07` | `0` (`0.0%`) | `html-reports/endurance-soak-report/index.html` |

### 2.2 Nhóm Endpoint Đã Bao Phủ
- **Auth-heavy:** `POST /api/login` *(pool 30 tài khoản admin + 3 tài khoản cô lập `lockout_probe`)*, `GET /api/users/me`.
- **Read-heavy:** `GET /api/coupons`, `GET /api/admin/orders` *(`LEFT JOIN orders + users`)*.
- **Transactional & Verification:** `POST /api/admin/coupons`, `POST /api/apply-coupon`, `POST /api/coupon-usage`, `DELETE /api/admin/coupons/:id`, `POST /api/apply-coupon` *(verify `404` sau khi xóa)*.
- **Nhóm Endpoint Phụ Demo Agent Skill `v1.1` (`skill-demo/`):** **Admin Product Catalog & Bulk CSV Import** (`POST /api/login`, `GET/POST/PUT/DELETE /api/products`, `POST /api/admin/import-products` — `1,632` requests, `62.77 req/s`, `0.00%` lỗi).

### 2.3 Ngưỡng Chịu Tải Phần Cứng Thực Nghiệm (Endurance Threshold — `TRAN_DAI_HIEP`)
- **Thiết bị:** LENOVO `82YA` — Intel Core i7-13620H (10C/16T), 16 GB RAM, Windows 11 Home 64-bit (`proof-image/hardware_dxdiag.jpg`).
- **Max Stable Sustained RPS (12 phút, 0% 5xx):** **`254.86 req/s`** *(Peak 1s: **`322 req/s`**)* ở `40 VUs`; Short-burst ceiling (Stress): **`600.25 req/s`** avg / **`1,278 req/s`** peak 1s.
- **CPU Ceiling (`node.exe`):** Avg **`3.70%`** | Peak **`4.47%`** *(tổng 16 threads ≈ 71.5% của 1 nhân đơn luồng Node.js)*.
- **Memory Ceiling (`node.exe`):** Idle `55.41 MB` → Warm `172.40 MB` → Peak **`177.11 MB` Working Set** (`213.23 MB` Private Memory, drift `+0.45 MB/phút`, Handles ổn định `249–250`).

### 2.4 Số Lượng Bug / Vấn Đề Hiệu Năng Đã Báo Cáo
- **4 Issues thực nghiệm** đã đăng kèm labels màu & ảnh chụp RAW tại [GitHub Issues](https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues):
  - **#1 (`BUG-HW05-01`):** Account lockout khóa sớm ở lần sai thứ 2 (`login_attempts + 2`).
  - **#2 (`BUG-HW05-02`):** Công thức coupon `%` tính giảm giá âm, tăng giá 10x (`287` Load / `2,890` Stress / `3,534` Endurance hits).
  - **#3 (`BUG-HW05-03`):** Kiểm tra `min_order_amount` dùng `>` thay vì `>=` (`27` lần từ chối sai biên).
  - **#4 (`BUG-HW05-04`):** Nút cổ chai `POST /api/apply-coupon` (`p95` tăng 37.7x lên `648.92 ms` ở Spike; `max = 1,109 ms` ở Endurance).

### 2.5 Liên Kết Nhanh Tài Liệu Nộp Bài
- **Main Report (MD + PDF):** [reports/HW05_Main_Report.md](reports/HW05_Main_Report.md) | [reports/HW05_Main_Report.pdf](reports/HW05_Main_Report.pdf)
- **Bug Report:** [reports/bug_reports.md](reports/bug_reports.md) | [GitHub Issues](https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues)
- **AI Audit & AI Critique (MD + PDF):** [AI/AI_Audit.md](AI/AI_Audit.md) ([PDF](AI/AI_Audit.pdf)) | [AI/AI_Critical.md](AI/AI_Critical.md) ([PDF](AI/AI_Critical.pdf))
- **Agent Skill (`v1.1`):** [skills/performance-tester/SKILL.md](skills/performance-tester/SKILL.md)
- **Git Commit Log:** [git-commit-log.txt](git-commit-log.txt)
- **Demo Video Chính (YouTube Unlisted, ≥ 6 phút):** [https://youtu.be/bVsE9-UECbU](https://youtu.be/bVsE9-UECbU) *(k6 + Task Manager cùng khung hình, thuyết minh Tiếng Việt)*

---

## 3. Hướng Dẫn Chạy Nhanh Môi Trường SUT

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
powershell -ExecutionPolicy Bypass -File scripts/reset_sut.ps1
```
