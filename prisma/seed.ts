import { PrismaClient, UserRole, OfficialAcademicStatus, SectionStatus, EnrollmentStatus, EnrollmentType, SessionStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/ctuet_ewars?schema=public",
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Bắt đầu seed dữ liệu mẫu Phase 1...");

  // 1. Tạo Users cho 4 vai trò
  console.log("Tạo tài khoản quản trị và cán bộ...");

  // Admin
  await prisma.user.upsert({
    where: { email: "admin@ctuet.edu.vn" },
    update: {},
    create: {
      userId: "ADMIN001",
      fullName: "Quản trị viên Hệ thống",
      role: UserRole.ADMIN,
      email: "admin@ctuet.edu.vn",
    },
  });

  // Training Officer (QLĐT)
  await prisma.user.upsert({
    where: { email: "qldt@ctuet.edu.vn" },
    update: {},
    create: {
      userId: "QLDT001",
      fullName: "Cán bộ Đào tạo Toàn trường",
      role: UserRole.TRAINING_OFFICER,
      email: "qldt@ctuet.edu.vn",
      scopeConfig: { scope: "ALL" },
    },
  });

  // CVHT 1 & 2
  const advisor1 = await prisma.user.upsert({
    where: { email: "nguyenvana@ctuet.edu.vn" },
    update: {},
    create: {
      userId: "GV001",
      fullName: "ThS. Nguyễn Văn A",
      role: UserRole.ADVISOR,
      email: "nguyenvana@ctuet.edu.vn",
      scopeConfig: { classes: ["DI21V7A1"] },
    },
  });

  const advisor2 = await prisma.user.upsert({
    where: { email: "tranthib@ctuet.edu.vn" },
    update: {},
    create: {
      userId: "GV002",
      fullName: "TS. Trần Thị B",
      role: UserRole.ADVISOR,
      email: "tranthib@ctuet.edu.vn",
      scopeConfig: { classes: ["DI21V7A2"] },
    },
  });

  // 2. Học kỳ (Term)
  console.log("Tạo học kỳ...");
  const term = await prisma.term.upsert({
    where: { termId: "HK1_2627" },
    update: {},
    create: {
      termId: "HK1_2627",
      termName: "Học kỳ 1 năm học 2026-2027",
      academicYear: "2026-2027",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-01-15"),
    },
  });

  // 3. Môn học (Course)
  console.log("Tạo môn học...");
  const course1 = await prisma.course.upsert({
    where: { courseId: "CT101" },
    update: {},
    create: { courseId: "CT101", courseName: "Lập trình căn bản", credits: 3 },
  });

  const course2 = await prisma.course.upsert({
    where: { courseId: "CT102" },
    update: {},
    create: { courseId: "CT102", courseName: "Cấu trúc dữ liệu và giải thuật", credits: 3 },
  });

  const course3 = await prisma.course.upsert({
    where: { courseId: "CT103" },
    update: {},
    create: { courseId: "CT103", courseName: "Cơ sở dữ liệu", credits: 4 },
  });

  // 4. Lớp học phần (CourseSection)
  console.log("Tạo lớp học phần...");
  const section1 = await prisma.courseSection.upsert({
    where: { courseSectionId: "CT101-01" },
    update: {},
    create: {
      courseSectionId: "CT101-01",
      courseId: course1.courseId,
      termId: term.termId,
      instructorId: advisor1.userId,
      usesLMS: true,
      sectionStatus: SectionStatus.ONGOING,
    },
  });

  const section2 = await prisma.courseSection.upsert({
    where: { courseSectionId: "CT102-01" },
    update: {},
    create: {
      courseSectionId: "CT102-01",
      courseId: course2.courseId,
      termId: term.termId,
      instructorId: advisor2.userId,
      usesLMS: true,
      sectionStatus: SectionStatus.ONGOING,
    },
  });

  await prisma.courseSection.upsert({
    where: { courseSectionId: "CT103-01" },
    update: {},
    create: {
      courseSectionId: "CT103-01",
      courseId: course3.courseId,
      termId: term.termId,
      instructorId: advisor1.userId,
      usesLMS: false, // Lớp không dùng LMS (dùng test HR-EXC)
      sectionStatus: SectionStatus.ONGOING,
    },
  });

  // 5. Lịch học (CourseSessionSchedule)
  console.log("Tạo lịch học từng buổi...");
  for (let i = 1; i <= 10; i++) {
    const sessionDate = new Date("2026-09-05");
    sessionDate.setDate(sessionDate.getDate() + (i - 1) * 7);

    await prisma.courseSessionSchedule.upsert({
      where: {
        courseSectionId_sessionDate: {
          courseSectionId: section1.courseSectionId,
          sessionDate,
        },
      },
      update: {},
      create: {
        courseSectionId: section1.courseSectionId,
        sessionDate,
        sessionStatus: i <= 4 ? SessionStatus.CLOSED : SessionStatus.OPEN,
      },
    });
  }

  // 6. Sinh viên mẫu (20 sinh viên giả lập: 10 SV thuộc GV001, 10 SV thuộc GV002)
  console.log("Tạo danh sách sinh viên giả lập và đăng ký học phần...");
  for (let i = 1; i <= 20; i++) {
    const pad = String(i).padStart(3, "0");
    const mssv = `B210${pad}`;
    const email = `b210${pad}@student.ctuet.edu.vn`;
    const isClass1 = i <= 10;
    const classId = isClass1 ? "DI21V7A1" : "DI21V7A2";
    const advisorId = isClass1 ? advisor1.userId : advisor2.userId;

    // RÀNG BUỘC: User.userId = Student.studentId
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        userId: mssv,
        fullName: `Sinh viên Demo ${pad}`,
        role: UserRole.STUDENT,
        email,
      },
    });

    const student = await prisma.student.upsert({
      where: { studentId: mssv },
      update: {},
      create: {
        studentId: mssv,
        fullName: `Sinh viên Demo ${pad}`,
        classId,
        departmentId: "CNTT",
        cohortYear: "2021",
        advisorId,
        officialAcademicStatus: OfficialAcademicStatus.ACTIVE,
      },
    });

    // Đăng ký môn học (Enrollment)
    await prisma.enrollment.upsert({
      where: {
        sourceSystem_sourceRecordKey: {
          sourceSystem: "SIS_IMPORT",
          sourceRecordKey: `ENR_${mssv}_CT101-01`,
        },
      },
      update: {},
      create: {
        studentId: student.studentId,
        courseSectionId: section1.courseSectionId,
        enrollmentStatus: EnrollmentStatus.REGISTERED,
        registeredAt: new Date("2026-08-25"),
        attemptNumber: 1,
        enrollmentType: EnrollmentType.NORMAL,
        sourceSystem: "SIS_IMPORT",
        sourceRecordKey: `ENR_${mssv}_CT101-01`,
      },
    });

    // Đăng ký môn thứ 2
    await prisma.enrollment.upsert({
      where: {
        sourceSystem_sourceRecordKey: {
          sourceSystem: "SIS_IMPORT",
          sourceRecordKey: `ENR_${mssv}_CT102-01`,
        },
      },
      update: {},
      create: {
        studentId: student.studentId,
        courseSectionId: section2.courseSectionId,
        enrollmentStatus: EnrollmentStatus.REGISTERED,
        registeredAt: new Date("2026-08-25"),
        attemptNumber: 1,
        enrollmentType: EnrollmentType.NORMAL,
        sourceSystem: "SIS_IMPORT",
        sourceRecordKey: `ENR_${mssv}_CT102-01`,
      },
    });
  }

  console.log("✅ Seed dữ liệu Phase 1 thành công hoàn toàn!");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed dữ liệu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
