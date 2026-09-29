import { listBatches } from "@/modules/data-import/actions/import.action";
import { ImportBatchTable } from "./components/import-batch-table";
import { UploadImportDialog } from "./components/upload-import-dialog";

export default async function DataImportPage() {
  const result = await listBatches({ page: 1, pageSize: 20 });
  const batchData =
    result.success && result.data
      ? result.data
      : { batches: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };

  return (
    <div className="mx-auto max-w-7xl p-6">
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
