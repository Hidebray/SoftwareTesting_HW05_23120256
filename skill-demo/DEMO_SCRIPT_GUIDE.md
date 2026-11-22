# Kịch Bản Quay Video Demo Agent Skill `performance-tester` (v1.1) — 2–3 Phút

> Dùng để quay **Video Demo Agent Skill** (YouTube Unlisted) nộp theo Mục 7 đề bài HW05 (*"shows, end to end, how you used the skill on a complete endpoint group"*).

---

## 1. Nội Dung Cần Hiện Trên Màn Hình (OBS Studio)
1. **Phút 0:00 – 0:45 (Giới thiệu kiến trúc Skill chuẩn Progressive Disclosure):**
   - Mở cây thư mục `skills/performance-tester/` trong IDE: giới thiệu `SKILL.md` (100% tool-agnostic 6-Phase protocol), `references/adapters/{k6,jmeter}_adapter.md` (cắm rút công cụ), `scripts/analyze_perf_logs.py` (tự nhận diện cả k6 CSV & JMeter JTL), và các nâng cấp `v1.1` (High-Cardinality `name` tag guard, Dual-Stack Reset, DBMS hallucination gate).
2. **Phút 0:45 – 1:30 (Áp dụng Skill lên nhóm Endpoint mới hoàn toàn — Pool C FR-15 & FR-16):**
   - Mở nhanh `skill-demo/data/products_demo.csv` và `skill-demo/23120256_SkillDemo_ProductImport.js` (chỉ rõ workflow mới: `POST /api/login` → `GET /api/products` → `POST /api/products` → `PUT /api/products/:id` → `POST /api/admin/import-products` → `DELETE /api/products/:id`, có sẵn `tags: { name: 'PUT /api/products/:id' }` theo chuẩn `v1.1`).
3. **Phút 1:30 – 2:30 (Chạy End-to-End & Phân tích Ground-Truth ngay trên Terminal):**
   Chạy tuần tự 3 lệnh sau trong PowerShell:
   ```powershell
   cd "d:\Project\Software Testing\Homework\Week05"
   $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
   powershell -ExecutionPolicy Bypass -File scripts/reset_sut.ps1
   k6 run --out csv=skill-demo/report/skill_demo_raw.csv skill-demo/23120256_SkillDemo_ProductImport.js
   python skills/performance-tester/scripts/analyze_perf_logs.py skill-demo/report/skill_demo_raw.csv --md skill-demo/report/ground_truth_skill_demo.md
   ```
4. **Phút 2:30 – 3:00 (Mở kết quả trực quan):**
   - Mở `skill-demo/report/index.html` trên trình duyệt (thấy bảng Aggregate Percentile + biểu đồ thanh của 6 endpoint mới) và mở `skill-demo/report/ground_truth_skill_demo.md` → kết luận Skill tái sử dụng 100% cho bất kỳ nhóm endpoint và công cụ nào.
