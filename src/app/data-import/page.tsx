import { listBatches } from "@/modules/data-import/actions/import.action";
import { getSession } from "@/lib/session";
import { ImportBatchTable } from "./components/import-batch-table";
import { UploadImportDialog } from "./components/upload-import-dialog";
import Link from "next/link";

export default async function DataImportPage() {
  const [session, result] = await Promise.all([
    getSession(),
    listBatches({ page: 1, pageSize: 20 }),
  ]);

  const batchData =
    result.success && result.data
      ? result.data
      : { batches: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Session warning or user info banner */}
      {!session ? (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <span className="font-semibold">⚠️ Bạn chưa đăng nhập:</span>
            <span>
              Cần đăng nhập tài khoản Cán bộ Đào tạo (QLĐT) hoặc Quản trị viên để thực hiện nhập dữ
              liệu.
            </span>
          </div>
          <Link
            href="/login"
            className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white transition hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            Đăng nhập ngay →
          </Link>
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <span>
              Đang đăng nhập:{" "}
              <strong>
                {"name" in session.user && session.user.name ? session.user.name : session.user.id}
              </strong>{" "}
              ({session.user.role})
            </span>
          </div>
          <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
            Đổi vai trò khác
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Nhập dữ liệu
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Quản lý các lần nhập và đồng bộ dữ liệu điểm danh, kết quả học tập, hoạt động LMS.
          </p>
        </div>
        <UploadImportDialog />
      </div>

      {/* Batch List Table */}
      <ImportBatchTable initialData={batchData} />
    </div>
  );
}
