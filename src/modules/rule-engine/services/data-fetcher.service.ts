/**
 * Data Fetcher — bridges Prisma queries to pure evaluator input types.
 * This service CAN import Prisma because it runs in the action/worker layer,
 * NOT inside the pure evaluator functions.
 */

import { prisma } from "@/lib/prisma";
import type { ExceptionInput } from "./evaluators/exceptions.evaluator";
import type {
  AttendanceEvalInput,
  AttendanceSession,
  MultiCourseAttendanceInput,
  NoShowStartInput,
} from "./evaluators/attendance.evaluator";
import type { AcaFailingScoreInput, AcaRetakeInput } from "./evaluators/academic.evaluator";
import type {
  LmsInactivityInput,
  LmsMissedSubmissionsInput,
  LmsConsecutiveZeroInput,
} from "./evaluators/lms.evaluator";
import type { CombMultiSourceInput, CombDisappearanceInput } from "./evaluators/combined.evaluator";
import type { RiskScoreInput } from "../validators/rule-engine.schema";
import type {
  StudentEvaluationData,
  ExistingAlert,
  ActiveRuleVersion,
} from "./orchestrator.service";
import { determineDataStatus } from "./risk-score.service";

const EMPTY_EXCEPTION_RESULT = {
  skipAll: false,
  skipRules: new Set<string>(),
  exemptAssignmentIds: new Set<string>(),
  extendedDeadlines: new Map<string, Date>(),
  reasons: [],
};

/**
 * Fetch all active RuleVersion records.
 */
export async function fetchActiveRuleVersions(): Promise<ActiveRuleVersion[]> {
  const versions = await prisma.ruleVersion.findMany({
    where: { status: "ACTIVE" },
    include: { rule: true },
  });

  return versions.map((v) => ({
    id: v.id,
    ruleCode: v.ruleCode,
    version: v.version,
    condition: v.condition as Record<string, unknown>,
    severity: v.severity,
    action: v.action as Record<string, unknown>,
    ruleGroup: v.rule.ruleGroup,
    scope: v.rule.scope,
    cooldown: v.rule.cooldown,
  }));
}

/**
 * Fetch all data needed to evaluate a single student for a term.
 */
