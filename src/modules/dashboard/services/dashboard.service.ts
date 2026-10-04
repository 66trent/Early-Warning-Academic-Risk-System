/**
 * Dashboard Service — Truy vấn tổng hợp sẵn ở server cho biểu đồ dashboard.
 *
 * MUST: Dữ liệu biểu đồ tổng hợp sẵn ở server, không gửi raw data xuống client (DoD Phase 5).
 * MUST: Không import next/headers — service thuần, chạy được trong worker.
 * MUST: Phân quyền đã được kiểm tra ở tầng action trước khi gọi service.
 */

import { prisma } from "@/lib/prisma";
import type { Severity, AlertStatus, DataCompletenessLevel } from "@/generated/prisma/client";
import type {
  DashboardOverviewFilter,
  RiskScoreTrendFilter,
  DataQualityFilter,
  AtRiskStudentListFilter,
  ExportReportFilter,
} from "../validators/dashboard.schema";

// ==========================================
// Types cho kết quả tổng hợp
// ==========================================

export interface SeverityDistribution {
  severity: Severity;
  count: number;
  label: string;
}

export interface AlertStatusDistribution {
  status: AlertStatus;
  count: number;
  label: string;
}

export interface RuleGroupDistribution {
  ruleGroup: string;
  count: number;
  label: string;
}

export interface RiskScoreTrendPoint {
  date: string;
  averageScore: number;
  studentCount: number;
  fullCount: number;
  partialCount: number;
  insufficientCount: number;
}

export interface DataQualityMetrics {
  importErrorRate: number;
  totalImportBatches: number;
  totalErrorRows: number;
  totalSuccessRows: number;
  insufficientStudentCount: number;
  totalStudentWithScores: number;
  lastSyncAt: string | null;
  syncAgeHours: number | null;
  avgSyncDelayHours: number;
  batchStatusDistribution: Array<{ status: string; count: number }>;
  errorTypeDistribution: Array<{ reason: string; count: number }>;
}

export interface AtRiskStudentRow {
  studentId: string;
  fullName: string;
  classId: string;
  departmentId: string;
  severity: Severity;
  alertStatus: AlertStatus;
  alertId: string;
  riskScoreValue: number | null;
  dataCompletenessLevel: DataCompletenessLevel | null;
  ruleGroupSources: string[];
  lastDetectedAt: string;
  interventionCount: number;
}

export interface DashboardOverview {
  kpiCards: {
    totalStudents: number;
    totalActiveAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    mediumAlerts: number;
    lowAlerts: number;
    resolvedLast7Days: number;
    avgResponseTimeHours: number | null;
  };
  severityDistribution: SeverityDistribution[];
  alertStatusDistribution: AlertStatusDistribution[];
  ruleGroupDistribution: RuleGroupDistribution[];
}

// ==========================================
// Severity labels tiếng Việt
// ==========================================
const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: "Nghiêm trọng",
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
};

const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  OPEN: "Mở",
  ACKNOWLEDGED: "Đã xác nhận",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
  DISMISSED: "Bác bỏ",
  INVALIDATED: "Vô hiệu",
  REOPENED: "Mở lại",
};

const RULE_GROUP_LABELS: Record<string, string> = {
  ATTENDANCE: "Điểm danh",
  ACADEMIC: "Học lực",
  LMS: "LMS",
  COMBINED: "Tổ hợp",
  EXCEPTION: "Ngoại lệ",
};

// ==========================================
// Scope filter builder helper
// ==========================================
interface ScopeFilter {
  termId?: string;
  departmentId?: string;
  classId?: string;
}

function buildStudentScopeWhere(scope: ScopeFilter) {
  const where: Record<string, unknown> = {};
  if (scope.departmentId) where.departmentId = scope.departmentId;
  if (scope.classId) where.classId = scope.classId;
  return where;
}

function buildAlertScopeWhere(scope: ScopeFilter) {
  const where: Record<string, unknown> = {};
  if (scope.termId) where.termId = scope.termId;
  const studentWhere = buildStudentScopeWhere(scope);
  if (Object.keys(studentWhere).length > 0) {
    where.student = studentWhere;
  }
  return where;
}

// ==========================================
// 1. Dashboard Overview — KPI + Phân bố
// ==========================================

