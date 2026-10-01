import { z } from "zod";

// ==========================================
// 1. RuleVersion.condition — JSON schemas per rule group
// ==========================================

/**
 * HR-ATT-01: Vắng liên tiếp
 * Cấu hình ngưỡng số buổi vắng liên tiếp không phép
 */
export const attConsecutiveAbsenceCondition = z.object({
  consecutiveThreshold: z.number().int().min(1).default(3),
});

/**
 * HR-ATT-02: Ngưỡng cấm thi
 * Tỷ lệ vắng không phép chạm/vượt ngưỡng cấm thi
 */
export const attExamBanCondition = z.object({
  absenceRateThreshold: z.number().min(0).max(1).default(0.2),
  comparisonOperator: z.enum([">=", ">"]).default(">="),
  countLateAsAbsence: z.boolean().default(false),
  lateToAbsenceRatio: z.number().min(0).max(1).optional(),
  countExcusedAbsence: z.boolean().default(false),
  countMakeupSessions: z.boolean().default(true),
});

/**
 * HR-ATT-03: Vắng đa môn đồng thời
 * Sliding window 7 ngày, vắng không phép ≥2 buổi ở ≥2 môn
 */
export const attMultiCourseAbsenceCondition = z.object({
  windowDays: z.number().int().min(1).default(7),
  minAbsences: z.number().int().min(1).default(2),
  minCourses: z.number().int().min(2).default(2),
});

/**
 * HR-ATT-04: Không tham gia đầu kỳ
 * Không có bản ghi PRESENT trong khoảng thời gian đầu kỳ
 */
export const attNoShowStartCondition = z.object({
  earlyTermDays: z.number().int().min(1).default(14),
});

/**
 * HR-ACA-01: Điểm 0/liệt ở đánh giá quan trọng
 */
export const acaFailingScoreCondition = z.object({
  minimumAssessmentWeight: z.number().min(0).max(1).default(0.3),
  failingScore: z.number().min(0).default(0),
});

/**
 * HR-ACA-02: Cảnh báo học vụ (tiệm cận ngưỡng buộc thôi học)
 */
export const acaAcademicWarningCondition = z.object({
  gpaWarningThreshold: z.number().min(0).max(4).default(1.0),
  cumulativeCreditsMin: z.number().int().min(0).default(0),
});

/**
 * HR-ACA-03: Sụt giảm GPA đột ngột
 */
export const acaGpaDropCondition = z.object({
  gpaDropThreshold: z.number().min(0).max(4).default(0.5),
  minCreditsPerTerm: z.number().int().min(1).default(10),
  inTermScoreDropThreshold: z.number().min(0).max(10).default(2.0),
});

/**
 * HR-ACA-04: Học lại ≥3 lần do rớt
 */
export const acaRetakeCondition = z.object({
  maxRetakeAttempts: z.number().int().min(1).default(3),
});

/**
 * HR-LMS-01: Không hoạt động LMS kéo dài
 * Severity theo dải ngày
 */
export const lmsInactivityCondition = z.object({
  mediumDaysMin: z.number().int().min(1).default(7),
  mediumDaysMax: z.number().int().min(1).default(9),
  highDaysMin: z.number().int().min(1).default(10),
  highDaysMax: z.number().int().min(1).default(13),
  criticalDaysMin: z.number().int().min(1).default(14),
});

/**
 * HR-LMS-02: Bỏ nộp bài bắt buộc liên tiếp
 */
export const lmsMissedSubmissionsCondition = z.object({
  consecutiveMissedThreshold: z.number().int().min(1).default(2),
});

/**
 * HR-LMS-03: 2 điểm liệt liên tiếp ở bài tự chấm
 */
export const lmsConsecutiveZeroCondition = z.object({
  consecutiveZeroThreshold: z.number().int().min(1).default(2),
  failingScore: z.number().min(0).default(0),
});

/**
 * HR-COMB-01: Tín hiệu tiêu cực đồng thời đa nguồn
 */
export const combMultiSourceCondition = z.object({
  windowDays: z.number().int().min(1).default(7),
  minSourceGroups: z.number().int().min(2).max(3).default(2),
  attendanceNegativeThreshold: z.number().min(0).max(1).default(0.5),
  academicNegativeThreshold: z.number().min(0).max(10).default(3.0),
  lmsNegativeThreshold: z.number().int().min(1).default(5),
});

