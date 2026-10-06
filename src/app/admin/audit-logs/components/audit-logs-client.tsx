"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Search, Eye, X } from "lucide-react";
import type { PaginatedAuditLogsResult } from "@/modules/admin/services/audit.service";

type AuditLogItem = PaginatedAuditLogsResult["logs"][number];

interface AuditLogsClientProps {
  initialData: PaginatedAuditLogsResult;
  initialFilter: {
    actorId: string;
    action: string;
    targetEntity: string;
    fromDate: string;
    toDate: string;
  };
}

export function AuditLogsClient({ initialData, initialFilter }: AuditLogsClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [filter, setFilter] = useState(initialFilter);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (filter.actorId) params.set("actorId", filter.actorId);
      if (filter.action) params.set("action", filter.action);
      if (filter.targetEntity) params.set("targetEntity", filter.targetEntity);
      if (filter.fromDate) params.set("fromDate", filter.fromDate);
      if (filter.toDate) params.set("toDate", filter.toDate);
      router.push(`/admin/audit-logs?${params.toString()}`);
    });
  };

  const handleResetFilter = () => {
    setFilter({
      actorId: "",
      action: "",
      targetEntity: "",
      fromDate: "",
      toDate: "",
    });
    startTransition(() => {
      router.push("/admin/audit-logs");
    });
  };

  const getActionBadge = (action: string) => {
    if (action.includes("CREATE")) {
      return (
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
          {action}
        </span>
      );
    }
    if (action.includes("UPDATE") || action.includes("CHANGE")) {
      return (
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
          {action}
        </span>
      );
    }
    if (action.includes("DELETE") || action.includes("DISMISS")) {
      return (
        <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
          {action}
        </span>
      );
    }
    if (action.includes("APPROVE")) {
      return (
        <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">
          {action}
        </span>
      );
    }
    return (
      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Append-only Integrity Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-xs text-indigo-900 shadow-xs dark:border-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-200">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div className="space-y-1">
          <div className="text-sm font-bold">Cơ chế Kiểm toán Bất biến (Append-Only Guarantee)</div>
          <p className="text-[11px] leading-relaxed text-indigo-800/90 dark:text-indigo-300/90">
            Hệ thống tuân thủ tuyệt đối quy định của Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15 và
            Nghị định 356/2025/NĐ-CP. Mọi thao tác quản trị, truy cập hồ sơ nhạy cảm, thay đổi vai
            trò hoặc thẩm định quy tắc đều được ghi vết và niêm phong thời gian.{" "}
            <strong>
              Hệ thống không cung cấp bất kỳ API hoặc công cụ nào cho phép sửa đổi hoặc xóa nhật ký
              kiểm toán.
            </strong>
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <form
          onSubmit={handleFilterSubmit}
          className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-6"
        >
          <div>
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">
              Người thực hiện
            </label>
            <input
              type="text"
              placeholder="VD: ADMIN001"
              value={filter.actorId}
              onChange={(e) => setFilter({ ...filter, actorId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 font-mono dark:border-neutral-800 dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">
              Hành động
            </label>
            <input
              type="text"
              placeholder="VD: UPDATE_USER"
              value={filter.action}
              onChange={(e) => setFilter({ ...filter, action: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 font-mono dark:border-neutral-800 dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">
              Thực thể bị tác động
            </label>
            <input
              type="text"
              placeholder="VD: User, RuleVersion"
              value={filter.targetEntity}
              onChange={(e) => setFilter({ ...filter, targetEntity: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 font-mono dark:border-neutral-800 dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">Từ ngày</label>
            <input
              type="date"
              value={filter.fromDate}
              onChange={(e) => setFilter({ ...filter, fromDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">Đến ngày</label>
            <input
              type="date"
              value={filter.toDate}
              onChange={(e) => setFilter({ ...filter, toDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-950"
            />
          </div>

          <div className="flex items-end gap-1.5">
            <button
              type="submit"
              className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-indigo-600 py-2 font-semibold text-white shadow-xs hover:bg-indigo-700"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Lọc</span>
            </button>
            <button
              type="button"
              onClick={handleResetFilter}
              className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 font-semibold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400"
              title="Đặt lại bộ lọc"
            >
              Đặt lại
            </button>
          </div>
        </form>
      </div>

      {/* Audit Logs Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Thời gian ghi nhận</th>
                <th className="px-5 py-3.5 font-semibold">Người thực hiện</th>
                <th className="px-5 py-3.5 font-semibold">Vai trò</th>
                <th className="px-5 py-3.5 font-semibold">Hành động</th>
                <th className="px-5 py-3.5 font-semibold">Đối tượng tác động</th>
                <th className="px-5 py-3.5 font-semibold">Địa chỉ IP</th>
                <th className="px-5 py-3.5 text-right font-semibold">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-mono text-[11px] dark:divide-neutral-800/60">
              {initialData.logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center font-sans text-xs text-neutral-500">
                    Không tìm thấy bản ghi kiểm toán nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                initialData.logs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40"
                  >
                    <td className="px-5 py-3.5 text-neutral-500">
                      {new Date(log.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-neutral-900 dark:text-white">
                      {log.actorId}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-300">
                      {log.actorRole}
                    </td>
                    <td className="px-5 py-3.5">{getActionBadge(log.action)}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {log.targetEntity}
                      </span>
                      {log.targetId && (
                        <span className="ml-1 text-neutral-400">#{log.targetId}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-400">{log.ipAddress || "—"}</td>
                    <td className="px-5 py-3.5 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Xem</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50/50 px-5 py-3 font-sans text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div>
            Hiển thị {initialData.logs.length} / tổng số {initialData.total} bản ghi kiểm toán
          </div>
          <div>
            Trang {initialData.page} / {initialData.totalPages}
          </div>
        </div>
      </div>

      {/* Modal Xem Chi tiết Log */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Chi tiết Bản ghi Kiểm toán
                </h3>
                <p className="font-mono text-[11px] text-neutral-400">ID: {selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="cursor-pointer text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <div>
                  <span className="text-neutral-500">Người thực hiện:</span>
                  <div className="mt-0.5 font-mono font-bold">
                    {selectedLog.actorId} ({selectedLog.actorRole})
                  </div>
                </div>
                <div>
                  <span className="text-neutral-500">Thời gian ghi nhận:</span>
                  <div className="mt-0.5 font-mono">
                    {new Date(selectedLog.createdAt).toLocaleString("vi-VN")}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-500">Hành động:</span>
                  <div className="mt-0.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedLog.action}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-500">Đối tượng:</span>
                  <div className="mt-0.5 font-mono">
                    {selectedLog.targetEntity}{" "}
                    {selectedLog.targetId ? `#${selectedLog.targetId}` : ""}
                  </div>
                </div>
              </div>

              <div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Dữ liệu Chi tiết (Payload JSON Snapshot):
                </span>
                <pre className="mt-1 max-h-56 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-400">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>

              {selectedLog.userAgent && (
                <div>
                  <span className="text-[11px] text-neutral-400">User-Agent:</span>
                  <p className="truncate font-mono text-[10px] text-neutral-500">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="cursor-pointer rounded-lg bg-neutral-200 px-4 py-2 font-semibold text-neutral-800 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
