# 03 — Task 2: AI Raw-Log Analysis, Misinterpretation Hunt & Optimization Feasibility Audit

> **Bài tập:** HW05 – Performance Testing (Task 2 — 10 điểm, Bloom-AI G9.3 Analyse & G9.4 Collaborate)  
> **Sinh viên:** Trần Đại Hiệp (`23120256`)  
> **AI Tool phân tích nguyên bản:** `Gemini Flash` *(subagent độc lập `raw-log-ai-analyst`, chỉ cung cấp trích đoạn nguyên bản từ `raw-logs/*.jtl` & `.csv`, KHÔNG cho đọc `eshop-sut/backend/` và KHÔNG cho chạy script phân tích Ground-Truth)*  
> **Thời điểm thực hiện:** `2026-11-22 17:22 ICT`  
> **Công cụ đối chiếu Ground-Truth:** `skills/performance-tester/scripts/analyze_perf_logs.py` chạy trên 100% dữ liệu gốc (`2,500,837` raw CSV rows / `207,722` HTTP requests across Load, Stress, Spike).

---

## 1. Prompt & Đầu Ra Nguyên Bản Của AI (Verbatim AI Analysis)

### 1.1 Prompt đã gửi cho AI
> *"Please analyze the following raw performance test logs from our e-commerce backend REST API (`http://localhost:3000/api/*`) across three scenarios (Load, Stress, Spike). Do NOT call any tools or inspect workspace files — base your analysis strictly on the raw log data below. [Kèm metadata số dòng & trích đoạn HEAD/TAIL nguyên bản từ `23120256_{Load,Stress,Spike}_20261121.jtl` và mẫu đầu `23120256_Stress_20261121.csv`]. Please provide: (1) Quantitative metric summary table across Load, Stress, and Spike, (2) Recommended performance thresholds (SLA gates), (3) Exactly 8 concrete backend optimization recommendations ranked by priority."*

### 1.2 Tóm tắt chính xác đầu ra của AI (`Gemini Flash`)
- **Metric Summary AI báo cáo (dựa trên trích đoạn & metadata):**
  - Total requests: `14,814` (Load), `152,463` (Stress), `40,445` (Spike).
  - Timestamp span: `181s` (Load), `253s` (Stress), `157s` (Spike); Mean Throughput: `82.30 RPS` / `597.89 RPS` / `252.78 RPS`.
  - Excerpt-only latency: **Load Avg `5.550 ms` (`max 25.188 ms`)**, **Stress Avg `3.155 ms` (`max 6.282 ms`)**, **Spike Avg `6.875 ms` (`max 12.828 ms`)** *(thừa nhận full-run p95/p99 không quan sát được từ trích đoạn)*.
  - Slowest endpoint (từ excerpt): `post_apply_coupon` (`25.188 ms`) ở Load, **`post_admin_coupons`** ở Stress (`6.282 ms`) và Spike (`12.828 ms`).
  - Cảnh báo đặc biệt: `http_req_blocked = 22.2125 ms` ở dòng đầu Stress CSV cao gấp `8.6x` `http_req_duration` (`2.5778 ms`).
- **Ngưỡng SLA AI đề xuất:**
  - Localhost CI Gate (Load **và Spike**): `p95 <= 50 ms`, `p99 <= 120 ms`; Stress Saturation Gate: `p95 <= 200 ms`, `p99 <= 500 ms`.
  - Spike Recovery Gate: quay về `<= 1.2x` baseline `p95` trong vòng `15s` sau khi tụt `180 -> 10 VUs`.
