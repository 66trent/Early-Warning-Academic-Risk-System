"use server";

import { getSession } from "@/lib/session";
import { assertScope } from "@/lib/authz";
import {
  acknowledgeAlert,
  startProgressAlert,
  resolveAlert,
  dismissAlert,
  reopenAlert,
  invalidateAlert,
  type ActorContext,
} from "../services/alert-lifecycle.service";
import { recordIntervention } from "../services/intervention.service";
import {
  listAlerts,
  getAlertDetails,
  getStudentStudyStatus,
} from "../services/alert-query.service";
import {
  acknowledgeAlertSchema,
  startProgressAlertSchema,
  resolveAlertSchema,
  dismissAlertSchema,
  reopenAlertSchema,
  invalidateAlertSchema,
  recordInterventionSchema,
  listAlertsFilterSchema,
  getAlertDetailsSchema,
  getStudentStudyStatusSchema,
} from "../validators/alert.schema";

// Helper lấy actor context từ session
async function requireAuthActor(): Promise<ActorContext> {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Yêu cầu đăng nhập để thực hiện thao tác này");
  }

  const u = session.user as Record<string, unknown>;

  return {
    id: (u.id as string) || (u.userId as string) || "",
    userId: (u.userId as string) || (u.id as string) || "",
    role: (u.role as string) || "",
    fullName: (u.fullName as string) || (u.name as string) || "",
    email: (u.email as string) || "",
    scopeConfig: u.scopeConfig,
  };
}

// ==========================================
// 1. Alert Lifecycle Server Actions
// ==========================================

export async function acknowledgeAlertAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const { alertId } = acknowledgeAlertSchema.parse(rawInput);

    // Kiểm tra quyền truy cập Alert
    const details = await getAlertDetails(alertId, actor);
    await assertScope(actor, {
      studentId: details.studentId,
      departmentId: details.student.departmentId,
      resourceType: "Alert",
      action: "WRITE",
    });

    const result = await acknowledgeAlert(alertId, actor);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi không xác định khi xác nhận cảnh báo",
    };
  }
}

export async function startProgressAlertAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const { alertId } = startProgressAlertSchema.parse(rawInput);

    const details = await getAlertDetails(alertId, actor);
    await assertScope(actor, {
      studentId: details.studentId,
      departmentId: details.student.departmentId,
      resourceType: "Alert",
      action: "WRITE",
    });

    const result = await startProgressAlert(alertId, actor);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi chuyển trạng thái đang xử lý",
    };
  }
}

export async function resolveAlertAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const { alertId, resolutionSummary } = resolveAlertSchema.parse(rawInput);

    const details = await getAlertDetails(alertId, actor);
    await assertScope(actor, {
      studentId: details.studentId,
      departmentId: details.student.departmentId,
      resourceType: "Alert",
      action: "WRITE",
    });

    const result = await resolveAlert(alertId, actor, resolutionSummary);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi đóng giải quyết cảnh báo",
    };
  }
}

export async function dismissAlertAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const { alertId, reason } = dismissAlertSchema.parse(rawInput);

    const details = await getAlertDetails(alertId, actor);
    await assertScope(actor, {
      studentId: details.studentId,
      departmentId: details.student.departmentId,
      resourceType: "Alert",
      action: "WRITE",
    });

    const result = await dismissAlert(alertId, actor, reason);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi bác bỏ cảnh báo",
    };
  }
}

export async function reopenAlertAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const { alertId, reason } = reopenAlertSchema.parse(rawInput);

    const details = await getAlertDetails(alertId, actor);
    await assertScope(actor, {
      studentId: details.studentId,
      departmentId: details.student.departmentId,
      resourceType: "Alert",
      action: "WRITE",
    });

    const result = await reopenAlert(alertId, actor, reason);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi mở lại cảnh báo",
    };
  }
}

export async function invalidateAlertAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const { alertId, reason } = invalidateAlertSchema.parse(rawInput);

    if (actor.role !== "ADMIN") {
      throw new Error("Chỉ Quản trị viên hệ thống mới có quyền vô hiệu hóa cảnh báo");
    }

    const result = await invalidateAlert(alertId, actor, reason);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi vô hiệu hóa cảnh báo",
    };
  }
}

// ==========================================
// 2. Intervention Server Actions
// ==========================================

export async function recordInterventionAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const input = recordInterventionSchema.parse(rawInput);

    // Kiểm tra quyền với Alert này
    const details = await getAlertDetails(input.alertId, actor);
    await assertScope(actor, {
      studentId: details.studentId,
      departmentId: details.student.departmentId,
      resourceType: "Alert",
      action: "WRITE",
    });

    const result = await recordIntervention(input, actor);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi ghi nhận can thiệp",
    };
  }
}

// ==========================================
// 3. Query Server Actions
// ==========================================

export async function listAlertsAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const filter = listAlertsFilterSchema.parse(rawInput || {});

    const result = await listAlerts(filter, actor);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi tải danh sách cảnh báo",
    };
  }
}

export async function getAlertDetailsAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const { alertId } = getAlertDetailsSchema.parse(rawInput);

    const result = await getAlertDetails(alertId, actor);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi tải thông tin chi tiết cảnh báo",
    };
  }
}

export async function getStudentStudyStatusAction(rawInput: unknown) {
  try {
    const actor = await requireAuthActor();
    const { studentId } = getStudentStudyStatusSchema.parse(rawInput);

    await assertScope(actor, { studentId });

    const result = await getStudentStudyStatus(studentId, actor);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi tải tình hình học tập",
    };
  }
}
