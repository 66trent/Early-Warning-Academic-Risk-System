# CTUET-EWARS — Tổng kết Bối cảnh Dự án & Phiên làm việc 1 (Phase 0)

> **Mục đích tài liệu:** Lưu trữ toàn bộ ngữ cảnh, kiến trúc, mô hình dữ liệu và các bước đã triển khai trong Phiên làm việc 1 (Phase 0). Khi mở một phiên chat mới, agent chỉ cần đọc file này là có thể nắm trọn vẹn hiện trạng dự án để tiếp tục triển khai các phase tiếp theo.

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

## 7. Kế hoạch Tiếp theo (Phase 1)

Khi bắt đầu phiên làm việc tiếp theo, thực hiện **Phase 1 — Danh mục nền tảng & Xác thực** theo `implement.md`:
- Sử dụng skill `generate-prisma-schema`: Tạo `schema.prisma` đầy đủ cho 7 bảng danh mục ban đầu theo [09-data-schema-identity.md](file:///e:/CTUT-EWARS/.agents/rules/09-data-schema-identity.md) (`User`, `Student`, `Term`, `Course`, `CourseSection`, `Enrollment`, `CourseSessionSchedule`).
- Cấu hình Better Auth, wiring session vào App Router.
- Viết `src/lib/authz.ts` cài đặt hàm `assertScope()`.
- Viết Server Actions mẫu đầu tiên tuân thủ skill `scaffold-server-action`.
- Tạo seed data mẫu (dữ liệu giả định, không dùng dữ liệu sinh viên thật theo quy định pháp lý).
