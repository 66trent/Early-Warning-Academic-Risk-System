/**
 * HR-EXC — Nhóm ngoại lệ
 * Áp dụng ở Bước 3 của pipeline, chặn TRƯỚC khi luật cứng có cơ hội kích hoạt.
 * Pure function — KHÔNG import next/* hoặc gọi Prisma bên trong.
 */

export interface ExceptionInput {
  studentId: string;
  enrollmentId: string;
  courseSectionId: string;
  termId: string;
  evaluationDate: Date;

  // Enrollment context
  enrollmentStatus: string;
  registeredAt: Date;

  // CourseSection context
  sectionStatus: string;
  usesLMS: boolean;

  // Has previous term GPA?
  hasPreviousTermGPA: boolean;

  // Academic calendar exceptions covering evaluation period
  calendarExceptions: Array<{
    exceptionDate: Date;
    type: string;
  }>;

  // LMS maintenance windows active during evaluation period
  lmsMaintenanceWindows: Array<{
    startAt: Date;
    endAt: Date;
  }>;

  // Session schedule status counts
  closedSessionCount: number;
  totalScheduledSessionCount: number;

  // Deadline extensions and exemptions for specific assignments
  deadlineExtensions: Array<{
    assignmentId: string;
    studentId: string | null;
    newDeadline: Date;
  }>;
  assignmentExemptions: Array<{
    assignmentId: string;
    studentId: string | null;
  }>;
}

export interface ExceptionResult {
  /** If true, skip this enrollment/student entirely for all rules */
  skipAll: boolean;

  /** Rule codes to skip (partial exclusion) */
  skipRules: Set<string>;

  /** Assignment IDs that are exempt for this student */
  exemptAssignmentIds: Set<string>;

  /** Assignment IDs with extended deadlines */
  extendedDeadlines: Map<string, Date>;

  /** Reasons why exceptions were applied (for audit/debug) */
  reasons: string[];
}

/**
 * Evaluate all exception conditions for a given enrollment context.
 * Returns an ExceptionResult indicating which rules or data to exclude.
 */
export function evaluateExceptions(input: ExceptionInput): ExceptionResult {
  const result: ExceptionResult = {
    skipAll: false,
    skipRules: new Set(),
    exemptAssignmentIds: new Set(),
    extendedDeadlines: new Map(),
    reasons: [],
  };

  // 1. Sinh viên đã rút học phần → skip all
  if (input.enrollmentStatus === "WITHDRAWN") {
    result.skipAll = true;
    result.reasons.push(
      `Enrollment ${input.enrollmentId}: enrollmentStatus=WITHDRAWN, skip all rules`
    );
    return result;
  }

  // 2. Enrollment không phải REGISTERED → skip all
  if (input.enrollmentStatus !== "REGISTERED") {
    result.skipAll = true;
    result.reasons.push(
      `Enrollment ${input.enrollmentId}: enrollmentStatus=${input.enrollmentStatus}, skip all rules`
    );
    return result;
  }

  // 3. Môn chưa bắt đầu → skip all
  if (input.sectionStatus === "NOT_STARTED") {
    result.skipAll = true;
    result.reasons.push(
      `CourseSection ${input.courseSectionId}: sectionStatus=NOT_STARTED, skip all rules`
    );
    return result;
  }

  // 4. Môn không sử dụng LMS → skip toàn bộ nhóm HR-LMS
  if (!input.usesLMS) {
    result.skipRules.add("HR-LMS-01");
    result.skipRules.add("HR-LMS-02");
    result.skipRules.add("HR-LMS-03");
    result.reasons.push(`CourseSection ${input.courseSectionId}: usesLMS=false, skip HR-LMS-*`);
  }

  // 5. Kỳ nghỉ/lịch nghỉ chính thức (AcademicCalendarException)
  const evaluationDateStr = input.evaluationDate.toISOString().split("T")[0];
  const isHoliday = input.calendarExceptions.some((exc) => {
    const excDateStr = exc.exceptionDate.toISOString().split("T")[0];
    return excDateStr === evaluationDateStr && exc.type === "HOLIDAY";
  });
  if (isHoliday) {
    result.skipAll = true;
    result.reasons.push(`evaluationDate=${evaluationDateStr} is a HOLIDAY, skip all rules`);
    return result;
  }

  // 6. LMS đang bảo trì → skip HR-LMS-01
  const evalTime = input.evaluationDate.getTime();
  const isLMSMaintenance = input.lmsMaintenanceWindows.some(
    (w) => evalTime >= w.startAt.getTime() && evalTime <= w.endAt.getTime()
  );
  if (isLMSMaintenance) {
    result.skipRules.add("HR-LMS-01");
    result.reasons.push(
      `LMS maintenance window active at ${input.evaluationDate.toISOString()}, skip HR-LMS-01`
    );
  }

  // 7. Điểm danh chưa hoàn tất (no closed sessions)
  if (input.closedSessionCount === 0 && input.totalScheduledSessionCount > 0) {
    result.skipRules.add("HR-ATT-01");
    result.skipRules.add("HR-ATT-02");
    result.skipRules.add("HR-ATT-03");
    result.skipRules.add("HR-ATT-04");
    result.reasons.push(
      `CourseSection ${input.courseSectionId}: no CLOSED sessions, skip HR-ATT-*`
    );
  }

  // 8. Sinh viên mới nhập học chưa có GPA kỳ trước → skip HR-ACA-03
  if (!input.hasPreviousTermGPA) {
    result.skipRules.add("HR-ACA-03");
    result.reasons.push(`Student ${input.studentId}: no previous term GPA, skip HR-ACA-03`);
  }

  // 9. Deadline extensions → record extended deadlines per assignment
  for (const ext of input.deadlineExtensions) {
    // studentId=NULL means class-wide, otherwise must match this student
    if (ext.studentId === null || ext.studentId === input.studentId) {
      // If there's already an extension, keep the latest one
      const existing = result.extendedDeadlines.get(ext.assignmentId);
      if (!existing || ext.newDeadline.getTime() > existing.getTime()) {
        result.extendedDeadlines.set(ext.assignmentId, ext.newDeadline);
      }
    }
  }

  // 10. Assignment exemptions → record exempt assignments
  for (const exemption of input.assignmentExemptions) {
    if (exemption.studentId === null || exemption.studentId === input.studentId) {
      result.exemptAssignmentIds.add(exemption.assignmentId);
    }
  }

  if (result.extendedDeadlines.size > 0) {
    result.reasons.push(`${result.extendedDeadlines.size} deadline extension(s) applied`);
  }
  if (result.exemptAssignmentIds.size > 0) {
    result.reasons.push(`${result.exemptAssignmentIds.size} assignment exemption(s) applied`);
  }

  return result;
}
