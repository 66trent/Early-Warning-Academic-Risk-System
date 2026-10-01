/**
 * Combined Rule Evaluators — HR-COMB-01/02
 * Pure functions — KHÔNG import next/* hoặc gọi Prisma bên trong.
 */

import type { TriggerResult } from "../../validators/rule-engine.schema";
import type { ExceptionResult } from "./exceptions.evaluator";

// ==========================================
// HR-COMB-01 — Tín hiệu tiêu cực đồng thời đa nguồn
// ==========================================

export interface CombMultiSourceInput {
  studentId: string;
  termId: string;
  ruleVersionId: string;
  evaluationDate: Date;
  exceptions: ExceptionResult;

  /**
   * Negative signal indicators per source group.
   * These are pre-computed "risk scores" per group that may not individually
   * trigger their own hard rules but indicate concerning trends.
   */
  attendanceSignal: {
    /** True if there are ANY negative attendance signals in the window */
    hasNegativeSignal: boolean;
    /** Unexcused absence rate across all enrolled courses in the window */
    absenceRate: number;
    details: string;
  } | null;

  academicSignal: {
    hasNegativeSignal: boolean;
    /** Average score across recent assessments (lower = worse) */
    avgRecentScore: number;
    details: string;
  } | null;

  lmsSignal: {
    hasNegativeSignal: boolean;
    /** Days since last LMS activity */
    daysSinceLastActivity: number;
    details: string;
  } | null;
}

export function evaluateMultiSourceNegative(
  input: CombMultiSourceInput,
  condition: {
    windowDays: number;
    minSourceGroups: number;
    attendanceNegativeThreshold: number;
    academicNegativeThreshold: number;
    lmsNegativeThreshold: number;
  }
): TriggerResult | null {
  if (input.exceptions.skipAll) return null;

  let negativeGroups = 0;
  const activeSignals: string[] = [];

  // Check attendance signal
  if (
    input.attendanceSignal &&
    input.attendanceSignal.hasNegativeSignal &&
    input.attendanceSignal.absenceRate >= condition.attendanceNegativeThreshold
  ) {
    negativeGroups++;
    activeSignals.push(
      `Điểm danh: tỷ lệ vắng ${(input.attendanceSignal.absenceRate * 100).toFixed(1)}%`
    );
  }

  // Check academic signal
  if (
    input.academicSignal &&
    input.academicSignal.hasNegativeSignal &&
    input.academicSignal.avgRecentScore <= condition.academicNegativeThreshold
  ) {
    negativeGroups++;
    activeSignals.push(`Học lực: điểm TB ${input.academicSignal.avgRecentScore.toFixed(2)}`);
  }

  // Check LMS signal
  if (
    input.lmsSignal &&
    input.lmsSignal.hasNegativeSignal &&
    input.lmsSignal.daysSinceLastActivity >= condition.lmsNegativeThreshold
  ) {
    negativeGroups++;
    activeSignals.push(`LMS: không hoạt động ${input.lmsSignal.daysSinceLastActivity} ngày`);
  }

  if (negativeGroups < condition.minSourceGroups) return null;

  return {
    ruleCode: "HR-COMB-01",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.studentId, // PER_STUDENT
    termId: input.termId,
    severity: "CRITICAL",
    reason: `Tín hiệu tiêu cực đồng thời ở ${negativeGroups}/3 nguồn: ${activeSignals.join("; ")}`,
    inputSnapshot: {
      ruleCode: "HR-COMB-01",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        negativeGroupCount: negativeGroups,
        minSourceGroups: condition.minSourceGroups,
        windowDays: condition.windowDays,
        attendance: input.attendanceSignal
          ? {
              absenceRate: input.attendanceSignal.absenceRate,
              threshold: condition.attendanceNegativeThreshold,
              triggered:
                input.attendanceSignal.absenceRate >= condition.attendanceNegativeThreshold,
            }
          : null,
        academic: input.academicSignal
          ? {
              avgScore: input.academicSignal.avgRecentScore,
              threshold: condition.academicNegativeThreshold,
              triggered: input.academicSignal.avgRecentScore <= condition.academicNegativeThreshold,
            }
          : null,
        lms: input.lmsSignal
          ? {
              daysSinceLastActivity: input.lmsSignal.daysSinceLastActivity,
              threshold: condition.lmsNegativeThreshold,
              triggered: input.lmsSignal.daysSinceLastActivity >= condition.lmsNegativeThreshold,
            }
          : null,
      },
    },
  };
}

// ==========================================
// HR-COMB-02 — "Biến mất hoàn toàn"
// ==========================================

export interface CombDisappearanceInput {
  studentId: string;
  termId: string;
  ruleVersionId: string;
  evaluationDate: Date;
  exceptions: ExceptionResult;

  /** Date of last known activity of ANY type (attendance PRESENT, LMS event, submission) */
  lastKnownActivityDate: Date | null;
}

export function evaluateCompleteDisappearance(
  input: CombDisappearanceInput,
  condition: { disappearanceDays: number }
): TriggerResult | null {
  if (input.exceptions.skipAll) return null;

  if (!input.lastKnownActivityDate) {
    // No activity ever recorded — need to decide based on context
    // If student has any active enrollment, this is a concern
    return {
      ruleCode: "HR-COMB-02",
      ruleVersionId: input.ruleVersionId,
      studentId: input.studentId,
      scopeId: input.studentId,
      termId: input.termId,
      severity: "CRITICAL",
      reason: `Sinh viên không có BẤT KỲ hoạt động nào được ghi nhận trong kỳ — cần liên hệ khẩn cấp`,
      inputSnapshot: {
        ruleCode: "HR-COMB-02",
        evaluatedAt: input.evaluationDate.toISOString(),
        dataPoints: {
          lastKnownActivityDate: null,
          disappearanceDays: "never_active",
          threshold: condition.disappearanceDays,
          urgentContactRequired: true,
        },
      },
    };
  }

  const daysSinceLastActivity = Math.floor(
    (input.evaluationDate.getTime() - input.lastKnownActivityDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (daysSinceLastActivity < condition.disappearanceDays) return null;

  return {
    ruleCode: "HR-COMB-02",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.studentId,
    termId: input.termId,
    severity: "CRITICAL",
    reason: `Sinh viên "biến mất" ${daysSinceLastActivity} ngày — không có hoạt động nào (điểm danh, LMS, nộp bài) — cần liên hệ khẩn cấp`,
    inputSnapshot: {
      ruleCode: "HR-COMB-02",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        lastKnownActivityDate: input.lastKnownActivityDate.toISOString(),
        daysSinceLastActivity,
        threshold: condition.disappearanceDays,
        urgentContactRequired: true,
      },
    },
  };
}
