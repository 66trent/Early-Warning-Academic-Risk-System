/**
 * Seed data for the 13 business rules + exception group.
 * Run separately or integrate into the main seed file.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const RULES_SEED = [
  // ATTENDANCE
  {
    ruleCode: "HR-ATT-01",
    ruleName: "Vắng liên tiếp",
    ruleGroup: "ATTENDANCE" as const,
    scope: "PER_COURSE",
    priority: 1,
    cooldown: 72, // hours
    status: "ACTIVE" as const,
  },
  {
    ruleCode: "HR-ATT-02",
    ruleName: "Ngưỡng cấm thi",
    ruleGroup: "ATTENDANCE" as const,
    scope: "PER_COURSE",
    priority: 2,
    cooldown: 168,
    status: "ACTIVE" as const,
  },
  {
    ruleCode: "HR-ATT-03",
    ruleName: "Vắng đa môn đồng thời",
    ruleGroup: "ATTENDANCE" as const,
    scope: "PER_STUDENT",
    priority: 3,
    cooldown: 168,
    status: "ACTIVE" as const,
  },
  {
    ruleCode: "HR-ATT-04",
    ruleName: "Không tham gia đầu kỳ",
    ruleGroup: "ATTENDANCE" as const,
    scope: "PER_COURSE",
    priority: 4,
    cooldown: 336,
    status: "ACTIVE" as const,
  },
  // ACADEMIC
  {
    ruleCode: "HR-ACA-01",
    ruleName: "Điểm 0/liệt ở đánh giá quan trọng",
    ruleGroup: "ACADEMIC" as const,
    scope: "PER_COURSE",
    priority: 5,
    cooldown: 168,
    status: "ACTIVE" as const,
  },
  {
    ruleCode: "HR-ACA-02",
    ruleName: "Cảnh báo học vụ tiệm cận ngưỡng",
    ruleGroup: "ACADEMIC" as const,
    scope: "PER_STUDENT",
    priority: 6,
    cooldown: 720,
    status: "ACTIVE" as const,
  },
  {
    ruleCode: "HR-ACA-03",
    ruleName: "Sụt giảm GPA đột ngột",
    ruleGroup: "ACADEMIC" as const,
    scope: "PER_STUDENT",
    priority: 7,
    cooldown: 720,
    status: "ACTIVE" as const,
  },
  {
    ruleCode: "HR-ACA-04",
    ruleName: "Học lại nhiều lần",
    ruleGroup: "ACADEMIC" as const,
    scope: "PER_COURSE",
    priority: 8,
    cooldown: 720,
    status: "ACTIVE" as const,
  },
  // LMS
  {
    ruleCode: "HR-LMS-01",
    ruleName: "Không hoạt động LMS kéo dài",
    ruleGroup: "LMS" as const,
    scope: "PER_COURSE",
    priority: 9,
    cooldown: 168,
    status: "ACTIVE" as const,
  },
  {
    ruleCode: "HR-LMS-02",
    ruleName: "Bỏ nộp bài bắt buộc liên tiếp",
    ruleGroup: "LMS" as const,
    scope: "PER_COURSE",
    priority: 10,
    cooldown: 168,
    status: "ACTIVE" as const,
  },
  {
    ruleCode: "HR-LMS-03",
    ruleName: "Hai điểm liệt liên tiếp bài tự chấm",
    ruleGroup: "LMS" as const,
    scope: "PER_COURSE",
    priority: 11,
    cooldown: 168,
    status: "ACTIVE" as const,
  },
  // COMBINED
  {
    ruleCode: "HR-COMB-01",
    ruleName: "Tín hiệu tiêu cực đồng thời đa nguồn",
    ruleGroup: "COMBINED" as const,
    scope: "PER_STUDENT",
    priority: 12,
    cooldown: 168,
    status: "ACTIVE" as const,
  },
  {
    ruleCode: "HR-COMB-02",
    ruleName: "Biến mất hoàn toàn",
    ruleGroup: "COMBINED" as const,
    scope: "PER_STUDENT",
    priority: 13,
    cooldown: 72,
    status: "ACTIVE" as const,
  },
];

/** Default conditions per rule, matching the Zod validators */
const DEFAULT_CONDITIONS: Record<string, Record<string, unknown>> = {
  "HR-ATT-01": { consecutiveThreshold: 3 },
  "HR-ATT-02": {
    absenceRateThreshold: 0.2,
    comparisonOperator: ">=",
    countLateAsAbsence: false,
    countExcusedAbsence: false,
    countMakeupSessions: true,
  },
  "HR-ATT-03": { windowDays: 7, minAbsences: 2, minCourses: 2 },
  "HR-ATT-04": { earlyTermDays: 14 },
  "HR-ACA-01": { minimumAssessmentWeight: 0.3, failingScore: 0 },
  "HR-ACA-02": { gpaWarningThreshold: 1.0, cumulativeCreditsMin: 0 },
  "HR-ACA-03": { gpaDropThreshold: 0.5, minCreditsPerTerm: 10, inTermScoreDropThreshold: 2.0 },
  "HR-ACA-04": { maxRetakeAttempts: 3 },
  "HR-LMS-01": {
    mediumDaysMin: 7,
    mediumDaysMax: 9,
    highDaysMin: 10,
    highDaysMax: 13,
    criticalDaysMin: 14,
  },
  "HR-LMS-02": { consecutiveMissedThreshold: 2 },
  "HR-LMS-03": { consecutiveZeroThreshold: 2, failingScore: 0 },
  "HR-COMB-01": {
    windowDays: 7,
    minSourceGroups: 2,
    attendanceNegativeThreshold: 0.5,
    academicNegativeThreshold: 3.0,
    lmsNegativeThreshold: 5,
  },
  "HR-COMB-02": { disappearanceDays: 10 },
};

