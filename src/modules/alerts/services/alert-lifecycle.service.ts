/**
 * Alert Lifecycle Service — Quản lý chuyển đổi trạng thái Alert theo sơ đồ hữu hạn.
 * Tuân thủ nghiêm ngặt skill alert-lifecycle-transition và bảng 11-data-schema-rule-engine.md.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { suppressQueuedNotificationsForAlert } from "./notification.service";
import type { AlertStatus } from "@/generated/prisma/client";

export class AlertLifecycleError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AlertLifecycleError";
  }
}

export interface ActorContext {
  id: string;
  userId: string;
  role: string;
  fullName?: string;
  email?: string;
  scopeConfig?: unknown;
}

/**
 * Ma trận các trạng thái tiếp theo hợp lệ:
 * OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED
 *                     ↘             ↘
 *                       DISMISSED     (RESOLVED/DISMISSED) → REOPENED → ACKNOWLEDGED
 * Bất kỳ trạng thái nào → INVALIDATED
 */
export const VALID_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  OPEN: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "DISMISSED"],
  IN_PROGRESS: ["RESOLVED", "DISMISSED"],
  RESOLVED: ["REOPENED"],
  DISMISSED: ["REOPENED"],
  REOPENED: ["ACKNOWLEDGED"],
  INVALIDATED: [],
};

/**
 * Kiểm tra xem việc chuyển từ currentStatus sang targetStatus có hợp lệ không.
 */
