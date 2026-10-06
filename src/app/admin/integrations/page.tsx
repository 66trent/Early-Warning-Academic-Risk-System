import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getIntegrationConfigsService } from "@/modules/admin/services/integration.service";
import { IntegrationsClient } from "./components/integrations-client";

export default async function AdminIntegrationsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user as Record<string, unknown>;
  const currentRole = (u.role as string) || "";

  if (currentRole !== "ADMIN") {
    redirect("/admin");
  }

  const configs = await getIntegrationConfigsService();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl dark:text-white">
          Cấu hình Kết nối Tích hợp LMS & SIS
        </h1>
        <p className="text-xs text-neutral-500 sm:text-sm">
          Quản trị thông số kết nối API tới Hệ thống Quản lý Đào tạo (SIS) và Hệ thống LMS (Moodle /
          Canvas), kiểm tra đường truyền và thiết lập lịch đồng bộ.
        </p>
      </div>

      <IntegrationsClient initialConfigs={configs} />
    </div>
  );
}
