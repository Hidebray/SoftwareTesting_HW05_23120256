# 🎬 Kịch Bản Quay Video OBS Chi Tiết — HW05 Performance Testing (23120256)

> **Yêu cầu bắt buộc từ Đề bài HW05:**
> 1. **Video 1 — Demo Performance Testing Chính (YouTube Unlisted, TỐI THIỂU 6 PHÚT):** Hiện rõ **công cụ test (`k6` / Web Dashboard)** VÀ **Resource Monitor (`Task Manager` lọc `node.exe`)** trong **CÙNG 1 KHUNG HÌNH**, kèm **giọng thuyết minh Tiếng Việt của bạn**. *(Có thể quay 1 video liền ~10 phút hoặc chia 3 clip ghép lại thành 1 video duy nhất.)*
> 2. **Video 2 — Demo Agent Skill `performance-tester v1.1` (YouTube Unlisted, ~2.5–3 phút):** Trình bày kiến trúc Skill tái sử dụng độc lập công cụ và chạy demo **end-to-end** trên nhóm endpoint mới (**Admin Product Catalog & Bulk CSV Import**).

---

## ⚙️ BƯỚC 0 — Thiết Lập OBS Studio Trước Khi Bấm Record (1 Phút)

1. **Bố trí màn hình Split-Screen (cho Video 1):**
   - **Nửa trái (50%):** Mở **Windows PowerShell**, gõ sẵn:
     ```powershell
     cd "d:\Project\Software Testing\Homework\Week05"
     $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
     ```
   - **Nửa phải (50%):** Mở **Task Manager** (`Ctrl + Shift + Esc`) → chọn tab **Details** → gõ **`node.exe`** vào ô tìm kiếm trên cùng (đảm bảo nhìn rõ cột `Name`, `PID`, `CPU`, `Working set (memory)`).
2. **Cấu hình OBS Studio:**
   - **Source:** `Display Capture` (chọn màn hình chứa Split-Screen).
   - **Audio:** Bật `Mic/Aux`, test nói thử thấy thanh xanh nhảy rõ, không rè.
   - **Định dạng lưu:** `MKV` hoặc `MP4`, độ phân giải `1920x1080`, `30fps`.

---

## 🎥 VIDEO 1 — DEMO CHÍNH 3 KỊCH BẢN LOAD / STRESS / SPIKE (Tổng ~9–10 phút, dư chuẩn ≥ 6 phút!)

> ⚠️ **Lưu ý quan trọng để KHÔNG ghi đè mất raw log gốc đã đối chiếu:**
> Khi quay lại OBS, ta xuất file vào thư mục tạm `scratch/` (VD: `--out csv=scratch/demo_load.csv`), như vậy **toàn bộ file raw log & HTML report đã khớp 100% trong `raw-logs/` và `html-reports/` KHÔNG bị ghi đè** — hoặc bạn chạy thẳng vào `raw-logs/` cũng được nhưng nên chạy vào `scratch/` để giữ nguyên bộ số liệu đã phân tích khớp từng chữ số trong báo cáo!
> *(Nếu muốn lệnh trong terminal nhìn giống 100% đường dẫn thật, bạn có thể tạm sao lưu 3 file trong `raw-logs/` trước khi chạy — mình khuyến nghị dùng lệnh chạy vào `scratch/` hoặc giữ bản sao lưu.)*

### 🎬 PHÂN CẢNH 1 — Giới Thiệu & Kịch Bản 1: LOAD TEST (`00:00 → 03:20`)