const DEFAULT_SEVERITIES: Record<string, string> = {
  "HR-ATT-01": "HIGH",
  "HR-ATT-02": "CRITICAL",
  "HR-ATT-03": "MEDIUM",
  "HR-ATT-04": "HIGH",
  "HR-ACA-01": "MEDIUM",
  "HR-ACA-02": "CRITICAL",
  "HR-ACA-03": "MEDIUM",
  "HR-ACA-04": "MEDIUM",
  "HR-LMS-01": "MEDIUM",
  "HR-LMS-02": "MEDIUM",
  "HR-LMS-03": "MEDIUM",
  "HR-COMB-01": "CRITICAL",
  "HR-COMB-02": "CRITICAL",
};

const DEFAULT_ACTION = {
  notifyAdvisor: true,
  notifyTrainingOfficer: false,
  urgentContact: false,
};

export async function seedRules(configuredBy: string, approvedBy: string) {
  console.log("🌱 Seeding Rule definitions...");

  for (const ruleDef of RULES_SEED) {
    await prisma.rule.upsert({
      where: { ruleCode: ruleDef.ruleCode },
      create: ruleDef,
      update: ruleDef,
    });

    // Create default RuleVersion v1
    const existing = await prisma.ruleVersion.findFirst({
      where: { ruleCode: ruleDef.ruleCode, version: 1 },
    });

    if (!existing) {
      const action =
        ruleDef.ruleCode === "HR-COMB-02"
          ? { ...DEFAULT_ACTION, urgentContact: true, notifyTrainingOfficer: true }
          : DEFAULT_ACTION;

      await prisma.ruleVersion.create({
        data: {
          ruleCode: ruleDef.ruleCode,
          version: 1,
          condition: (DEFAULT_CONDITIONS[ruleDef.ruleCode] ?? {}) as Prisma.InputJsonValue,
          severity: (DEFAULT_SEVERITIES[ruleDef.ruleCode] ?? "MEDIUM") as
            "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          action: action as Prisma.InputJsonValue,
          effectiveFrom: new Date(),
          status: "ACTIVE",
          configuredBy,
          approvedBy,
        },
      });
    }
  }

  console.log(`✅ Seeded ${RULES_SEED.length} rules with default versions.`);
}
