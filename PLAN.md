# 📋 Kế Hoạch Thực Thi Chi Tiết (Execution Plan v2 — Skill-First) — HW05: Performance Testing với k6

> **Môn học:** Kiểm thử phần mềm (Software Testing) – FIT@HCMUS  
> **Bài tập:** HW05 – Performance Testing (AI-First + Human Review)  
> **Sinh viên:** Trần Đại Hiệp — **MSSV:** `23120256`  
> **Chiến lược triển khai:** **Skill-First Iterative** *(Xây dựng Agent Skill v1.0 trước → Áp dụng chính Skill đó thực thi HW05 kèm Human Review → Nâng cấp Skill v1.1 từ bài học thực tế → Demo tái sử dụng trên nhóm endpoint khác)*  
> **Công cụ chính:** **Grafana k6** *(Bonus tool)* + Windows Task Manager / Resource Monitor + Node.js (`eshop-sut/backend`)  
> **Thư mục mục tiêu:** `d:\Project\Software Testing\Homework\Week05`  
> **Hostname máy kiểm thử:** `TRAN_DAI_HIEP` *(khớp các bài Homework trước)*

---

## 1. Phân Định Phạm Vi & Tránh Trùng Lặp Nhóm (Scope Isolation)

### 1.1 Các Workflow đã được thành viên khác đăng ký (BẮT BUỘC TRÁNH)
- ❌ **Thành viên 1 (`Purchase & Order Verification`):** `Login` → `Search Products` → `View Product Detail` → `Add to Cart` → `Checkout` → `Order History`.
- ❌ **Thành viên 2 (`Category Management & Verification`):** `Admin Login` → `View Categories` → `Create Category` → `Delete Category` → `Verify Category Deletion`.

### 1.2 Workflow Chính Của Bạn (100% Không Trùng Lặp)
- **Tên Workflow:** **Coupon Campaign, Discount Redemption & Order Monitoring** *(Quản lý chiến dịch mã giảm giá, kiểm định áp dụng/ghi nhận lượt dùng & giám sát đơn hàng)*
- **Pool sử dụng:** **Pool A** (FR-02 Login & Lockout, FR-04 Profile Verify) + **Pool B** (FR-09 Discount Coupons) + **Pool C** (FR-17 Coupon Management CRUD, FR-18 Admin Order Monitoring).

| Thứ tự | Bước nghiệp vụ | API Endpoint (`http://localhost:3000`) | Nhóm Endpoint | Dữ liệu CSV / Đặc thù hiệu năng |
|:---:|---|---|---|---|
| 1 | **Staff/Admin Login** | `POST /api/login` | **Auth-heavy** | Lấy tài khoản từ `users.csv` (30 tài khoản `admin` + 3 tài khoản test lockout). Mỗi lần login ghi `UPDATE users` vào SQLite; có bug `login_attempts + 2` (khóa ở lần sai thứ 2!). |
| 2 | **Verify Auth Session** | `GET /api/users/me` | **Auth-heavy** | Xác thực JWT Bearer token + truy vấn bảng `users` theo `id`. |
| 3 | **List Active Coupons** | `GET /api/coupons` | **Read-heavy** | Đọc toàn bộ bảng `coupons` (tăng động theo số coupon đồng thời đang chạy). |
| 4 | **Monitor System Orders** | `GET /api/admin/orders` | **Read-heavy** | Truy vấn `LEFT JOIN orders + users ORDER BY orders.id DESC` (nặng hơn đọc đơn bảng). |
| 5 | **Create Campaign Coupon** | `POST /api/admin/coupons` | **Transactional** | Tạo coupon từ `coupons.csv` (`code` gắn hậu tố `_${__VU}_${__ITER}` tránh đụng `UNIQUE`, thử cả `fixed` & `percent`). |
| 6 | **Validate & Apply Coupon** | `POST /api/apply-coupon` | **Transactional / Compute** | Kiểm tra hạn dùng, giá trị tối thiểu (`total_amount` từ `redemptions.csv`), chạy `SELECT COUNT(*) FROM coupon_usage WHERE coupon_id=? AND user_id=?` *(không có index → full table scan!)*. |
| 7 | **Record Coupon Usage** | `POST /api/coupon-usage` | **Transactional** | Ghi nhận lượt dùng vào `coupon_usage` (`INSERT` ghi đĩa SQLite, làm tăng dần kích thước bảng trong Endurance test). |
| 8 | **Delete Campaign Coupon** | `DELETE /api/admin/coupons/:id` | **Transactional** | Dọn dẹp coupon sau chiến dịch, tránh phình bảng `coupons`. |
| 9 | **Verify Coupon Revoked** | `POST /api/apply-coupon` | **Verification** | Gọi áp lại mã vừa xóa để xác nhận hệ thống trả đúng `404 Not Found`. |