export async function fetchStudentEvaluationData(
  studentId: string,
  termId: string,
  evaluationDate: Date
): Promise<StudentEvaluationData> {
  // Fetch student with advisor
  const student = await prisma.student.findUniqueOrThrow({
    where: { studentId },
  });

  // Fetch REGISTERED enrollments for this term
  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      courseSection: { termId },
      enrollmentStatus: "REGISTERED",
    },
    include: {
      courseSection: {
        include: {
          course: true,
          schedules: {
            orderBy: { sessionDate: "asc" },
          },
          lmsAssignments: {
            where: { status: "PUBLISHED" },
            orderBy: { sequenceNumber: "asc" },
            include: {
              extensions: true,
              exemptions: true,
            },
          },
        },
      },
      attendanceRecords: {
        include: { session: true },
      },
      assessmentResults: true,
      lmsSubmissions: true,
      lmsActivityEvents: {
        orderBy: { timestamp: "desc" },
      },
    },
  });

  // Fetch term info
  const term = await prisma.term.findUniqueOrThrow({
    where: { termId },
  });

  // Fetch calendar exceptions
  const calendarExceptions = await prisma.academicCalendarException.findMany({
    where: {
      exceptionDate: {
        gte: term.startDate,
        lte: term.endDate,
      },
    },
  });

  // Fetch LMS maintenance windows
  const lmsMaintenanceWindows = await prisma.lMSMaintenanceWindow.findMany({
    where: {
      OR: [{ startAt: { lte: evaluationDate }, endAt: { gte: term.startDate } }],
    },
  });

  // Fetch existing open alerts
  const existingAlerts = await prisma.alert.findMany({
    where: {
      studentId,
      termId,
      status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"] },
    },
    include: {
      ruleTriggers: true,
    },
  });

  // Build exception inputs
  const enrollmentExceptions: ExceptionInput[] = enrollments.map((enr) => ({
    studentId,
    enrollmentId: enr.enrollmentId,
    courseSectionId: enr.courseSectionId,
    termId,
    evaluationDate,
    enrollmentStatus: enr.enrollmentStatus,
    registeredAt: enr.registeredAt,
    sectionStatus: enr.courseSection.sectionStatus,
    usesLMS: enr.courseSection.usesLMS,
    hasPreviousTermGPA: false, // Will be determined below
    calendarExceptions: calendarExceptions.map((ce) => ({
      exceptionDate: ce.exceptionDate,
      type: ce.type,
    })),
    lmsMaintenanceWindows: lmsMaintenanceWindows.map((w) => ({
      startAt: w.startAt,
      endAt: w.endAt,
    })),
    closedSessionCount: enr.courseSection.schedules.filter((s) => s.sessionStatus === "CLOSED")
      .length,
    totalScheduledSessionCount: enr.courseSection.schedules.length,
    deadlineExtensions: enr.courseSection.lmsAssignments.flatMap((a) =>
      a.extensions.map((ext) => ({
        assignmentId: ext.assignmentId,
        studentId: ext.studentId,
        newDeadline: ext.newDeadline,
      }))
    ),
    assignmentExemptions: enr.courseSection.lmsAssignments.flatMap((a) =>
      a.exemptions.map((ex) => ({
        assignmentId: ex.assignmentId,
        studentId: ex.studentId,
      }))
    ),
  }));

  // Build attendance inputs
  const attendanceInputs: AttendanceEvalInput[] = enrollments.map((enr) => {
    const sessions: AttendanceSession[] = enr.courseSection.schedules.map((schedule) => {
      const record = enr.attendanceRecords.find((ar) => ar.sessionId === schedule.sessionId);
      return {
        sessionId: schedule.sessionId,
        sessionDate: schedule.sessionDate,
        sessionStatus: schedule.sessionStatus,
        attendanceStatus: record?.attendanceStatus ?? null,
      };
    });

    return {
      studentId,
      termId,
      enrollmentId: enr.enrollmentId,
      courseSectionId: enr.courseSectionId,
      courseId: enr.courseSection.courseId,
      courseName: enr.courseSection.course.courseName,
      registeredAt: enr.registeredAt,
      evaluationDate,
      ruleVersionId: "", // Will be set by orchestrator
      sessions,
      exceptions: EMPTY_EXCEPTION_RESULT,
    };
  });

  // Build multi-course attendance input (student-level)
  const multiCourseAttendanceInput: MultiCourseAttendanceInput | null =
    attendanceInputs.length >= 2
      ? {
          studentId,
          termId,
          evaluationDate,
          ruleVersionId: "",
          courses: attendanceInputs.map((ai) => ({
            courseSectionId: ai.courseSectionId,
            courseName: ai.courseName,
            sessions: ai.sessions,
          })),
        }
      : null;

  // Build no-show start inputs
  const noShowStartInputs: NoShowStartInput[] = enrollments.map((enr) => {
    const sessions: AttendanceSession[] = enr.courseSection.schedules.map((schedule) => {
      const record = enr.attendanceRecords.find((ar) => ar.sessionId === schedule.sessionId);
      return {
        sessionId: schedule.sessionId,
        sessionDate: schedule.sessionDate,
        sessionStatus: schedule.sessionStatus,
        attendanceStatus: record?.attendanceStatus ?? null,
      };
    });

    return {
      studentId,
      termId,
      enrollmentId: enr.enrollmentId,
      courseSectionId: enr.courseSectionId,
      courseName: enr.courseSection.course.courseName,
      ruleVersionId: "",
      evaluationDate,
      termStartDate: term.startDate,
      registeredAt: enr.registeredAt,
      sectionStatus: enr.courseSection.sectionStatus,
      usesLMS: enr.courseSection.usesLMS,
      hasScheduledSessions: enr.courseSection.schedules.length > 0,
      sessions,
      exceptions: EMPTY_EXCEPTION_RESULT,
    };
  });

  // Build academic inputs
  const failingScoreInputs: AcaFailingScoreInput[] = enrollments.map((enr) => ({
    studentId,
    termId,
    enrollmentId: enr.enrollmentId,
    courseSectionId: enr.courseSectionId,
    courseName: enr.courseSection.course.courseName,
    ruleVersionId: "",
    evaluationDate,
    assessments: enr.assessmentResults.map((ar) => ({
      id: ar.id,
      assessmentType: ar.assessmentType,
      weight: ar.weight,
      score: ar.score,
      scoreScale: ar.scoreScale,
      resultStatus: ar.resultStatus,
      publishedAt: ar.publishedAt,
    })),
    exceptions: EMPTY_EXCEPTION_RESULT,
  }));

  // Build retake inputs
  const retakeInputs: AcaRetakeInput[] = [];
  for (const enr of enrollments) {
    if (enr.enrollmentType === "RETAKE_FAILED" && enr.attemptNumber >= 3) {
      // Fetch previous attempts for this course
      const previousAttempts = await prisma.enrollment.findMany({
        where: {
          studentId,
          courseSection: { courseId: enr.courseSection.courseId },
          NOT: { enrollmentId: enr.enrollmentId },
        },
        include: { courseSection: { include: { course: true } } },
      });

      retakeInputs.push({
        studentId,
        termId,
        enrollmentId: enr.enrollmentId,
        courseSectionId: enr.courseSectionId,
        courseId: enr.courseSection.courseId,
        courseName: enr.courseSection.course.courseName,
        ruleVersionId: "",
        evaluationDate,
        currentAttemptNumber: enr.attemptNumber,
        currentEnrollmentType: enr.enrollmentType,
        previousAttempts: previousAttempts.map((pa) => ({
          enrollmentId: pa.enrollmentId,
          courseSectionId: pa.courseSectionId,
          courseId: pa.courseSection.courseId,
          courseName: pa.courseSection.course.courseName,
          attemptNumber: pa.attemptNumber,
          enrollmentType: pa.enrollmentType,
          attemptOutcome: pa.attemptOutcome,
        })),
        exceptions: EMPTY_EXCEPTION_RESULT,
      });
    }
  }

  // Build LMS inputs
  const lmsInactivityInputs: LmsInactivityInput[] = enrollments
    .filter((enr) => enr.courseSection.usesLMS)
    .map((enr) => ({
      studentId,
      termId,
      enrollmentId: enr.enrollmentId,
      courseSectionId: enr.courseSectionId,
      courseName: enr.courseSection.course.courseName,
      ruleVersionId: "",
      evaluationDate,
      usesLMS: enr.courseSection.usesLMS,
      activityEvents: enr.lmsActivityEvents.map((e) => ({
        eventId: e.eventId,
        eventType: e.eventType,
        timestamp: e.timestamp,
      })),
      submissions: enr.lmsSubmissions.map((s) => ({
        submissionId: s.submissionId,
        assignmentId: s.assignmentId,
        isLatest: s.isLatest,
        submittedAt: s.submittedAt,
        score: s.score,
      })),
      pastDueAssignments: enr.courseSection.lmsAssignments
        .filter((a) => a.defaultDeadline.getTime() <= evaluationDate.getTime())
        .map((a) => ({
          assignmentId: a.assignmentId,
          title: a.title,
          isRequired: a.isRequired,
          defaultDeadline: a.defaultDeadline,
          sequenceNumber: a.sequenceNumber,
          status: a.status,
          assignmentType: a.assignmentType,
        })),
      exceptions: EMPTY_EXCEPTION_RESULT,
    }));

  const lmsMissedInputs: LmsMissedSubmissionsInput[] = enrollments
    .filter((enr) => enr.courseSection.usesLMS)
    .map((enr) => ({
      studentId,
      termId,
      enrollmentId: enr.enrollmentId,
      courseSectionId: enr.courseSectionId,
      courseName: enr.courseSection.course.courseName,
      ruleVersionId: "",
      evaluationDate,
      assignments: enr.courseSection.lmsAssignments.map((a) => ({
        assignmentId: a.assignmentId,
        title: a.title,
        isRequired: a.isRequired,
        defaultDeadline: a.defaultDeadline,
        sequenceNumber: a.sequenceNumber,
        status: a.status,
        assignmentType: a.assignmentType,
      })),
      submissions: enr.lmsSubmissions.map((s) => ({
        submissionId: s.submissionId,
        assignmentId: s.assignmentId,
        isLatest: s.isLatest,
        submittedAt: s.submittedAt,
        score: s.score,
      })),
      exceptions: EMPTY_EXCEPTION_RESULT,
    }));

  const lmsZeroInputs: LmsConsecutiveZeroInput[] = enrollments
    .filter((enr) => enr.courseSection.usesLMS)
    .map((enr) => ({
      studentId,
      termId,
      enrollmentId: enr.enrollmentId,
      courseSectionId: enr.courseSectionId,
      courseName: enr.courseSection.course.courseName,
      ruleVersionId: "",
      evaluationDate,
      assignments: enr.courseSection.lmsAssignments.map((a) => ({
        assignmentId: a.assignmentId,
        title: a.title,
        isRequired: a.isRequired,
        defaultDeadline: a.defaultDeadline,
        sequenceNumber: a.sequenceNumber,
        status: a.status,
        assignmentType: a.assignmentType,
      })),
      submissions: enr.lmsSubmissions.map((s) => ({
        submissionId: s.submissionId,
        assignmentId: s.assignmentId,
        isLatest: s.isLatest,
        submittedAt: s.submittedAt,
        score: s.score,
      })),
      exceptions: EMPTY_EXCEPTION_RESULT,
    }));

  // Build combined inputs — student-level aggregation
  // Collect last known activity across ALL sources
  const allActivityDates: Date[] = [];
  for (const enr of enrollments) {
    // Attendance PRESENT
    for (const ar of enr.attendanceRecords) {
      if (ar.attendanceStatus === "PRESENT" || ar.attendanceStatus === "LATE") {
        const session = enr.courseSection.schedules.find((s) => s.sessionId === ar.sessionId);
        if (session) allActivityDates.push(session.sessionDate);
      }
    }
    // LMS events
    for (const evt of enr.lmsActivityEvents) {
      allActivityDates.push(evt.timestamp);
    }
    // LMS submissions
    for (const sub of enr.lmsSubmissions) {
      allActivityDates.push(sub.submittedAt);
    }
  }

  const lastKnownActivityDate =
    allActivityDates.length > 0
      ? new Date(Math.max(...allActivityDates.map((d) => d.getTime())))
      : null;

  const disappearanceInput: CombDisappearanceInput = {
    studentId,
    termId,
    ruleVersionId: "",
    evaluationDate,
    exceptions: EMPTY_EXCEPTION_RESULT,
    lastKnownActivityDate,
  };

  // RiskScore inputs — determine DataStatus per group
  const hasAttendanceData = enrollments.some((e) => e.attendanceRecords.length > 0);
  const hasAcademicData = enrollments.some((e) => e.assessmentResults.length > 0);
  const hasLMSData = enrollments.some(
    (e) => e.lmsActivityEvents.length > 0 || e.lmsSubmissions.length > 0
  );
  const anyUsesLMS = enrollments.some((e) => e.courseSection.usesLMS);

  const riskScoreInputs: RiskScoreInput[] = [
    {
      group: "ATTENDANCE",
      weight: 0.35,
      normalizedRisk: computeAttendanceRisk(enrollments, evaluationDate),
      dataStatus: determineDataStatus({
        hasData: hasAttendanceData,
        isApplicable: true,
      }),
    },
    {
      group: "ACADEMIC",
      weight: 0.4,
      normalizedRisk: computeAcademicRisk(enrollments),
      dataStatus: determineDataStatus({
        hasData: hasAcademicData,
        isApplicable: true,
      }),
    },
    {
      group: "LMS",
      weight: 0.25,
      normalizedRisk: computeLMSRisk(enrollments, evaluationDate),
      dataStatus: determineDataStatus({
        hasData: hasLMSData,
        isApplicable: anyUsesLMS,
      }),
    },
  ];

  // Build multi-source signal for HR-COMB-01
  const multiSourceInput: CombMultiSourceInput = {
    studentId,
    termId,
    ruleVersionId: "",
    evaluationDate,
    exceptions: EMPTY_EXCEPTION_RESULT,
    attendanceSignal: hasAttendanceData
      ? {
          hasNegativeSignal: riskScoreInputs[0].normalizedRisk > 0.3,
          absenceRate: riskScoreInputs[0].normalizedRisk,
          details: `Attendance risk: ${riskScoreInputs[0].normalizedRisk.toFixed(2)}`,
        }
      : null,
    academicSignal: hasAcademicData
      ? {
          hasNegativeSignal: riskScoreInputs[1].normalizedRisk > 0.3,
          avgRecentScore: 10 * (1 - riskScoreInputs[1].normalizedRisk),
          details: `Academic risk: ${riskScoreInputs[1].normalizedRisk.toFixed(2)}`,
        }
      : null,
    lmsSignal: hasLMSData
      ? {
          hasNegativeSignal: riskScoreInputs[2].normalizedRisk > 0.3,
          daysSinceLastActivity: lastKnownActivityDate
            ? Math.floor(
                (evaluationDate.getTime() - lastKnownActivityDate.getTime()) / (24 * 60 * 60 * 1000)
              )
            : 999,
          details: `LMS risk: ${riskScoreInputs[2].normalizedRisk.toFixed(2)}`,
        }
      : null,
  };

  // Convert existing alerts to ExistingAlert format
  const existingAlertsFormatted: ExistingAlert[] = existingAlerts.map((a) => ({
    alertId: a.alertId,
    studentId: a.studentId,
    ruleCode: a.ruleTriggers[0]?.ruleCode ?? "",
    scopeId: a.ruleTriggers[0]?.scopeId ?? "",
    termId: a.termId,
    severity: a.severity,
    status: a.status,
    lastDetectedAt: a.lastDetectedAt,
  }));

  return {
    studentId,
    termId,
    advisorId: student.advisorId,
    enrollmentExceptions,
    attendanceInputs,
    multiCourseAttendanceInput,
    noShowStartInputs,
    failingScoreInputs,
    warningInput: null, // TODO: compute from cumulative GPA
    gpaDropInput: null, // TODO: compute from term comparison
    retakeInputs,
    lmsInactivityInputs,
    lmsMissedInputs,
    lmsZeroInputs,
    multiSourceInput,
    disappearanceInput,
    riskScoreInputs,
    existingAlerts: existingAlertsFormatted,
  };
}

