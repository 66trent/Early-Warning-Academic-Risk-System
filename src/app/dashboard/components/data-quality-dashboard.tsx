"use client";

/**
 * Data Quality Dashboard — Chất lượng dữ liệu (DoD: đặt ở vị trí dễ thấy).
 * Hiển thị tỷ lệ lỗi import, số SV INSUFFICIENT, độ trễ đồng bộ.
 * Dùng màu xám/xanh dương theo 03-ui-design.md (MUST khác hoàn toàn với Severity).
 */

import { Database, AlertCircle, CheckCircle, XCircle, BarChart3, RefreshCw } from "lucide-react";

interface DataQualityMetrics {
  importErrorRate: number;
  totalImportBatches: number;
  totalErrorRows: number;
  totalSuccessRows: number;
  insufficientStudentCount: number;
  totalStudentWithScores: number;
  lastSyncAt: string | null;
  syncAgeHours: number | null;
  avgSyncDelayHours: number;
  batchStatusDistribution: Array<{ status: string; count: number }>;
  errorTypeDistribution: Array<{ reason: string; count: number }>;
}

const BATCH_STATUS_LABELS: Record<string, string> = {
  UPLOADING: "Đang tải",
  VALIDATING: "Đang kiểm tra",
  STAGED: "Chờ nạp",
  LOADED: "Đã nạp",
  RECONCILED: "Đã đối soát",
  REJECTED: "Từ chối",
  DISCARDED: "Đã hủy",
};

const ERROR_REASON_LABELS: Record<string, string> = {
  INVALID_FORMAT: "Sai định dạng",
  NOT_IN_CATALOG: "Không có trong danh mục",
  DUPLICATE: "Trùng lặp",
  OUT_OF_RANGE: "Ngoài phạm vi",
  NOT_ENROLLED: "Chưa đăng ký",
};

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  status,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  status: "good" | "warning" | "danger" | "neutral";
}) {
  const statusColors = {
    good: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30",
    warning: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30",
    danger: "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30",
    neutral: "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30",
  };

  const iconColors = {
    good: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-rose-600 dark:text-rose-400",
    neutral: "text-blue-600 dark:text-blue-400",
  };

  return (
    <div className={`rounded-lg border p-4 ${statusColors[status]}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColors[status]}`} />
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{title}</span>
      </div>
      <p className="mt-2 text-xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
  );
}

export function DataQualityDashboard({ data }: { data: DataQualityMetrics }) {
  const errorRateStatus: "good" | "warning" | "danger" =
    data.importErrorRate <= 2 ? "good" : data.importErrorRate <= 10 ? "warning" : "danger";

  const insufficientRatio =
    data.totalStudentWithScores > 0
      ? (data.insufficientStudentCount / data.totalStudentWithScores) * 100
      : 0;
  const insufficientStatus: "good" | "warning" | "danger" =
    insufficientRatio <= 5 ? "good" : insufficientRatio <= 20 ? "warning" : "danger";

  const syncAge = data.syncAgeHours;
  const syncStatus: "good" | "warning" | "danger" | "neutral" =
    syncAge === null ? "neutral" : syncAge <= 24 ? "good" : syncAge <= 72 ? "warning" : "danger";

  return (
    <div className="rounded-xl border-2 border-blue-200/60 bg-gradient-to-br from-blue-50/40 to-white p-6 shadow-sm dark:border-blue-900/40 dark:from-blue-950/20 dark:to-neutral-900">
      {/* Header nổi bật */}
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
          <Database className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Chất lượng Dữ liệu
          </h2>
          <p className="text-[11px] text-neutral-500">
            Giám sát tình trạng nhập liệu, đối soát và mức hoàn thiện dữ liệu
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Tỷ lệ lỗi nhập liệu"
          value={`${data.importErrorRate}%`}
          icon={data.importErrorRate <= 2 ? CheckCircle : XCircle}
          description={`${data.totalErrorRows.toLocaleString("vi-VN")} dòng lỗi / ${(data.totalErrorRows + data.totalSuccessRows).toLocaleString("vi-VN")} tổng`}
          status={errorRateStatus}
        />

        <MetricCard
          title="SV dữ liệu không đủ"
          value={data.insufficientStudentCount}
          icon={AlertCircle}
          description={`${insufficientRatio.toFixed(1)}% tổng SV có điểm (${data.totalStudentWithScores})`}
          status={insufficientStatus}
        />

        <MetricCard
          title="Đồng bộ gần nhất"
          value={
            data.lastSyncAt
              ? new Date(data.lastSyncAt).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Chưa có"
          }
          icon={RefreshCw}
          description={syncAge !== null ? `${syncAge} giờ trước` : "Chưa có lô nhập nào hoàn tất"}
          status={syncStatus}
        />

        <MetricCard
          title="Tổng lô nhập"
          value={data.totalImportBatches}
          icon={BarChart3}
          description={`Thời gian xử lý TB: ${data.avgSyncDelayHours}h`}
          status="neutral"
        />
      </div>

      {/* Distribution Details */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Batch Status Distribution */}
        {data.batchStatusDistribution.length > 0 && (
          <div className="rounded-lg border border-neutral-200/60 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <h4 className="mb-3 text-xs font-semibold text-neutral-600 uppercase dark:text-neutral-400">
              Trạng thái lô nhập
            </h4>
            <div className="space-y-2">
              {data.batchStatusDistribution.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">
                    {BATCH_STATUS_LABELS[item.status] || item.status}
                  </span>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Type Distribution */}
        {data.errorTypeDistribution.length > 0 && (
          <div className="rounded-lg border border-neutral-200/60 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <h4 className="mb-3 text-xs font-semibold text-neutral-600 uppercase dark:text-neutral-400">
              Phân loại lỗi nhập liệu
            </h4>
            <div className="space-y-2">
              {data.errorTypeDistribution.map((item) => (
                <div key={item.reason} className="flex items-center justify-between">
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">
                    {ERROR_REASON_LABELS[item.reason] || item.reason}
                  </span>
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
