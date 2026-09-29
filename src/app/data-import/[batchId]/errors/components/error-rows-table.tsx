"use client";

import { useState, useTransition } from "react";
import { getErrorRows, exportErrors } from "@/modules/data-import/actions/import.action";

// ==========================================
// Types
// ==========================================

interface ErrorRow {
  id: string;
  sourceRowNumber: number;
  rawData: Record<string, unknown>;
  errorReason: string;
  resolved: boolean;
}

interface ErrorData {
  errors: ErrorRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==========================================
// Error reason badges — Đỏ nhạt theo 03-ui-design.md
// ==========================================

const ERROR_REASON_LABELS: Record<string, string> = {
  INVALID_FORMAT: "Định dạng sai",
  NOT_IN_CATALOG: "Không tồn tại",
  DUPLICATE: "Trùng lặp",
  OUT_OF_RANGE: "Ngoài phạm vi",
  NOT_ENROLLED: "Chưa đăng ký",
};

// ==========================================
// Component
// ==========================================

export function ErrorRowsTable({
  batchId,
  initialData,
}: {
  batchId: string;
  initialData: ErrorData;
}) {
  const [data, setData] = useState<ErrorData>(initialData);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [isPending, startTransition] = useTransition();

  function refresh(page: number) {
    startTransition(async () => {
      const result = await getErrorRows({
        batchId,
        page,
        pageSize: 50,
      });

      if (result.success && result.data) {
        setData({
          errors: result.data.errors as unknown as ErrorRow[],
          total: result.data.total,
          page: result.data.page,
          pageSize: result.data.pageSize,
          totalPages: result.data.totalPages,
        });
        setCurrentPage(page);
      }
    });
  }

  function handleDownloadCSV() {
    startTransition(async () => {
      const result = await exportErrors({ batchId });
      if (result.success && result.data) {
        const blob = new Blob([result.data.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `errors_${batchId.slice(0, 8)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      {/* Toolbar — nút Tải xuống ở đầu bảng theo 03-ui-design.md */}
      <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-700">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {data.total} dòng lỗi
        </span>
        <button
          onClick={handleDownloadCSV}
          disabled={isPending || data.errors.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Tải xuống CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs tracking-wider text-neutral-500 uppercase dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3">Dòng</th>
              <th className="px-4 py-3">Lý do lỗi</th>
              <th className="px-4 py-3">Dữ liệu gốc</th>
              <th className="px-4 py-3">Đã sửa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.errors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-neutral-400">
                  Không có dòng lỗi nào.
                </td>
              </tr>
            ) : (
              data.errors.map((error) => (
                <tr
                  key={error.id}
                  className="transition hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 font-mono text-neutral-700 dark:text-neutral-300">
                    {error.sourceRowNumber}
                  </td>
                  <td className="px-4 py-3">
                    {/* Badge đỏ nhạt theo 03-ui-design.md */}
                    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                      {ERROR_REASON_LABELS[error.errorReason] || error.errorReason}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <pre className="overflow-x-auto rounded bg-neutral-100 p-2 text-xs whitespace-pre-wrap text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                      {JSON.stringify(error.rawData, null, 2)}
                    </pre>
                  </td>
                  <td className="px-4 py-3">
                    {error.resolved ? (
                      <span className="text-green-600 dark:text-green-400">✓</span>
                    ) : (
                      <span className="text-neutral-300 dark:text-neutral-600">—</span>
                    )}
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
            Trang {data.page} / {data.totalPages}
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
