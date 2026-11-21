# AI Usage Critical Assessment

| Field | Value |
|-------|-------|
| **Project / Task** | HW05 — Performance Testing on EShop REST Backend API (k6) |
| **Conversation ID** | `89514c5d-040c-46ef-81e7-9c9044e488b9` |
| **Assessment Date** | `2026-11-21` |
| **Language** | Vietnamese |
| **Exchanges analyzed** | `8` user inputs, `35` AI responses, `52` tool calls |
| **Source completeness** | `COMPLETE` |

---

## Assessment

Trong phiên làm việc gồm 8 lượt trao đổi (102 bước hợp lệ và 52 lượt gọi công cụ), AI (`Gemini 4 Neon (Medium)`) hỗ trợ đọc đề bài HW05 cùng mã nguồn `eshop-sut` (`server.js`, `database.js`) để nhận diện đặc thù kỹ thuật, lập kế hoạch `PLAN.md`, triển khai Phase 0 (cây thư mục, 3 tập CSV, `seed_sut.js`, `reset_sut.ps1`, `00_hardware_and_environment.md`, cài `k6 v2.4.0`), tạo commit Git đầu tiên và dựng giao diện HTML minh họa luồng Agent Skill. Đầu ra của AI không được chấp nhận thụ động mà chịu sự điều hướng liên tục từ sinh viên: yêu cầu tránh hai luồng nghiệp vụ đã dùng trong nhóm, đề xuất xây dựng Agent Skill trước để áp dụng ngược cho bài làm, bổ sung phần khởi tạo cấu trúc dự án, áp đặt cơ chế chờ duyệt trước khi thực thi và buộc AI dừng lại để sinh viên tự chụp ảnh bằng chứng. Nhật ký ghi nhận nhiều lỗi kỹ thuật buộc AI sửa và thử lại: lệnh `git log` thất bại khi thư mục chưa khởi tạo Git, một tác vụ quét thư mục bị hủy, lệnh `winget install Grafana.k6` sai mã gói trước khi đổi sang `GrafanaLabs.k6`, script `seed_sut.js` hai lần gặp lỗi HTTP 500 khi nâng quyền trước khi nạp đủ 33 tài khoản và 20 đơn hàng ở lần sửa thứ ba, và lệnh ghép `&&` bị PowerShell từ chối. Nhìn chung, vai trò AI phù hợp với giai đoạn thiết kế và thiết lập môi trường; tuy nhiên phiên này mới dừng ở hoàn tất Phase 0 và đề xuất Phase 1, chưa có bằng chứng kiểm chứng cho các kịch bản k6 hay phân tích log sau đó.
