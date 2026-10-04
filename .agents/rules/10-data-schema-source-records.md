# 10 — Data Schema Reference: Source Records (Data-Import Module)

Xem `00-project-context.md` và `09-data-schema-identity.md` trước (đặc biệt `Enrollment`). File này đặc tả 7 bảng dữ liệu nguồn — phạm vi module `data-import`, đầu vào chính của `rule-engine`.

## AttendanceRecord

| Field            | Kiểu                    | Null?    | Khóa                       | Ghi chú                                                |
| ---------------- | ----------------------- | -------- | -------------------------- | ------------------------------------------------------ |
| id               | String (uuid)           | NOT NULL | PK                         |                                                        |
| enrollmentId     | String (uuid)           | NOT NULL | FK → Enrollment            |                                                        |
| sessionId        | String (uuid)           | NOT NULL | FK → CourseSessionSchedule |                                                        |
| attendanceStatus | AttendanceStatus (enum) | NOT NULL |                            | `PRESENT`/`EXCUSED_ABSENCE`/`UNEXCUSED_ABSENCE`/`LATE` |
| source           | String(20)              | NOT NULL |                            | `FILE_IMPORT`/`API`                                    |
| importBatchId    | String (uuid)           | NOT NULL | FK → ImportBatch           |                                                        |
| updatedAt        | DateTime                | NOT NULL |                            |                                                        |

RÀNG BUỘC: UNIQUE `(enrollmentId, sessionId)`.

## AssessmentResult

| Field          | Kiểu                | Null?    | Khóa             | Ghi chú                                                                      |
| -------------- | ------------------- | -------- | ---------------- | ---------------------------------------------------------------------------- |
| id             | String (uuid)       | NOT NULL | PK               |                                                                              |
| enrollmentId   | String (uuid)       | NOT NULL | FK → Enrollment  |                                                                              |
| assessmentType | String(30)          | NOT NULL |                  |                                                                              |
| weight         | Float               | NOT NULL |                  | Dùng cho HR-ACA-01 (`minimumAssessmentWeight`)                               |
| score          | Float               | NULL     |                  | NULL = chưa chấm                                                             |
| scoreScale     | String(10)          | NOT NULL |                  | Thang điểm — dùng chuẩn hóa khi so sánh 2 kỳ (HR-ACA-03)                     |
| resultStatus   | ResultStatus (enum) | NOT NULL |                  | `DRAFT`/`FINAL`/`UNDER_APPEAL`/`EXEMPT`/`WAIVED` — dùng loại trừ ở HR-ACA-01 |
| importBatchId  | String (uuid)       | NOT NULL | FK → ImportBatch |                                                                              |
| publishedAt    | DateTime            | NULL     |                  |                                                                              |

RÀNG BUỘC: UNIQUE `(enrollmentId, assessmentType)`.

## LMSAssignment — thuộc cấp lớp, tồn tại độc lập với việc sinh viên có nộp hay không

| Field           | Kiểu                       | Null?    | Khóa               | Ghi chú                                               |
| --------------- | -------------------------- | -------- | ------------------ | ----------------------------------------------------- |
| assignmentId    | String(30)                 | NOT NULL | PK                 |                                                       |
| courseSectionId | String(20)                 | NOT NULL | FK → CourseSection |                                                       |
| assignmentType  | LMSAssignmentType (enum)   | NOT NULL |                    | `QUIZ`/`HOMEWORK`/`DISCUSSION`/`PROJECT`              |
| title           | String(150)                | NOT NULL |                    |                                                       |
| isRequired      | Boolean                    | NOT NULL |                    | Dùng cho HR-LMS-02 (chỉ tính bài bắt buộc)            |
| defaultDeadline | DateTime                   | NOT NULL |                    | Deadline gốc cả lớp                                   |
| sequenceNumber  | Int                        | NOT NULL |                    | Trả lời "2 bài liên tiếp là bài nào" cho HR-LMS-02/03 |
| status          | LMSAssignmentStatus (enum) | NOT NULL |                    | `DRAFT`/`PUBLISHED`/`CANCELLED`                       |
| importBatchId   | String (uuid)              | NOT NULL | FK → ImportBatch   |                                                       |

## LMSDeadlineExtension