**Lệnh gõ bên PowerShell (trái):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/reset_sut.ps1
k6 run test-plans/23120256_Load_20261121.js
```
*(Ghi chú: không truyền `--out csv` ở lượt quay demo để đỡ tốn 350MB đĩa thừa và chạy mượt khung hình OBS, hoặc chỉ rõ các file `.jtl` đã xuất ở `raw-logs/`!)*

**Lời thoại gợi ý (đọc tự nhiên bằng giọng của bạn):**
- **[00:00 – 00:40 — Mở đầu]:**
  > *"Xin chào thầy cô và các bạn. Em là Trần Đại Hiệp, MSSV 23120256. Hôm nay em trình bày demo thực thi HW05 Performance Testing trên hệ thống EShop Backend API bằng công cụ **Grafana k6**.*
  > *Để tránh trùng lặp với các thành viên trong nhóm, em chọn luồng nghiệp vụ **Coupon Campaign, Discount Redemption & Order Monitoring** gồm 9 bước API, bao phủ đủ 3 nhóm: **Auth-heavy** (`POST /api/login`, `GET /api/users/me`), **Read-heavy** (`GET /api/coupons`, `GET /api/admin/orders` có `LEFT JOIN`), và **Transactional** (tạo coupon động từ CSV, áp mã `apply-coupon`, ghi lượt dùng `coupon-usage`, xóa coupon và kiểm tra `404` sau xóa).*
  > *Bên trái màn hình là PowerShell chạy k6, bên phải là Task Manager giám sát trực tiếp tiến trình backend `node.exe`."*
- **[00:40 – 01:10 — Reset SUT & Bắt đầu Load]:**
  > *"Trước khi chạy, em chạy script `reset_sut.ps1` để khởi động lại backend sạch, xóa mọi trạng thái khóa tài khoản và nạp lại 30 tài khoản admin, 3 tài khoản test lockout và 20 đơn hàng mẫu. Như mọi người thấy ở Task Manager bên phải, tiến trình `node.exe` mới đã lên với đúng PID hiển thị ở terminal.*
  > *Bây giờ em chạy kịch bản 1 — **Load Test** (`23120256_Load_20261121.js`): tăng đều từ 0 lên 20 Virtual Users trong 30 giây, giữ ổn định 20 VUs trong 2 phút rồi giảm về 0."*
- **[01:10 – 02:45 — Quan sát khi đang giữ 20 VUs]:**
  > *"Hiện tại tải đang giữ ổn định 20/20 VUs. Nhìn sang Task Manager bên phải, tiến trình `node.exe` chỉ ăn khoảng 1–2% tổng CPU trên máy i7-13620H 16 luồng và RAM rất ổn định.*
  > *Dữ liệu kiểm thử được nạp hoàn toàn từ 3 file CSV bằng `SharedArray` để tối ưu bộ nhớ: `users.csv`, `coupons.csv` (gồm cả mã giảm tiền cố định và mã phần trăm) và `redemptions.csv` (gồm cả giá trị biên `min_order_amount`).*
  > *Riêng bài Load này sử dụng **Report View 1** — HTML Trace & Check Detail (tương đương View Results Tree của JMeter) để bóc tách Pass/Fail cho từng assertion."*
- **[02:45 – 03:20 — Đọc nhanh Summary lúc Load kết thúc]:**
  > *"Load test vừa hoàn thành sau 3 phút: khoảng ~14,800 requests, thông lượng ~81 req/s, độ trễ `p95` rất thấp chỉ ~16 ms, tỷ lệ lỗi server `5xx` bằng `0%`. Đặc biệt, các assertion kiểm định logic đã tự động bắt được 2 bug thật của backend: gần 290 lần công thức giảm giá phần trăm ra số âm và 27 lần từ chối sai tại biên chính xác `min_order_amount`."*

---

### 🎬 PHÂN CẢNH 2 — Kịch Bản 2: STRESS TEST + k6 WEB DASHBOARD (`03:20 → 07:45`)

**Lệnh gõ bên PowerShell (trái):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/reset_sut.ps1
$env:K6_WEB_DASHBOARD = "true"
$env:K6_WEB_DASHBOARD_PERIOD = "2s"
k6 run test-plans/23120256_Stress_20261121.js
Remove-Item Env:K6_WEB_DASHBOARD, Env:K6_WEB_DASHBOARD_PERIOD -ErrorAction SilentlyContinue
```
*(Mẹo ghi điểm cộng: lúc Stress chạy, bạn có thể mở nhanh tab trình duyệt nhỏ `http://127.0.0.1:5665` chồng lên nửa trái khoảng 15–20 giây để cho TA thấy biểu đồ **k6 Web Dashboard** nhảy theo thời gian thực cùng Task Manager bên phải!)*

**Lời thoại gợi ý:**
- **[03:20 – 04:00 — Reset & Giới thiệu Stress]:**
  > *"Chuyển sang kịch bản 2 — **Stress Test** (`23120256_Stress_20261121.js`). Em chạy lại `reset_sut.ps1` để xóa sạch dữ liệu và lockout trước khi bắt đầu.*
  > *Kịch bản Stress tăng tải theo bậc thang từ 20 → 50 → 100 → 150 → 200 VUs trong 4 phút 15 giây để tìm điểm bão hòa của SQLite single-writer. Đồng thời có một scenario `lockout_behavior_probe` chạy song song ở giây thứ 30 trên 3 tài khoản riêng `locktest01..03` để kiểm tra cơ chế khóa tài khoản mà không làm khóa các VU hợp lệ.*
  > *Kịch bản này dùng **Report View 2** — tính năng **k6 Web Dashboard** tích hợp sẵn xuất biểu đồ Time-Series (tương đương Summary Report)."*
