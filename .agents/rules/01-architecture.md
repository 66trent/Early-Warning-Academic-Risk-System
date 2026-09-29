# 01 — Kiến trúc Web

Xem `00-project-context.md` cho định nghĩa entity/enum. File này quy định cách tổ chức code.

## Nguyên tắc phân lớp

- MUST: dùng Next.js App Router làm nền tảng duy nhất. Không dựng Express/Fastify riêng.
- MUST: mọi truy cập dữ liệu đi qua Server Component, Server Action, hoặc Route Handler. Client Component KHÔNG BAO GIỜ gọi Prisma trực tiếp.
- MUST: dùng Route Handler (`app/api/**/route.ts`) chỉ cho: webhook từ LMS/SIS, endpoint gọi bởi BullMQ worker, export file (GET). Mọi thao tác khác dùng Server Action.
- MUST: tổ chức code theo 5 module nghiệp vụ độc lập, không import chéo trực tiếp giữa các module (giao tiếp qua service interface):
  `data-import` (nhập/đồng bộ dữ liệu) · `rule-engine` (tính luật/RiskScore) · `alerts` (cảnh báo, can thiệp, thông báo) · `dashboard` (báo cáo) · `admin` (tài khoản, cấu hình).

## Cấu trúc thư mục bắt buộc

```
src/
  app/                 # Chỉ chứa page.tsx, layout.tsx, route.ts — không chứa business logic
  modules/
    <module>/
      actions/         # Server Actions: lấy session, gọi assertScope(), gọi service, ghi audit log
      services/        # Logic nghiệp vụ thuần — KHÔNG import next/headers, KHÔNG gọi session
      validators/      # Zod schema
  lib/
    prisma.ts          # Prisma Client singleton
    auth.ts            # Better Auth config
    audit.ts           # writeAuditLog() dùng chung — xem 06-security.md
    queue/              # BullMQ queue definitions
  workers/              # Entry point riêng cho BullMQ worker — build image Docker riêng
```

- MUST: tách `services/` khỏi `actions/`. `services/` là pure function, test được không cần session/DB thật (dùng fixture).
- MUST NOT: đặt business logic trong `app/`.

## Prisma

- MUST: tên model/field trong `schema.prisma` khớp 100% với bảng entity glossary ở `00-project-context.md` — tiếng Anh, camelCase cho field.
- MUST: mọi thay đổi enum hoặc cột đi kèm migration có tên mô tả rõ (`prisma migrate dev --name <mô-tả>`). MUST NOT sửa tay file migration đã áp dụng.
- MUST NOT: dùng `prisma db push` khi đã có dữ liệu thật.
- MUST: validate bằng Zod trước khi ghi vào các cột kiểu `Json` (`RuleVersion.condition`, `RuleTrigger.inputSnapshot`, `RiskScoreLog.componentsUsed`) — kiểu `Json` của Prisma không tự kiểm tra cấu trúc bên trong.

## BullMQ Worker

- MUST: worker chạy container Docker riêng, không chung process với Next.js server.
- MUST: có tối thiểu 4 queue: `sync-lms`, `calculate-risk-score`, `evaluate-hard-triggers`, `send-notifications`.
- MUST: mọi job idempotent — dùng khoá nghiệp vụ (VD: `ImportBatch.sourceChecksum`) làm BullMQ `jobId` để chặn job trùng tự động.
- MUST: job lỗi có retry giới hạn (`attempts: 3`, backoff exponential), không để lỗi biến mất âm thầm.

## Rule Engine — module lõi

- MUST: code trong `modules/rule-engine/` không import bất kỳ thứ gì từ `next/*` — phải chạy được độc lập trong worker.
- MUST: mọi hàm evaluator là pure function (input data → output kết quả, không tự gọi Prisma bên trong hàm tính toán).

## Ranh giới bắt buộc

- MUST NOT: bất kỳ module nào ngoài `modules/data-import` (tiến trình đồng bộ SIS) được phép `update` cột `Student.officialAcademicStatus`.
- MUST: mọi thay đổi code chạm `Alert`/`RuleTrigger`/`RiskScoreLog` phải giữ nguyên `Alert.isReferenceOnly = true`.

## Docker

- MUST: `docker-compose.yml` gồm tối thiểu: `app`, `worker`, `postgres`, `redis`, `minio` (lưu file gốc `ImportBatch`), `mailhog` (chỉ profile `dev`).
- MUST: validate biến môi trường bằng Zod khi khởi động (`src/lib/env.ts`) — app phải crash ngay nếu thiếu biến, không được fail âm thầm lúc runtime.

## Backup & Restore

- MUST: full backup PostgreSQL hàng ngày (off-peak); SHOULD bật WAL/point-in-time recovery nếu hạ tầng hỗ trợ.
- MUST: RPO (Recovery Point Objective) ≤ 24 giờ; RTO (Recovery Time Objective) ≤ 4 giờ — đây là ngưỡng tối thiểu cho môi trường đồ án, môi trường triển khai thật SHOULD siết chặt hơn (RPO ≤ 1 giờ).
- MUST: nơi lưu backup tách biệt vật lý/logic khỏi server chính (khác volume/khác server).
- MUST: file gốc nhập liệu (`ImportBatch.originalFilePath` trong MinIO) lưu tối thiểu 1 học kỳ — phục vụ nhập lại (FR-IMP-07) và audit.
- MUST: backup cũng phải mã hóa/kiểm soát truy cập như dữ liệu production (xem `04-legal-compliance.md`) — MUST NOT coi backup là "miễn trừ" khỏi yêu cầu bảo vệ dữ liệu cá nhân.
- SHOULD: diễn tập khôi phục thử tối thiểu 1 lần trước khi nộp/triển khai — backup chưa từng test restore không được coi là backup hợp lệ.
