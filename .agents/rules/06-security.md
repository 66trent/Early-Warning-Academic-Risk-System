# 06 — Bảo mật

Xem `00-project-context.md` cho glossary và bảng phạm vi role.

## Xác thực (Better Auth)

- MUST: dùng cơ chế hash mặc định của Better Auth — MUST NOT tự viết hàm hash mật khẩu riêng.
- MUST: session hết hạn sau thời gian không hoạt động hợp lý (khuyến nghị 8 giờ phiên thường, tối đa 30 ngày cho "remember me").
- MUST: đăng nhập thất bại nhiều lần liên tiếp bị rate-limit và ghi Audit Log.

## Phân quyền theo phạm vi (Scope-based Authorization) — không thương lượng

- MUST: kiểm tra quyền ở tầng Server Action/Route Handler cho MỌI thao tác đọc/ghi dữ liệu sinh viên — MUST NOT chỉ dựa vào việc ẩn UI. Gọi hàm dùng chung:
  ```ts
  await assertScope(session.user, { studentId, resourceType: "Alert" });
  ```
- MUST: áp dụng đúng ma trận phạm vi trong `00-project-context.md` (`STUDENT` chỉ xem chính mình; `ADVISOR` chỉ sinh viên đang phụ trách; `TRAINING_OFFICER` theo `scopeConfig`; `ADMIN` toàn quyền vận hành nhưng không có quyền ghi `officialAcademicStatus`).
- MUST: dùng UUID cho mọi tài nguyên nhạy cảm (`Alert`, `Intervention`) — MUST NOT dùng ID tuần tự dễ đoán (chống IDOR).

## Checklist STRIDE khi code từng module

| Đe dọa                 | Việc phải làm                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Spoofing               | Dùng session token ký bởi Better Auth — MUST NOT tự chế cookie/token thủ công                                                       |
| Tampering              | Mọi thay đổi `RuleVersion` qua Server Action có validate + Audit Log — MUST NOT cho sửa DB trực tiếp qua công cụ ngoài ở production |
| Repudiation            | Mọi thay đổi trạng thái `Alert` ghi Audit Log đầy đủ actor + timestamp — không cho xóa bản ghi này                                  |
| Information Disclosure | MUST có test tự động xác nhận CVHT A không truy vấn được dữ liệu sinh viên thuộc CVHT B                                             |
| Denial of Service      | Rate-limit API đồng bộ LMS/import file; giới hạn kích thước file upload (khuyến nghị tối đa 20MB)                                   |
| Elevation of Privilege | MUST NOT có endpoint nào tự nâng `Role`/`scopeConfig` của chính người gọi — đổi vai trò chỉ qua module `admin`, có Audit Log        |

## Audit Logging — append-only, bắt buộc

- MUST NOT: expose bất kỳ Server Action nào `UPDATE`/`DELETE` bảng `AuditLog`. Nếu cần "xóa" theo yêu cầu pháp lý, dùng ẩn danh hóa (xem `04-legal-compliance.md`).
- MUST: ghi Audit Log cho: cấu hình luật, đổi trạng thái `Alert`, truy cập hồ sơ chi tiết 1 sinh viên bởi người không phải CVHT phụ trách trực tiếp, mọi thao tác `ImportBatch` (tạo/hủy/nhập lại), đăng nhập thất bại, thay đổi vai trò/phạm vi tài khoản.
- MUST: dùng đúng 1 hàm `writeAuditLog()` trong `lib/audit.ts`, gọi từ mọi nơi liên quan — MUST NOT copy-paste logic ghi log ở nhiều chỗ.

## Notification Policy — chống gửi trùng theo Severity

Xem `Notification` entity ở `11-data-schema-rule-engine.md`. Bảng dưới quy định tần suất/kênh MUST tuân theo khi implement `modules/alerts`:

| Severity   | Tần suất tối đa                                   | Kênh           | Gộp (batching)?                                                     |
| ---------- | ------------------------------------------------- | -------------- | ------------------------------------------------------------------- |
| `LOW`      | Không gửi riêng — chỉ hiển thị trên dashboard     | —              | —                                                                   |
| `MEDIUM`   | Tối đa 1 lần/ngày/sinh viên                       | Email + in-app | Có — gộp các cảnh báo mới trong ngày thành 1 email digest cuối ngày |
| `HIGH`     | Gửi ngay, tối đa 1 lần/6 giờ cho cùng nguyên nhân | Email + in-app | Không, nhưng có debounce 6 giờ                                      |
| `CRITICAL` | Gửi ngay lập tức, không giới hạn tần suất         | Email + in-app | Không                                                               |

- MUST: `dedupKey = studentId + ruleCode + severity`. Trước khi tạo `Notification` mới, MUST tra `Notification` gần nhất cùng `dedupKey` trong cửa sổ debounce (theo bảng trên) — nếu còn trong cửa sổ, MUST NOT gửi, chỉ set `status = SUPPRESSED_DUPLICATE`.
- MUST: dùng Redis cache tra `dedupKey` trước khi query Postgres (xem `05-performance.md`), TTL = đúng cửa sổ debounce của severity tương ứng.
- MUST: khi 1 `Alert` đã `ACKNOWLEDGED`/`IN_PROGRESS`, các `RuleTrigger` mới trùng lặp hoàn toàn (cùng rule, cùng nguyên nhân) MUST NOT tạo `Notification` mới — chỉ khi có luật khác kích hoạt hoặc severity tăng mới gửi lại.

## Bảo vệ dữ liệu khi lưu trữ và truyền tải

- MUST: TLS cho mọi kết nối: trình duyệt–app, app–PostgreSQL, app–SMTP, worker–Redis (nếu Redis không nằm trong mạng Docker nội bộ tin cậy).
- MUST NOT: commit biến môi trường bí mật (`DATABASE_URL`, `SMTP_PASSWORD`, `AUTH_SECRET`) vào Git — dùng `.env.local` (gitignore) cho dev, secret manager cho production.

## Bảo mật tầng ứng dụng web

- MUST: tận dụng bảo vệ CSRF mặc định của Server Actions (same-origin check) — MUST NOT tắt.
- MUST NOT: dùng `dangerouslySetInnerHTML` cho bất kỳ dữ liệu nào có nguồn gốc từ người dùng nhập (`Intervention.content`, `RuleTrigger.reason` nếu cho nhập tự do).
- MUST: dùng Prisma query builder cho mọi truy vấn. Nếu buộc dùng `$queryRaw`, MUST dùng tagged template (parameterized) — MUST NOT nối chuỗi SQL thủ công.
- MUST: kiểm tra MIME type + đuôi file + giới hạn kích thước trước khi xử lý file upload — MUST NOT tin tưởng đuôi file người dùng đặt.
- MUST: mọi Zod schema tạo/sửa tài khoản có `role = STUDENT` bắt buộc `email` khớp domain `@student.ctuet.edu.vn` (xem `09-data-schema-identity.md`) — từ chối và trả lỗi rõ ràng nếu sai domain, kể cả khi tạo qua đồng bộ SIS (FR-DATA/FR-IMP) lẫn qua form Admin.

## Dependency & Container

- MUST: chạy `npm audit`/`pnpm audit` trong CI, chặn merge nếu có lỗ hổng mức `high`/`critical` chưa xử lý.
- MUST: build Docker image multi-stage, MUST NOT chạy container với user `root`, image production không chứa devDependencies.
