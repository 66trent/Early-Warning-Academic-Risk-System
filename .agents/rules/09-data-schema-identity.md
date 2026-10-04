# 09 — Data Schema Reference: Identity & Enrollment

Xem `00-project-context.md` cho glossary/enum dùng chung. File này là đặc tả field-level để dịch trực tiếp sang `schema.prisma` — MUST khớp chính xác tên field, kiểu dữ liệu, nullable, khóa. Phạm vi: 7 bảng nền tảng (danh mục + đăng ký học phần + lịch học).

## User

| Field       | Kiểu            | Null?    | Khóa   | Ghi chú                                                                                                                                                                                       |
| ----------- | --------------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| userId      | String          | NOT NULL | PK     |                                                                                                                                                                                               |
| fullName    | String(100)     | NOT NULL |        |                                                                                                                                                                                               |
| role        | UserRole (enum) | NOT NULL |        | `STUDENT`/`ADVISOR`/`TRAINING_OFFICER`/`ADMIN`                                                                                                                                                |
| email       | String(100)     | NOT NULL | UNIQUE | Khi `role = STUDENT`: MUST đúng domain `@student.ctuet.edu.vn` — validate bằng Zod (`.email().endsWith('@student.ctuet.edu.vn')`) ở tầng nhập liệu/đăng ký tài khoản, không chỉ kiểm tra ở UI |
| scopeConfig | Json            | NULL     |        | Phạm vi phụ trách (lớp/khoa) cho `ADVISOR`/`TRAINING_OFFICER`                                                                                                                                 |

RÀNG BUỘC liên kết Student–User: với mọi `Student`, MUST tồn tại đúng 1 `User` có `role = STUDENT` và `User.userId = Student.studentId` (dùng chung mã số sinh viên làm khóa đăng nhập) — MUST NOT tạo `userId` khác cho tài khoản đăng nhập của sinh viên.

## Student

| Field                  | Kiểu                          | Null?    | Khóa             | Ghi chú                                                                                                                                            |
| ---------------------- | ----------------------------- | -------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| studentId              | String(20)                    | NOT NULL | PK               | Mã số sinh viên                                                                                                                                    |
| fullName               | String(100)                   | NOT NULL |                  |                                                                                                                                                    |
| classId                | String(20)                    | NOT NULL |                  | Nguồn từ SIS                                                                                                                                       |
| departmentId           | String(10)                    | NOT NULL |                  |                                                                                                                                                    |
| cohortYear             | String(10)                    | NOT NULL |                  | Khóa tuyển sinh                                                                                                                                    |
| advisorId              | String(20)                    | NOT NULL | FK → User.userId | CVHT hiện tại                                                                                                                                      |
| officialAcademicStatus | OfficialAcademicStatus (enum) | NOT NULL |                  | `ACTIVE`/`RESERVED`/`SUSPENDED`/`GRADUATED`/`DISMISSED`. MUST chỉ ghi bởi tiến trình đồng bộ SIS — xem ràng buộc phạm vi ở `00-project-context.md` |

## Term

| Field        | Kiểu       | Null?    | Khóa | Ghi chú                                                 |
| ------------ | ---------- | -------- | ---- | ------------------------------------------------------- |
| termId       | String(10) | NOT NULL | PK   |                                                         |
| termName     | String(50) | NOT NULL |      |                                                         |
| academicYear | String(10) | NOT NULL |      |                                                         |
| startDate    | DateTime   | NOT NULL |      |                                                         |
| endDate      | DateTime   | NOT NULL |      | Cùng `startDate` xác định cửa sổ quan sát cho RiskScore |

## Course

| Field      | Kiểu        | Null?    | Khóa | Ghi chú |
| ---------- | ----------- | -------- | ---- | ------- |
| courseId   | String(20)  | NOT NULL | PK   |         |
| courseName | String(150) | NOT NULL |      |         |
| credits    | Int         | NOT NULL |      |         |

## CourseSection

