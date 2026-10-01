import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { listAlerts } from "@/modules/alerts/services/alert-query.service";
import { AlertsTable } from "./components/alerts-table";
import { ShieldCheck, LogOut } from "lucide-react";

export default async function AlertsPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user as Record<string, unknown>;
  const actor = {
    id: (u.id as string) || (u.userId as string) || "",
    userId: (u.userId as string) || (u.id as string) || "",
    role: (u.role as string) || "",
    fullName: (u.fullName as string) || (u.name as string) || "",
    email: (u.email as string) || "",
    scopeConfig: u.scopeConfig,
  };

  // Nếu là sinh viên, tự động chuyển hướng về trang học tập của sinh viên
  if (actor.role === "STUDENT") {
    redirect("/student/alerts");
  }

  // Lấy dữ liệu cảnh báo ban đầu (mặc định OPEN & ACKNOWLEDGED)
  const initialData = await listAlerts(
    {
      page: 1,
      pageSize: 20,
    },
    actor
  );

  return (
    <div className="min-h-screen bg-neutral-50/60 pb-12 dark:bg-neutral-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="text-base tracking-tight">CTUET-EWARS</span>
            </Link>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Module Cảnh báo
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden flex-col text-right sm:flex">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {actor.fullName || actor.userId}
              </span>
              <span className="text-[11px] text-neutral-500">
                {actor.role === "ADVISOR"
                  ? "Cố vấn học tập (CVHT)"
                  : actor.role === "TRAINING_OFFICER"
                    ? "Cán bộ Đào tạo (QLĐT)"
                    : "Quản trị viên"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/data-import"
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Nhập liệu (Data Import)
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-1 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                Đổi vai trò
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Danh sách Cảnh báo Học vụ Cần Xử Lý
            </h1>
            <p className="mt-1 text-xs text-neutral-500">
              Theo dõi và hỗ trợ can thiệp sớm cho sinh viên có dấu hiệu rủi ro học tập.
            </p>
          </div>
        </div>

        {/* Alerts Table Client View */}
        <AlertsTable
          initialData={initialData}
          currentUserId={actor.userId}
          currentUserRole={actor.role}
        />
      </main>
    </div>
  );
}
