# 05 — Tối ưu Hiệu suất

Xem `00-project-context.md` cho glossary.

## Truy vấn cơ sở dữ liệu

- MUST: mọi query danh sách (dashboard, lịch sử nhập liệu, danh sách cảnh báo) phân trang (cursor-based) — MUST NOT `findMany()` không giới hạn.
- MUST: có index trên `Alert(studentId, termId, status)`, `RuleTrigger(termId, ruleCode)`, `ImportErrorRow(importBatchId, resolved)` ngoài các unique index theo khóa nghiệp vụ đã có trong `00-project-context.md`.
- MUST: dùng `select`/`include` tường minh trong Prisma — MUST NOT load nguyên object khi chỉ cần vài field, đặc biệt tránh load `RuleTrigger.inputSnapshot` (jsonb lớn) khi chỉ cần đếm số lượng.
- MUST: job tính RiskScore cho toàn khoa chạy theo batch/chunk qua `Enrollment` (khuyến nghị 200 sinh viên/lần) — MUST NOT load toàn bộ dữ liệu 1 khoa vào memory cùng lúc.

## Job nền (BullMQ)

- MUST: job `calculate-risk-score`/`evaluate-hard-triggers` chạy theo lịch off-peak (ví dụ 2h sáng) — MUST NOT chạy đồng bộ trong request-response người dùng.
- MUST: giới hạn concurrency worker phù hợp connection pool PostgreSQL (ví dụ `concurrency: 5`).
- SHOULD: log thời gian thực thi mỗi job để phát hiện suy giảm hiệu năng theo thời gian.

## Kết nối cơ sở dữ liệu

- MUST: Prisma Client dùng singleton pattern (`globalThis` cache) trong `lib/prisma.ts` để tránh rò rỉ connection khi hot-reload dev.
- MUST: giới hạn `connection_limit` trong `DATABASE_URL`, tách pool riêng cho `app` (ưu tiên phản hồi nhanh) và `worker` (tránh tranh chấp khi job chạy nặng).

## Frontend

- MUST: dùng React Server Components mặc định — chỉ đánh dấu `"use client"` khi thực sự cần tương tác (form, biểu đồ Tremor, dropdown filter).
- MUST: biểu đồ Tremor render dữ liệu đã tổng hợp sẵn ở server — MUST NOT gửi raw data lớn xuống client để tính toán ở trình duyệt.
- MUST: lazy-load nội dung `RuleTrigger.inputSnapshot` chi tiết — chỉ fetch khi người dùng mở Accordion, không tải sẵn toàn bộ evidence của mọi `Alert` trong danh sách.
- SHOULD: cache danh mục ít thay đổi (`Course`, `Rule` — không phải `RuleVersion`) bằng `unstable_cache`/`revalidateTag`.

## Xử lý file nhập liệu

- MUST: đọc file CSV/Excel theo stream (papaparse `step` callback / exceljs streaming reader) — MUST NOT load toàn bộ file vào memory trước khi xử lý.
- MUST: validate + đối chiếu danh mục chạy theo batch trong transaction Prisma vừa đủ nhỏ (khuyến nghị 500 dòng/transaction) — MUST NOT mở 1 transaction cho toàn bộ file.

## Redis

- MUST: dùng Redis cho BullMQ queue và cache `Notification.dedupKey` (tra nhanh trước khi query Postgres).
- MUST: đặt TTL cho cache dedup khớp đúng cửa sổ debounce theo từng Severity (xem `06-security.md`) — không để cache tồn tại vĩnh viễn.

## Đo lường

- MUST: chạy `EXPLAIN ANALYZE` trên query dashboard/RiskScore trước khi coi là đã tối ưu — không tối ưu dựa trên phỏng đoán. Dùng dữ liệu seed đủ lớn để đo thực tế (khuyến nghị: 5.000 sinh viên × 1 học kỳ).
