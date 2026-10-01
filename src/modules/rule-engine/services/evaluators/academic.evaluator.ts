/**
 * Academic Rule Evaluators — HR-ACA-01/02/03/04
 * Pure functions — KHÔNG import next/* hoặc gọi Prisma bên trong.
 */

import type { TriggerResult } from "../../validators/rule-engine.schema";
import type { ExceptionResult } from "./exceptions.evaluator";

// ==========================================
// Shared Types for Academic Data
// ==========================================

export interface AssessmentData {
  id: string;
  assessmentType: string;
  weight: number;
  score: number | null;
  scoreScale: string;
  resultStatus: string; // DRAFT | FINAL | UNDER_APPEAL | EXEMPT | WAIVED
  publishedAt: Date | null;
}

export interface EnrollmentAttemptData {
  enrollmentId: string;
  courseSectionId: string;
  courseId: string;
  courseName: string;
  attemptNumber: number;
  enrollmentType: string;
  attemptOutcome: string | null;
}

export interface TermGPAData {
  termId: string;
  gpa: number;
  totalCredits: number;
  isComplete: boolean; // All assessments finalized
}

// ==========================================
// HR-ACA-01 — Điểm 0/liệt ở đánh giá quan trọng
// ==========================================

export interface AcaFailingScoreInput {
  studentId: string;
  termId: string;
  enrollmentId: string;
  courseSectionId: string;
  courseName: string;
  ruleVersionId: string;
  evaluationDate: Date;
  assessments: AssessmentData[];
  exceptions: ExceptionResult;
}

export function evaluateFailingScore(
  input: AcaFailingScoreInput,
  condition: {
    minimumAssessmentWeight: number;
    failingScore: number;
  }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-ACA-01")) return null;

  // Filter: only FINAL results, non-null score, weight >= threshold
  // Temporal leakage: only assessments published at or before evaluation date
  const eligibleAssessments = input.assessments.filter(
    (a) =>
      a.resultStatus === "FINAL" &&
      a.score !== null &&
      a.weight >= condition.minimumAssessmentWeight &&
      (a.publishedAt === null || a.publishedAt.getTime() <= input.evaluationDate.getTime())
  );

  // Find failing assessments
  const failingAssessments = eligibleAssessments.filter((a) => a.score! <= condition.failingScore);

  if (failingAssessments.length === 0) return null;

  // Report the first (or worst) failing assessment
  const worst = failingAssessments[0];

  return {
    ruleCode: "HR-ACA-01",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.courseSectionId,
    termId: input.termId,
    severity: worst.weight >= 0.5 ? "HIGH" : "MEDIUM",
    reason: `Sinh viên đạt điểm ${worst.score} (≤${condition.failingScore}) ở bài ${worst.assessmentType} (trọng số ${(worst.weight * 100).toFixed(0)}%) tại ${input.courseName}`,
    inputSnapshot: {
      ruleCode: "HR-ACA-01",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        failingAssessments: failingAssessments.map((a) => ({
          id: a.id,
          assessmentType: a.assessmentType,
          weight: a.weight,
          score: a.score,
        })),
        minimumAssessmentWeight: condition.minimumAssessmentWeight,
        failingScore: condition.failingScore,
        courseSectionId: input.courseSectionId,
        courseName: input.courseName,
      },
    },
  };
}

// ==========================================
// HR-ACA-02 — Cảnh báo học vụ (tiệm cận ngưỡng)
// ==========================================

export interface AcaWarningInput {
  studentId: string;
  termId: string;
  ruleVersionId: string;
  evaluationDate: Date;
  currentCumulativeGPA: number | null;
  currentTermGPA: number | null;
  cumulativeCredits: number;
  exceptions: ExceptionResult;
}

export function evaluateAcademicWarning(
  input: AcaWarningInput,
  condition: {
    gpaWarningThreshold: number;
    cumulativeCreditsMin: number;
  }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-ACA-02")) return null;

  // Need at least cumulative credits to evaluate
  if (input.cumulativeCredits < condition.cumulativeCreditsMin) return null;

  const gpaToCheck = input.currentCumulativeGPA ?? input.currentTermGPA;
  if (gpaToCheck === null) return null;

  if (gpaToCheck > condition.gpaWarningThreshold) return null;

  return {
    ruleCode: "HR-ACA-02",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.studentId, // PER_STUDENT
    termId: input.termId,
    severity: "CRITICAL",
    reason: `GPA tích lũy ${gpaToCheck.toFixed(2)} tiệm cận ngưỡng buộc thôi học (${condition.gpaWarningThreshold})`,
    inputSnapshot: {
      ruleCode: "HR-ACA-02",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        cumulativeGPA: input.currentCumulativeGPA,
        termGPA: input.currentTermGPA,
        gpaWarningThreshold: condition.gpaWarningThreshold,
        cumulativeCredits: input.cumulativeCredits,
      },
    },
  };
}

// ==========================================
// HR-ACA-03 — Sụt giảm GPA đột ngột
// ==========================================

export interface AcaGpaDropInput {
  studentId: string;
  termId: string;
  ruleVersionId: string;
  evaluationDate: Date;
  currentTermGPA: TermGPAData | null;
  previousTermGPA: TermGPAData | null;
  /** In-term average score for current assessments (for early warning within term) */
  currentInTermAvgScore: number | null;
  /** In-term average score for same period in previous term */
  previousInTermAvgScore: number | null;
  exceptions: ExceptionResult;
}