- **[04:00 – 07:00 — Quan sát bậc thang 100 → 150 → 200 VUs]:**
  > *(Chỉ chuột vào Task Manager bên phải khi lên 150–200 VUs)*:
  > *"Khi tải leo lên bậc 150–200 VUs, mọi người thấy CPU của `node.exe` nhảy lên khoảng 5% tổng CPU hệ thống — tức là gần chạm trần 100% của 1 nhân CPU đơn luồng Node.js trên máy 16 luồng! Lúc này độ trễ bắt đầu tăng mạnh do mỗi vòng lặp tạo 4 lệnh ghi SQLite đồng thời trong chế độ journal mặc định chưa bật WAL.*
  > *Đồng thời trên màn hình terminal xuất hiện cảnh báo `high-cardinality` do đường dẫn `DELETE /api/admin/coupons/:id` có ID động — đây là phát hiện thực tế rất hay mà em đã ghi nhận để khắc phục trong bài Endurance và nâng cấp vào Agent Skill `v1.1`."*
- **[07:00 – 07:45 — Đọc Summary Stress]:**
  > *"Stress test hoàn thành với hơn 152,000 requests, thông lượng trung bình ~600 req/s (đỉnh 1 giây đạt 1,278 req/s), độ trễ `p95` tăng lên ~146 ms, trong đó nhóm Transactional chậm nhất (`p95 ~165 ms`). Đáng chú ý, bộ đếm `sut_bug_early_lockout_on_2nd_fail = 3` xác nhận cả 3/3 tài khoản probe đều bị khóa sớm ngay sau 2 lần sai mật khẩu vì code backend cộng `+2` thay vì `+1`."*

---

### 🎬 PHÂN CẢNH 3 — Kịch Bản 3: SPIKE TEST & KẾT THÚC (`07:45 → 10:35`)

