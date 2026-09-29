import { prisma } from "@/lib/prisma";
import type { GetStudentProfileInput } from "../validators/student.schema";

/**
 * Service thuần truy vấn thông tin hồ sơ sinh viên kèm danh sách lớp học phần đã đăng ký.
 * Không phụ thuộc vào session hay next/headers (dễ dàng unit test với fixture).
 */
export async function getStudentProfileService(input: GetStudentProfileInput) {
  const student = await prisma.student.findUnique({
    where: { studentId: input.studentId },
    include: {
      advisor: {
        select: {
          userId: true,
          fullName: true,
          email: true,
        },
      },
      enrollments: {
        include: {
          courseSection: {
            include: {
              course: true,
              term: true,
            },
          },
        },
      },
    },
  });

  if (!student) {
    throw new Error("Không tìm thấy sinh viên");
  }

  return student;
}