export async function getDashboardOverview(
  filter: DashboardOverviewFilter
): Promise<DashboardOverview> {
  const baseWhere = buildAlertScopeWhere(filter);

  // Đếm tổng sinh viên (theo scope)
  const studentWhere = buildStudentScopeWhere(filter);
  const totalStudents = await prisma.student.count({
    where: {
      officialAcademicStatus: "ACTIVE",
      ...studentWhere,
    },
  });

  // Active alerts = OPEN | ACKNOWLEDGED | IN_PROGRESS | REOPENED
  const activeStatuses: AlertStatus[] = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"];

  const activeAlerts = await prisma.alert.findMany({
    where: {
      ...baseWhere,
      status: { in: activeStatuses },
    },
    select: {
      severity: true,
      status: true,
    },
  });

  // Đếm theo severity
  const severityCounts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const a of activeAlerts) {
    severityCounts[a.severity]++;
  }

  // Đếm theo status (toàn bộ, không chỉ active)
  const allAlerts = await prisma.alert.findMany({
    where: baseWhere,
    select: { status: true },
  });

  const statusCounts: Record<AlertStatus, number> = {
    OPEN: 0,
    ACKNOWLEDGED: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    DISMISSED: 0,
    INVALIDATED: 0,
    REOPENED: 0,
  };
  for (const a of allAlerts) {
    statusCounts[a.status]++;
  }

  // Resolved trong 7 ngày gần nhất
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const resolvedLast7Days = await prisma.alert.count({
    where: {
      ...baseWhere,
      status: "RESOLVED",
      lastDetectedAt: { gte: sevenDaysAgo },
    },
  });

  // Thời gian phản hồi trung bình (từ firstDetectedAt → first intervention)
  const alertsWithInterventions = await prisma.alert.findMany({
    where: {
      ...baseWhere,
      interventions: { some: {} },
    },
    select: {
      firstDetectedAt: true,
      interventions: {
        select: { performedAt: true },
        orderBy: { performedAt: "asc" },
        take: 1,
      },
    },
  });

  let avgResponseTimeHours: number | null = null;
  if (alertsWithInterventions.length > 0) {
    const totalHours = alertsWithInterventions.reduce((sum, alert) => {
      if (alert.interventions.length > 0) {
        const diffMs =
          alert.interventions[0].performedAt.getTime() - alert.firstDetectedAt.getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }
      return sum;
    }, 0);
    avgResponseTimeHours = Math.round((totalHours / alertsWithInterventions.length) * 10) / 10;
  }

  // Phân bố theo RuleGroup (từ RuleTrigger)
  const triggers = await prisma.ruleTrigger.findMany({
    where: {
      alert: {
        ...baseWhere,
        status: { in: activeStatuses },
      },
    },
    select: {
      rule: { select: { ruleGroup: true } },
    },
  });

  const ruleGroupCounts: Record<string, number> = {};
  for (const t of triggers) {
    const group = t.rule.ruleGroup;
    ruleGroupCounts[group] = (ruleGroupCounts[group] || 0) + 1;
  }

  return {
    kpiCards: {
      totalStudents,
      totalActiveAlerts: activeAlerts.length,
      criticalAlerts: severityCounts.CRITICAL,
      highAlerts: severityCounts.HIGH,
      mediumAlerts: severityCounts.MEDIUM,
      lowAlerts: severityCounts.LOW,
      resolvedLast7Days,
      avgResponseTimeHours,
    },
    severityDistribution: (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[]).map((severity) => ({
      severity,
      count: severityCounts[severity],
      label: SEVERITY_LABELS[severity],
    })),
    alertStatusDistribution: (Object.keys(statusCounts) as AlertStatus[])
      .filter((s) => statusCounts[s] > 0)
      .map((status) => ({
        status,
        count: statusCounts[status],
        label: ALERT_STATUS_LABELS[status],
      })),
    ruleGroupDistribution: Object.entries(ruleGroupCounts).map(([group, count]) => ({
      ruleGroup: group,
      count,
      label: RULE_GROUP_LABELS[group] || group,
    })),
  };
}

// ==========================================
// 2. Xu hướng RiskScore theo thời gian
// ==========================================

