import Link from "next/link";

interface RoleCard {
  role: string;
  name: string;
  email: string;
  desc: string;
  color: string;
  badge?: string;
  badgeColor?: string;
  redirect: string;
  highlight?: boolean;
}

const ROLES: RoleCard[] = [
  {
    role: "ADVISOR",
    name: "Cố vấn học tập (CVHT) — ThS. Nguyễn Văn A",
    email: "nguyenvana@ctuet.edu.vn",
    desc: "Quản lý sinh viên phụ trách. Theo dõi 13 kịch bản cảnh báo, xác nhận cảnh báo, phân loại và ghi nhận can thiệp (≤ 2 clicks).",
    color: "bg-amber-600 hover:bg-amber-700 text-white",
    badge: "Trung tâm Nghiệp vụ CVHT",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    redirect: "/alerts",
    highlight: true,
  },
  {
    role: "STUDENT",
    name: "Sinh viên Tiêu biểu — B2101001 (Nguyễn Văn Vắng Liên Tiếp)",
    email: "b2101001@student.ctuet.edu.vn",
    desc: "Xem tình hình học tập tích cực cá nhân, cảnh báo tham khảo, khuyến nghị học tập và gửi phản hồi tới CVHT.",
    color: "bg-emerald-600 hover:bg-emerald-700 text-white",
    badge: "Student Portal (Quyền SV)",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    redirect: "/student/alerts",
  },
  {
    role: "TRAINING_OFFICER",
    name: "Cán bộ Đào tạo (QLĐT) — Phòng Đào tạo",
    email: "qldt@ctuet.edu.vn",
    desc: "Giám sát toàn trường: Thống kê tổng quan rủi ro theo khoa/ngành, quản lý nhập dữ liệu (FR-IMP), cấu hình luật Rule Engine.",
    color: "bg-blue-600 hover:bg-blue-700 text-white",
    badge: "Quản trị Đào tạo",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    redirect: "/dashboard",
  },
  {
    role: "ADMIN",
    name: "Quản trị viên Hệ thống (ADMIN)",
    email: "admin@ctuet.edu.vn",
    desc: "Vận hành hệ thống, phê duyệt phiên bản luật (RuleVersion), xem nhật ký kiểm toán (Audit Logs) và đồng bộ bảo mật.",
    color: "bg-purple-600 hover:bg-purple-700 text-white",
    badge: "Vận hành Hệ thống",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    redirect: "/admin",
  },
];

