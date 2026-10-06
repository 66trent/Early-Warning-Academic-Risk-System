import {
  PrismaClient,
  Prisma,
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
  LMSAssignmentType,
  LMSAssignmentStatus,
  InterventionType,
  ConfidentialityLevel,
  ImportDataType,
  DataSource,
  ImportBatchStatus,
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

async function main() {
  console.log("🌱 ========================================================");
  console.log("   CTUET-EWARS MASTER SEED: KHỞI TẠO DỮ LIỆU DEMO BẢO VỆ ĐỒ ÁN");
  console.log("   Minh họa đầy đủ 13 Luật HR-*, 4 Vai trò, Quy trình Khép kín");
  console.log("   ========================================================\n");

  // 1. Tạo Users cho 4 vai trò
  console.log("1/7 Khởi tạo tài khoản Quản trị, Cán bộ đào tạo và Cố vấn học tập...");

  // Admin
  const admin = await prisma.user.upsert({
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
  const qldt = await prisma.user.upsert({
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
  console.log("2/7 Khởi tạo Học kỳ chính khóa 'HK1_2627'...");
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

  // 3. Môn học & Lớp học phần
  console.log("3/7 Khởi tạo Danh mục Môn học & Lớp học phần...");
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

  // 4. Lịch học (CourseSessionSchedule)
  console.log("4/7 Khởi tạo 10 Buổi học theo tuần...");
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
        sessionId: `SESS_${section1.courseSectionId}_W${i}`,
        courseSectionId: section1.courseSectionId,
        sessionDate,
        sessionStatus: i <= 5 ? SessionStatus.CLOSED : SessionStatus.OPEN,
      },
    });

    await prisma.courseSessionSchedule.upsert({
      where: {
        courseSectionId_sessionDate: {
          courseSectionId: section2.courseSectionId,
          sessionDate,
        },
      },
      update: {},
      create: {
        sessionId: `SESS_${section2.courseSectionId}_W${i}`,
        courseSectionId: section2.courseSectionId,
        sessionDate,
        sessionStatus: i <= 5 ? SessionStatus.CLOSED : SessionStatus.OPEN,
      },
    });
  }

  // 5. Khởi tạo ImportBatch mẫu để liên kết dữ liệu nguồn
  const importBatch = await prisma.importBatch.upsert({
    where: { id: "BATCH_DEMO_01" },
    update: {},
    create: {
      id: "BATCH_DEMO_01",
      dataType: ImportDataType.ATTENDANCE,
      source: DataSource.FILE,
      sourceChecksum: "checksum_demo_seed_phase8_hash",
      performedBy: qldt.userId,
      status: ImportBatchStatus.LOADED,
      totalRows: 100,
      successRows: 100,
      errorRows: 0,
      originalFilePath: "local://seed_demo_records.csv",
    },
  });

  // 6. Bài tập LMS mẫu
  await prisma.lMSAssignment.upsert({
    where: { assignmentId: "LMS_QZ1_CT101" },
    update: {},
    create: {
      assignmentId: "LMS_QZ1_CT101",
      courseSectionId: section1.courseSectionId,
      assignmentType: LMSAssignmentType.QUIZ,
      title: "Quiz 1: Cú pháp và Biến trong C/C++",
      isRequired: true,
      defaultDeadline: new Date("2026-09-18T23:59:59Z"),
      sequenceNumber: 1,
      status: LMSAssignmentStatus.PUBLISHED,
      importBatchId: importBatch.id,
    },
  });

  await prisma.lMSAssignment.upsert({
    where: { assignmentId: "LMS_QZ2_CT101" },
    update: {},
    create: {
      assignmentId: "LMS_QZ2_CT101",
      courseSectionId: section1.courseSectionId,
      assignmentType: LMSAssignmentType.QUIZ,
      title: "Quiz 2: Cấu trúc điều khiển và Vòng lặp",
      isRequired: true,
      defaultDeadline: new Date("2026-09-25T23:59:59Z"),
      sequenceNumber: 2,
      status: LMSAssignmentStatus.PUBLISHED,
      importBatchId: importBatch.id,
    },
  });

  // 7. Khởi tạo Toàn bộ 13 Luật Nghiệp vụ & RuleVersion
  console.log("5/7 Khởi tạo Danh mục 13 Luật Nghiệp vụ (Rule & RuleVersion ACTIVE)...");
  const rulesData = [
    { ruleCode: "HR-ATT-01", ruleName: "Vắng liên tiếp ≥ 3 buổi", ruleGroup: RuleGroup.ATTENDANCE, severity: Severity.HIGH },
    { ruleCode: "HR-ATT-02", ruleName: "Ngưỡng cấm thi ≥ 20% số buổi", ruleGroup: RuleGroup.ATTENDANCE, severity: Severity.CRITICAL },
    { ruleCode: "HR-ATT-03", ruleName: "Vắng đa môn đồng thời trong tuần", ruleGroup: RuleGroup.ATTENDANCE, severity: Severity.HIGH },
    { ruleCode: "HR-ATT-04", ruleName: "Không tham gia học đầu kỳ", ruleGroup: RuleGroup.ATTENDANCE, severity: Severity.HIGH },
    { ruleCode: "HR-ACA-01", ruleName: "Điểm liệt bài đánh giá quan trọng", ruleGroup: RuleGroup.ACADEMIC, severity: Severity.HIGH },
    { ruleCode: "HR-ACA-02", ruleName: "Tiệm cận cảnh báo học vụ theo quy chế", ruleGroup: RuleGroup.ACADEMIC, severity: Severity.CRITICAL },
    { ruleCode: "HR-ACA-03", ruleName: "Sụt giảm GPA đột ngột", ruleGroup: RuleGroup.ACADEMIC, severity: Severity.MEDIUM },
    { ruleCode: "HR-ACA-04", ruleName: "Học lại nhiều lần do rớt môn", ruleGroup: RuleGroup.ACADEMIC, severity: Severity.MEDIUM },
    { ruleCode: "HR-LMS-01", ruleName: "Không hoạt động LMS kéo dài ≥ 14 ngày", ruleGroup: RuleGroup.LMS, severity: Severity.CRITICAL },
    { ruleCode: "HR-LMS-02", ruleName: "Bỏ nộp bài bắt buộc liên tiếp", ruleGroup: RuleGroup.LMS, severity: Severity.HIGH },
    { ruleCode: "HR-LMS-03", ruleName: "Hai điểm liệt liên tiếp bài tự chấm", ruleGroup: RuleGroup.LMS, severity: Severity.MEDIUM },
    { ruleCode: "HR-COMB-01", ruleName: "Tín hiệu tiêu cực đa nguồn đồng thời", ruleGroup: RuleGroup.COMBINED, severity: Severity.CRITICAL },
    { ruleCode: "HR-COMB-02", ruleName: "Biến mất hoàn toàn (Liên hệ khẩn cấp)", ruleGroup: RuleGroup.COMBINED, severity: Severity.CRITICAL },
    { ruleCode: "HR-EXC-01", ruleName: "Miễn trừ nghĩa vụ học tập hợp lệ", ruleGroup: RuleGroup.EXCEPTION, severity: Severity.LOW },
  ];

  const ruleVersionMap: Record<string, string> = {};

  for (const r of rulesData) {
    const rule = await prisma.rule.upsert({
      where: { ruleCode: r.ruleCode },
      update: { ruleName: r.ruleName, status: RuleStatus.ACTIVE },
      create: {
        ruleCode: r.ruleCode,
        ruleName: r.ruleName,
        ruleGroup: r.ruleGroup,
        scope: r.ruleGroup === RuleGroup.COMBINED || r.ruleCode === "HR-ACA-02" || r.ruleCode === "HR-ACA-03" ? "PER_STUDENT" : "PER_COURSE",
        priority: 1,
        cooldown: 7,
        status: RuleStatus.ACTIVE,
      },
    });

    const rv = await prisma.ruleVersion.upsert({
      where: { ruleCode_version: { ruleCode: r.ruleCode, version: 1 } },
      update: { status: RuleStatus.ACTIVE, approvedBy: admin.userId },
      create: {
        ruleCode: rule.ruleCode,
        version: 1,
        condition: { defaultThreshold: 1 },
        severity: r.severity,
        action: { notifyAdvisor: true, createAlert: true },
        effectiveFrom: new Date("2026-08-01"),
        status: RuleStatus.ACTIVE,
        configuredBy: qldt.userId,
        approvedBy: admin.userId,
      },
    });
    ruleVersionMap[r.ruleCode] = rv.id;
  }

  // 8. Khởi tạo 15 Kịch bản Sinh viên Demo Minh họa Đầy đủ 13 Luật
  console.log("6/7 Khởi tạo 15 Kịch bản Sinh viên Demo (mỗi luật ít nhất 1 sinh viên)...");

  interface DemoScenario {
    studentId: string;
    fullName: string;
    ruleCode: string;
    ruleName: string;
    severity: Severity;
    alertStatus: AlertStatus;
    reason: string;
    inputSnapshot: Record<string, unknown>;
    interventionContent?: string;
    interventionOutcome?: string;
    riskScore: number;
    completeness: DataCompletenessLevel;
  }

  const demoScenarios: DemoScenario[] = [
    {
      studentId: "B2101001",
      fullName: "Nguyễn Văn Vắng Liên Tiếp",
      ruleCode: "HR-ATT-01",
      ruleName: "Vắng học 3 buổi liên tiếp không phép",
      severity: Severity.HIGH,
      alertStatus: AlertStatus.OPEN,
      reason: "Sinh viên vắng không phép 3 buổi liên tiếp tại học phần CT101-01 (Ngày 05/09, 12/09, 19/09).",
      inputSnapshot: { consecutiveAbsences: 3, courseSectionId: "CT101-01", dates: ["2026-09-05", "2026-09-12", "2026-09-19"] },
      riskScore: 0.72,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101002",
      fullName: "Trần Thị Chạm Cấm Thi",
      ruleCode: "HR-ATT-02",
      ruleName: "Ngưỡng cấm thi (Tỷ lệ vắng ≥ 20%)",
      severity: Severity.CRITICAL,
      alertStatus: AlertStatus.OPEN,
      reason: "Sinh viên vắng 3/10 buổi học (30% tổng số buổi) tại học phần CT101-01, vượt ngưỡng cấm thi 20%.",
      inputSnapshot: { absenceRate: 0.3, absentSessions: 3, totalSessions: 10, threshold: 0.2 },
      riskScore: 0.94,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101003",
      fullName: "Lê Hoàng Vắng Đa Môn",
      ruleCode: "HR-ATT-03",
      ruleName: "Vắng đa môn đồng thời trong tuần",
      severity: Severity.HIGH,
      alertStatus: AlertStatus.ACKNOWLEDGED,
      reason: "Trong cửa sổ 7 ngày, sinh viên vắng không phép ở 2 môn khác nhau: CT101-01 (12/09) và CT102-01 (15/09).",
      inputSnapshot: { coursesAffected: ["CT101-01", "CT102-01"], windowDays: 7, totalAbsences: 2 },
      interventionContent: "CVHT đã liên hệ qua điện thoại nhắc nhở chuyên cần các môn học.",
      interventionOutcome: "Sinh viên hứa chấn chỉnh đi học đều đặn.",
      riskScore: 0.68,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101004",
      fullName: "Phạm Minh Bỏ Học Đầu Kỳ",
      ruleCode: "HR-ATT-04",
      ruleName: "Không tham gia học đầu kỳ",
      severity: Severity.HIGH,
      alertStatus: AlertStatus.OPEN,
      reason: "Lớp học phần CT101-01 đã bắt đầu giảng dạy 3 buổi nhưng sinh viên không có buổi PRESENT nào.",
      inputSnapshot: { presentSessions: 0, heldSessions: 3, courseSectionId: "CT101-01" },
      riskScore: 0.75,
      completeness: DataCompletenessLevel.PARTIAL,
    },
    {
      studentId: "B2101005",
      fullName: "Võ Thị Điểm Liệt Giữa Kỳ",
      ruleCode: "HR-ACA-01",
      ruleName: "Điểm 0/điểm liệt bài đánh giá quan trọng",
      severity: Severity.HIGH,
      alertStatus: AlertStatus.OPEN,
      reason: "Điểm kiểm tra giữa kỳ học phần CT101 đạt 0.5 điểm (trọng số 30%, kết quả FINAL).",
      inputSnapshot: { assessmentType: "MIDTERM", weight: 0.3, score: 0.5, failingScoreThreshold: 1.0 },
      riskScore: 0.81,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101006",
      fullName: "Đặng Quốc Tiệm Cận Cảnh Báo",
      ruleCode: "HR-ACA-02",
      ruleName: "Tiệm cận ngưỡng cảnh báo học vụ",
      severity: Severity.CRITICAL,
      alertStatus: AlertStatus.IN_PROGRESS,
      reason: "GPA dự kiến của sinh viên ở mức 0.95/4.0 (dưới ngưỡng quy chế 1.0) và rớt 2 học phần tiên quyết.",
      inputSnapshot: { projectedGpa: 0.95, failedCredits: 6, totalCredits: 10, warningThreshold: 1.0 },
      interventionContent: "CVHT đã tổ chức buổi tư vấn trực tiếp và lập Kế hoạch học tập cải thiện điểm.",
      interventionOutcome: "Sinh viên cam kết tham gia lớp trợ giảng phụ đạo buổi tối.",
      riskScore: 0.92,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101007",
      fullName: "Bùi Tuấn Tụt Dốc GPA",
      ruleCode: "HR-ACA-03",
      ruleName: "Sụt giảm GPA đột ngột",
      severity: Severity.MEDIUM,
      alertStatus: AlertStatus.RESOLVED,
      reason: "GPA của sinh viên sụt giảm 1.35 điểm (từ 3.20 ở kỳ trước xuống 1.85 ở kỳ hiện tại).",
      inputSnapshot: { previousGpa: 3.2, currentGpa: 1.85, dropAmount: 1.35, threshold: 0.8 },
      interventionContent: "CVHT đã tìm hiểu lý do: sinh viên bị bệnh trong tuần thi giữa kỳ.",
      interventionOutcome: "Đã hướng dẫn nộp đơn xin thi bù hợp lệ.",
      riskScore: 0.55,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101008",
      fullName: "Hồ Thanh Học Lại Lần 3",
      ruleCode: "HR-ACA-04",
      ruleName: "Học lại nhiều lần do rớt môn",
      severity: Severity.MEDIUM,
      alertStatus: AlertStatus.ACKNOWLEDGED,
      reason: "Sinh viên đăng ký học phần CT102-01 ở lần học thứ 3 (attemptNumber = 3, RETAKE_FAILED).",
      inputSnapshot: { courseCode: "CT102", attemptNumber: 3, enrollmentType: "RETAKE_FAILED" },
      interventionContent: "CVHT đã gửi email nhắc nhở về điều kiện tốt nghiệp và giới hạn số lần học lại.",
      riskScore: 0.60,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101009",
      fullName: "Dương Mai Bỏ LMS 14 Ngày",
      ruleCode: "HR-LMS-01",
      ruleName: "Không hoạt động LMS kéo dài ≥ 14 ngày",
      severity: Severity.CRITICAL,
      alertStatus: AlertStatus.OPEN,
      reason: "Sinh viên không có bất kỳ tương tác LMS nào trong 15 ngày liên tục và đã bỏ lỡ deadline Quiz 1.",
      inputSnapshot: { inactiveDays: 15, missedDeadlines: 1, lastLmsActivity: "2026-09-02" },
      riskScore: 0.88,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101010",
      fullName: "Ngô Gia Bỏ Nộp Bài Quiz",
      ruleCode: "HR-LMS-02",
      ruleName: "Bỏ nộp bài bắt buộc liên tiếp",
      severity: Severity.HIGH,
      alertStatus: AlertStatus.OPEN,
      reason: "Sinh viên không nộp 2 bài tập bắt buộc liên tiếp (Quiz 1 và Quiz 2) đã quá hạn nộp trên hệ thống.",
      inputSnapshot: { missedAssignments: ["LMS_QZ1_CT101", "LMS_QZ2_CT101"], consecutiveMissed: 2 },
      riskScore: 0.76,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101011",
      fullName: "Trịnh Bảo Hai Số Không LMS",
      ruleCode: "HR-LMS-03",
      ruleName: "Hai điểm liệt liên tiếp bài tự chấm",
      severity: Severity.MEDIUM,
      alertStatus: AlertStatus.ACKNOWLEDGED,
      reason: "Sinh viên nhận 2 điểm 0 liên tiếp tại Quiz 1 và Quiz 2 ở môn Lập trình căn bản.",
      inputSnapshot: { quizScores: [0.0, 0.0], consecutiveZeros: 2 },
      interventionContent: "CVHT đã liên hệ hỏi thăm: Sinh viên gặp lỗi trình duyệt nộp bài rỗng.",
      interventionOutcome: "Giảng viên đã mở lại quyền làm bài kiểm tra lại.",
      riskScore: 0.58,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101012",
      fullName: "Đỗ Hùng Tiêu Cực Đa Nguồn",
      ruleCode: "HR-COMB-01",
      ruleName: "Tín hiệu tiêu cực đa nguồn đồng thời",
      severity: Severity.CRITICAL,
      alertStatus: AlertStatus.OPEN,
      reason: "Trong cùng 1 tuần: vừa vắng học không phép, vừa nhận điểm 2.0 kiểm tra, vừa không tương tác LMS 6 ngày.",
      inputSnapshot: { negativeSources: ["ATTENDANCE", "ACADEMIC", "LMS"], sourceCount: 3 },
      riskScore: 0.96,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101013",
      fullName: "Phan An Biến Mất Hoàn Toàn",
      ruleCode: "HR-COMB-02",
      ruleName: "Biến mất hoàn toàn (Liên hệ khẩn cấp)",
      severity: Severity.CRITICAL,
      alertStatus: AlertStatus.OPEN,
      reason: "12 ngày liên tục không có bất kỳ hoạt động điểm danh, bài tập LMS hay truy cập hệ thống nào.",
      inputSnapshot: { inactiveDays: 12, attendanceRecords: 0, lmsEvents: 0, actionRequired: "URGENT_CALL" },
      riskScore: 0.99,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101014",
      fullName: "Lâm Như Có Đơn Miễn Bài",
      ruleCode: "HR-EXC-01",
      ruleName: "Trường hợp ngoại lệ hợp lệ (HR-EXC)",
      severity: Severity.LOW,
      alertStatus: AlertStatus.DISMISSED,
      reason: "Sinh viên vắng buổi học và trễ hạn nộp bài nhưng đã nộp Giấy xác nhận y tế và được cấp Exemption.",
      inputSnapshot: { exemptionId: "EXEMP_001", reason: "Điều trị y tế", grantedBy: advisor1.userId },
      interventionContent: "CVHT đã xác nhận hồ sơ y tế hợp lệ và miễn tính điểm trừ.",
      interventionOutcome: "Không phát sinh cảnh báo vi phạm.",
      riskScore: 0.15,
      completeness: DataCompletenessLevel.FULL,
    },
    {
      studentId: "B2101015",
      fullName: "Hoàng Kim Sinh Viên Tiêu Biểu",
      ruleCode: "NONE",
      ruleName: "Sinh viên học tốt (Không có rủi ro)",
      severity: Severity.LOW,
      alertStatus: AlertStatus.RESOLVED,
      reason: "Chuyên cần 100%, bài tập LMS đạt điểm 10 tuyệt đối, GPA tích lũy 3.85/4.0.",
      inputSnapshot: { gpa: 3.85, attendanceRate: 1.0, lmsRate: 1.0 },
      riskScore: 0.02,
      completeness: DataCompletenessLevel.FULL,
    },
  ];

  for (const s of demoScenarios) {
    const email = `${s.studentId.toLowerCase()}@student.ctuet.edu.vn`;

    // 1. Tạo User cho Sinh viên
    await prisma.user.upsert({
      where: { email },
      update: { fullName: s.fullName },
      create: {
        userId: s.studentId,
        fullName: s.fullName,
        role: UserRole.STUDENT,
        email,
      },
    });

    // 2. Tạo Hồ sơ Student
    await prisma.student.upsert({
      where: { studentId: s.studentId },
      update: { fullName: s.fullName, advisorId: advisor1.userId },
      create: {
        studentId: s.studentId,
        fullName: s.fullName,
        classId: "DI21V7A1",
        departmentId: "CNTT",
        cohortYear: "2021",
        advisorId: advisor1.userId,
        officialAcademicStatus: OfficialAcademicStatus.ACTIVE,
      },
    });

    // 3. Đăng ký học phần (Enrollment)
    const enrId = `ENR_${s.studentId}_CT101`;
    await prisma.enrollment.upsert({
      where: {
        sourceSystem_sourceRecordKey: {
          sourceSystem: "SIS_DEMO",
          sourceRecordKey: enrId,
        },
      },
      update: {},
      create: {
        enrollmentId: enrId,
        studentId: s.studentId,
        courseSectionId: section1.courseSectionId,
        enrollmentStatus: EnrollmentStatus.REGISTERED,
        registeredAt: new Date("2026-08-25"),
        attemptNumber: s.studentId === "B2101008" ? 3 : 1,
        enrollmentType: s.studentId === "B2101008" ? EnrollmentType.RETAKE_FAILED : EnrollmentType.NORMAL,
        sourceSystem: "SIS_DEMO",
        sourceRecordKey: enrId,
      },
    });

    // 4. Tạo RiskScoreLog
    const riskLogId = `RISK_${s.studentId}_${term.termId}`;
    await prisma.riskScoreLog.upsert({
      where: { id: riskLogId },
      update: {
        riskScoreValue: s.riskScore,
        dataCompletenessLevel: s.completeness,
      },
      create: {
        id: riskLogId,
        studentId: s.studentId,
        termId: term.termId,
        riskScoreValue: s.riskScore,
        dataCompletenessLevel: s.completeness,
        componentsUsed: ["ATTENDANCE", "ACADEMIC", "LMS"],
        ruleVersionId: ruleVersionMap["HR-ATT-01"] || "",
        calculatedAt: new Date("2026-09-28"),
      },
    });

    // 5. Nếu có cảnh báo (khác NONE) -> Tạo Alert, RuleTrigger và Intervention
    if (s.ruleCode !== "NONE") {
      const alertId = `ALERT_${s.studentId}_${s.ruleCode}`;
      const alert = await prisma.alert.upsert({
        where: { alertId },
        update: {
          severity: s.severity,
          status: s.alertStatus,
          riskScoreLogId: riskLogId,
        },
        create: {
          alertId,
          studentId: s.studentId,
          termId: term.termId,
          severity: s.severity,
          status: s.alertStatus,
          firstDetectedAt: new Date("2026-09-20"),
          lastDetectedAt: new Date("2026-09-28"),
          assignedAdvisorId: advisor1.userId,
          riskScoreLogId: riskLogId,
          isReferenceOnly: true,
        },
      });

      const triggerId = `TRIG_${s.studentId}_${s.ruleCode}`;
      await prisma.ruleTrigger.upsert({
        where: { id: triggerId },
        update: {
          reason: s.reason,
          inputSnapshot: s.inputSnapshot as Prisma.InputJsonValue,
          severity: s.severity,
        },
        create: {
          id: triggerId,
          alertId: alert.alertId,
          ruleCode: s.ruleCode,
          ruleVersionId: ruleVersionMap[s.ruleCode] || ruleVersionMap["HR-ATT-01"],
          studentId: s.studentId,
          scopeId: section1.courseSectionId,
          termId: term.termId,
          triggeredAt: new Date("2026-09-28"),
          inputSnapshot: s.inputSnapshot as Prisma.InputJsonValue,
          reason: s.reason,
          severity: s.severity,
        },
      });

      if (s.interventionContent) {
        const intId = `INT_${s.studentId}_01`;
        await prisma.intervention.upsert({
          where: { interventionId: intId },
          update: {
            content: s.interventionContent,
            outcome: s.interventionOutcome || "Đã ghi nhận phản hồi.",
          },
          create: {
            interventionId: intId,
            alertId: alert.alertId,
            performedBy: advisor1.userId,
            type: InterventionType.IN_PERSON_MEETING,
            content: s.interventionContent,
            performedAt: new Date("2026-09-29"),
            outcome: s.interventionOutcome || "Đã ghi nhận phản hồi.",
            status: "COMPLETED",
            confidentialityLevel: s.studentId === "B2101014" ? ConfidentialityLevel.SENSITIVE : ConfidentialityLevel.NORMAL,
          },
        });
      }
    }
  }

  // 9. Tạo thêm 20 sinh viên bình thường cho danh sách lớp
  console.log("7/7 Khởi tạo thêm 20 sinh viên cho danh sách lớp DI21V7A1...");
  for (let i = 1; i <= 20; i++) {
    const pad = String(i).padStart(3, "0");
    const mssv = `B2100${pad}`;
    const email = `b2100${pad}@student.ctuet.edu.vn`;

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

    await prisma.student.upsert({
      where: { studentId: mssv },
      update: {},
      create: {
        studentId: mssv,
        fullName: `Sinh viên Demo ${pad}`,
        classId: "DI21V7A1",
        departmentId: "CNTT",
        cohortYear: "2021",
        advisorId: advisor1.userId,
        officialAcademicStatus: OfficialAcademicStatus.ACTIVE,
      },
    });
  }

  console.log("\n🎉 ========================================================");
  console.log("   SEED DỮ LIỆU DEMO BẢO VỆ ĐỒ ÁN HOÀN TẤT THÀNH CÔNG 100%!");
  console.log("   ========================================================");
  console.log("\n📋 THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP THỬ NGHIỆM:");
  console.log("   • [ADMIN]            admin@ctuet.edu.vn        -> Vào /admin");
  console.log("   • [QLĐT]             qldt@ctuet.edu.vn         -> Vào /dashboard");
  console.log("   • [CVHT]             nguyenvana@ctuet.edu.vn   -> Vào /alerts (ThS. Nguyễn Văn A)");
  console.log("   • [SINH VIÊN TIÊU BIỂU] b2101001@student.ctuet.edu.vn -> Vào /student/alerts");
  console.log("\n🎯 DANH SÁCH 13 LUẬT MINH HỌA (Đăng nhập CVHT để xem):");
  for (const s of demoScenarios.slice(0, 13)) {
    console.log(`   • ${s.ruleCode.padEnd(12)}: [${s.studentId}] ${s.fullName.padEnd(30)} -> Mức độ: ${s.severity}`);
  }
  console.log("   ========================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed dữ liệu demo:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
