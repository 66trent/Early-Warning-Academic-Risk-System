"use client";

import { useState, useTransition } from "react";
import { AlertDetailModal, type AlertModalData } from "./alert-detail-modal";
import { Search, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { listAlertsAction } from "@/modules/alerts/actions/alert.action";

interface AlertsTableProps {
  initialData: {
    alerts: AlertModalData[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  currentUserId: string;
  currentUserRole: string;
}

export function AlertsTable({ initialData, currentUserRole }: AlertsTableProps) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [statusTab, setStatusTab] = useState<"NEED_ACTION" | "IN_PROGRESS" | "RESOLVED" | "ALL">(
    "NEED_ACTION"
  );
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<AlertModalData | null>(null);

  const applyFilters = (
    tab: "NEED_ACTION" | "IN_PROGRESS" | "RESOLVED" | "ALL",
    severity: string,
    search: string,
    page: number = 1
  ) => {
    let statuses:
      | Array<
          | "OPEN"
          | "ACKNOWLEDGED"
          | "IN_PROGRESS"
          | "RESOLVED"
          | "DISMISSED"
          | "INVALIDATED"
          | "REOPENED"
        >
      | undefined;
    if (tab === "NEED_ACTION") statuses = ["OPEN", "ACKNOWLEDGED"];
    else if (tab === "IN_PROGRESS") statuses = ["IN_PROGRESS"];
    else if (tab === "RESOLVED") statuses = ["RESOLVED", "DISMISSED"];

    const severities =
      severity === "ALL" ? undefined : [severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"];

    startTransition(async () => {
      const res = await listAlertsAction({
        page,
        pageSize: 20,
        statuses,
        severities,
        studentSearch: search.trim() || undefined,
      });

      if (res.success && res.data) {
        setData(res.data as unknown as typeof initialData);
      }
    });
  };

  const handleTabChange = (tab: "NEED_ACTION" | "IN_PROGRESS" | "RESOLVED" | "ALL") => {
    setStatusTab(tab);
    applyFilters(tab, selectedSeverity, searchQuery, 1);
  };

  const handleSeverityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sev = e.target.value;
    setSelectedSeverity(sev);
    applyFilters(statusTab, sev, searchQuery, 1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(statusTab, selectedSeverity, searchQuery, 1);
  };

  const reloadData = () => {
    applyFilters(statusTab, selectedSeverity, searchQuery, data.page);
    // Refresh modal alert if open
    if (selectedAlert) {
      listAlertsAction({
        page: data.page,
        pageSize: 20,
      }).then((res) => {
        if (res.success && res.data) {
          const updated = (res.data.alerts as unknown as AlertModalData[]).find(
            (a) => a.alertId === selectedAlert.alertId
          );
          if (updated) setSelectedAlert(updated);
        }
      });
    }
  };

  // Severity color styles according to 03-ui-design.md
  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900";
      case "HIGH":
        return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900";
      case "MEDIUM":
        return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  // Status badge styles
  const getStatusBadgeClass = (st: string) => {
    switch (st) {
      case "OPEN":
        return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
      case "ACKNOWLEDGED":
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300";
      case "IN_PROGRESS":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300";
      case "RESOLVED":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "DISMISSED":
        return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  // DataCompletenessLevel colors (distinct from Severity, 03-ui-design.md)
  const getCompletenessBadgeClass = (level?: string) => {
    switch (level) {
      case "FULL":
        return "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
      case "PARTIAL":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300";
      case "INSUFFICIENT":
        return "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300";
      default:
        return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Policy Disclaimer Banner */}
      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Lưu ý:</strong> Cảnh báo sớm — mang tính tham khảo, không phải quyết định học vụ
            chính thức.
          </span>
        </div>
        <span className="hidden text-[11px] text-amber-700 sm:inline dark:text-amber-400">
          Dành riêng cho {currentUserRole === "ADVISOR" ? "Cố vấn học tập" : "Cán bộ đào tạo"}
        </span>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tabs */}
        <div className="inline-flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            onClick={() => handleTabChange("NEED_ACTION")}
            className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              statusTab === "NEED_ACTION"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Cần xử lý (Mở / Đã xác nhận)
          </button>
          <button
            onClick={() => handleTabChange("IN_PROGRESS")}
            className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              statusTab === "IN_PROGRESS"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Đang xử lý
          </button>
          <button
            onClick={() => handleTabChange("RESOLVED")}
            className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              statusTab === "RESOLVED"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Đã đóng / Bác bỏ
          </button>
          <button
            onClick={() => handleTabChange("ALL")}
            className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              statusTab === "ALL"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Tất cả
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Severity selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500">Mức độ:</span>
            <select
              value={selectedSeverity}
              onChange={handleSeverityChange}
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="CRITICAL">CRITICAL (Rất cao)</option>
              <option value="HIGH">HIGH (Cao)</option>
              <option value="MEDIUM">MEDIUM (Trung bình)</option>
              <option value="LOW">LOW (Thấp)</option>
            </select>
          </div>

          {/* Search box */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Tìm theo MSSV hoặc họ tên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-lg border border-neutral-300 bg-white py-1.5 pr-3 pl-8 text-xs sm:w-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-neutral-400" />
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200 bg-neutral-50/75 dark:border-neutral-800 dark:bg-neutral-800/40">
              <tr>
                <th className="px-4 py-3.5 font-semibold text-neutral-700 dark:text-neutral-300">
                  Sinh viên
                </th>
                <th className="px-4 py-3.5 font-semibold text-neutral-700 dark:text-neutral-300">
                  Mức độ
                </th>
                <th className="px-4 py-3.5 font-semibold text-neutral-700 dark:text-neutral-300">
                  Dấu hiệu chính
                </th>
                <th className="px-4 py-3.5 font-semibold text-neutral-700 dark:text-neutral-300">
                  Điểm rủi ro & Độ tin cậy
                </th>
                <th className="px-4 py-3.5 font-semibold text-neutral-700 dark:text-neutral-300">
                  Trạng thái
                </th>
                <th className="px-4 py-3.5 font-semibold text-neutral-700 dark:text-neutral-300">
                  Phát hiện lúc
                </th>
                <th className="px-4 py-3.5 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-neutral-500">
                    Chưa có sinh viên nào cần chú ý trong phạm vi lọc này.
                  </td>
                </tr>
              ) : (
                data.alerts.map((alert) => {
                  const riskScoreObj = (
                    alert as unknown as {
                      riskScoreLog?: {
                        riskScoreValue?: number | null;
                        dataCompletenessLevel?: string;
                      };
                    }
                  ).riskScoreLog;
                  return (
                    <tr
                      key={alert.alertId}
                      onClick={() => setSelectedAlert(alert)}
                      className="cursor-pointer transition hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40"
                    >
                      {/* Sinh viên */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {alert.student?.fullName}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {alert.studentId} • {alert.student?.classId}
                        </div>
                      </td>

                      {/* Mức độ */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold ${getSeverityBadgeClass(alert.severity)}`}
                        >
                          {alert.severity}
                        </span>
                      </td>

                      {/* Dấu hiệu */}
                      <td className="max-w-xs px-4 py-3.5">
                        {alert.ruleTriggers && alert.ruleTriggers.length > 0 ? (
                          <div>
                            <div className="line-clamp-1 font-medium text-neutral-900 dark:text-neutral-100">
                              {alert.ruleTriggers[0]?.reason}
                            </div>
                            {alert.ruleTriggers.length > 1 && (
                              <span className="text-[10px] text-neutral-500">
                                + {alert.ruleTriggers.length - 1} dấu hiệu khác
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Điểm rủi ro & Completeness */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                            {riskScoreObj?.riskScoreValue !== null &&
                            riskScoreObj?.riskScoreValue !== undefined
                              ? Number(riskScoreObj.riskScoreValue).toFixed(2)
                              : "N/A"}
                          </span>
                          {riskScoreObj?.dataCompletenessLevel && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getCompletenessBadgeClass(riskScoreObj.dataCompletenessLevel)}`}
                            >
                              {riskScoreObj.dataCompletenessLevel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${getStatusBadgeClass(alert.status)}`}
                        >
                          {alert.status}
                        </span>
                      </td>

                      {/* Thời điểm */}
                      <td className="px-4 py-3.5 text-[11px] text-neutral-500">
                        {new Date(alert.lastDetectedAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Thao tác */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAlert(alert);
                          }}
                          className="cursor-pointer rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                        >
                          Chi tiết & Can thiệp
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800">
            <div>
              Hiển thị {data.alerts.length} / {data.total} cảnh báo
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={data.page <= 1 || isPending}
                onClick={() =>
                  applyFilters(statusTab, selectedSeverity, searchQuery, data.page - 1)
                }
                className="cursor-pointer rounded p-1 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2">
                Trang {data.page} / {data.totalPages}
              </span>
              <button
                disabled={data.page >= data.totalPages || isPending}
                onClick={() =>
                  applyFilters(statusTab, selectedSeverity, searchQuery, data.page + 1)
                }
                className="cursor-pointer rounded p-1 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal chi tiết và can thiệp (≤2 clicks) */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onStatusUpdated={reloadData}
        />
      )}
    </div>
  );
}
