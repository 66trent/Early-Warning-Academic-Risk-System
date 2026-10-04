---
name: rule-engine-test-suite
description: Dùng khi cần viết bộ test Vitest cho một luật cụ thể hoặc cho toàn bộ Rule Engine — đảm bảo phủ đúng ma trận test bắt buộc (điều kiện biên, ngoại lệ, chính sách dữ liệu thiếu, chống rò rỉ thời gian). Kích hoạt khi người dùng nói "viết test cho luật...", "test rule engine", "kiểm thử RiskScore", "test coverage cho evaluator".
---

# Sinh bộ test cho Rule Engine

Tham chiếu: `.agents/rules/02-code-quality.md` (coverage ≥90% cho `rule-engine`), `.agents/rules/08-business-rules-catalog.md` (nội dung từng luật).

## Ma trận test bắt buộc cho MỖI luật hard-trigger

Với mỗi mã luật (VD: `HR-ATT-01`), MUST có tối thiểu các nhóm test sau — thiếu bất kỳ nhóm nào coi là chưa đạt coverage yêu cầu:

1. **Happy path — kích hoạt đúng**: dữ liệu fixture khớp chính xác điều kiện luật → evaluator trả về `RuleTrigger` với `reason`/`inputSnapshot` đúng.
2. **Điều kiện biên**: nếu luật dùng ngưỡng số (VD: "≥3 buổi"), MUST test đúng tại ngưỡng (3 buổi → kích hoạt) VÀ ngay dưới ngưỡng (2 buổi → không kích hoạt). Nếu `RuleVersion.condition` khai báo rõ `>=` hay `>`, test phải khớp đúng toán tử đó.
3. **Từng mục loại trừ riêng của luật đó**: lấy đúng danh sách loại trừ ghi trong `08-business-rules-catalog.md` cho luật này (VD: HR-ATT-01 có 3 loại trừ: buổi hủy, buổi chưa đóng sổ, vắng có phép) — MUST có 1 test riêng cho từng loại trừ, xác nhận evaluator KHÔNG kích hoạt khi rơi vào trường hợp đó dù các điều kiện khác đã đủ.
4. **Ngoại lệ chung (nhóm HR-EXC)** áp dụng cho luật này: test riêng cho từng ngoại lệ liên quan (VD: sinh viên đã rút học phần → không luật nào trong nhóm ATTENDANCE/ACADEMIC/LMS được kích hoạt).
5. **`DataStatus` khác `AVAILABLE`**: với mỗi chỉ số đầu vào luật cần, test khi chỉ số đó ở trạng thái `MISSING`/`NOT_APPLICABLE`/`STALE`/`INVALID` → evaluator MUST xử lý đúng (không throw lỗi, không tính như `AVAILABLE`).

## Test riêng cho tầng tổng hợp (không phải từng luật)

- **Missing-data policy** (`RiskScoreLog`): 3 test — thiếu 0/1/2/3 trong 3 nhóm chỉ số → đúng 3 kết quả `FULL`/`PARTIAL`/`INSUFFICIENT`, và `riskScoreValue = NULL` khi `INSUFFICIENT`.
- **Temporal leakage**: dựng 2 fixture giống hệt nhau ngoại trừ 1 fixture có thêm dữ liệu phát sinh SAU thời điểm tính — RiskScore của 2 fixture MUST bằng nhau (chứng minh dữ liệu tương lai không ảnh hưởng).
- **Gộp nguyên nhân/cooldown**: 2 `RuleTrigger` cùng khóa tương quan trong cửa sổ cooldown → chỉ 1 `Alert`, không tạo `Alert` thứ 2.
- **Severity tổng hợp**: nhiều `RuleTrigger` với severity khác nhau cùng 1 `Alert` → `Alert.severity` = max(), không phải trung bình/cộng dồn.
- **Trình tự 10 bước**: test tích hợp xác nhận ngoại lệ (bước 3) chặn được kích hoạt (bước 6) — dựng fixture đáng lẽ kích hoạt luật nhưng rơi vào 1 ngoại lệ, xác nhận không có `RuleTrigger` nào được tạo.

## Cấu trúc file test khuyến nghị

```
modules/rule-engine/evaluator/hard-triggers/__tests__/
  hr-att-01.test.ts   // đặt tên theo đúng mã luật
  hr-att-02.test.ts
  ...
modules/rule-engine/__tests__/
  missing-data-policy.test.ts
  temporal-leakage.test.ts
  alert-correlation.test.ts
```

Dùng 1 fixture builder dùng chung (`buildEvaluationContext(overrides)`) thay vì lặp lại object fixture thủ công ở mỗi file test.
