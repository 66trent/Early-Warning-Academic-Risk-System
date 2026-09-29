import { z } from "zod";

export const GetStudentProfileSchema = z.object({
  studentId: z.string().min(1, "Mã sinh viên không được để trống"),
});

export type GetStudentProfileInput = z.infer<typeof GetStudentProfileSchema>;
