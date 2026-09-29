import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { assertScope } from "@/lib/authz";
import { exportErrorRowsAsCSV } from "@/modules/data-import/services/import.service";

/**
 * GET /api/data-import/[batchId]/errors/export
 * Export dòng lỗi của batch dưới dạng CSV file.
 * Route Handler (GET) đúng quy định 01-architecture.md cho export file.
 */
export async function GET(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    // 1. Session
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập." }, { status: 401 });
    }

    // 2. Authorization
    await assertScope(session.user, { resourceType: "ImportBatch", action: "READ" });

    // 3. Generate CSV
    const { batchId } = await context.params;
    const csvContent = await exportErrorRowsAsCSV(batchId);

    if (!csvContent) {
      return NextResponse.json({ error: "Không có dòng lỗi nào." }, { status: 404 });
    }

    // 4. Return as downloadable CSV
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="errors_${batchId.slice(0, 8)}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
