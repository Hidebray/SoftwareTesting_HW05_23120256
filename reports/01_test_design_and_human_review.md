# 01 — Test Design, Workload Modeling & Human Review Log (Task 1)

> **Bài tập:** HW05 – Performance Testing (k6)  
> **Sinh viên:** Trần Đại Hiệp (`23120256`)  
> **Agent Skill áp dụng:** `performance-tester` (`v1.0`, adapter `k6_adapter.md`)  
> **Workflow:** **Coupon Campaign, Discount Redemption & Order Monitoring** *(Pool A FR-02/FR-04 + Pool B FR-09 + Pool C FR-17/FR-18)*

---

## 1. Chứng Minh Bao Phủ 3 Nhóm Endpoint & Không Trùng Lặp Nhóm

### 1.1 Đối chiếu tránh trùng lặp trong nhóm
- ❌ **Thành viên 1 (`Purchase & Order Verification`):** `Login` → `Search Products` → `View Product Detail` → `Add to Cart` → `Checkout` → `Order History`.
- ❌ **Thành viên 2 (`Category Management & Verification`):** `Admin Login` → `View Categories` → `Create Category` → `Delete Category` → `Verify Category Deletion`.
- ✅ **Workflow của tôi (`Coupon Campaign, Discount Redemption & Order Monitoring`):** Tập trung toàn bộ vào vòng đời quản trị chiến dịch mã giảm giá, kiểm định áp mã/lượt dùng và giám sát đơn hàng toàn hệ thống — **0% trùng lặp phần Read-heavy và Transactional**.

### 1.2 Ánh xạ 9 bước End-to-End vào 3 nhóm Endpoint

| Bước | Endpoint | Nhóm Endpoint | Đặc thù tải & Lý do chọn |
|:---:|---|---|---|
| 1 | `POST /api/login` | **Auth-heavy** | Tạo JWT token (`HS256`) + ghi `UPDATE users SET login_attempts = 0` vào SQLite; tích hợp nhánh `lockout_probe` kiểm chứng cơ chế khóa tài khoản. |
| 2 | `GET /api/users/me` | **Auth-heavy** | Xác thực JWT qua middleware `authenticateToken` và đọc bản ghi user theo `id`. |
| 3 | `GET /api/coupons` | **Read-heavy** | Truy vấn `SELECT * FROM coupons` (kích thước tập kết quả biến thiên động dưới tải đồng thời). |
| 4 | `GET /api/admin/orders` | **Read-heavy** | Truy vấn `LEFT JOIN orders + users ORDER BY orders.id DESC` — truy vấn đọc nặng nhất của backend. |
| 5 | `POST /api/admin/coupons` | **Transactional** | Ghi `INSERT INTO coupons` với ràng buộc `UNIQUE(code)`, tham số hóa từ `data/coupons.csv`. |
| 6 | `POST /api/apply-coupon` | **Transactional / Compute** | Kiểm tra ngày hết hạn, giá trị đơn tối thiểu (`data/redemptions.csv`), và chạy `SELECT COUNT(*) FROM coupon_usage` (không có index). |
| 7 | `POST /api/coupon-usage` | **Transactional** | Ghi `INSERT INTO coupon_usage` vào SQLite, tạo áp lực write lock thực tế. |
| 8 | `DELETE /api/admin/coupons/:id` | **Transactional** | Thu hồi mã giảm giá sau vòng đời để tránh phình không kiểm soát bảng `coupons`. |
| 9 | `POST /api/apply-coupon` | **Verification** | Gọi áp lại mã vừa xóa để khẳng định trạng thái đã hủy (`HTTP 404`). |

---

## 2. Cơ Sở Tính Toán Tham Số Theo Little's Law

Áp dụng công thức Little's Law từ [workload_modeling_guide.md](../skills/performance-tester/references/workload_modeling_guide.md):

$$N = \lambda \times (R + Z)$$

- Một vòng lặp hoàn chỉnh gồm **9 HTTP requests** với độ trễ dự kiến trên localhost $R \approx 0.15\text{s} - 0.40\text{s}$ và tổng think-time $Z$ điều chỉnh theo từng kịch bản:

| Kịch bản | File Test Plan | Cấu hình `stages` / VUs | Tổng Think-time ($Z$) | Thông lượng mục tiêu ($\lambda$) | Report View riêng biệt (Không lặp) |
|---|---|---|---:|---:|---|
| **Load** | `23120256_Load_20261121.js` | `0→20 (30s) → 20 (2m) → 0 (30s)` *(3m)* | ~`1.8s` | ~`9–10 iter/s` (~`80–90 req/s`) | **View 1:** Per-Group & Check Trace HTML (`report_view1_trace.js`) |
| **Stress** | `23120256_Stress_20261121.js` | `20→50→100→150→200 (45s/bậc) → 0 (30s)` *(4m15s)* + `lockout_probe` (3 VUs) | ~`1.0s` | Đẩy vượt ngưỡng gãy của SQLite single-writer | **View 2:** k6 Built-in Web Dashboard Time-Series HTML (`K6_WEB_DASHBOARD_EXPORT`) |
| **Spike** | `23120256_Spike_20261121.js` | `10 (30s) → 180 (10s) → 180 (45s) → 10 (15s) → 10 (45s) → 0 (15s)` *(2m40s)* + `lockout_probe` | ~`0.6s` | Cú sốc tăng đột ngột **18 lần** (10 → 180 VUs trong 10s) | **View 3:** Aggregate Percentile Matrix HTML (`report_view3_aggregate.js`) |