// ==========================================
// Risk Component Calculators (simplified)
// ==========================================

function computeAttendanceRisk(
  enrollments: Array<{
    attendanceRecords: Array<{ attendanceStatus: string }>;
    courseSection: { schedules: Array<{ sessionStatus: string; sessionDate: Date }> };
  }>,
  evaluationDate: Date
): number {
  let totalClosed = 0;
  let totalAbsent = 0;

  for (const enr of enrollments) {
    const closedCount = enr.courseSection.schedules.filter(
      (s) => s.sessionStatus === "CLOSED" && s.sessionDate.getTime() <= evaluationDate.getTime()
    ).length;
    const absentCount = enr.attendanceRecords.filter(
      (r) => r.attendanceStatus === "UNEXCUSED_ABSENCE"
    ).length;

    totalClosed += closedCount;
    totalAbsent += absentCount;
  }

  if (totalClosed === 0) return 0;
  return totalAbsent / totalClosed;
}

function computeAcademicRisk(
  enrollments: Array<{
    assessmentResults: Array<{
      score: number | null;
      resultStatus: string;
      weight: number;
    }>;
  }>
): number {
  const finalResults = enrollments.flatMap((e) =>
    e.assessmentResults.filter((a) => a.resultStatus === "FINAL" && a.score !== null)
  );

  if (finalResults.length === 0) return 0;

  // Weighted average score, normalized to 0-1 risk (10-scale assumed)
  const totalWeight = finalResults.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedScore = finalResults.reduce((sum, a) => sum + a.weight * (a.score ?? 0), 0);
  const avgScore = weightedScore / totalWeight;

  // Risk = 1 - (score/10), assuming 10-point scale
  return Math.max(0, Math.min(1, 1 - avgScore / 10));
}

function computeLMSRisk(
  enrollments: Array<{
    courseSection: { usesLMS: boolean };
    lmsActivityEvents: Array<{ timestamp: Date }>;
    lmsSubmissions: Array<{ submittedAt: Date }>;
  }>,
  evaluationDate: Date
): number {
  const lmsEnrollments = enrollments.filter((e) => e.courseSection.usesLMS);
  if (lmsEnrollments.length === 0) return 0;

  // Find last LMS activity across all enrollments
  const allDates: number[] = [];
  for (const enr of lmsEnrollments) {
    for (const e of enr.lmsActivityEvents) allDates.push(e.timestamp.getTime());
    for (const s of enr.lmsSubmissions) allDates.push(s.submittedAt.getTime());
  }

  if (allDates.length === 0) return 1; // No LMS activity = max risk

  const lastActivity = Math.max(...allDates);
  const daysSince = (evaluationDate.getTime() - lastActivity) / (24 * 60 * 60 * 1000);

  // Normalize: 0 days = 0 risk, 14+ days = 1 risk
  return Math.max(0, Math.min(1, daysSince / 14));
}
