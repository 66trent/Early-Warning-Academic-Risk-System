/**
 * Rule Engine Orchestrator — 10-Step Pipeline
 *
 * Trình tự xử lý bắt buộc theo 08-business-rules-catalog.md.
 * Đây là hàm quan trọng nhất dự án — pipeline rõ ràng từng bước, dễ trace log.
 *
 * Hàm nhận dữ liệu đã được fetch sẵn từ tầng action/worker,
 * KHÔNG tự gọi Prisma — đảm bảo chạy được trong worker container.
 */

import type { TriggerResult, EvaluationContext } from "../validators/rule-engine.schema";
import { validateCondition } from "../validators/rule-engine.schema";
import {
  evaluateExceptions,
  type ExceptionInput,
  type ExceptionResult,
} from "./evaluators/exceptions.evaluator";
import {
  evaluateConsecutiveAbsence,
  evaluateExamBanThreshold,
  evaluateMultiCourseAbsence,
  evaluateNoShowStart,
} from "./evaluators/attendance.evaluator";
import type {
  AttendanceEvalInput,
  MultiCourseAttendanceInput,
  NoShowStartInput,
} from "./evaluators/attendance.evaluator";
import {
  evaluateFailingScore,
  evaluateAcademicWarning,
  evaluateGpaDrop,
  evaluateRetake,
} from "./evaluators/academic.evaluator";
import type {
  AcaFailingScoreInput,
  AcaWarningInput,
  AcaGpaDropInput,
  AcaRetakeInput,
} from "./evaluators/academic.evaluator";
import {
  evaluateLmsInactivity,
  evaluateMissedSubmissions,
  evaluateConsecutiveZeroScores,
} from "./evaluators/lms.evaluator";
import type {
  LmsInactivityInput,
  LmsMissedSubmissionsInput,
  LmsConsecutiveZeroInput,
} from "./evaluators/lms.evaluator";
import {
  evaluateMultiSourceNegative,
  evaluateCompleteDisappearance,
} from "./evaluators/combined.evaluator";
import type { CombMultiSourceInput, CombDisappearanceInput } from "./evaluators/combined.evaluator";
import { calculateRiskScore, type RiskScoreResult } from "./risk-score.service";
import type { RiskScoreInput } from "../validators/rule-engine.schema";

// ==========================================
// Pipeline Input/Output Types
// ==========================================

/** Active rule version to evaluate */
export interface ActiveRuleVersion {
  id: string;
  ruleCode: string;
  version: number;
  condition: Record<string, unknown>;
  severity: string;
  action: Record<string, unknown>;
  ruleGroup: string;
  scope: string;
  cooldown: number;
}

/** Existing open alert for correlation key check */
export interface ExistingAlert {
  alertId: string;
  studentId: string;
  ruleCode: string;
  scopeId: string;
  termId: string;
  severity: string;
  status: string;
  lastDetectedAt: Date;
}

/** Full student evaluation data bundle */
export interface StudentEvaluationData {
  studentId: string;
  termId: string;
  advisorId: string;

  /** Exception input data (pre-fetched per enrollment) */
  enrollmentExceptions: ExceptionInput[];

  /** Attendance data per enrollment */
  attendanceInputs: AttendanceEvalInput[];

  /** Multi-course attendance data (student-level) */
  multiCourseAttendanceInput: MultiCourseAttendanceInput | null;

  /** No-show start inputs */
  noShowStartInputs: NoShowStartInput[];

  /** Academic inputs */
  failingScoreInputs: AcaFailingScoreInput[];
  warningInput: AcaWarningInput | null;
  gpaDropInput: AcaGpaDropInput | null;
  retakeInputs: AcaRetakeInput[];

  /** LMS inputs */
  lmsInactivityInputs: LmsInactivityInput[];
  lmsMissedInputs: LmsMissedSubmissionsInput[];
  lmsZeroInputs: LmsConsecutiveZeroInput[];

  /** Combined inputs */
  multiSourceInput: CombMultiSourceInput | null;
  disappearanceInput: CombDisappearanceInput | null;

  /** RiskScore inputs per group */
  riskScoreInputs: RiskScoreInput[];

  /** Existing open alerts for this student/term */
  existingAlerts: ExistingAlert[];
}

export interface PipelineResult {
  studentId: string;
  termId: string;

  /** Step results for logging/debugging */
  steps: StepResult[];

  /** Triggers generated (empty if dry-run and no triggers) */
  triggers: TriggerResult[];

