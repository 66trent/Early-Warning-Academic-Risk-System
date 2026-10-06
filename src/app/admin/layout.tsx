import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  Users,
  ShieldAlert,
  Server,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Sliders,
  History,
} from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user as Record<string, unknown>;
  const actor = {
    userId: (u.userId as string) || (u.id as string) || "",
    role: (u.role as string) || "",
    fullName: (u.fullName as string) || (u.name as string) || "",
    email: (u.email as string) || "",
  };

  // Chỉ ADMIN và TRAINING_OFFICER được vào khu vực quản trị
  if (actor.role !== "ADMIN" && actor.role !== "TRAINING_OFFICER") {
    if (actor.role === "STUDENT") redirect("/student/alerts");
    if (actor.role === "ADVISOR") redirect("/alerts");
    redirect("/login");
  }

  const navItems = [
    {
      label: "Tổng quan Quản trị",
      href: "/admin",
      icon: LayoutDashboard,
      allowedRoles: ["ADMIN", "TRAINING_OFFICER"],
    },
    {
      label: "Quản lý Người dùng",
      href: "/admin/users",
      icon: Users,
      allowedRoles: ["ADMIN"],
    },
    {
      label: "Tích hợp SIS & LMS",
      href: "/admin/integrations",
      icon: Server,
      allowedRoles: ["ADMIN"],
    },
    {
      label: "Phê duyệt Luật",
      href: "/admin/rules",
      icon: Sliders,
      allowedRoles: ["ADMIN", "TRAINING_OFFICER"],
    },
    {
      label: "Nhật ký Kiểm toán",
      href: "/admin/audit-logs",
      icon: History,
      allowedRoles: ["ADMIN", "TRAINING_OFFICER"],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-900/5 font-sans text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
                  CTUET-EWARS
                </span>
                <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  ADMIN CONSOLE
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 sm:inline-flex dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard QLĐT
            </Link>
            <Link
              href="/alerts"
              className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 sm:inline-flex dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Cảnh báo
            </Link>

            <div className="flex items-center gap-2 border-l border-neutral-200 pl-3 dark:border-neutral-800">
              <div className="hidden text-right text-xs sm:block">
                <div className="font-semibold">{actor.fullName}</div>
                <div className="font-mono text-[10px] text-neutral-500">
                  {actor.role} • {actor.userId}
                </div>
              </div>
              <Link
                href="/login"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600 dark:border-neutral-800 dark:hover:bg-rose-950/30"
                title="Đăng xuất"
              >
                <LogOut className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="border-t border-neutral-200/80 bg-neutral-50/70 px-4 sm:px-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="mx-auto flex max-w-7xl scrollbar-none gap-1 overflow-x-auto py-1.5 text-xs">
            {navItems
              .filter((item) => item.allowedRoles.includes(actor.role))
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-neutral-600 transition hover:bg-white hover:text-indigo-600 hover:shadow-xs dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-indigo-400"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
          <span>
            CTUET-EWARS Quản trị Hệ thống • Tuân thủ Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15
          </span>
          <span className="font-mono text-[11px] text-neutral-400">
            STRIDE Hardened • Append-only Audit
          </span>
        </div>
      </footer>
    </div>
  );
}
