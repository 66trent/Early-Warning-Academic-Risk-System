/**
 * Dashboard Validators — Zod schemas cho các truy vấn dashboard.
 * MUST NOT gắn "use server" — file này chỉ chứa schema, không phải Server Action.
 */

import { z } from "zod/v4";

// ==========================================
// 1. Bộ lọc tổng hợp dashboard chính
// ==========================================

export const dashboardOverviewFilterSchema = z.object({
  termId: z.string().optional(),
  departmentId: z.string().optional(),
  classId: z.string().optional(),
});

export type DashboardOverviewFilter = z.infer<typeof dashboardOverviewFilterSchema>;

// ==========================================
// 2. Bộ lọc xu hướng RiskScore theo thời gian
// ==========================================

export const riskScoreTrendFilterSchema = z.object({
  termId: z.string().optional(),
  departmentId: z.string().optional(),
  days: z.number().int().min(7).max(180).default(30),
});

export type RiskScoreTrendFilter = z.infer<typeof riskScoreTrendFilterSchema>;

// ==========================================
// 3. Bộ lọc chất lượng dữ liệu
// ==========================================

export const dataQualityFilterSchema = z.object({
  termId: z.string().optional(),
  days: z.number().int().min(1).max(90).default(30),
});

export type DataQualityFilter = z.infer<typeof dataQualityFilterSchema>;

// ==========================================
// 4. Bộ lọc danh sách sinh viên nguy cơ
// ==========================================

export const atRiskStudentListFilterSchema = z.object({
  termId: z.string().optional(),
  departmentId: z.string().optional(),
  classId: z.string().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type AtRiskStudentListFilter = z.infer<typeof atRiskStudentListFilterSchema>;

// ==========================================
// 5. Bộ lọc xuất báo cáo
// ==========================================

export const exportReportFilterSchema = z.object({
  termId: z.string(),
  departmentId: z.string().optional(),
  classId: z.string().optional(),
  format: z.enum(["csv", "json"]).default("csv"),
});

export type ExportReportFilter = z.infer<typeof exportReportFilterSchema>;
