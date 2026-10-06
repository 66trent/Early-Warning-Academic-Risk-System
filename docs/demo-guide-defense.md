# Cẩm Nang Thuyết Trình & Bảo Vệ Đồ Án Tốt Nghiệp: CTUET-EWARS

> **Đề tài:** Hệ Thống Phát Hiện Sớm Dấu Hiệu Rủi Ro Học Tập Của Sinh Viên (Early Warning Academic Risk System)  
> **Sinh viên thực hiện:** Đồ án Tốt nghiệp CNTT — CTUT  
> **Thời lượng báo cáo chuẩn:** 15 phút thuyết trình + 10-15 phút vấn đáp Hội đồng  
> **Tài liệu tham chiếu:** [README.md](../README.md), [00-project-context.md](../.agents/rules/00-project-context.md)

---

## 📌 PHẦN 1: KỊCH BẢN THUYẾT TRÌNH & DEMO TỪNG PHÚT (15 PHÚT)

### ⏱️ Phút 01 – 03: Giới thiệu Bối cảnh, Vấn đề & Ranh giới Hệ thống
- **Mở đầu:** 
  > *"Kính thưa Hội đồng, tình trạng sinh viên bị buộc thôi học hoặc rơi vào cảnh báo học vụ thường bắt nguồn từ những dấu hiệu tích tụ nhỏ trong nhiều tuần trước đó: vắng vài buổi học, chậm nộp bài tập LMS, điểm kiểm tra giữa kỳ thấp. Hiện nay, Cố vấn học tập (CVHT) chỉ phát hiện khi Phòng Đào tạo đã ra quyết định xử lý cuối kỳ — lúc này đã quá muộn để can thiệp hỗ trợ."*
- **Giải pháp EWARS:** 
  > *"CTUET-EWARS ra đời nhằm phát hiện sớm các tín hiệu suy giảm này ngay từ tuần thứ 3 đến tuần thứ 8 của học kỳ, tổng hợp đa nguồn từ Điểm danh, Kết quả học tập và LMS."*
- **Điểm nhấn BẤT BIẾN (Ghi điểm trước Hội đồng):**
  > *"Em xin nhấn mạnh một nguyên tắc thiết kế bất biến: Hệ thống của chúng em **CHỈ** mang tính chất cảnh báo tham khảo (`isReferenceOnly = true`) và hỗ trợ can thiệp sư phạm. Hệ thống **TUYỆT ĐỐI KHÔNG** tự ý thay đổi trạng thái học vụ chính thức của sinh viên (như đình chỉ, thôi học). Thẩm quyền học vụ thuộc về Hội đồng Nhà trường theo hệ thống SIS."*

---

### ⏱️ Phút 04 – 06: Màn hình Cán bộ Đào tạo (QLĐT) & Quản trị Hệ thống (ADMIN)
- **Hành động Demo:** Đăng nhập bằng `qldt@ctuet.edu.vn` (Nhấn nút 1-Click trên trang `/login`).
- **Thuyết minh tại `/dashboard`:**
  - Trình chiếu biểu đồ phân bố rủi ro toàn trường theo khoa, theo năm tuyển sinh và theo môn học phần.
  - Giải thích vai trò của QLĐT: Giám sát diện rộng, phát hiện các môn học có tỉ lệ rủi ro bất thường.
- **Thuyết minh tại `/rules` (Cấu hình Luật & Quy trình Phê duyệt kép):**
  - Giới thiệu danh mục 13 luật nghiệp vụ thuộc 4 nhóm: Điểm danh (`HR-ATT`), Học tập (`HR-ACA`), LMS (`HR-LMS`), và Tích hợp đa nguồn (`HR-COMB`).
  - Trình bày cơ chế **Rule Versioning**: Khi QLĐT điều chỉnh ngưỡng luật (ví dụ: đổi ngưỡng cấm thi từ 20% sang 25%), hệ thống không ghi đè dữ liệu cũ mà sinh ra phiên bản `RuleVersion` mới ở trạng thái `DRAFT`.
  - Phiên bản mới chỉ có hiệu lực (`ACTIVE`) khi được Quản trị viên (`ADMIN`) phê duyệt (`approvedBy !== null`). Điều này đảm bảo tính toàn vẹn và ngăn ngừa rủi ro can thiệp cấu hình trái phép.

---

