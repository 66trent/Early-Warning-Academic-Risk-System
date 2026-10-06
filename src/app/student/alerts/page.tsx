import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getStudentStudyStatus } from "@/modules/alerts/services/alert-query.service";
import {
  GraduationCap,
  Mail,
  UserCheck,
  CheckCircle2,
  BookOpen,
  LogOut,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";

export default async function StudentAlertsPage() {
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

  // Nếu không phải sinh viên (ví dụ CVHT/QLĐT vào nhầm), vẫn cho xem hoặc redirect
  let studentId = actor.userId;
  if (actor.role !== "STUDENT") {
    // Nếu là cán bộ xem thử, mặc định xem sinh viên demo đầu tiên
    studentId = "B210001";
  }

  let studyStatus;
  try {
    studyStatus = await getStudentStudyStatus(studentId, actor);
  } catch {
    // Fallback if not found
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-bold">Không tìm thấy thông tin sinh viên</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Vui lòng đăng nhập bằng tài khoản sinh viên.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
          >
            Về trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  const { student, advisor, enrolledCourses, supportStatus, suggestions } = studyStatus;

  return (
    <div className="min-h-screen bg-neutral-50/60 pb-16 dark:bg-neutral-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
                CTUET Cổng Sinh Viên
              </span>
              <span className="ml-2 text-xs text-neutral-500">Đồng hành học tập</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <span className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {student.fullName}
              </span>
              <span className="text-[11px] text-neutral-500">
                MSSV: {student.studentId} • Lớp: {student.classId}
              </span>
            </div>

            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              Đổi vai trò
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl space-y-6 px-4 pt-8 sm:px-6">
        {/* Positive Header Banner (07-ux-design.md) */}
        <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-blue-50/40 p-6 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-900/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                Học kỳ 1 • Năm học 2026-2027
              </span>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Tình hình học tập của bạn
              </h1>
              <p className="mt-1.5 max-w-xl text-xs text-neutral-600 dark:text-neutral-400">
                {supportStatus.summaryMessage}
              </p>
            </div>

            {/* Trạng thái tích cực đã diễn giải (KHÔNG hiển thị con số thô 0.0 - 1.0) */}
            <div className="shrink-0">
              <span
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm ${
                  supportStatus.level === "STABLE"
                    ? "border border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : supportStatus.level === "NEEDS_ATTENTION"
                      ? "border border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                      : "border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                }`}
              >
                {supportStatus.level === "STABLE" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <HeartHandshake className="h-5 w-5 text-amber-600" />
                )}
                {supportStatus.badgeText}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Cố vấn học tập phụ trách & Các gợi ý hỗ trợ */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Card CVHT Phụ trách (Bắt buộc nút liên hệ trực tiếp, 07-ux-design.md) */}
          <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-wider text-neutral-500 uppercase">
                  Cố vấn học tập của bạn
                </h3>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {advisor?.fullName || "Chưa phân công"}
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-neutral-500">
              Thầy/Cô luôn sẵn sàng hỗ trợ giải đáp thắc mắc về kế hoạch học tập, chuyên cần và
              phương pháp ôn luyện.
            </p>

            {advisor?.email && (
              <div className="space-y-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                <a
                  href={`mailto:${advisor.email}?subject=[CTUET-EWARS] Trao đổi tình hình học tập - SV ${student.fullName} (${student.studentId})`}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Mail className="h-4 w-4" />
                  Gửi email cho Thầy/Cô
                </a>
                <p className="text-center text-[11px] text-neutral-400">Email: {advisor.email}</p>
              </div>
            )}
          </div>

          {/* Danh sách Gợi ý học tập (Suggestions) */}
          <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm md:col-span-2 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-neutral-100">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              Điểm cần lưu ý để đạt kết quả tốt nhất
            </h3>

            {suggestions.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span>
                  Bạn đang duy trì tiến độ học tập và chuyên cần rất tốt trong tất cả các môn học.
                  Chúc bạn có một học kỳ thật thành công!
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    className="space-y-1 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-800/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {item.category}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Gợi ý hỗ trợ
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {item.advice}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Danh sách Môn học đã đăng ký trong kỳ */}
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-neutral-100">
            <BookOpen className="h-4 w-4 text-blue-600" />
            Các học phần đang học trong kỳ ({enrolledCourses.length})
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrolledCourses.map(
              (c: {
                sectionId: string;
                courseCode: string;
                credits: number;
                courseName: string;
              }) => (
                <div
                  key={c.sectionId}
                  className="space-y-1 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 dark:border-neutral-800 dark:bg-neutral-800/30"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {c.courseCode}
                    </span>
                    <span className="text-[11px] font-medium text-neutral-500">
                      {c.credits} tín chỉ
                    </span>
                  </div>
                  <div className="line-clamp-1 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {c.courseName}
                  </div>
                  <div className="text-[11px] text-neutral-500">Mã lớp HP: {c.sectionId}</div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Footer Link Pháp lý */}
        <footer className="pt-4 text-center text-xs text-neutral-500">
          <Link
            href="/legal/privacy-policy"
            className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-blue-600 transition hover:underline dark:text-blue-400"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>
              Quy chế bảo vệ dữ liệu cá nhân sinh viên theo Luật 91/2025/QH15 & NĐ 356/2025/NĐ-CP
            </span>
          </Link>
        </footer>
      </main>
    </div>
  );
}
