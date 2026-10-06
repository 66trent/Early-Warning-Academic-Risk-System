import {
  PrismaClient,
  UserRole,
  OfficialAcademicStatus,
  SectionStatus,
  EnrollmentStatus,
  EnrollmentType,
  SessionStatus,
  Severity,
  AlertStatus,
  DataCompletenessLevel,
  RuleGroup,
  RuleStatus,
  InterventionType,
  ConfidentialityLevel,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/ctuet_ewars?schema=public",
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BATCH_SIZE = 1000;
const TOTAL_STUDENTS = 5000;
const TERM_ID = "HK1_2526";

async function main() {
  console.log(`🚀 [Phase 7 Hardening] Bắt đầu Seed 5.000 Sinh viên Giả lập cho Kiểm thử Hiệu năng...`);
  const startTime = Date.now();

  // 1. Khởi tạo Học kỳ Benchmark
  console.log(`1/8 Khởi tạo Học kỳ '${TERM_ID}'...`);
  await prisma.term.upsert({
    where: { termId: TERM_ID },
    update: {},
    create: {
      termId: TERM_ID,
      termName: "Học kỳ 1 năm học 2025-2026 (Benchmark Scale)",
      academicYear: "2025-2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-01-15"),
    },
  });

  // 2. Khởi tạo Cố vấn Học tập & Giảng viên
  console.log(`2/8 Khởi tạo 10 Cố vấn học tập (ADVISOR)...`);
  const advisorUsers = [];
  for (let i = 1; i <= 10; i++) {
    const pad = String(i).padStart(3, "0");
    const advisorId = `GV_PERF_${pad}`;
    advisorUsers.push({
      userId: advisorId,
      fullName: `Cố vấn Học tập ${pad}`,
      role: UserRole.ADVISOR,
      email: `advisor_perf_${pad}@ctuet.edu.vn`,
      scopeConfig: { department: i <= 5 ? "CNTT" : "DTVT" },
    });
  }
  await prisma.user.createMany({
    data: advisorUsers,
    skipDuplicates: true,
  });

  // 3. Khởi tạo Môn học & Lớp học phần
  console.log(`3/8 Khởi tạo Môn học & 20 Lớp học phần...`);
  const courses = [
    { courseId: "PRF101", courseName: "Nhập môn Lập trình", credits: 3 },
    { courseId: "PRF102", courseName: "Cấu trúc dữ liệu & Giải thuật", credits: 3 },
    { courseId: "PRF103", courseName: "Cơ sở dữ liệu", credits: 4 },
    { courseId: "PRF104", courseName: "Mạng máy tính", credits: 3 },
    { courseId: "PRF105", courseName: "Toán rời rạc", credits: 3 },
  ];
  await prisma.course.createMany({
    data: courses,
    skipDuplicates: true,
  });

  const sections = [];
  for (const c of courses) {
    for (let s = 1; s <= 4; s++) {
      const sectionId = `${c.courseId}-0${s}`;
      const advisorId = advisorUsers[(s - 1) % advisorUsers.length].userId;
      sections.push({
        courseSectionId: sectionId,
        courseId: c.courseId,
        termId: TERM_ID,
        instructorId: advisorId,
        usesLMS: true,
        sectionStatus: SectionStatus.ONGOING,
      });
    }
  }
  await prisma.courseSection.createMany({
    data: sections,
    skipDuplicates: true,
  });

  // Khởi tạo Lịch học cho các lớp
  console.log(`Khởi tạo buổi học (CourseSessionSchedule)...`);
  const schedules = [];
  for (const sec of sections) {
    for (let w = 1; w <= 10; w++) {
      const d = new Date("2025-09-08");
      d.setDate(d.getDate() + (w - 1) * 7);
      schedules.push({
        sessionId: `SESS_${sec.courseSectionId}_W${w}`,
        courseSectionId: sec.courseSectionId,
        sessionDate: d,
        sessionStatus: w <= 6 ? SessionStatus.CLOSED : SessionStatus.OPEN,
      });
    }
  }
  await prisma.courseSessionSchedule.createMany({
    data: schedules,
    skipDuplicates: true,
  });

  // 4. Khởi tạo Luật & RuleVersion
  console.log(`4/8 Khởi tạo Rule & RuleVersion phục vụ Trigger/Log...`);
  const rule = await prisma.rule.upsert({
    where: { ruleCode: "HR-ATT-01" },
    update: {},
    create: {
      ruleCode: "HR-ATT-01",
      ruleName: "Vắng học 3 buổi liên tiếp không phép",
      ruleGroup: RuleGroup.ATTENDANCE,
      scope: "PER_COURSE",
      priority: 1,
      cooldown: 7,
      status: RuleStatus.ACTIVE,
    },
  });

  const ruleVersion = await prisma.ruleVersion.upsert({
    where: { ruleCode_version: { ruleCode: "HR-ATT-01", version: 1 } },
    update: {},
    create: {
      ruleCode: rule.ruleCode,
      version: 1,
      condition: { thresholdConsecutiveAbsent: 3 },
      severity: Severity.HIGH,
      action: { createAlert: true, notifyAdvisor: true },
      effectiveFrom: new Date("2025-08-01"),
      status: RuleStatus.ACTIVE,
      configuredBy: advisorUsers[0].userId,
      approvedBy: advisorUsers[1].userId,
    },
  });

  // 5. Khởi tạo 5.000 Sinh viên (User + Student) theo Chunk
  console.log(`5/8 Sinh 5.000 Sinh viên theo các batch 1.000 records...`);
  const departments = ["CNTT", "KTPM", "HTTT", "ATTT", "DTVT"];
  const classes = ["DI21V7A1", "DI21V7A2", "PM21V7A1", "PM21V7A2", "HT21V7A1"];

  for (let batch = 0; batch < TOTAL_STUDENTS / BATCH_SIZE; batch++) {
    const usersBatch = [];
    const studentsBatch = [];

    const startIdx = batch * BATCH_SIZE + 1;
    const endIdx = (batch + 1) * BATCH_SIZE;

    for (let i = startIdx; i <= endIdx; i++) {
      const pad = String(i).padStart(5, "0");
      const mssv = `B250${pad}`;
      const email = `b250${pad}@student.ctuet.edu.vn`;
      const dept = departments[i % departments.length];
      const cls = classes[i % classes.length];
      const advisor = advisorUsers[i % advisorUsers.length].userId;

      usersBatch.push({
        userId: mssv,
        fullName: `Sinh viên Quy mô ${pad}`,
        role: UserRole.STUDENT,
        email,
      });

      studentsBatch.push({
        studentId: mssv,
        fullName: `Sinh viên Quy mô ${pad}`,
        classId: cls,
        departmentId: dept,
        cohortYear: "2025",
        advisorId: advisor,
        officialAcademicStatus: OfficialAcademicStatus.ACTIVE,
      });
    }

    await prisma.user.createMany({ data: usersBatch, skipDuplicates: true });
    await prisma.student.createMany({ data: studentsBatch, skipDuplicates: true });
    process.stdout.write(`  -> Đã chèn ${endIdx}/${TOTAL_STUDENTS} sinh viên...\r`);
  }
  console.log(`\n  ✅ Hoàn tất 5.000 Sinh viên.`);

  // 6. Đăng ký Học phần (Enrollment) — Mỗi sinh viên đăng ký 4 lớp
  console.log(`6/8 Sinh ~20.000 Enrollments...`);
  for (let batch = 0; batch < TOTAL_STUDENTS / BATCH_SIZE; batch++) {
    const enrollmentsBatch = [];
    const startIdx = batch * BATCH_SIZE + 1;
    const endIdx = (batch + 1) * BATCH_SIZE;

    for (let i = startIdx; i <= endIdx; i++) {
      const pad = String(i).padStart(5, "0");
      const mssv = `B250${pad}`;

      // Chọn 4 lớp học phần
      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const sec = sections[(i + sIdx) % sections.length];
        const enrId = `ENR_${mssv}_${sec.courseSectionId}`;
        enrollmentsBatch.push({
          enrollmentId: enrId,
          studentId: mssv,
          courseSectionId: sec.courseSectionId,
          enrollmentStatus: EnrollmentStatus.REGISTERED,
          registeredAt: new Date("2025-08-28"),
          attemptNumber: 1,
          enrollmentType: EnrollmentType.NORMAL,
          sourceSystem: "SIS_PERF",
          sourceRecordKey: enrId,
        });
      }
    }

    await prisma.enrollment.createMany({ data: enrollmentsBatch, skipDuplicates: true });
  }
  console.log(`  ✅ Hoàn tất ~20.000 Enrollments.`);

  // 7. Sinh Nhật ký RiskScoreLog cho 5.000 sinh viên
  console.log(`7/8 Sinh 5.000 RiskScoreLogs phân bổ FULL, PARTIAL, INSUFFICIENT...`);
  const completenessLevels: DataCompletenessLevel[] = [
    DataCompletenessLevel.FULL,
    DataCompletenessLevel.PARTIAL,
    DataCompletenessLevel.INSUFFICIENT,
  ];

  for (let batch = 0; batch < TOTAL_STUDENTS / BATCH_SIZE; batch++) {
    const riskLogsBatch = [];
    const startIdx = batch * BATCH_SIZE + 1;
    const endIdx = (batch + 1) * BATCH_SIZE;

    for (let i = startIdx; i <= endIdx; i++) {
      const pad = String(i).padStart(5, "0");
      const mssv = `B250${pad}`;
      const level = completenessLevels[i % 3];
      const riskVal = level === DataCompletenessLevel.INSUFFICIENT ? null : Number(((i % 100) / 10).toFixed(2));

      // Tính ngày dao động trong 30 ngày qua
      const calcDate = new Date("2025-10-15");
      calcDate.setDate(calcDate.getDate() - (i % 30));

      riskLogsBatch.push({
        id: `RISK_${mssv}_${TERM_ID}`,
        studentId: mssv,
        termId: TERM_ID,
        riskScoreValue: riskVal,
        dataCompletenessLevel: level,
        componentsUsed: level === DataCompletenessLevel.FULL ? ["ATTENDANCE", "GPA", "LMS"] : ["ATTENDANCE"],
        ruleVersionId: ruleVersion.id,
        calculatedAt: calcDate,
      });
    }

    await prisma.riskScoreLog.createMany({ data: riskLogsBatch, skipDuplicates: true });
  }
  console.log(`  ✅ Hoàn tất 5.000 RiskScoreLogs.`);

  // 8. Sinh 1.000 Alerts & RuleTriggers với các mức Severity & Trạng thái
  console.log(`8/8 Sinh 1.000 Alerts, 1.000 RuleTriggers, và Interventions...`);
  const severities: Severity[] = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW];
  const statuses: AlertStatus[] = [
    AlertStatus.OPEN,
    AlertStatus.ACKNOWLEDGED,
    AlertStatus.IN_PROGRESS,
    AlertStatus.RESOLVED,
    AlertStatus.DISMISSED,
  ];

  const alertsBatch = [];
  const triggersBatch = [];
  const interventionsBatch = [];

  for (let i = 1; i <= 1000; i++) {
    const pad = String(i).padStart(5, "0");
    const mssv = `B250${pad}`;
    const alertId = `ALERT_PERF_${pad}`;
    const sev = severities[i % 4];
    const stat = statuses[i % 5];
    const advisor = advisorUsers[i % advisorUsers.length].userId;

    const detectedDate = new Date("2025-10-01");
    detectedDate.setDate(detectedDate.getDate() + (i % 20));

    alertsBatch.push({
      alertId,
      studentId: mssv,
      termId: TERM_ID,
      severity: sev,
      status: stat,
      firstDetectedAt: detectedDate,
      lastDetectedAt: detectedDate,
      assignedAdvisorId: advisor,
      riskScoreLogId: `RISK_${mssv}_${TERM_ID}`,
      isReferenceOnly: true,
    });

    triggersBatch.push({
      id: `TRIG_PERF_${pad}`,
      alertId,
      ruleCode: rule.ruleCode,
      ruleVersionId: ruleVersion.id,
      studentId: mssv,
      scopeId: sections[0].courseSectionId,
      termId: TERM_ID,
      triggeredAt: detectedDate,
      inputSnapshot: { consecutiveAbsences: 3, dates: ["2025-09-08", "2025-09-15", "2025-09-22"] },
      reason: `Vắng liên tiếp 3 buổi học tại lớp ${sections[0].courseSectionId}`,
      severity: sev,
    });

    if (stat === AlertStatus.RESOLVED || stat === AlertStatus.IN_PROGRESS) {
      interventionsBatch.push({
        interventionId: `INT_PERF_${pad}`,
        alertId,
        performedBy: advisor,
        type: InterventionType.IN_PERSON_MEETING,
        content: `Đã gặp trực tiếp sinh viên ${mssv} để tư vấn và lập kế hoạch bù bài.`,
        performedAt: detectedDate,
        outcome: "Sinh viên cam kết đi học đầy đủ các buổi còn lại.",
        status: "COMPLETED",
        confidentialityLevel: ConfidentialityLevel.NORMAL,
      });
    }
  }

  await prisma.alert.createMany({ data: alertsBatch, skipDuplicates: true });
  await prisma.ruleTrigger.createMany({ data: triggersBatch, skipDuplicates: true });
  await prisma.intervention.createMany({ data: interventionsBatch, skipDuplicates: true });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Seed 5.000 Sinh viên cho Kiểm thử Hiệu năng HOÀN TẤT trong ${durationSec}s!`);
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed benchmark data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
