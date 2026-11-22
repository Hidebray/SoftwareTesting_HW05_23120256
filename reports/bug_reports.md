# Bug & Performance Issues Report — EShop Backend API (HW05)

> **Hệ thống kiểm thử (SUT):** EShop REST Backend (`https://github.com/ttbhanh/eshop-sut`)  
> **Sinh viên:** Trần Đại Hiệp (`23120256`)  
> **Phương pháp phát hiện:** **100% Thực nghiệm trực tiếp trong các phiên chạy k6** (Load, Stress, Spike, Endurance 12 phút) + đối chiếu Ground-Truth từ raw logs (`analyze_perf_logs.py`). Toàn bộ ảnh minh chứng đều được chụp trực tiếp từ output & HTML report gốc của các lần chạy k6 (tuân thủ Rule 9).  
> **Tổng số lỗi xác nhận & báo cáo lên GitHub Issues:** **4 Issues** (3 Functional/Business Defects + 1 Performance Bottleneck)

---

## Bảng Tổng Hợp 4 Lỗi Phát Hiện Trực Tiếp Khi Chạy k6

| Bug ID | Tiêu đề ngắn | Loại | Mức độ | Vị trí mã nguồn | Bằng chứng định lượng từ các phiên chạy k6 | Ảnh minh chứng RAW (`proof-image/`) |
|---|---|---|---|---|---|---|
| **BUG-HW05-01** | Account lockout khóa sớm ở lần sai thứ 2 thay vì thứ 3 (`login_attempts + 2`) | Functional / Auth (FR-02) | **High** | `server.js:54-58` | Stress & Spike: `sut_bug_early_lockout_on_2nd_fail = 3/3` tài khoản probe bị trả `403` ngay ở lần thử thứ 3 | `stress_summary_and_monitor.png`, `spike_summary_and_monitor.png` |
| **BUG-HW05-02** | Công thức mã giảm giá `%` sinh giảm giá âm, đội giá đơn lên gấp 10 lần | Functional / Business (FR-09) | **Critical** | `server.js:398-406` | Load: **`287`** fails; Stress: **`2,890`** hits; Endurance: **`3,534`** hits | `bug_02_03_load_trace_html.*`, `load_summary_and_monitor.jpg`, `stress_summary_and_monitor.png` |
| **BUG-HW05-03** | Kiểm tra `min_order_amount` dùng `>` thay vì `>=`, từ chối sai biên chính xác | Functional / Boundary (FR-09) | **Medium** | `server.js:379` | Load: **`27`** lần từ chối sai `HTTP 400` tại biên `300,000` / `500,000` | `bug_02_03_load_trace_html.*`, `load_summary_and_monitor.jpg` |
| **BUG-HW05-04** | Nút cổ chai `POST /api/apply-coupon` (`p95` tăng 37.7x) & tail spike `1,216 ms` do thiếu Index & WAL | Performance | **High** | `database.js:40-46`, `server.js:387-390` | `post_apply_coupon` chậm nhất Stress (`p95 = 202.50 ms`) & Spike (`p95 = 648.92 ms`); Endurance max spike `1,216.07 ms` | `bug_04_spike_aggregate_html.*`, `spike_summary_and_monitor.png`, `endurance_summary.jpg` |

---

## Chi Tiết Từng Lỗi & Bằng Chứng Từ Các Phiên Chạy k6

### 1. BUG-HW05-01 — Account Lockout Triggers After 2 Failed Logins Instead of 3
- **Severity:** High | **Category:** Functional / Auth (FR-02)
- **Root Cause (`eshop-sut/backend/server.js:54-58`):**
  ```js
  const newAttempts = user.login_attempts + 2; // BUG: increments by +2 instead of +1
  let lockedUntil = null;
  if (newAttempts >= 3) {
    lockedUntil = new Date(Date.now() + 180000).toISOString();
  }
  ```