- **8 Đề xuất tối ưu hóa backend AI đưa ra (xếp hạng P1 → P8):**
  - **P1:** Atomic conditional SQL update (`UPDATE coupons SET used_count = used_count + 1 WHERE ... RETURNING *`) thay cho read-then-write.
  - **P2:** Tinh chỉnh HTTP Keep-Alive & **Database Connection Pool (`min: 10, max: 30–50`, `acquireTimeoutMillis`)** để xử lý `http_req_blocked = 22.21 ms`.
  - **P3:** Thêm index `coupons(code)` *(partial `WHERE deleted_at IS NULL`)*, `coupon_usage(coupon_id, user_id)`, `orders(created_at DESC, status)`, `orders(user_id)`.
  - **P4:** Cache ngắn hạn bằng **Redis / In-memory** cho `GET /api/users/me` và `GET /api/coupons`.
  - **P5:** Đẩy hàm băm mật khẩu CPU-bound (**`bcrypt` cost 10 / `argon2id`**) sang worker thread pool (`UV_THREADPOOL_SIZE`) cho `::01_Auth_Heavy` (`POST /api/login`).
  - **P6:** Phân trang keyset (`WHERE id < $cursor ORDER BY id DESC LIMIT 50`) & column projection cho `GET /api/admin/orders` và `GET /api/coupons`.
  - **P7:** Soft-delete (`revoked_at`) & cấu hình **PostgreSQL MVCC Autovacuum** (`autovacuum_vacuum_scale_factor = 0.05`) cho `coupons`/`coupon_usage`.
  - **P8:** Cấu hình **`statement_timeout = 2000ms`**, token-bucket rate limiting và `503 Retry-After` backpressure.

---

## 2. Human Review — Săn Lỗi Phân Tích & Hiểu Sai Metric Của AI (Misinterpretation Hunt)

Đối chiếu toàn bộ nhận định của AI với giá trị **Ground-Truth 100%** trích trực tiếp từ 3 file raw log đầy đủ ([ground_truth_Load.md](ground_truth_Load.md), [ground_truth_Stress.md](ground_truth_Stress.md), [ground_truth_Spike.md](ground_truth_Spike.md)):

