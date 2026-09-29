---
trigger: always_on
---

# 00 — Project Context & Domain Glossary

Nguồn sự thật duy nhất về nghiệp vụ và mô hình dữ liệu của dự án. Mọi rule khác trong `.agents/rules/` giả định agent đã đọc file này. Không định nghĩa lại các khái niệm dưới đây ở nơi khác — chỉ tham chiếu tên.

## Hệ thống là gì

CTUET-EWARS (Early Warning Academic Risk System): hệ thống phát hiện dấu hiệu rủi ro học tập của sinh viên dựa trên luật nghiệp vụ có thể cấu hình, tổng hợp từ 3 nguồn dữ liệu: điểm danh, kết quả học tập, tương tác LMS.

## Ranh giới phạm vi — bất biến, không được vi phạm dưới bất kỳ lý do nào

Hệ thống CHỈ được: (1) phát hiện dấu hiệu, (2) tạo cảnh báo sớm, (3) gửi cảnh báo tới CVHT/cán bộ đào tạo, (4) cho phép cán bộ xác nhận/xử lý.

Hệ thống KHÔNG BAO GIỜ được tự động ghi hoặc sửa trạng thái học vụ chính thức của sinh viên (`Student.officialAcademicStatus`). Trường này chỉ được cập nhật một chiều từ hệ thống quản lý đào tạo (SIS) bên ngoài. Mọi cảnh báo do hệ thống tạo ra là tham khảo (`Alert.isReferenceOnly = true`), không phải quyết định hành chính.

## Tech stack

Next.js 16 (App Router, fullstack) · PostgreSQL · Prisma ORM · Better Auth · BullMQ + Redis (job nền) · Rule Engine tự viết (không dùng thư viện luật ngoài) · Tailwind CSS 4 + shadcn/ui · Tremor (biểu đồ dashboard) · Nodemailer + SMTP nội bộ · Docker.

## Vai trò người dùng (roles) và phạm vi truy cập dữ liệu

| Role                             | Phạm vi được xem/sửa                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `STUDENT`                        | Chỉ dữ liệu của chính mình (`Student.id === session.user.studentId`)                                                      |
| `ADVISOR` (CVHT)                 | Chỉ sinh viên có `Student.advisorId === session.user.id` tại thời điểm hiện tại                                           |
| `TRAINING_OFFICER` (Cán bộ QLĐT) | Theo `User.scopeConfig` (khoa hoặc toàn trường); cấu hình luật chỉ có hiệu lực sau khi `RuleVersion.approvedBy` khác null |
| `ADMIN`                          | Toàn quyền vận hành (tài khoản, tích hợp, phân quyền) — KHÔNG có quyền nghiệp vụ đặc biệt để ghi `officialAcademicStatus` |

## Mô hình dữ liệu cốt lõi (entity glossary)

