import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  Lock,
  Scale,
  Clock,
  UserCheck,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Mail,
  BookOpen,
  FileCheck2,
} from "lucide-react";

export const metadata = {
  title: "Chính Sách Bảo Vệ Dữ Liệu Cá Nhân | CTUET-EWARS",
  description:
    "Chính sách bảo vệ dữ liệu cá nhân theo Luật số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP của Hệ thống Cảnh báo Sớm Rủi ro Học tập (CTUET-EWARS).",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="group flex min-h-[44px] min-w-[44px] items-center gap-2 text-sm font-semibold text-neutral-600 transition hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400"
            aria-label="Quay lại trang chủ CTUET-EWARS"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>Về Trang Chủ</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Tuân thủ Luật 91/2025/QH15 & NĐ 356/2025/NĐ-CP
            </span>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="border-b border-neutral-200 bg-white py-12 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-5xl px-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
              <Shield className="h-4 w-4" />
              <span>HỆ THỐNG CTUET-EWARS • QUY CHẾ PHÁP LÝ</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Chính Sách Bảo Vệ Dữ Liệu Cá Nhân
            </h1>

            <p className="max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base dark:text-neutral-400">
              Chính sách này quy định các nguyên tắc, biện pháp thu thập, xử lý và bảo vệ dữ liệu cá
              nhân của người học được áp dụng trong Hệ thống Phát hiện Sớm Dấu hiệu Rủi ro Học tập
              (CTUET-EWARS) của Trường Đại học Kỹ thuật - Công nghệ Cần Thơ, căn cứ theo{" "}
              <strong>Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15</strong> và{" "}
              <strong>Nghị định số 356/2025/NĐ-CP</strong> (hiệu lực từ ngày 01/01/2026).
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Ngày hiệu lực: 01/01/2026
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <FileCheck2 className="h-3.5 w-3.5" /> Phiên bản: 1.0 (Chính thức)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> Cơ quan ban hành: Trường ĐH Kỹ thuật - Công
                nghệ Cần Thơ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-4">
          {/* Sticky Table of Contents Navigation */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-xs font-bold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
                Mục Lục Văn Bản
              </h2>
              <nav className="space-y-1.5 text-xs" aria-label="Mục lục điều khoản">
                <a
                  href="#sec-1"
                  className="flex min-h-[36px] items-center rounded-lg px-2.5 py-1.5 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-blue-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  1. Bên kiểm soát & xử lý dữ liệu
                </a>
                <a
                  href="#sec-2"
                  className="flex min-h-[36px] items-center rounded-lg px-2.5 py-1.5 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-blue-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  2. Phân loại dữ liệu thu thập
                </a>
                <a
                  href="#sec-3"
                  className="flex min-h-[36px] items-center rounded-lg px-2.5 py-1.5 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-blue-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  3. Mục đích & Ranh giới xử lý
                </a>
                <a
                  href="#sec-4"
                  className="flex min-h-[36px] items-center rounded-lg px-2.5 py-1.5 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-blue-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  4. Căn cứ pháp lý áp dụng
                </a>
                <a
                  href="#sec-5"
                  className="flex min-h-[36px] items-center rounded-lg px-2.5 py-1.5 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-blue-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  5. Thời hạn lưu trữ dữ liệu
                </a>
                <a
                  href="#sec-6"
                  className="flex min-h-[36px] items-center rounded-lg px-2.5 py-1.5 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-blue-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  6. Quyền & Nghĩa vụ của sinh viên
                </a>
                <a
                  href="#sec-7"
                  className="flex min-h-[36px] items-center rounded-lg px-2.5 py-1.5 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-blue-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  7. Biện pháp an ninh & kỹ thuật
                </a>
              </nav>

              <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <a
                  href="mailto:dpo@ctuet.edu.vn"
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span>Liên hệ DPO</span>
                </a>
              </div>
            </div>
          </aside>

          {/* Detailed Policy Sections */}
          <article className="space-y-12 lg:col-span-3">
            {/* Section 1: Data Controller */}
            <section id="sec-1" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                  <Building2 className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  1. Bên Kiểm Soát và Xử Lý Dữ Liệu Cá Nhân
                </h2>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 leading-relaxed shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  Đơn vị chịu trách nhiệm kiểm soát và xử lý dữ liệu cá nhân trong hệ thống
                  CTUET-EWARS là:
                </p>
                <div className="mt-4 space-y-2 rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-800/50">
                  <p>
                    <strong>Tên tổ chức:</strong> Trường Đại học Kỹ thuật - Công nghệ Cần Thơ (CTUT)
                  </p>
                  <p>
                    <strong>Địa chỉ:</strong> 256 Nguyễn Văn Cừ, Phường An Hòa, Quận Ninh Kiều, TP.
                    Cần Thơ
                  </p>
                  <p>
                    <strong>Bộ phận thường trực bảo vệ dữ liệu (DPO):</strong> Phòng Đào tạo phối
                    hợp cùng Trung tâm Công nghệ Thông tin - Truyền thông
                  </p>
                  <p>
                    <strong>Email đầu mối giải quyết khiếu nại & quyền dữ liệu:</strong>{" "}
                    <a
                      href="mailto:dpo@ctuet.edu.vn"
                      className="font-semibold text-blue-600 underline"
                    >
                      dpo@ctuet.edu.vn
                    </a>
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Data Categories */}
            <section id="sec-2" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                  <BookOpen className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  2. Phân Loại Dữ Liệu Được Xử Lý
                </h2>
              </div>

              <div className="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
                <p>
                  Hệ thống phân chia dữ liệu người học thành 02 nhóm độc lập với cơ chế bảo vệ phân
                  tầng:
                </p>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      Dữ liệu cá nhân cơ bản
                    </h3>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs text-neutral-600 dark:text-neutral-400">
                      <li>Mã số sinh viên (MSSV), Họ và tên đầy đủ.</li>
                      <li>
                        Địa chỉ thư điện tử sinh viên chính thức (
                        <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-800">
                          @student.ctuet.edu.vn
                        </code>
                        ).
                      </li>
                      <li>Lớp sinh hoạt, Khoa/Ngành đào tạo, Niên khóa tuyển sinh.</li>
                      <li>
                        Nhật ký điểm danh từng buổi học phần (
                        <code className="text-neutral-800 dark:text-neutral-200">
                          PRESENT, EXCUSED_ABSENCE, UNEXCUSED_ABSENCE, LATE
                        </code>
                        ).
                      </li>
                      <li>
                        Kết quả đánh giá học tập (Điểm quá trình, điểm thi, GPA, số lần học lại).
                      </li>
                      <li>
                        Nhật ký tương tác học tập trên LMS (Lần đăng nhập, nộp bài, thảo luận diễn
                        đàn).
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm dark:border-rose-950 dark:bg-rose-950/20">
                    <h3 className="flex items-center gap-2 font-bold text-rose-900 dark:text-rose-300">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Dữ liệu cá nhân nhạy cảm (Sức khỏe / Y tế)
                    </h3>
                    <p className="mt-3 text-xs leading-relaxed text-rose-900/90 dark:text-rose-300/90">
                      Thông tin về tình trạng sức khỏe hoặc lý do y tế khi sinh viên nộp đơn xin
                      vắng học có phép:
                    </p>
                    <div className="mt-2 rounded-xl border border-rose-200/60 bg-white/70 p-3 text-xs font-medium text-rose-800 dark:border-rose-900/40 dark:bg-neutral-900/80 dark:text-rose-300">
                      ⚠️ <strong>Ràng buộc kỹ thuật tăng cường:</strong> Mọi ghi nhận can thiệp liên
                      quan sức khỏe bắt buộc gán nhãn{" "}
                      <code className="font-bold">confidentialityLevel = SENSITIVE</code>. Dữ liệu
                      này CHỈ hiển thị cho Cố vấn học tập trực tiếp phụ trách và bị{" "}
                      <strong>loại trừ hoàn toàn</strong> khỏi các báo cáo hay dashboard thống kê
                      tổng hợp.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Purpose and Scope Boundaries */}
            <section id="sec-3" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  <Scale className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  3. Mục Đích Xử Lý & Ranh Giới Nghiệp Vụ Bất Biến
                </h2>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <p className="leading-relaxed">
                  Toàn bộ hoạt động tính toán và đánh giá rủi ro được thiết kế với mục đích phục vụ
                  công tác đào tạo và hỗ trợ người học:
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <p className="font-bold text-neutral-900 dark:text-white">Mục đích cho phép:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-neutral-600 dark:text-neutral-400">
                      <li>Phát hiện sớm dấu hiệu nguy cơ vắng quá số tiết cấm thi.</li>
                      <li>Cảnh báo tụt GPA đột ngột hoặc rớt môn điều kiện.</li>
                      <li>Hỗ trợ CVHT liên hệ, tư vấn và xây dựng lộ trình học tập bù đắp.</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <p className="font-bold text-neutral-900 dark:text-white">
                      Cam kết cấm tuyệt đối:
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-neutral-600 dark:text-neutral-400">
                      <li>KHÔNG chia sẻ dữ liệu cho bên thứ ba ngoài nhà trường.</li>
                      <li>
                        KHÔNG sử dụng cho bất kỳ mục đích thương mại, quảng cáo hay xếp hạng xã hội
                        nào.
                      </li>
                      <li>
                        KHÔNG công khai danh sách sinh viên rủi ro ra bên ngoài phạm vi phụ trách.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Ranh giới bất biến (Invariant Boundary):</span>
                  </div>
                  <p className="mt-1 leading-relaxed">
                    Hệ thống chỉ đưa ra cảnh báo mang tính tham khảo hỗ trợ (
                    <code className="font-semibold">isReferenceOnly = true</code>). Hệ thống{" "}
                    <strong>tuyệt đối không tự động thay đổi trạng thái học vụ chính thức</strong> (
                    <code className="font-semibold">officialAcademicStatus</code>). Việc buộc thôi
                    học, cảnh báo học vụ chính thức chỉ được thực hiện bởi Hội đồng Đào tạo theo
                    đúng quy chế hiện hành của Nhà trường.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Legal Basis */}
            <section id="sec-4" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400">
                  <FileCheck2 className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  4. Căn Cứ Pháp Lý Xử Lý Dữ Liệu
                </h2>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <ul className="space-y-3 text-xs leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span>
                      <strong>Luật Giáo dục đại học năm 2012</strong> (sửa đổi, bổ sung năm 2018) và
                      các Thông tư hướng dẫn quản lý đào tạo đại học chính quy của Bộ Giáo dục và
                      Đào tạo.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span>
                      <strong>Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15</strong> (được Quốc hội
                      khóa XV thông qua, có hiệu lực thi hành từ ngày 01/01/2026).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span>
                      <strong>Nghị định số 356/2025/NĐ-CP</strong> quy định chi tiết thi hành Luật
                      Bảo vệ dữ liệu cá nhân (có hiệu lực từ ngày 01/01/2026, thay thế Nghị định
                      13/2023/NĐ-CP).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span>
                      <strong>Quy chế đào tạo đại học chính quy</strong> của Trường Đại học Kỹ thuật
                      - Công nghệ Cần Thơ đã công bố công khai đến toàn thể người học.
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 5: Retention Period */}
            <section id="sec-5" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400">
                  <Clock className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  5. Thời Hạn Lưu Trữ Dữ Liệu
                </h2>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <div className="space-y-3 text-xs leading-relaxed">
                  <p>
                    • <strong>Dữ liệu học tập và cảnh báo:</strong> Được lưu trữ trong suốt thời
                    gian khóa học của sinh viên và duy trì tối thiểu <strong>05 năm</strong> sau khi
                    sinh viên tốt nghiệp hoặc kết thúc đào tạo theo quy định lưu trữ tài liệu chuyên
                    môn của ngành giáo dục.
                  </p>
                  <p>
                    • <strong>Nhật ký kiểm toán (Audit Log):</strong> Được lưu trữ vĩnh viễn
                    (append-only) nhằm đảm bảo tính toàn vẹn hệ thống, phục vụ công tác thanh tra
                    giáo dục và bảo đảm an ninh mạng.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 6: Student Rights */}
            <section id="sec-6" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <UserCheck className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  6. Quyền và Nghĩa Vụ của Chủ Thể Dữ Liệu (Sinh Viên)
                </h2>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <p className="font-bold text-neutral-900 dark:text-white">
                      Quyền của Người học:
                    </p>
                    <ul className="list-disc space-y-1.5 pl-4 text-neutral-600 dark:text-neutral-400">
                      <li>
                        <strong>Quyền được biết & truy cập:</strong> Xem hồ sơ cảnh báo và các
                        khuyến nghị can thiệp qua Cổng sinh viên (
                        <code className="rounded bg-neutral-200/60 px-1 py-0.5 dark:bg-neutral-700">
                          /student/alerts
                        </code>
                        ).
                      </li>
                      <li>
                        <strong>Quyền yêu cầu chỉnh sửa:</strong> Đề nghị đính chính nếu phát hiện
                        dữ liệu điểm danh hoặc điểm thi bị sai lệch (thông qua Giảng viên phụ trách
                        hoặc Phòng Đào tạo).
                      </li>
                      <li>
                        <strong>Quyền khiếu nại:</strong> Phản ánh về tính chính xác của các cảnh
                        báo đến CVHT hoặc DPO.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <p className="font-bold text-neutral-900 dark:text-white">
                      Cơ chế Xóa / Ẩn danh hóa:
                    </p>
                    <p className="leading-relaxed text-neutral-600 dark:text-neutral-400">
                      Khi nhận được yêu cầu hợp lệ về xóa dữ liệu cá nhân theo quy định pháp luật,
                      do yêu cầu pháp lý về nhật ký kiểm toán không thể xóa (append-only), hệ thống
                      thực hiện <strong>cơ chế ẩn danh hóa (Anonymization)</strong>: thay thế vĩnh
                      viễn MSSV và định danh cá nhân bằng mã băm một chiều không thể hoàn nguyên.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 7: Security Measures */}
            <section id="sec-7" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                  <Lock className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  7. Biện Pháp Kỹ Thuật và An Toàn Dữ Liệu Áp Dụng
                </h2>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <p className="font-bold text-neutral-900 dark:text-white">
                      Mã hóa Toàn diện (TLS/HTTPS):
                    </p>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                      Mọi kết nối giữa trình duyệt, ứng dụng máy chủ Next.js, cơ sở dữ liệu
                      PostgreSQL và hàng đợi Redis đều bắt buộc áp dụng giao thức mã hóa TLS 1.3.
                    </p>
                  </div>

                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <p className="font-bold text-neutral-900 dark:text-white">
                      Phân quyền Dựa trên Phạm vi (RBAC):
                    </p>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                      Thực thi nghiêm ngặt tại tầng Server Actions bằng hàm{" "}
                      <code className="font-mono">assertScope()</code>. Ngăn chặn tuyệt đối việc
                      CVHT này xem dữ liệu sinh viên của CVHT khác.
                    </p>
                  </div>

                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <p className="font-bold text-neutral-900 dark:text-white">
                      Nhật ký Kiểm toán Append-only:
                    </p>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                      Ghi nhận mọi truy cập và thao tác vào bảng{" "}
                      <code className="font-mono">AuditLog</code>. Không cung cấp bất kỳ API nào cho
                      phép sửa đổi hoặc xóa bản ghi kiểm toán.
                    </p>
                  </div>

                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <p className="font-bold text-neutral-900 dark:text-white">
                      Kiểm thử An ninh STRIDE & CI/CD:
                    </p>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                      Chạy định kỳ 100% kịch bản kiểm thử chống Spoofing, Tampering, Repudiation,
                      Information Disclosure, Denial of Service, và Elevation of Privilege.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-5xl space-y-2 px-6">
          <p className="font-semibold text-neutral-700 dark:text-neutral-300">
            Hệ thống Cảnh báo Sớm Rủi ro Học tập (CTUET-EWARS) • Trường Đại học Kỹ thuật - Công nghệ
            Cần Thơ
          </p>
          <p>
            Văn bản có hiệu lực từ ngày 01/01/2026. Mọi thắc mắc vui lòng gửi về hòm thư{" "}
            <a href="mailto:dpo@ctuet.edu.vn" className="text-blue-600 underline">
              dpo@ctuet.edu.vn
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