export async function getRiskScoreTrend(
  filter: RiskScoreTrendFilter
): Promise<RiskScoreTrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - filter.days);

  const where: Record<string, unknown> = {
    calculatedAt: { gte: since },
  };
  if (filter.termId) where.termId = filter.termId;
  if (filter.departmentId) {
    where.student = { departmentId: filter.departmentId };
  }

  const logs = await prisma.riskScoreLog.findMany({
    where,
    select: {
      riskScoreValue: true,
      dataCompletenessLevel: true,
      calculatedAt: true,
    },
    orderBy: { calculatedAt: "asc" },
  });

  // Gộp theo ngày
  const dayMap = new Map<
    string,
    {
      totalScore: number;
      count: number;
      fullCount: number;
      partialCount: number;
      insufficientCount: number;
    }
  >();

  for (const log of logs) {
    const dateStr = log.calculatedAt.toISOString().split("T")[0];
    const entry = dayMap.get(dateStr) || {
      totalScore: 0,
      count: 0,
      fullCount: 0,
      partialCount: 0,
      insufficientCount: 0,
    };

    if (log.riskScoreValue !== null) {
      entry.totalScore += log.riskScoreValue;
      entry.count++;
    }

    if (log.dataCompletenessLevel === "FULL") entry.fullCount++;
    else if (log.dataCompletenessLevel === "PARTIAL") entry.partialCount++;
    else entry.insufficientCount++;

    dayMap.set(dateStr, entry);
  }

  return Array.from(dayMap.entries()).map(([date, entry]) => ({
    date,
    averageScore: entry.count > 0 ? Math.round((entry.totalScore / entry.count) * 100) / 100 : 0,
    studentCount: entry.count + entry.insufficientCount,
    fullCount: entry.fullCount,
    partialCount: entry.partialCount,
    insufficientCount: entry.insufficientCount,
  }));
}

// ==========================================
// 3. Dashboard chất lượng dữ liệu
// ==========================================

