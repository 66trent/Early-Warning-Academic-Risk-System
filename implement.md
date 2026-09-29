# IMPLEMENT.MD — Kế hoạch triển khai EWS-SAR

> Cách dùng: đây KHÔNG phải rule nạp sẵn. Khi bắt đầu một giai đoạn, tham chiếu tường minh: `@implement.md thực hiện Phase <N>`. Mỗi Phase có Definition of Done (DoD) riêng — MUST đạt đủ DoD trước khi coi Phase đã xong, không nhảy sang Phase sau khi Phase trước còn mục chưa tick.
>
> Nguồn tham chiếu xuyên suốt: `.agents/rules/00-project-context.md` (glossary), `.agents/rules/01-architecture.md` (cấu trúc thư mục, 5 module), `.agents/rules/08-business-rules-catalog.md` (luật nghiệp vụ), `.agents/rules/09–12-data-schema-*.md` (data dictionary), `.agents/skills/*` (quy trình thao tác lặp lại).

## Nguyên tắc làm việc mỗi vòng lặp nhỏ (áp dụng cho MỌI task, mọi Phase)

1. Xác định task thuộc module nào (`data-import`/`rule-engine`/`alerts`/`dashboard`/`admin`) → đọc đúng file rule liên quan trước khi code, không code từ trí nhớ/phỏng đoán.
2. Nếu task khớp mô tả 1 skill trong `.agents/skills/`, MUST dùng skill đó thay vì tự nghĩ quy trình riêng (đảm bảo nhất quán giữa các phần code do các lần chat khác nhau tạo ra).
3. Code xong → chạy skill `pre-merge-review` trước khi báo cáo hoàn thành.
4. Nếu trong lúc code phát sinh quyết định thiết kế mới không có trong rules (VD: chốt ngưỡng cụ thể cho 1 luật, đổi cấu trúc 1 bảng) → MUST cập nhật lại file rule tương ứng NGAY, không để code và tài liệu lệch nhau.
5. MUST NOT bắt đầu Phase N+1 khi Phase N chưa đạt đủ Definition of Done.

## Ma trận phụ thuộc giữa các Phase

| Phase               | Phụ thuộc (phải xong trước)          | Có thể làm song song với |
| ------------------- | ------------------------------------ | ------------------------ |
| 0 — Bootstrap       | —                                    | —                        |
| 1 — Danh mục & Auth | 0                                    | —                        |
| 2 — data-import     | 1                                    | Phase 3                  |
| 3 — rule-engine     | 1                                    | Phase 2                  |
| 4 — alerts          | 2, 3                                 | Phase 6                  |
| 5 — dashboard       | 4                                    | Phase 6                  |
| 6 — admin           | 1 (CRUD tài khoản không cần đợi 2/3) | Phase 2, 3, 4, 5         |
| 7 — Hardening       | 4, 5, 6                              | —                        |
| 8 — Demo-ready      | 7                                    | —                        |

Ghi chú: `admin` (Phase 6) chỉ thực sự cần Phase 3 xong ở phần "duyệt RuleVersion" — phần CRUD tài khoản/kết nối nguồn dữ liệu có thể bắt đầu sớm song song với Phase 2–5.

---

## Phase 0 — Bootstrap hạ tầng

**Mục tiêu:** dự án chạy được (`docker compose up`), CI xanh, chưa có tính năng nghiệp vụ nào.

**Việc cần làm:**

- Khởi tạo Next.js 16 (App Router) + TypeScript `strict: true`.
- Cấu trúc thư mục đúng `01-architecture.md` (`src/app`, `src/modules/{data-import,rule-engine,alerts,dashboard,admin}`, `src/lib`, `src/workers`).
- `docker-compose.yml`: `app`, `worker`, `postgres`, `redis`, `minio`, `mailhog` (profile `dev`).
- Cài Prisma, Better Auth, BullMQ, Tailwind 4 + shadcn/ui init, Tremor, Nodemailer, Zod, react-hook-form, `@tanstack/react-table`.
- Thiết lập ESLint + Prettier + Husky + lint-staged.
- Thiết lập CI (lint, typecheck, test, `prisma validate`) chạy trên mọi PR.
- `src/lib/env.ts` validate biến môi trường bằng Zod, crash sớm nếu thiếu.

**Definition of Done:**

- [x] `docker compose up` chạy được toàn bộ service không lỗi.
- [x] CI pipeline xanh trên nhánh trống (chưa có tính năng).
- [x] `npx prisma validate` chạy được (dù schema còn rỗng/tối thiểu).

---

## Phase 1 — Danh mục nền tảng & Xác thực

**Mục tiêu:** có đủ dữ liệu danh mục (Student/Term/Course/CourseSection/Enrollment) và cơ chế đăng nhập + phân quyền hoạt động đúng.

**Việc cần làm:**

