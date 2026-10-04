---
name: alert-lifecycle-transition
description: Dùng khi implement hành động đổi trạng thái Alert (xác nhận, xử lý, đóng, mở lại) — đảm bảo đúng ràng buộc chuyển trạng thái và các side-effect bắt buộc. Kích hoạt khi người dùng nói "xác nhận cảnh báo", "đổi trạng thái alert", "resolve/dismiss cảnh báo", "CVHT xử lý cảnh báo".
---

# Chuyển trạng thái Alert

Tham chiếu: `.agents/rules/11-data-schema-rule-engine.md` (bảng `Alert`, ràng buộc chuyển trạng thái).

## Sơ đồ trạng thái hợp lệ — MUST chặn mọi chuyển trạng thái ngoài sơ đồ này

```
OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED
                    ↘             ↘
                      DISMISSED     (RESOLVED/DISMISSED) → REOPENED → ACKNOWLEDGED
Bất kỳ trạng thái nào → INVALIDATED (khi dữ liệu nguồn bị sửa khiến cảnh báo không còn đúng)
```

## Ràng buộc bắt buộc cho từng transition

| Chuyển sang    | Điều kiện bắt buộc trước khi cho phép                                                                            | Side-effect bắt buộc                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ACKNOWLEDGED` | Actor phải là `assignedAdvisorId` của Alert hoặc có quyền phạm vi tương đương                                    | Ghi Audit Log                                                                                                      |
| `IN_PROGRESS`  | Alert đang `ACKNOWLEDGED`                                                                                        | Ghi Audit Log                                                                                                      |
| `RESOLVED`     | SHOULD có ít nhất 1 `Intervention` liên kết (`alertId` trỏ đúng Alert này)                                       | Ghi Audit Log; MUST suppress mọi `Notification` `QUEUED` còn lại cho `dedupKey` liên quan                          |
| `DISMISSED`    | MUST có lý do — lấy từ `Intervention.content` hoặc field lý do riêng, không cho phép để trống                    | Ghi Audit Log                                                                                                      |
| `INVALIDATED`  | Chỉ hệ thống (job nền) hoặc `ADMIN` mới được set, không phải hành động tay của CVHT thông thường                 | Ghi Audit Log kèm lý do dữ liệu nguồn nào đã đổi                                                                   |
| `REOPENED`     | Chỉ áp dụng khi Alert đang `RESOLVED`/`DISMISSED` VÀ có `RuleTrigger` mới khớp cùng khóa tương quan sau cooldown | Ghi Audit Log; reset `firstDetectedAt`? MUST NOT — giữ nguyên `firstDetectedAt` gốc, chỉ cập nhật `lastDetectedAt` |

## Quy trình implement

1. Viết hàm `transitionAlertStatus(alertId, targetStatus, actor, meta)` trong `modules/alerts/services/` — validate bảng trên TRƯỚC khi update DB, MUST throw lỗi rõ ràng nếu transition không hợp lệ (không âm thầm bỏ qua).
2. Server Action gọi hàm này theo đúng khuôn mẫu ở skill `scaffold-server-action` (session → assertScope → service → audit log).
3. MUST NOT expose 1 API tổng quát "update Alert status" nhận status tùy ý từ client — mỗi transition có Server Action riêng (`acknowledgeAlert`, `resolveAlert`, `dismissAlert`...), dễ audit và dễ giới hạn quyền theo từng hành động.
4. Viết test cho: mọi transition hợp lệ trong bảng trên, và MUST có test xác nhận các transition KHÔNG có trong sơ đồ bị từ chối (VD: `OPEN → RESOLVED` trực tiếp phải bị chặn).
