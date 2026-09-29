---
name: generate-prisma-schema
description: Dùng khi cần sinh mới hoặc cập nhật schema.prisma từ Data Schema Reference, hoặc khi thêm/sửa 1 bảng trong thiết kế dữ liệu. Kích hoạt khi người dùng nói "tạo schema.prisma", "sinh migration", "cập nhật database schema", "thêm bảng mới vào CSDL".
---

# Sinh/cập nhật schema.prisma từ Data Schema Reference

Nguồn dữ liệu bắt buộc đọc theo đúng thứ tự: `.agents/rules/09-data-schema-identity.md` → `10-data-schema-source-records.md` → `11-data-schema-rule-engine.md` → `12-data-schema-ops.md`. Đây là "spec", `schema.prisma` là bản dịch — MUST NOT tự thêm/bớt field không có trong spec; nếu cần field mới, sửa file spec trước, sau đó mới sửa `schema.prisma`.

## Quy tắc dịch field → Prisma

| Trong spec ghi                           | Prisma tương ứng                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `String(N)`                              | `String @db.VarChar(N)`                                                                                     |
| `String (uuid)`                          | `String @id @default(uuid())` nếu là PK, ngược lại `String`                                                 |
| `String (text)`                          | `String @db.Text`                                                                                           |
| `Int` / `Float` / `Boolean` / `DateTime` | Giữ nguyên                                                                                                  |
| `Json`                                   | `Json` — MUST thêm comment `///` phía trên ghi rõ "validate bằng Zod, xem <tên schema Zod>"                 |
| `<Tên> (enum)`                           | Khai báo `enum <Tên> { ... }` riêng, giá trị lấy nguyên văn từ bảng enum trong spec — KHÔNG tự đặt tên khác |
| "NULL" ở cột Null?                       | Field có `?`                                                                                                |
| Cột "Khóa" ghi "PK"                      | `@id`                                                                                                       |
| Cột "Khóa" ghi "FK → X"                  | `@relation(fields: [...], references: [...])` trỏ đúng model X                                              |
| Dòng "RÀNG BUỘC: UNIQUE (...)"           | `@@unique([...])`                                                                                           |

## Quy trình

1. Với mỗi bảng trong spec, tạo 1 `model` tương ứng — tên model PascalCase theo đúng tên bảng trong spec (VD: `AttendanceRecord`), tên field camelCase đúng tên đã ghi.
2. Khai báo toàn bộ enum dùng chung 1 lần (không lặp lại định nghĩa enum trong nhiều model).
3. Áp dụng mọi `@@unique`/`@@index` đã liệt kê trong mục "RÀNG BUỘC" của từng bảng — đây không phải gợi ý, là yêu cầu bắt buộc.
4. Sau khi viết xong, chạy `npx prisma format` rồi `npx prisma validate` — sửa lỗi trước khi tạo migration.
5. Tạo migration với tên mô tả rõ nội dung thay đổi: `npx prisma migrate dev --name <mô-tả>`.
6. Review file migration sinh ra trước khi coi là xong — đặc biệt các thay đổi enum (thêm/bớt giá trị) dễ sinh sai với dữ liệu đã tồn tại.

## Việc KHÔNG được làm

- MUST NOT dùng `prisma db push` nếu đã có dữ liệu thật trong DB.
- MUST NOT sửa tay 1 file migration đã áp dụng (`applied`) — nếu sai, tạo migration mới để sửa.
- MUST NOT bỏ qua bước đọc spec rồi tự đoán kiểu dữ liệu field — mọi field trong spec đã có kiểu tường minh.
