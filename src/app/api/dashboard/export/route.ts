/**
 * Route Handler: Xuất báo cáo CSV Dashboard.
 * GET /api/dashboard/export?termId=...&departmentId=...&classId=...
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { exportReport } from "@/modules/dashboard/services/dashboard.service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập." }, { status: 401 });
    }

    const u = session.user as Record<string, unknown>;
    const role = (u.role as string) || "";
    if (role !== "TRAINING_OFFICER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const termId = searchParams.get("termId");
    if (!termId) {
      return NextResponse.json({ error: "Thiếu tham số termId." }, { status: 400 });
    }

    const departmentId = searchParams.get("departmentId") || undefined;
    const classId = searchParams.get("classId") || undefined;

    // Ghi audit log
    await writeAuditLog({
      actorId: (u.userId as string) || (u.id as string) || "",
      actorRole: role,
      action: "EXPORT_REPORT_CSV",
      targetEntity: "Dashboard",
      details: { termId, departmentId: departmentId || "ALL", classId: classId || "ALL" },
    });

    const result = await exportReport({
      termId,
      departmentId,
      classId,
      format: "csv",
    });

    if (result.format !== "csv" || typeof result.data !== "string") {
      return NextResponse.json({ error: "Lỗi tạo file CSV." }, { status: 500 });
    }

    const filename = `bao-cao-rui-ro_${termId}${departmentId ? `_${departmentId}` : ""}${classId ? `_${classId}` : ""}_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(result.data, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi server." },
      { status: 500 }
    );
  }
}
