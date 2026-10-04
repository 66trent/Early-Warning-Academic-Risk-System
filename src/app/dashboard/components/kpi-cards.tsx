"use client";

/**
 * KPI Summary Cards — Hiển thị các chỉ số tổng hợp chính.
 * Dùng shadcn Card + Tailwind CSS, KHÔNG dùng Tremor cho KPI cards đơn giản.
 */

import { Users, AlertTriangle, ShieldAlert, CheckCircle2, Clock } from "lucide-react";

interface KPIData {
  totalStudents: number;
  totalActiveAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  resolvedLast7Days: number;
  avgResponseTimeHours: number | null;
}

interface KPICardsProps {
  data: KPIData;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass,
  accentClass,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  accentClass: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-neutral-200/60 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            {title}
          </p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${colorClass}`}>{value}</p>
          {subtitle && (
            <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">{subtitle}</p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {/* Subtle accent line */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 w-full ${accentClass} opacity-60 transition-opacity group-hover:opacity-100`}
      />
    </div>
  );
}

export function KPICards({ data }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Tổng sinh viên"
        value={data.totalStudents.toLocaleString("vi-VN")}
        subtitle="Đang theo học (ACTIVE)"
        icon={Users}
        colorClass="text-neutral-900 dark:text-neutral-100"
        accentClass="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
      />

      <KPICard
        title="Cảnh báo đang hoạt động"
        value={data.totalActiveAlerts}
        subtitle={`${data.criticalAlerts} nghiêm trọng · ${data.highAlerts} cao`}
        icon={AlertTriangle}
        colorClass={
          data.criticalAlerts > 0
            ? "text-red-700 dark:text-red-400"
            : "text-amber-700 dark:text-amber-400"
        }
        accentClass={
          data.criticalAlerts > 0
            ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
            : "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
        }
      />

      <KPICard
        title="Đã giải quyết (7 ngày)"
        value={data.resolvedLast7Days}
        subtitle="Cảnh báo đã xử lý xong"
        icon={CheckCircle2}
        colorClass="text-emerald-700 dark:text-emerald-400"
        accentClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
      />

      <KPICard
        title="Thời gian phản hồi TB"
        value={data.avgResponseTimeHours !== null ? `${data.avgResponseTimeHours}h` : "—"}
        subtitle={
          data.avgResponseTimeHours !== null
            ? "Từ phát hiện → can thiệp đầu tiên"
            : "Chưa có dữ liệu"
        }
        icon={
          data.avgResponseTimeHours !== null && data.avgResponseTimeHours > 48 ? ShieldAlert : Clock
        }
        colorClass={
          data.avgResponseTimeHours !== null && data.avgResponseTimeHours > 48
            ? "text-orange-700 dark:text-orange-400"
            : "text-indigo-700 dark:text-indigo-400"
        }
        accentClass={
          data.avgResponseTimeHours !== null && data.avgResponseTimeHours > 48
            ? "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
            : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
        }
      />
    </div>
  );
}

// ==========================================
// Severity Breakdown — compact row under KPI
// ==========================================

export function SeverityBreakdown({ data }: { data: KPIData }) {
  const items = [
    {
      label: "Nghiêm trọng",
      count: data.criticalAlerts,
      bgClass: "bg-red-100 dark:bg-red-900/40",
      textClass: "text-red-700 dark:text-red-300",
      barClass: "bg-red-500",
    },
    {
      label: "Cao",
      count: data.highAlerts,
      bgClass: "bg-orange-100 dark:bg-orange-900/40",
      textClass: "text-orange-700 dark:text-orange-300",
      barClass: "bg-orange-500",
    },
    {
      label: "Trung bình",
      count: data.mediumAlerts,
      bgClass: "bg-amber-100 dark:bg-amber-900/40",
      textClass: "text-amber-700 dark:text-amber-300",
      barClass: "bg-amber-500",
    },
    {
      label: "Thấp",
      count: data.lowAlerts,
      bgClass: "bg-slate-100 dark:bg-slate-800/60",
      textClass: "text-slate-700 dark:text-slate-300",
      barClass: "bg-slate-400",
    },
  ];

  const total = data.totalActiveAlerts || 1;

  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Phân bố mức độ nghiêm trọng
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className={`w-24 text-xs font-medium ${item.textClass}`}>{item.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className={`h-full rounded-full ${item.barClass} transition-all duration-500`}
                style={{
                  width: `${Math.max((item.count / total) * 100, item.count > 0 ? 3 : 0)}%`,
                }}
              />
            </div>
            <span
              className={`min-w-[32px] rounded-md px-2 py-0.5 text-center text-xs font-bold ${item.bgClass} ${item.textClass}`}
            >
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
