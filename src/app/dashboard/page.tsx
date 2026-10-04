/**
 * Dashboard Page — Báo cáo tổng hợp cho Cán bộ QLĐT.
 * Server Component: dữ liệu tổng hợp sẵn ở server (DoD Phase 5).
 *
 * Chỉ TRAINING_OFFICER và ADMIN có quyền truy cập.
 * Dashboard chất lượng dữ liệu đặt ở vị trí dễ thấy (DoD Phase 5).
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import {
  getDashboardOverview,
  getRiskScoreTrend,
  getDataQualityMetrics,
  getAtRiskStudentList,
  getFilterOptions,
} from "@/modules/dashboard/services/dashboard.service";
import { KPICards, SeverityBreakdown } from "./components/kpi-cards";
import {
  RuleGroupChart,
  AlertStatusChart,
  RiskScoreTrendChart,
  DataCompletenessChart,
} from "./components/dashboard-charts";
import { DataQualityDashboard } from "./components/data-quality-dashboard";
import { AtRiskStudentTable } from "./components/at-risk-student-table";
import { ShieldCheck, LogOut, LayoutDashboard, AlertTriangle, FileText } from "lucide-react";

export default async function DashboardPage() {
  // 1. Kiểm tra session
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user as Record<string, unknown>;
  const actor = {
    id: (u.id as string) || (u.userId as string) || "",
    userId: (u.userId as string) || (u.id as string) || "",
    role: (u.role as string) || "",
    fullName: (u.fullName as string) || (u.name as string) || "",
    email: (u.email as string) || "",
    scopeConfig: u.scopeConfig,
  };

  // 2. Phân quyền
  if (actor.role !== "TRAINING_OFFICER" && actor.role !== "ADMIN") {
    if (actor.role === "STUDENT") redirect("/student/alerts");
    if (actor.role === "ADVISOR") redirect("/alerts");
    redirect("/login");
  }

  // 3. Tải dữ liệu tổng hợp song song (tổng hợp sẵn ở server — DoD)
  const [overview, trend, dataQuality, studentList, filterOptions] = await Promise.all([
    getDashboardOverview({}),
    getRiskScoreTrend({ days: 30 }),
    getDataQualityMetrics({ days: 30 }),
    getAtRiskStudentList({ page: 1, pageSize: 20 }),
    getFilterOptions(),
  ]);

  return (
    <div className="min-h-screen bg-neutral-50/60 pb-12 dark:bg-neutral-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="text-base tracking-tight">CTUET-EWARS</span>
            </Link>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
              Dashboard
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden flex-col text-right sm:flex">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {actor.fullName || actor.userId}
              </span>
              <span className="text-[11px] text-neutral-500">
                {actor.role === "TRAINING_OFFICER" ? "Cán bộ Đào tạo (QLĐT)" : "Quản trị viên"}
              </span>
            </div>

            {/* Navigation Links */}
            <nav className="flex items-center gap-1.5">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <Link
                href="/alerts"
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Cảnh báo
              </Link>
              <Link
                href="/data-import"
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <FileText className="h-3.5 w-3.5" />
                Nhập liệu
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-1 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                Đổi vai trò
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Tổng quan Hệ thống Cảnh báo Sớm
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            Báo cáo tổng hợp dành cho Cán bộ Quản lý Đào tạo · Dữ liệu cập nhật realtime
          </p>
        </div>

        {/* Disclaimer — bắt buộc theo 03-ui-design.md */}
        <div className="mb-6 rounded-lg border border-blue-200/60 bg-blue-50/40 px-4 py-2.5 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
          <strong>Cảnh báo sớm — mang tính tham khảo</strong>, không phải quyết định học vụ chính
          thức. Các chỉ số và cảnh báo nhằm hỗ trợ phát hiện dấu hiệu sớm để can thiệp kịp thời.
        </div>

        {/* ====================================================== */}
        {/* DATA QUALITY — Đặt ở vị trí dễ thấy (DoD Phase 5)     */}
        {/* ====================================================== */}
        <section className="mb-8">
          <DataQualityDashboard data={dataQuality} />
        </section>

        {/* KPI Cards */}
        <section className="mb-6">
          <KPICards data={overview.kpiCards} />
        </section>

        {/* Charts Grid */}
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SeverityBreakdown data={overview.kpiCards} />
          <RuleGroupChart data={overview.ruleGroupDistribution} />
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AlertStatusChart data={overview.alertStatusDistribution} />
          <DataCompletenessChart data={trend} />
        </section>

        {/* Risk Score Trend — Full Width */}
        <section className="mb-8">
          <RiskScoreTrendChart data={trend} />
        </section>

        {/* At-Risk Student Table */}
        <section className="mb-8">
          <AtRiskStudentTable
            initialData={studentList}
            filterOptions={filterOptions}
            exportTermId={filterOptions.terms[0]?.value}
          />
        </section>
      </main>
    </div>
  );
}
