---
name: pre-merge-review
description: Dùng như bước tự rà soát cuối cùng trước khi báo cáo hoàn thành một task hoặc trước khi tạo Pull Request — chạy qua toàn bộ checklist bắt buộc của dự án (phân quyền, audit log, comment, test, ranh giới phạm vi hệ thống). Kích hoạt khi người dùng nói "review lại code", "kiểm tra trước khi merge", "xong chưa", hoặc tự động chạy trước khi báo cáo hoàn tất 1 task động vào dữ liệu sinh viên/luật/cảnh báo.
---

# Tự rà soát trước khi merge

Tổng hợp checklist từ toàn bộ `.agents/rules/`. Chạy đủ 6 nhóm dưới đây trước khi coi 1 task là hoàn thành — không bỏ qua nhóm nào chỉ vì task "có vẻ nhỏ".

## 1. Ranh giới phạm vi hệ thống — kiểm tra trước tiên, quan trọng nhất

- [ ] Không có dòng code nào (Server Action, service, job nền) ghi/sửa `Student.officialAcademicStatus`.
- [ ] Mọi `Alert` mới tạo giữ `isReferenceOnly = true`.
- [ ] Không có tính năng nào tự động thực hiện hành động hành chính thay cho CVHT/cán bộ (hệ thống chỉ phát hiện → cảnh báo → gửi → cho xác nhận).

## 2. Phân quyền & bảo mật

- [ ] Mọi Server Action đọc/ghi dữ liệu sinh viên gọi `assertScope()` trước khi truy vấn.
- [ ] Mọi hành động thuộc danh sách bắt buộc (cấu hình luật, đổi trạng thái Alert, thao tác ImportBatch, truy cập hồ sơ ngoài phạm vi phụ trách, đổi vai trò) đều gọi `writeAuditLog()`.
- [ ] Input từ bên ngoài (form, file, webhook) qua Zod `.parse()` — không có `any` không giải thích.
- [ ] Nếu động vào tài khoản `role = STUDENT`, email đã validate đúng domain `@student.ctuet.edu.vn`.

## 3. Đúng đặc tả nghiệp vụ

- [ ] Nếu code liên quan luật `HR-*`, đối chiếu lại với `08-business-rules-catalog.md` — điều kiện, ngưỡng, loại trừ khớp đúng, không tự suy diễn thêm.
- [ ] Không hard-code ngưỡng số (buổi, %, ngày) — đọc từ `RuleVersion.condition`.
- [ ] Nếu liên quan `RiskScore`, đã xử lý đúng `DataStatus`/`DataCompletenessLevel` theo 2 tầng đã định nghĩa, không coi thiếu dữ liệu là rủi ro thấp/cao.

## 4. Chất lượng code

- [ ] `strict` TypeScript, không lỗi ESLint.
- [ ] Tên field/entity khớp 100% với `.agents/rules/09`–`12-data-schema-*.md`.
- [ ] Comment đúng quy ước (JSDoc cho hàm export, mã luật ở đầu hàm evaluator, không có dead code comment-out).
- [ ] Test mới cho mọi nhánh logic mới — đặc biệt trong `rule-engine`/`data-import` (coverage ≥90%/≥80%).

## 5. Hiệu suất

- [ ] Query danh sách có phân trang, không `findMany()` không giới hạn.
- [ ] Không load nguyên file lớn vào memory (đọc stream).
- [ ] Job nặng chạy qua BullMQ, không chạy đồng bộ trong request.

## 6. UI/UX (nếu có thay đổi giao diện)

- [ ] Severity dùng đúng bảng màu chuẩn, không hard-code màu riêng.
- [ ] Mọi hiển thị `RiskScore` kèm `DataCompletenessLevel`.
- [ ] Giao diện sinh viên không hiển thị dữ liệu kỹ thuật thô (`inputSnapshot`), ngôn ngữ tích cực, không dùng từ "rủi ro/cảnh báo" làm tiêu đề chính.

Nếu bất kỳ mục nào trong 6 nhóm trên chưa đạt, MUST sửa trước khi báo cáo hoàn thành — không báo "xong" khi còn mục chưa tick.
