import Link from "next/link";

const ROLES = [
  {
    role: "ADVISOR",
    name: "Cố vấn học tập (CVHT) — ThS. Nguyễn Văn A",
    email: "nguyenvana@ctuet.edu.vn",
    desc: "Quản lý SV phụ trách. Xem danh sách cảnh báo, xác nhận cảnh báo và ghi nhận can thiệp (≤2 clicks).",
    color: "bg-amber-600 hover:bg-amber-700 text-white",
    badge: "Khuyên dùng test Phase 4",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    redirect: "/alerts",
  },
  {
    role: "STUDENT",
    name: "Sinh viên (STUDENT) — B210001",
    email: "b210001@student.ctuet.edu.vn",
    desc: "Xem tình hình học tập tích cực cá nhân, nhận gợi ý hỗ trợ và liên hệ CVHT trực tiếp.",
    color: "bg-emerald-600 hover:bg-emerald-700 text-white",
    badge: "Giao diện SV (Phase 4)",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    redirect: "/student/alerts",
  },
  {
    role: "TRAINING_OFFICER",
    name: "Cán bộ Đào tạo (QLĐT)",
    email: "qldt@ctuet.edu.vn",
    desc: "Toàn trường: Nhập dữ liệu (FR-IMP), giám sát cảnh báo và cấu hình luật.",
    color: "bg-blue-600 hover:bg-blue-700 text-white",
    redirect: "/alerts",
  },
  {
    role: "ADMIN",
    name: "Quản trị viên (ADMIN)",
    email: "admin@ctuet.edu.vn",
    desc: "Vận hành hệ thống, vô hiệu hóa cảnh báo khi dữ liệu nguồn thay đổi, xem audit log.",
    color: "bg-purple-600 hover:bg-purple-700 text-white",
    redirect: "/alerts",
  },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            CTUET-EWARS Đăng nhập
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Chọn vai trò bên dưới để đăng nhập nhanh phiên làm việc (môi trường dev):
          </p>
        </div>

        <div className="space-y-4">
          {ROLES.map((r) => (
            <div
              key={r.role}
              className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 transition hover:border-blue-300 dark:border-neutral-800 dark:hover:border-blue-700"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {r.name}
                  </span>
                  {r.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.badgeColor}`}
                    >
                      {r.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">{r.email}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">{r.desc}</p>
              </div>

              <Link
                href={`/api/auth/dev-login?role=${r.role}&redirect=${r.redirect}`}
                className={`ml-4 shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${r.color}`}
              >
                Đăng nhập
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-4 text-center text-xs text-neutral-400 dark:border-neutral-800">
          CTUET Early Warning Academic Risk System • Phase 4 Alerts & Interventions
        </div>
      </div>
    </div>
  );
}