| Field        | Kiểu          | Null?    | Khóa               | Ghi chú                                                   |
| ------------ | ------------- | -------- | ------------------ | --------------------------------------------------------- |
| id           | String (uuid) | NOT NULL | PK                 |                                                           |
| assignmentId | String(30)    | NOT NULL | FK → LMSAssignment |                                                           |
| studentId    | String(20)    | **NULL** | FK → Student       | **NULL = áp dụng cả lớp; có giá trị = riêng 1 sinh viên** |
| newDeadline  | DateTime      | NOT NULL |                    |                                                           |
| reason       | String (text) | NULL     |                    |                                                           |
| grantedBy    | String(20)    | NOT NULL | FK → User          |                                                           |
| grantedAt    | DateTime      | NOT NULL |                    |                                                           |

## LMSAssignmentExemption

| Field        | Kiểu          | Null?    | Khóa               | Ghi chú                 |
| ------------ | ------------- | -------- | ------------------ | ----------------------- |
| id           | String (uuid) | NOT NULL | PK                 |                         |
| assignmentId | String(30)    | NOT NULL | FK → LMSAssignment |                         |
| studentId    | String(20)    | **NULL** | FK → Student       | NULL = cả lớp được miễn |
| reason       | String (text) | NULL     |                    |                         |
| grantedBy    | String(20)    | NOT NULL | FK → User          |                         |
| grantedAt    | DateTime      | NOT NULL |                    |                         |

## LMSSubmission — CHỈ chứa sự kiện đã thật sự xảy ra (đã nộp)

| Field            | Kiểu                       | Null?    | Khóa               | Ghi chú                                                                                                               |
| ---------------- | -------------------------- | -------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| submissionId     | String (uuid)              | NOT NULL | PK                 |                                                                                                                       |
| assignmentId     | String(30)                 | NOT NULL | FK → LMSAssignment |                                                                                                                       |
| enrollmentId     | String (uuid)              | NOT NULL | FK → Enrollment    |                                                                                                                       |
| attemptNumber    | Int                        | NOT NULL |                    | Lần nộp thứ mấy                                                                                                       |
| isLatest         | Boolean                    | NOT NULL |                    | Bản được tính điểm                                                                                                    |
| submittedAt      | DateTime                   | NOT NULL |                    |                                                                                                                       |
| score            | Float                      | NULL     |                    |                                                                                                                       |
| submissionStatus | LMSSubmissionStatus (enum) | NOT NULL |                    | CHỈ `ON_TIME`/`LATE` (không có `NOT_SUBMITTED`/`EXTENDED`/`EXEMPT` — các trạng thái đó suy ra từ bảng khác, xem dưới) |
| importBatchId    | String (uuid)              | NOT NULL | FK → ImportBatch   |                                                                                                                       |

RÀNG BUỘC: UNIQUE `(assignmentId, enrollmentId, attemptNumber)`.

**MUST NOT lưu "không nộp bài" thành 1 bản ghi.** `NOT_SUBMITTED` là giá trị SUY RA tại thời điểm rule-engine chạy, bằng công thức:

```
effectiveDeadline = COALESCE(
  LMSDeadlineExtension khớp studentId cụ thể (ưu tiên),
  LMSDeadlineExtension với studentId = NULL (cả lớp),
  LMSAssignment.defaultDeadline
)
notSubmitted = effectiveDeadline < now() AND không tồn tại LMSSubmission nào cho (assignmentId, enrollmentId)
```

## LMSActivityEvent — log tương tác thuần, KHÔNG bao gồm nộp bài

| Field         | Kiểu                | Null?    | Khóa             | Ghi chú                                                       |
| ------------- | ------------------- | -------- | ---------------- | ------------------------------------------------------------- |
| eventId       | String (uuid)       | NOT NULL | PK               |                                                               |
| enrollmentId  | String (uuid)       | NOT NULL | FK → Enrollment  |                                                               |
| eventType     | LMSEventType (enum) | NOT NULL |                  | `VIEW_MATERIAL`/`DISCUSSION_POST`/`LOGIN`/`ACTIVITY_COMPLETE` |
| timestamp     | DateTime            | NOT NULL |                  |                                                               |
| resourceId    | String(30)          | NULL     |                  |                                                               |
| importBatchId | String (uuid)       | NOT NULL | FK → ImportBatch |                                                               |

Mỗi lượt xem tài liệu = 1 bản ghi riêng — đếm bằng `COUNT(*)`, KHÔNG gộp/ghi đè.

## Quan hệ tóm tắt

`Enrollment 1—n AttendanceRecord, AssessmentResult, LMSSubmission, LMSActivityEvent` · `CourseSessionSchedule 1—n AttendanceRecord` · `CourseSection 1—n LMSAssignment` · `LMSAssignment 1—n LMSSubmission, LMSDeadlineExtension, LMSAssignmentExemption` · `ImportBatch 1—n` (tất cả 7 bảng trên).
