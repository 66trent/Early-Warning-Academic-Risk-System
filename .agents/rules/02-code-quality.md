# 02 — Chất lượng Code

Xem `00-project-context.md` cho glossary. File này quy định tiêu chuẩn code và kiểm thử.

## TypeScript

- MUST: `strict: true` trong `tsconfig.json`, không tắt bất kỳ cờ strict nào.
- MUST NOT: dùng `any`. Dùng `unknown` + type guard, hoặc định nghĩa type rõ ràng. Nếu buộc phải dùng `any` (thư viện ngoài không có type), bắt buộc có comment `// TODO: any vì <lý do>`.
- MUST: mọi input từ bên ngoài hệ thống (file upload, webhook, form) qua Zod `.parse()`/`.safeParse()` trước khi dùng.

## Quy ước đặt tên

- MUST: tên bảng/field/biến/hàm dùng tiếng Anh, khớp glossary trong `00-project-context.md`. MUST NOT tự đặt tên khác (VD: không viết `hocSinhId` khi entity glossary ghi `studentId`).
- MUST: tên file `kebab-case.ts`; tên component React `PascalCase.tsx`; tên hàm/biến `camelCase`.
- MUST: mã luật (`RuleCode`) giữ nguyên định dạng gốc dạng `HR-ATT-01` khi dùng làm hằng số trong code, không viết tắt hay đổi định dạng.

## Cấu trúc hàm

- MUST: một hàm chỉ làm một việc. Hàm trong `services/` không vượt quá ~50 dòng logic thực.
- MUST: hàm trong `modules/rule-engine/evaluator/` là pure function — test được bằng fixture data, không cần DB thật.
- MUST NOT: dùng `console.log` trong code production — dùng logger có cấu hình level (`debug/info/warn/error`).

## Quy ước Comment — bắt buộc

- MUST: mọi hàm export từ `services/` có JSDoc (mô tả ngắn + `@param` + `@returns`) trừ khi tên hàm và kiểu tham số đã tự giải thích đủ.
- MUST: mọi hàm trong `modules/rule-engine/evaluator/` bắt đầu bằng comment nêu rõ mã luật liên quan, ví dụ:
  ```ts
  /**
   * HR-ATT-01 — Vắng liên tiếp.
   * Điều kiện, ngưỡng mặc định và danh sách loại trừ: xem 08-business-rules-catalog.md.
   */
  function evaluateConsecutiveAbsence(...) { ... }
  ```
- MUST: comment giải thích "vì sao" (why) cho logic không hiển nhiên (VD: vì sao dùng cửa sổ trượt 7 ngày thay vì tuần lịch) — MUST NOT viết comment chỉ lặp lại "what" mà code đã tự nói rõ.
- MUST: comment mô tả nghiệp vụ viết bằng tiếng Việt, giữ nguyên tên field/entity tiếng Anh không dịch (khớp `00-project-context.md`). Comment thuần kỹ thuật (JSDoc tag, TODO) viết tiếng Anh.
- MUST NOT: để lại code đã comment-out (dead code) trong Pull Request đã merge — xóa hẳn, dùng Git history để khôi phục nếu cần.
- MUST: mọi `// TODO` có tên người/ngày hoặc lý do cụ thể, không để TODO mơ hồ không ai theo dõi.

## Kiểm thử

- MUST: mỗi rule nghiệp vụ (HR-ATT-_, HR-ACA-_, HR-LMS-_, HR-COMB-_) có ít nhất 1 test case Vitest đặt tên theo mã luật, ví dụ:
  ```ts
  describe('HR-ATT-01: vắng liên tiếp', () => {
    it('kích hoạt khi vắng không phép 3 buổi hợp lệ liên tiếp cùng lớp', () => { ... })
    it('không kích hoạt nếu có buổi bị hủy xen giữa', () => { ... })
  })
  ```
- MUST: coverage tối thiểu — `modules/rule-engine/**` ≥ 90%; `modules/data-import/**` ≥ 80%; các module khác ≥ 60%.
- MUST: có test riêng cho chính sách dữ liệu thiếu — 3 tình huống thiếu 0/1/2/3 trong 3 nhóm chỉ số phải cho đúng 3 kết quả `FULL`/`PARTIAL`/`INSUFFICIENT`.
- MUST: có test riêng chống temporal leakage — RiskScore tính tại thời điểm t không được thay đổi khi thêm dữ liệu phát sinh sau t vào fixture.
- SHOULD: dùng Playwright cho luồng end-to-end quan trọng: nhập file có lỗi → xem dòng lỗi → sửa và nhập lại; CVHT xác nhận cảnh báo và ghi can thiệp.

## Checklist bắt buộc trước khi merge Pull Request

- [ ] Không có `any` mới không giải thích.
- [ ] Mọi Server Action đọc/ghi dữ liệu sinh viên gọi `assertScope()` trước khi truy vấn (xem `06-security.md`).
- [ ] Mọi thao tác cấu hình luật / xóa batch / đổi trạng thái `Alert` gọi `writeAuditLog()`.
- [ ] Không có đường nào (trực tiếp hoặc gián tiếp) ghi vào `Student.officialAcademicStatus` ngoài module đồng bộ SIS.
- [ ] Test mới cho mọi nhánh logic mới trong `rule-engine`/`data-import`.
- [ ] Không hard-code ngưỡng luật (số buổi, %, ngày...) trong code — luôn đọc từ `RuleVersion.condition`.

## Công cụ tự động

- MUST: ESLint (`next/core-web-vitals` + `@typescript-eslint/recommended-requiring-type-checking`) chạy trong CI, fail build nếu có lỗi.
- MUST: Prettier + Husky pre-commit (`lint-staged`) — không tranh luận style trong code review.
- MUST: Vitest + Playwright chạy trong CI; PR không được merge nếu test fail.
- MUST: chạy `prisma validate` + `prisma migrate diff` trong CI để phát hiện schema drift trước khi merge.

## Git

- SHOULD: commit message tham chiếu mã luật/module khi liên quan, ví dụ: `feat(data-import): implement duplicate check via checksum`.
- MUST NOT: commit trực tiếp lên `main` — mọi thay đổi qua Pull Request có review.