/**
 * HR-COMB-02: Biến mất hoàn toàn
 */
export const combCompleteDisappearanceCondition = z.object({
  disappearanceDays: z.number().int().min(1).default(10),
});

/** Union discriminator for condition validation per ruleCode */
export const ruleConditionSchemas: Record<string, z.ZodType> = {
  "HR-ATT-01": attConsecutiveAbsenceCondition,
  "HR-ATT-02": attExamBanCondition,
  "HR-ATT-03": attMultiCourseAbsenceCondition,
  "HR-ATT-04": attNoShowStartCondition,
  "HR-ACA-01": acaFailingScoreCondition,
  "HR-ACA-02": acaAcademicWarningCondition,
  "HR-ACA-03": acaGpaDropCondition,
  "HR-ACA-04": acaRetakeCondition,
  "HR-LMS-01": lmsInactivityCondition,
  "HR-LMS-02": lmsMissedSubmissionsCondition,
  "HR-LMS-03": lmsConsecutiveZeroCondition,
  "HR-COMB-01": combMultiSourceCondition,
  "HR-COMB-02": combCompleteDisappearanceCondition,
};

export function validateCondition(ruleCode: string, condition: unknown) {
  const schema = ruleConditionSchemas[ruleCode];
  if (!schema) {
    throw new Error(`Unknown ruleCode: ${ruleCode}`);
  }
  return schema.parse(condition);
}

// ==========================================
// 2. RuleVersion.action — JSON schema
// ==========================================

export const ruleVersionActionSchema = z.object({
  notifyAdvisor: z.boolean().default(true),
  notifyTrainingOfficer: z.boolean().default(false),
  urgentContact: z.boolean().default(false),
  customMessage: z.string().optional(),
});

export type RuleVersionAction = z.infer<typeof ruleVersionActionSchema>;

// ==========================================
// 3. RuleTrigger.inputSnapshot — JSON schema
// ==========================================

export const triggerInputSnapshotSchema = z.object({
  ruleCode: z.string(),
  evaluatedAt: z.string(),
  dataPoints: z.record(z.string(), z.unknown()),
  description: z.string().optional(),
});

// ==========================================
// 4. RiskScoreLog.componentsUsed — JSON schema
// ==========================================

export const componentsUsedSchema = z.array(
  z.object({
    group: z.enum(["ATTENDANCE", "ACADEMIC", "LMS"]),
    weight: z.number(),
    normalizedRisk: z.number(),
    dataStatus: z.enum(["AVAILABLE", "MISSING", "NOT_APPLICABLE", "STALE", "INVALID"]),
  })
);

export type ComponentUsed = z.infer<typeof componentsUsedSchema>[number];

// ==========================================
// 5. API Input Schemas
// ==========================================

export const createRuleVersionSchema = z.object({
  ruleCode: z.string().min(1).max(20),
  condition: z.record(z.string(), z.unknown()),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  action: z.record(z.string(), z.unknown()),
  effectiveFrom: z.string().datetime(),
});

export const updateRuleVersionSchema = z.object({
  ruleVersionId: z.string().uuid(),
  condition: z.record(z.string(), z.unknown()).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  action: z.record(z.string(), z.unknown()).optional(),
});

export const activateRuleVersionSchema = z.object({
  ruleVersionId: z.string().uuid(),
});

export const runEvaluationSchema = z.object({
  termId: z.string().min(1),
  studentIds: z.array(z.string()).optional(),
  dryRun: z.boolean().default(false),
});

export const listRulesSchema = z.object({
  ruleGroup: z.enum(["ATTENDANCE", "ACADEMIC", "LMS", "COMBINED", "EXCEPTION"]).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
});

// ==========================================
// 6. Shared Types
// ==========================================

export type DataStatus = "AVAILABLE" | "MISSING" | "NOT_APPLICABLE" | "STALE" | "INVALID";

export interface TriggerResult {
  ruleCode: string;
  ruleVersionId: string;
  studentId: string;
  scopeId: string;
  termId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  inputSnapshot: Record<string, unknown>;
}

export interface RiskScoreInput {
  group: "ATTENDANCE" | "ACADEMIC" | "LMS";
  weight: number;
  normalizedRisk: number;
  dataStatus: DataStatus;
}

export interface EvaluationContext {
  studentId: string;
  termId: string;
  evaluationDate: Date;
  dryRun: boolean;
}
