# CTUET-EWARS — Tổng kết Bối cảnh Dự án & Hiện trạng Triển khai (Phase 0, 1, 2)

> **Mục đích tài liệu:** Lưu trữ toàn bộ ngữ cảnh, kiến trúc, mô hình dữ liệu và các bước đã triển khai trong các phiên làm việc (Phase 0: Bootstrap Infra, Phase 1: Identity & Catalog, Phase 2: Module Data Import). Khi mở một phiên chat mới, agent chỉ cần đọc file này là có thể nắm trọn vẹn hiện trạng dự án để tiếp tục triển khai các phase tiếp theo (Phase 3: Rule Engine).

---

## 1. Tổng quan Dự án & Ranh giới Nghiệp vụ

- **Tên hệ thống:** CTUET-EWARS (*Early Warning Academic Risk System*).
- **Mục tiêu:** Phát hiện sớm các dấu hiệu rủi ro học tập của sinh viên dựa trên luật nghiệp vụ cấu hình được, tổng hợp từ 3 nguồn:
  1. 📋 **Điểm danh:** `AttendanceRecord` (vắng liên tiếp, chạm ngưỡng cấm thi, không đi học đầu kỳ).
  2. 📊 **Kết quả học tập:** `AssessmentResult` (điểm liệt, rớt môn, tụt GPA đột ngột, học lại nhiều lần).
  3. 💻 **LMS:** `LMSSubmission`, `LMSActivityEvent` (không tương tác kéo dài, bỏ nộp bài bắt buộc liên tiếp, 2 bài 0 điểm liên tiếp).
- **Ranh giới bất biến (CẤM VI PHẠM):**
  - Hệ thống **CHỈ** được: phát hiện dấu hiệu → tạo cảnh báo sớm → gửi thông báo tới CVHT/QLĐT → hỗ trợ ghi nhận hành động can thiệp (`Intervention`).
  - **CẤM TUYỆT ĐỐI:** Không bao giờ tự động cập nhật hoặc sửa đổi `Student.officialAcademicStatus`. Trường này chỉ cập nhật 1 chiều từ SIS bên ngoài.
  - Mọi cảnh báo có thuộc tính bất biến: `Alert.isReferenceOnly = true`.

---

## 2. Tech Stack

- **Framework:** Next.js 16 (App Router, fullstack, Turbopack, React 19).
- **Database:** PostgreSQL 16 + Prisma ORM 7 (sử dụng `@prisma/adapter-pg` driver adapter).
- **Authentication:** Better Auth.
- **Background Jobs:** BullMQ + Redis 7 (chạy trong worker container riêng biệt).
- **Rule Engine:** Tự thiết kế (không dùng thư viện ngoài), thực thi pure function.
- **UI:** Tailwind CSS 4, shadcn/ui primitives, Tremor (dành riêng cho dashboard thống kê).
- **Storage & Mail:** MinIO (lưu file import gốc S3-compatible), Nodemailer + MailHog (môi trường dev).
- **Testing & Quality:** Vitest, ESLint, Prettier, Husky, lint-staged, TypeScript `strict: true`.
- **Container hóa:** Docker multi-stage build (`app`, `worker`) và `docker-compose.yml`.
- **GitHub Repository:** `https://github.com/66trent/Early-Warning-Academic-Risk-System.git` (nhánh `main`).

---

## 3. Kiến trúc 5 Module & Cấu trúc Thư mục

