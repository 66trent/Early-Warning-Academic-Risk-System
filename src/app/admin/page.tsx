import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuditLogStatisticsService } from "@/modules/admin/services/audit.service";
import { getIntegrationConfigsService } from "@/modules/admin/services/integration.service";
import { listPendingRuleVersionsService } from "@/modules/admin/services/rule-approval.service";
import { Users, Server, Sliders, History } from "lucide-react";

export default async function AdminOverviewPage() {
  // Tải dữ liệu tổng quan song song
  const [userCounts, auditStats, integrations, pendingRules] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      _count: { role: true },
    }),
    getAuditLogStatisticsService(),
    getIntegrationConfigsService(),
    listPendingRuleVersionsService(),
  ]);

  const totalUsers = userCounts.reduce((acc, curr) => acc + curr._count.role, 0);
  const studentCount = userCounts.find((u) => u.role === "STUDENT")?._count.role || 0;
  const advisorCount = userCounts.find((u) => u.role === "ADVISOR")?._count.role || 0;
  const trainingOfficerCount =
    userCounts.find((u) => u.role === "TRAINING_OFFICER")?._count.role || 0;
  const adminCount = userCounts.find((u) => u.role === "ADMIN")?._count.role || 0;

  // Lấy 5 bản ghi kiểm toán gần nhất
  const recentLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-6 shadow-xs dark:border-indigo-950 dark:from-indigo-950/30 dark:via-neutral-900 dark:to-blue-950/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl dark:text-white">
              Bảng Điều khiển Quản trị Hệ thống
            </h1>
            <p className="text-xs text-neutral-600 sm:text-sm dark:text-neutral-400">
              Giám sát hạ tầng xác thực, tích hợp nguồn dữ liệu SIS/LMS, thẩm định luật học vụ và
              nhật ký kiểm toán.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Hệ thống Hoạt động Ổn định
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Users */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Tổng Tài khoản
            </span>
            <span className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900 dark:text-white">
              {totalUsers}
            </span>
            <span className="text-xs text-neutral-500">người dùng</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-500">
            <span>SV: {studentCount}</span>
            <span>•</span>
            <span>CVHT: {advisorCount}</span>
            <span>•</span>
            <span>QLĐT: {trainingOfficerCount}</span>
            <span>•</span>
            <span>Admin: {adminCount}</span>
          </div>
        </div>

        {/* Card 2: Pending Rules */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Luật Chờ Phê duyệt
            </span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Sliders className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900 dark:text-white">
              {pendingRules.length}
            </span>
            <span className="text-xs text-neutral-500">phiên bản nháp</span>
          </div>
          <div className="mt-3 text-[11px] text-neutral-500">
            {pendingRules.length > 0 ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Yêu cầu Separation of Duties khi duyệt
              </span>
            ) : (
              <span className="font-medium text-emerald-600">Toàn bộ phiên bản đã duyệt</span>
            )}
          </div>
        </div>

        {/* Card 3: Integrations */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Kết nối Tích hợp (SIS/LMS)
            </span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Server className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900 dark:text-white">
              {integrations.filter((i) => i.isEnabled).length} / {integrations.length}
            </span>
            <span className="text-xs text-neutral-500">đang kích hoạt</span>
          </div>
          <div className="mt-3 text-[11px] text-neutral-500">SIS API, Moodle REST & Canvas</div>
        </div>

        {/* Card 4: Audit Logs 24h */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Nhật ký Kiểm toán (24h)
            </span>
            <span className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <History className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900 dark:text-white">
              {auditStats.last24hCount}
            </span>
            <span className="text-xs text-neutral-500">thao tác ghi nhận</span>
          </div>
          <div className="mt-3 text-[11px] text-neutral-500">
            Tổng cộng: {auditStats.totalCount} bản ghi append-only
          </div>
        </div>
      </div>

      {/* Grid: Integrations Status & Recent Audits */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trạng thái Tích hợp */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Trạng thái Tích hợp Nguồn Dữ liệu
              </h2>
            </div>
            <Link
              href="/admin/integrations"
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Cấu hình &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {integrations.map((item) => (
              <div
                key={item.systemType}
                className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/60 p-3.5 dark:border-neutral-800/60 dark:bg-neutral-950/40"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                      {item.name}
                    </span>
                    <span className="py-0.2 rounded bg-neutral-200 px-1 font-mono text-[10px] dark:bg-neutral-800">
                      {item.systemType}
                    </span>
                  </div>
                  <div className="max-w-xs truncate font-mono text-[11px] text-neutral-500">
                    {item.baseUrl}
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.isEnabled
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {item.isEnabled ? "Kích hoạt" : "Tạm ngắt"}
                  </span>
                  <div className="mt-1 text-[10px] text-neutral-400">
                    Lịch: {item.syncSchedule || "Chưa đặt"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nhật ký Kiểm toán Gần đây */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Hoạt động Kiểm toán Gần đây
              </h2>
            </div>
            <Link
              href="/admin/audit-logs"
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Xem tất cả &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-500">
                Chưa có bản ghi kiểm toán nào được tạo.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between rounded-lg border border-neutral-100 bg-neutral-50/60 p-3 text-xs dark:border-neutral-800/60 dark:bg-neutral-950/40"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {log.action}
                      </span>
                      <span className="py-0.2 rounded bg-neutral-200 px-1 font-mono text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        {log.targetEntity}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Bởi <span className="font-mono font-medium">{log.actorId}</span> (
                      {log.actorRole})
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-neutral-400">
                    {new Date(log.createdAt).toLocaleTimeString("vi-VN")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/users"
          className="group flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition hover:border-indigo-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-700"
        >
          <div className="space-y-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:scale-105 dark:bg-blue-950/50 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Quản lý Tài khoản
            </h3>
            <p className="text-xs text-neutral-500">
              CRUD người dùng, gán phạm vi phụ trách scopeConfig, bảo vệ chống Elevation of
              Privilege.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 transition group-hover:translate-x-1 dark:text-indigo-400">
            Truy cập &rarr;
          </div>
        </Link>

        <Link
          href="/admin/integrations"
          className="group flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition hover:border-indigo-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-700"
        >
          <div className="space-y-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:scale-105 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Server className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Tích hợp Ngoại vi
            </h3>
            <p className="text-xs text-neutral-500">
              Cấu hình endpoint SIS, Moodle/Canvas LMS, kiểm tra kết nối API an toàn.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 transition group-hover:translate-x-1 dark:text-indigo-400">
            Truy cập &rarr;
          </div>
        </Link>

        <Link
          href="/admin/rules"
          className="group flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition hover:border-indigo-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-700"
        >
          <div className="space-y-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:scale-105 dark:bg-amber-950/50 dark:text-amber-400">
              <Sliders className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Phê duyệt Luật</h3>
            <p className="text-xs text-neutral-500">
              Quy trình duyệt RuleVersion với nguyên tắc Separation of Duties nghiêm ngặt.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 transition group-hover:translate-x-1 dark:text-indigo-400">
            Truy cập &rarr;
          </div>
        </Link>

        <Link
          href="/admin/audit-logs"
          className="group flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition hover:border-indigo-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-700"
        >
          <div className="space-y-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition group-hover:scale-105 dark:bg-purple-950/50 dark:text-purple-400">
              <History className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Nhật ký Kiểm toán
            </h3>
            <p className="text-xs text-neutral-500">
              Tra cứu hồ sơ bất biến append-only, chống chối bỏ (Repudiation protection).
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 transition group-hover:translate-x-1 dark:text-indigo-400">
            Truy cập &rarr;
          </div>
        </Link>
      </div>
    </div>
  );
}
