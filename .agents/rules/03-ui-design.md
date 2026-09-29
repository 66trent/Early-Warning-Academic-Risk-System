# 03 — Thiết kế UI

Xem `00-project-context.md` cho glossary (đặc biệt: enum `Severity`, `DataCompletenessLevel`, entity `Alert`). File này quy định thư viện và thành phần giao diện.

## Thư viện component

- MUST: dùng shadcn/ui cho mọi thành phần chuẩn (Form, Table, Dialog, Dropdown, Badge, Tabs, Sheet, Toast).
- MUST: dùng Tremor chỉ cho khu vực dashboard/báo cáo (biểu đồ, KPI card). MUST NOT dùng Tremor cho form nhập liệu hoặc bảng có thao tác dòng — dùng shadcn `Table`.
- MUST NOT: cài thêm UI kit thứ 3 (Ant Design, MUI...). Nhu cầu mới chưa có trong shadcn/ui thì tự dựng bằng Radix primitives + Tailwind.

## Hệ thống màu theo Severity — định nghĩa 1 lần, dùng khắp app

| Severity   | Class Tailwind                  |
| ---------- | ------------------------------- |
| `LOW`      | `bg-slate-100 text-slate-700`   |
| `MEDIUM`   | `bg-amber-100 text-amber-700`   |
| `HIGH`     | `bg-orange-100 text-orange-700` |
| `CRITICAL` | `bg-red-100 text-red-700`       |

- MUST: định nghĩa bảng màu này 1 lần trong `tailwind.config`/CSS variables, import dùng lại — không hard-code màu Severity ở từng component.
- MUST: `DataCompletenessLevel` dùng bộ màu khác hoàn toàn với Severity (ví dụ xám/xanh dương) — đây là 2 khái niệm độc lập, không được dùng chung thang màu đỏ-vàng-xanh để tránh người dùng hiểu nhầm "thiếu dữ liệu" thành "rủi ro cao/thấp".
- MUST NOT: dùng đỏ/xanh lá cho `AlertStatus` — dùng màu trung tính (xanh dương, tím, xám) để không nhầm với mức độ nguy hiểm.

## Component bắt buộc gắn với ràng buộc nghiệp vụ

- MUST: mọi nơi hiển thị `Alert` có dòng cố định, không được ẩn/thu gọn: "Cảnh báo sớm — mang tính tham khảo, không phải quyết định học vụ chính thức".
- MUST: mọi nơi hiển thị `RiskScoreLog.riskScoreValue` kèm badge `dataCompletenessLevel` ngay cạnh — MUST NOT hiển thị con số RiskScore đơn độc không có ngữ cảnh độ tin cậy.
- MUST: danh sách `RuleTrigger.reason` của 1 `Alert` hiển thị dạng Accordion — mỗi luật vi phạm là 1 mục riêng, mở rộng mới thấy `inputSnapshot` chi tiết.

## Bảng dữ liệu

- MUST: dùng `@tanstack/react-table` + shadcn `Table` cho mọi danh sách có lọc/sắp xếp/phân trang.
- MUST: bảng dòng lỗi nhập liệu có cột "Lý do lỗi" (Badge đỏ nhạt) và nút "Tải xuống" ở đầu bảng.
- MUST: bảng danh sách sinh viên nguy cơ mặc định sắp xếp Severity giảm dần, `CRITICAL` luôn ở trên cùng.

## Form

- MUST: dùng `react-hook-form` + `zodResolver` + shadcn `Form` cho mọi form. MUST NOT tự quản lý form bằng `useState` rời rạc cho từng field.
- MUST: form sửa `RuleVersion` hiển thị giá trị hiện tại (phiên bản `ACTIVE`) trước khi cho sửa, và cảnh báo rõ "Lưu sẽ tạo phiên bản mới, không ghi đè" trước khi submit.

## Responsive & Dark mode

- MUST: responsive tối thiểu 3 breakpoint: mobile (<640px), tablet (640–1024px), desktop (>1024px).
- MUST: dùng `next-themes` cho dark mode — không tự viết toggle riêng.

## Giao diện Sinh viên — tách biệt khỏi giao diện CVHT/Cán bộ

- MUST NOT: hiển thị `RuleTrigger.inputSnapshot` thô cho role `STUDENT` — chỉ hiển thị `reason` đã diễn giải dễ hiểu, ngôn ngữ tích cực.
- MUST NOT: dùng màu đỏ chớp/nhấp nháy hoặc ngôn ngữ đe dọa trên giao diện sinh viên.
