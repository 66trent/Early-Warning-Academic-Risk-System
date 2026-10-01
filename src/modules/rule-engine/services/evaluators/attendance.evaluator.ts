/**
 * Attendance Rule Evaluators — HR-ATT-01/02/03/04
 * Pure functions — KHÔNG import next/* hoặc gọi Prisma bên trong.
 */

import type { TriggerResult } from "../../validators/rule-engine.schema";
import type { ExceptionResult } from "./exceptions.evaluator";

// ==========================================
// Shared Types for Attendance Data
// ==========================================

export interface AttendanceSession {
  sessionId: string;
  sessionDate: Date;
  sessionStatus: string; // SCHEDULED | OPEN | CLOSED | CANCELLED
  attendanceStatus: string | null; // PRESENT | EXCUSED_ABSENCE | UNEXCUSED_ABSENCE | LATE | null (no record)
}

export interface AttendanceEvalInput {
  studentId: string;
  termId: string;
  enrollmentId: string;
  courseSectionId: string;
  courseId: string;
  courseName: string;
  registeredAt: Date;
  evaluationDate: Date;
  ruleVersionId: string;
  sessions: AttendanceSession[];
  exceptions: ExceptionResult;
}

/** Input for HR-ATT-03 multi-course evaluation */
export interface MultiCourseAttendanceInput {
  studentId: string;
  termId: string;
  evaluationDate: Date;
  ruleVersionId: string;
  courses: Array<{
    courseSectionId: string;
    courseName: string;
    sessions: AttendanceSession[];
  }>;
}

// ==========================================
// HR-ATT-01 — Vắng liên tiếp ≥ consecutiveThreshold buổi
// ==========================================

export function evaluateConsecutiveAbsence(
  input: AttendanceEvalInput,
  condition: { consecutiveThreshold: number }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-ATT-01")) return null;

  // Only consider CLOSED sessions, not CANCELLED, sorted by date ascending
  const validSessions = input.sessions
    .filter((s) => s.sessionStatus === "CLOSED")
    .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime())
    // Temporal leakage: only sessions at or before evaluation date
    .filter((s) => s.sessionDate.getTime() <= input.evaluationDate.getTime());

  if (validSessions.length === 0) return null;

  // Find longest consecutive UNEXCUSED_ABSENCE streak
  let maxStreak = 0;
  let currentStreak = 0;
  let streakSessions: AttendanceSession[] = [];
  let maxStreakSessions: AttendanceSession[] = [];

  for (const session of validSessions) {
    if (session.attendanceStatus === "UNEXCUSED_ABSENCE") {
      currentStreak++;
      streakSessions.push(session);
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        maxStreakSessions = [...streakSessions];
      }
    } else {
      // EXCUSED_ABSENCE is excluded from counting consecutive
      // PRESENT, LATE reset the streak
      if (session.attendanceStatus !== "EXCUSED_ABSENCE") {
        currentStreak = 0;
        streakSessions = [];
      }
      // EXCUSED_ABSENCE: don't increment, don't reset
    }
  }

  if (maxStreak < condition.consecutiveThreshold) return null;

  const triggerSessions = maxStreakSessions.slice(0, condition.consecutiveThreshold);

  return {
    ruleCode: "HR-ATT-01",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.courseSectionId,
    termId: input.termId,
    severity: "HIGH",
    reason: `Sinh viên vắng không phép ${maxStreak} buổi liên tiếp tại ${input.courseName} (ngưỡng: ${condition.consecutiveThreshold})`,
    inputSnapshot: {
      ruleCode: "HR-ATT-01",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        consecutiveAbsences: maxStreak,
        threshold: condition.consecutiveThreshold,
        courseSectionId: input.courseSectionId,
        courseName: input.courseName,
        sessions: triggerSessions.map((s) => ({
          sessionId: s.sessionId,
          sessionDate: s.sessionDate.toISOString(),
        })),
      },
    },
  };
}

// ==========================================
// HR-ATT-02 — Ngưỡng cấm thi
// ==========================================

