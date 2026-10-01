/**
 * Intervention Service — Ghi nhận và quản lý các hoạt động can thiệp hỗ trợ sinh viên của CVHT.
 * Gắn liền với vòng đời Alert (tự động chuyển sang IN_PROGRESS nếu đang ACKNOWLEDGED).
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { transitionAlertStatus, type ActorContext } from "./alert-lifecycle.service";
import type { ConfidentialityLevel, InterventionType } from "@/generated/prisma/client";

export interface RecordInterventionParams {
  alertId: string;
  type: InterventionType;
  content: string;
  outcome?: string;
  nextFollowUpAt?: Date;
  confidentialityLevel?: ConfidentialityLevel;
}

export async function recordIntervention(params: RecordInterventionParams, actor: ActorContext) {
  const {
    alertId,
    type,
    content,
    outcome,
    nextFollowUpAt,
    confidentialityLevel = "NORMAL",
  } = params;
  const actorId = actor.userId || actor.id;

  // 1. Kiểm tra tồn tại Alert
  const alert = await prisma.alert.findUnique({
    where: { alertId },
    include: {
      student: true,
    },
  });

  if (!alert) {
    throw new Error(`Không tìm thấy cảnh báo với mã ${alertId}`);
  }

  // 2. Tạo bản ghi can thiệp
  const now = new Date();
  const intervention = await prisma.intervention.create({
    data: {
      alertId,
      performedBy: actorId,
      type,
      content,
      performedAt: now,
      outcome,
      nextFollowUpAt,
      status: "COMPLETED",
      confidentialityLevel,
    },
  });

  // 3. Tự động chuyển trạng thái Alert:
  // Nếu Alert đang OPEN -> ACKNOWLEDGED -> IN_PROGRESS
  if (alert.status === "OPEN") {
    await transitionAlertStatus(alertId, "ACKNOWLEDGED", actor);
    await transitionAlertStatus(alertId, "IN_PROGRESS", actor);
  } else if (alert.status === "ACKNOWLEDGED") {
    // Nếu Alert đang ACKNOWLEDGED -> chuyển sang IN_PROGRESS
    await transitionAlertStatus(alertId, "IN_PROGRESS", actor);
  }

  // 4. Ghi Audit Log
  await writeAuditLog({
    actorId,
    actorRole: actor.role,
    action: "RECORD_INTERVENTION",
    targetEntity: "Intervention",
    targetId: intervention.interventionId,
    details: {
      alertId,
      studentId: alert.studentId,
      type,
      confidentialityLevel,
      hasFollowUp: !!nextFollowUpAt,
    },
  });

  return intervention;
}

export async function listInterventionsByAlert(alertId: string) {
  return prisma.intervention.findMany({
    where: { alertId },
    include: {
      performer: {
        select: {
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { performedAt: "desc" },
  });
}
