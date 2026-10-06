import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface AuditLogPayload {
  actorId: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Ghi log kiểm toán (Audit Log) theo nguyên tắc append-only.
 * Bắt buộc gọi cho mọi thao tác nhạy cảm: cấu hình luật, đổi trạng thái Alert, import batch, v.v.
 */
export async function writeAuditLog(payload: AuditLogPayload): Promise<void> {
  const logEntry = {
    ...payload,
    timestamp: new Date().toISOString(),
  };

  // Structured logger cho giám sát log tập trung
  console.info("[AUDIT_LOG]", JSON.stringify(logEntry));

  try {
    if (prisma?.auditLog) {
      await prisma.auditLog.create({
        data: {
          actorId: payload.actorId,
          actorRole: payload.actorRole,
          action: payload.action,
          targetEntity: payload.targetEntity,
          targetId: payload.targetId,
          details: payload.details ? (payload.details as Prisma.InputJsonValue) : undefined,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
        },
      });
    }
  } catch (err) {
    console.error("[AUDIT_LOG_ERROR] Không thể ghi bản ghi kiểm toán vào CSDL:", err);
  }
}
