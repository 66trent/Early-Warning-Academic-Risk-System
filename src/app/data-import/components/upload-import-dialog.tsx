"use client";

import { useState, useRef, useTransition } from "react";
import { uploadImportFile } from "@/modules/data-import/actions/import.action";

const DATA_TYPE_OPTIONS = [
  { value: "ATTENDANCE", label: "Điểm danh" },
  { value: "ASSESSMENT", label: "Kết quả học tập" },
  { value: "LMS_ASSIGNMENT", label: "Bài tập LMS" },
  { value: "LMS_SUBMISSION", label: "Nộp bài LMS" },
  { value: "LMS_EVENT", label: "Hoạt động LMS" },
] as const;

export function UploadImportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [dataType, setDataType] = useState<string>("ATTENDANCE");
  const [file, setFile] = useState<File | null>(null);
  const [parentBatchId, setParentBatchId] = useState<string>("");
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("dataType", dataType);
    if (parentBatchId) formData.set("parentBatchId", parentBatchId);

    startTransition(async () => {
      const res = await uploadImportFile(formData);
      if (res.success && res.data) {
        setResult({
          success: true,
          message: `Nhập thành công: ${res.data.successRows}/${res.data.totalRows} dòng.`,
          details: res.data as unknown as Record<string, unknown>,
        });
      } else {
        setResult({
          success: false,
          message: res.error || "Lỗi không xác định.",
        });
      }
    });
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    setParentBatchId("");
    if (fileRef.current) fileRef.current.value = "";
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        Nhập dữ liệu mới
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Nhập dữ liệu
          </h2>
          <button
            onClick={() => {
              setIsOpen(false);
              handleReset();
            }}
            className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Loại dữ liệu <span className="text-red-500">*</span>
            </label>
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
            >
              {DATA_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              File CSV <span className="text-red-500">*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:file:bg-blue-900/30 dark:file:text-blue-400"
            />
            <p className="mt-1 text-xs text-neutral-400">
              File CSV theo đúng mẫu chuẩn. Xem hướng dẫn định dạng.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Batch gốc (nếu nhập lại sau sửa lỗi)
            </label>
            <input
              type="text"
              value={parentBatchId}
              onChange={(e) => setParentBatchId(e.target.value)}
              placeholder="ID batch gốc (tùy chọn)"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
            />
          </div>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              result.success
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {result.message}
            {result.success && result.details && (
              <div className="mt-2 text-xs opacity-80">
                Batch ID: {String(result.details.batchId)} • Trạng thái:{" "}
                {String(result.details.status)}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => {
              setIsOpen(false);
              handleReset();
            }}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Đóng
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isPending ? "Đang xử lý..." : "Nhập dữ liệu"}
          </button>
        </div>
      </div>
    </div>
  );
}
