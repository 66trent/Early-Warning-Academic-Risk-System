---
name: implement-data-import-source
description: Dùng khi thêm một pipeline nhập/đồng bộ dữ liệu mới (file CSV/Excel hoặc API) cho module data-import, hoặc sửa pipeline đã có. Kích hoạt khi người dùng nói "thêm nguồn nhập dữ liệu", "tích hợp API mới", "nhập file loại...", "đồng bộ dữ liệu từ...".
---

# Thêm một pipeline nhập/đồng bộ dữ liệu

Tham chiếu bắt buộc: `.agents/rules/12-data-schema-ops.md` (checklist 11 chức năng FR-IMP + bảng `ImportBatch`/`ImportErrorRow`), `.agents/rules/09-data-schema-identity.md` (bảng `Enrollment`).

## Quy trình

1. **Xác định `ImportDataType`**: dùng giá trị có sẵn (`ENROLLMENT`/`ATTENDANCE`/`ASSESSMENT`/`LMS_ASSIGNMENT`/`LMS_SUBMISSION`/`LMS_EVENT`) hoặc — nếu thực sự là loại dữ liệu mới — mở rộng enum này và cập nhật đồng thời `00-project-context.md` + `12-data-schema-ops.md`.
2. **Viết Zod schema** cho 1 dòng dữ liệu nguồn (khớp field của bảng đích, xem `09`/`10-data-schema-*.md`).
3. **Pipeline 5 giai đoạn, đúng thứ tự, MUST NOT bỏ giai đoạn nào:**
   - _Extract_: đọc file theo stream (papaparse/exceljs) hoặc nhận payload API, gắn `ImportBatch` mới với `status = UPLOADING` rồi `VALIDATING`.
   - _Validate_: Zod parse từng dòng + đối chiếu tồn tại `Enrollment.status = REGISTERED` khớp `(studentId, courseSectionId)` — dòng không khớp → `ImportErrorRow.errorReason = NOT_ENROLLED`.
   - _Stage_: `status = STAGED` — dữ liệu nằm ở bảng tạm, CHƯA vào bảng chính thức, CHƯA được Rule Engine đọc.
   - _Load_: nạp theo batch nhỏ (khuyến nghị 500 dòng/transaction Prisma) vào bảng chính thức, `status = LOADED`.
   - _Reconcile_: đối soát số dòng nguồn vs. nạp thành công, `status = RECONCILED`.
4. **Idempotency bắt buộc**: tính `sourceChecksum` (hash nội dung file/payload); nếu batch cùng checksum đã tồn tại → từ chối, báo "đã nhập trước đó", MUST NOT nạp trùng. Nếu chạy qua BullMQ, dùng `sourceChecksum` làm `jobId`.
5. **Nhập lại sau sửa lỗi**: batch mới tạo từ dòng đã sửa MUST gắn `parentBatchId` trỏ về batch gốc, không tạo batch độc lập không truy vết được.
6. **Ràng buộc cứng — không thương lượng**: dữ liệu chỉ được `modules/rule-engine` đọc khi `ImportBatch.status IN (LOADED, RECONCILED)`. MUST viết test xác nhận dữ liệu ở `STAGED`/`REJECTED` không lọt vào bất kỳ tính toán `RiskScore`/`RuleTrigger` nào.
7. Nếu nguồn qua UI upload: viết Playwright test luồng "nhập file có lỗi → xem dòng lỗi → tải dòng lỗi → sửa → nhập lại".

## Checklist trước khi coi là hoàn thành

- [ ] Đọc file theo stream, không load nguyên file vào memory.
- [ ] Có transaction batch nhỏ, không 1 transaction cho toàn bộ file.
- [ ] Có đối chiếu `Enrollment` (không chỉ đối chiếu MSSV/mã học phần tồn tại trong danh mục).
- [ ] Có cơ chế hủy batch khi còn `STAGED`.
- [ ] File gốc được lưu vào MinIO (`ImportBatch.originalFilePath`), không xóa sau khi xử lý xong.