| Field           | Kiểu                 | Null?    | Khóa        | Ghi chú                                                      |
| --------------- | -------------------- | -------- | ----------- | ------------------------------------------------------------ |
| courseSectionId | String(20)           | NOT NULL | PK          |                                                              |
| courseId        | String(20)           | NOT NULL | FK → Course |                                                              |
| termId          | String(10)           | NOT NULL | FK → Term   |                                                              |
| instructorId    | String(20)           | NULL     | FK → User   |                                                              |
| usesLMS         | Boolean              | NOT NULL |             | Dùng cho HR-EXC (loại trừ nhóm HR-LMS nếu `false`)           |
| sectionStatus   | SectionStatus (enum) | NOT NULL |             | `NOT_STARTED`/`ONGOING`/`ENDED` — dùng cho HR-ATT-04, HR-EXC |

## Enrollment — bảng trung tâm, MUST hiểu trước khi đụng vào bất kỳ bảng dữ liệu nguồn nào

| Field            | Kiểu                    | Null?    | Khóa               | Ghi chú                                                                  |
| ---------------- | ----------------------- | -------- | ------------------ | ------------------------------------------------------------------------ |
| enrollmentId     | String (uuid)           | NOT NULL | PK                 |                                                                          |
| studentId        | String(20)              | NOT NULL | FK → Student       |                                                                          |
| courseSectionId  | String(20)              | NOT NULL | FK → CourseSection |                                                                          |
| enrollmentStatus | EnrollmentStatus (enum) | NOT NULL |                    | `REGISTERED`/`WITHDRAWN`/`COMPLETED`/`CANCELLED_BY_SECTION`              |
| registeredAt     | DateTime                | NOT NULL |                    | Dùng cho HR-ATT-04 (đăng ký muộn)                                        |
| withdrawnAt      | DateTime                | NULL     |                    |                                                                          |
| attemptNumber    | Int                     | NOT NULL |                    | Lần học thứ mấy — dùng cho HR-ACA-04                                     |
| attemptOutcome   | AttemptOutcome (enum)   | NULL     |                    | `PENDING`/`PASSED`/`FAILED`/`WITHDRAWN`                                  |
| enrollmentType   | EnrollmentType (enum)   | NOT NULL |                    | `NORMAL`/`RETAKE_FAILED`/`RETAKE_IMPROVEMENT`/`RETAKE_CURRICULUM_CHANGE` |
| sourceSystem     | String(30)              | NOT NULL |                    |                                                                          |
| sourceRecordKey  | String(50)              | NOT NULL |                    |                                                                          |
| importBatchId    | String (uuid)           | NOT NULL | FK → ImportBatch   |                                                                          |

RÀNG BUỘC (MUST implement ở tầng DB hoặc validate service):

- UNIQUE `(sourceSystem, sourceRecordKey)`.
- Chỉ 1 bản ghi `enrollmentStatus = REGISTERED` tại 1 thời điểm cho mỗi `(studentId, courseSectionId)` — SV rút rồi đăng ký lại MUST tạo bản ghi `Enrollment` mới, KHÔNG sửa đè bản ghi cũ.
- MUST: mọi bảng dữ liệu nguồn (điểm danh, kết quả, LMS — xem `10-data-schema-source-records.md`) trỏ qua `enrollmentId`, KHÔNG trỏ thẳng `studentId`+`courseSectionId`.

## CourseSessionSchedule

| Field           | Kiểu                 | Null?    | Khóa               | Ghi chú                                 |
| --------------- | -------------------- | -------- | ------------------ | --------------------------------------- |
| sessionId       | String (uuid)        | NOT NULL | PK                 |                                         |
| courseSectionId | String(20)           | NOT NULL | FK → CourseSection |                                         |
| sessionDate     | DateTime (date)      | NOT NULL |                    |                                         |
| sessionStatus   | SessionStatus (enum) | NOT NULL |                    | `SCHEDULED`/`OPEN`/`CLOSED`/`CANCELLED` |
| cancelReason    | String (text)        | NULL     |                    |                                         |

RÀNG BUỘC: UNIQUE `(courseSectionId, sessionDate)`. Hủy 1 buổi học MUST chỉ sửa 1 bản ghi ở đây, không sửa từng `AttendanceRecord` của từng sinh viên.

## Quan hệ (Prisma relation) tóm tắt

`Student 1—n Enrollment` · `CourseSection 1—n Enrollment` · `CourseSection 1—n CourseSessionSchedule` · `Course 1—n CourseSection` · `Term 1—n CourseSection` · `Student n—1 User` (qua `advisorId`) · `Enrollment n—1 ImportBatch`.
