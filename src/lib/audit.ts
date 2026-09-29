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

  // Trong Phase 0, ghi log ra structured logger trước khi có bảng AuditLog ở các Phase sau
  console.info("[AUDIT_LOG]", JSON.stringify(logEntry));
}