export async function getDataQualityMetrics(
  filter: DataQualityFilter
): Promise<DataQualityMetrics> {
  const since = new Date();
  since.setDate(since.getDate() - filter.days);

  const termWhere = filter.termId ? { termId: filter.termId } : {};

  // Import batch metrics
  const batches = await prisma.importBatch.findMany({
    where: {
      createdAt: { gte: since },
    },
    select: {
      status: true,
      totalRows: true,
      successRows: true,
      errorRows: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const totalImportBatches = batches.length;
  const totalErrorRows = batches.reduce((sum, b) => sum + b.errorRows, 0);
  const totalSuccessRows = batches.reduce((sum, b) => sum + b.successRows, 0);
  const totalRows = totalErrorRows + totalSuccessRows;
  const importErrorRate =
    totalRows > 0 ? Math.round((totalErrorRows / totalRows) * 10000) / 100 : 0;

  // Phân bố trạng thái batch
  const batchStatusMap: Record<string, number> = {};
  for (const b of batches) {
    batchStatusMap[b.status] = (batchStatusMap[b.status] || 0) + 1;
  }
  const batchStatusDistribution = Object.entries(batchStatusMap).map(([status, count]) => ({
    status,
    count,
  }));

  // Phân bố loại lỗi
  const errorRows = await prisma.importErrorRow.findMany({
    where: {
      importBatch: { createdAt: { gte: since } },
    },
    select: { errorReason: true },
  });

  const errorTypeMap: Record<string, number> = {};
  for (const e of errorRows) {
    errorTypeMap[e.errorReason] = (errorTypeMap[e.errorReason] || 0) + 1;
  }
  const errorTypeDistribution = Object.entries(errorTypeMap).map(([reason, count]) => ({
    reason,
    count,
  }));

  // Sinh viên INSUFFICIENT
  const latestScoreSubquery = await prisma.riskScoreLog.findMany({
    where: termWhere,
    distinct: ["studentId"],
    orderBy: { calculatedAt: "desc" },
    select: {
      studentId: true,
      dataCompletenessLevel: true,
    },
  });

  const insufficientStudentCount = latestScoreSubquery.filter(
    (s) => s.dataCompletenessLevel === "INSUFFICIENT"
  ).length;
  const totalStudentWithScores = latestScoreSubquery.length;

  // Độ trễ đồng bộ — thời gian từ batch cuối cùng hoàn thành
  const lastBatch = await prisma.importBatch.findFirst({
    where: { status: { in: ["RECONCILED", "LOADED"] } },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  const lastSyncAt = lastBatch?.completedAt?.toISOString() || null;
  const syncAgeHours = lastBatch?.completedAt
    ? Math.round((Date.now() - lastBatch.completedAt.getTime()) / (1000 * 60 * 60))
    : null;

  // Tính trung bình thời gian xử lý batch (processing delay)
  const completedBatches = batches.filter((b) => b.completedAt);
  let avgSyncDelayHours = 0;
  if (completedBatches.length > 0) {
    const totalDelay = completedBatches.reduce((sum, b) => {
      const diffMs = b.completedAt!.getTime() - b.createdAt.getTime();
      return sum + diffMs / (1000 * 60 * 60);
    }, 0);
    avgSyncDelayHours = Math.round((totalDelay / completedBatches.length) * 100) / 100;
  }

  return {
    importErrorRate,
    totalImportBatches,
    totalErrorRows,
    totalSuccessRows,
    insufficientStudentCount,
    totalStudentWithScores,
    lastSyncAt,
    syncAgeHours,
    avgSyncDelayHours,
    batchStatusDistribution,
    errorTypeDistribution,
  };
}

// ==========================================
// 4. Danh sách sinh viên nguy cơ (sorted CRITICAL trên cùng)
// ==========================================

export async function getAtRiskStudentList(filter: AtRiskStudentListFilter) {
  const page = Math.max(1, filter.page);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize));
  const skip = (page - 1) * pageSize;

  const activeStatuses: AlertStatus[] = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"];

  const where: Record<string, unknown> = {
    status: { in: activeStatuses },
  };

  if (filter.termId) where.termId = filter.termId;
  if (filter.severity) where.severity = filter.severity;

  const studentWhere: Record<string, unknown> = {};
  if (filter.departmentId) studentWhere.departmentId = filter.departmentId;
  if (filter.classId) studentWhere.classId = filter.classId;
  if (Object.keys(studentWhere).length > 0) {
    where.student = studentWhere;
  }

  const total = await prisma.alert.count({ where });

  const alerts = await prisma.alert.findMany({
    where,
    include: {
      student: {
        select: {
          studentId: true,
          fullName: true,
          classId: true,
          departmentId: true,
        },
      },
      riskScoreLog: {
        select: {
          riskScoreValue: true,
          dataCompletenessLevel: true,
        },
      },
      ruleTriggers: {
        select: {
          rule: { select: { ruleGroup: true } },
        },
      },
      _count: {
        select: { interventions: true },
      },
    },
    orderBy: { lastDetectedAt: "desc" },
  });

  // Sắp xếp theo Severity giảm dần (CRITICAL trên cùng, theo 03-ui-design.md)
  const severityRank: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

  const sorted = [...alerts].sort((a, b) => {
    const rankDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.lastDetectedAt).getTime() - new Date(a.lastDetectedAt).getTime();
  });

  // Phân trang sau khi sắp xếp
  const paged = sorted.slice(skip, skip + pageSize);

  const rows: AtRiskStudentRow[] = paged.map((alert) => {
    const ruleGroups = new Set(alert.ruleTriggers.map((t) => t.rule.ruleGroup));
    return {
      studentId: alert.student.studentId,
      fullName: alert.student.fullName,
      classId: alert.student.classId,
      departmentId: alert.student.departmentId,
      severity: alert.severity,
      alertStatus: alert.status,
      alertId: alert.alertId,
      riskScoreValue: alert.riskScoreLog?.riskScoreValue ?? null,
      dataCompletenessLevel: alert.riskScoreLog?.dataCompletenessLevel ?? null,
      ruleGroupSources: Array.from(ruleGroups),
      lastDetectedAt: alert.lastDetectedAt.toISOString(),
      interventionCount: alert._count.interventions,
    };
  });

  return {
    students: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ==========================================
// 5. Xuất báo cáo theo lớp/khoa/học kỳ
// ==========================================

export async function exportReport(filter: ExportReportFilter) {
  const activeStatuses: AlertStatus[] = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"];

  const where: Record<string, unknown> = {
    termId: filter.termId,
    status: { in: activeStatuses },
  };

  const studentWhere: Record<string, unknown> = {};
  if (filter.departmentId) studentWhere.departmentId = filter.departmentId;
  if (filter.classId) studentWhere.classId = filter.classId;
  if (Object.keys(studentWhere).length > 0) {
    where.student = studentWhere;
  }

  const alerts = await prisma.alert.findMany({
    where,
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
          termName: true,
        },
      },
      riskScoreLog: {
        select: {
          riskScoreValue: true,
          dataCompletenessLevel: true,
        },
      },
      ruleTriggers: {
        select: {
          ruleCode: true,
          reason: true,
          severity: true,
          rule: { select: { ruleGroup: true, ruleName: true } },
        },
      },
      _count: {
        select: { interventions: true },
      },
    },
    orderBy: { lastDetectedAt: "desc" },
  });

  // Sắp xếp CRITICAL trên cùng
  const severityRank: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sorted = [...alerts].sort(
    (a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0)
  );

  if (filter.format === "json") {
    return {
      format: "json" as const,
      data: sorted.map((alert) => ({
        mssv: alert.student.studentId,
        hoTen: alert.student.fullName,
        lop: alert.student.classId,
        khoa: alert.student.departmentId,
        hocKy: alert.term.termName,
        mucDoNghiemTrong: alert.severity,
        trangThai: alert.status,
        diemRuiRo: alert.riskScoreLog?.riskScoreValue ?? "N/A",
        mucDoTinCay: alert.riskScoreLog?.dataCompletenessLevel ?? "N/A",
        nguyenNhan: alert.ruleTriggers.map((t) => `${t.ruleCode}: ${t.reason}`).join("; "),
        soCanThiep: alert._count.interventions,
        ngayPhatHien: alert.firstDetectedAt.toISOString(),
        ngayCapNhat: alert.lastDetectedAt.toISOString(),
      })),
    };
  }

  // CSV format
  const csvHeaders = [
    "MSSV",
    "Họ tên",
    "Lớp",
    "Khoa",
    "Học kỳ",
    "Mức độ",
    "Trạng thái",
    "Điểm rủi ro",
    "Độ tin cậy",
    "Nguyên nhân",
    "Số can thiệp",
    "Ngày phát hiện",
    "Ngày cập nhật",
  ];

  const csvRows = sorted.map((alert) => {
    const reasons = alert.ruleTriggers.map((t) => `${t.ruleCode}: ${t.reason}`).join("; ");
    return [
      alert.student.studentId,
      alert.student.fullName,
      alert.student.classId,
      alert.student.departmentId,
      alert.term.termName,
      SEVERITY_LABELS[alert.severity],
      ALERT_STATUS_LABELS[alert.status],
      alert.riskScoreLog?.riskScoreValue?.toString() ?? "N/A",
      alert.riskScoreLog?.dataCompletenessLevel ?? "N/A",
      `"${reasons.replace(/"/g, '""')}"`,
      alert._count.interventions.toString(),
      alert.firstDetectedAt.toISOString(),
      alert.lastDetectedAt.toISOString(),
    ].join(",");
  });

  const BOM = "\uFEFF";
  const csvContent = BOM + [csvHeaders.join(","), ...csvRows].join("\n");

  return {
    format: "csv" as const,
    data: csvContent,
  };
}

// ==========================================
// 6. Lấy danh sách Term và Department cho bộ lọc
// ==========================================

export async function getFilterOptions() {
  const [terms, departments, classes] = await Promise.all([
    prisma.term.findMany({
      select: { termId: true, termName: true, academicYear: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.student.findMany({
      select: { departmentId: true },
      distinct: ["departmentId"],
    }),
    prisma.student.findMany({
      select: { classId: true },
      distinct: ["classId"],
    }),
  ]);

  return {
    terms: terms.map((t) => ({ value: t.termId, label: `${t.termName} (${t.academicYear})` })),
    departments: departments.map((d) => ({ value: d.departmentId, label: d.departmentId })),
    classes: classes.map((c) => ({ value: c.classId, label: c.classId })),
  };
}
