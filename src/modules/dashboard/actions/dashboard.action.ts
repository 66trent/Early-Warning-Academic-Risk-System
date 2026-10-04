"use server";

/**
 * Dashboard Server Actions — Phân quyền + validate + gọi service.
 * Tuân thủ pattern scaffold-server-action 5 bước.
 * Chỉ TRAINING_OFFICER và ADMIN được truy cập dashboard tổng hợp.
 */

import { getSession } from "@/lib/session";
import { assertScope } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import {
  getDashboardOverview,
  getRiskScoreTrend,
  getDataQualityMetrics,
  getAtRiskStudentList,
  exportReport,
  getFilterOptions,
} from "../services/dashboard.service";
import {
  dashboardOverviewFilterSchema,
  riskScoreTrendFilterSchema,
  dataQualityFilterSchema,
  atRiskStudentListFilterSchema,
  exportReportFilterSchema,
} from "../validators/dashboard.schema";

// ==========================================
// Helper: Require TRAINING_OFFICER or ADMIN
// ==========================================

interface DashboardActor {
  id: string;
  userId: string;
  role: string;
  fullName: string;
  email: string;
  scopeConfig: unknown;
}

async function requireDashboardAccess(): Promise<DashboardActor> {
  // Bước 1: Lấy session
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Yêu cầu đăng nhập để truy cập dashboard.");
  }

  const u = session.user as Record<string, unknown>;
  const actor: DashboardActor = {
    id: (u.id as string) || (u.userId as string) || "",
    userId: (u.userId as string) || (u.id as string) || "",
    role: (u.role as string) || "",
    fullName: (u.fullName as string) || (u.name as string) || "",
    email: (u.email as string) || "",
    scopeConfig: u.scopeConfig,
  };

  // Bước 3: Kiểm tra phạm vi — chỉ TRAINING_OFFICER và ADMIN
  if (actor.role !== "TRAINING_OFFICER" && actor.role !== "ADMIN") {
    throw new Error(
      "Chỉ Cán bộ Đào tạo (QLĐT) và Quản trị viên mới có quyền truy cập Dashboard tổng hợp."
    );
  }

  return actor;
}

// ==========================================
// 1. Dashboard Overview Action
// ==========================================

export async function getDashboardOverviewAction(rawInput: unknown) {
  try {
    await requireDashboardAccess();

    // Bước 2: Validate input
    const filter = dashboardOverviewFilterSchema.parse(rawInput || {});

    // Bước 4: Gọi service
    const result = await getDashboardOverview(filter);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi tải dữ liệu dashboard tổng quan.",
    };
  }
}

// ==========================================
// 2. Risk Score Trend Action
// ==========================================

export async function getRiskScoreTrendAction(rawInput: unknown) {
  try {
    await requireDashboardAccess();
    const filter = riskScoreTrendFilterSchema.parse(rawInput || {});
    const result = await getRiskScoreTrend(filter);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi tải xu hướng RiskScore.",
    };
  }
}

// ==========================================
// 3. Data Quality Action
// ==========================================

export async function getDataQualityAction(rawInput: unknown) {
  try {
    await requireDashboardAccess();
    const filter = dataQualityFilterSchema.parse(rawInput || {});
    const result = await getDataQualityMetrics(filter);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi tải chất lượng dữ liệu.",
    };
  }
}

// ==========================================
// 4. At-Risk Student List Action
// ==========================================

export async function getAtRiskStudentListAction(rawInput: unknown) {
  try {
    const actor = await requireDashboardAccess();
    const filter = atRiskStudentListFilterSchema.parse(rawInput || {});

    // Kiểm tra phạm vi khoa nếu có
    if (filter.departmentId) {
      await assertScope(actor, { departmentId: filter.departmentId });
    }

    const result = await getAtRiskStudentList(filter);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi tải danh sách sinh viên nguy cơ.",
    };
  }
}

// ==========================================
// 5. Export Report Action
// ==========================================

export async function exportReportAction(rawInput: unknown) {
  try {
    const actor = await requireDashboardAccess();
    const filter = exportReportFilterSchema.parse(rawInput);

    // Bước 5: Ghi audit log — xuất báo cáo là hành động nhạy cảm
    await writeAuditLog({
      actorId: actor.userId,
      actorRole: actor.role,
      action: "EXPORT_REPORT",
      targetEntity: "Dashboard",
      details: {
        termId: filter.termId,
        departmentId: filter.departmentId || "ALL",
        classId: filter.classId || "ALL",
        format: filter.format,
      },
    });

    const result = await exportReport(filter);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi xuất báo cáo.",
    };
  }
}

// ==========================================
// 6. Filter Options Action (danh sách terms, departments, classes)
// ==========================================

export async function getFilterOptionsAction() {
  try {
    await requireDashboardAccess();
    const result = await getFilterOptions();
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi tải danh sách bộ lọc.",
    };
  }
}