export function evaluateGpaDrop(
  input: AcaGpaDropInput,
  condition: {
    gpaDropThreshold: number;
    minCreditsPerTerm: number;
    inTermScoreDropThreshold: number;
  }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-ACA-03")) return null;

  // Try end-of-term GPA comparison first
  if (
    input.currentTermGPA &&
    input.previousTermGPA &&
    input.currentTermGPA.isComplete &&
    input.previousTermGPA.isComplete &&
    input.currentTermGPA.totalCredits >= condition.minCreditsPerTerm &&
    input.previousTermGPA.totalCredits >= condition.minCreditsPerTerm
  ) {
    const gpaDrop = input.previousTermGPA.gpa - input.currentTermGPA.gpa;
    if (gpaDrop >= condition.gpaDropThreshold) {
      return {
        ruleCode: "HR-ACA-03",
        ruleVersionId: input.ruleVersionId,
        studentId: input.studentId,
        scopeId: input.studentId,
        termId: input.termId,
        severity: "MEDIUM",
        reason: `GPA giảm ${gpaDrop.toFixed(2)} điểm so với kỳ trước (${input.previousTermGPA.gpa.toFixed(2)} → ${input.currentTermGPA.gpa.toFixed(2)})`,
        inputSnapshot: {
          ruleCode: "HR-ACA-03",
          evaluatedAt: input.evaluationDate.toISOString(),
          dataPoints: {
            currentTermGPA: input.currentTermGPA.gpa,
            previousTermGPA: input.previousTermGPA.gpa,
            gpaDrop,
            gpaDropThreshold: condition.gpaDropThreshold,
            currentCredits: input.currentTermGPA.totalCredits,
            previousCredits: input.previousTermGPA.totalCredits,
          },
        },
      };
    }
    return null;
  }

  // In-term early warning variant: average scores comparison
  if (input.currentInTermAvgScore !== null && input.previousInTermAvgScore !== null) {
    const scoreDrop = input.previousInTermAvgScore - input.currentInTermAvgScore;
    if (scoreDrop >= condition.inTermScoreDropThreshold) {
      return {
        ruleCode: "HR-ACA-03",
        ruleVersionId: input.ruleVersionId,
        studentId: input.studentId,
        scopeId: input.studentId,
        termId: input.termId,
        severity: "MEDIUM",
        reason: `Điểm trung bình các bài đánh giá trong kỳ giảm ${scoreDrop.toFixed(2)} so với cùng giai đoạn kỳ trước`,
        inputSnapshot: {
          ruleCode: "HR-ACA-03",
          evaluatedAt: input.evaluationDate.toISOString(),
          dataPoints: {
            currentInTermAvgScore: input.currentInTermAvgScore,
            previousInTermAvgScore: input.previousInTermAvgScore,
            scoreDrop,
            inTermScoreDropThreshold: condition.inTermScoreDropThreshold,
            variant: "in-term",
          },
        },
      };
    }
  }

  return null;
}

// ==========================================
// HR-ACA-04 — Học lại ≥3 lần do rớt
// ==========================================

export interface AcaRetakeInput {
  studentId: string;
  termId: string;
  enrollmentId: string;
  courseSectionId: string;
  courseId: string;
  courseName: string;
  ruleVersionId: string;
  evaluationDate: Date;
  currentAttemptNumber: number;
  currentEnrollmentType: string;
  previousAttempts: EnrollmentAttemptData[];
  exceptions: ExceptionResult;
}

export function evaluateRetake(
  input: AcaRetakeInput,
  condition: { maxRetakeAttempts: number }
): TriggerResult | null {
  if (input.exceptions.skipRules.has("HR-ACA-04")) return null;

  // Only count RETAKE_FAILED enrollments
  if (input.currentEnrollmentType !== "RETAKE_FAILED") return null;

  // Count previous FAILED attempts (not WITHDRAWN, not improvement, not curriculum change)
  const failedAttempts = input.previousAttempts.filter(
    (a) => a.attemptOutcome === "FAILED" && a.enrollmentType === "RETAKE_FAILED"
  );

  // Current attempt is also RETAKE_FAILED, so total = failedAttempts.length + 1
  // But we check attemptNumber which already reflects the total
  if (input.currentAttemptNumber < condition.maxRetakeAttempts) return null;

  return {
    ruleCode: "HR-ACA-04",
    ruleVersionId: input.ruleVersionId,
    studentId: input.studentId,
    scopeId: input.courseSectionId,
    termId: input.termId,
    severity: "MEDIUM",
    reason: `Sinh viên đang học lại lần ${input.currentAttemptNumber} môn ${input.courseName} do rớt các lần trước`,
    inputSnapshot: {
      ruleCode: "HR-ACA-04",
      evaluatedAt: input.evaluationDate.toISOString(),
      dataPoints: {
        attemptNumber: input.currentAttemptNumber,
        maxRetakeAttempts: condition.maxRetakeAttempts,
        courseId: input.courseId,
        courseName: input.courseName,
        failedAttemptCount: failedAttempts.length,
        previousAttempts: failedAttempts.map((a) => ({
          enrollmentId: a.enrollmentId,
          attemptNumber: a.attemptNumber,
          outcome: a.attemptOutcome,
        })),
      },
    },
  };
}