export function evaluateExamBanThreshold(
  input: AttendanceEvalInput,
  condition: {
    absenceRateThreshold: number;
    comparisonOperator: ">=" | ">";
    countLateAsAbsence: boolean;
    lateToAbsenceRatio?: number;
    countExcusedAbsence: boolean;
    countMakeupSessions: boolean;
  }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-ATT-02")) return null;

  // Filter sessions: CLOSED only, before evaluation date
  const validSessions = input.sessions
    .filter((s) => s.sessionStatus === "CLOSED")
    .filter((s) => s.sessionDate.getTime() <= input.evaluationDate.getTime());

  if (!condition.countMakeupSessions) {
    // If makeup sessions shouldn't be counted, we'd need a flag for that
    // For now, all CLOSED sessions count
  }

  const totalSessions = validSessions.length;
  if (totalSessions === 0) return null;

  let absenceCount = 0;
  for (const session of validSessions) {
    if (session.attendanceStatus === "UNEXCUSED_ABSENCE") {
      absenceCount++;
    } else if (session.attendanceStatus === "EXCUSED_ABSENCE" && condition.countExcusedAbsence) {
      absenceCount++;
    } else if (session.attendanceStatus === "LATE" && condition.countLateAsAbsence) {
      absenceCount += condition.lateToAbsenceRatio ?? 0.5;
    }
  }

  const absenceRate = absenceCount / totalSessions;
  const triggered =
    condition.comparisonOperator === ">="
      ? absenceRate >= condition.absenceRateThreshold
      : absenceRate > condition.absenceRateThreshold;

  if (!triggered) return null;

  return {
    ruleCode: "HR-ATT-02",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.courseSectionId,
    termId: input.termId,
    severity: "CRITICAL",
    reason: `Tỷ lệ vắng ${(absenceRate * 100).toFixed(1)}% tại ${input.courseName} đã ${condition.comparisonOperator === ">=" ? "chạm" : "vượt"} ngưỡng cấm thi ${(condition.absenceRateThreshold * 100).toFixed(0)}%`,
    inputSnapshot: {
      ruleCode: "HR-ATT-02",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        absenceRate,
        threshold: condition.absenceRateThreshold,
        operator: condition.comparisonOperator,
        absenceCount,
        totalSessions,
        courseSectionId: input.courseSectionId,
        courseName: input.courseName,
      },
    },
  };
}

// ==========================================
// HR-ATT-03 — Vắng đa môn đồng thời (sliding window)
// ==========================================

export function evaluateMultiCourseAbsence(
  input: MultiCourseAttendanceInput,
  condition: {
    windowDays: number;
    minAbsences: number;
    minCourses: number;
  }
): TriggerResult | null {
  const windowMs = condition.windowDays * 24 * 60 * 60 * 1000;
  const evalTime = input.evaluationDate.getTime();

  // Collect all UNEXCUSED_ABSENCE events across courses within window
  const absencesByCourse = new Map<string, Array<{ sessionDate: Date; sessionId: string }>>();

  for (const course of input.courses) {
    const courseAbsences = course.sessions
      .filter(
        (s) =>
          s.sessionStatus === "CLOSED" &&
          s.attendanceStatus === "UNEXCUSED_ABSENCE" &&
          s.sessionDate.getTime() <= evalTime &&
          s.sessionDate.getTime() >= evalTime - windowMs
      )
      .map((s) => ({ sessionDate: s.sessionDate, sessionId: s.sessionId }));

    if (courseAbsences.length > 0) {
      absencesByCourse.set(course.courseSectionId, courseAbsences);
    }
  }

  // Check: ≥ minCourses with ≥ minAbsences each? No, the spec says:
  // "vắng không phép ≥2 buổi ở ≥2 CourseSection khác nhau"
  // So: total absences ≥ minAbsences across ≥ minCourses
  const coursesWithAbsences = absencesByCourse.size;
  const totalAbsences = Array.from(absencesByCourse.values()).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  if (coursesWithAbsences < condition.minCourses || totalAbsences < condition.minAbsences) {
    return null;
  }

  const courseDetails = Array.from(absencesByCourse.entries()).map(([csId, absences]) => ({
    courseSectionId: csId,
    courseName: input.courses.find((c) => c.courseSectionId === csId)?.courseName ?? csId,
    absenceCount: absences.length,
    sessions: absences.map((a) => ({
      sessionId: a.sessionId,
      sessionDate: a.sessionDate.toISOString(),
    })),
  }));

  return {
    ruleCode: "HR-ATT-03",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.studentId, // PER_STUDENT scope
    termId: input.termId,
    severity: totalAbsences >= 4 ? "HIGH" : "MEDIUM",
    reason: `Sinh viên vắng không phép ở ${coursesWithAbsences} môn (tổng ${totalAbsences} buổi) trong ${condition.windowDays} ngày qua`,
    inputSnapshot: {
      ruleCode: "HR-ATT-03",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        windowDays: condition.windowDays,
        coursesWithAbsences,
        totalAbsences,
        courses: courseDetails,
      },
    },
  };
}