- **Observed Evidence (Stress & Spike Runs):**
  - Kịch bản cô lập `lockout_behavior_probe` chạy song song trên 3 tài khoản sạch (`locktest01..03@eshop.com`), gửi 4 lần đăng nhập sai mật khẩu liên tiếp:
    - Lần 1: `login_attempts: 0 → 2` (`HTTP 401`)
    - Lần 2: `login_attempts: 2 → 4 >= 3` → đặt `locked_until = +180s` (`HTTP 401`)
    - Lần 3: **Đã bị khóa `HTTP 403`** thay vì cho thử lần thứ 3!
  - Ground-truth `23120256_Spike_20261121.csv`: `post_login_lockout_probe` trả đúng `6 × 401` + `6 × 403` (`sut_bug_early_lockout_on_2nd_fail = 3/3`).
  - Stress run (`23120256_Stress_20261121.csv`): `sut_bug_early_lockout_on_2nd_fail = 3/3`.
- **Expected Behavior:** Cộng `+1` mỗi lần sai; chỉ khóa tài khoản sau đúng 3 lần thất bại liên tiếp.
- **Screenshots (từ các phiên chạy Stress & Spike thật):**
  - `../proof-image/stress_summary_and_monitor.png` (`sut_bug_early_lockout_on_2nd_fail: 3`)
  - `../proof-image/spike_summary_and_monitor.png` (`Early-lockout bug count=3`)

---

### 2. BUG-HW05-02 — Percentage Coupon Formula Computes Negative Discount & Inflates Final Price 10x
- **Severity:** Critical | **Category:** Functional / Business Logic (FR-09)
- **Root Cause (`eshop-sut/backend/server.js:398-406`):**
  ```js
  if (coupon.type === "percent") {
    discount_amount = Math.floor(total_amount * (1 - coupon.discount_value));
  }
  const final_amount = total_amount - discount_amount;
  ```
  Với coupon 10% (`discount_value = 10`), biểu thức `1 - 10 = -9` tạo ra `discount_amount` âm, khiến `final_amount` tăng gấp **10 lần** giá gốc!
- **Observed Evidence (Load, Stress & Endurance Runs):**
  - **Load (`14,814` reqs):** Check `"apply-coupon (valid): discount is positive & final < total"` thất bại chính xác **`287` lần** (`percent_neg=287`).
  - **Stress (`152,463` reqs):** `sut_bug_percent_negative_discount = 2,890`.
  - **Endurance 12m (`183,756` reqs):** `Percent Bug Hits = 3,534`.
- **Expected Behavior:** `discount_amount = Math.floor((total_amount * coupon.discount_value) / 100)`.
- **Screenshots (từ phiên chạy Load & Stress thật):**
  - View 1 HTML Report (`html-reports/load-trace-report/index.html` — dòng check FAIL đỏ `287`): `../proof-image/bug_02_03_load_trace_html.jpg`
  - Terminal Load Summary (`percent_neg=287`): `../proof-image/load_summary_and_monitor.jpg`
  - Terminal Stress Summary (`sut_bug_percent_negative_discount: 2890`): `../proof-image/stress_summary_and_monitor.png`

---

### 3. BUG-HW05-03 — Coupon Minimum Order Validation Rejects Exact Boundary (`>` instead of `>=`)
- **Severity:** Medium | **Category:** Functional / Boundary (FR-09)
- **Root Cause (`eshop-sut/backend/server.js:379`):**
  ```js
  if (total_amount > coupon.min_order_amount) { // BUG: should be >=
  ```
- **Observed Evidence (Load Run):**
  - **Load (`23120256_Load_20261121.csv`):** Các dòng biên `RED-13` (`300,000 ₫`) và `RED-14` (`500,000 ₫`) trùng chính xác `min_order_amount` bị từ chối `HTTP 400` đúng **`27` lần** (`strict_gt=27`).
