# AI Usage Critical Assessment

| Field | Value |
|-------|-------|
| **Project / Task** | HW05 — Performance Testing on EShop REST Backend API (k6) |
| **Conversation ID** | `89514c5d-040c-46ef-81e7-9c9044e488b9` |
| **Assessment Date** | `2026-11-22` |
| **Language** | Vietnamese |
| **Exchanges analyzed** | `29` user inputs, `130+` AI responses, `160+` tool calls |
| **Source completeness** | `COMPLETE` |

---

## Assessment

Trong bài tập HW05 với `k6`, AI (`Gemini 4 Neon` và subagent `Gemini Flash`) hỗ trợ tốt việc thiết kế kịch bản, xây dựng Agent Skill `performance-tester` và phân tích log, nhưng vẫn bộc lộ nhiều sai sót, thiên lệch và khoảng trống buộc con người kiểm duyệt. Ở giai đoạn thiết kế, AI ban đầu viết skill gắn cứng vào `k6` làm giảm tính tái sử dụng, đưa `BUG-05` ngoài phạm vi bảo mật vào báo cáo, đề xuất script tái hiện thay vì lấy bằng chứng trực tiếp từ phiên chạy k6, và sinh lỗi trong `seed_sut.js` lẫn `reset_sut.ps1` (bỏ sót tiến trình IPv6 khiến dữ liệu seed bị xóa chồng). Ở Task 2, khi chỉ đọc trích đoạn raw log, `Gemini Flash` bị thiên lệch cửa sổ ngữ cảnh nên đảo ngược độ trễ Stress thấp hơn Load, chọn nhầm endpoint chậm nhất, đặt ngưỡng Spike lệch 10,6 lần thực tế, và ảo giác các công nghệ không tồn tại như `bcrypt`, connection pool 30–50 và PostgreSQL `autovacuum` dù SUT dùng SQLite và mật khẩu plaintext. Nguyên nhân là AI thiếu ngữ cảnh toàn cục và hay suy diễn theo khuôn mẫu phổ biến thay vì kiểm chứng trên log đầy đủ và mã nguồn thật. Từ đó, nguyên tắc cộng tác mình rút ra là luôn kiểm duyệt từng cổng (Human-in-the-Loop): dùng AI tăng tốc tạo nháp, nhưng mọi chỉ số hiệu năng phải kiểm chứng bằng script Ground-Truth trên log gốc và mọi tối ưu phải đối chiếu trực tiếp với mã nguồn trước khi chấp nhận.