// ==========================================
// HR-ATT-04 — Không tham gia đầu kỳ
// ==========================================

export interface NoShowStartInput {
  studentId: string;
  termId: string;
  enrollmentId: string;
  courseSectionId: string;
  courseName: string;
  ruleVersionId: string;
  evaluationDate: Date;
  termStartDate: Date;
  registeredAt: Date;
  sectionStatus: string;
  usesLMS: boolean;
  hasScheduledSessions: boolean;
  sessions: AttendanceSession[];
  exceptions: ExceptionResult;
}

export function evaluateNoShowStart(
  input: NoShowStartInput,
  condition: { earlyTermDays: number }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-ATT-04")) return null;

  // Exclusions per spec:
  // 1. Sinh viên đăng ký muộn
  const earlyTermEnd = new Date(input.termStartDate);
  earlyTermEnd.setDate(earlyTermEnd.getDate() + condition.earlyTermDays);

  if (input.registeredAt.getTime() > input.termStartDate.getTime()) {
    return null; // Late registration
  }

  // 2. Lớp chưa bắt đầu
  if (input.sectionStatus === "NOT_STARTED") {
    return null;
  }

  // 3. Giảng viên chưa nhập điểm danh (no CLOSED sessions)
  const closedSessions = input.sessions.filter((s) => s.sessionStatus === "CLOSED");
  if (closedSessions.length === 0) {
    return null;
  }

  // 4. Học phần trực tuyến không điểm danh
  if (input.usesLMS && !input.hasScheduledSessions) {
    return null;
  }

  // 5. Only check within early term window and before evaluation date
  const effectiveEnd = Math.min(earlyTermEnd.getTime(), input.evaluationDate.getTime());
  if (input.evaluationDate.getTime() < earlyTermEnd.getTime()) {
    // Evaluation is within the early term period — might be too early to judge
    // But we still check if there are CLOSED sessions before evaluation date
  }

  // Check: any PRESENT attendance within early term period?
  const earlyTermSessions = closedSessions.filter(
    (s) =>
      s.sessionDate.getTime() >= input.termStartDate.getTime() &&
      s.sessionDate.getTime() <= effectiveEnd
  );

  if (earlyTermSessions.length === 0) {
    return null; // No sessions in early term period yet
  }

  const hasPresent = earlyTermSessions.some(
    (s) => s.attendanceStatus === "PRESENT" || s.attendanceStatus === "LATE"
  );

  if (hasPresent) return null;

  return {
    ruleCode: "HR-ATT-04",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.courseSectionId,
    termId: input.termId,
    severity: "HIGH",
    reason: `Sinh viên chưa tham gia buổi học nào tại ${input.courseName} trong ${condition.earlyTermDays} ngày đầu kỳ`,
    inputSnapshot: {
      ruleCode: "HR-ATT-04",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        earlyTermDays: condition.earlyTermDays,
        termStartDate: input.termStartDate.toISOString(),
        earlyTermSessions: earlyTermSessions.length,
        allAbsentOrUnexcused: true,
        courseSectionId: input.courseSectionId,
        courseName: input.courseName,
      },
    },
  };
}