- Dùng skill `generate-prisma-schema`: sinh `schema.prisma` đầy đủ từ `09-data-schema-identity.md` (7 bảng: User, Student, Term, Course, CourseSection, Enrollment, CourseSessionSchedule).
- Cấu hình Better Auth, wiring session vào App Router.
- Viết `lib/authz.ts` — hàm `assertScope()` theo đúng ma trận phạm vi ở `00-project-context.md`.
- Viết `lib/audit.ts` — hàm `writeAuditLog()` dùng chung.
- Từ Phase này trở đi, MỌI Server Action (không riêng Phase 1) dùng skill `scaffold-server-action` làm khuôn mẫu — đây là skill dùng xuyên suốt toàn bộ dự án, không riêng 1 Phase nào, nhắc lại ở đây vì là lần đầu Server Action xuất hiện.
- Seed dữ liệu mẫu (giả lập, KHÔNG dùng dữ liệu sinh viên thật — xem `04-legal-compliance.md`): vài chục `Student`, `CourseSection`, `Enrollment` để dùng xuyên suốt các Phase sau.
- Ràng buộc `User.userId = Student.studentId` cho tài khoản sinh viên; validate domain `@student.ctuet.edu.vn`.

**Definition of Done:**

- [ ] Đăng nhập được với cả 4 role, mỗi role thấy đúng phạm vi dữ liệu theo `assertScope()`.
- [ ] Test tự động xác nhận CVHT A không truy vấn được dữ liệu của sinh viên thuộc CVHT B.
- [ ] `writeAuditLog()` có test, ghi đúng bản ghi khi gọi thử.

---

## Phase 2 — Module `data-import`

**Mục tiêu:** cài đặt đủ 11 chức năng FR-IMP (checklist trong `12-data-schema-ops.md`).

**Việc cần làm:**

- Dùng skill `generate-prisma-schema` cho 7 bảng ở `10-data-schema-source-records.md` + 4 bảng ở `12-data-schema-ops.md`.
- Với mỗi loại dữ liệu nguồn (điểm danh, kết quả học tập, LMS assignment/submission/event), dùng skill `implement-data-import-source`.
- UI: trang upload file, trang lịch sử `ImportBatch`, trang xem/tải dòng lỗi, nút hủy batch `STAGED` — theo đúng component/màu sắc quy định ở `03-ui-design.md` (bảng có cột "Lý do lỗi", nút Tải xuống ở đầu bảng).
- Lưu file gốc vào MinIO.
- Job đồng bộ LMS qua BullMQ queue `sync-lms`.

**Definition of Done:**

- [ ] Cả 11 mục checklist FR-IMP đều có tính năng tương ứng, có test.
- [ ] Test xác nhận: nhập trùng checksum bị từ chối; dữ liệu `STAGED`/`REJECTED` không lọt vào truy vấn của `rule-engine`.
- [ ] Playwright test luồng "file lỗi → tải lỗi → sửa → nhập lại" chạy qua.

---

## Phase 3 — Module `rule-engine` (lõi nghiên cứu — ưu tiên chất lượng cao nhất)

**Mục tiêu:** cài đặt đúng toàn bộ catalog luật + trình tự xử lý 10 bước + tính RiskScore.

**Việc cần làm:**

- Dùng skill `generate-prisma-schema` cho 7 bảng ở `11-data-schema-rule-engine.md`.
- Với từng mã luật trong `08-business-rules-catalog.md` (13 luật + nhóm ngoại lệ), dùng skill `add-hard-trigger-rule`.
- Viết orchestrator implement đúng trình tự 10 bước — đây là hàm quan trọng nhất dự án, viết dưới dạng pipeline rõ ràng từng bước, dễ trace log.
- Viết công thức RiskScore + Missing-data Policy (renormalize theo `DataStatus`).
- Job BullMQ `calculate-risk-score` và `evaluate-hard-triggers` chạy off-peak, batch theo `Enrollment`.
- UI Admin: cấu hình `RuleVersion` (tạo/sửa nháp/kích hoạt/chạy thử) theo vòng đời đã định.
- Dùng skill `rule-engine-test-suite` cho toàn bộ luật — bắt buộc coverage ≥90%.

**Definition of Done:**

- [ ] Toàn bộ 13 luật + nhóm ngoại lệ có evaluator, có test đủ ma trận (happy path/biên/loại trừ/DataStatus).
- [ ] Test tích hợp xác nhận đúng thứ tự 10 bước (đặc biệt: ngoại lệ chặn được kích hoạt).
- [ ] Test chống temporal leakage pass.
- [ ] Chạy thử (`FR-RULE-07` — dry-run) hoạt động, không ghi DB khi chạy thử.
- [ ] `RuleVersion` không thể `ACTIVE` nếu `approvedBy` là NULL.

---

## Phase 4 — Module `alerts`

**Mục tiêu:** Alert được tạo đúng, CVHT xử lý được, thông báo gửi đúng chính sách.

**Việc cần làm:**