**Lệnh gõ bên PowerShell (trái):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/reset_sut.ps1
k6 run test-plans/23120256_Spike_20261121.js
```

**Lời thoại gợi ý:**
- **[07:45 – 08:25 — Reset Lockout & Giới thiệu Spike]:**
  > *"Cuối cùng là kịch bản 3 — **Spike Test** (`23120256_Spike_20261121.js`). Như đề bài yêu cầu, sau khi Stress vừa kích hoạt khóa tài khoản, em chạy lại `reset_sut.ps1` để giải khóa toàn bộ `locked_until` và làm sạch SQLite.*
  > *Bài Spike chạy 2 phút 40 giây: giữ baseline êm 10 VUs trong 30 giây, sau đó bắn vọt đột ngột **18 lần lên 180 VUs chỉ trong 10 giây**, giữ sốc 45 giây rồi tụt nhanh về 10 VUs để đo khả năng tự hồi phục (recovery).*
  > *Bài này sử dụng **Report View 3** — ma trận phân vị **Aggregate Percentile HTML** (tương đương Aggregate Report)."*
- **[08:25 – 09:45 — Quan sát pha sốc 180 VUs & pha hồi phục 10 VUs]:**
  > *"Ở giây thứ 40, lượng VUs nhảy dựng đứng lên 180 VUs, CPU của `node.exe` lập tức vọt lên ~5% ở Task Manager. Khi tải tụt về 10 VUs ở phút 1:40, CPU hạ nhanh trở lại ~1%, chứng tỏ backend không bị treo hay chết tiến trình sau cú sốc."*
- **[09:45 – 10:35 — Chốt kết quả Spike & Mở nhanh 3 HTML Reports]:**
  > *"Kết thúc bài Spike với hơn 40,000 requests, `p95` vọt lên ~532 ms do sốc tải (nhưng vẫn `0%` lỗi 5xx và hồi phục về ~21 ms ở pha cuối). Em xin mở lướt nhanh 3 giao diện báo cáo HTML hoàn toàn khác nhau đã xuất ra: View 1 Trace HTML của Load, View 2 Web Dashboard của Stress, và View 3 Aggregate Percentile của Spike — trong đó `ep_06_post_apply_coupon` là nút cổ chai số 1 với `p95 = 648.92 ms`. Cảm ơn thầy cô đã theo dõi!"*

*(Tổng thời lượng Video 1 ≈ **10 phút**, đảm bảo dư chuẩn $\ge$ 6 phút và 100% đúng quy định Anti-AI-Cheat!)*

---

## 🎥 VIDEO 2 — DEMO AGENT SKILL `performance-tester v1.1` END-TO-END (Tổng ~2.5 – 3 phút)

> Quay toàn màn hình IDE + PowerShell + Trình duyệt mở HTML Report, upload **YouTube Unlisted** riêng cho Mục 7 (10 điểm Agent Skill).

### 🎬 PHÂN CẢNH 1 — Giới Thiệu Kiến Trúc Skill Chuẩn & Độc Lập Công Cụ (`00:00 → 00:50`)
- **Mở thư mục `skills/performance-tester/` trong IDE** (mở lướt `SKILL.md`, `references/adapters/k6_adapter.md`, `references/adapters/jmeter_adapter.md`, `scripts/analyze_perf_logs.py`).
- **Lời thoại gợi ý:**
  > *"Trong video này em demo **Agent Skill `performance-tester` (v1.1)** — được thiết kế theo chuẩn **Progressive Disclosure** và **100% độc lập công cụ (tool-agnostic)** để tái sử dụng cho mọi dự án backend API.*
  > *Tầng lõi `SKILL.md` định nghĩa quy trình 6 pha có cổng kiểm duyệt người dùng (Human-Review Gates). Khi chạy bằng công cụ nào, Agent mới nạp adapter tương ứng trong `references/adapters/` như `k6_adapter.md` hoặc `jmeter_adapter.md`. Script `analyze_perf_logs.py` tự nhận diện cả k6 CSV lẫn JMeter `.jtl` để tính Ground-Truth chống AI đọc nhầm log.*
  > *Sau khi áp dụng bản `v1.0` cho bài chính, em đã nâng cấp lên `v1.1` bổ sung 3 quy tắc thực chiến: gắn `name` tag chống high-cardinality cho URL có `:id`, reset dual-stack IPv4/IPv6, và cổng kiểm chứng ảo giác DBMS/Auth."*

### 🎬 PHÂN CẢNH 2 — Áp Dụng Skill Lên Nhóm Endpoint Mới Hoàn Toàn (`00:50 → 01:30`)
- **Mở nhanh `skill-demo/data/products_demo.csv` và `skill-demo/23120256_SkillDemo_ProductImport.js`.**
- **Lời thoại gợi ý:**
  > *"Để chứng minh khả năng tái sử dụng, em áp dụng Skill `v1.1` lên một nhóm endpoint hoàn toàn mới chưa dùng trong bài chính: **Admin Product Catalog & Bulk CSV Import (Pool C FR-15 & FR-16)**, gồm 6 bước: `POST /api/login` → `GET /api/products` → `POST /api/products` → `PUT /api/products/:id` → `POST /api/admin/import-products` (import hàng loạt 3 sản phẩm) → `DELETE /api/products/:id`. Toàn bộ request có `:id` đều đã gắn `name` tag theo chuẩn `v1.1`."*

### 🎬 PHÂN CẢNH 3 — Chạy End-to-End & Phân Tích Ground-Truth (`01:30 → 02:45`)
**Chạy tuần tự 3 lệnh sau trong PowerShell:**
```powershell
cd "d:\Project\Software Testing\Homework\Week05"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
powershell -ExecutionPolicy Bypass -File scripts/reset_sut.ps1
k6 run --out csv=skill-demo/report/skill_demo_raw.csv skill-demo/23120256_SkillDemo_ProductImport.js
python skills/performance-tester/scripts/analyze_perf_logs.py skill-demo/report/skill_demo_raw.csv --md skill-demo/report/ground_truth_skill_demo.md
```
- **Lời thoại gợi ý:**
  > *"Bây giờ em chạy trực tiếp kịch bản 25 giây trên SUT thật... Như mọi người thấy, kịch bản chạy hoàn toàn sạch, 0 cảnh báo high-cardinality, 0% lỗi trên 1,632 requests.*
  > *Tiếp theo, em chạy ngay script `analyze_perf_logs.py` của Skill trên file raw CSV vừa sinh ra. Nó tự động phân biệt 22,082 dòng CSV với 1,632 HTTP requests thật và chỉ ra ngay `post_bulk_import` là endpoint chậm nhất (`p95 ~60 ms`, `max ~178 ms`) do backend chạy vòng lặp `INSERT` SQLite mà không bọc transaction."*

### 🎬 PHÂN CẢNH 4 — Mở HTML Report Kết Quả & Kết Thúc (`02:45 → 03:00`)
- **Mở `skill-demo/report/index.html` trên trình duyệt.**
- **Lời thoại gợi ý:**
  > *"Cuối cùng đây là báo cáo HTML Aggregate được Skill tự động xuất offline với bảng phân vị và biểu đồ thanh cho cả 6 endpoint mới. Như vậy Skill `performance-tester v1.1` đã hoạt động trơn tru end-to-end và sẵn sàng tái sử dụng cho các bài kiểm thử hiệu năng sau này. Em xin cảm ơn!"*
