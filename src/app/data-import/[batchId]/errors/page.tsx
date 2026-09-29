import { getErrorRows } from "@/modules/data-import/actions/import.action";
import { ErrorRowsTable } from "./components/error-rows-table";
import Link from "next/link";

export default async function BatchErrorsPage(props: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await props.params;
  const result = await getErrorRows({ batchId, page: 1, pageSize: 50 });

  const errorData =
    result.success && result.data
      ? result.data
      : { errors: [], total: 0, page: 1, pageSize: 50, totalPages: 0, batch: null };

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/data-import" className="hover:text-blue-600 dark:hover:text-blue-400">
          Nhập dữ liệu
        </Link>
        <span className="mx-2">→</span>
        <span className="text-neutral-700 dark:text-neutral-200">
          Dòng lỗi batch {batchId.slice(0, 8)}…
        </span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Chi tiết dòng lỗi
        </h1>
        {errorData.batch && (
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-600 dark:text-neutral-400">
            <span>
              Loại: <strong>{errorData.batch.dataType}</strong>
            </span>
            <span>
              Trạng thái: <strong>{errorData.batch.status}</strong>
            </span>
            <span>
              Tổng dòng: <strong>{errorData.batch.totalRows}</strong>
            </span>
            <span>
              Dòng lỗi:{" "}
              <strong className="text-red-600 dark:text-red-400">
                {errorData.batch.errorRows}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Error Table */}
      <ErrorRowsTable
        batchId={batchId}
        initialData={{
          errors: errorData.errors as Array<{
            id: string;
            sourceRowNumber: number;
            rawData: Record<string, unknown>;
            errorReason: string;
            resolved: boolean;
          }>,
          total: errorData.total,
          page: errorData.page,
          pageSize: errorData.pageSize,
          totalPages: errorData.totalPages,
        }}
      />
    </div>
  );
}
