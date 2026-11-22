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

Trong quá trình thực hiện bài tập HW05, AI bộc lộ hai nhóm sai sót và thiên lệch rõ rệt. Thứ nhất, AI dễ lệch phạm vi kiểm thử hiệu năng và thiếu tính phổ quát: thiết kế ban đầu của Agent Skill bị gắn chặt vào k6 thay vì độc lập công cụ; AI tự đưa lỗi bảo mật tĩnh ngoài phạm vi (BUG-05) và đề xuất script tái hiện ngoài (repro_bugs.js) thay vì chỉ thu thập bằng chứng trực tiếp từ các phiên chạy k6 thật; một số script hạ tầng như reset_sut.ps1 cũng bỏ sót tiến trình trên IPv6 khi dọn môi trường. Thứ hai, ở Task 2, phiên AI cô lập hiểu sai sáu chỉ số định lượng (đánh giá lệch độ trễ Stress/Spike tới 15–31 lần và đề xuất ngưỡng SLA Spike lệch 10,6 lần) đồng thời ảo giác bốn trên tám tối ưu cho bcrypt và PostgreSQL dù backend dùng sqlite3 với mật khẩu plaintext. AI không tự phát hiện các lỗi này vì chỉ tiếp nhận các đoạn log bị cắt đầu cuối gây méo phân vị, thiếu đối chiếu mã nguồn thật khi suy đoán theo kiến trúc web phổ biến, và có xu hướng chọn giải pháp thay thế nhanh thay vì tuân thủ chặt kỷ luật bằng chứng thực nghiệm. Nguyên tắc hợp tác rút ra là luôn điều phối AI theo từng cổng phê duyệt nhỏ, giữ quyền kiểm soát phạm vi kiểm thử, và bắt buộc kiểm chứng mọi số liệu lẫn khuyến nghị của AI bằng script ground-truth độc lập cùng mã nguồn thực tế.