  /** RiskScore result */
  riskScore: RiskScoreResult | null;

  /** Alerts to create or update */
  alertActions: AlertAction[];

  /** Whether this was a dry-run */
  dryRun: boolean;
}

export interface StepResult {
  step: number;
  name: string;
  status: "ok" | "skipped" | "triggered";
  details: string;
  durationMs: number;
}

export interface AlertAction {
  type: "CREATE" | "UPDATE";
  correlationKey: string;
  studentId: string;
  termId: string;
  ruleCode: string;
  scopeId: string;
  severity: string;
  triggers: TriggerResult[];
  existingAlertId?: string;
  assignedAdvisorId: string;
  riskScoreLogId?: string;
}

// ==========================================
// Main Pipeline
// ==========================================

/**
 * Execute the 10-step Rule Engine pipeline for a single student.
 * Returns all generated triggers and alert actions without writing to DB.
 * The caller (action/worker) is responsible for persisting results.
 */
export function executeRuleEnginePipeline(
  data: StudentEvaluationData,
  activeRuleVersions: ActiveRuleVersion[],
  context: EvaluationContext
): PipelineResult {
  const steps: StepResult[] = [];
  const allTriggers: TriggerResult[] = [];
  let riskScore: RiskScoreResult | null = null;

  // ────────────────────────────────────────
  // STEP 1: Kiểm tra dữ liệu hợp lệ (loại bỏ INVALID)
  // ────────────────────────────────────────
  const step1Start = Date.now();
  // Data validation is done upstream by data-import module.
  // Here we just note that we're operating on validated data.
  steps.push({
    step: 1,
    name: "Validate Data",
    status: "ok",
    details: `Processing student ${data.studentId} for term ${data.termId}`,
    durationMs: Date.now() - step1Start,
  });

  // ────────────────────────────────────────
  // STEP 2: Kiểm tra phạm vi đối tượng (REGISTERED only)
  // ────────────────────────────────────────
  const step2Start = Date.now();
  // Enrollment filtering is done upstream when fetching data.
  // Only REGISTERED enrollments are included in the input data.
  steps.push({
    step: 2,
    name: "Check Enrollment Scope",
    status: "ok",
    details: `${data.enrollmentExceptions.length} active enrollment(s)`,
    durationMs: Date.now() - step2Start,
  });

  // ────────────────────────────────────────
  // STEP 3: Áp dụng ngoại lệ (HR-EXC) — MUST chạy TRƯỚC mọi tính toán
  // ────────────────────────────────────────
  const step3Start = Date.now();
  const exceptionResults = new Map<string, ExceptionResult>();

  for (const excInput of data.enrollmentExceptions) {
    const result = evaluateExceptions(excInput);
    exceptionResults.set(excInput.enrollmentId, result);
  }

  // Update all input data with exception results
  applyExceptionsToInputs(data, exceptionResults);

  const skippedEnrollments = Array.from(exceptionResults.values()).filter((r) => r.skipAll).length;
  const totalExceptionReasons = Array.from(exceptionResults.values()).reduce(
    (sum, r) => sum + r.reasons.length,
    0
  );

  steps.push({
    step: 3,
    name: "Apply Exceptions (HR-EXC)",
    status: skippedEnrollments > 0 ? "triggered" : "ok",
    details: `${skippedEnrollments} enrollment(s) fully skipped, ${totalExceptionReasons} exception reason(s)`,
    durationMs: Date.now() - step3Start,
  });

  // ────────────────────────────────────────
  // STEP 4: Tính chỉ số thành phần theo DataStatus
  // ────────────────────────────────────────
  const step4Start = Date.now();
  // Component indicators are pre-computed in the input data (riskScoreInputs)
  steps.push({
    step: 4,
    name: "Calculate Component Indicators",
    status: "ok",
    details: `${data.riskScoreInputs.length} indicator group(s)`,
    durationMs: Date.now() - step4Start,
  });

  // ────────────────────────────────────────
  // STEP 5: Tính RiskScore
  // ────────────────────────────────────────
  const step5Start = Date.now();
  riskScore = calculateRiskScore(data.riskScoreInputs);
  steps.push({
    step: 5,
    name: "Calculate RiskScore",
    status: "ok",
    details: `score=${riskScore.riskScoreValue?.toFixed(3) ?? "NULL"}, completeness=${riskScore.dataCompletenessLevel}`,
    durationMs: Date.now() - step5Start,
  });

  // ────────────────────────────────────────
  // STEP 6: Chạy 13 luật kích hoạt cứng (hard-trigger)
  // ────────────────────────────────────────
  const step6Start = Date.now();

  for (const rv of activeRuleVersions) {
    try {
      const parsedCondition = validateCondition(rv.ruleCode, rv.condition);
      const triggers = evaluateRule(rv.ruleCode, parsedCondition, data, rv.id);
      allTriggers.push(...triggers);
    } catch (err) {
      console.error(`[rule-engine] Error evaluating ${rv.ruleCode} v${rv.version}:`, err);
    }
  }

  steps.push({
    step: 6,
    name: "Run Hard-Trigger Rules",
    status: allTriggers.length > 0 ? "triggered" : "ok",
    details: `${allTriggers.length} trigger(s) from ${activeRuleVersions.length} active rule version(s)`,
    durationMs: Date.now() - step6Start,
  });

  // ────────────────────────────────────────
  // STEP 7: Gộp nguyên nhân theo khóa tương quan + cooldown
  // ────────────────────────────────────────
  const step7Start = Date.now();
  const correlatedGroups = groupTriggersByCorrelation(allTriggers);
  steps.push({
    step: 7,
    name: "Merge Triggers by Correlation Key",
    status: "ok",
    details: `${allTriggers.length} trigger(s) → ${correlatedGroups.size} correlation group(s)`,
    durationMs: Date.now() - step7Start,
  });

  // ────────────────────────────────────────
  // STEP 8: Xác định severity cuối cùng = max(severity)
  // ────────────────────────────────────────
  const step8Start = Date.now();
  const alertActions: AlertAction[] = [];
  const severityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

  for (const [correlationKey, triggers] of correlatedGroups) {
    const maxSeverity = triggers.reduce((max, t) => {
      const tOrder = severityOrder[t.severity as keyof typeof severityOrder] ?? 0;
      const maxOrder = severityOrder[max as keyof typeof severityOrder] ?? 0;
      return tOrder > maxOrder ? t.severity : max;
    }, "LOW" as string);

    // Parse correlation key
    const [studentId, ruleCode, scopeId, termId] = correlationKey.split("|");

    // Check existing alerts for this correlation key
    const existingAlert = data.existingAlerts.find(
      (a) =>
        a.studentId === studentId &&
        a.ruleCode === ruleCode &&
        a.scopeId === scopeId &&
        a.termId === termId &&
        isAlertOpen(a.status)
    );

    // Check cooldown
    const ruleVersion = activeRuleVersions.find((rv) => rv.ruleCode === ruleCode);
    const cooldownHours = ruleVersion?.cooldown ?? 24;

    if (existingAlert) {
      const hoursSinceLastDetected =
        (context.evaluationDate.getTime() - existingAlert.lastDetectedAt.getTime()) /
        (1000 * 60 * 60);

      if (hoursSinceLastDetected < cooldownHours) {
        // Within cooldown — update existing alert
        alertActions.push({
          type: "UPDATE",
          correlationKey,
          studentId,
          termId,
          ruleCode,
          scopeId,
          severity: maxSeverity,
          triggers,
          existingAlertId: existingAlert.alertId,
          assignedAdvisorId: data.advisorId,
        });
        continue;
      }
    }

    // No existing open alert or outside cooldown → CREATE
    alertActions.push({
      type: existingAlert ? "UPDATE" : "CREATE",
      correlationKey,
      studentId,
      termId,
      ruleCode,
      scopeId,
      severity: maxSeverity,
      triggers,
      existingAlertId: existingAlert?.alertId,
      assignedAdvisorId: data.advisorId,
    });
  }

  steps.push({
    step: 8,
    name: "Determine Alert Severity",
    status: alertActions.length > 0 ? "triggered" : "ok",
    details: `${alertActions.length} alert action(s): ${alertActions.filter((a) => a.type === "CREATE").length} create, ${alertActions.filter((a) => a.type === "UPDATE").length} update`,
    durationMs: Date.now() - step8Start,
  });

  // ────────────────────────────────────────
  // STEP 9: Tạo/cập nhật Alert (isReferenceOnly = true)
  // ────────────────────────────────────────
  const step9Start = Date.now();
  // In dry-run mode, we skip actual DB writes but still return the actions
  // Actual persistence is handled by the caller
  steps.push({
    step: 9,
    name: context.dryRun ? "Create/Update Alert (DRY RUN — no DB write)" : "Create/Update Alert",
    status: alertActions.length > 0 ? "triggered" : "ok",
    details: context.dryRun
      ? `DRY RUN: ${alertActions.length} alert(s) would be created/updated`
      : `${alertActions.length} alert(s) to persist`,
    durationMs: Date.now() - step9Start,
  });

  // ────────────────────────────────────────
  // STEP 10: Gửi thông báo (dedup policy)
  // ────────────────────────────────────────
  const step10Start = Date.now();
  // Notification dispatching is handled by the caller via send-notifications queue
  steps.push({
    step: 10,
    name: context.dryRun ? "Queue Notifications (DRY RUN — skipped)" : "Queue Notifications",
    status: context.dryRun ? "skipped" : alertActions.length > 0 ? "triggered" : "ok",
    details: context.dryRun
      ? "Skipped in dry-run mode"
      : `${alertActions.length} notification(s) to queue`,
    durationMs: Date.now() - step10Start,
  });

  return {
    studentId: data.studentId,
    termId: data.termId,
    steps,
    triggers: allTriggers,
    riskScore,
    alertActions,
    dryRun: context.dryRun,
  };
}

