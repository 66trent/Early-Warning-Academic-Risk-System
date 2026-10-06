"use server";

import { getSession } from "@/lib/session";
import { AuthorizationError } from "@/lib/authz";
import { ListAuditLogsFilterSchema } from "../validators/audit.schema";
import {
  listAuditLogsService,
  getAuditLogByIdService,
  getAuditLogStatisticsService,
} from "../services/audit.service";

/**
 * Kiểm tra quyền xem nhật ký kiểm toán (ADMIN hoặc TRAINING_OFFICER).
 */
async function requireAuditViewerSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new AuthorizationError("Yêu cầu đăng nhập để truy cập nhật ký kiểm toán", 401);
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "TRAINING_OFFICER") {
    throw new AuthorizationError(
      "Chỉ Quản trị viên hoặc Cán bộ quản lý đào tạo mới có quyền xem nhật ký kiểm toán",
      403
    );
  }
  return session;
}

/**
 * Server Action truy vấn danh sách nhật ký kiểm toán.
 * CHỈ ĐỌC (Append-only) — TUYỆT ĐỐI KHÔNG CUNG CẤP ACTION SỬA HOẶC XÓA AUDIT LOG.
 */
export async function listAuditLogsAction(rawInput: unknown) {
  await requireAuditViewerSession();
  const filter = ListAuditLogsFilterSchema.parse(rawInput || {});
  return await listAuditLogsService(filter);
}

/**
 * Server Action xem chi tiết 1 bản ghi kiểm toán.
 */
export async function getAuditLogDetailAction(id: string) {
  await requireAuditViewerSession();
  if (!id || typeof id !== "string") {
    throw new Error("Mã bản ghi kiểm toán không hợp lệ");
  }
  return await getAuditLogByIdService(id);
}

/**
 * Server Action thống kê nhật ký kiểm toán cho Dashboard / Overview.
 */
export async function getAuditLogStatisticsAction() {
  await requireAuditViewerSession();
  return await getAuditLogStatisticsService();
}