### 1.3 Nhóm Endpoint Phụ (Dành riêng để Demo Tính Tái Sử Dụng của Agent Skill v1.1)
- **Tên Workflow Demo Skill:** **Admin Product Catalog & Bulk CSV Import** *(Pool C — FR-15, FR-16)*
  - `POST /api/login` → `GET /api/products` → `POST /api/products` → `PUT /api/products/:id` → `POST /api/admin/import-products` *(bulk insert)* → `DELETE /api/products/:id`.
  - Chứng minh hoàn toàn khách quan rằng Agent Skill tái sử dụng trơn tru trên một nhóm endpoint mới (đúng yêu cầu Mục 7).

### 1.4 Các Lỗi Thực Tế Trong Mã Nguồn Backend Có Thể Khai Thác & Log GitHub Issues
1. **Lockout Math Bug ([server.js:54](file:///d:/Project/Software%20Testing/eshop-sut/backend/server.js#L54)):** `login_attempts + 2` → khóa tài khoản `403` ngay sau **2 lần nhập sai** thay vì 3 lần.
2. **Coupon Percent Formula Bug ([server.js:399](file:///d:/Project/Software%20Testing/eshop-sut/backend/server.js#L399)):** `total_amount * (1 - coupon.discount_value)` → khi `discount_value = 10` (10%), `discount_amount` bị **âm** và làm `final_amount` tăng gấp 10 lần giá gốc!
3. **Min Order Boundary Bug ([server.js:379](file:///d:/Project/Software%20Testing/eshop-sut/backend/server.js#L379)):** Dùng `total_amount > coupon.min_order_amount` thay vì `>=` → đơn hàng đúng bằng mức tối thiểu bị từ chối `400`.
4. **SQLite Write Contention (`SQLITE_BUSY` / Tail Latency):** 4 lệnh ghi SQLite/iteration (`UPDATE users`, `INSERT coupons`, `INSERT coupon_usage`, `DELETE coupons`) không có WAL mode & `busy_timeout` + không có index trên `coupon_usage(coupon_id, user_id)` và `users(email)`.
5. **Broken Access Control (FR-12):** `POST /api/admin/coupons`, `DELETE /api/admin/coupons/:id`, `GET /api/admin/orders` chỉ kiểm tra `authenticateToken` mà **không kiểm tra `req.user.role === 'admin'`**.
6. **Bẫy phát hiện AI Hallucination cho Task 2:** Backend dùng `sqlite3` đơn tiến trình và so sánh mật khẩu plaintext (`user.password === password`) — **không có `bcrypt`**, **không có PostgreSQL/MySQL connection pool**, **không có Redis**.

---

## 2. Cấu Trúc Thư Mục Mục Tiêu (`Homework/Week05/`)

```text
Homework/Week05/
├── .git/                                      # Local Git repo (commit chi tiết từng phase)
├── .gitignore
├── PLAN.md                                    # File kế hoạch này
├── README.md                                  # Bảng tự chấm điểm + Test Summary Report + Links
├── git-commit-log.txt                         # Lịch sử Git commit xuất dạng text
├── requirement/
│   └── 2026.HW05.Performance Testing_En.pdf
├── skills/
│   └── performance-tester/                    # [XÂY TRƯỚC Ở PHASE 1] Universal Tool-Agnostic Agent Skill
│       ├── SKILL.md                           # Core 6-Phase tool-agnostic protocol (v1.0 → v1.1)
│       ├── references/                        # Progressive disclosure (workload, audit rubric, k6/JMeter adapters)
│       ├── scripts/
│       │   ├── analyze_perf_logs.py           # Universal ground-truth analyzer (k6 CSV + JMeter JTL + Generic)
│       │   └── convert_k6_to_jtl.py           # Chuyển đổi 1:1 raw k6 CSV sang định dạng .jtl tương thích
│       └── resources/
│           ├── report_template.md             # Mẫu báo cáo tool-agnostic
│           └── k6/
│               ├── report_view1_trace.js      # Template handleSummary View 1 (Trace / Check Detail HTML)
│               └── report_view3_aggregate.js  # Template handleSummary View 3 (Aggregate Percentile HTML)
├── data/                                      # Dữ liệu CSV Data-Driven
│   ├── users.csv                              # 30 tài khoản admin/staff + 3 tài khoản test lockout
│   ├── coupons.csv                            # Cấu hình coupon (prefix, type fixed/percent, discount, min_order)
│   └── redemptions.csv                        # Dữ liệu đơn hàng thử áp mã (total_amount, boundary cases)
├── scripts/
│   ├── seed_sut.js                            # Seed 30 admin accounts + 3 lockout accounts + 20 mẫu orders
│   └── reset_sut.ps1                          # Restart backend & re-seed sạch (reset lockout & DB) giữa các run
├── test-plans/                                # 3 Test Plans chính + 1 Endurance Plan (đúng format tên)
│   ├── 23120256_Load_YYYYMMDD.js              # View 1: Detailed Trace & Check Report HTML
│   ├── 23120256_Stress_YYYYMMDD.js            # View 2: k6 Built-in Web Dashboard Time-Series HTML
│   ├── 23120256_Spike_YYYYMMDD.js             # View 3: Aggregate Percentile Distribution HTML
│   └── 23120256_Endurance_YYYYMMDD.js         # Soak test 12 phút tìm ngưỡng phần cứng
├── skill-demo/                                # Minh chứng chạy lại Skill v1.1 trên nhóm endpoint phụ (Product & Bulk Import)
│   ├── data/products_demo.csv
│   ├── 23120256_SkillDemo_ProductImport.js
│   └── report/
├── raw-logs/                                  # Raw logs ĐẦY ĐỦ (không chỉ summary!)
│   ├── 23120256_Load_YYYYMMDD.csv             # Raw k6 CSV gốc (--out csv=...)
│   ├── 23120256_Load_YYYYMMDD.jtl             # Bản chuyển 1:1 định dạng JTL từ raw k6 CSV
│   ├── 23120256_Stress_YYYYMMDD.csv
│   ├── 23120256_Stress_YYYYMMDD.jtl
│   ├── 23120256_Spike_YYYYMMDD.csv
│   ├── 23120256_Spike_YYYYMMDD.jtl
│   └── 23120256_Endurance_YYYYMMDD.csv
├── html-reports/                              # 3 thư mục HTML Report riêng biệt (3 kiểu report không lặp)
│   ├── load-trace-report/
│   ├── stress-dashboard-report/
│   ├── spike-aggregate-report/
│   └── endurance-soak-report/
├── proof-image/                               # Ảnh RAW tuân thủ Rule 9 (không vẽ đè / không nén mất chất lượng)
│   ├── hardware_dxdiag.png                    # Ảnh chụp dxdiag rõ Hostname: TRAN_DAI_HIEP
│   ├── load_tool_and_monitor.png              # k6 + Task Manager (node.exe) cùng 1 khung hình
│   ├── stress_tool_and_monitor.png
│   ├── spike_tool_and_monitor.png
│   ├── endurance_tool_and_monitor.png
│   └── github_issues_*.png                    # Ảnh chụp GitHub Issues
├── reports/
│   ├── HW05_Main_Report.md                    # Báo cáo chính (Task 1, Task 2, Task 3, Skill Evolution)
│   ├── HW05_Main_Report.pdf
│   └── bug_reports.md
├── AI/
│   ├── AI_Audit.md                            # Nhật ký tương tác AI đầy đủ (Markdown + PDF)
│   ├── AI_Audit.pdf
│   ├── AI_Critical.md                         # Bài phê bình AI đúng 200–300 từ (Markdown + PDF)
│   └── AI_Critical.pdf
└── ai-templates/                              # 6 biểu mẫu FIT@HCMUS
```

---

## 3. Lộ Trình 8 Giai Đoạn (Skill-First Iterative Pipeline)

### Phase 0 — Thiết Lập Cấu Trúc Project, Môi Trường k6, Git & Hardware Evidence
- **Mục tiêu:** Dựng hoàn chỉnh khung thư mục chuẩn của project `Homework/Week05`, cài `k6`, khởi tạo Git, thu thập bằng chứng phần cứng thật và viết script seed/reset SUT.
- **Công việc:**
  1. **Thiết lập Project Structure chuẩn** theo cây thư mục tại Mục 2 trong `Homework/Week05/`:
     - Khởi tạo đầy đủ các thư mục: `skills/k6-performance-tester/{scripts,templates}`, `data/`, `scripts/`, `test-plans/`, `skill-demo/{data,report}`, `raw-logs/`, `html-reports/{load-trace-report,stress-dashboard-report,spike-aggregate-report,endurance-soak-report}`, `proof-image/`, `reports/`, `AI/`, `ai-templates/`.
     - Đặt `.gitkeep` tại các thư mục chưa có file để Git quản lý cấu trúc ngay từ commit đầu tiên; tạo khung `README.md` ban đầu và `.gitignore` chuẩn (giữ nguyên `test-plans/`, `data/`, `raw-logs/`, `html-reports/`, chỉ bỏ qua file rác tạm/OS).
     - Copy đủ 6 biểu mẫu từ `Homework/AI Templates/` vào `ai-templates/`.
  2. **Khởi tạo Git repository** cục bộ tại `Homework/Week05` (`git init`) để theo dõi lịch sử commit từng bước theo Mục 12 đề bài.
  3. **Cài đặt Grafana k6** (`winget install Grafana.k6 --source winget` hoặc bản ZIP chính thức) và xác minh `k6 version`.
  4. **Thu thập Hardware Evidence:** Chụp ảnh RAW `dxdiag` lưu tại `proof-image/hardware_dxdiag.png` (rõ `TRAN_DAI_HIEP`, CPU, RAM, OS) và trích xuất bảng thông số phần cứng (khớp hostname các bài Homework trước).
  5. **Tạo bộ dữ liệu CSV & Script SUT:**
     - Tạo 3 file CSV: `data/users.csv`, `data/coupons.csv`, `data/redemptions.csv`.
     - Viết `scripts/seed_sut.js`: Đăng ký 30 tài khoản `staff01..30@eshop.com`, nâng quyền `role: "admin"` qua `PUT /api/users/me`, tạo 3 tài khoản `locktest01..03@eshop.com`, và tạo sẵn 20 đơn hàng mẫu để `GET /api/admin/orders` có dữ liệu `LEFT JOIN` thật.
     - Viết `scripts/reset_sut.ps1`: Restart `node server.js` (xóa lockout + reset SQLite) → tự động chạy `seed_sut.js`.
- **Tiêu chí nghiệm thu Phase 0:** Cây thư mục `Homework/Week05` khớp 100% Mục 2; `git status` sạch sau Commit #1; `k6 version` chạy được; `seed_sut.js` nạp thành công dữ liệu lên `http://localhost:3000`; có ảnh `proof-image/hardware_dxdiag.png` rõ hostname `TRAN_DAI_HIEP`.
- **Commit #1:** `chore(setup): scaffold Week05 project structure, k6 environment, CSV datasets, and SUT seed/reset scripts`

---

### Phase 1 — Xây Dựng Agent Skill `k6-performance-tester` (v1.0) *(Làm TRƯỚC để áp dụng trực tiếp!)*
- **Mục tiêu:** Đóng gói kiến trúc, quy tắc chống bẫy AI, template 3 loại HTML report và bộ công cụ ground-truth parser thành Agent Skill chuẩn tại `Homework/Week05/skills/k6-performance-tester/` (và đồng bộ sang `.agents/skills/k6-performance-tester/`).
- **Thiết kế 5 Bước có Cổng Kiểm Duyệt Người (Human-Review Gates) trong `SKILL.md`:**
  - **Gate 1 — API Discovery & Risk Audit:** Đọc mã nguồn backend/spec để trích xuất endpoint, phương thức auth, stateful side-effects (unique constraint, account lockout, DB write contention) trước khi viết code.
  - **Gate 2 — Step-by-Step Parameter & Workflow Design:** Không dùng 1 prompt chung chung; yêu cầu thống nhất rõ VUs, ramp-up, duration, think-time, và phân bổ CSV trước khi sinh kịch bản.
  - **Gate 3 — Test Plan Generation + 3 Distinct Report Views:** Sinh 3 kịch bản Load / Stress / Spike đúng quy tắc tên `{StudentID}_{ScenarioType}_{YYYYMMDD}.js` dùng `SharedArray` và 3 template report khác biệt hoàn toàn (`report_view1_trace.js`, k6 Web Dashboard, `report_view3_aggregate.js`).
  - **Gate 4 — Mandatory Human Review Checklist:** Bắt buộc rà soát & ghi log các lỗi bản nháp AI hay mắc trước khi chạy chính thức (lockout isolation, payload assertion sâu, gắn tags phân nhóm metric).
  - **Gate 5 — Raw Log Capture & Ground-Truth Verification:** Chạy k6 xuất `--out csv`, cho AI phân tích bản nháp trước (phục vụ Misinterpretation Hunt), sau đó chạy `parse_k6_raw.py` để đối chiếu từng con số và kiểm chứng tối ưu dựa trên source code thật.
- **Commit #2:** `feat(skill): create k6-performance-tester Agent Skill v1.0 with report templates and raw-log parsers`

---

### Phase 2 — Áp Dụng Skill v1.0 Thiết Kế & Review 3 Test Plans (Task 1A)
- **Mục tiêu:** Sử dụng chính Agent Skill `v1.0` theo từng bước (không black-box) để tạo 3 kịch bản **Load**, **Stress**, **Spike** cho workflow **Coupon Campaign, Discount Redemption & Order Monitoring**, sau đó thực hiện **Human Review & Fix** kỹ lưỡng.
- **Cấu hình 3 Kịch bản & 3 Report Views (không lặp lại):**

| Kịch bản | Tên file chuẩn | Cấu hình tải k6 (`stages`) | Think-time | Loại Report View (3 loại khác nhau) |
|---|---|---|---|---|
| **Load** | `23120256_Load_YYYYMMDD.js` | Ramp 0→20 VUs (30s) → Hold 20 VUs (2m) → Down 0 (30s) | `1–2.5s` | **View 1: Per-Endpoint & Check Trace HTML** *(dùng `report_view1_trace.js`, hiển thị chi tiết từng nhóm Auth/Read/Tx, tỷ lệ check pass/fail, sample lỗi — tương đương View Results Tree)* |
| **Stress** | `23120256_Stress_YYYYMMDD.js` | Bậc thang: 20 → 50 → 100 → 150 → 200 VUs (mỗi bậc 45s) → Recovery 0 (30s) | `0.5–1.2s` | **View 2: k6 Built-in Web Dashboard Time-Series HTML** *(`K6_WEB_DASHBOARD_EXPORT`, biểu đồ thời gian thực VUs/RPS/Latency/Error + Summary — tương đương Summary Report)* |
| **Spike** | `23120256_Spike_YYYYMMDD.js` | Baseline 10 VUs (30s) → Spike 180 VUs (10s) → Hold 180 VUs (45s) → Drop 10 VUs (15s) → Recovery 10 VUs (45s) | `0.3–0.8s` | **View 3: Aggregate Percentile Distribution HTML** *(dùng `report_view3_aggregate.js`, ma trận `min/avg/med/p90/p95/p99/max` + RPS + Error% theo từng endpoint tag — tương đương Aggregate Report)* |

- **Human Review (Bắt buộc ghi rõ vào Main Report):**
  - Ghi lại nguyên trạng các lỗi/thiếu sót từ bản sinh đầu tiên của AI (VD: quên gắn suffix `${__VU}_${__ITER}` làm trùng `code UNIQUE` ở `POST /api/admin/coupons`, bỏ sót kiểm tra `final_amount < total_amount` khi gặp coupon loại `percent`, dùng chung tài khoản gây khóa toàn bộ VU khi test lockout, đặt ngưỡng `http_req_failed` mà không đánh dấu `expectedStatuses` cho bước kiểm tra `404` sau khi xóa coupon và `401/403` lockout).
  - Giải thích rõ **nguyên nhân** (do đặc thù DB schema/business logic của SUT, độ chi tiết của prompt hay giới hạn model).
- **Commits:**
  - **Commit #3:** `feat(load): apply skill v1.0 to create Load test plan and document human review fixes`
  - **Commit #4:** `feat(stress): create Stress test plan with k6 Web Dashboard summary export`
  - **Commit #5:** `feat(spike): create Spike test plan with Aggregate percentile report`

---

### Phase 3 — Thực Thi 3 Kịch Bản Chính + Thu Thập Bằng Chứng & Quay Video Demo (Task 1B)
- **Mục tiêu:** Chạy thực tế cả 3 kịch bản trên máy `TRAN_DAI_HIEP`, tạo đầy đủ raw logs, HTML reports, ảnh chụp tài nguyên và quay video demo $\ge$ 6 phút.
- **Quy trình chạy chuẩn cho MỖI kịch bản:**
  1. Chạy `scripts/reset_sut.ps1` (khởi động lại backend + re-seed 30 admin + 3 lockout accounts + 20 orders) để đảm bảo không còn lockout cũ — ghi tài liệu các bước reset.
  2. Mở màn hình **Split-Screen**: Nửa trái chạy Terminal `k6` (hoặc Web Dashboard), nửa phải mở **Task Manager** lọc tiến trình `node.exe` thấy rõ **CPU%** và **Memory (MB)**.
  3. **Bắt đầu quay màn hình + tự thuyết minh bằng Tiếng Việt** (tổng 3 kịch bản $\ge$ 6 phút, khuyến nghị 7–9 phút).
  4. Chạy lệnh k6 xuất đầy đủ raw CSV + HTML report:
     - **Load:** `k6 run --out csv=raw-logs/23120256_Load_YYYYMMDD.csv test-plans/23120256_Load_YYYYMMDD.js`
     - **Stress:** `$env:K6_WEB_DASHBOARD="true"; $env:K6_WEB_DASHBOARD_EXPORT="html-reports/stress-dashboard-report/index.html"; k6 run --out csv=raw-logs/23120256_Stress_YYYYMMDD.csv test-plans/23120256_Stress_YYYYMMDD.js`
     - **Spike:** `k6 run --out csv=raw-logs/23120256_Spike_YYYYMMDD.csv test-plans/23120256_Spike_YYYYMMDD.js`
  5. Chụp ảnh màn hình **RAW (Rule 9)** ngay tại đỉnh tải cho từng kịch bản lưu vào `proof-image/`.
  6. Giữ nguyên file raw `.csv` gốc của k6 và chạy `csv_to_jtl.py` tạo thêm bản tương thích `.jtl` 1:1 (ghi chú minh bạch trong báo cáo).
  7. Upload video lên **YouTube (Unlisted)**.
- **Commit #6:** `test(execution): archive raw logs, 3 HTML reports, and resource screenshots for Load/Stress/Spike`

---

### Phase 4 — Endurance / Soak Test (10–15 Phút) & Báo Cáo Bug GitHub Issues (Task 1C)
- **Mục tiêu:** Tìm ngưỡng chịu tải bền vững thực nghiệm trên phần cứng thật và log bug thật lên GitHub Issues.
- **Công việc:**
  1. Thiết kế & chạy `test-plans/23120256_Endurance_YYYYMMDD.js` ở mức tải ổn định (dự kiến **25–35 VUs**) liên tục trong **12 phút**.
  2. Ghi nhận biến thiên theo mốc 2 phút/lần: `RPS`, `p95`, `Error Rate`, `CPU%`, `RAM (MB)` của `node.exe` và **kích thước bảng `coupon_usage`** (quan sát độ trễ `POST /api/apply-coupon` tăng dần do full table scan không có index!).
  3. Kết luận con số ngưỡng phần cứng cụ thể (`Max Stable RPS`, `p95 threshold`, `CPU ceiling`, `Memory ceiling`).
  4. Đẩy test plans & CSV data lên **Public GitHub Repository**, sau đó tạo **GitHub Issues** cho các bug thực tế phát hiện được (Lockout `+2`, Coupon percent formula bug, Min order `>` boundary bug, SQLite write contention / `SQLITE_BUSY`, Broken Access Control FR-12) kèm ảnh chụp RAW lưu trong `proof-image/`.
- **Commit #7:** `test(endurance): add 12-min soak test threshold metrics and GitHub Issues bug report`

---

### Phase 5 — Task 2: AI Analysis, Misinterpretation Hunt & Nâng Cấp Skill lên `v1.1`
- **Mục tiêu:** Cho AI phân tích raw log trước, sau đó dùng script `parse_k6_raw.py` của Skill làm ground-truth để bắt lỗi AI, phân loại tối ưu **Feasible / Hallucinated**, rồi cập nhật bài học thực tế vào **Agent Skill v1.1**.
- **Công việc:**
  1. **Prompt AI phân tích raw logs (chưa đưa output của `parse_k6_raw.py`):** Yêu cầu AI tóm tắt metric, phân tích nguyên nhân nghẽn cổ chai, đề xuất ngưỡng thresholds và 6–8 tối ưu hóa. Lưu nguyên văn vào `AI_Audit.md`.
  2. **Chạy `parse_k6_raw.py` để lấy số liệu Ground-Truth chính xác 100%** từ toàn bộ raw logs Load/Stress/Spike.
  3. **Săn lỗi hiểu sai của AI (Misinterpretation Hunt):** Lập bảng so sánh *Nhận định AI* vs *Giá trị chuẩn từ Raw Log (trích dẫn cụ thể)* vs *Giải thích lỗi* (VD: nhầm `iteration_duration` với `http_req_duration`, đếm sai tổng dòng metric CSV thành số request, gộp `404` verify-delete / `403` lockout vào lỗi server, ước lượng sai `p95`/`p99` do context truncation).
  4. **Đánh giá tối ưu (Feasible vs. Hallucinated):** Đối chiếu trực tiếp với `server.js` & `database.js`:
     - *Feasible:* Bật SQLite `WAL` + `busy_timeout`, tạo index trên `coupon_usage(coupon_id, user_id)` & `users(email)`, chỉ `UPDATE login_attempts = 0` khi `login_attempts > 0`, sửa công thức coupon percent & lockout `+1`.
     - *Hallucinated:* Giảm vòng lặp `bcrypt` *(không dùng bcrypt)*, tăng PostgreSQL connection pool *(dùng single-file `sqlite3`)*, tách microservice/Redis cluster cho local demo app.
  5. **Nâng cấp Skill `k6-performance-tester` lên `v1.1`:** Bổ sung những bài học vừa phát hiện vào checklist của `SKILL.md` (như quy tắc đánh dấu `http.expectedStatuses` cho negative/verify steps, cảnh báo bẫy `UNIQUE` constraint & `SQLITE_BUSY`, rule tự kiểm tra nguồn code trước khi đề xuất tối ưu).
- **Commit #8:** `docs(analysis): complete Task 2 misinterpretation hunt, feasibility audit, and upgrade skill to v1.1`

---

### Phase 6 — Task 3 (Continuous Performance Testing — G9.6) & Video Demo Tái Sử Dụng Skill `v1.1`
- **Mục tiêu:** Hoàn thành đề xuất kiến trúc CPT (Task 3) và quay video end-to-end chứng minh Skill `v1.1` tái sử dụng được trên một nhóm endpoint mới hoàn toàn.
- **Công việc:**
  1. **Task 3 (CPT Proposal):**
     - Thiết kế mô hình **Tiered CPT** (Git diff path filter → Skip / PR Smoke Gate / Nightly Full Load+Soak).
     - Công thức phát hiện suy giảm `p95`: `p95_cur > rolling_baseline_5 * 1.15` **VÀ** `p95_cur - rolling_baseline_5 > 20ms` + cơ chế **Auto-Retry Confirmation** chống nhiễu runner.
     - Vẽ **Mermaid Flowchart** đầy đủ và phân tích chuyên sâu **Trade-offs** (chi phí CI / thời gian chờ PR vs. tỷ lệ False Alarms & False Negatives).
  2. **Demo tái sử dụng Agent Skill `v1.1` (Video YouTube Unlisted):**
     - Áp dụng Skill `v1.1` trực tiếp trên nhóm endpoint mới: **Admin Product Catalog & Bulk CSV Import** (`skill-demo/`).
     - Quay video end-to-end từ lúc gọi Skill → Skill đọc `server.js` → sinh script k6 + CSV → chạy thực tế → chạy `parse_k6_raw.py` xuất kết quả phân tích.
- **Commit #9:** `docs(cpt): add Task 3 Continuous Performance Testing proposal and Skill v1.1 reuse demo`

---

### Phase 7 — Tổng Hợp Báo Cáo Chính, AI Audit/Critique, Xuất PDF & Đóng Gói `.zip`
- **Mục tiêu:** Đảm bảo 100% không thiếu bất kỳ tài liệu bắt buộc nào (tránh bị 0 điểm) và kiểm tra chéo Anti-AI-Cheat.
- **Công việc:**
  1. Hoàn thiện `reports/HW05_Main_Report.md` → xuất `reports/HW05_Main_Report.pdf`.
  2. Dùng skill `ai-audit-extractor` tạo `AI/AI_Audit.md` (đủ tuyên bố *"I use AI tools for the following tasks..."*, công cụ, ngày giờ, prompt, output) → xuất `AI/AI_Audit.pdf`.
  3. Viết `AI/AI_Critical.md` — **kiểm đếm chính xác 200–300 từ** → xuất `AI/AI_Critical.pdf`.
  4. Hoàn thiện `README.md` (bảng Self-Assessment 100 điểm + Test Summary Report + link GitHub repo + link 2 video YouTube Unlisted).
  5. Xuất `git-commit-log.txt` (`git log --stat --date=iso > git-commit-log.txt`).
  6. Push mã nguồn test plans + CSV + skill lên **Public GitHub Repo**.
  7. Nén thành `23120256_HW05_AI_Performance_<SelfAssessedGrade>.zip` và giải nén kiểm tra lại toàn bộ danh mục tệp.
- **Commit #10:** `docs(final): finalize main report, AI Audit/Critique PDFs, README, and git commit log`

---

## 4. Checklist Nghiệm Thu Cuối Cùng (Chống Mất Điểm & Anti-AI-Cheat)

| Hạng mục | Yêu cầu bắt buộc | Trạng thái |
|---|---|---|
| **Không trùng nhóm** | Tránh hoàn toàn Workflow 1 (Purchase/Cart/Checkout) & Workflow 2 (Category CRUD) | [ ] |
| **Tên 3 Test Plans** | `23120256_Load_YYYYMMDD.js`, `23120256_Stress_YYYYMMDD.js`, `23120256_Spike_YYYYMMDD.js` | [ ] |
| **3 Report Views khác nhau** | View 1 (Trace/Check HTML) + View 2 (k6 Web Dashboard HTML) + View 3 (Aggregate Percentile HTML) | [ ] |
| **Raw Logs đầy đủ** | 3 file raw k6 `.csv` đầy đủ (+ bản `.jtl` chuyển 1:1) & 3 thư mục HTML report | [ ] |
| **Endurance Test** | Chạy 10–15 phút, ghi rõ con số ngưỡng (Max stable RPS, p95, CPU/RAM ceiling) | [ ] |
| **Hardware & Resource Proof** | Ảnh RAW `dxdiag` rõ `TRAN_DAI_HIEP` + bảng spec + ảnh k6 & Task Manager cùng khung hình mỗi run | [ ] |
| **Video Demo chính** | YouTube Unlisted, **$\ge$ 6 phút**, k6 + Task Manager cùng khung hình, thuyết minh Tiếng Việt | [ ] |
| **Task 2 (Misinterpretation)** | Bắt lỗi phân tích AI kèm số đúng từ raw log + phân loại Feasible/Hallucinated theo source code thật | [ ] |
| **Task 3 (CPT Proposal)** | Flowchart + cơ chế flag `p95` regression + phân tích trade-offs | [ ] |
| **Agent Skill + Video** | Skill `k6-performance-tester` (v1.0 → v1.1) + video YouTube demo tái sử dụng end-to-end | [ ] |
| **AI Audit & AI Critique** | Đủ Markdown + PDF; AI Critique đúng **200–300 từ** | [ ] |
| **Git, GitHub & `.zip`** | `git-commit-log.txt` + Public GitHub Repo + GitHub Issues screenshots + `23120256_HW05_AI_Performance_XXX.zip` | [ ] |
