import Link from "next/link";
import {
  ShieldAlert,
  GraduationCap,
  FileSpreadsheet,
  LogIn,
  CheckCircle2,
  BellRing,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-50 font-sans dark:bg-neutral-950">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                CTUET-EWARS
              </span>
              <span className="ml-2 hidden text-xs font-semibold text-neutral-500 sm:inline-block">
                Early Warning Academic Risk System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <LogIn className="h-4 w-4" />
              Đăng nhập Dev Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
            <BellRing className="h-3.5 w-3.5" />
            Hệ thống phát hiện sớm dấu hiệu rủi ro học tập
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-100">
            Đồng hành cùng Sinh viên Trường Đại học Kỹ thuật - Công nghệ Cần Thơ
          </h1>

          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base dark:text-neutral-400">
            Hỗ trợ Cố vấn học tập phát hiện kịp thời các khó khăn về chuyên cần, học lực và tương
            tác trực tuyến; hỗ trợ can thiệp sớm và nâng cao tỷ lệ hoàn thành chương trình đào tạo.
          </p>
        </div>

        {/* 3 Portal Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Card 1: CVHT */}
          <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Cố vấn học tập (CVHT)
              </h3>
              <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                Theo dõi danh sách cảnh báo học vụ, xem bằng chứng vi phạm theo quy tắc nghiệp vụ và
                ghi nhận hoạt động can thiệp (≤2 clicks).
              </p>
            </div>

            <div className="pt-6">
              <Link
                href="/alerts"
                className="flex w-full items-center justify-between rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-700"
              >
                <span>Vào trang Cảnh báo</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Sinh viên */}
          <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Cổng Sinh viên
              </h3>
              <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                Theo dõi tình hình học tập với ngôn ngữ tích cực, nhận các gợi ý cải thiện kết quả
                và liên hệ trực tiếp với Cố vấn học tập.
              </p>
            </div>

            <div className="pt-6">
              <Link
                href="/student/alerts"
                className="flex w-full items-center justify-between rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                <span>Xem tình hình học tập</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Card 3: QLĐT & Dữ liệu */}
          <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Quản lý & Nhập liệu
              </h3>
              <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                Nhập dữ liệu điểm danh, kết quả học tập và LMS; đối soát tính toàn vẹn và phân tích
                rủi ro tự động.
              </p>
            </div>

            <div className="pt-6">
              <Link
                href="/data-import"
                className="flex w-full items-center justify-between rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                <span>Vào trang Nhập dữ liệu</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Disclaimer Card */}
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
            <CheckCircle2 className="h-5 w-5 text-amber-600" />
            <span>Nguyên tắc Nghiệp vụ Cốt lõi (Bất biến)</span>
          </div>
          <p className="mx-auto max-w-2xl text-xs text-amber-900/80 dark:text-amber-400/90">
            Mọi cảnh báo phát sinh từ hệ thống đều mang tính tham khảo nhằm hỗ trợ can thiệp sớm. Hệ
            thống tuyệt đối không tự động thay đổi trạng thái học vụ chính thức của sinh viên.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-400 dark:border-neutral-800">
        CTUET Early Warning Academic Risk System • Phát triển theo tiêu chuẩn Next.js 16 & Prisma
        ORM 7
      </footer>
    </div>
  );
}