- **Expected Behavior:** Đơn hàng có `total_amount >= coupon.min_order_amount` phải được chấp nhận áp mã.
- **Screenshots (từ phiên chạy Load thật):**
  - View 1 HTML Report (`html-reports/load-trace-report/index.html` — dòng check FAIL đỏ `27`): `../proof-image/bug_02_03_load_trace_html.jpg`
  - Terminal Load Summary (`strict_gt=27`): `../proof-image/load_summary_and_monitor.jpg`

---

### 4. BUG-HW05-04 — Severe Tail-Latency Bottleneck on `POST /api/apply-coupon` Under Concurrency & 1.2s Soak Spike
- **Severity:** High | **Category:** Performance
- **Root Cause (`database.js:40-46`, `server.js:387-390`):**
  - Bảng `coupon_usage` thiếu composite index `(coupon_id, user_id)` và bảng `users` thiếu index `(email)`.
  - `database.js` sử dụng SQLite3 journal mode mặc định (`DELETE`), không bật `PRAGMA journal_mode = WAL;` và không đặt `PRAGMA busy_timeout`, trong khi mỗi iteration phát sinh 4 lệnh ghi SQLite đồng thời (`UPDATE users`, `INSERT coupons`, `INSERT coupon_usage`, `DELETE coupons`).
- **Observed Evidence (Ground-Truth `analyze_perf_logs.py`):**
  - **Load (20 VUs):** `post_apply_coupon` `avg = 5.19 ms`, `p95 = 17.22 ms`.
  - **Stress (→200 VUs):** `post_apply_coupon` là endpoint chậm nhất toàn hệ thống — `avg = 71.03 ms`, **`p95 = 202.50 ms`**, `p99 = 349.50 ms`, `max = 592.84 ms`.
  - **Spike (10→180 VUs trong 10s):** `post_apply_coupon` vọt lên **`avg = 275.83 ms`, `p95 = 648.92 ms`, `p99 = 810.12 ms`, `max = 984.08 ms`** — tăng **37.7 lần** so với Load baseline!
  - **Endurance (40 VUs, 12 phút):** Khi `coupon_usage` tích lũy `17,524` dòng, xuất hiện tail spike `max = 1,109.35 ms` trên `post_apply_coupon` (`1,216.07 ms` toàn cục) ở cửa sổ cuối `605s–721s`.
- **Recommended Fix:** Bật `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;` trong `database.js` và tạo index `CREATE INDEX idx_coupon_usage_pair ON coupon_usage(coupon_id, user_id);` cùng `CREATE INDEX idx_users_email ON users(email);`.
- **Screenshots (từ các phiên chạy Spike & Endurance thật):**
  - View 3 HTML Report (`html-reports/spike-aggregate-report/index.html` — `ep_06_post_apply_coupon` cao nhất `648.92 ms`): `../proof-image/bug_04_spike_aggregate_html.png`
  - Terminal Spike & Endurance Summary: `../proof-image/spike_summary_and_monitor.png`, `../proof-image/endurance_summary.jpg`

---

## Bằng Chứng Trang GitHub Issues
- **Public GitHub Issues Page:** [https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues](https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues)
  - **Issue #1 (`BUG-HW05-01`):** [https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues/1](https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues/1) (`bug`, `high-priority`)
  - **Issue #2 (`BUG-HW05-02`):** [https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues/2](https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues/2) (`bug`, `critical`)
  - **Issue #3 (`BUG-HW05-03`):** [https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues/3](https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues/3) (`bug`, `medium-priority`)
  - **Issue #4 (`BUG-HW05-04`):** [https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues/4](https://github.com/Hidebray/SoftwareTesting_HW05_23120256/issues/4) (`performance`, `high-priority`)
- **Danh sách 4 Issues đã đăng:** `../proof-image/github_issues_list.png`
- **Chi tiết Issue (có đính kèm ảnh minh chứng):** `../proof-image/github_issue_detail.png`
