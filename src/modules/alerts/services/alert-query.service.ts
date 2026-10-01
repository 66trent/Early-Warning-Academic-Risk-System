/**
 * Alert Query Service — Truy vấn danh sách và chi tiết Cảnh báo / Tình trạng học tập.
 * Đảm bảo phân quyền phạm vi nghiêm ngặt và nguyên tắc hiển thị giao diện.
 */

import { prisma } from "@/lib/prisma";
import { assertScope } from "@/lib/authz";
import type { AlertStatus, Severity, Prisma } from "@/generated/prisma/client";
import type { ActorContext } from "./alert-lifecycle.service";

export interface ListAlertsFilter {
  page?: number;
  pageSize?: number;
  statuses?: AlertStatus[];
  severities?: Severity[];
  termId?: string;
  studentSearch?: string;
}

export async function listAlerts(filter: ListAlertsFilter, actor: ActorContext) {
  const page = Math.max(1, filter.page || 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const actorId = actor.userId || actor.id;

  // Xây dựng điều kiện WHERE dựa theo vai trò (assertScope & RBAC)
  const where: Prisma.AlertWhereInput = {};

  const studentWhere: Prisma.StudentWhereInput = {};

  if (actor.role === "ADVISOR") {
    // Chỉ xem sinh viên mình phụ trách
    where.OR = [{ assignedAdvisorId: actorId }, { student: { advisorId: actorId } }];
  } else if (actor.role === "TRAINING_OFFICER") {
    // Theo scopeConfig
    if (actor.scopeConfig) {
      try {
        const config =
          typeof actor.scopeConfig === "string"
            ? JSON.parse(actor.scopeConfig)
            : (actor.scopeConfig as Record<string, unknown>);

        if (config.scope !== "ALL" && config.departmentId !== "ALL") {
          let depts: string[] = [];
          if (Array.isArray(config.departments)) {
            depts = config.departments;
          } else if (typeof config.departmentId === "string") {
            depts = [config.departmentId];
          }
          if (depts.length > 0) {
            studentWhere.departmentId = { in: depts };
          }
        }
      } catch {
        // Fallback
      }
    }
  } else if (actor.role === "STUDENT") {
    // Sinh viên chỉ xem cảnh báo của chính mình
    where.studentId = actorId;
  }

  // Tìm kiếm theo tên hoặc MSSV
  if (filter.studentSearch && filter.studentSearch.trim()) {
    const search = filter.studentSearch.trim();
    studentWhere.OR = [
      { studentId: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (Object.keys(studentWhere).length > 0) {
    where.student = studentWhere;
  }

  // Lọc theo trạng thái (mặc định: OPEN và ACKNOWLEDGED cho CVHT)
  if (filter.statuses && filter.statuses.length > 0) {
    where.status = { in: filter.statuses };
  } else if (actor.role === "ADVISOR") {
    where.status = { in: ["OPEN", "ACKNOWLEDGED"] };
  }

  // Lọc theo mức độ nghiêm trọng
  if (filter.severities && filter.severities.length > 0) {
    where.severity = { in: filter.severities };
  }

  // Lọc theo học kỳ
  if (filter.termId) {
    where.termId = filter.termId;
  }

  // Đếm tổng số bản ghi
  const total = await prisma.alert.count({ where });

  // Truy vấn dữ liệu
  const alerts = await prisma.alert.findMany({
    where,
    skip,
    take: pageSize,
    include: {
      student: {
        select: {
          studentId: true,
          fullName: true,
          classId: true,
          departmentId: true,
        },
      },
      term: {
        select: {
          termId: true,
          termName: true,
        },
      },
      riskScoreLog: {
        select: {
          id: true,
          riskScoreValue: true,
          dataCompletenessLevel: true,
        },
      },
      ruleTriggers: {
        select: {
          id: true,
          ruleCode: true,
          severity: true,
          reason: true,
          triggeredAt: true,
          rule: {
            select: {
              ruleName: true,
              ruleGroup: true,
            },
          },
        },
      },
      interventions: {
        select: {
          interventionId: true,
          type: true,
          content: true,
          performedAt: true,
          performedBy: true,
        },
        orderBy: { performedAt: "desc" },
        take: 1,
      },
    },
    // Sắp xếp: Ưu tiên CRITICAL trước, sau đó HIGH, MEDIUM, LOW
    orderBy: [{ lastDetectedAt: "desc" }],
  });

  // Sort theo Severity thứ tự: CRITICAL > HIGH > MEDIUM > LOW (03-ui-design.md)
  const severityRank: Record<Severity, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const sortedAlerts = [...alerts].sort((a, b) => {
    const rankDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.lastDetectedAt).getTime() - new Date(a.lastDetectedAt).getTime();
  });

  return {
    alerts: sortedAlerts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getAlertDetails(alertId: string, actor: ActorContext) {
  const alert = await prisma.alert.findUnique({
    where: { alertId },
    include: {
      student: {
        include: {
          advisor: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      },
      term: true,
      assignedAdvisor: {
        select: {
          userId: true,
          fullName: true,
          email: true,
        },
      },
      riskScoreLog: true,
      ruleTriggers: {
        include: {
          rule: true,
          ruleVersion: true,
        },
        orderBy: { triggeredAt: "desc" },
      },
      interventions: {
        include: {
          performer: {
            select: {
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { performedAt: "desc" },
      },
      notifications: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!alert) {
    throw new Error(`Không tìm thấy cảnh báo với mã ${alertId}`);
  }

  // Kiểm tra phân quyền truy cập
  await assertScope(actor, {
    studentId: alert.studentId,
    departmentId: alert.student.departmentId,
    resourceType: "Alert",
  });

  return alert;
}

/**
 * Giao diện Sinh viên — xem tình hình học tập và hỗ trợ cá nhân (07-ux-design.md).
 * MUST NOT hiển thị từ "rủi ro", "cảnh báo", "vi phạm".
 * MUST NOT hiển thị điểm RiskScoreValue thô.
 */
export async function getStudentStudyStatus(studentId: string, actor: ActorContext) {
  // Sinh viên chỉ được xem của chính mình
  await assertScope(actor, { studentId });

  const student = await prisma.student.findUnique({
    where: { studentId },
    include: {
      advisor: {
        select: {
          fullName: true,
          email: true,
        },
      },
      enrollments: {
        where: { enrollmentStatus: "REGISTERED" },
        include: {
          courseSection: {
            include: {
              course: true,
            },
          },
        },
      },
    },
  });

  if (!student) {
    throw new Error(`Không tìm thấy thông tin sinh viên ${studentId}`);
  }

  // Lấy các Alert đang cần lưu ý (OPEN, ACKNOWLEDGED, IN_PROGRESS)
  const activeAlerts = await prisma.alert.findMany({
    where: {
      studentId,
      status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] },
    },
    include: {
      ruleTriggers: {
        select: {
          ruleCode: true,
          reason: true,
          severity: true,
        },
      },
    },
    orderBy: { lastDetectedAt: "desc" },
  });

  // Xác định trạng thái diễn giải tích cực (không dùng từ "rủi ro")
  let overallSupportLevel: "STABLE" | "NEEDS_ATTENTION" | "URGENT_SUPPORT" = "STABLE";
  const hasCritical = activeAlerts.some((a) => a.severity === "CRITICAL");
  const hasHighOrMedium = activeAlerts.some(
    (a) => a.severity === "HIGH" || a.severity === "MEDIUM"
  );

  if (hasCritical) {
    overallSupportLevel = "URGENT_SUPPORT";
  } else if (hasHighOrMedium) {
    overallSupportLevel = "NEEDS_ATTENTION";
  }

  // Biên dịch gợi ý học tập tích cực, thân thiện
  const suggestions: Array<{ id: string; category: string; advice: string }> = [];

  for (const alert of activeAlerts) {
    for (const trigger of alert.ruleTriggers) {
      if (trigger.ruleCode.startsWith("HR-ATT")) {
        suggestions.push({
          id: trigger.ruleCode,
          category: "Chuyên cần & Lớp học",
          advice:
            "Thầy/Cô ghi nhận bạn có buổi học vắng gần đây. Hãy liên hệ với giảng viên giảng dạy hoặc cán bộ lớp để cập nhật tài liệu và bài giảng đã bỏ lỡ.",
        });
      } else if (trigger.ruleCode.startsWith("HR-ACA")) {
        suggestions.push({
          id: trigger.ruleCode,
          category: "Kết quả học tập",
          advice:
            "Có bài kiểm tra hoặc môn học cần cải thiện điểm số. Bạn nên đặt lịch trao đổi với Cố vấn học tập để xây dựng kế hoạch ôn tập hiệu quả hơn.",
        });
      } else if (trigger.ruleCode.startsWith("HR-LMS")) {
        suggestions.push({
          id: trigger.ruleCode,
          category: "Hệ thống học trực tuyến (LMS)",
          advice:
            "Hệ thống ghi nhận bạn chưa hoàn thành các hoạt động hoặc bài tập trực tuyến gần đây. Vui lòng kiểm tra lại hạn chót trên LMS nhé.",
        });
      } else {
        suggestions.push({
          id: trigger.ruleCode,
          category: "Kế hoạch học tập chung",
          advice:
            "Nhà trường luôn đồng hành hỗ trợ bạn. Đừng ngần ngại liên hệ Cố vấn học tập để được hướng dẫn khi gặp khó khăn.",
        });
      }
    }
  }

  return {
    student: {
      studentId: student.studentId,
      fullName: student.fullName,
      classId: student.classId,
      cohortYear: student.cohortYear,
    },
    advisor: student.advisor
      ? {
          fullName: student.advisor.fullName,
          email: student.advisor.email,
        }
      : null,
    enrolledCourses: student.enrollments.map((enr) => ({
      courseCode: enr.courseSection.course.courseId,
      courseName: enr.courseSection.course.courseName,
      sectionId: enr.courseSection.courseSectionId,
      credits: enr.courseSection.course.credits,
    })),
    supportStatus: {
      level: overallSupportLevel,
      badgeText:
        overallSupportLevel === "STABLE"
          ? "Học tập ổn định"
          : overallSupportLevel === "NEEDS_ATTENTION"
            ? "Cần lưu ý hỗ trợ"
            : "Cần phối hợp với Thầy/Cô",
      summaryMessage:
        overallSupportLevel === "STABLE"
          ? "Tiến độ học tập của bạn đang diễn ra thuận lợi. Hãy tiếp tục duy trì nhé!"
          : overallSupportLevel === "NEEDS_ATTENTION"
            ? "Có một vài mục học tập bạn nên chú ý để duy trì kết quả tốt nhất."
            : "Thầy/Cô Cố vấn học tập đang muốn trao đổi thêm để hỗ trợ bạn hoàn thành tốt học kỳ này.",
    },
    suggestions,
  };
}