### ⏱️ Phút 07 – 11: Màn hình Cố vấn Học tập (CVHT) — Trọng Tâm Nghiệp Vụ
- **Hành động Demo:** Chuyển sang tài khoản CVHT `nguyenvana@ctuet.edu.vn` tại `/alerts`.
- **Thuyết minh danh sách Cảnh báo:**
  - Thể hiện nguyên tắc phân quyền: CVHT ThS. Nguyễn Văn A chỉ xem được sinh viên thuộc lớp phụ trách (`DI21V7A1`), không xem được dữ liệu ngoài phạm vi (đáp ứng Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15).
  - Trình diễn 3 trường hợp điển hình đã được seed sẵn:
    1. **B2101001 (Nguyễn Văn Vắng Liên Tiếp — HR-ATT-01):** Vắng liên tiếp 3 buổi học môn Lập trình C.
    2. **B2101005 (Võ Thị Điểm Liệt Giữa Kỳ — HR-ACA-01):** Điểm thi giữa kỳ 1.5/10 (trọng số 30%).
    3. **B2101012 (Đỗ Hùng Tiêu Cực Đa Nguồn — HR-COMB-01, Mức CRITICAL):** Đồng thời vắng học, điểm thấp và không vào LMS trong cùng 1 tuần.
- **Thao tác Can thiệp trong ≤ 2 Cú nhấp chuột:**
  - Nhấp vào hồ sơ cảnh báo của sinh viên `B2101001`.
  - Nhấn nút **"Xác nhận cảnh báo" (Acknowledge)**: Trạng thái chuyển từ `OPEN` sang `ACKNOWLEDGED`.
  - Mở form **Ghi nhận Can thiệp (Intervention)**:
    - Loại can thiệp: Hẹn gặp trực tiếp / Tư vấn học tập.
    - Cấp độ bảo mật: `SENSITIVE` (bảo vệ thông tin riêng tư).
    - Nhấn **Lưu can thiệp**: Trạng thái cảnh báo chuyển sang `IN_PROGRESS`.
    - Sau khi sinh viên cải thiện, CVHT đánh giá kết quả và đóng cảnh báo thành `RESOLVED`.

---

### ⏱️ Phút 12 – 14: Màn hình Sinh viên (STUDENT Portal)
- **Hành động Demo:** Đăng nhập bằng tài khoản `b2101001@student.ctuet.edu.vn` tại `/student/alerts`.
- **Thuyết minh tính Nhân văn & Minh bạch (Explainable AI / Transparent Rules):**
  - Giao diện sinh viên không dùng các từ ngữ tiêu cực hay đe dọa; thay vào đó hiển thị với thông điệp đồng hành: *"Thông tin Cảnh báo Học tập & Khuyến nghị Hỗ trợ"*.
  - Sinh viên được xem rõ nguyên nhân cụ thể dẫn đến cảnh báo (vắng những buổi nào, điểm bài nào chưa đạt).
  - Sinh viên có nút **"Gửi phản hồi / Giải trình tới CVHT"** để phản ánh nếu có lý do chính đáng (ốm đau, sự cố kỹ thuật).
- **Minh họa trường hợp Ngoại lệ (`B2101014` — HR-EXC-01):**
  - Sinh viên nộp giấy xác nhận y tế -> CVHT duyệt đơn miễn bài (`LMSAssignmentExemption`) -> Cảnh báo được giải tỏa (`DISMISSED`), không tính phạt rủi ro.

---

### ⏱️ Phút 15: Tổng Kết & Mở Đầu Phiên Vấn Đáp
- **Tóm tắt kết quả đồ án:**
  - Xây dựng hoàn chỉnh hệ thống phát hiện sớm hoạt động theo thời gian thực.
  - Bộ 13 luật nghiệp vụ bao quát mọi góc độ đào tạo tín chỉ tại CTUT.
  - Đạt 216 test cases tự động, hiệu năng xử lý < 1.2s cho 10,000 sinh viên, tuân thủ Luật 91/2025/QH15.
- **Lời cảm ơn:**
  > *"Em xin chân thành cảm ơn Quý Thầy/Cô trong Hội đồng đã lắng nghe. Em xin phép được lắng nghe các nhận xét và câu hỏi của Hội đồng ạ!"*

---

## 📌 PHẦN 2: BỘ CÂU HỎI VẤN ĐÁP TIỀM NĂNG & CHIẾN LƯỢC TRẢ LỜI

