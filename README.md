# HW05 – Performance Testing on EShop REST Backend API (k6)

> **Môn học:** Kiểm thử phần mềm (Software Testing) – FIT@HCMUS  
> **Bài tập:** HW05 – Performance Testing (AI-First + Human Review)  
> **Sinh viên:** Trần Đại Hiệp  
> **Mã số sinh viên (MSSV):** `23120256`  
> **Email:** `23120256@student.hcmus.edu.vn`  
> **Hệ thống kiểm thử (SUT):** [EShop Backend API (`eshop-sut/backend`)](https://github.com/ttbhanh/eshop-sut)  
> **Công cụ kiểm thử:** Grafana k6 *(Bonus Tool)*  
> **Workflow kiểm thử:** **Coupon Campaign, Discount Redemption & Order Monitoring** *(Pool A FR-02/FR-04 + Pool B FR-09 + Pool C FR-17/FR-18)*  
> **Public GitHub Repository:** *(Sẽ cập nhật sau khi push)*  
> **Video Demo Chính (YouTube Unlisted, ≥ 6 phút):** *(Sẽ cập nhật ở Phase 3)*  
> **Video Demo Agent Skill (YouTube Unlisted):** *(Sẽ cập nhật ở Phase 6)*

---

## 1. Bảng Tự Đánh Giá (Self-Assessment Table — 100 điểm)

| No. | Criteria | Grade | Self-Assessed Grade |
|:---:|---|:---:|:---:|
| 1 | Task 1 — Load testing | 30 | TBD |
| 2 | Task 1 — Stress testing | 20 | TBD |
| 3 | Task 1 — Spike testing | 20 | TBD |
| 4 | Task 2 — AI analysis + misinterpretation hunt (with correct values from raw logs) | 10 | TBD |
| 5 | Task 3 — Continuous Performance Testing proposal (G9.6) | 10 | TBD |
| 6 | Agent Skills | 10 | TBD |
| | **Total** | **100** | **TBD** |

---

## 2. Test Summary Report

*(Sẽ được điền đầy đủ số liệu thực nghiệm sau khi hoàn tất Phase 3–6)*

- **Scenarios Run:** Load, Stress, Spike, Endurance (12 phút)
- **Endpoint Groups Covered:**
  - **Auth-heavy:** `POST /api/login` (kèm kiểm chứng Account Lockout), `GET /api/users/me`
  - **Read-heavy:** `GET /api/coupons`, `GET /api/admin/orders`
  - **Transactional:** `POST /api/admin/coupons`, `POST /api/apply-coupon`, `POST /api/coupon-usage`, `DELETE /api/admin/coupons/:id` + Verification (`POST /api/apply-coupon` → `404`)
- **Endurance Threshold:** *(TBD — Phase 4)*
- **Bugs / Performance Issues Logged:** *(TBD — Phase 4)*
- **Demo Video Links:** *(TBD — Phase 3 & Phase 6)*

---

## 3. Hướng Dẫn Khởi Chạy & Reset SUT Nhanh

```powershell
# Khởi động lại backend sạch + nạp 30 tài khoản admin + 3 lockout probes + 20 đơn hàng mẫu
powershell -ExecutionPolicy Bypass -File scripts/reset_sut.ps1
```

