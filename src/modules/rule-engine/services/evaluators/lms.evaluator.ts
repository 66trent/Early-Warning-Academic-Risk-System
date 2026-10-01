/**
 * LMS Rule Evaluators — HR-LMS-01/02/03
 * Pure functions — KHÔNG import next/* hoặc gọi Prisma bên trong.
 */

import type { TriggerResult } from "../../validators/rule-engine.schema";
import type { ExceptionResult } from "./exceptions.evaluator";

// ==========================================
// Shared Types for LMS Data
// ==========================================

export interface LMSAssignmentData {
  assignmentId: string;
  title: string;
  isRequired: boolean;
  defaultDeadline: Date;
  sequenceNumber: number;
  status: string; // DRAFT | PUBLISHED | CANCELLED
  assignmentType: string;
}

export interface LMSSubmissionData {
  submissionId: string;
  assignmentId: string;
  isLatest: boolean;
  submittedAt: Date;
  score: number | null;
}

export interface LMSActivityData {
  eventId: string;
  eventType: string;
  timestamp: Date;
}

// ==========================================
// HR-LMS-01 — Không hoạt động LMS kéo dài
// ==========================================

export interface LmsInactivityInput {
  studentId: string;
  termId: string;
  enrollmentId: string;
  courseSectionId: string;
  courseName: string;
  ruleVersionId: string;
  evaluationDate: Date;
  usesLMS: boolean;
  /** All LMS activity events for this enrollment */
  activityEvents: LMSActivityData[];
  /** All submissions for this enrollment */
  submissions: LMSSubmissionData[];
  /** Assignments with deadlines that have passed */
  pastDueAssignments: LMSAssignmentData[];
  exceptions: ExceptionResult;
}

export function evaluateLmsInactivity(
  input: LmsInactivityInput,
  condition: {
    mediumDaysMin: number;
    mediumDaysMax: number;
    highDaysMin: number;
    highDaysMax: number;
    criticalDaysMin: number;
  }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-LMS-01")) return null;
  if (!input.usesLMS) return null;

  // Combine all meaningful activities: events + submissions
  const allActivityDates: Date[] = [
    ...input.activityEvents
      .filter((e) => e.timestamp.getTime() <= input.evaluationDate.getTime())
      .map((e) => e.timestamp),
    ...input.submissions
      .filter((s) => s.submittedAt.getTime() <= input.evaluationDate.getTime())
      .map((s) => s.submittedAt),
  ];

  if (allActivityDates.length === 0) {
    // No activity at all — treat as maximum inactivity from term start
    // But we need at least some published assignments to trigger
    if (input.pastDueAssignments.length === 0) return null;
  }

  // Find last activity date
  const lastActivityDate =
    allActivityDates.length > 0
      ? new Date(Math.max(...allActivityDates.map((d) => d.getTime())))
      : null;

  // Calculate days of inactivity
  const daysSinceLastActivity = lastActivityDate
    ? Math.floor(
        (input.evaluationDate.getTime() - lastActivityDate.getTime()) / (24 * 60 * 60 * 1000)
      )
    : Infinity; // No activity ever recorded

  // Determine severity based on tiered thresholds (MUST use branching, not ranges)
  let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null = null;

  if (daysSinceLastActivity >= condition.criticalDaysMin) {
    // ≥14 days AND missed at least 1 deadline → CRITICAL
    const hasMissedDeadline = input.pastDueAssignments.some((a) => {
      // Check if there's no submission for this assignment
      const effectiveDeadline = getEffectiveDeadline(a, input.studentId, input.exceptions);
      if (effectiveDeadline === null) return false; // exempt
      return (
        effectiveDeadline.getTime() <= input.evaluationDate.getTime() &&
        !input.submissions.some((s) => s.assignmentId === a.assignmentId && s.isLatest)
      );
    });
    severity = hasMissedDeadline ? "CRITICAL" : "HIGH";
  } else if (
    daysSinceLastActivity >= condition.highDaysMin &&
    daysSinceLastActivity <= condition.highDaysMax
  ) {
    severity = "HIGH";
  } else if (
    daysSinceLastActivity >= condition.mediumDaysMin &&
    daysSinceLastActivity <= condition.mediumDaysMax
  ) {
    severity = "MEDIUM";
  }

  if (!severity) return null;

  return {
    ruleCode: "HR-LMS-01",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.courseSectionId,
    termId: input.termId,
    severity,
    reason: `Sinh viên không có hoạt động LMS trong ${daysSinceLastActivity === Infinity ? "toàn bộ kỳ" : `${daysSinceLastActivity} ngày`} tại ${input.courseName}`,
    inputSnapshot: {
      ruleCode: "HR-LMS-01",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        daysSinceLastActivity: daysSinceLastActivity === Infinity ? "never" : daysSinceLastActivity,
        lastActivityDate: lastActivityDate?.toISOString() ?? null,
        courseSectionId: input.courseSectionId,
        courseName: input.courseName,
      },
    },
  };
}

// ==========================================
// HR-LMS-02 — Bỏ nộp bài bắt buộc liên tiếp
// ==========================================

export interface LmsMissedSubmissionsInput {
  studentId: string;
  termId: string;
  enrollmentId: string;
  courseSectionId: string;
  courseName: string;
  ruleVersionId: string;
  evaluationDate: Date;
  /** All assignments for this course section, sorted by sequenceNumber */
  assignments: LMSAssignmentData[];
  /** All submissions for this enrollment */
  submissions: LMSSubmissionData[];
  exceptions: ExceptionResult;
}