// ==========================================
// Internal Helpers
// ==========================================

function evaluateRule(
  ruleCode: string,
  condition: unknown,
  data: StudentEvaluationData,
  ruleVersionId: string
): TriggerResult[] {
  const triggers: TriggerResult[] = [];

  switch (ruleCode) {
    // ATTENDANCE
    case "HR-ATT-01":
      for (const input of data.attendanceInputs) {
        const result = evaluateConsecutiveAbsence(
          { ...input, ruleVersionId },
          condition as { consecutiveThreshold: number }
        );
        if (result) triggers.push(result);
      }
      break;

    case "HR-ATT-02":
      for (const input of data.attendanceInputs) {
        const result = evaluateExamBanThreshold(
          { ...input, ruleVersionId },
          condition as Parameters<typeof evaluateExamBanThreshold>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    case "HR-ATT-03":
      if (data.multiCourseAttendanceInput) {
        const result = evaluateMultiCourseAbsence(
          { ...data.multiCourseAttendanceInput, ruleVersionId },
          condition as Parameters<typeof evaluateMultiCourseAbsence>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    case "HR-ATT-04":
      for (const input of data.noShowStartInputs) {
        const result = evaluateNoShowStart(
          { ...input, ruleVersionId },
          condition as { earlyTermDays: number }
        );
        if (result) triggers.push(result);
      }
      break;

    // ACADEMIC
    case "HR-ACA-01":
      for (const input of data.failingScoreInputs) {
        const result = evaluateFailingScore(
          { ...input, ruleVersionId },
          condition as Parameters<typeof evaluateFailingScore>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    case "HR-ACA-02":
      if (data.warningInput) {
        const result = evaluateAcademicWarning(
          { ...data.warningInput, ruleVersionId },
          condition as Parameters<typeof evaluateAcademicWarning>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    case "HR-ACA-03":
      if (data.gpaDropInput) {
        const result = evaluateGpaDrop(
          { ...data.gpaDropInput, ruleVersionId },
          condition as Parameters<typeof evaluateGpaDrop>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    case "HR-ACA-04":
      for (const input of data.retakeInputs) {
        const result = evaluateRetake(
          { ...input, ruleVersionId },
          condition as { maxRetakeAttempts: number }
        );
        if (result) triggers.push(result);
      }
      break;

    // LMS
    case "HR-LMS-01":
      for (const input of data.lmsInactivityInputs) {
        const result = evaluateLmsInactivity(
          { ...input, ruleVersionId },
          condition as Parameters<typeof evaluateLmsInactivity>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    case "HR-LMS-02":
      for (const input of data.lmsMissedInputs) {
        const result = evaluateMissedSubmissions(
          { ...input, ruleVersionId },
          condition as Parameters<typeof evaluateMissedSubmissions>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    case "HR-LMS-03":
      for (const input of data.lmsZeroInputs) {
        const result = evaluateConsecutiveZeroScores(
          { ...input, ruleVersionId },
          condition as Parameters<typeof evaluateConsecutiveZeroScores>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    // COMBINED
    case "HR-COMB-01":
      if (data.multiSourceInput) {
        const result = evaluateMultiSourceNegative(
          { ...data.multiSourceInput, ruleVersionId },
          condition as Parameters<typeof evaluateMultiSourceNegative>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    case "HR-COMB-02":
      if (data.disappearanceInput) {
        const result = evaluateCompleteDisappearance(
          { ...data.disappearanceInput, ruleVersionId },
          condition as Parameters<typeof evaluateCompleteDisappearance>[1]
        );
        if (result) triggers.push(result);
      }
      break;

    default:
      console.warn(`[rule-engine] Unknown rule code: ${ruleCode}`);
  }

  return triggers;
}

/**
 * Group triggers by correlation key: (studentId, ruleCode, scopeId, termId)
 */
function groupTriggersByCorrelation(triggers: TriggerResult[]): Map<string, TriggerResult[]> {
  const groups = new Map<string, TriggerResult[]>();

  for (const trigger of triggers) {
    const key = `${trigger.studentId}|${trigger.ruleCode}|${trigger.scopeId}|${trigger.termId}`;
    const existing = groups.get(key) ?? [];
    existing.push(trigger);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Check if an alert status is considered "open" for correlation merging
 */
function isAlertOpen(status: string): boolean {
  return ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"].includes(status);
}

/**
 * Apply exception results to all input data objects.
 * This ensures that evaluators receive their exception context.
 */
function applyExceptionsToInputs(
  data: StudentEvaluationData,
  exceptionResults: Map<string, ExceptionResult>
): void {
  // For attendance inputs
  for (const input of data.attendanceInputs) {
    const exc = exceptionResults.get(input.enrollmentId);
    if (exc) {
      input.exceptions = exc;
    }
  }

  // For no-show inputs
  for (const input of data.noShowStartInputs) {
    const exc = exceptionResults.get(input.enrollmentId);
    if (exc) {
      input.exceptions = exc;
    }
  }

  // For academic inputs
  for (const input of data.failingScoreInputs) {
    const exc = exceptionResults.get(input.enrollmentId);
    if (exc) {
      input.exceptions = exc;
    }
  }

  // For retake inputs
  for (const input of data.retakeInputs) {
    const exc = exceptionResults.get(input.enrollmentId);
    if (exc) {
      input.exceptions = exc;
    }
  }

  // For LMS inputs
  for (const input of data.lmsInactivityInputs) {
    const exc = exceptionResults.get(input.enrollmentId);
    if (exc) {
      input.exceptions = exc;
    }
  }

  for (const input of data.lmsMissedInputs) {
    const exc = exceptionResults.get(input.enrollmentId);
    if (exc) {
      input.exceptions = exc;
    }
  }

  for (const input of data.lmsZeroInputs) {
    const exc = exceptionResults.get(input.enrollmentId);
    if (exc) {
      input.exceptions = exc;
    }
  }

  // For student-level inputs, use a merged exception result
  const mergedExc = mergeExceptionResults(Array.from(exceptionResults.values()));

  if (data.warningInput) {
    data.warningInput.exceptions = mergedExc;
  }
  if (data.gpaDropInput) {
    data.gpaDropInput.exceptions = mergedExc;
  }
  if (data.multiSourceInput) {
    data.multiSourceInput.exceptions = mergedExc;
  }
  if (data.disappearanceInput) {
    data.disappearanceInput.exceptions = mergedExc;
  }
}

/**
 * Merge multiple ExceptionResults for student-level rules.
 * skipAll = true if ALL enrollments are skipped.
 */
function mergeExceptionResults(results: ExceptionResult[]): ExceptionResult {
  if (results.length === 0) {
    return {
      skipAll: false,
      skipRules: new Set(),
      exemptAssignmentIds: new Set(),
      extendedDeadlines: new Map(),
      reasons: [],
    };
  }

  const allSkipped = results.every((r) => r.skipAll);
  const mergedSkipRules = new Set<string>();
  const mergedExempt = new Set<string>();
  const mergedDeadlines = new Map<string, Date>();
  const mergedReasons: string[] = [];

  for (const r of results) {
    for (const rule of r.skipRules) mergedSkipRules.add(rule);
    for (const id of r.exemptAssignmentIds) mergedExempt.add(id);
    for (const [id, date] of r.extendedDeadlines) {
      const existing = mergedDeadlines.get(id);
      if (!existing || date.getTime() > existing.getTime()) {
        mergedDeadlines.set(id, date);
      }
    }
    mergedReasons.push(...r.reasons);
  }

  return {
    skipAll: allSkipped,
    skipRules: mergedSkipRules,
    exemptAssignmentIds: mergedExempt,
    extendedDeadlines: mergedDeadlines,
    reasons: mergedReasons,
  };
}
