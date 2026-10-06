import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { listAuditLogsService } from "@/modules/admin/services/audit.service";
import { AuditLogsClient } from "./components/audit-logs-client";

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    actorId?: string;
    action?: string;
    targetEntity?: string;
    fromDate?: string;
    toDate?: string;
    page?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user as Record<string, unknown>;
  const currentRole = (u.role as string) || "";

  if (currentRole !== "ADMIN" && currentRole !== "TRAINING_OFFICER") {
    redirect("/admin");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const page = parseInt(resolvedParams.page || "1", 10) || 1;

  const data = await listAuditLogsService({
    page,
    pageSize: 50,
    actorId: resolvedParams.actorId || undefined,
    action: resolvedParams.action || undefined,
    targetEntity: resolvedParams.targetEntity || undefined,
    fromDate: resolvedParams.fromDate || undefined,
    toDate: resolvedParams.toDate || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl dark:text-white">
          Nhật ký Kiểm toán Hệ thống (Audit Log)
        </h1>
        <p className="text-xs text-neutral-500 sm:text-sm">
          Lưu vết toàn bộ thao tác quản trị, thay đổi phân quyền, xử lý cảnh báo và nhập liệu. Dữ
          liệu bất biến chỉ ghi (Append-only).
        </p>
      </div>

      <AuditLogsClient
        initialData={data}
        initialFilter={{
          actorId: resolvedParams.actorId || "",
          action: resolvedParams.action || "",
          targetEntity: resolvedParams.targetEntity || "",
          fromDate: resolvedParams.fromDate || "",
          toDate: resolvedParams.toDate || "",
        }}
      />
    </div>
  );
}
