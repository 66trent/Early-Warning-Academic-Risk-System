import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ListAuditLogsFilterInput } from "../validators/audit.schema";

export interface PaginatedAuditLogsResult {
  logs: Array<{
    id: string;
    actorId: string;
    actorRole: string;
    action: string;
    targetEntity: string;
    targetId: string | null;
    details: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Truy vấn nhật ký kiểm toán với phân trang và bộ lọc linh hoạt.
 * Tính năng CHỈ ĐỌC (Append-only) — không cung cấp hàm update hay delete.
 */
export async function listAuditLogsService(
  filter: ListAuditLogsFilterInput
): Promise<PaginatedAuditLogsResult> {
  const { actorId, action, targetEntity, fromDate, toDate, page = 1, pageSize = 50 } = filter;
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.AuditLogWhereInput = {};

  if (actorId && actorId.trim() !== "") {
    whereClause.actorId = { contains: actorId.trim(), mode: "insensitive" };
  }

  if (action && action.trim() !== "") {
    whereClause.action = action.trim();
  }

  if (targetEntity && targetEntity.trim() !== "") {
    whereClause.targetEntity = targetEntity.trim();
  }

  if (fromDate || toDate) {
    whereClause.createdAt = {};
    if (fromDate) {
      whereClause.createdAt.gte = new Date(fromDate);
    }
    if (toDate) {
      const end = new Date(toDate);
      if (toDate.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      whereClause.createdAt.lte = end;
    }
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where: whereClause }),
    prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Lấy chi tiết một bản ghi nhật ký kiểm toán theo ID.
 */
export async function getAuditLogByIdService(id: string) {
  const log = await prisma.auditLog.findUnique({
    where: { id },
  });

  if (!log) {
    throw new Error("Không tìm thấy bản ghi kiểm toán");
  }

  return log;
}

/**
 * Thống kê tổng hợp nhật ký kiểm toán cho trang Overview.
 */
export async function getAuditLogStatisticsService() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalCount, last24hCount, topActions] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({
      where: { createdAt: { gte: oneDayAgo } },
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
      take: 5,
    }),
  ]);

  return {
    totalCount,
    last24hCount,
    topActions: topActions.map((item) => ({
      action: item.action,
      count: item._count.action,
    })),
  };
}
