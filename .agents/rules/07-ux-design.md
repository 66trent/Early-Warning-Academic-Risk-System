# 07 — Thiết kế UX

Xem `00-project-context.md` cho glossary và vai trò người dùng.

## Nguyên tắc chung — hỗ trợ quyết định, không phán xét

- MUST: mọi ngôn ngữ trong UI/thông báo/email trung tính, hướng giải pháp. MUST NOT dùng từ mang tính đổ lỗi ("sinh viên yếu kém", "vi phạm") — dùng ngôn ngữ mô tả sự việc + gợi ý hành động ("có dấu hiệu cần hỗ trợ", "gợi ý: liên hệ trong 48 giờ").
- MUST: mọi cảnh báo hiển thị cho CVHT trả lời được trong 5 giây đọc lướt: Ai (tên, mã số) — Vì sao (lý do chính, không phải toàn bộ log kỹ thuật) — Cần làm gì (nút hành động rõ ràng).

## CVHT — người dùng chính, tần suất cao

- MUST: dashboard mặc định mở ra danh sách `Alert` cần hành động (`OPEN`/`ACKNOWLEDGED`) — MUST NOT mở màn hình thống kê tổng quan làm mặc định.
- MUST: luồng "Xác nhận → Ghi can thiệp" tối đa 2 lần click từ danh sách — dùng Sheet/Dialog hiển thị chi tiết + form can thiệp trên cùng màn hình, MUST NOT chuyển sang trang riêng.
- MUST: khi 1 `Alert` có nhiều `RuleTrigger`, hiển thị tóm tắt trước (ví dụ "3 nguyên nhân: vắng học, giảm tương tác LMS, điểm giữa kỳ thấp"), cho mở rộng xem chi tiết — MUST NOT bắt đọc hết log ngay từ đầu.
- SHOULD: có chế độ "Đánh dấu đã xem tất cả" cho `Alert` mức `LOW` để giảm cảm giác quá tải.

## Sinh viên — cần trấn an, không gây hoảng loạn

- MUST NOT: dùng từ "cảnh báo"/"rủi ro" làm tiêu đề chính trên trang cá nhân sinh viên — dùng khung tích cực ("Tình hình học tập của bạn") kèm gợi ý cụ thể, dễ hành động.
- MUST NOT: hiển thị con số `RiskScoreLog.riskScoreValue` thô (0.0–1.0) cho role `STUDENT` — chỉ hiển thị mức đã diễn giải (VD: "Cần chú ý" / "Ổn định").
- MUST: có nút/link liên hệ CVHT trực tiếp ngay trên trang cảnh báo cá nhân.

## Cán bộ QLĐT — cần tổng quan + cấu hình an toàn

- MUST: màn hình cấu hình luật có chế độ xem trước tác động trước khi kích hoạt (ước tính số sinh viên bị ảnh hưởng nếu áp dụng ngưỡng mới).
- MUST: thao tác nguy hiểm (kích hoạt luật mới, hủy batch, đổi trọng số lớn) có bước xác nhận thứ hai (AlertDialog) — MUST NOT thực hiện ngay sau 1 lần click.
- SHOULD: đặt dashboard chất lượng dữ liệu ở vị trí dễ thấy, không chôn sâu trong menu.

## Trạng thái rỗng, lỗi, đang tải

- MUST: mọi danh sách có thể rỗng có empty state có ý nghĩa (không chỉ "Không có dữ liệu") — ví dụ danh sách `Alert` rỗng: "Chưa có sinh viên nào cần chú ý trong học kỳ này".
- MUST: lỗi nhập file hiển thị có thể hành động — chỉ rõ dòng, cột, lý do, và nút "Tải file lỗi để sửa" ngay tại chỗ báo lỗi, MUST NOT chỉ báo "Lỗi" chung chung.
- SHOULD: loading state cho thao tác chạy lâu (tính RiskScore, đồng bộ LMS) hiển thị tiến độ có ý nghĩa (VD: "Đang xử lý 340/1200 sinh viên") thay vì spinner vô nghĩa, nếu API hỗ trợ trả tiến độ.

## Khả năng tiếp cận

- MUST NOT: dùng màu làm phương tiện truyền tải thông tin duy nhất — Severity luôn có label chữ đi kèm màu.
- MUST: giữ nguyên thuộc tính ARIA mặc định của Radix UI (nền tảng shadcn/ui) — MUST NOT ghi đè làm mất ARIA.
- MUST: kích thước vùng chạm tối thiểu 44×44px trên giao diện mobile cho nút hành động quan trọng (Xác nhận, Gọi điện).

## Nhất quán thuật ngữ

- MUST: dùng đúng 1 tên gọi xuyên suốt app/email/tài liệu cho mỗi vai trò/khái niệm ("Cố vấn học tập" — không đổi thành "CVHT"/"Giảng viên chủ nhiệm"/"Advisor" tùy màn hình; "Cảnh báo sớm" — không đổi tên khác ở nơi khác).
