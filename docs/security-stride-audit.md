# CTUET-EWARS — Báo cáo Đánh giá An ninh Toàn diện STRIDE (Phase 7 Hardening)

> **Căn cứ tài liệu:** Tuân thủ [.agents/rules/06-security.md](file:///e:/CTUT-EWARS/.agents/rules/06-security.md) và [.agents/rules/00-project-context.md](file:///e:/CTUT-EWARS/.agents/rules/00-project-context.md).
> **Phạm vi:** Toàn bộ 5 module (`data-import`, `rule-engine`, `alerts`, `dashboard`, `admin`), tầng dữ liệu PostgreSQL, tầng worker BullMQ/Redis, và các Server Actions.
> **Trạng thái kiểm thử:** 14/14 automated tests PASS tại [src/lib/__tests__/stride-security.test.ts](file:///e:/CTUT-EWARS/src/lib/__tests__/stride-security.test.ts).

---

## 1. Ma trận Đánh giá Đe dọa STRIDE & Cơ chế Phòng vệ

| Phân loại STRIDE | Đe dọa Mục tiêu | Rủi ro Tiềm ẩn | Biện pháp Phòng vệ Kỹ thuật Triển khai | Bằng chứng Kiểm thử (Test Assertion) |
|---|---|---|---|---|
| **S — Spoofing** *(Giả mạo danh tính)* | Giả mạo session, cookie hoặc MSSV của sinh viên khác để truy cập trái phép. | Lộ lọt thông tin học tập, xâm phạm quyền riêng tư của sinh viên. | • Dùng Better Auth session token ký mã hóa an toàn, không dùng cookie tự tạo.<br>• Mọi Server Action bắt buộc gọi `getSession()` và `assertScope()`.<br>• Sinh viên chỉ được truy vấn dữ liệu có `studentId === session.user.id`. | `assertScope(null)` bị từ chối; Sinh viên A query MSSV B bị ném `AuthorizationError` 403. |
| **T — Tampering** *(Can thiệp dữ liệu)* | Sửa đổi trái phép trạng thái học vụ, can thiệp phiên bản luật hoặc sửa/xóa Audit Log. | Sai lệch hồ sơ học vụ, mất tính chính xác của quyết định can thiệp. | • **Ranh giới bất biến:** `Student.officialAcademicStatus` chỉ cập nhật 1 chiều từ SIS bên ngoài, không có bất kỳ mutation nào trong EWARS được phép sửa trường này.<br>• `Alert.isReferenceOnly` luôn mặc định `true`.<br>• `AuditLog` là bảng append-only, không expose bất kỳ Server Action nào UPDATE/DELETE.<br>• Sửa luật luôn tạo `RuleVersion` mới (DRAFT → Phê duyệt → ACTIVE, version cũ chuyển ARCHIVED). | Kiểm tra tính bất biến của `officialAcademicStatus`; `approveRuleVersionService` lưu trữ phiên bản cũ sang ARCHIVED. |
| **R — Repudiation** *(Chối bỏ trách nhiệm)* | Người dùng thực hiện thao tác can thiệp, duyệt luật hoặc đổi trạng thái nhưng chối bỏ. | Không quy kết được trách nhiệm hành chính khi có sự cố đào tạo. | • Mọi chuyển đổi trạng thái Alert (`ACKNOWLEDGE`, `RESOLVE`, `DISMISS`, `REOPEN`) bắt buộc ghi nhận `writeAuditLog` với đầy đủ `actorId`, `actorRole`, `action`, `targetEntity`, `targetId`, `timestamp`, `ipAddress`.<br>• Chuyển sang `DISMISSED` bắt buộc có lý do can thiệp. | `writeAuditLog` được kích hoạt với đầy đủ context trên mọi lifecycle action; state machine chặt chẽ qua `isTransitionAllowed`. |
| **I — Information Disclosure** *(Tiết lộ thông tin)* | Cố vấn học tập (CVHT) A xem dữ liệu sinh viên của CVHT B; lộ lọt thông tin bệnh án/sức khỏe. | Vi phạm Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP. | • `assertScope` phân quyền theo quan hệ cố vấn: CVHT A chỉ truy vấn sinh viên có `Student.advisorId === session.user.id`.<br>• Can thiệp có thông tin y tế/sức khỏe được gán nhãn `confidentialityLevel = SENSITIVE`, loại trừ khỏi dashboard tổng hợp.<br>• Không dùng `dangerouslySetInnerHTML`. | CVHT A truy vấn sinh viên của CVHT B bị ném lỗi chặn truy cập; nhãn `SENSITIVE` được thực thi trong DTO. |
| **D — Denial of Service** *(Từ chối dịch vụ)* | Tải lên file CSV hàng trăm MB làm cạn bộ nhớ máy chủ; truy vấn danh sách không giới hạn gây quá tải DB. | Hệ thống ngưng trệ, ảnh hưởng đến hoạt động cố vấn và cảnh báo. | • Ràng buộc dung lượng upload tối đa 20MB (`MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024`), từ chối ngay ở validation.<br>• Đọc CSV theo stream dạng chunk, không nạp toàn bộ vào RAM.<br>• Toàn bộ truy vấn danh sách giới hạn phân trang cursor/offset với `pageSize <= 100`.<br>• Debounce và dedup Notification trong Redis/DB chống bão thông báo. | `validateImportFileSize(25MB)` trả về `false`; `atRiskStudentListFilterSchema` chặn `pageSize = 500`. |
| **E — Elevation of Privilege** *(Nâng quyền bất hợp pháp)* | Người dùng tự đổi `role` từ STUDENT/ADVISOR thành ADMIN; người cấu hình tự duyệt luật của mình. | Chiếm quyền điều khiển hệ thống, thay đổi tùy tiện các ngưỡng cảnh báo. | • Chặn tự nâng quyền: Người dùng không được phép tự sửa `role` hoặc `scopeConfig` của chính mình.<br>• **Separation of Duties:** Cán bộ cấu hình luật (`configuredBy`) KHÔNG ĐƯỢC phép tự phê duyệt (`approvedBy`) phiên bản đó. | `updateUserAction` ném lỗi khi `userId === session.user.id` cố đổi `role`; `approveRuleVersionService` từ chối nếu `configuredBy === approverId`. |

---

## 2. Báo cáo Rà soát Phụ thuộc & Mã nguồn (Dependency Audit)

- **Lệnh thực thi:** `npm audit --omit=dev`
- **Kết quả môi trường Production:** **`found 0 vulnerabilities`** (100% sạch lỗ hổng bảo mật).
- **Phân tích các gói thư viện bắc cầu (Transitive Overrides):**
  - Đã bổ sung cấu hình `overrides` trong [package.json](file:///e:/CTUT-EWARS/package.json):
    - `decode-uri-component: "^0.5.0"`: Vá lỗi DoS phân tích percent-encoded.
    - `stream-json: "^3.7.0"`: Vá lỗi bộ nhớ đệm và prototype pollution.
    - `deepmerge-ts: "^8.0.2"`: Vá lỗi stack exhaustion khi gộp object đệ quy.
    - `mysql2: "^3.24.5"`: Vá lỗi auth plugin downgrade và unbounded zlib inflate.
  - Phụ thuộc môi trường dev (`eslint-config-next` lồng `micromatch` -> `braces@3.0.3`): Đã xác nhận phiên bản `braces@3.0.3` đã được tích hợp bản vá chính thức từ upstream.

---

## 3. Kết luận Đánh giá An ninh

Hệ thống CTUET-EWARS đáp ứng đầy đủ và toàn diện 6/6 mục trong tiêu chuẩn kiểm thử STRIDE theo quy định tại `06-security.md`. Toàn bộ các rào chắn phòng vệ đều được tự động hóa bằng unit/integration tests với thời gian chạy < 1s, sẵn sàng tích hợp vào CI/CD pipeline.
