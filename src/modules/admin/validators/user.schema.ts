import { z } from "zod";

export const UserRoleSchema = z.enum(["STUDENT", "ADVISOR", "TRAINING_OFFICER", "ADMIN"]);

export const UserScopeConfigSchema = z
  .object({
    scope: z.enum(["ALL", "DEPARTMENT"]).optional(),
    departments: z.array(z.string()).optional(),
    departmentId: z.string().optional(),
  })
  .passthrough();

export const CreateUserSchema = z
  .object({
    userId: z.string().min(1, "Mã người dùng không được để trống").max(50),
    fullName: z.string().min(1, "Họ và tên không được để trống").max(100),
    role: UserRoleSchema,
    email: z.string().email("Email không hợp lệ").max(100),
    scopeConfig: UserScopeConfigSchema.optional().nullable(),
    studentMetadata: z
      .object({
        classId: z.string().optional(),
        departmentId: z.string().optional(),
        cohortYear: z.string().optional(),
        advisorId: z.string().optional(),
      })
      .optional(),
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

export const UpdateUserSchema = z
  .object({
    userId: z.string().min(1, "Mã người dùng không được để trống"),
    fullName: z.string().min(1, "Họ và tên không được để trống").max(100).optional(),
    email: z.string().email("Email không hợp lệ").max(100).optional(),
    role: UserRoleSchema.optional(),
    scopeConfig: UserScopeConfigSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "STUDENT" && data.email) {
      if (!data.email.endsWith("@student.ctuet.edu.vn")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Email sinh viên bắt buộc phải có đuôi @student.ctuet.edu.vn",
          path: ["email"],
        });
      }
    }
  });

export const DeleteUserSchema = z.object({
  userId: z.string().min(1, "Mã người dùng không được để trống"),
});

export const ListUsersFilterSchema = z.object({
  role: UserRoleSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type DeleteUserInput = z.infer<typeof DeleteUserSchema>;
export type ListUsersFilterInput = z.infer<typeof ListUsersFilterSchema>;