export function evaluateMissedSubmissions(
  input: LmsMissedSubmissionsInput,
  condition: { consecutiveMissedThreshold: number }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-LMS-02")) return null;

  // Filter: required, published, not cancelled, deadline has passed
  const eligibleAssignments = input.assignments
    .filter((a) => {
      if (!a.isRequired) return false;
      if (a.status === "CANCELLED") return false;

      // Check exemption
      if (input.exceptions.exemptAssignmentIds.has(a.assignmentId)) return false;

      // Check effective deadline
      const effectiveDeadline = getEffectiveDeadline(a, input.studentId, input.exceptions);
      if (effectiveDeadline === null) return false;
      return effectiveDeadline.getTime() <= input.evaluationDate.getTime();
    })
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  if (eligibleAssignments.length < condition.consecutiveMissedThreshold) return null;

  // Find consecutive missed submissions
  let maxStreak = 0;
  let currentStreak = 0;
  let streakAssignments: LMSAssignmentData[] = [];
  let maxStreakAssignments: LMSAssignmentData[] = [];

  for (const assignment of eligibleAssignments) {
    const hasSubmission = input.submissions.some((s) => s.assignmentId === assignment.assignmentId);

    if (!hasSubmission) {
      currentStreak++;
      streakAssignments.push(assignment);
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        maxStreakAssignments = [...streakAssignments];
      }
    } else {
      currentStreak = 0;
      streakAssignments = [];
    }
  }

  if (maxStreak < condition.consecutiveMissedThreshold) return null;

  return {
    ruleCode: "HR-LMS-02",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.courseSectionId,
    termId: input.termId,
    severity: maxStreak >= 3 ? "HIGH" : "MEDIUM",
    reason: `Sinh viên bỏ nộp ${maxStreak} bài bắt buộc liên tiếp tại ${input.courseName}`,
    inputSnapshot: {
      ruleCode: "HR-LMS-02",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        consecutiveMissed: maxStreak,
        threshold: condition.consecutiveMissedThreshold,
        courseSectionId: input.courseSectionId,
        courseName: input.courseName,
        missedAssignments: maxStreakAssignments.map((a) => ({
          assignmentId: a.assignmentId,
          title: a.title,
          sequenceNumber: a.sequenceNumber,
        })),
      },
    },
  };
}

// ==========================================
// HR-LMS-03 — Hai điểm liệt liên tiếp ở bài tự chấm
// ==========================================

export interface LmsConsecutiveZeroInput {
  studentId: string;
  termId: string;
  enrollmentId: string;
  courseSectionId: string;
  courseName: string;
  ruleVersionId: string;
  evaluationDate: Date;
  assignments: LMSAssignmentData[];
  submissions: LMSSubmissionData[];
  exceptions: ExceptionResult;
}

export function evaluateConsecutiveZeroScores(
  input: LmsConsecutiveZeroInput,
  condition: {
    consecutiveZeroThreshold: number;
    failingScore: number;
  }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-LMS-03")) return null;

  // Sort assignments by sequence
  const sortedAssignments = [...input.assignments]
    .filter((a) => a.status !== "CANCELLED")
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  let maxStreak = 0;
  let currentStreak = 0;
  let streakSubmissions: Array<{ assignment: LMSAssignmentData; submission: LMSSubmissionData }> =
    [];
  let maxStreakSubmissions: Array<{
    assignment: LMSAssignmentData;
    submission: LMSSubmissionData;
  }> = [];

  for (const assignment of sortedAssignments) {
    // Check exemption
    if (input.exceptions.exemptAssignmentIds.has(assignment.assignmentId)) {
      currentStreak = 0;
      streakSubmissions = [];
      continue;
    }

    // Find latest submission for this assignment, submitted before evaluation date
    const latestSubmission = input.submissions.find(
      (s) =>
        s.assignmentId === assignment.assignmentId &&
        s.isLatest &&
        s.score !== null &&
        s.submittedAt.getTime() <= input.evaluationDate.getTime()
    );

    if (!latestSubmission) {
      // No submission or not graded yet — reset streak
      currentStreak = 0;
      streakSubmissions = [];
      continue;
    }

    if (latestSubmission.score! <= condition.failingScore) {
      currentStreak++;
      streakSubmissions.push({ assignment, submission: latestSubmission });
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        maxStreakSubmissions = [...streakSubmissions];
      }
    } else {
      currentStreak = 0;
      streakSubmissions = [];
    }
  }

  if (maxStreak < condition.consecutiveZeroThreshold) return null;

  return {
    ruleCode: "HR-LMS-03",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.courseSectionId,
    termId: input.termId,
    severity: "MEDIUM",
    reason: `Sinh viên đạt điểm liệt (≤${condition.failingScore}) ở ${maxStreak} bài tự chấm liên tiếp tại ${input.courseName}`,
    inputSnapshot: {
      ruleCode: "HR-LMS-03",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        consecutiveZeros: maxStreak,
        threshold: condition.consecutiveZeroThreshold,
        failingScore: condition.failingScore,
        courseSectionId: input.courseSectionId,
        courseName: input.courseName,
        submissions: maxStreakSubmissions.map((item) => ({
          assignmentId: item.assignment.assignmentId,
          title: item.assignment.title,
          sequenceNumber: item.assignment.sequenceNumber,
          score: item.submission.score,
        })),
      },
    },
  };
}

// ==========================================
// Helper: Get effective deadline considering extensions
// ==========================================

function getEffectiveDeadline(
  assignment: LMSAssignmentData,
  studentId: string,
  exceptions: ExceptionResult
): Date | null {
  // If assignment is exempt, return null (skip)
  if (exceptions.exemptAssignmentIds.has(assignment.assignmentId)) {
    return null;
  }

  // Check for student-specific or class-wide extension
  const extendedDeadline = exceptions.extendedDeadlines.get(assignment.assignmentId);
  if (extendedDeadline) {
    return extendedDeadline;
  }

  return assignment.defaultDeadline;
}
