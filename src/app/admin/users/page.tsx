import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { listUsersService } from "@/modules/admin/services/user.service";
import { UsersClient } from "./components/users-client";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string; search?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user as Record<string, unknown>;
  const currentActorId = (u.userId as string) || (u.id as string) || "";
  const currentRole = (u.role as string) || "";

  if (currentRole !== "ADMIN") {
    redirect("/admin");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const resolvedRole =
    resolvedParams.role &&
    resolvedParams.role !== "ALL" &&
    ["STUDENT", "ADVISOR", "TRAINING_OFFICER", "ADMIN"].includes(resolvedParams.role)
      ? (resolvedParams.role as "STUDENT" | "ADVISOR" | "TRAINING_OFFICER" | "ADMIN")
      : undefined;

  const search = resolvedParams.search || "";

  const initialData = await listUsersService({
    page,
    pageSize: 20,
    role: resolvedRole,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl dark:text-white">
            Quản trị Tài khoản Người dùng
          </h1>
          <p className="text-xs text-neutral-500 sm:text-sm">
            Quản lý người dùng theo 4 vai trò, cấu hình phạm vi truy cập (scopeConfig) và thực thi
            bảo mật STRIDE.
          </p>
        </div>
      </div>

      <UsersClient
        initialData={initialData}
        currentActorId={currentActorId}
        initialFilter={{ role: resolvedParams.role || "ALL", search }}
      />
    </div>
  );
}