export function isTransitionAllowed(
  currentStatus: AlertStatus,
  targetStatus: AlertStatus
): boolean {
  if (targetStatus === "INVALIDATED") {
    // Bất kỳ trạng thái nào cũng có thể chuyển sang INVALIDATED
    return true;
  }
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

/**
 * Hàm điều phối chuyển trạng thái cốt lõi
 */
export async function transitionAlertStatus(
  alertId: string,
  targetStatus: AlertStatus,
  actor: ActorContext,
  meta?: {
    reason?: string;
    resolutionSummary?: string;
    systemOverride?: boolean;
  }
) {
  // 1. Lấy thông tin Alert hiện tại kèm can thiệp
  const alert = await prisma.alert.findUnique({
    where: { alertId },
    include: {
      interventions: true,
      student: { select: { studentId: true, fullName: true, advisorId: true } },
    },
  });

  if (!alert) {
    throw new AlertLifecycleError(`Không tìm thấy cảnh báo với mã ${alertId}`, 404);
  }

  const currentStatus = alert.status;

  // 2. Validate sơ đồ trạng thái
  if (!isTransitionAllowed(currentStatus, targetStatus)) {
    throw new AlertLifecycleError(
      `Chuyển trạng thái không hợp lệ: Không thể chuyển cảnh báo từ ${currentStatus} sang ${targetStatus}. ` +
        `Các trạng thái hợp lệ từ ${currentStatus} là: [${(VALID_TRANSITIONS[currentStatus] || []).join(", ")}]`,
      400
    );
  }

  // 3. Validate quyền và điều kiện nghiệp vụ cho từng trạng thái
  const actorId = actor.userId || actor.id;

  switch (targetStatus) {
    case "ACKNOWLEDGED": {
      // Actor phải là CVHT được phân công, hoặc QLĐT/ADMIN
      if (
        actor.role === "ADVISOR" &&
        alert.assignedAdvisorId !== actorId &&
        alert.student.advisorId !== actorId
      ) {
        throw new AlertLifecycleError(
          "Chỉ Cố vấn học tập được phân công phụ trách sinh viên mới có quyền xác nhận cảnh báo này",
          403
        );
      }
      break;
    }

    case "IN_PROGRESS": {
      if (currentStatus !== "ACKNOWLEDGED") {
        throw new AlertLifecycleError(
          `Cảnh báo phải ở trạng thái ACKNOWLEDGED trước khi chuyển sang IN_PROGRESS (hiện tại: ${currentStatus})`,
          400
        );
      }
      break;
    }

    case "RESOLVED": {
      if (currentStatus !== "IN_PROGRESS") {
        throw new AlertLifecycleError(
          `Cảnh báo phải ở trạng thái IN_PROGRESS trước khi chuyển sang RESOLVED (hiện tại: ${currentStatus})`,
          400
        );
      }
      // RÀNG BUỘC: SHOULD có ít nhất 1 Intervention liên kết
      if (alert.interventions.length === 0) {
        throw new AlertLifecycleError(
          "Cảnh báo cần có ít nhất 1 hoạt động can thiệp (Intervention) được ghi nhận trước khi đóng giải quyết",
          400
        );
      }
      break;
    }

    case "DISMISSED": {
      if (!meta?.reason || meta.reason.trim().length < 5) {
        throw new AlertLifecycleError(
          "Bắt buộc phải cung cấp lý do bác bỏ cảnh báo (tối thiểu 5 ký tự)",
          400
        );
      }
      break;
    }

    case "REOPENED": {
      if (currentStatus !== "RESOLVED" && currentStatus !== "DISMISSED") {
        throw new AlertLifecycleError(
          `Chỉ có thể mở lại cảnh báo đã RESOLVED hoặc DISMISSED (hiện tại: ${currentStatus})`,
          400
        );
      }
      break;
    }

    case "INVALIDATED": {
      if (actor.role !== "ADMIN" && !meta?.systemOverride) {
        throw new AlertLifecycleError(
          "Chỉ Quản trị viên hệ thống hoặc quy trình tự động mới có quyền vô hiệu hóa cảnh báo",
          403
        );
      }
      if (!meta?.reason || meta.reason.trim().length < 5) {
        throw new AlertLifecycleError(
          "Bắt buộc phải cung cấp lý do vô hiệu hóa cảnh báo (dữ liệu nguồn thay đổi)",
          400
        );
      }
      break;
    }
  }

  // 4. Cập nhật cơ sở dữ liệu
  const now = new Date();
  const updateData: {
    status: AlertStatus;
    lastDetectedAt?: Date;
  } = {
    status: targetStatus,
  };

  // Nếu REOPENED: MUST NOT reset firstDetectedAt, chỉ update lastDetectedAt
  if (targetStatus === "REOPENED") {
    updateData.lastDetectedAt = now;
  }

  const updatedAlert = await prisma.alert.update({
    where: { alertId },
    data: updateData,
  });

  // 5. Side-effects:
  // Nếu RESOLVED hoặc INVALIDATED: MUST suppress mọi Notification QUEUED còn lại
  if (targetStatus === "RESOLVED" || targetStatus === "INVALIDATED") {
    await suppressQueuedNotificationsForAlert(alertId);
  }

  // Nếu DISMISSED: Tạo bản ghi can thiệp dạng ghi chú lý do bác bỏ
  if (targetStatus === "DISMISSED" && meta?.reason) {
    await prisma.intervention.create({
      data: {
        alertId,
        performedBy: actorId,
        type: "OTHER",
        content: `Bác bỏ cảnh báo: ${meta.reason.trim()}`,
        performedAt: now,
        status: "DISMISSED",
        confidentialityLevel: "NORMAL",
      },
    });
  }

  // Ghi Audit Log bắt buộc
  await writeAuditLog({
    actorId,
    actorRole: actor.role,
    action: `ALERT_STATUS_${targetStatus}`,
    targetEntity: "Alert",
    targetId: alertId,
    details: {
      previousStatus: currentStatus,
      newStatus: targetStatus,
      studentId: alert.studentId,
      termId: alert.termId,
      reason: meta?.reason,
      resolutionSummary: meta?.resolutionSummary,
    },
  });

  return updatedAlert;
}

// ==========================================
// Specific Transition Methods (Khuôn mẫu skill)
// ==========================================

export async function acknowledgeAlert(alertId: string, actor: ActorContext) {
  return transitionAlertStatus(alertId, "ACKNOWLEDGED", actor);
}

export async function startProgressAlert(alertId: string, actor: ActorContext) {
  return transitionAlertStatus(alertId, "IN_PROGRESS", actor);
}

export async function resolveAlert(
  alertId: string,
  actor: ActorContext,
  resolutionSummary?: string
) {
  return transitionAlertStatus(alertId, "RESOLVED", actor, { resolutionSummary });
}

export async function dismissAlert(alertId: string, actor: ActorContext, reason: string) {
  return transitionAlertStatus(alertId, "DISMISSED", actor, { reason });
}

export async function reopenAlert(alertId: string, actor: ActorContext, reason: string) {
  return transitionAlertStatus(alertId, "REOPENED", actor, { reason });
}

export async function invalidateAlert(
  alertId: string,
  actor: ActorContext,
  reason: string,
  systemOverride: boolean = false
) {
  return transitionAlertStatus(alertId, "INVALIDATED", actor, { reason, systemOverride });
}