| # | Lỗi / Nhận định lệch lạc của AI | Giá trị ĐÚNG từ Raw Log gốc (Citation) | Giải thích nguyên nhân sai lệch |
|:---:|---|---|---|
| **M-01** | **Đảo ngược xu hướng độ trễ do Sampling Bias:** AI báo cáo mẫu Stress (`Avg = 3.155 ms`, `max = 6.282 ms`) trông **nhanh hơn** cả Load (`Avg = 5.550 ms`, `max = 25.188 ms`) và Spike (`Avg = 6.875 ms`). | • `23120256_Load_20261121.jtl` (14,814 reqs): `Avg = 5.951 ms`, `p95 = 16.476 ms`, `p99 = 38.898 ms`, `Max = 307.525 ms`.<br>• `23120256_Stress_20261121.jtl` (152,463 reqs): **`Avg = 47.563 ms`** *(gấp **15.1x** mẫu AI!)*, **`p95 = 146.013 ms`**, **`p99 = 269.887 ms`**, **`Max = 592.840 ms`**.<br>• `23120256_Spike_20261121.jtl` (40,445 reqs): **`Avg = 217.128 ms`** *(gấp **31.6x** mẫu AI!)*, **`p95 = 532.450 ms`**, **`p99 = 658.807 ms`**, **`Max = 984.082 ms`**. | Trích đoạn HEAD+TAIL chỉ nằm ở giây khởi động `t=0s` (1 VU) và giây hạ tải cuối `t=end` (1 VU). Toàn bộ `99.99%` vùng đỉnh tải 150–200 VUs (nơi SQLite xếp hàng write lock) bị cắt mất khỏi cửa sổ context của LLM! |
| **M-02** | **Xác định sai Endpoint chậm nhất ở Stress & Spike:** AI kết luận `post_admin_coupons` chậm nhất (`6.282 ms` Stress, `12.828 ms` Spike). | • `23120256_Stress_20261121.jtl`: Endpoint chậm nhất là **`post_apply_coupon`** (`Avg = 71.028 ms`, **`p95 = 202.496 ms`**, `p99 = 349.498 ms`, `Max = 592.840 ms`) — vượt xa `post_admin_coupons` (`p95 = 175.808 ms`).<br>• `23120256_Spike_20261121.jtl`: Endpoint chậm nhất vẫn là **`post_apply_coupon`** (`Avg = 275.827 ms`, **`p95 = 648.924 ms`**, `p99 = 810.122 ms`, `Max = 984.082 ms`) — vượt xa `post_admin_coupons` (`p95 = 525.103 ms`). | Tại giây `t=0s` bảng `coupon_usage` đang rỗng nên `post_apply_coupon` chỉ mất `2.03 ms` (`Stress.jtl` dòng 7). Khi chạy thật dưới tải, bảng `coupon_usage` tích lũy hàng chục nghìn dòng không có index khiến `SELECT COUNT(*)` chậm vượt mặt `INSERT`! |
| **M-03** | **Đề xuất ngưỡng SLA Spike phi thực tế (`p95 <= 50 ms`, recovery `<= 1.2x` trong `15s`):** AI gộp chung Spike với Load vào ngưỡng `p95 <= 50 ms` trên localhost. | • `23120256_Spike_20261121.jtl`: Spike thực tế có **`p95 = 532.450 ms`** *(vượt ngưỡng AI đề xuất **10.6 lần**)* và `p99 = 658.807 ms` *(vượt **5.5 lần**)* dù `5xx = 0%`.<br>• Phân tích cửa sổ thời gian Spike: Baseline `0s–27s` `p95 = 13.567 ms` → Đỉnh `27s–54s` `p95 = 572.434 ms` → Sau khi tụt về 10 VUs ở cửa sổ `108s–135s`, `p95 = 21.511 ms` (**`1.59x`** baseline, không đạt `<= 1.2x` trong 15s!). | Do chỉ nhìn độ trễ lúc 1 VU (`3–7 ms`), AI đặt ngưỡng quá khắt khe như môi trường có connection pool/in-memory DB, dẫn đến CI/CD sẽ **báo lỗi giả (false alarm) 100%** trên mọi lần chạy Spike của EShop. |
| **M-04** | **Bỏ sót Peak 1-Second Throughput & lệch biên thời lượng 1s:** AI chỉ tính `Mean RPS` (`82.30` / `597.89` / `252.78`) và tính span `181s` / `253s` / `157s`. | • Thời lượng inclusive chính xác (`max_ts - min_ts + 1`): Load **`182s`** (Avg `81.396 req/s`, **Peak 1s = `119 req/s`**); Stress **`254s`** (Avg `600.248 req/s`, **Peak 1s = `1,278 req/s`** — gấp **2.13x** mean!); Spike **`158s`** (Avg `255.981 req/s`, **Peak 1s = `946 req/s`** — gấp **3.74x** mean!). | Chỉ chia tổng request cho tổng thời lượng toàn bài (gồm cả pha ramp-up/down 0–10 VUs) làm **che khuất công suất đỉnh thật** (`1,278 req/s`) mà backend phải gánh. |
| **M-05** | **Bỏ sót toàn bộ phân bổ HTTP `400`, `401`, `403` trong phần giữa log:** AI chỉ thấy `200` và `404` (`verify_coupon_revoked`), báo `0` lỗi khác trong mẫu. | • `23120256_Stress_20261121.jtl`: `200: 132,542 (86.93%)`, **`400: 2,673 (1.75%)`**, **`401: 3 (0.00%)`**, **`403: 9 (0.01%)`**, `404: 17,236 (11.31%)`.<br>• `23120256_Spike_20261121.jtl`: `200: 35,166 (86.95%)`, **`400: 697 (1.72%)`**, **`401: 6 (0.01%)`**, **`403: 6 (0.01%)`**, `404: 4,570 (11.30%)`. | Các lệnh `lockout_behavior_probe` kích hoạt ở `t=30s` (Stress) và `t=42s` (Spike), còn các dòng `400` nằm rải rác giữa file → hoàn toàn vô hình trong HEAD+TAIL snippet! |
| **M-06** | **Phóng đại tín hiệu nhiễu `http_req_blocked = 22.21 ms` thành nút cổ chai P2:** AI xem dòng đầu tiên của Stress CSV (`http_req_blocked = 22.2125 ms`) là nguy cơ cạn kiệt socket/pool. | • Ngay tại dòng 19 của chính `23120256_Stress_20261121.csv` (`GET /api/users/me` ở cùng giây `1795332525`): **`http_req_blocked = 0.000000 ms`**! Toàn bộ `152,463` requests trong Stress có `0` lỗi `ECONNREFUSED` hay socket exhaustion. | `22.21 ms` chỉ là chi phí **cold TCP handshake 1 lần duy nhất** khi VU đầu tiên mở kết nối Keep-Alive ban đầu trên Windows loopback, không phải dấu hiệu nghẽn socket! |