| Entity                                            | Định nghĩa                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Student`                                         | Hồ sơ sinh viên. `officialAcademicStatus` là bản sao chỉ-đọc từ SIS.                                                                                                                                                                                                                                                                                                                                  |
| `Enrollment`                                      | Một lần đăng ký của 1 sinh viên vào 1 `CourseSection`. Có `attemptNumber` (lần học thứ mấy) và `enrollmentStatus` (`REGISTERED`/`WITHDRAWN`/`COMPLETED`/`CANCELLED_BY_SECTION`). **Mọi dữ liệu nguồn (điểm danh, kết quả, LMS) phải trỏ qua `Enrollment`, không trỏ thẳng `Student`+`CourseSection`** — đây là cách hệ thống phân biệt các lần học lại và chặn dữ liệu của sinh viên không thuộc lớp. |
| `Course` / `CourseSection`                        | Môn học / một lớp cụ thể của môn đó trong một `Term`.                                                                                                                                                                                                                                                                                                                                                 |
| `CourseSessionSchedule`                           | Lịch từng buổi học của 1 lớp (cấp lớp, không lặp theo sinh viên).                                                                                                                                                                                                                                                                                                                                     |
| `AttendanceRecord`                                | Điểm danh 1 sinh viên ở 1 buổi học, trỏ qua `Enrollment` + `CourseSessionSchedule`. `attendanceStatus`: `PRESENT`/`EXCUSED_ABSENCE`/`UNEXCUSED_ABSENCE`/`LATE`.                                                                                                                                                                                                                                       |
| `AssessmentResult`                                | Điểm 1 bài đánh giá của 1 `Enrollment`. `resultStatus`: `DRAFT`/`FINAL`/`UNDER_APPEAL`/`EXEMPT`/`WAIVED`.                                                                                                                                                                                                                                                                                             |
| `LMSAssignment`                                   | Bài tập/quiz ở cấp lớp — tồn tại độc lập với việc sinh viên có nộp hay không.                                                                                                                                                                                                                                                                                                                         |
| `LMSSubmission`                                   | 1 lượt nộp bài của 1 `Enrollment` cho 1 `LMSAssignment`. `isLatest = true` đánh dấu bản được tính điểm.                                                                                                                                                                                                                                                                                               |
| `LMSDeadlineExtension` / `LMSAssignmentExemption` | Gia hạn/miễn bài. `studentId = NULL` nghĩa là áp dụng cho cả lớp; có giá trị nghĩa là áp dụng riêng 1 sinh viên.                                                                                                                                                                                                                                                                                      |
| `LMSActivityEvent`                                | Log tương tác thuần (xem tài liệu, đăng nhập) — không bao gồm nộp bài.                                                                                                                                                                                                                                                                                                                                |
| `Rule`                                            | Định danh 1 luật nghiệp vụ (VD: `HR-ATT-01`), không chứa ngưỡng cụ thể.                                                                                                                                                                                                                                                                                                                               |
| `RuleVersion`                                     | Phiên bản cụ thể của 1 `Rule`: ngưỡng, trọng số, `severity`, `status` (`DRAFT`/`ACTIVE`/`INACTIVE`/`ARCHIVED`). Sửa ngưỡng luôn tạo phiên bản mới, không ghi đè.                                                                                                                                                                                                                                      |
| `RuleTrigger`                                     | 1 bằng chứng: 1 lần 1 `RuleVersion` đúng với dữ liệu của 1 sinh viên. Không hiển thị trực tiếp cho người dùng — là input để tạo `Alert`.                                                                                                                                                                                                                                                              |
| `RiskScoreLog`                                    | Điểm rủi ro tổng hợp có trọng số của 1 sinh viên tại 1 thời điểm, kèm `dataCompletenessLevel`.                                                                                                                                                                                                                                                                                                        |
| `Alert`                                           | Hồ sơ cảnh báo — cái CVHT thực sự thấy và xử lý. Gộp nhiều `RuleTrigger`. `status`: `OPEN`/`ACKNOWLEDGED`/`IN_PROGRESS`/`RESOLVED`/`DISMISSED`/`INVALIDATED`/`REOPENED`.                                                                                                                                                                                                                              |
| `Intervention`                                    | 1 hành động can thiệp của CVHT gắn với 1 `Alert`.                                                                                                                                                                                                                                                                                                                                                     |
| `Notification`                                    | 1 lượt gửi thông báo, có `dedupKey` để chống gửi trùng.                                                                                                                                                                                                                                                                                                                                               |
| `ImportBatch` / `ImportErrorRow`                  | 1 lô nhập dữ liệu và các dòng lỗi của lô đó.                                                                                                                                                                                                                                                                                                                                                          |

## Enum dùng chung — không được định nghĩa lệch ở bất kỳ đâu

Có 2 TẦNG enum trạng thái dữ liệu, KHÔNG được gộp làm một:

- **Tầng 1 — `DataStatus`** (trạng thái của TỪNG chỉ số đầu vào riêng lẻ — điểm danh/GPA/LMS — trước khi tính toán): `AVAILABLE` (có dữ liệu, dùng được) / `MISSING` (chưa có dữ liệu) / `NOT_APPLICABLE` (không áp dụng, VD: môn không dùng LMS) / `STALE` (dữ liệu cũ, quá hạn đồng bộ) / `INVALID` (dữ liệu sai định dạng/xung đột). Dùng enum này khi viết logic đọc dữ liệu đầu vào cho 1 chỉ số cụ thể trong `rule-engine`.
- **Tầng 2 — `DataCompletenessLevel`** (mức tổng hợp của TOÀN BỘ RiskScore 1 sinh viên, suy ra TỪ tầng 1): `FULL` (cả 3 nhóm chỉ số đều `AVAILABLE`) / `PARTIAL` (≥1 nhóm không `AVAILABLE`, đã renormalize trọng số trên các nhóm còn `AVAILABLE`) / `INSUFFICIENT` (không đủ nhóm `AVAILABLE` để tính có ý nghĩa — `RiskScoreLog.riskScoreValue = NULL`, KHÔNG được hiển thị như "rủi ro thấp"). Dùng enum này khi ghi kết quả vào `RiskScoreLog`.
- **Severity**: `LOW` < `MEDIUM` < `HIGH` < `CRITICAL`. Khi nhiều luật cùng kích hoạt cho 1 sinh viên, severity cuối cùng của `Alert` = giá trị lớn nhất trong số đó (không cộng dồn, không trung bình).
- **EnrollmentType**: `NORMAL` / `RETAKE_FAILED` (học lại do rớt) / `RETAKE_IMPROVEMENT` (học cải thiện) / `RETAKE_CURRICULUM_CHANGE` (học lại do đổi chương trình).
- **AttemptOutcome**: `PENDING` / `PASSED` / `FAILED` / `WITHDRAWN` — chốt khi kỳ kết thúc, là nguồn tính `attemptNumber` cho lần đăng ký `Enrollment` tiếp theo của cùng môn.
- **ImportBatch.status**: `UPLOADING` → `VALIDATING` → `STAGED` → `LOADED` → `RECONCILED` (thành công) hoặc `REJECTED` (lỗi nghiêm trọng) hoặc `DISCARDED` (bị hủy khi còn `STAGED`, chưa dùng để tính RiskScore).

## Nguyên tắc tính điểm rủi ro (RiskScore) — cần biết trước khi đụng vào `modules/rule-engine`

`RiskScore = Σ(weight_i × normalizedRisk_i) / Σ(weight_i)`, chỉ tính trên các chỉ số i có `DataStatus = AVAILABLE` (bỏ qua `MISSING`/`INVALID`/`NOT_APPLICABLE`/`STALE` khỏi cả tử số và mẫu số — đây chính là cơ chế renormalize). Chỉ tính bằng dữ liệu đã phát sinh đến thời điểm tính (không dùng dữ liệu tương lai — chống temporal leakage). Nội dung đầy đủ các luật cụ thể và trình tự xử lý: xem `08-business-rules-catalog.md`.

## Căn cứ pháp lý bảo vệ dữ liệu cá nhân

Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026) và Nghị định 356/2025/NĐ-CP (thay thế Nghị định 13/2023/NĐ-CP). Chi tiết nghĩa vụ tuân thủ: xem `04-legal-compliance.md`.
