---
name: scaffold-server-action
description: Dùng khi tạo một Server Action mới ở bất kỳ module nào (data-import, rule-engine, alerts, dashboard, admin) — đảm bảo đúng pattern bắt buộc về session, phân quyền, validate, audit log. Kích hoạt khi người dùng nói "tạo action mới", "viết server action cho...", "thêm API cho tính năng...".
---

# Dựng khung một Server Action

Tham chiếu bắt buộc: `.agents/rules/01-architecture.md` (tách `actions/`/`services/`), `.agents/rules/06-security.md` (`assertScope`, Audit Log).

## Khuôn mẫu bắt buộc — MỌI Server Action đọc/ghi dữ liệu sinh viên phải theo đúng thứ tự này

```ts
"use server";

import { getSession } from "@/lib/auth";
import { assertScope } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import { inputSchema } from "../validators/<feature>.schema";
import { someService } from "../services/<feature>.service";

export async function actionName(rawInput: unknown) {
  // 1. Lấy session — KHÔNG tin bất kỳ role/id nào gửi từ client
  const session = await getSession();

  // 2. Validate input bằng Zod TRƯỚC khi dùng
  const input = inputSchema.parse(rawInput);

  // 3. Kiểm tra phạm vi — bắt buộc, không được bỏ qua vì "chỉ CVHT mới thấy nút này trên UI"
  await assertScope(session.user, { studentId: input.studentId, resourceType: "Alert" });

  // 4. Gọi service thuần — service KHÔNG đụng session/next-headers
  const result = await someService(input);

  // 5. Ghi audit log NẾU hành động thuộc danh sách bắt buộc (xem 06-security.md)
  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    target: { type: "Alert", id: result.id },
  });

  return result;
}
```

## Checklist bắt buộc

- [ ] Bước 1–5 đúng thứ tự, không đảo (đặc biệt: `assertScope` PHẢI trước khi service đọc/ghi dữ liệu).
- [ ] Input được Zod `.parse()` — MUST NOT dùng `any`/ép kiểu tay.
- [ ] Service (`services/<feature>.service.ts`) là hàm thuần, có thể test bằng Vitest không cần session giả lập phức tạp.
- [ ] Nếu action nằm trong danh sách bắt buộc ghi log (cấu hình luật, đổi trạng thái Alert, thao tác ImportBatch, truy cập hồ sơ chi tiết ngoài phạm vi CVHT phụ trách) → MUST gọi `writeAuditLog`.
- [ ] MUST NOT trả nguyên lỗi Prisma ra client — bắt lỗi và trả message rõ ràng, không lộ chi tiết schema/nội bộ.
- [ ] Nếu action ghi dữ liệu ảnh hưởng `Alert`, kiểm tra lại `isReferenceOnly` không bị đổi và không có đường nào chạm `Student.officialAcademicStatus`.
