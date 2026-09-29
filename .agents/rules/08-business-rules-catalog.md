# 08 — Business Rules Catalog (Rule Engine)

Xem `00-project-context.md` cho glossary/enum. File này là nguồn sự thật cho nội dung logic nghiệp vụ trong `modules/rule-engine`. MUST NOT tự suy diễn/bịa thêm điều kiện luật ngoài những gì liệt kê dưới đây — mọi ngưỡng số là giá trị mặc định, đọc từ `RuleVersion.condition`, KHÔNG hard-code.

## Trình tự xử lý bắt buộc — 10 bước, không được đảo thứ tự

Khi Rule Engine chạy cho 1 `Enrollment`/1 sinh viên, MUST thực hiện đúng thứ tự sau:

1. Kiểm tra dữ liệu hợp lệ (loại bỏ bản ghi có `DataStatus = INVALID`).
2. Kiểm tra đối tượng có thuộc phạm vi đánh giá không (`Enrollment.enrollmentStatus = REGISTERED`).
3. Áp dụng ngoại lệ (nhóm HR-EXC, mục "Ngoại lệ" bên dưới) — MUST chạy TRƯỚC khi tính bất kỳ chỉ số hay chạy hard-trigger nào.
4. Tính chỉ số thành phần (attendance risk, academic risk, LMS risk) theo `DataStatus` của từng nhóm.
5. Tính `RiskScore` (công thức ở `00-project-context.md`).
6. Chạy các luật kích hoạt cứng (hard-trigger, nhóm HR-ATT/HR-ACA/HR-LMS/HR-COMB).
7. Gộp nguyên nhân — mọi `RuleTrigger` khớp `(studentId, ruleCode, scopeId, termId)` trong cửa sổ cooldown của luật đó được gộp vào 1 `Alert` đang mở, không tạo `Alert` mới.
8. Xác định severity cuối cùng của `Alert` = max(severity của mọi `RuleTrigger` liên quan).
9. Tạo/cập nhật `Alert` (tạo mới nếu chưa có `Alert` mở cho khóa tương quan trên; cập nhật `lastDetectedAt` + thêm `RuleTrigger` nếu đã có).
10. Gửi thông báo (theo dedup policy ở `06-security.md`).

MUST NOT: bỏ qua bước 3 (áp dụng ngoại lệ) rồi mới lọc kết quả sau — ngoại lệ phải chặn TRƯỚC khi luật có cơ hội kích hoạt, không phải lọc bỏ Alert sau khi đã tạo.

## Nhóm ATTENDANCE (điểm danh)

**HR-ATT-01 — Vắng liên tiếp** · Severity mặc định: `HIGH`
Điều kiện: sinh viên vắng không phép (`UNEXCUSED_ABSENCE`) ở ≥3 buổi học hợp lệ LIÊN TIẾP của cùng 1 `CourseSection`. Loại trừ khỏi chuỗi đếm liên tiếp: buổi có `CourseSessionSchedule.status = CANCELLED`, buổi chưa đóng sổ điểm danh, buổi `EXCUSED_ABSENCE`.
Ghi vào `RuleTrigger.inputSnapshot`: 3 buổi cụ thể nào (sessionId), môn nào, ngày nào, nguồn dữ liệu điểm danh.

**HR-ATT-02 — Ngưỡng cấm thi** · Severity mặc định: `CRITICAL`
Điều kiện: tỷ lệ vắng không phép trong 1 `CourseSection` đạt/vượt ngưỡng cấm dự thi, đọc từ `RuleVersion.condition` (KHÔNG hard-code 20%; ngưỡng cấu hình theo học phần hoặc chương trình đào tạo). `RuleVersion.condition` MUST khai báo tường minh: toán tử so sánh (`>=` hay `>`), đi trễ có quy đổi thành vắng hay không, vắng có phép có tính vào tỷ lệ hay không, buổi học bù có tính hay không.

**HR-ATT-03 — Vắng đa môn đồng thời** · Severity mặc định: `MEDIUM`–`HIGH`
Điều kiện: trong cửa sổ TRƯỢT 7 ngày (sliding window, không phải tuần lịch cố định), sinh viên vắng không phép ≥2 buổi ở ≥2 `CourseSection` khác nhau.