const DEMO_STUDENTS = [
  {
    mssv: "B2101001",
    name: "Nguyễn Văn Vắng Liên Tiếp",
    rule: "HR-ATT-01",
    desc: "Vắng liên tiếp 3 buổi",
    sev: "HIGH",
    color: "text-orange-600",
  },
  {
    mssv: "B2101002",
    name: "Trần Thị Chạm Cấm Thi",
    rule: "HR-ATT-02",
    desc: "Ngưỡng cấm thi ≥ 20%",
    sev: "CRITICAL",
    color: "text-red-600",
  },
  {
    mssv: "B2101003",
    name: "Lê Hoàng Vắng Đa Môn",
    rule: "HR-ATT-03",
    desc: "Vắng đa môn trong tuần",
    sev: "HIGH",
    color: "text-orange-600",
  },
  {
    mssv: "B2101004",
    name: "Phạm Minh Bỏ Học Đầu Kỳ",
    rule: "HR-ATT-04",
    desc: "Bỏ học 2 tuần đầu kỳ",
    sev: "HIGH",
    color: "text-orange-600",
  },
  {
    mssv: "B2101005",
    name: "Võ Thị Điểm Liệt Giữa Kỳ",
    rule: "HR-ACA-01",
    desc: "Điểm liệt giữa kỳ (1.5đ)",
    sev: "HIGH",
    color: "text-orange-600",
  },
  {
    mssv: "B2101006",
    name: "Đặng Quốc Tiệm Cận Cảnh Báo",
    rule: "HR-ACA-02",
    desc: "GPA tiệm cận mức 0.95",
    sev: "CRITICAL",
    color: "text-red-600",
  },
  {
    mssv: "B2101007",
    name: "Bùi Tuấn Tụt Dốc GPA",
    rule: "HR-ACA-03",
    desc: "GPA tụt từ 3.20 -> 1.85",
    sev: "MEDIUM",
    color: "text-yellow-600",
  },
  {
    mssv: "B2101008",
    name: "Hồ Thanh Học Lại Lần 3",
    rule: "HR-ACA-04",
    desc: "Học lại lần 3 do rớt môn",
    sev: "MEDIUM",
    color: "text-yellow-600",
  },
  {
    mssv: "B2101009",
    name: "Dương Mai Bỏ LMS 14 Ngày",
    rule: "HR-LMS-01",
    desc: "Không vào LMS 15 ngày",
    sev: "CRITICAL",
    color: "text-red-600",
  },
  {
    mssv: "B2101010",
    name: "Ngô Gia Bỏ Nộp Bài Quiz",
    rule: "HR-LMS-02",
    desc: "Bỏ 2 bài Quiz bắt buộc",
    sev: "HIGH",
    color: "text-orange-600",
  },
  {
    mssv: "B2101011",
    name: "Trịnh Bảo Hai Số Không LMS",
    rule: "HR-LMS-03",
    desc: "2 điểm 0 liên tiếp Quiz",
    sev: "MEDIUM",
    color: "text-yellow-600",
  },
  {
    mssv: "B2101012",
    name: "Đỗ Hùng Tiêu Cực Đa Nguồn",
    rule: "HR-COMB-01",
    desc: "Đa nguồn tiêu cực cùng tuần",
    sev: "CRITICAL",
    color: "text-red-600",
  },
  {
    mssv: "B2101013",
    name: "Phan An Biến Mất Hoàn Toàn",
    rule: "HR-COMB-02",
    desc: "Mất tích 12 ngày liên tục",
    sev: "CRITICAL",
    color: "text-red-600",
  },
  {
    mssv: "B2101014",
    name: "Lâm Như Có Đơn Miễn Bài",
    rule: "HR-EXC-01",
    desc: "Ngoại lệ hợp lệ có đơn y tế",
    sev: "LOW",
    color: "text-emerald-600",
  },
  {
    mssv: "B2101015",
    name: "Hoàng Kim Sinh Viên Tiêu Biểu",
    rule: "NONE",
    desc: "GPA 3.85, 0 rủi ro",
    sev: "AN TOÀN",
    color: "text-blue-600",
  },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 lg:px-8 dark:bg-neutral-950">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header Branding */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              ĐỒ ÁN TỐT NGHIỆP • TRƯỜNG ĐẠI HỌC KỸ THUẬT - CÔNG NGHỆ CẦN THƠ (CTUT)
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-100">
              CTUET-EWARS
            </h1>
            <p className="mt-1 text-base font-medium text-neutral-700 dark:text-neutral-300">
              Hệ Thống Phát Hiện Sớm Dấu Hiệu Rủi Ro Học Tập Của Sinh Viên
            </p>
            <div className="mt-3 max-w-2xl rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <span className="font-semibold">⚠️ Nguyên tắc bất biến & Pháp lý:</span> Mọi cảnh báo
              mang tính chất tham khảo (`isReferenceOnly = true`). Hệ thống tuyệt đối không tự sửa
              trạng thái học vụ chính thức (`officialAcademicStatus`), tuân thủ Luật Bảo vệ dữ liệu
              cá nhân 91/2025/QH15.
            </div>
          </div>
        </div>

        {/* 4 Main Role Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              1. Đăng nhập Nhanh theo 4 Vai trò (Demo Mode)
            </h2>
            <span className="text-xs text-neutral-500">
              Nhấp &quot;Đăng nhập&quot; để tạo session tự động
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ROLES.map((r) => (
              <div
                key={r.role}
                className={`flex flex-col justify-between rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${
                  r.highlight
                    ? "border-amber-300 bg-amber-50/30 ring-1 ring-amber-400/40 dark:border-amber-700/60 dark:bg-amber-950/10"
                    : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-neutral-500 uppercase">
                      {r.role}
                    </span>
                    {r.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.badgeColor}`}
                      >
                        {r.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    {r.name}
                  </h3>
                  <p className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                    {r.email}
                  </p>
                  <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                    {r.desc}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <span className="text-[11px] text-neutral-400">Đích đến: {r.redirect}</span>
                  <Link
                    href={`/api/auth/dev-login?email=${r.email}&redirect=${r.redirect}`}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition ${r.color}`}
                  >
                    Đăng nhập &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 13 Demo Rule Scenarios Quick Access */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              2. Kịch bản Minh Họa 13 Luật Nghiệp vụ & Ngoại Lệ
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Mỗi sinh viên đại diện cho 1 tình huống vi phạm luật hoặc trường hợp hợp lệ. Nhấp vào
              nút tài khoản SV để đăng nhập trực tiếp xem góc nhìn cá nhân:
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Mã luật</th>
                  <th className="px-3 py-2.5 font-semibold">MSSV</th>
                  <th className="px-3 py-2.5 font-semibold">Họ tên sinh viên</th>
                  <th className="px-3 py-2.5 font-semibold">Tình huống thực tế</th>
                  <th className="px-3 py-2.5 font-semibold">Mức độ</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Xem góc nhìn SV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {DEMO_STUDENTS.map((s) => (
                  <tr key={s.mssv} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                    <td className="px-3 py-2.5 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                      {s.rule}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-neutral-600 dark:text-neutral-400">
                      {s.mssv}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-neutral-800 dark:text-neutral-200">
                      {s.name}
                    </td>
                    <td className="px-3 py-2.5 text-neutral-600 dark:text-neutral-400">{s.desc}</td>
                    <td className="px-3 py-2.5">
                      <span className={`font-semibold ${s.color}`}>{s.sev}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/api/auth/dev-login?email=${s.mssv.toLowerCase()}@student.ctuet.edu.vn&redirect=/student/alerts`}
                        className="inline-block rounded border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-xs hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      >
                        Đăng nhập SV &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="space-y-1 text-center text-xs text-neutral-400 dark:text-neutral-600">
          <p>Hệ thống CTUET-EWARS © 2026 • Đã sẵn sàng cho Hội đồng Đánh giá & Bảo vệ Đồ án</p>
          <p>Next.js 16 • PostgreSQL • Prisma ORM 7 • Tailwind CSS 4 • Better Auth</p>
        </div>
      </div>
    </div>
  );
}
