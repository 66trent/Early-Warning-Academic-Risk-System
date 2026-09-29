---
name: notification-dispatch
description: Dùng khi thêm một điểm phát sinh thông báo mới (email/in-app) liên quan tới Alert — đảm bảo tuân thủ chính sách chống gửi trùng và tần suất theo Severity. Kích hoạt khi người dùng nói "gửi thông báo khi...", "thêm email cảnh báo cho...", "thông báo CVHT khi...".
---

# Thêm một điểm gửi thông báo (Notification)

Tham chiếu bắt buộc: `.agents/rules/06-security.md` (bảng tần suất/kênh theo Severity), `.agents/rules/11-data-schema-rule-engine.md` (bảng `Notification`).

## Nguyên tắc — MUST NOT gọi Nodemailer trực tiếp từ bất kỳ đâu ngoài `modules/alerts/services/notification.service.ts`

Mọi thông báo, dù trigger từ đâu (Rule Engine tạo Alert mới, CVHT ghi Intervention, job nền...), MUST đi qua đúng 1 hàm `dispatchNotification(alert, recipient, channel)`.

## Thuật toán bắt buộc bên trong `dispatchNotification`

1. Tính `dedupKey = studentId + ruleCode + severity` (nếu Alert gộp nhiều `RuleTrigger` với `ruleCode` khác nhau, dùng `ruleCode` của luật có severity cao nhất).
2. Tra Redis cache (ưu tiên, nhanh) rồi tới bảng `Notification` xem có bản ghi `status = SENT` nào cùng `dedupKey` còn trong cửa sổ debounce của severity đó không (bảng tần suất ở `06-security.md`: `MEDIUM` = 24h, `HIGH` = 6h, `CRITICAL` = không giới hạn/luôn gửi, `LOW` = không gửi riêng lẻ).
3. Nếu còn trong cửa sổ debounce → tạo `Notification` với `status = SUPPRESSED_DUPLICATE`, MUST NOT gọi Nodemailer, return sớm.
4. Nếu không → đẩy job vào queue `send-notifications` (BullMQ) thay vì gửi đồng bộ ngay trong request — worker xử lý gửi thật qua Nodemailer, cập nhật `status = SENT`/`FAILED` sau khi có kết quả.
5. Với severity `MEDIUM`: MUST gộp thành 1 email digest cuối ngày thay vì gửi ngay từng cái — dùng job định kỳ riêng, không dispatch ngay khi Alert phát sinh.
6. Với severity `CRITICAL`: bên cạnh email/in-app, MUST kèm ghi chú trong `Alert`/`Intervention` gợi ý CVHT thực hiện liên hệ trực tiếp (gọi điện) — hệ thống không tự động gọi điện, chỉ nhắc.

## Checklist

- [ ] Không có nơi nào trong code gọi `nodemailer.sendMail` trực tiếp ngoài worker xử lý queue `send-notifications`.
- [ ] `dedupKey` tính đúng công thức, không tự chế công thức khác.
- [ ] Có test: gửi 2 lần liên tiếp trong cửa sổ debounce → lần 2 phải bị `SUPPRESSED_DUPLICATE`.
- [ ] Nội dung email/in-app tuân theo ngôn ngữ trung tính đã quy định ở `.agents/rules/07-ux-design.md` (không đổ lỗi, có gợi ý hành động) và luôn kèm dòng "cảnh báo mang tính tham khảo".