Tuân thủ nghiêm ngặt [01-architecture.md](file:///e:/CTUT-EWARS/.agents/rules/01-architecture.md):
```
src/
  app/                 # Chỉ chứa page.tsx, layout.tsx, route.ts (không chứa business logic)
  modules/
    data-import/       # Module 1: Nhập/đồng bộ dữ liệu (SIS, Attendance, LMS)
      actions/         # Server Actions: session, assertScope(), gọi service, writeAuditLog()
      services/        # Pure business logic — KHÔNG gọi session/headers
      validators/      # Zod validation schema
    rule-engine/       # Module 2: Đánh giá luật, tính RiskScore (chạy được trong Worker)
      actions/
      services/
      validators/
    alerts/            # Module 3: Vòng đời Alert, can thiệp (Intervention), thông báo
      actions/
      services/
      validators/
    dashboard/         # Module 4: Báo cáo tổng hợp, KPI, chất lượng dữ liệu (Tremor)
      actions/
      services/
      validators/
    admin/             # Module 5: Quản trị tài khoản, scopeConfig, duyệt RuleVersion, xem Audit Log
      actions/
      services/
      validators/
  lib/
    prisma.ts          # PrismaClient singleton với PrismaPg adapter
    auth.ts            # Better Auth config
    audit.ts           # writeAuditLog() append-only dùng chung
    env.ts             # Zod validation toàn bộ biến môi trường (crash sớm nếu thiếu)
    queue/             # BullMQ queue definitions (4 queue: sync-lms, calculate-risk-score, evaluate-hard-triggers, send-notifications)
  workers/
    index.ts           # Entry point riêng cho BullMQ Worker
```

---

## 4. Mô hình Dữ liệu & Quy tắc Bất biến

### 4.1. Bảng trung gian bắt buộc: `Enrollment`
Mọi bảng dữ liệu nguồn (điểm danh, điểm số, bài tập LMS, log LMS) **bắt buộc trỏ qua `Enrollment.enrollmentId`**, không được trỏ trực tiếp vào cặp `Student` + `CourseSection`. Quy tắc này đảm bảo phân biệt các lần học lại (`attemptNumber`, `enrollmentType`) và cô lập dữ liệu nếu SV rút học phần.

### 4.2. Hệ thống 2 Tầng Enum Trạng thái Dữ liệu (Không được gộp)
- **Tầng 1 — `DataStatus`** (từng chỉ số riêng trước tính toán): `AVAILABLE` / `MISSING` / `NOT_APPLICABLE` / `STALE` / `INVALID`.
- **Tầng 2 — `DataCompletenessLevel`** (mức tin cậy tổng thể của `RiskScoreLog`):
  - `FULL`: Cả 3 nhóm (điểm danh, học lực, LMS) đều `AVAILABLE`.
  - `PARTIAL`: Có ≥1 nhóm thiếu, hệ thống tự động **renormalize** trọng số trên các nhóm còn `AVAILABLE`.
  - `INSUFFICIENT`: Không đủ dữ liệu để tính toán có ý nghĩa (`RiskScoreLog.riskScoreValue = NULL`, tuyệt đối không coi là rủi ro thấp).

### 4.3. Vai trò Người dùng (Roles & Scope)
| Role | Quyền hạn dữ liệu |
|---|---|
| `STUDENT` | Chỉ xem dữ liệu bản thân (`Student.id === session.user.studentId`). |
| `ADVISOR` (CVHT) | Chỉ SV mình đang phụ trách (`Student.advisorId === session.user.id`). |
| `TRAINING_OFFICER` (QLĐT) | Xem theo phạm vi `User.scopeConfig` (khoa/toàn trường); duyệt cấu hình luật (`RuleVersion.approvedBy`). |
| `ADMIN` | Vận hành hệ thống; không có quyền tự ý sửa điểm/trạng thái học vụ. |

---

## 5. Catalog Luật Nghiệp vụ & Pipeline 10 Bước

### Trình tự 10 bước bắt buộc của Rule Engine:
1. Kiểm tra tính hợp lệ dữ liệu (loại bỏ `INVALID`).
2. Kiểm tra phạm vi đối tượng (`Enrollment.enrollmentStatus = REGISTERED`).
3. **Áp dụng ngoại lệ (HR-EXC):** Chạy trước khi tính toán bất kỳ chỉ số hay luật nào.
4. Tính chỉ số thành phần theo `DataStatus`.
5. Tính `RiskScore` (công thức trọng số renormalize, chống temporal leakage).
6. Chạy 13 luật cứng (hard-trigger).
7. Gộp nguyên nhân theo khóa tương quan `(studentId, ruleCode, scopeId, termId)` và cửa sổ cooldown.
8. Xác định severity cuối cùng của Alert = `max(severity)`.
9. Tạo hoặc cập nhật `Alert` (`Alert.isReferenceOnly = true`).
10. Gửi thông báo (áp dụng dedup/debounce policy theo severity).

### Danh mục 13 Luật:
- **Điểm danh:** HR-ATT-01 (Vắng liên tiếp ≥3 buổi), HR-ATT-02 (Ngưỡng cấm thi), HR-ATT-03 (Vắng đa môn trong 7 ngày), HR-ATT-04 (Không tham gia đầu kỳ).
- **Học lực:** HR-ACA-01 (Điểm 0/liệt ở bài quan trọng), HR-ACA-02 (Cảnh báo học vụ tiệm cận ngưỡng), HR-ACA-03 (Sụt giảm GPA đột ngột), HR-ACA-04 (Học lại ≥3 lần do rớt).
- **LMS:** HR-LMS-01 (Không hoạt động LMS kéo dài), HR-LMS-02 (Bỏ nộp bài bắt buộc liên tiếp), HR-LMS-03 (2 điểm liệt liên tiếp bài tự chấm).
- **Tổ hợp:** HR-COMB-01 (Tín hiệu xấu đồng thời ở ≥2/3 nguồn), HR-COMB-02 (Biến mất hoàn toàn ≥10 ngày - kích hoạt liên hệ khẩn cấp).

---

## 6. Những Việc Đã Hoàn Thành Trong Phiên 1 (Phase 0 — Bootstrap)

1. **Khởi tạo Codebase:**
   - Dự án Next.js 16 + React 19 + TypeScript `strict: true`.
   - Cấu trúc đầy đủ 5 modules, `lib/`, `workers/`.
2. **Cài đặt & Tích hợp Thư viện:**
   - Prisma 7 ORM kết hợp `@prisma/adapter-pg` và `pg` Pool.
   - Better Auth khởi tạo sẵn sàng.
   - BullMQ với 4 queue chính và Worker entry point tại `src/workers/index.ts`.
   - Zod validation tại `src/lib/env.ts` (kiểm tra đầy đủ `DATABASE_URL`, `REDIS_URL`, `MINIO_*`, `SMTP_*`, `BETTER_AUTH_*`).
   - Tailwind CSS 4, UI primitives, `@tanstack/react-table`, `react-hook-form`.
3. **Container hóa Docker:**
   - `Dockerfile` multi-stage (runner app + worker runner).
   - `docker-compose.yml` gồm 6 services: `postgres` (16-alpine), `redis` (7-alpine), `minio` (`cgr.dev/chainguard/minio:latest`), `mailhog` (profile `dev`), `app`, `worker`.
   - Đã khởi động thực tế và kiểm tra: tất cả container đều `Up` và `healthy`, HTTP 200 tại `http://localhost:3000`.
4. **Bộ công cụ Kiểm tra & CI:**
   - Prettier, ESLint, Husky pre-commit hook (tối ưu chạy trên `src/`).
   - Vitest test runner với unit test mẫu `src/lib/audit.test.ts`.
   - GitHub Actions CI workflow tại `.github/workflows/ci.yml`.
5. **Khắc phục lỗi thực tế trong phiên:**
   - Sửa lỗi CI `LayoutProps` trên Next.js 16 thành `Readonly<{ children: React.ReactNode }>`.
   - Thêm bước `npm run prisma:generate` và `postinstall` vào quy trình CI.
   - Giải quyết tình trạng file rule `00-project-context.md` bị vượt giới hạn ký tự (giảm từ 13,884 ký tự xuống 5,941 ký tự nhưng bảo toàn 100% nội dung nghiệp vụ).
6. **Đồng bộ Git:**
   - Toàn bộ commit đã được push thành công lên `main` của `https://github.com/66trent/Early-Warning-Academic-Risk-System.git`.

---

## 7. Những Việc Đã Hoàn Thành Trong Phase 1 (Danh mục nền tảng & Xác thực)

1. **Schema & Migration Prisma (7 bảng danh mục):**
   - Đã sinh đầy đủ 7 model theo [09-data-schema-identity.md](file:///e:/CTUT-EWARS/.agents/rules/09-data-schema-identity.md): `User`, `Student`, `Term`, `Course`, `CourseSection`, `Enrollment`, `CourseSessionSchedule` cùng các bảng xác thực Better Auth (`Session`, `Account`, `Verification`).
   - Đã chạy migration `init_identity_and_auth` thành công vào PostgreSQL.
2. **Better Auth & Quản lý Phiên:**
   - Cấu hình Prisma adapter cho Better Auth trong [src/lib/auth.ts](file:///e:/CTUT-EWARS/src/lib/auth.ts).
   - Tạo helper `getSession()` trong [src/lib/session.ts](file:///e:/CTUT-EWARS/src/lib/session.ts) và route handler tại `src/app/api/auth/[...all]/route.ts`.
3. **Phân quyền theo phạm vi (`assertScope`):**
   - Viết [src/lib/authz.ts](file:///e:/CTUT-EWARS/src/lib/authz.ts) thực thi nghiêm ngặt ma trận 4 Roles (`STUDENT`, `ADVISOR`, `TRAINING_OFFICER`, `ADMIN`).
   - Bộ test tự động [src/lib/authz.test.ts](file:///e:/CTUT-EWARS/src/lib/authz.test.ts) kiểm tra 100% các tình huống (chặn sinh viên xem SV khác, chặn CVHT A xem SV CVHT B, kiểm tra phạm vi khoa của QLĐT).
4. **Server Action chuẩn theo skill `scaffold-server-action`:**
   - Cài đặt mẫu 5 bước tại `src/modules/admin/actions/student.action.ts` và test tự động [student.action.test.ts](file:///e:/CTUT-EWARS/src/modules/admin/actions/student.action.test.ts) xác nhận tự động ghi `writeAuditLog` khi có truy cập ngoài phạm vi thông thường.
5. **Seed dữ liệu giả lập chuẩn:**
   - [prisma/seed.ts](file:///e:/CTUT-EWARS/prisma/seed.ts) nạp thành công 24 Users (1 Admin, 1 QLĐT, 2 CVHT, 20 SV), 20 Students, 1 Term, 3 Courses, 3 CourseSections, 40 Enrollments, 10 buổi học.
   - Ràng buộc `User.userId = Student.studentId` và email sinh viên `@student.ctuet.edu.vn`.
6. **Đạt 100% Definition of Done Phase 1:**
   - Đăng nhập & phân quyền cả 4 role pass test.
   - CVHT A không truy vấn được sinh viên của CVHT B pass test.
   - `writeAuditLog()` pass test.

---

## 8. Những Việc Đã Hoàn Thành Trong Phase 2 (Module `data-import`)

1. **Schema Prisma & Migration (11 bảng mới):**
   - **7 bảng dữ liệu nguồn (`10-data-schema-source-records.md`):** `AttendanceRecord`, `AssessmentResult`, `LMSAssignment`, `LMSSubmission`, `LMSDeadlineExtension`, `LMSAssignmentExemption`, `LMSActivityEvent`. Tất cả dữ liệu nguồn đều trỏ qua khóa ngoại `Enrollment.enrollmentId`.
   - **4 bảng vận hành & ngoại lệ lịch trình (`12-data-schema-ops.md`):** `ImportBatch`, `ImportErrorRow`, `AcademicCalendarException`, `LMSMaintenanceWindow`.
   - Migration `20260929200000_add_data_import_tables` đã được sinh và deploy trực tiếp vào PostgreSQL.

2. **Validators & Schemas (Zod):**
   - Viết [src/modules/data-import/validators/import.schema.ts](file:///e:/CTUT-EWARS/src/modules/data-import/validators/import.schema.ts).
   - Kiểm tra định dạng từng dòng cho 5 loại dữ liệu: `attendanceRowSchema`, `assessmentRowSchema`, `lmsAssignmentRowSchema`, `lmsSubmissionRowSchema`, `lmsEventRowSchema`.
   - Schema thao tác lô: `uploadFileSchema`, `discardBatchSchema`, `listBatchesSchema`, `listErrorRowsSchema`.

3. **Core Service với Pipeline 5 giai đoạn:**
   - Cài đặt tại [src/modules/data-import/services/import.service.ts](file:///e:/CTUT-EWARS/src/modules/data-import/services/import.service.ts):
     - Pipeline chuẩn: `UPLOADING` → `VALIDATING` → `STAGED` → `LOADED` → `RECONCILED` (hoặc `REJECTED`).
     - Chia chunk nạp dữ liệu (500 dòng/lô) bảo vệ bộ nhớ và hiệu năng cơ sở dữ liệu.
     - Chống nhập trùng bằng hàm `computeChecksum` (SHA-256) dựa trên nội dung file thô (`sourceChecksum`).
     - Đối chiếu bắt buộc: Kiểm tra MSSV, học phần VÀ trạng thái `Enrollment.enrollmentStatus = REGISTERED` cùng lịch học `CourseSessionSchedule` trước khi nạp chính thức.
     - Phân loại lỗi chi tiết vào `ImportErrorRow`: `INVALID_FORMAT`, `NOT_IN_CATALOG`, `DUPLICATE`, `OUT_OF_RANGE`, `NOT_ENROLLED`.
     - Hỗ trợ xuất danh sách dòng lỗi dạng CSV qua `exportErrorRowsAsCSV()`.
     - Hỗ trợ nhập lại các dòng đã sửa, liên kết chặt chẽ với lô gốc qua `parentBatchId`.
     - Ràng buộc bất biến: `discardBatch()` chỉ cho phép hủy lô ở trạng thái `STAGED`, nghiêm cấm hủy khi lô đã đạt `LOADED`/`RECONCILED` để bảo vệ Rule Engine.

4. **Lưu trữ MinIO S3-compatible:**
   - Cài đặt tại [src/modules/data-import/services/storage.service.ts](file:///e:/CTUT-EWARS/src/modules/data-import/services/storage.service.ts) lưu trữ nguyên trạng các file dữ liệu được tải lên vào bucket `ctuet-ewars-imports`.

5. **Server Actions & Phân quyền RBAC:**
   - Cài đặt tại [src/modules/data-import/actions/import.action.ts](file:///e:/CTUT-EWARS/src/modules/data-import/actions/import.action.ts) theo đúng pattern 5 bước (`scaffold-server-action`):
     - `uploadImportFile`: Tải file lên, lưu MinIO, chạy pipeline 5 bước và ghi Audit Log (`IMPORT_FILE`).
     - `listBatches`: Xem lịch sử và lọc các lô theo trạng thái/loại dữ liệu.
     - `getErrorRows`: Lấy chi tiết các dòng lỗi kèm lý do chuẩn hóa.
     - `discardImportBatch`: Hủy lô `STAGED` và ghi Audit Log (`DISCARD_BATCH`).
     - Phân quyền qua `assertScope` trong [src/lib/authz.ts](file:///e:/CTUT-EWARS/src/lib/authz.ts): Chỉ `TRAINING_OFFICER` và `ADMIN` có quyền thao tác với `ImportBatch` (chặn `STUDENT` và `ADVISOR`).

6. **Giao diện người dùng (UI):**
   - Danh sách lô nhập & bộ lọc: [src/app/data-import/page.tsx](file:///e:/CTUT-EWARS/src/app/data-import/page.tsx) & [src/app/data-import/components/import-batch-table.tsx](file:///e:/CTUT-EWARS/src/app/data-import/components/import-batch-table.tsx).
   - Dialog tải lên file & nhập lại: [src/app/data-import/components/upload-import-dialog.tsx](file:///e:/CTUT-EWARS/src/app/data-import/components/upload-import-dialog.tsx).
   - Chi tiết dòng lỗi: [src/app/data-import/[batchId]/errors/page.tsx](file:///e:/CTUT-EWARS/src/app/data-import/[batchId]/errors/page.tsx) & [src/app/data-import/[batchId]/errors/components/error-rows-table.tsx](file:///e:/CTUT-EWARS/src/app/data-import/[batchId]/errors/components/error-rows-table.tsx) với cột "Lý do lỗi" badge màu đỏ và nút "Tải CSV dòng lỗi" ở đầu bảng theo đúng `03-ui-design.md`.
   - Route Handler tải file CSV: [src/app/api/data-import/[batchId]/errors/export/route.ts](file:///e:/CTUT-EWARS/src/app/api/data-import/[batchId]/errors/export/route.ts).

7. **Background Worker BullMQ:**
   - Worker đồng bộ LMS tại [src/workers/sync-lms.worker.ts](file:///e:/CTUT-EWARS/src/workers/sync-lms.worker.ts) tích hợp vào [src/workers/index.ts](file:///e:/CTUT-EWARS/src/workers/index.ts) sử dụng chung kết nối `redisConnection`.

8. **Đảm bảo chất lượng & Kiểm thử (52/52 tests pass, 6 test files):**
   - [src/modules/data-import/__tests__/import.test.ts](file:///e:/CTUT-EWARS/src/modules/data-import/__tests__/import.test.ts): 18 unit tests cho parser, checksum và các Zod validator.
   - [src/modules/data-import/__tests__/import-lifecycle.test.ts](file:///e:/CTUT-EWARS/src/modules/data-import/__tests__/import-lifecycle.test.ts): 11 tests kiểm tra đầy đủ các ràng buộc nghiệp vụ:
     - Chống nhập trùng checksum (FR-IMP-08).
     - Ràng buộc hủy batch `STAGED`, từ chối hủy batch `LOADED` (FR-IMP-09).
     - Đối soát `Enrollment` và gắn cờ `NOT_ENROLLED` (FR-IMP-10).
     - Cô lập dữ liệu: Dữ liệu lỗi/chưa đối soát không bị ghi vào bảng chính thức (FR-IMP-11).
     - Xuất CSV lỗi kèm số dòng file gốc và lý do (FR-IMP-06).
     - Luồng roundtrip hoàn chỉnh: *File lỗi → Tải danh sách lỗi → Sửa dữ liệu → Nhập lại liên kết với `parentBatchId`* (FR-IMP-07).
   - [src/modules/data-import/__tests__/import.action.test.ts](file:///e:/CTUT-EWARS/src/modules/data-import/__tests__/import.action.test.ts): 7 tests kiểm tra phân quyền RBAC và ghi nhận Audit Log.

9. **Git & An toàn bảo mật:**
   - Đã đưa `.agents/` và `implement.md` vào `.gitignore` và untrack khỏi git index (`git rm --cached`).
   - Kiểm tra toàn diện `tsc --noEmit` (0 lỗi), `eslint` (0 lỗi), `vitest` (52/52 passed).

10. **Các Lỗi Runtime & Kiến Thức Cốt Lõi Đã Giải Quyết Trong Quá Trình Test UI:**
    - **Lỗi 1: `A "use server" file can only export async functions, found object`:**
      - *Nguyên nhân:* File Zod schema [src/modules/data-import/validators/import.schema.ts](file:///e:/CTUT-EWARS/src/modules/data-import/validators/import.schema.ts) gắn nhầm chỉ thị `"use server";`. Trong Next.js App Router, `"use server"` định danh Server Actions module và bắt buộc 100% export phải là async function.
      - *Giải pháp:* Gỡ bỏ `"use server";` khỏi các file schema/validator/type. Chỉ thị này chỉ được đặt tại các Server Action modules (`*.action.ts`).
    - **Lỗi 2: Mismatch Session giữa Better Auth & Prisma Schema (`{"success":false,"error":"Yêu cầu đăng nhập."}`):**
      - *Nguyên nhân:* Model `User` trong Prisma schema sử dụng `userId String @id` và `id String @unique UUID`. Better Auth mặc định ánh xạ khóa chính của `User` qua trường `id` (UUID), trong khi `Session.userId` liên kết tới `User.userId` (`QLDT001`). Khi `auth.api.getSession()` truy vấn người dùng từ `session.userId`, adapter tìm theo `user.id = "QLDT001"` và trả về `null`.
      - *Giải pháp:* Nâng cấp hàm `getSession()` tại [src/lib/session.ts](file:///e:/CTUT-EWARS/src/lib/session.ts) với cơ chế fallback đọc cookie `better-auth.session_token`, đối soát trực tiếp với bảng `Session` và `User` trong PostgreSQL để trích xuất đầy đủ quyền hạn (`id`, `userId`, `role`, `fullName`, `email`, `scopeConfig`).
    - **Hạ tầng hỗ trợ Test UI:**
      - Xây dựng cổng đăng nhập dev tại [src/app/login/page.tsx](file:///e:/CTUT-EWARS/src/app/login/page.tsx) và endpoint [src/app/api/auth/dev-login/route.ts](file:///e:/CTUT-EWARS/src/app/api/auth/dev-login/route.ts) cho phép đăng nhập 1-click vào cả 4 vai trò (`TRAINING_OFFICER`, `ADMIN`, `ADVISOR`, `STUDENT`).
      - Tích hợp banner nhận diện trạng thái phiên đăng nhập trực quan ngay tại [src/app/data-import/page.tsx](file:///e:/CTUT-EWARS/src/app/data-import/page.tsx).
      - Chuẩn bị sẵn bộ file CSV mẫu tại [public/sample-data/](file:///e:/CTUT-EWARS/public/sample-data/) (`attendance_valid.csv`, `attendance_with_errors.csv`, `assessment_valid.csv`) để test toàn bộ các kịch bản: nạp hợp lệ, nạp lỗi, xem lỗi, tải CSV lỗi, chống trùng SHA-256.

---

## 9. Kế hoạch Tiếp theo (Phase 3 — Module `rule-engine`)

Khi bắt đầu phiên làm việc tiếp theo, thực hiện **Phase 3 — Module `rule-engine`** (lõi nghiên cứu quan trọng nhất của hệ thống):

1. **Sinh Prisma Schema:**
   - Dùng skill `generate-prisma-schema` cho 7 bảng ở [11-data-schema-rule-engine.md](file:///e:/CTUT-EWARS/.agents/rules/11-data-schema-rule-engine.md):
     - `Rule`: Định danh luật nghiệp vụ (`ruleCode`, `name`, `category`).
     - `RuleVersion`: Phiên bản cụ thể (`thresholds`, `weight`, `severity`, `status`, `approvedBy`).
     - `RuleTrigger`: Bằng chứng 1 lần luật đúng với dữ liệu sinh viên.
     - `RiskScoreLog`: Nhật ký điểm rủi ro tổng hợp kèm `dataCompletenessLevel` và snapshot trọng số.
     - `Alert`: Hồ sơ cảnh báo hiển thị cho CVHT (`isReferenceOnly = true`).
     - `Intervention`: Hành động can thiệp gắn với `Alert`.
     - `Notification`: Thông báo gửi tới CVHT/QLĐT với `dedupKey`.
   - Sinh migration và cập nhật cơ sở dữ liệu.

2. **Cài đặt 13 Luật Nghiệp vụ & Nhóm Ngoại lệ (`08-business-rules-catalog.md`):**
   - **4 luật điểm danh:** HR-ATT-01 (Vắng liên tiếp), HR-ATT-02 (Ngưỡng cấm thi), HR-ATT-03 (Vắng đa môn 7 ngày), HR-ATT-04 (Không đi học đầu kỳ).
   - **4 luật học lực:** HR-ACA-01 (Điểm liệt bài quan trọng), HR-ACA-02 (Tiệm cận ngưỡng buộc thôi học), HR-ACA-03 (Sụt giảm GPA đột ngột), HR-ACA-04 (Học lại ≥3 lần do rớt).
   - **3 luật LMS:** HR-LMS-01 (Không tương tác kéo dài), HR-LMS-02 (Bỏ nộp bài bắt buộc liên tiếp), HR-LMS-03 (2 bài 0 điểm liên tiếp).
   - **2 luật tổ hợp:** HR-COMB-01 (Tín hiệu xấu đồng thời ở ≥2/3 nguồn), HR-COMB-02 (Biến mất hoàn toàn ≥10 ngày - liên hệ khẩn cấp).
   - **Nhóm ngoại lệ (HR-EXC):** Miễn/hoãn thi, bảo lưu, nghỉ ốm, gia hạn deadline LMS.

3. **Xây dựng Orchestrator 10 Bước Chuẩn:**
   - Triển khai pipeline chuẩn 10 bước theo dạng pure orchestrator, có logging chi tiết từng bước.
   - Công thức tính `RiskScore`: chuẩn hóa trọng số (renormalize) theo `DataStatus` (`AVAILABLE`), xử lý missing-data policy và chống rò rỉ thời gian (temporal leakage).
   - Gộp nguyên nhân theo khóa tương quan và tính `max(severity)`.

4. **Background Jobs BullMQ:**
   - Hoàn thiện xử lý trong `calculate-risk-score` và `evaluate-hard-triggers` theo lô `Enrollment`.

5. **Giao diện Admin Cấu hình Luật:**
   - Quản lý vòng đời `RuleVersion`: tạo nháp (`DRAFT`), thử nghiệm (`TESTING`), kích hoạt (`ACTIVE`), lưu trữ (`ARCHIVED`).
   - Tách quyền tạo nháp vs duyệt (`approvedBy`).

6. **Kiểm thử Toàn diện (Coverage ≥ 90%):**
   - Áp dụng skill `rule-engine-test-suite` phủ ma trận kiểm thử bắt buộc: điều kiện biên, ngoại lệ, thiếu dữ liệu, chống rò rỉ thời gian.