**HR-ATT-04 — Không tham gia đầu kỳ** · Severity mặc định: `HIGH`
Điều kiện: không có bản ghi `AttendanceStatus = PRESENT` nào trong khoảng thời gian đầu kỳ đã cấu hình (`RuleVersion.condition`), đối với học phần sinh viên đã đăng ký VÀ đã bắt đầu giảng dạy.
Loại trừ (MUST kiểm tra trước khi kích hoạt): sinh viên đăng ký muộn (`Enrollment.registeredAt` sau ngày bắt đầu kỳ), lớp chưa bắt đầu (`CourseSection.sectionStatus = NOT_STARTED`), giảng viên chưa nhập điểm danh (không có `CourseSessionSchedule` nào `CLOSED`), sinh viên đã chuyển/hủy lớp (`Enrollment.enrollmentStatus != REGISTERED`), học phần trực tuyến không điểm danh (`CourseSection.usesLMS = true` và không có lịch điểm danh).

## Nhóm ACADEMIC (học lực)

**HR-ACA-01 — Điểm 0/điểm liệt ở đánh giá quan trọng** · Severity mặc định: `MEDIUM`–`HIGH`
Cấu hình: `minimumAssessmentWeight`, `failingScore` (đọc từ `RuleVersion.condition`, không hard-code).
Điều kiện: 1 `AssessmentResult` có `resultStatus = FINAL`, `weight >= minimumAssessmentWeight`, và `score <= failingScore`.
KHÔNG kích hoạt nếu: `score = NULL` (chưa công bố), `resultStatus IN (EXEMPT, WAIVED, DRAFT, UNDER_APPEAL)`.

**HR-ACA-02 — Cảnh báo học vụ (tiệm cận ngưỡng quy chế)** · Severity mặc định: `CRITICAL`
Hành động khi kích hoạt: MUST chỉ tạo `Alert` mức `CRITICAL` cho CVHT và cán bộ đào tạo xem xét. MUST NOT tự động ghi/sửa `Student.officialAcademicStatus` hay bất kỳ trạng thái học vụ chính thức nào trên SIS (xem ràng buộc phạm vi ở `00-project-context.md`).

**HR-ACA-03 — Sụt giảm GPA đột ngột** · Severity mặc định: `MEDIUM`
Chỉ kích hoạt khi ĐỦ CẢ 3 điều kiện: (a) cả 2 kỳ so sánh đều đã chốt điểm (`AssessmentResult` liên quan có `resultStatus = FINAL` cho toàn bộ), (b) số tín chỉ mỗi kỳ đạt ngưỡng tối thiểu cấu hình (để loại trừ kỳ hè ít tín chỉ), (c) GPA 2 kỳ đã chuẩn hóa về cùng thang điểm.
Loại trừ: sinh viên chưa có kỳ trước (mới nhập học), kỳ trước ở trạng thái bảo lưu, kỳ hiện tại chưa hoàn thành.
Biến thể cho cảnh báo TRONG kỳ (không đợi GPA cuối kỳ — GPA cuối kỳ không phải tín hiệu sớm): dùng "điểm trung bình các đánh giá đã công bố giảm đáng kể so với cùng giai đoạn kỳ trước, hoặc thấp hơn ngưỡng cấu hình".

**HR-ACA-04 — Học lại nhiều lần** · Severity mặc định: `MEDIUM`
Điều kiện: `Enrollment.attemptNumber >= 3` VÀ `Enrollment.enrollmentType = RETAKE_FAILED` (chỉ tính lần học có `AttemptOutcome = FAILED` ở các lần trước — MUST NOT tính các lần `WITHDRAWN`/hủy lớp/học cải thiện/học lại do đổi chương trình vào số lần này).

## Nhóm LMS

**HR-LMS-01 — Không hoạt động LMS kéo dài** · Severity theo dải (MUST implement dạng nhánh điều kiện, KHÔNG dùng khoảng "Trung bình–Cao" mơ hồ):

- 7–9 ngày liên tục không có `LMSActivityEvent`/`LMSSubmission` nào → `MEDIUM`.
- 10–13 ngày → `HIGH`.
- ≥14 ngày VÀ đã bỏ lỡ ít nhất 1 deadline (`LMSAssignment` có deadline hiệu lực đã qua mà không có `LMSSubmission`) → `CRITICAL`.
  Điều kiện chung: lớp học phần đang có nội dung hoặc deadline hoạt động (`CourseSection.usesLMS = true`, có `LMSAssignment.status = PUBLISHED` trong khoảng thời gian xét). "Hoạt động có ý nghĩa" gồm: xem tài liệu, nộp bài, làm quiz, tham gia thảo luận, hoàn thành activity.
  Loại trừ: `CourseSection.usesLMS = false`, hoặc khoảng thời gian trùng `LMSMaintenanceWindow`.

