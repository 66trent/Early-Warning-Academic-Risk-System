"use client";

import { useState, useTransition } from "react";
import { listBatches, discardImportBatch } from "@/modules/data-import/actions/import.action";

// ==========================================
// Types
// ==========================================

interface BatchData {
  batches: Array<{
    id: string;
    dataType: string;
    source: string;
    sourceChecksum: string;
    status: string;
    totalRows: number;
    successRows: number;
    errorRows: number;
    originalFilePath: string;
    createdAt: string | Date;
    completedAt: string | Date | null;
    performer: { fullName: string; email: string };
    parentBatch: { id: string } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==========================================
// Status badges
// ==========================================

const STATUS_COLORS: Record<string, string> = {
  UPLOADING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  VALIDATING: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  STAGED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  LOADED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  RECONCILED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  DISCARDED: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

const STATUS_LABELS: Record<string, string> = {
  UPLOADING: "Đang tải lên",
  VALIDATING: "Đang kiểm tra",
  STAGED: "Chờ nạp",
  LOADED: "Đã nạp",
  RECONCILED: "Hoàn tất",
  REJECTED: "Bị từ chối",
  DISCARDED: "Đã hủy",
};

const DATA_TYPE_LABELS: Record<string, string> = {
  ENROLLMENT: "Đăng ký HP",
  ATTENDANCE: "Điểm danh",
  ASSESSMENT: "Kết quả HT",
  LMS_ASSIGNMENT: "Bài tập LMS",
  LMS_SUBMISSION: "Nộp bài LMS",
  LMS_EVENT: "Hoạt động LMS",
};

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ==========================================
// Component
// ==========================================

export function ImportBatchTable({ initialData }: { initialData: BatchData }) {
  const [data, setData] = useState<BatchData>(initialData);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [filterDataType, setFilterDataType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function refresh(page: number = currentPage) {
    startTransition(async () => {
      const result = await listBatches({
        page,
        pageSize: 20,
        dataType: filterDataType || undefined,
        status: filterStatus || undefined,
      });

      if (result.success && result.data) {
        setData(result.data as unknown as BatchData);
        setCurrentPage(page);
      }
    });
  }

  function handleDiscard(batchId: string) {
    if (!confirm("Bạn có chắc chắn muốn hủy batch này? Hành động này không thể hoàn tác.")) return;
    startTransition(async () => {
      const result = await discardImportBatch({ batchId });
      if (result.success) {
        refresh();
      } else {
        alert(result.error || "Lỗi khi hủy batch.");
      }
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 p-4 dark:border-neutral-700">
        <select
          value={filterDataType}
          onChange={(e) => {
            setFilterDataType(e.target.value);
            setTimeout(() => refresh(1), 0);
          }}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <option value="">Tất cả loại dữ liệu</option>
          {Object.entries(DATA_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setTimeout(() => refresh(1), 0);
          }}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          onClick={() => refresh(currentPage)}
          disabled={isPending}
          className="ml-auto rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-200 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          {isPending ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs tracking-wider text-neutral-500 uppercase dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Tổng dòng</th>
              <th className="px-4 py-3 text-right">Thành công</th>
              <th className="px-4 py-3 text-right">Lỗi</th>
              <th className="px-4 py-3">Người nhập</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.batches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-neutral-400">
                  Chưa có dữ liệu nhập nào.
                </td>
              </tr>
            ) : (
              data.batches.map((batch) => (
                <tr
                  key={batch.id}
                  className="transition hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                    {formatDate(batch.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      {DATA_TYPE_LABELS[batch.dataType] || batch.dataType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[batch.status] || "bg-neutral-100 text-neutral-600"}`}
                    >
                      {STATUS_LABELS[batch.status] || batch.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {batch.totalRows}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">
                    {batch.successRows}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {batch.errorRows > 0 ? (
                      <a
                        href={`/data-import/${batch.id}/errors`}
                        className="text-red-600 underline-offset-2 hover:underline dark:text-red-400"
                      >
                        {batch.errorRows}
                      </a>
                    ) : (
                      <span className="text-neutral-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {batch.performer.fullName}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {batch.errorRows > 0 && (
                        <a
                          href={`/data-import/${batch.id}/errors`}
                          className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
                        >
                          Xem lỗi
                        </a>
                      )}
                      {batch.status === "STAGED" && (
                        <button
                          onClick={() => handleDiscard(batch.id)}
                          disabled={isPending}
                          className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                        >
                          Hủy batch
                        </button>
                      )}
                      {batch.parentBatch && (
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                          Batch sửa lỗi
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <span className="text-sm text-neutral-500">
            Trang {data.page} / {data.totalPages} • Tổng {data.total} bản ghi
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => refresh(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
              className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-30 dark:border-neutral-600"
            >
              ← Trước
            </button>
            <button
              onClick={() => refresh(currentPage + 1)}
              disabled={currentPage >= data.totalPages || isPending}
              className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-30 dark:border-neutral-600"
            >
              Sau →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
