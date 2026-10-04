# CTUET-EWARS — Tổng kết Bối cảnh Dự án & Hiện trạng Triển khai (Phase 0, 1, 2, 3, 4, 5)

> **Mục đích tài liệu:** Lưu trữ toàn bộ ngữ cảnh, kiến trúc, mô hình dữ liệu và các bước đã triển khai trong các phiên làm việc (Phase 0: Bootstrap Infra, Phase 1: Identity & Catalog, Phase 2: Module Data Import, Phase 3: Module Rule Engine, Phase 4: Alerts & Notifications, Phase 5: Dashboard & Báo cáo). Khi mở một phiên chat mới, agent chỉ cần đọc file này là có thể nắm trọn vẹn hiện trạng dự án để tiếp tục triển khai các phase tiếp theo (Phase 6: Admin).

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

## 9. Những Việc Đã Hoàn Thành Trong Phase 3 (Module `rule-engine` — Lõi Nghiên Cứu)

1. **Schema Prisma & Migration (7 bảng mới + 9 enum):**
   - Đã sinh đầy đủ 7 model theo [11-data-schema-rule-engine.md](file:///e:/CTUT-EWARS/.agents/rules/11-data-schema-rule-engine.md): `Rule`, `RuleVersion`, `RuleTrigger`, `RiskScoreLog`, `Alert`, `Intervention`, `Notification`.
   - Các enum phục vụ vận hành: `RuleGroup`, `RuleScope`, `RuleTriggerConditionOperator`, `RuleVersionStatus`, `Severity`, `AlertStatus`, `NotificationChannel`, `NotificationDeliveryStatus`, `SuppressionReason`.
   - Migration `20261001063901_add_rule_engine_tables` đã được sinh và deploy vào PostgreSQL qua Prisma 7 (`@prisma/adapter-pg`).

2. **Catalog 13 Luật Nghiệp vụ & Nhóm Ngoại lệ (`08-business-rules-catalog.md`):**
   - Thiết kế dạng pure evaluator functions, không phụ thuộc framework/DB, có logging nguyên nhân rõ ràng:
     - **Ngoại lệ HR-EXC ([exceptions.evaluator.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/evaluators/exceptions.evaluator.ts)):** Chạy trước mọi luật, phát hiện và lập danh sách skip (bảo lưu, rút học phần, lớp chưa bắt đầu, ngày nghỉ lễ/thiên tai `AcademicCalendarException`, bảo trì LMS `LMSMaintenanceWindow`, gia hạn deadline `LMSDeadlineExtension`, miễn bài tập `LMSAssignmentExemption`).
     - **4 luật điểm danh ([attendance.evaluator.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/evaluators/attendance.evaluator.ts)):**
       - `HR-ATT-01`: Vắng liên tiếp ≥3 buổi (`HIGH`).
       - `HR-ATT-02`: Chạm/vượt ngưỡng cấm thi (ví dụ: ≥20% tổng số buổi) (`CRITICAL`).
       - `HR-ATT-03`: Vắng đa môn trong sliding window 7 ngày (vắng ≥2 buổi ở ≥2 lớp khác nhau) (`MEDIUM`).
       - `HR-ATT-04`: Không tham gia học đầu kỳ (vắng toàn bộ các buổi đầu kỳ, loại trừ SV đăng ký muộn) (`HIGH`).
     - **4 luật học lực ([academic.evaluator.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/evaluators/academic.evaluator.ts)):**
       - `HR-ACA-01`: Điểm 0/liệt ở bài đánh giá có trọng số lớn (`MEDIUM`/`HIGH`).
       - `HR-ACA-02`: GPA tích lũy tiệm cận ngưỡng buộc thôi học / cảnh báo học vụ (`CRITICAL`).
       - `HR-ACA-03`: Sụt giảm GPA đột ngột giữa 2 kỳ hoặc điểm thành phần trong kỳ (`MEDIUM`).
       - `HR-ACA-04`: Học lại ≥3 lần do rớt môn (`CRITICAL`).
     - **3 luật LMS ([lms.evaluator.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/evaluators/lms.evaluator.ts)):**
       - `HR-LMS-01`: Không có hoạt động LMS kéo dài (phân cấp `MEDIUM`/`HIGH`/`CRITICAL` nếu kéo dài ≥14 ngày kèm bỏ deadline).
       - `HR-LMS-02`: Bỏ nộp bài tập bắt buộc liên tiếp (≥2 bài) (`MEDIUM`/`HIGH`).
       - `HR-LMS-03`: Hai điểm 0 liên tiếp ở bài kiểm tra tự chấm (`MEDIUM`).
     - **2 luật tổ hợp ([combined.evaluator.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/evaluators/combined.evaluator.ts)):**
       - `HR-COMB-01`: Tín hiệu tiêu cực đồng thời ở ≥2/3 nguồn dữ liệu (`CRITICAL`).
       - `HR-COMB-02`: Biến mất hoàn toàn không dấu vết ≥10 ngày — kích hoạt cờ liên hệ khẩn cấp (`CRITICAL`).
   - Bộ validator Zod v4 tại [src/modules/rule-engine/validators/rule-engine.schema.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/validators/rule-engine.schema.ts) kiểm tra định dạng và giá trị mặc định cho cấu hình `condition` của toàn bộ 13 luật.

3. **Orchestrator 10 Bước Chuẩn & Công thức RiskScore:**
   - Cài đặt tại [src/modules/rule-engine/services/orchestrator.service.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/orchestrator.service.ts):
     - Bước 1: Kiểm tra tính hợp lệ dữ liệu.
     - Bước 2: Kiểm tra phạm vi đối tượng (`Enrollment.enrollmentStatus = REGISTERED`).
     - Bước 3: Áp dụng ngoại lệ HR-EXC (chặn luật/miễn bài/gia hạn hạn chót trước khi đánh giá).
     - Bước 4: Tính chỉ số thành phần và gán nhãn `DataStatus`.
     - Bước 5: Tính `RiskScore` tổng hợp theo cơ chế renormalize trọng số (loại bỏ `MISSING`, `INVALID`, `NOT_APPLICABLE`, `STALE`), chống rò rỉ thời gian (temporal leakage), gán nhãn `DataCompletenessLevel` (`FULL`, `PARTIAL`, `INSUFFICIENT`).
     - Bước 6: Đánh giá đồng thời 13 luật hard-trigger.
     - Bước 7: Gộp nguyên nhân theo khóa tương quan `(studentId, ruleCode, scopeId, termId)` và cửa sổ cooldown.
     - Bước 8: Xác định severity cuối cùng của Alert = `max(severity)`.
     - Bước 9: Tạo/cập nhật `Alert` với ràng buộc bất biến **`Alert.isReferenceOnly = true`** (hỗ trợ dry-run an toàn không ghi CSDL).
     - Bước 10: Xếp hàng thông báo gửi tới cán bộ.
   - Core RiskScore service tại [src/modules/rule-engine/services/risk-score.service.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/risk-score.service.ts).

4. **Data Fetcher & Persistence Service:**
   - [src/modules/rule-engine/services/data-fetcher.service.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/data-fetcher.service.ts): Đọc dữ liệu từ Prisma, ánh xạ sang cấu trúc evaluator input, truy vấn thông tin ngoại lệ lịch, bảo trì LMS, trạng thái lớp và điểm danh.
   - [src/modules/rule-engine/services/persistence.service.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/persistence.service.ts): Lưu nhật ký `RiskScoreLog`, `RuleTrigger`, tạo mới hoặc cập nhật `Alert` (tăng `reopenCount`, cập nhật `lastDetectedAt`), bỏ qua lưu trữ an toàn khi `dryRun = true`.

5. **Server Actions & Phân quyền RBAC:**
   - Quản lý phiên bản luật ([src/modules/rule-engine/actions/rule-version.action.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/actions/rule-version.action.ts)):
     - `listRules`: Xem danh sách và lịch sử phiên bản luật theo nhóm.
     - `createRuleVersion`: Tạo phiên bản nháp (`DRAFT`), tự động tăng số version, kiểm định schema condition qua Zod.
     - `activateRuleVersion`: Kích hoạt phiên bản luật, **bắt buộc `approvedBy` khác null**, thực thi nghiêm ngặt nguyên tắc tách quyền (người tạo không được tự duyệt phiên bản của chính mình).
     - `archiveRuleVersion`: Chuyển phiên bản cũ sang `ARCHIVED` khi có phiên bản mới kích hoạt.
   - Đánh giá rủi ro ([src/modules/rule-engine/actions/evaluation.action.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/actions/evaluation.action.ts)):
     - `runEvaluation`: Chạy đánh giá cho danh sách sinh viên hoặc học kỳ, hỗ trợ cờ `dryRun` (thử nghiệm không ghi DB), ghi nhận Audit Log (`DRY_RUN_EVALUATION` / `RUN_EVALUATION`).
     - `queueEvaluationBatch`: Đẩy tác vụ đánh giá vào hàng đợi BullMQ khi cần xử lý số lượng lớn.
     - Phân quyền: Chỉ `TRAINING_OFFICER` và `ADMIN` được thực thi.

6. **BullMQ Worker Xử lý Nền:**
   - Cài đặt tại [src/workers/evaluate-hard-triggers.worker.ts](file:///e:/CTUT-EWARS/src/workers/evaluate-hard-triggers.worker.ts): Phân tách sinh viên theo lô 10 SV/batch, cập nhật tiến độ `job.updateProgress()`, tích hợp trực tiếp vào worker runner chính tại [src/workers/index.ts](file:///e:/CTUT-EWARS/src/workers/index.ts).

7. **Seed Dữ liệu Luật Chuẩn:**
   - Cài đặt tại [src/modules/rule-engine/services/seed-rules.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/services/seed-rules.ts): Tự động nạp 13 Rule và 13 RuleVersion v1 ở trạng thái `ACTIVE` với cấu hình ngưỡng chuẩn từ catalog.

8. **Đảm bảo Chất lượng & Kiểm thử (105/105 tests pass toàn dự án):**
   - Bộ test chuyên sâu [src/modules/rule-engine/__tests__/evaluators.test.ts](file:///e:/CTUT-EWARS/src/modules/rule-engine/__tests__/evaluators.test.ts) gồm 53 tests phủ đầy đủ ma trận:
     - 10 tests cho HR-EXC (sinh viên rút môn, lớp chưa bắt đầu, miễn LMS, ngày lễ, bảo trì LMS, gia hạn bài tập, miễn bài tập).
     - 6 tests cho HR-ATT-01 (vắng liên tiếp, hủy buổi, vắng có phép, chống temporal leakage).
     - 2 tests cho HR-ATT-02 (ngưỡng cấm thi, toán tử `>=` vs `>`).
     - 2 tests cho HR-ATT-03 (vắng đa môn đồng thời trong sliding window 7 ngày).
     - 3 tests cho HR-ATT-04 (vắng đầu kỳ, ngoại lệ đăng ký muộn, đã đi học ít nhất 1 buổi).
     - 3 tests cho HR-ACA-01 (điểm liệt bài quan trọng, bỏ qua bài DRAFT, bài trọng số nhỏ).
     - 2 tests cho HR-ACA-02 (tiệm cận ngưỡng cảnh báo học vụ, kiểm tra số tín chỉ tích lũy tối thiểu).
     - 2 tests cho HR-ACA-03 (sụt giảm GPA cuối kỳ, sụt giảm điểm thành phần trong kỳ).
     - 2 tests cho HR-ACA-04 (học lại ≥3 lần do rớt môn, không áp dụng cho cải thiện điểm).
     - 2 tests cho HR-LMS-01 (không tương tác ≥14 ngày kèm bỏ deadline, có hoạt động gần đây).
     - 2 tests cho HR-LMS-02 (bỏ nộp bài bắt buộc liên tiếp, có nộp 1 bài).
     - 1 test cho HR-LMS-03 (2 bài tự chấm 0 điểm liên tiếp).
     - 2 tests cho HR-COMB-01 (tín hiệu tiêu cực đa nguồn đồng thời ≥2/3 nguồn).
     - 4 tests cho HR-COMB-02 (biến mất hoàn toàn ≥10 ngày, có hoạt động, ngoại lệ).
     - 4 tests cho RiskScore Calculator (FULL, PARTIAL renormalize, INSUFFICIENT với điểm NULL, NOT_APPLICABLE).
     - 2 tests tích hợp Pipeline 10 bước (thứ tự bước, chế độ dry-run không persist DB).
     - 4 tests cho Zod Condition Validators (validate condition, apply default, từ chối ruleCode lạ).
   - Kiểm tra tĩnh: TypeScript `strict: true` (0 lỗi `tsc --noEmit`), ESLint (0 errors, 0 warnings).
   - Đạt 100% Definition of Done Phase 3.

---

## 10. Những Việc Đã Hoàn Thành Trong Phase 4 (Module `alerts`)

1. **Vòng đời Trạng thái Alert (Skill `alert-lifecycle-transition`):**
   - Đã cài đặt Server Actions chuyển trạng thái: `acknowledgeAlert`, `resolveAlert`, `dismissAlert`, `reopenAlert` trong [src/modules/alerts/actions/alert.action.ts](file:///e:/CTUT-EWARS/src/modules/alerts/actions/alert.action.ts).
   - Đảm bảo ràng buộc nghiệp vụ: Chỉ cho phép chuyển sang `RESOLVED` khi đã có ít nhất một hành động can thiệp (`Intervention`). Khi chuyển sang `DISMISSED`, bắt buộc phải cung cấp lý do hủy (ghi chú) với độ dài ≥ 5 ký tự.

2. **Gửi Thông báo & Chống Trùng (Skill `notification-dispatch`):**
   - Viết logic tạo `dedupKey` theo mẫu `studentId|ruleCode|severity`.
   - Áp dụng các mốc debounce chuẩn theo Severity: `CRITICAL` (bỏ qua debounce window - 0s, gửi ngay), `HIGH` (6 giờ), `MEDIUM` (24 giờ) tại [src/modules/alerts/services/notification.service.ts](file:///e:/CTUT-EWARS/src/modules/alerts/services/notification.service.ts).
   - Tích hợp ghi dữ liệu thông báo vào bảng `Notification` và đẩy vào BullMQ queue.

3. **Giao diện Cố vấn Học tập (CVHT) UI/UX Pro Max:**
   - Trang danh sách cảnh báo ([src/app/alerts/page.tsx](file:///e:/CTUT-EWARS/src/app/alerts/page.tsx)) tích hợp bộ lọc trạng thái (mặc định hiển thị `OPEN` và `ACKNOWLEDGED`), dùng TailwindCSS 4 và Radix UI.
   - Thiết kế giao diện Slide-over Modal chi tiết cho Alert ([src/app/alerts/components/alert-detail-modal.tsx](file:///e:/CTUT-EWARS/src/app/alerts/components/alert-detail-modal.tsx)), hiển thị nguyên nhân trực quan (Rule Trigger) và cho phép xử lý ghi nhận can thiệp nhanh chóng với số lần nhấp chuột tối thiểu (≤2 click).
   - Component bảng thông minh tự động refetch sau khi xử lý thành công.

4. **Giao diện Sinh viên (Student Portal):**
   - Xây dựng trang trạng thái học tập ([src/app/student/alerts/page.tsx](file:///e:/CTUT-EWARS/src/app/student/alerts/page.tsx)) tập trung vào UX tích cực. Không dùng các thuật ngữ gây hoang mang, hoàn toàn ẩn đi các trường dữ liệu kỹ thuật và điểm số RiskScore thô.
   - Thêm các badge trạng thái, thẻ thông báo trực quan, gợi ý hành động và nút liên hệ khẩn cấp với CVHT phụ trách.
   - Phân quyền chặt chẽ thông qua `assertScope` của `authz` trên tất cả Server Actions, không rò rỉ dữ liệu chéo của sinh viên khác.

5. **Đảm bảo Chất lượng & An Toàn Bảo Mật (132/132 tests pass toàn dự án):**
   - Các tests cho validation chuyển trạng thái (`isTransitionAllowed`), cũng như mock logic của hệ thống Rule Engine đã được chuẩn hóa về type.
   - Kiểm tra tĩnh: TypeScript `strict: true` (0 lỗi), ESLint (0 errors, 0 warnings). Đạt 100% Definition of Done Phase 4.
   - Xử lý các thay đổi môi trường `BETTER_AUTH_SECRET` vào `docker-compose.yml` để chuẩn hóa an toàn bảo mật.

---

## 11. Những Việc Đã Hoàn Thành Trong Phase 5 (Module `dashboard`)

1. **Kiến trúc & Validators (Zod v4):**
   - Viết [dashboard.schema.ts](file:///e:/CTUT-EWARS/src/modules/dashboard/validators/dashboard.schema.ts): Schemas cho các bộ lọc `dashboardOverviewFilterSchema`, `riskScoreTrendFilterSchema` (default 30 ngày, min 1, max 365), `dataQualityFilterSchema`, `atRiskStudentListFilterSchema` (phân trang page, pageSize ≤ 100), `exportReportFilterSchema` (yêu cầu `termId`, format `csv` hoặc `json`).

2. **Core Service & Tổng hợp Sẵn ở Server (DoD Phase 5):**
   - Cài đặt tại [dashboard.service.ts](file:///e:/CTUT-EWARS/src/modules/dashboard/services/dashboard.service.ts):
     - `getDashboardOverview`: Tổng hợp sẵn số lượng sinh viên, active alerts, phân bố theo 4 mức Severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), phân bố theo trạng thái Alert, số cảnh báo đã giải quyết trong 7 ngày, thời gian phản hồi trung bình (tính từ `firstDetectedAt` đến `Intervention` đầu tiên), và phân bố cảnh báo theo 5 nhóm luật `RuleGroup` (`ATTENDANCE`, `ACADEMIC`, `LMS`, `COMBINED`, `EXCEPTION`).
     - `getRiskScoreTrend`: Tổng hợp nhật ký `RiskScoreLog` theo từng ngày, tính điểm rủi ro trung bình hàng ngày và số lượng sinh viên theo từng mức `DataCompletenessLevel` (`FULL`, `PARTIAL`, `INSUFFICIENT`).
     - `getDataQualityMetrics`: Tính tỷ lệ lỗi import (`importErrorRate`), số sinh viên bị `INSUFFICIENT` (`insufficientStudentCount`), số giờ trôi qua kể từ lần đồng bộ cuối (`syncAgeHours`), độ trễ xử lý trung bình (`avgSyncDelayHours`), phân bố trạng thái `ImportBatch` và phân bố lý do lỗi `ImportErrorRow`.
     - `getAtRiskStudentList`: Truy vấn danh sách sinh viên nguy cơ, **bắt buộc sắp xếp CRITICAL trên cùng** theo [03-ui-design.md](file:///e:/CTUT-EWARS/.agents/rules/03-ui-design.md), phân trang an toàn, kèm nguồn gốc kích hoạt luật và số lần can thiệp.
     - `exportReport`: Xuất báo cáo theo lớp/khoa/học kỳ hỗ trợ định dạng JSON và CSV có UTF-8 BOM chuẩn hiển thị tiếng Việt trên Microsoft Excel.
     - `getFilterOptions`: Lấy danh sách học kỳ, khoa, lớp phục vụ bộ lọc.

3. **Server Actions & Phân quyền RBAC (Skill `scaffold-server-action`):**
   - Cài đặt tại [dashboard.action.ts](file:///e:/CTUT-EWARS/src/modules/dashboard/actions/dashboard.action.ts):
     - Helper `requireDashboardAccess()` thực thi RBAC: Chỉ `TRAINING_OFFICER` và `ADMIN` được truy cập, chặn hoàn toàn `STUDENT` và `ADVISOR`.
     - Kiểm tra phạm vi dữ liệu theo khoa (`assertScope`) khi có filter `departmentId`.
     - Ghi nhận Audit Log bắt buộc (`writeAuditLog`) khi xuất báo cáo (`EXPORT_REPORT`).

4. **Route Handler Xuất CSV Stream:**
   - Cài đặt tại [src/app/api/dashboard/export/route.ts](file:///e:/CTUT-EWARS/src/app/api/dashboard/export/route.ts): Kiểm tra phiên đăng nhập, vai trò `TRAINING_OFFICER`/`ADMIN`, ghi Audit Log (`EXPORT_REPORT_CSV`), trả về file attachment `.csv` với header `Content-Type: text/csv; charset=utf-8` và mã hóa BOM UTF-8.

5. **Giao diện Người dùng UI/UX Pro Max:**
   - **Main Dashboard Page ([page.tsx](file:///e:/CTUT-EWARS/src/app/dashboard/page.tsx)):** Server Component tải song song toàn bộ dữ liệu tổng hợp ở server (đáp ứng 100% DoD Phase 5). Có disclaimer tham khảo bắt buộc theo `03-ui-design.md`.
   - **Dashboard Chất lượng Dữ liệu ([data-quality-dashboard.tsx](file:///e:/CTUT-EWARS/src/app/dashboard/components/data-quality-dashboard.tsx)):** Đặt ở vị trí nổi bật nhất ngay đầu trang (DoD Phase 5), sử dụng bảng màu xanh dương/xám (tách biệt hoàn toàn với màu Severity). Hiển thị tỷ lệ lỗi, số SV `INSUFFICIENT`, thời gian đồng bộ cuối và phân bố trạng thái batch.
   - **Thẻ KPI & Phân bố ([kpi-cards.tsx](file:///e:/CTUT-EWARS/src/app/dashboard/components/kpi-cards.tsx)):** Dùng shadcn Card + Tailwind CSS với bảng màu chuẩn (Đỏ: `CRITICAL`, Cam: `HIGH`, Hổ phách: `MEDIUM`, Xám: `LOW`).
   - **Biểu đồ Trực quan Recharts ([dashboard-charts.tsx](file:///e:/CTUT-EWARS/src/app/dashboard/components/dashboard-charts.tsx)):** Thay thế Tremor do Tremor chưa hỗ trợ React 19. Bao gồm: Bar Chart phân bố nhóm luật, Donut/Pie Chart trạng thái xử lý cảnh báo, Area Chart xu hướng RiskScore, và Stacked Area Chart hoàn thiện dữ liệu `FULL`/`PARTIAL`/`INSUFFICIENT`.
   - **Bảng Sinh viên Nguy cơ ([at-risk-student-table.tsx](file:///e:/CTUT-EWARS/src/app/dashboard/components/at-risk-student-table.tsx)):** Sắp xếp `CRITICAL` trên cùng, **RiskScore luôn gắn kèm badge DataCompletenessLevel**, bộ lọc realtime (Học kỳ, Khoa, Lớp, Mức độ), phân trang và nút xuất CSV trực tiếp.

6. **Đảm bảo Chất lượng & Kiểm thử (166/166 tests pass toàn dự án):**
   - [src/modules/dashboard/__tests__/dashboard.test.ts](file:///e:/CTUT-EWARS/src/modules/dashboard/__tests__/dashboard.test.ts): 21 tests kiểm tra validators, aggregations của service, tính toán tỷ lệ lỗi, sắp xếp CRITICAL trên cùng, sinh CSV UTF-8 BOM.
   - [src/modules/dashboard/__tests__/dashboard.action.test.ts](file:///e:/CTUT-EWARS/src/modules/dashboard/__tests__/dashboard.action.test.ts): 13 tests kiểm tra RBAC 4 vai trò, kiểm tra scope khoa, audit log khi xuất báo cáo, route handler GET `/api/dashboard/export`.
   - Kiểm tra tĩnh: TypeScript `strict: true` (0 lỗi), ESLint (0 errors, 0 warnings).
   - Đạt 100% Definition of Done Phase 5.

---

## 12. Kế hoạch Tiếp theo (Phase 6 — Module `admin`)

Khi bắt đầu phiên làm việc tiếp theo, thực hiện **Phase 6 — Module `admin`**:

1. **CRUD Tài khoản Người dùng & Gán `scopeConfig`:**
   - Quản lý danh sách tài khoản theo 4 vai trò (`STUDENT`, `ADVISOR`, `TRAINING_OFFICER`, `ADMIN`).
   - Cấu hình phạm vi truy cập dữ liệu `scopeConfig` (khoa, viện, toàn trường) cho Cán bộ Đào tạo và CVHT.
2. **Cấu hình Kết nối Tích hợp LMS / SIS:**
   - Quản trị thông số kết nối API tới hệ thống SIS (Student Information System) và Moodle/Canvas LMS.
3. **Trang Xem Audit Log (Append-only):**
   - Giao diện tra cứu nhật ký kiểm toán hệ thống (chỉ đọc, lọc theo actor, hành động, thực thể, thời gian). Không có API/action nào cho phép sửa/xóa audit log.
4. **Quy trình Phê duyệt Phiên bản Luật (`RuleVersion`):**
   - Giao diện duyệt luật cho QLĐT: thiết lập `approvedBy`, thực thi nghiêm ngặt nguyên tắc Separation of Duties (người soạn thảo luật không được tự duyệt phiên bản của chính mình).

