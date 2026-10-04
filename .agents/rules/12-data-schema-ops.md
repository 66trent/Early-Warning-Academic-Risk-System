# 12 — Data Schema Reference: Import & Operational Exceptions

Xem `00-project-context.md` trước. File này đặc tả 4 bảng — phạm vi module `data-import` (vận hành) và các ngoại lệ vận hành dùng trong `08-business-rules-catalog.md`.

## ImportBatch

| Field            | Kiểu                     | Null?    | Khóa             | Ghi chú                                                                              |
| ---------------- | ------------------------ | -------- | ---------------- | ------------------------------------------------------------------------------------ |
| id               | String (uuid)            | NOT NULL | PK               |                                                                                      |
| dataType         | ImportDataType (enum)    | NOT NULL |                  | `ENROLLMENT`/`ATTENDANCE`/`ASSESSMENT`/`LMS_ASSIGNMENT`/`LMS_SUBMISSION`/`LMS_EVENT` |
| source           | DataSource (enum)        | NOT NULL |                  | `FILE`/`API`                                                                         |
| sourceChecksum   | String(64)               | NOT NULL |                  | Dùng chống nhập trùng — MUST dùng làm BullMQ `jobId` (xem `01-architecture.md`)      |
| performedBy      | String(20)               | NOT NULL | FK → User        |                                                                                      |
| status           | ImportBatchStatus (enum) | NOT NULL |                  | `UPLOADING`→`VALIDATING`→`STAGED`→`LOADED`→`RECONCILED` / `REJECTED` / `DISCARDED`   |
| totalRows        | Int                      | NOT NULL |                  |                                                                                      |
| successRows      | Int                      | NOT NULL |                  |                                                                                      |
| errorRows        | Int                      | NOT NULL |                  |                                                                                      |
| parentBatchId    | String (uuid)            | NULL     | FK → ImportBatch | Liên kết batch sửa lỗi với batch gốc                                                 |
| originalFilePath | String(255)              | NOT NULL |                  | Lưu trong MinIO — xem `01-architecture.md`                                           |
| createdAt        | DateTime                 | NOT NULL |                  |                                                                                      |
| completedAt      | DateTime                 | NULL     |                  |                                                                                      |

RÀNG BUỘC: chỉ hủy được (`DISCARDED`) khi `status = STAGED` (chưa `LOADED`, chưa được rule-engine dùng để tính bất kỳ `RiskScoreLog` nào).

## ImportErrorRow

| Field           | Kiểu                     | Null?                     | Khóa             | Ghi chú                                                                     |
| --------------- | ------------------------ | ------------------------- | ---------------- | --------------------------------------------------------------------------- |
| id              | String (uuid)            | NOT NULL                  | PK               |                                                                             |
| importBatchId   | String (uuid)            | NOT NULL                  | FK → ImportBatch |                                                                             |
| sourceRowNumber | Int                      | NOT NULL                  |                  | Số dòng trong file gốc, để cán bộ đối chiếu khi sửa                         |
| rawData         | Json                     | NOT NULL                  |                  | Dữ liệu nguyên trạng dòng lỗi                                               |
| errorReason     | ImportErrorReason (enum) | NOT NULL                  |                  | `INVALID_FORMAT`/`NOT_IN_CATALOG`/`DUPLICATE`/`OUT_OF_RANGE`/`NOT_ENROLLED` |
| resolved        | Boolean                  | NOT NULL, default `false` |                  |                                                                             |

`NOT_ENROLLED`: dòng dữ liệu có `(studentId, courseSectionId)` không khớp với `Enrollment.status = REGISTERED` nào — MUST chặn ở bước validate, không nạp vào bảng chính thức (xem ràng buộc `Enrollment` ở `09-data-schema-identity.md`).

## AcademicCalendarException — tối giản có chủ đích

| Field         | Kiểu                         | Null?    | Khóa | Ghi chú                                |
| ------------- | ---------------------------- | -------- | ---- | -------------------------------------- |
| id            | String (uuid)                | NOT NULL | PK   |                                        |
| exceptionDate | DateTime (date)              | NOT NULL |      |                                        |
| type          | CalendarExceptionType (enum) | NOT NULL |      | `HOLIDAY`/`MAKEUP_SESSION`/`EXAM_WEEK` |
| description   | String (text)                | NULL     |      |                                        |

GIỚI HẠN ĐÃ BIẾT (MUST NOT tự ý mở rộng ngoài phạm vi này): bảng này chỉ để ghi nhận, KHÔNG tự động chặn tạo `CourseSessionSchedule` trùng ngày nghỉ — cán bộ tự đối chiếu thủ công. Đây là quyết định thiết kế có chủ ý để giới hạn phạm vi, không phải thiếu sót.

## LMSMaintenanceWindow — tối giản có chủ đích

| Field       | Kiểu          | Null?    | Khóa | Ghi chú |
| ----------- | ------------- | -------- | ---- | ------- |
| id          | String (uuid) | NOT NULL | PK   |         |
| startAt     | DateTime      | NOT NULL |      |         |
| endAt       | DateTime      | NOT NULL |      |         |
| description | String (text) | NULL     |      |         |

GIỚI HẠN ĐÃ BIẾT: chỉ lưu để CVHT tham chiếu thủ công khi xem xét `DISMISSED` một `Alert` từ HR-LMS-01 bị nghi ngờ là báo sai do lỗi hệ thống LMS. KHÔNG tự động loại trừ trong Rule Engine (khác với các ngoại lệ khác ở `08-business-rules-catalog.md`, vốn được kiểm tra tự động ở Bước 3).

## Quan hệ tóm tắt

`ImportBatch 1—n ImportErrorRow` · `ImportBatch 1—n` (Enrollment, AttendanceRecord, AssessmentResult, LMSAssignment, LMSSubmission, LMSActivityEvent — xem các file schema khác) · `ImportBatch 0..1—n ImportBatch` (qua `parentBatchId`).

## Danh sách đầy đủ 11 chức năng module data-import (FR-IMP) — checklist bắt buộc triển khai

1. Nhập file điểm danh theo mẫu chuẩn.
2. Nhập kết quả học tập theo học kỳ.
3. Đồng bộ hoạt động LMS theo API/incremental (chỉ lấy dữ liệu mới kể từ lần đồng bộ thành công gần nhất).
4. Xem lịch sử các lần nhập và đồng bộ (danh sách `ImportBatch`).
5. Xem số bản ghi thành công/thất bại của từng batch (`totalRows`/`successRows`/`errorRows`).
6. Tải danh sách các dòng lỗi kèm lý do (export `ImportErrorRow` theo `importBatchId`).
7. Nhập lại các dòng đã sửa, liên kết với batch gốc (`parentBatchId`).
8. Chống nhập trùng bằng khóa nghiệp vụ và checksum (`sourceChecksum`).
9. Hủy batch `STAGED` chưa được dùng để tính RiskScore.
10. Đối chiếu MSSV, học phần, học kỳ VÀ `Enrollment` hợp lệ trước khi nạp chính thức.
11. Dữ liệu lỗi hoặc chưa đối soát MUST NOT được đưa vào Rule Engine (chỉ dữ liệu `status = LOADED`/`RECONCILED` mới được đọc bởi `modules/rule-engine`).