- Dùng skill `alert-lifecycle-transition` cho từng Server Action chuyển trạng thái (`acknowledgeAlert`, `resolveAlert`, `dismissAlert`, `reopenAlert`).
- Dùng skill `notification-dispatch` cho toàn bộ điểm gửi thông báo, cấu hình queue `send-notifications`.
- UI CVHT: danh sách cần xử lý (mặc định `OPEN`/`ACKNOWLEDGED`), chi tiết Alert (Accordion nguyên nhân), form ghi `Intervention` trong Sheet/Dialog (tối đa 2 click) — bảng màu Severity và badge `DataCompletenessLevel` theo đúng `03-ui-design.md`.
- UI Sinh viên: trang cá nhân theo đúng ngôn ngữ tích cực đã quy định (`07-ux-design.md`), không hiển thị `RiskScoreValue` thô.

**Definition of Done:**

- [ ] Sơ đồ trạng thái Alert được thực thi đúng, có test transition hợp lệ/không hợp lệ.
- [ ] Test dedup: gửi 2 lần trong cửa sổ debounce → lần 2 bị `SUPPRESSED_DUPLICATE`.
- [ ] Giao diện CVHT đạt luồng "Xác nhận → Ghi can thiệp" ≤2 click.
- [ ] Giao diện Sinh viên qua review UX checklist (không dùng từ "rủi ro" làm tiêu đề, có nút liên hệ CVHT).

---

## Phase 5 — Module `dashboard`

**Mục tiêu:** báo cáo tổng hợp cho cán bộ QLĐT, dùng Tremor.

**Việc cần làm:**

- Dashboard danh sách sinh viên theo severity (sắp xếp `CRITICAL` trên cùng), xu hướng RiskScore theo thời gian.
- Dashboard chất lượng dữ liệu (tỷ lệ lỗi import, số SV `INSUFFICIENT`, độ trễ đồng bộ).
- Xuất báo cáo theo lớp/khoa/học kỳ.

**Definition of Done:**

- [ ] Dữ liệu biểu đồ tổng hợp sẵn ở server, không gửi raw data xuống client.
- [ ] Dashboard chất lượng dữ liệu đặt ở vị trí dễ thấy, không chôn trong menu.

---

## Phase 6 — Module `admin`

**Mục tiêu:** quản trị tài khoản, tích hợp nguồn dữ liệu, xem audit log.

**Việc cần làm:**

- CRUD tài khoản + gán `scopeConfig`.
- Cấu hình kết nối API LMS/SIS.
- Trang xem Audit Log (chỉ đọc, có lọc theo actor/hành động/thời gian).
- Duyệt `RuleVersion` (set `approvedBy`) — tách quyền `configure` vs `approve` nếu mô hình tổ chức của trường yêu cầu.

**Definition of Done:**

- [ ] Không endpoint nào tự nâng quyền của chính người gọi (test STRIDE Elevation of Privilege).
- [ ] Audit Log không có Server Action nào cho phép sửa/xóa.

---

## Phase 7 — Hardening (bảo mật, hiệu suất, pháp lý, vận hành)

**Việc cần làm:**

- Chạy đủ checklist STRIDE (`06-security.md`) cho từng luồng dữ liệu chính.
- Seed dữ liệu giả lập quy mô lớn (~5.000 sinh viên/1 kỳ), chạy `EXPLAIN ANALYZE` cho query Dashboard/RiskScore, tối ưu theo kết quả đo thật — đúng quy trình đo lường ở `05-performance.md` (không tối ưu dựa trên phỏng đoán).
- Trang chính sách bảo vệ dữ liệu cá nhân (`04-legal-compliance.md`) — đủ 7 mục.
- Diễn tập backup/restore ít nhất 1 lần, đo RPO/RTO thực tế.
- Rà accessibility (contrast, ARIA, tap target ≥44px).
- `npm audit`/`pnpm audit` sạch lỗi `high`/`critical`.

**Definition of Done:**

- [ ] Toàn bộ mục STRIDE có bằng chứng (test hoặc ghi chú kiểm tra thủ công).
- [ ] Có báo cáo đo hiệu suất thật kèm số liệu trước/sau tối ưu.
- [ ] Restore thử thành công từ backup.

---

## Phase 8 — Chuẩn bị demo/bảo vệ đồ án

**Việc cần làm:**

- Dữ liệu demo hoàn toàn giả lập, kịch bản đủ để minh họa từng luật `HR-*` (mỗi luật có ít nhất 1 sinh viên demo kích hoạt được).
- README hướng dẫn chạy dự án từ đầu (`docker compose up`, seed, tài khoản demo từng role).
- Chuẩn bị kịch bản trình diễn theo đúng 4 chức năng đã giới hạn phạm vi (phát hiện → cảnh báo → gửi → xác nhận) — nhấn mạnh hệ thống KHÔNG tự đổi trạng thái học vụ khi demo, tránh bị hội đồng hiểu nhầm phạm vi.

**Definition of Done:**

- [ ] Người ngoài chạy được `README` từ máy sạch, không cần hỏi thêm.
- [ ] Kịch bản demo chạy trơn tru đủ minh họa toàn bộ 13 luật.
