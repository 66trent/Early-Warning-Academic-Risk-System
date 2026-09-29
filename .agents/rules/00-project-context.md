---
trigger: always_on
---

# 00 — Project Context & Domain Glossary

Nguồn sự thật duy nhất về nghiệp vụ và mô hình dữ liệu của CTUET-EWARS. Mọi rule khác trong `.agents/rules/` giả định đã đọc file này và chỉ tham chiếu theo tên.

## 1. Hệ thống là gì

CTUET-EWARS (Early Warning Academic Risk System): hệ thống phát hiện sớm dấu hiệu rủi ro học tập của sinh viên dựa trên luật nghiệp vụ cấu hình được, tổng hợp từ 3 nguồn: điểm danh, kết quả học tập và tương tác LMS.

## 2. Ranh giới phạm vi (Bất biến, không vi phạm)

- **Hệ thống CHỈ được**: (1) phát hiện dấu hiệu, (2) tạo cảnh báo sớm, (3) gửi thông báo tới CVHT/cán bộ đào tạo, (4) hỗ trợ cán bộ ghi nhận can thiệp/xử lý.
- **CẤM TUYỆT ĐỐI**: Không tự động sửa trạng thái học vụ chính thức (`Student.officialAcademicStatus`). Trường này chỉ cập nhật 1 chiều từ SIS bên ngoài. Mọi cảnh báo là tham khảo (`Alert.isReferenceOnly = true`), không phải quyết định hành chính.

## 3. Tech Stack

Next.js 16 (App Router, fullstack) · PostgreSQL · Prisma ORM 7 · Better Auth · BullMQ + Redis · Rule Engine tự viết (không dùng lib ngoài) · Tailwind CSS 4 + shadcn/ui · Tremor (dashboard) · Nodemailer + SMTP · Docker.

## 4. Vai trò người dùng (Roles) & Phạm vi truy cập

| Role | Phạm vi dữ liệu được phép |
|---|---|
| `STUDENT` | Chỉ dữ liệu bản thân (`Student.id === session.user.studentId`) |
| `ADVISOR` (CVHT) | Chỉ SV đang phụ trách (`Student.advisorId === session.user.id`) |
| `TRAINING_OFFICER` (QLĐT) | Theo `User.scopeConfig` (khoa/trường); cấu hình luật chỉ `ACTIVE` khi `RuleVersion.approvedBy` khác null |
| `ADMIN` | Vận hành hệ thống (tài khoản, tích hợp); KHÔNG có quyền sửa `officialAcademicStatus` |

## 5. Mô hình dữ liệu cốt lõi (Entity Glossary)

| Entity | Định nghĩa & Ràng buộc cốt lõi |
|---|---|
| `Student` | Hồ sơ sinh viên. `officialAcademicStatus` là bản sao chỉ đọc từ SIS. |
| `Enrollment` | Lần đăng ký 1 SV vào 1 `CourseSection`. Có `attemptNumber` và `enrollmentStatus`. **Bắt buộc mọi dữ liệu nguồn (điểm danh, điểm số, LMS) trỏ qua `Enrollment`, không trỏ thẳng `Student`+`CourseSection`** để phân biệt lần học lại và chặn dữ liệu ngoài lớp. |
| `Course` / `CourseSection` | Môn học / Lớp học phần cụ thể trong 1 `Term`. |
| `CourseSessionSchedule` | Lịch từng buổi học của 1 lớp (cấp lớp, không lặp theo SV). |
| `AttendanceRecord` | Điểm danh 1 SV ở 1 buổi, trỏ qua `Enrollment` + `CourseSessionSchedule`. `attendanceStatus`: `PRESENT`/`EXCUSED_ABSENCE`/`UNEXCUSED_ABSENCE`/`LATE`. |
| `AssessmentResult` | Điểm 1 bài đánh giá của 1 `Enrollment`. `resultStatus`: `DRAFT`/`FINAL`/`UNDER_APPEAL`/`EXEMPT`/`WAIVED`. |
| `LMSAssignment` | Bài tập/quiz cấp lớp, tồn tại độc lập với việc SV có nộp bài hay không. |
| `LMSSubmission` | 1 lượt nộp bài thực tế của `Enrollment` cho `LMSAssignment`. `isLatest = true` là bản tính điểm. CẤM lưu bản ghi "không nộp bài" — trạng thái này suy ra từ deadline. |
| `LMSDeadlineExtension` / `LMSAssignmentExemption` | Gia hạn/miễn bài. `studentId = NULL` là áp dụng cả lớp; có giá trị là áp dụng riêng 1 SV. |
| `LMSActivityEvent` | Log tương tác thuần (xem tài liệu, đăng nhập) — không gồm nộp bài. |
| `Rule` | Định danh luật nghiệp vụ (VD: `HR-ATT-01`), không chứa ngưỡng cụ thể. |
| `RuleVersion` | Phiên bản cụ thể của 1 `Rule`: ngưỡng, trọng số, `severity`, `status`. Sửa ngưỡng luôn tạo version mới, không ghi đè. |
| `RuleTrigger` | Bằng chứng 1 lần `RuleVersion` đúng với dữ liệu 1 SV. Input tạo `Alert`. |
| `RiskScoreLog` | Điểm rủi ro tổng hợp có trọng số tại 1 thời điểm, kèm `dataCompletenessLevel`. |
| `Alert` | Hồ sơ cảnh báo hiển thị cho CVHT. Gộp nhiều `RuleTrigger`. Trạng thái: `OPEN`/`ACKNOWLEDGED`/`IN_PROGRESS`/`RESOLVED`/`DISMISSED`/`INVALIDATED`/`REOPENED`. |
| `Intervention` | Hành động can thiệp của CVHT gắn với 1 `Alert`. |
| `Notification` | Lượt gửi thông báo, có `dedupKey` chống gửi trùng. |
| `ImportBatch` / `ImportErrorRow` | Lô nhập dữ liệu và các dòng lỗi chi tiết của lô đó. |