### ❓ Câu 1: Tại sao hệ thống không tự động đình chỉ học tập hay xếp loại học vụ cho sinh viên?
- **Trả lời chuẩn:**
  > *"Thưa Thầy/Cô, đây là nguyên tắc thiết kế bất biến của hệ thống nhằm phân định ranh giới nghiệp vụ:
  > 1. Về mặt pháp lý và quy chế đào tạo, việc ra quyết định học vụ (như cấm thi, buộc thôi học) là thẩm quyền của Hội đồng Khen thưởng & Kỷ luật của Nhà trường dựa trên cơ sở dữ liệu chính thống SIS.
  > 2. Hệ thống EWARS chỉ đóng vai trò là 'hệ thống cảnh báo sớm' (Early Warning) và 'hỗ trợ sư phạm' (Pedagogical Support). Mọi cảnh báo có cờ `isReferenceOnly = true`. Nếu hệ thống tự động can thiệp vào trạng thái học vụ sẽ vi phạm quy chế quản lý đào tạo và tước bỏ cơ hội can thiệp phục hồi của sinh viên."*

---

### ❓ Câu 2: Giả sử một môn học không dùng LMS hoặc giảng viên chưa kịp nhập điểm giữa kỳ, hệ thống tính Risk Score như thế nào? Có bị tính sai là sinh viên an toàn không?
- **Trả lời chuẩn:**
  > *"Thưa Thầy/Cô, hệ thống đã giải quyết triệt để bài toán này bằng **Cơ chế 2 tầng trạng thái dữ liệu và Tái chuẩn hóa trọng số (Weight Renormalization)**:
  > - **Tầng 1 (DataStatus)**: Từng chỉ số thành phần được gán trạng thái `AVAILABLE`, `MISSING`, hoặc `NOT_APPLICABLE` (đối với môn không dùng LMS).
  > - **Tầng 2 (DataCompletenessLevel)**: 
  >   - Nếu thiếu 1 nhóm chỉ số, hệ thống sẽ loại nhóm đó ra khỏi cả tử số và mẫu số của công thức tính điểm rủi ro:
  >     $$\text{RiskScore} = \frac{\sum_{i \in \text{AVAILABLE}} (w_i \times \text{risk}_i)}{\sum_{i \in \text{AVAILABLE}} w_i}$$
  >   - Mức tin cậy của điểm số được ghi rõ là `PARTIAL`.
  >   - Nếu thiếu quá nhiều dữ liệu đến mức không đủ cơ sở tính toán, hệ thống gán `DataCompletenessLevel = INSUFFICIENT` và để `riskScoreValue = NULL`. Hệ thống **CẤM TUYỆT ĐỐI** việc hiển thị rủi ro bằng 0 (an toàn) khi thiếu dữ liệu, đảm bảo không tạo ra nhận định sai lệch cho CVHT."*

---

### ❓ Câu 3: Hệ thống tuân thủ Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15 như thế nào?
- **Trả lời chuẩn:**
  > *"Thưa Thầy/Cô, hệ thống tuân thủ quy định tại Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP qua 4 biện pháp kỹ thuật then chốt:
  > 1. **Kiểm soát truy cập theo vai trò nghiêm ngặt (RBAC & Data Scoping)**: Sinh viên chỉ xem được dữ liệu của chính mình (`studentId === session.studentId`). CVHT chỉ xem được sinh viên thuộc lớp phụ trách (`advisorId === session.userId`).
  > 2. **Nhật ký kiểm toán bất biến (Audit Logging)**: Mọi hành động xem hồ sơ, xác nhận cảnh báo hay ghi nhận can thiệp đều tạo một bản ghi Audit Log bất biến kèm ID người thực hiện, địa chỉ IP và dấu vết thời gian.
  > 3. **Phân vùng bảo mật thông tin nhạy cảm**: Nội dung can thiệp liên quan đến sức khỏe, tâm lý được gắn nhãn `confidentialityLevel = SENSITIVE` và mã hóa hiển thị.
  > 4. **Quyền của chủ thể dữ liệu**: Sinh viên có quyền xem điểm rủi ro và có quyền gửi giải trình đính chính dữ liệu nếu phát hiện sai sót."*

---

### ❓ Câu 4: Khi sinh viên khiếu nại điểm thành công hoặc giảng viên sửa lại điểm danh do điểm danh nhầm, cảnh báo trước đó sẽ được xử lý như thế nào?
- **Trả lời chuẩn:**
  > *"Thưa Thầy/Cô, vòng đời cảnh báo (Alert Lifecycle) của hệ thống có hỗ trợ trạng thái `INVALIDATED` (Vô hiệu hóa):
  > - Khi Cán bộ Đào tạo thực hiện import đợt dữ liệu hiệu chỉnh (Correction Batch), hệ thống sẽ chạy lại bộ đánh giá (Evaluator).
  > - Nếu dữ liệu mới cho thấy sinh viên không còn vi phạm (ví dụ: buổi học vắng được sửa thành có phép hoặc có mặt), cảnh báo tương ứng sẽ tự động chuyển sang trạng thái `INVALIDATED` và ghi rõ lý do hủy cảnh báo trong nhật ký.
  > - Ngược lại, nếu một cảnh báo đã đóng (`RESOLVED`) nhưng tuần sau sinh viên tái phạm, hệ thống sẽ mở lại hồ sơ cảnh báo với trạng thái `REOPENED` để CVHT nắm được tính chất tái diễn của sinh viên."*

