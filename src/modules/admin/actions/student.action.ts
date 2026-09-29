"use server";

import { getSession } from "@/lib/session";
import { assertScope } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import { GetStudentProfileSchema } from "../validators/student.schema";
import { getStudentProfileService } from "../services/student.service";

/**
 * Server Action truy vấn hồ sơ sinh viên tuân thủ skill scaffold-server-action.
 */
export async function getStudentProfileAction(rawInput: unknown) {
  // 1. Lấy session
  const session = await getSession();

  // 2. Validate input bằng Zod TRƯỚC khi dùng
  const input = GetStudentProfileSchema.parse(rawInput);

  // 3. Kiểm tra phạm vi theo ma trận phân quyền
  await assertScope(session?.user, {
    studentId: input.studentId,
    resourceType: "Student",
  });

  // 4. Gọi service thuần
  const student = await getStudentProfileService(input);

  // 5. Ghi Audit Log nếu người truy cập là cán bộ đào tạo hoặc ngoài thẩm quyền thường lệ
  if (session?.user?.role === "TRAINING_OFFICER" || session?.user?.role === "ADMIN") {
    await writeAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "READ_STUDENT_PROFILE",
      targetEntity: "Student",
      targetId: student.studentId,
      details: { departmentId: student.departmentId },
    });
  }

  return student;
}