## 6. Enum dùng chung

### 2 tầng trạng thái dữ liệu (BẮT BUỘC TÁCH BIỆT)
- **Tầng 1 — `DataStatus`** (từng chỉ số riêng trước tính toán): `AVAILABLE` (dùng được) / `MISSING` (thiếu) / `NOT_APPLICABLE` (không áp dụng, VD: môn không dùng LMS) / `STALE` (quá hạn đồng bộ) / `INVALID` (sai/xung đột). Dùng trong evaluator của `rule-engine`.
- **Tầng 2 — `DataCompletenessLevel`** (mức tin cậy tổng thể của `RiskScoreLog` suy ra từ Tầng 1):
  - `FULL`: Cả 3 nhóm chỉ số đều `AVAILABLE`.
  - `PARTIAL`: ≥1 nhóm không `AVAILABLE`, đã renormalize trọng số trên các nhóm `AVAILABLE`.
  - `INSUFFICIENT`: Không đủ nhóm `AVAILABLE` để tính toán có ý nghĩa (`RiskScoreLog.riskScoreValue = NULL`, CẤM hiển thị là rủi ro thấp).

### Các Enum khác
- **Severity**: `LOW` < `MEDIUM` < `HIGH` < `CRITICAL`. Severity cuối của `Alert` = max() các `RuleTrigger` kích hoạt (không cộng dồn hay lấy trung bình).
- **EnrollmentType**: `NORMAL` / `RETAKE_FAILED` (học lại do rớt) / `RETAKE_IMPROVEMENT` (cải thiện) / `RETAKE_CURRICULUM_CHANGE` (đổi CTĐT).
- **AttemptOutcome**: `PENDING` / `PASSED` / `FAILED` / `WITHDRAWN` (chốt cuối kỳ, tính `attemptNumber` cho lần học kế tiếp).
- **ImportBatchStatus**: `UPLOADING` → `VALIDATING` → `STAGED` → `LOADED` → `RECONCILED` (thành công) / `REJECTED` (lỗi nghiêm trọng) / `DISCARDED` (hủy khi còn `STAGED`).

## 7. Nguyên tắc tính RiskScore

$$\text{RiskScore} = \frac{\sum (\text{weight}_i \times \text{normalizedRisk}_i)}{\sum \text{weight}_i}$$

- Chỉ tính trên các chỉ số $i$ có `DataStatus = AVAILABLE` (loại bỏ `MISSING`/`INVALID`/`NOT_APPLICABLE`/`STALE` khỏi cả tử số và mẫu số — cơ chế renormalize).
- Chống rò rỉ thời gian (temporal leakage): chỉ dùng dữ liệu phát sinh trước hoặc tại thời điểm tính toán. Trình tự 10 bước chi tiết xem `08-business-rules-catalog.md`.

## 8. Căn cứ pháp lý bảo vệ dữ liệu cá nhân

Tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP (hiệu lực 01/01/2026). Chi tiết nghĩa vụ: xem `04-legal-compliance.md`.