---

## 3. Thẩm Định Đề Xuất Tối Ưu Của AI (`Feasible` vs. `Hallucinated`)

Đối chiếu từng đề xuất từ **P1 → P8** của AI trực tiếp với mã nguồn thực tế (`eshop-sut/backend/package.json`, `database.js`, `server.js`):

| # | Đề xuất của AI | Phân loại | Bằng chứng mã nguồn / kiến trúc thật | Lý do kỹ thuật |
|:---:|---|:---:|---|---|
| **P1** | Atomic `UPDATE coupons SET used_count = used_count + 1 ... WHERE ... RETURNING *` | **Hallucinated** *(sai schema & cú pháp SQL)* | `database.js:29-46` | Bảng `coupons` **không hề có cột `used_count` hay `max_uses`** (lượt dùng được đếm ở bảng riêng `coupon_usage`), và `sqlite3` không dùng cú pháp `$1`/`RETURNING *` kiểu PostgreSQL ở bản hiện tại. Tuy nhiên ý tưởng gom kiểm tra + ghi trong 1 transaction SQLite (`BEGIN IMMEDIATE`) là hướng có thể cải biên sau. |
| **P2** | Tinh chỉnh **Database Connection Pool (`min: 10, max: 30–50`, `acquireTimeoutMillis`)** | **Hallucinated** *(sai hệ quản trị DB)* | `database.js:1-11`, `package.json:18` | EShop dùng **`sqlite3` đơn tiến trình, đơn file `database.sqlite`** với duy nhất 1 handle `new sqlite3.Database(dbPath)`. SQLite **không dùng network connection pool 30–50 kết nối** (tạo nhiều kết nối ghi song song còn làm tăng `SQLITE_BUSY`!). Tối ưu đúng phải là **`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;`**. |
| **P3** | Thêm Index cho **`coupon_usage(coupon_id, user_id)`**, `orders(user_id)`, *(và `coupons(code)` partial `deleted_at IS NULL`)* | **Feasible** *(Hiệu quả #1 — lưu ý 1 chi tiết nhỏ)* | `database.js:31, 41-46, 74-81` | **Cực kỳ khả thi & đánh trúng nút cổ chai số 1!** `coupon_usage(coupon_id, user_id)` và `orders(user_id)` & `users(email)` hiện **hoàn toàn không có index**, gây full table scan ở `post_apply_coupon` (`p95 = 648.92 ms` Spike). *(Ghi chú nhỏ: `coupons.code` đã có implicit index do `UNIQUE` ở `database.js:31`, và cột `deleted_at` không tồn tại.)* |
| **P4** | Cache ngắn hạn (**In-Memory / Redis**) cho `GET /api/users/me` và `GET /api/coupons` | **Feasible** *(In-Memory)* / **Hallucinated** *(Redis)* | `server.js:112-116, 356-360` | Dùng in-process cache ngắn hạn (Node `Map` + xóa cache khi `POST/DELETE /api/admin/coupons`) là **khả thi & đơn giản**. Triển khai cụm **Redis** ngoài cho ứng dụng demo SQLite đơn node là over-engineering không phù hợp thực tế. |
| **P5** | Đẩy băm mật khẩu **`bcrypt` / `argon2id`** sang worker threads (`UV_THREADPOOL_SIZE`) | **Hallucinated** *(ảo giác công nghệ điển hình!)* | `package.json:13-19`, `server.js:46` | **Ảo giác 100%!** `package.json` **không hề cài `bcrypt` hay `argon2`**; dòng `server.js:46` so sánh mật khẩu trực tiếp dạng plaintext (`if (user.password === password)`). AI bị đánh lừa hoàn toàn bởi tên group `::01_Auth_Heavy`! |
| **P6** | Phân trang (`LIMIT` / cursor pagination) & chọn cột cụ thể cho `GET /api/admin/orders` & `GET /api/coupons` | **Feasible** | `server.js:357, 511-518` | **Hoàn toàn khả thi!** Cả `SELECT * FROM coupons` lẫn `SELECT orders.*, users.name FROM orders LEFT JOIN users` đều **chưa có `LIMIT`**, sẽ chậm tuyến tính khi số đơn hàng tăng lên hàng nghìn dòng. |
| **P7** | Tinh chỉnh **PostgreSQL MVCC Autovacuum** (`autovacuum_vacuum_scale_factor = 0.05`) & soft-delete `revoked_at` | **Hallucinated** *(nhầm sang PostgreSQL)* | `database.js:1` (`sqlite3`) | `autovacuum_vacuum_scale_factor` là tham số **độc quyền của PostgreSQL**! EShop chạy **SQLite3**, hoàn toàn không có tiến trình PostgreSQL autovacuum (tương đương trên SQLite là `PRAGMA auto_vacuum = INCREMENTAL` + WAL checkpoint). |
| **P8** | Đặt **`statement_timeout = 2000ms`**, Rate Limiting & `503` Backpressure | **Feasible** *(Rate Limit / Backpressure)* / **Hallucinated** *(`statement_timeout`)* | `server.js:1-15` | `statement_timeout` lại là tham số **PostgreSQL** (SQLite dùng `busy_timeout`), nhưng bổ sung middleware rate-limit & timeout phía Express cho `/api/login` và `/api/apply-coupon` là **khả thi**. |

### Tổng kết tỷ lệ thẩm định 8 đề xuất tối ưu của AI
- **Feasible (Khả thi & áp dụng được ngay):** **2 toàn phần** (`P3` Indexing, `P6` Pagination) + **2 bán phần** (`P4` In-memory cache, `P8` Express rate-limit/timeout).
- **Hallucinated (Ảo giác công nghệ / sai DBMS):** **4 đề xuất lõi sai stack** (`P1` sai schema/PostgreSQL `RETURNING`, `P2` SQLite connection pool 30–50, `P5` `bcrypt`/`argon2id` không tồn tại, `P7` PostgreSQL `autovacuum_vacuum_scale_factor`), cùng lỗi nhầm `statement_timeout` ở `P8` và cột `deleted_at` ở `P3`.
- **Tối ưu quan trọng nhất cho SUT mà AI BỎ SÓT hoàn toàn:** Bật **`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;`** cho SQLite3 và **chỉ chạy `UPDATE users SET login_attempts = 0` khi `user.login_attempts > 0`** (loại bỏ `152,463/9 ≈ 17,236` lệnh ghi SQLite vô nghĩa mỗi lần login thành công ở `server.js:47`!).

---

## 4. Ngưỡng Performance Thresholds Chuẩn Hóa Lại Từ Ground-Truth (Human-Corrected)

| Kịch bản | AI đề xuất (`p95`) | Thực nghiệm Ground-Truth (`p95` / `p99`) | Ngưỡng SLA chuẩn hóa đề xuất cho SUT |
|---|---:|---:|---|
| **Load (20 VUs, 3m)** | `<= 50 ms` | `16.48 ms` / `38.90 ms` | `p95 <= 40 ms`, `p99 <= 100 ms`, `5xx = 0%` |
| **Endurance (40 VUs, 12m)** | *(không có)* | `42.34 ms` / `128.70 ms` | `p95 <= 80 ms`, `Sustained RPS >= 220`, `RAM <= 220 MB`, `5xx = 0%` |
| **Stress (→200 VUs)** | `<= 200 ms` | `146.01 ms` / `269.89 ms` | `p95 <= 250 ms` (ở 200 VUs), `post_apply_coupon p95 <= 300 ms`, `5xx < 1%` |
| **Spike (10→180→10 VUs)** | `<= 50 ms` *(sai lệch 10.6x!)* | `532.45 ms` / `658.81 ms` | `p95 <= 700 ms` trong cú sốc 18x; Recovery `<= 2.0x` baseline (`<= 30 ms`) trong `30s`; `5xx < 1%` |
