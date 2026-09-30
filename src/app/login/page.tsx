import Link from "next/link";

const ROLES = [
  {
    role: "TRAINING_OFFICER",
    name: "Cán bộ Đào tạo (QLĐT)",
    email: "qldt@ctuet.edu.vn",
    desc: "Có toàn quyền nhập dữ liệu (FR-IMP), xem danh sách lỗi, hủy lô STAGED.",
    color: "bg-blue-600 hover:bg-blue-700 text-white",
    badge: "Khuyên dùng để test Phase 2",
    badgeColor: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  {
    role: "ADMIN",
    name: "Quản trị viên (ADMIN)",
    email: "admin@ctuet.edu.vn",
    desc: "Quản trị hệ thống, có quyền nhập dữ liệu và hủy lô STAGED.",
    color: "bg-purple-600 hover:bg-purple-700 text-white",
  },
  {
    role: "ADVISOR",
    name: "Cố vấn học tập (CVHT)",
    email: "nguyenvana@ctuet.edu.vn",
    desc: "Chỉ quản lý SV được phân công. Không có quyền nhập dữ liệu (sẽ bị chặn 403).",
    color: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  {
    role: "STUDENT",
    name: "Sinh viên (STUDENT)",
    email: "b210001@student.ctuet.edu.vn",
    desc: "Chỉ xem dữ liệu cá nhân. Không có quyền nhập dữ liệu (sẽ bị chặn 403).",
    color: "bg-neutral-600 hover:bg-neutral-700 text-white",
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
                href={`/api/auth/dev-login?role=${r.role}&redirect=/data-import`}
                className={`ml-4 shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${r.color}`}
              >
                Đăng nhập
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-4 text-center text-xs text-neutral-400 dark:border-neutral-800">
          CTUET Early Warning Academic Risk System • Phase 2 Test Portal
        </div>
      </div>
    </div>
  );
}