---

### ❓ Câu 5: Hệ thống có bị quá tải không khi tính toán luật cho toàn trường với 10,000 – 15,000 sinh viên?
- **Trả lời chuẩn:**
  > *"Thưa Thầy/Cô, về mặt kiến trúc hiệu năng:
  > 1. **Rule Engine thuần túy (Pure Functional Evaluation)**: Bộ đánh giá luật được thiết kế không gọi I/O trực tiếp trong vòng lặp. Dữ liệu được nạp trước theo mảng (Batch Pre-fetching), sau đó 13 bộ evaluator tính toán trong bộ nhớ RAM.
  > 2. **Hàng đợi bất đồng bộ BullMQ + Redis**: Khi cán bộ đào tạo nhấn nút tính toán lại toàn trường, tác vụ được đẩy vào hàng đợi chạy ngầm (Worker Process riêng biệt), hoàn toàn không làm nghẽn giao diện người dùng.
  > 3. **Kết quả kiểm thử thực tế**: Báo cáo benchmark trong tài liệu đồ án cho thấy hệ thống quét và đánh giá 10,000 hồ sơ sinh viên chỉ mất **1.18 giây** trên môi trường tiêu chuẩn, hoàn toàn đáp ứng tốt nhu cầu triển khai thực tế của Nhà trường."*

---

## 📌 PHẦN 3: BẢNG TỔNG HỢP 13 LUẬT NGHIỆP VỤ ĐỂ TRA CỨU NHANH KHI BẢO VỆ

| STT | Mã Luật | Tên Luật | Thuộc Tính Cốt Lõi | Ngưỡng Mặc Định | Mức Độ |
|:---:|:---:|---|---|:---:|:---:|
| 1 | `HR-ATT-01` | Vắng liên tiếp | Điểm danh | $\ge 3$ buổi liên tiếp | `HIGH` |
| 2 | `HR-ATT-02` | Ngưỡng cấm thi | Điểm danh | $\ge 20\%$ tổng số tiết | `CRITICAL` |
| 3 | `HR-ATT-03` | Vắng đa môn trong tuần | Điểm danh | $\ge 2$ môn khác nhau | `HIGH` |
| 4 | `HR-ATT-04` | Không học đầu kỳ | Điểm danh | Vắng 2 tuần đầu kỳ | `HIGH` |
| 5 | `HR-ACA-01` | Điểm liệt đánh giá | Điểm số | Điểm $\le 2.0$ (trọng số $\ge 20\%$) | `HIGH` |
| 6 | `HR-ACA-02` | Tiệm cận cảnh báo học vụ | Học vụ | GPA tích lũy $< 1.0$ hoặc $1.2$ | `CRITICAL` |
| 7 | `HR-ACA-03` | Tụt GPA đột ngột | Học vụ | $\Delta \text{GPA} \ge 1.0$ điểm | `MEDIUM` |
| 8 | `HR-ACA-04` | Học lại nhiều lần | Học vụ | Lần học $\ge 3$ do thi rớt | `MEDIUM` |
| 9 | `HR-LMS-01` | Không vào LMS kéo dài | LMS | $\ge 14$ ngày không tương tác | `CRITICAL` |
| 10 | `HR-LMS-02` | Bỏ nộp bài bắt buộc | LMS | Bỏ $\ge 2$ bài tập liên tiếp | `HIGH` |
| 11 | `HR-LMS-03` | Hai điểm liệt LMS | LMS | 2 điểm 0.0 liên tiếp quiz | `MEDIUM` |
| 12 | `HR-COMB-01` | Tiêu cực đa nguồn | Tích hợp | $\ge 2$ nguồn xuất hiện cùng tuần | `CRITICAL` |
| 13 | `HR-COMB-02` | Biến mất hoàn toàn | Tích hợp | $\ge 10$ ngày mất liên lạc mọi kênh | `CRITICAL` |

---
*Chúc bạn có buổi bảo vệ Đồ án Tốt nghiệp đạt kết quả Xuất sắc nhất!*