**HR-LMS-02 — Bỏ nộp bài bắt buộc liên tiếp** · Severity mặc định: `MEDIUM`–`HIGH`
Điều kiện: không có `LMSSubmission` cho ≥2 `LMSAssignment` LIÊN TIẾP (xác định "liên tiếp" bằng `LMSAssignment.sequenceNumber` trong cùng `CourseSection`) có `isRequired = true` và deadline hiệu lực đã qua.
Deadline hiệu lực = deadline riêng trong `LMSDeadlineExtension` (nếu có, ưu tiên theo `studentId` cụ thể trước, `studentId = NULL` sau) hoặc `LMSAssignment.defaultDeadline`.
Loại trừ: bài không bắt buộc (`isRequired = false`), bài có `LMSAssignmentExemption` áp dụng cho sinh viên đó, deadline chưa qua, bài có `LMSAssignment.status = CANCELLED`.

**HR-LMS-03 — Hai điểm liệt liên tiếp ở bài tự động chấm** · Severity mặc định: `MEDIUM`
Điều kiện: ≥2 `LMSSubmission` LIÊN TIẾP (theo `sequenceNumber` của `LMSAssignment` tương ứng) có `isLatest = true`, điểm = 0 (hoặc ngưỡng liệt cấu hình), và bài đó đã chấm xong.
Loại trừ: bài chưa chấm, bài `EXEMPT`/`WAIVED`, bài không bắt buộc, điểm đang trong trạng thái khiếu nại.

## Nhóm COMBINED (tổ hợp đa nguồn)

**HR-COMB-01 — Tín hiệu tiêu cực đồng thời đa nguồn** · Severity mặc định: `CRITICAL`
Điều kiện: trong CÙNG 1 tuần, xuất hiện tín hiệu tiêu cực ở ≥2/3 nhóm chỉ số (điểm danh, học lực, LMS), NGAY CẢ KHI từng chỉ số riêng lẻ CHƯA đạt ngưỡng kích hoạt luật cứng riêng của nhóm đó. Ưu tiên hiển thị cao nhất trên dashboard CVHT.

**HR-COMB-02 — "Biến mất hoàn toàn"** · Severity mặc định: `CRITICAL`, kèm quy trình đặc biệt
Điều kiện: không có BẤT KỲ hoạt động nào (điểm danh có mặt, hoạt động LMS, nộp bài) trong ≥10 ngày liên tục.
Hành động: MUST kích hoạt quy trình liên hệ khẩn (CVHT gọi điện/liên hệ gia đình theo quy trình riêng), KHÔNG chỉ dừng ở gửi email tự động như các luật khác.

## Nhóm EXCEPTION (ngoại lệ) — áp dụng ở Bước 3, chặn TRƯỚC khi luật cứng có cơ hội kích hoạt

MUST kiểm tra toàn bộ danh sách sau trước khi cho phép bất kỳ hard-trigger hoặc tính RiskScore nào chạy trên 1 sinh viên/1 chỉ số:

- Sinh viên mới nhập học chưa có GPA kỳ trước (loại trừ khỏi HR-ACA-03).
- Môn không sử dụng LMS (`CourseSection.usesLMS = false`) — loại trừ khỏi toàn bộ nhóm HR-LMS.
- Môn chưa bắt đầu (`CourseSection.sectionStatus = NOT_STARTED`).
- Kỳ nghỉ/lịch nghỉ chính thức (nếu có ghi nhận trong `AcademicCalendarException`).
- LMS đang bảo trì (`LMSMaintenanceWindow` đang hiệu lực) — loại trừ khỏi HR-LMS-01.
- Điểm danh chưa hoàn tất (`CourseSessionSchedule.status != CLOSED`).
- Sinh viên đã rút học phần (`Enrollment.enrollmentStatus = WITHDRAWN`).
- Bài tập được gia hạn/miễn (`LMSDeadlineExtension`/`LMSAssignmentExemption` đang hiệu lực cho sinh viên/bài đó).
- Dữ liệu nguồn hết hạn hoặc lỗi (`DataStatus IN (STALE, INVALID)`).

## Cơ chế gộp nguyên nhân & chống trùng cảnh báo (Bước 7)

Khóa tương quan (correlation key) để gộp `RuleTrigger` vào cùng 1 `Alert`: `(studentId, ruleCode, scopeId, termId)`. Nếu đã tồn tại `Alert` đang mở khớp khóa này VÀ còn trong cửa sổ cooldown của `Rule.cooldown` → MUST cập nhật `Alert.lastDetectedAt` + thêm `RuleTrigger` mới, MUST NOT tạo `Alert` mới. Chỉ tạo `Alert` mới khi `Alert` cũ đã đóng (`RESOLVED`/`DISMISSED`) VÀ điều kiện tái xuất hiện sau cooldown.
