# CTUET-EWARS (Early Warning Academic Risk System)

> **Hệ Thống Phát Hiện Sớm Dấu Hiệu Rủi Ro Học Tập Của Sinh Viên**  
> Đồ án Tốt nghiệp chuyên ngành Công nghệ Thông tin — Trường Đại học Kỹ thuật - Công nghệ Cần Thơ (CTUT)  
> *Phiên bản: 1.0.0 (Production & Demo Ready)*

---

## 📌 Mục Lục

1. [Giới thiệu & Ranh giới phạm vi hệ thống](#1-giới-thiệu--ranh-giới-phạm-vi-hệ-thống)
2. [Kiến trúc Công nghệ (Tech Stack)](#2-kiến-trúc-công-nghệ-tech-stack)
3. [Hướng dẫn Khởi chạy từ Máy Sạch (Clean Machine Setup)](#3-hướng-dẫn-khởi-chạy-từ-máy-sạch-clean-machine-setup)
4. [Tài khoản Đăng nhập Thử nghiệm (Demo Credentials)](#4-tài-khoản-đăng-nhập-thử-nghiệm-demo-credentials)
5. [Danh mục 13 Luật Nghiệp vụ & Kịch bản Demo](#5-danh-mục-13-luật-nghiệp-vụ--kịch-bản-demo)
6. [Quy trình Vận hành Khép kín 4 Bước](#6-quy-trình-vận-hành-khép-kín-4-bước)
7. [Kiểm thử & Đảm bảo Chất lượng (QA & Benchmark)](#7-kiểm-thử--đảm-bảo-chất-lượng-qa--benchmark)
8. [Vận hành, Sao lưu & Khôi phục Dữ liệu (Backup & Recovery)](#8-vận-hành-sao-lưu--khôi-phục-dữ-liệu-backup--recovery)

---

## 1. Giới thiệu & Ranh giới phạm vi hệ thống

**CTUET-EWARS** là giải pháp phần mềm chuyên biệt hỗ trợ Ban Đào tạo và Cố vấn học tập (CVHT) phát hiện sớm các dấu hiệu suy giảm học tập hoặc nguy cơ thôi học của sinh viên, từ đó chủ động liên hệ tư vấn, can thiệp kịp thời.

### ⚠️ Ranh giới Phạm vi Bất biến (Core Boundaries)
- **Hệ thống CHỈ thực hiện 4 nhiệm vụ cốt lõi**:
  1. Phát hiện dấu hiệu rủi ro từ 3 nguồn: **Điểm danh (Attendance)**, **Học tập (Academic/SIS)**, **LMS (Canvas/Moodle)**.
  2. Tạo hồ sơ cảnh báo tham khảo (`Alert.isReferenceOnly = true`).
  3. Gửi thông báo có kiểm soát chống trùng lặp tới CVHT và Cán bộ Đào tạo.
  4. Hỗ trợ CVHT ghi nhận hoạt động can thiệp (Intervention) và đánh giá hiệu quả.
- **TUYỆT ĐỐI KHÔNG**:
  - **Không tự ý thay đổi trạng thái học vụ chính thức** (`Student.officialAcademicStatus` như Thôi học, Tạm dừng, Buộc thôi học). Thẩm quyền này thuộc về Hội đồng Khen thưởng & Kỷ luật của Nhà trường thông qua hệ thống SIS chính thức.
  - Cảnh báo của EWARS chỉ là căn cứ định hướng hỗ trợ sư phạm, không phải là quyết định hành chính áp đặt.

### 🛡️ Tuân thủ Pháp lý Bảo vệ Dữ liệu Cá nhân
Hệ thống tuân thủ nghiêm ngặt **Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15** và **Nghị định 356/2025/NĐ-CP**:
- Ghi nhận Audit Log bất biến (Append-only) cho mọi thao tác truy cập dữ liệu nhạy cảm.
- Sinh viên có quyền xem điểm rủi ro, lịch sử can thiệp và quyền gửi phản hồi/đính chính dữ liệu.
- Phân vùng bảo mật mức `SENSITIVE` đối với các thông tin can thiệp đặc biệt (y tế, hoàn cảnh gia đình).

---

## 2. Kiến trúc Công nghệ (Tech Stack)

| Thành phần | Công nghệ sử dụng | Vai trò & Mục đích |
|---|---|---|
| **Frontend & Backend** | **Next.js 16** (App Router, Server Actions, React 19) | Fullstack framework hiện đại, SSR tối ưu hiệu năng |
| **Styling & UI** | **Tailwind CSS 4** + **Radix UI** + **Tremor Charts** | Giao diện quản trị khoa học, trực quan, hỗ trợ Dark Mode |
| **Cơ sở dữ liệu** | **PostgreSQL 16** | CSDL quan hệ lưu trữ hồ sơ, quan hệ điểm danh, điểm số, cảnh báo |
| **ORM** | **Prisma ORM 7** (`@prisma/client`, `@prisma/adapter-pg`) | Quản lý schema, migrations an toàn kiểu tĩnh (Type-safe) |
| **Hàng đợi & Worker** | **BullMQ** + **Redis 7** | Xử lý bất đồng bộ tác vụ tính toán rủi ro và gửi email hàng loạt |
| **Xác thực & Phân quyền** | **Better Auth** | Quản lý phiên (Session), RBAC 4 vai trò, Cookie bảo mật |
| **Lưu trữ Đối tượng** | **Minio** (S3 Compatible) | Lưu trữ file CSV/Excel nguồn đã import phục vụ truy vết |
| **Email Testing** | **MailHog** | Giả lập máy chủ SMTP ghi nhận email cảnh báo gửi đi |
| **Kiểm thử** | **Vitest** + **Node Test Runner** | 216 test cases tự động phủ kín logic nghiệp vụ, bảo mật, a11y |

---

## 3. Hướng dẫn Khởi chạy từ Máy Sạch (Clean Machine Setup)

### Điều kiện tiên quyết:
- **Node.js**: Phiên bản `>= 20.x` (khuyến nghị Node 20 LTS hoặc Node 22).
- **Docker** & **Docker Compose**: Đã cài đặt và đang chạy dịch vụ Docker Daemon.
- **Git**: Đã cài đặt.

---

### Bước 1: Clone mã nguồn & Cài đặt Thư viện
```bash
git clone https://github.com/66trent/Early-Warning-Academic-Risk-System.git
cd Early-Warning-Academic-Risk-System

# Cài đặt toàn bộ dependencies
npm install
```

---

### Bước 2: Thiết lập Biến môi trường (.env)
Dự án đã chuẩn bị sẵn file `.env.example`. Tạo file `.env` bằng lệnh:

```bash
# Trên Windows PowerShell:
Copy-Item .env.example .env

# Trên Linux/macOS:
cp .env.example .env
```

*Nội dung mặc định kết nối tới Docker nội bộ:*
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ctuet_ewars?schema=public"
REDIS_URL="redis://localhost:6379"
BETTER_AUTH_SECRET="ctuet_ewars_super_secret_session_key_2026_secure"
BETTER_AUTH_URL="http://localhost:3000"
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_FROM="no-reply@ctuet.edu.vn"
```

---

### Bước 3: Khởi động Hạ tầng Dịch vụ (Docker Compose)
Chạy PostgreSQL, Redis, MinIO và MailHog:

```bash
docker compose up -d postgres redis mailhog minio
```

*Kiểm tra trạng thái các container đang `healthy` hoặc `running`:*
```bash
docker compose ps
```

---

### Bước 4: Khởi tạo Cơ sở Dữ liệu & Nạp Dữ liệu Demo (Master Seed)
Chạy migration và nạp 15 kịch bản sinh viên minh họa 13 luật nghiệp vụ:

```bash
# 1. Đồng bộ cấu trúc bảng vào PostgreSQL
npx prisma db push

# 2. Nạp dữ liệu tài khoản và 13 kịch bản demo (Master Seed)
npm run db:seed
```

---

### Bước 5: Khởi động Ứng dụng Web
```bash
npm run dev
```

Mở trình duyệt truy cập: **[http://localhost:3000](http://localhost:3000)**  
Giao diện đăng nhập sẽ xuất hiện tại: **[http://localhost:3000/login](http://localhost:3000/login)**

*(Tùy chọn) Xem hộp thư MailHog ghi nhận email hệ thống gửi ra:* **[http://localhost:8025](http://localhost:8025)**

---

## 4. Tài khoản Đăng nhập Thử nghiệm (Demo Credentials)

Hệ thống hỗ trợ cơ chế **1-Click Quick Login** ngay trên màn hình đăng nhập `/login` để hỗ trợ Hội đồng kiểm tra nhanh:

| Vai trò | Tài khoản Email | Mật khẩu (hoặc Đăng nhập 1-Click) | Trang đích mặc định | Phạm vi quyền hạn |
|---|---|---|---|---|
| **Cố vấn học tập (CVHT)** | `nguyenvana@ctuet.edu.vn` | `Ctuet@2026` | `/alerts` | Xem danh sách cảnh báo lớp phụ trách, xác nhận cảnh báo, phân loại nguy cơ và lập can thiệp |
| **Sinh viên (STUDENT)** | `b2101001@student.ctuet.edu.vn` | `Ctuet@2026` | `/student/alerts` | Xem cảnh báo cá nhân, tiến độ rủi ro tham khảo, liên hệ CVHT và gửi phản hồi giải trình |
| **Cán bộ Đào tạo (QLĐT)** | `qldt@ctuet.edu.vn` | `Ctuet@2026` | `/dashboard` | Xem dashboard tổng hợp toàn trường/khoa, nhập dữ liệu nguồn (FR-IMP), cấu hình trọng số luật |
| **Quản trị viên (ADMIN)** | `admin@ctuet.edu.vn` | `Ctuet@2026` | `/admin` | Phê duyệt phiên bản luật (RuleVersion), xem nhật ký kiểm toán (Audit Logs), vô hiệu hóa cảnh báo |

---

## 5. Danh mục 13 Luật Nghiệp vụ & Kịch bản Demo

Dữ liệu seed tự động thiết lập 15 sinh viên demo, mỗi sinh viên đại diện cho một trường hợp nghiệp vụ điển hình:

| Mã Luật | Tên Luật Nghiệp vụ | Sinh viên Demo | MSSV | Tình huống kích hoạt | Mức độ |
|---|---|---|---|---|---|
| **HR-ATT-01** | Vắng liên tiếp ≥ 3 buổi | Nguyễn Văn Vắng Liên Tiếp | `B2101001` | Vắng 3 buổi học liên tiếp không phép môn Lập trình C | `HIGH` |
| **HR-ATT-02** | Ngưỡng cấm thi ≥ 20% số buổi | Trần Thị Chạm Cấm Thi | `B2101002` | Tỉ lệ vắng học vượt quá 20% tổng số buổi quy định | `CRITICAL` |
| **HR-ATT-03** | Vắng đa môn đồng thời trong tuần | Lê Hoàng Vắng Đa Môn | `B2101003` | Vắng cả 2 môn khác nhau trong cùng 1 tuần học | `HIGH` |
| **HR-ATT-04** | Không tham gia học đầu kỳ | Phạm Minh Bỏ Học Đầu Kỳ | `B2101004` | Vắng trọn vẹn 2 tuần đầu tiên của học kỳ mới | `HIGH` |
| **HR-ACA-01** | Điểm liệt bài đánh giá quan trọng | Võ Thị Điểm Liệt Giữa Kỳ | `B2101005` | Điểm thi giữa kỳ đạt 1.5/10 (trọng số 30%) | `HIGH` |
| **HR-ACA-02** | Tiệm cận cảnh báo học vụ | Đặng Quốc Tiệm Cận Cảnh Báo | `B2101006` | GPA tích lũy đạt 0.95 (tiệm cận ngưỡng xử lý học vụ 1.0) | `CRITICAL` |
| **HR-ACA-03** | Sụt giảm GPA đột ngột | Bùi Tuấn Tụt Dốc GPA | `B2101007` | GPA giảm 1.35 điểm so với kỳ trước (3.20 -> 1.85) | `MEDIUM` |
| **HR-ACA-04** | Học lại nhiều lần do rớt môn | Hồ Thanh Học Lại Lần 3 | `B2101008` | Đăng ký học môn CT102 lần thứ 3 (`attemptNumber = 3`) | `MEDIUM` |
| **HR-LMS-01** | Không hoạt động LMS kéo dài ≥ 14 ngày | Dương Mai Bỏ LMS 14 Ngày | `B2101009` | 15 ngày liên tục không truy cập LMS và trễ hạn nộp bài | `CRITICAL` |
| **HR-LMS-02** | Bỏ nộp bài bắt buộc liên tiếp | Ngô Gia Bỏ Nộp Bài Quiz | `B2101010` | Bỏ lỡ 2 bài Quiz bắt buộc liên tiếp đã quá hạn | `HIGH` |
| **HR-LMS-03** | Hai điểm liệt liên tiếp bài tự chấm | Trịnh Bảo Hai Số Không LMS | `B2101011` | Nhận 2 điểm 0.0 liên tiếp ở Quiz 1 và Quiz 2 | `MEDIUM` |
| **HR-COMB-01** | Tín hiệu tiêu cực đa nguồn đồng thời | Đỗ Hùng Tiêu Cực Đa Nguồn | `B2101012` | Cùng tuần: Vắng học + điểm kiểm tra 2.0 + bỏ LMS 6 ngày | `CRITICAL` |
| **HR-COMB-02** | Biến mất hoàn toàn (Khẩn cấp) | Phan An Biến Mất Hoàn Toàn | `B2101013` | 12 ngày không có bất kỳ dấu hiệu học tập nào | `CRITICAL` |
| **HR-EXC-01** | Trường hợp ngoại lệ hợp lệ | Lâm Như Có Đơn Miễn Bài | `B2101014` | Có đơn y tế hợp lệ -> Cảnh báo được giải tỏa (`DISMISSED`) | `LOW` |
| *(Chuẩn)* | Sinh viên học tốt tiêu biểu | Hoàng Kim Sinh Viên Tiêu Biểu | `B2101015` | Chuyên cần 100%, GPA 3.85, Risk Score = 0.02 | `SAFE` |

---

## 6. Quy trình Vận hành Khép kín 4 Bước

```mermaid
flowchart LR
    A["1. Nạp Dữ Liệu\n(Điểm danh, Điểm số, LMS)"] --> B["2. Rule Engine & Risk Score\n(Phát hiện 13 Luật & Renormalize)"]
    B --> C["3. Cảnh Báo Sớm\n(Tạo Alert, Phân loại, Gửi CVHT)"]
    C --> D["4. Can Thiệp Sư Phạm\n(Tư vấn, Lập kế hoạch, Đóng ca)"]
```

1. **Bước 1 — Nạp dữ liệu nguồn**: Cán bộ Đào tạo vào mục `/data-import` tải lên file CSV/Excel (hoặc hệ thống định kỳ đồng bộ qua API). Bảng điều khiển kiểm tra lỗi (staging/reconciliation) trước khi ghi vào CSDL.
2. **Bước 2 — Phân tích & Tính điểm Rủi ro**: Rule Engine đối soát dữ liệu với các RuleVersion đang có hiệu lực. Tự động tính toán điểm rủi ro tổng hợp $RiskScore \in [0, 1]$ kèm cấp độ đầy đủ dữ liệu (`FULL`, `PARTIAL`, `INSUFFICIENT`).
3. **Bước 3 — Tạo & Điều phối Cảnh báo**: Cảnh báo được nhóm lại theo từng sinh viên. CVHT nhận danh sách sinh viên rủi ro tại `/alerts` với đầy đủ bằng chứng (trigger snapshot, biểu đồ học tập).
4. **Bước 4 — Can thiệp & Đóng hồ sơ**: CVHT nhấn **Xác nhận (Acknowledge)** trong vòng ≤ 2 cú nhấp chuột, tiến hành hẹn gặp/gọi điện, ghi nhận nội dung can thiệp tại `/alerts/[id]`, chuyển trạng thái sang **Resolved** sau khi sinh viên cải thiện.

---

## 7. Kiểm thử & Đảm bảo Chất lượng (QA & Benchmark)

Hệ thống đã trải qua quy trình kiểm thử tự động nghiêm ngặt:

```bash
# Chạy toàn bộ 216 test cases tự động
npm run test:run

# Kiểm tra an toàn kiểu tĩnh TypeScript (Strict Mode)
npm run typecheck

# Kiểm tra chất lượng mã nguồn ESLint
npm run lint

# Kiểm tra an ninh thư viện phụ thuộc (0 lỗ hổng bảo mật)
npm audit --omit=dev
```

### Kết quả Benchmark Hiệu năng Thực tế (10,000 Sinh viên):
- **Thời gian xử lý Rule Engine**: `< 1,200 ms` cho 10,000 bản ghi sinh viên (đạt chuẩn SLA `< 5,000 ms`).
- **Thời gian phản hồi Server Actions**: `~ 45 ms` cho thao tác xác nhận cảnh báo và ghi nhận can thiệp.
- **Tiêu chuẩn Truy cập (A11y)**: Đạt chuẩn **WCAG 2.1 AA** với độ tương phản màu sắc `≥ 4.5:1` và hỗ trợ bàn phím 100%.

---

## 8. Vận hành, Sao lưu & Khôi phục Dữ liệu (Backup & Recovery)

Hệ thống cung cấp sẵn các tập lệnh sao lưu và khôi phục định kỳ cho Quản trị viên:

### Sao lưu Cơ sở Dữ liệu (Full Backup):
```bash
# Windows PowerShell:
.\scripts\backup-db.ps1

# Linux / macOS:
./scripts/backup-db.sh
```
*Bản sao lưu sẽ được xuất dưới dạng nén `.sql.gz` hoặc `.dump` kèm mã băm SHA-256 để chống can thiệp trái phép.*

### Khôi phục Dữ liệu (Disaster Recovery):
```bash
# Windows PowerShell:
.\scripts\restore-db.ps1 -BackupFile .\backups\ctuet_ewars_backup_latest.sql

# Linux / macOS:
./scripts/restore-db.sh ./backups/ctuet_ewars_backup_latest.sql
```

---

## 🎓 Hội đồng Đánh giá & Giảng viên Hướng dẫn
- **Đơn vị đào tạo**: Khoa Công nghệ Thông tin — Trường Đại học Kỹ thuật - Công nghệ Cần Thơ (CTUT).
- **Mã đề tài**: CTUET-EWARS-2026.
- **Tài liệu tham khảo chuyên sâu**:
  - [Kịch bản Thuyết trình & Trả lời Vấn đáp Hội đồng (Defense Guide)](docs/demo-guide-defense.md)
  - [Báo cáo Kiểm toán An ninh STRIDE (Security Audit)](docs/security-stride-audit.md)
  - [Báo cáo Đánh giá Hiệu năng & Khả năng Chịu tải (Benchmark Report)](docs/performance-benchmark-report.md)
  - [Kế hoạch Ứng phó Sự cố & Khôi phục Thảm họa (Disaster Recovery Plan)](docs/incident-response-dr-plan.md)

---
*CTUET-EWARS © 2026. Phát triển với tâm huyết phục vụ nâng cao chất lượng đào tạo và hỗ trợ người học.*