---

## 3. Nhật Ký Human Review & Sửa Lỗi Bản Nháp AI (Task 1 — Human Review)

Trong quá trình áp dụng **AI-First từng bước** (Gate 1–4 của Skill `performance-tester`), các lỗi/thiếu sót sau đã được phát hiện qua kiểm duyệt mã nguồn & chạy thử smoke test, và được khắc phục triệt để trước khi chạy tải thật:

| # | Lỗi / Thiếu sót của bản nháp AI | Phân loại nguyên nhân | Tác động nếu không sửa | Cách đã khắc phục trong bản Final |
|:---:|---|---|---|---|
| **HR-01** | **Trùng khóa `UNIQUE(code)` ở `POST /api/admin/coupons`** — AI ban đầu dùng thẳng cột `code_prefix` từ `coupons.csv` làm mã coupon. | Đặc thù DB schema SUT (`coupons.code TEXT UNIQUE` trong `database.js:31`) | Ngay từ vòng lặp thứ 2, toàn bộ request tạo coupon trả `HTTP 500 SQLITE_CONSTRAINT: UNIQUE`. | Sinh mã động gắn hậu tố duy nhất `${couponTpl.code_prefix}_L${__VU}_${__ITER}_${Date.now() % 100000}` mà vẫn giữ nguyên cấu hình từ CSV. |
| **HR-02** | **Thiếu cô lập tài khoản Account Lockout** — AI gộp kiểm thử sai mật khẩu vào chung pool tài khoản chính. | Đặc thù endpoint (`server.js:54` cộng `+2` mỗi lần sai, khóa 180s ngay sau 2 lần sai) | Toàn bộ VU hợp lệ đồng loạt nhận `HTTP 403`, làm sai lệch hoàn toàn đo đạc Stress/Spike. | Tách 3 tài khoản riêng `lockout_probe` (`locktest01..03`) chạy trên k6 scenario độc lập `lockout_behavior_probe`, bổ sung Counter `sut_bug_early_lockout_on_2nd_fail`. |
| **HR-03** | **Assertion quá yếu (chỉ kiểm tra `status === 200`)** — AI không kiểm tra toán học giá sau giảm (`final_amount < total_amount`). | Giới hạn model / chất lượng prompt ban đầu | Bỏ lọt hoàn toàn **bug thật của SUT** tại `server.js:399` (`discount_amount = total_amount * (1 - discount_value)` gây giảm giá âm cho coupon `%`). | Bổ sung semantic check `b.discount_amount > 0 && b.final_amount < totalAmount` và Counter `sut_bug_percent_negative_discount` để đếm chính xác lỗi thật. |
| **HR-04** | **Sai lệch chỉ số `http_req_failed` do bước Negative/Verification** — AI không cấu hình `http.expectedStatuses` cho bước verify `404` sau khi xóa coupon và bước `400` đơn hàng dưới mức tối thiểu. | Đặc thù công cụ k6 (mặc định mọi status $\ge 400$ đều tính là failed) | Làm thổi phồng giả tỷ lệ lỗi `http_req_failed` lên >15% ngay cả khi hệ thống hoạt động bình thường. | Gắn `responseCallback: http.expectedStatuses(404)` cho bước verify xóa, `http.expectedStatuses(401, 403)` cho lockout probe, và tách riêng Counter `sut_server_5xx_errors`. |
| **HR-05** | **Không tương thích cờ CLI `--vus`/`--iterations` khi chạy smoke test trên script có `options.scenarios`** (Stress & Spike). | Đặc thù cú pháp k6 | Lỗi runtime ngay khi chạy dry-run `--vus 2 --iterations 2`. | Bổ sung chế độ `const IS_SMOKE = __ENV.SMOKE === "1"` cho phép dry-run an toàn cả 3 kịch bản mà không sửa code tải chính. |
| **HR-06** | **Bug spread `headers` trong `scripts/seed_sut.js` bản nháp** — đặt `...options` sau `headers` làm mất `Content-Type: application/json`. | Lỗi sinh mã AI | `PUT /api/users/me` báo `500 TypeError: Cannot destructure property 'name' of 'req.body'`. | Tách `const { headers = {}, ...restOptions } = options` và chạy verify thực tế `reset_sut.ps1` đạt 33/33 user + 20/20 orders. |
| **HR-07** | **Lỗi reset tiến trình trên Windows IPv6 trong `scripts/reset_sut.ps1`** — `Get-NetTCPConnection -LocalPort 3000` bỏ sót tiến trình `node.exe` cũ khiến lần reset kế tiếp chạy song song 2 tiến trình và `initDatabase()` xóa bảng giữa lúc `seed_sut.js` đang nạp user (`Total Users = 31` thay vì `35`). | Đặc thù OS Windows / Node.js dual-stack listener | Kịch bản Stress & Spike chạy sau bị mất tài khoản `staff01..04` gây `401` hàng loạt ngay ở bước login. | Nâng cấp `reset_sut.ps1` kết hợp `netstat -ano` (cả IPv4/IPv6) + lọc `Win32_Process` theo `server.js`, đợi 2s giải phóng port rồi mới khởi chạy mới và seed lại đủ 35 users. |

