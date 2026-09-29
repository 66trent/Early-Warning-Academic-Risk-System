import { z } from "zod";

export const UserRoleSchema = z.enum(["STUDENT", "ADVISOR", "TRAINING_OFFICER", "ADMIN"]);

export const CreateUserSchema = z
  .object({
    userId: z.string().min(1, "Mã người dùng không được để trống"),
    fullName: z.string().min(1, "Họ và tên không được để trống").max(100),
    role: UserRoleSchema,
    email: z.string().email("Email không hợp lệ").max(100),
    scopeConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "STUDENT") {
      if (!data.email.endsWith("@student.ctuet.edu.vn")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Email sinh viên bắt buộc phải có đuôi @student.ctuet.edu.vn",
          path: ["email"],
        });
      }
    }
  });

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
