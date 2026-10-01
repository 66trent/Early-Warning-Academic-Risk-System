import { z } from "zod";

// ==========================================
// 1. Alert Lifecycle Schemas
// ==========================================

export const acknowledgeAlertSchema = z.object({
  alertId: z.string().uuid("alertId phải là định dạng UUID hợp lệ"),
});

export const startProgressAlertSchema = z.object({
  alertId: z.string().uuid("alertId phải là định dạng UUID hợp lệ"),
});

export const resolveAlertSchema = z.object({
  alertId: z.string().uuid("alertId phải là định dạng UUID hợp lệ"),
  resolutionSummary: z.string().optional(),
});

export const dismissAlertSchema = z.object({
  alertId: z.string().uuid("alertId phải là định dạng UUID hợp lệ"),
  reason: z
    .string()
    .min(5, "Lý do bác bỏ cảnh báo bắt buộc tối thiểu 5 ký tự")
    .max(500, "Lý do bác bỏ không vượt quá 500 ký tự"),
});

export const reopenAlertSchema = z.object({
  alertId: z.string().uuid("alertId phải là định dạng UUID hợp lệ"),
  reason: z
    .string()
    .min(5, "Lý do mở lại cảnh báo bắt buộc tối thiểu 5 ký tự")
    .max(500, "Lý do không vượt quá 500 ký tự"),
});

export const invalidateAlertSchema = z.object({
  alertId: z.string().uuid("alertId phải là định dạng UUID hợp lệ"),
  reason: z
    .string()
    .min(5, "Lý do vô hiệu hóa cảnh báo bắt buộc tối thiểu 5 ký tự")
    .max(500, "Lý do không vượt quá 500 ký tự"),
});

// ==========================================
// 2. Intervention Schemas
// ==========================================

export const interventionTypeEnum = z.enum([
  "EMAIL",
  "PHONE_CALL",
  "IN_PERSON_MEETING",
  "ACADEMIC_PLAN",
  "REFERRAL",
  "OTHER",
]);

export const confidentialityLevelEnum = z.enum(["NORMAL", "SENSITIVE"]);

export const recordInterventionSchema = z.object({
  alertId: z.string().uuid("alertId phải là định dạng UUID hợp lệ"),
  type: interventionTypeEnum,
  content: z
    .string()
    .min(5, "Nội dung ghi nhận can thiệp bắt buộc tối thiểu 5 ký tự")
    .max(2000, "Nội dung không vượt quá 2000 ký tự"),
  outcome: z.string().max(1000, "Kết quả can thiệp không vượt quá 1000 ký tự").optional(),
  nextFollowUpAt: z.coerce.date().optional(),
  confidentialityLevel: confidentialityLevelEnum.default("NORMAL"),
});

// ==========================================
// 3. Query & Filter Schemas
// ==========================================

export const alertStatusEnum = z.enum([
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
  "INVALIDATED",
  "REOPENED",
]);

export const severityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const listAlertsFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  statuses: z.array(alertStatusEnum).optional(),
  severities: z.array(severityEnum).optional(),
  termId: z.string().optional(),
  studentSearch: z.string().optional(),
});

export const getAlertDetailsSchema = z.object({
  alertId: z.string().uuid("alertId phải là định dạng UUID hợp lệ"),
});

export const getStudentStudyStatusSchema = z.object({
  studentId: z.string().min(1, "studentId không được để trống"),
});

export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;
export type StartProgressAlertInput = z.infer<typeof startProgressAlertSchema>;
export type ResolveAlertInput = z.infer<typeof resolveAlertSchema>;
export type DismissAlertInput = z.infer<typeof dismissAlertSchema>;
export type ReopenAlertInput = z.infer<typeof reopenAlertSchema>;
export type InvalidateAlertInput = z.infer<typeof invalidateAlertSchema>;
export type RecordInterventionInput = z.infer<typeof recordInterventionSchema>;
export type ListAlertsFilterInput = z.infer<typeof listAlertsFilterSchema>;
export type GetAlertDetailsInput = z.infer<typeof getAlertDetailsSchema>;
export type GetStudentStudyStatusInput = z.infer<typeof getStudentStudyStatusSchema>;
