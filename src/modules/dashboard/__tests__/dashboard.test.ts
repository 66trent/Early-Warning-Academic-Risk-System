import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dashboardOverviewFilterSchema,
  riskScoreTrendFilterSchema,
  dataQualityFilterSchema,
  atRiskStudentListFilterSchema,
  exportReportFilterSchema,
} from "../validators/dashboard.schema";
import {
  getDashboardOverview,
  getRiskScoreTrend,
  getDataQualityMetrics,
  getAtRiskStudentList,
  exportReport,
  getFilterOptions,
} from "../services/dashboard.service";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    alert: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    ruleTrigger: {
      findMany: vi.fn(),
    },
    riskScoreLog: {
      findMany: vi.fn(),
    },
    importBatch: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    importErrorRow: {
      findMany: vi.fn(),
    },
    term: {
      findMany: vi.fn(),
    },
  },
}));

type MockAlertFindMany = Awaited<ReturnType<typeof prisma.alert.findMany>>;
type MockRuleTriggerFindMany = Awaited<ReturnType<typeof prisma.ruleTrigger.findMany>>;
type MockRiskScoreLogFindMany = Awaited<ReturnType<typeof prisma.riskScoreLog.findMany>>;
type MockImportBatchFindMany = Awaited<ReturnType<typeof prisma.importBatch.findMany>>;
type MockImportErrorRowFindMany = Awaited<ReturnType<typeof prisma.importErrorRow.findMany>>;
type MockImportBatchFindFirst = Awaited<ReturnType<typeof prisma.importBatch.findFirst>>;
type MockTermFindMany = Awaited<ReturnType<typeof prisma.term.findMany>>;
type MockStudentFindMany = Awaited<ReturnType<typeof prisma.student.findMany>>;

describe("Phase 5 — Dashboard Validators", () => {
  describe("dashboardOverviewFilterSchema", () => {
    it("should accept empty filter and use undefined for optional fields", () => {
      const parsed = dashboardOverviewFilterSchema.parse({});
      expect(parsed).toEqual({});
    });

    it("should accept termId, departmentId, classId", () => {
      const parsed = dashboardOverviewFilterSchema.parse({
        termId: "2026-1",
        departmentId: "CNTT",
        classId: "CNTT01",
      });
      expect(parsed.termId).toBe("2026-1");
      expect(parsed.departmentId).toBe("CNTT");
      expect(parsed.classId).toBe("CNTT01");
    });
  });

  describe("riskScoreTrendFilterSchema", () => {
    it("should default days to 30", () => {
      const parsed = riskScoreTrendFilterSchema.parse({});
      expect(parsed.days).toBe(30);
    });

    it("should accept custom valid days within [1, 365]", () => {
      const parsed = riskScoreTrendFilterSchema.parse({ days: 90 });
      expect(parsed.days).toBe(90);
    });

    it("should reject days outside [1, 365]", () => {
      expect(() => riskScoreTrendFilterSchema.parse({ days: 0 })).toThrow();
      expect(() => riskScoreTrendFilterSchema.parse({ days: 400 })).toThrow();
    });
  });

  describe("dataQualityFilterSchema", () => {
    it("should default days to 30", () => {
      const parsed = dataQualityFilterSchema.parse({});
      expect(parsed.days).toBe(30);
    });

    it("should accept valid days and termId", () => {
      const parsed = dataQualityFilterSchema.parse({ days: 14, termId: "2026-1" });
      expect(parsed.days).toBe(14);
      expect(parsed.termId).toBe("2026-1");
    });
  });

  describe("atRiskStudentListFilterSchema", () => {
    it("should apply defaults page=1, pageSize=20", () => {
      const parsed = atRiskStudentListFilterSchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(20);
    });

    it("should accept valid severity filter", () => {
      const parsed = atRiskStudentListFilterSchema.parse({
        severity: "CRITICAL",
        page: 2,
        pageSize: 50,
      });
      expect(parsed.severity).toBe("CRITICAL");
      expect(parsed.page).toBe(2);
      expect(parsed.pageSize).toBe(50);
    });

    it("should reject invalid severity", () => {
      expect(() => atRiskStudentListFilterSchema.parse({ severity: "INVALID_SEVERITY" })).toThrow();
    });

    it("should reject pageSize > 100", () => {
      expect(() => atRiskStudentListFilterSchema.parse({ pageSize: 101 })).toThrow();
    });
  });

  describe("exportReportFilterSchema", () => {
    it("should require termId", () => {
      expect(() => exportReportFilterSchema.parse({})).toThrow();
    });

    it("should default format to csv", () => {
      const parsed = exportReportFilterSchema.parse({ termId: "2026-1" });
      expect(parsed.format).toBe("csv");
    });

    it("should accept json format", () => {
      const parsed = exportReportFilterSchema.parse({
        termId: "2026-1",
        format: "json",
      });
      expect(parsed.format).toBe("json");
    });
  });
});

describe("Phase 5 — Dashboard Service Aggregations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDashboardOverview", () => {
    it("should return pre-aggregated KPI cards and distributions", async () => {
      vi.mocked(prisma.student.count).mockResolvedValueOnce(120);

      vi.mocked(prisma.alert.findMany)
        .mockResolvedValueOnce([
          { severity: "CRITICAL", status: "OPEN" },
          { severity: "CRITICAL", status: "ACKNOWLEDGED" },
          { severity: "HIGH", status: "IN_PROGRESS" },
          { severity: "MEDIUM", status: "OPEN" },
          { severity: "LOW", status: "REOPENED" },
        ] as unknown as MockAlertFindMany)
        .mockResolvedValueOnce([
          { status: "OPEN" },
          { status: "ACKNOWLEDGED" },
          { status: "IN_PROGRESS" },
          { status: "OPEN" },
          { status: "REOPENED" },
          { status: "RESOLVED" },
          { status: "DISMISSED" },
        ] as unknown as MockAlertFindMany);

      vi.mocked(prisma.alert.count).mockResolvedValueOnce(3);

      vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([
        {
          firstDetectedAt: new Date("2026-09-01T08:00:00Z"),
          interventions: [{ performedAt: new Date("2026-09-01T12:00:00Z") }],
        },
      ] as unknown as MockAlertFindMany);

      vi.mocked(prisma.ruleTrigger.findMany).mockResolvedValueOnce([
        { rule: { ruleGroup: "ATTENDANCE" } },
        { rule: { ruleGroup: "ATTENDANCE" } },
        { rule: { ruleGroup: "ACADEMIC" } },
        { rule: { ruleGroup: "LMS" } },
      ] as unknown as MockRuleTriggerFindMany);

      const overview = await getDashboardOverview({});

      expect(overview.kpiCards.totalStudents).toBe(120);
      expect(overview.kpiCards.totalActiveAlerts).toBe(5);
      expect(overview.kpiCards.criticalAlerts).toBe(2);
      expect(overview.kpiCards.highAlerts).toBe(1);
      expect(overview.kpiCards.mediumAlerts).toBe(1);
      expect(overview.kpiCards.lowAlerts).toBe(1);
      expect(overview.kpiCards.resolvedLast7Days).toBe(3);
      expect(overview.kpiCards.avgResponseTimeHours).toBe(4);

      expect(overview.severityDistribution).toHaveLength(4);
      expect(overview.severityDistribution.find((s) => s.severity === "CRITICAL")?.count).toBe(2);

      const attGroup = overview.ruleGroupDistribution.find((g) => g.ruleGroup === "ATTENDANCE");
      expect(attGroup?.count).toBe(2);
    });
  });

  describe("getRiskScoreTrend", () => {
    it("should aggregate risk scores by day and calculate daily average", async () => {
      const date1 = new Date("2026-09-10T10:00:00Z");
      const date2 = new Date("2026-09-10T15:00:00Z");
      const date3 = new Date("2026-09-11T09:00:00Z");

      vi.mocked(prisma.riskScoreLog.findMany).mockResolvedValueOnce([
        {
          riskScoreValue: 0.6,
          dataCompletenessLevel: "FULL",
          calculatedAt: date1,
        },
        {
          riskScoreValue: 0.8,
          dataCompletenessLevel: "FULL",
          calculatedAt: date2,
        },
        {
          riskScoreValue: null,
          dataCompletenessLevel: "INSUFFICIENT",
          calculatedAt: date3,
        },
      ] as unknown as MockRiskScoreLogFindMany);

      const trend = await getRiskScoreTrend({ days: 30 });
      expect(trend).toHaveLength(2);

      const day1 = trend.find((t) => t.date === "2026-09-10");
      expect(day1).toBeDefined();
      expect(day1?.averageScore).toBe(0.7);
      expect(day1?.fullCount).toBe(2);

      const day2 = trend.find((t) => t.date === "2026-09-11");
      expect(day2).toBeDefined();
      expect(day2?.insufficientCount).toBe(1);
      expect(day2?.averageScore).toBe(0);
    });
  });

  describe("getDataQualityMetrics", () => {
    it("should calculate import error rates, insufficient students, and sync delay", async () => {
      const created = new Date("2026-09-15T08:00:00Z");
      const completed = new Date("2026-09-15T08:30:00Z");

      vi.mocked(prisma.importBatch.findMany).mockResolvedValueOnce([
        {
          status: "RECONCILED",
          totalRows: 100,
          successRows: 95,
          errorRows: 5,
          createdAt: created,
          completedAt: completed,
        },
      ] as unknown as MockImportBatchFindMany);

      vi.mocked(prisma.importErrorRow.findMany).mockResolvedValueOnce([
        { errorReason: "INVALID_FORMAT" },
        { errorReason: "NOT_ENROLLED" },
      ] as unknown as MockImportErrorRowFindMany);

      vi.mocked(prisma.riskScoreLog.findMany).mockResolvedValueOnce([
        { studentId: "SV01", dataCompletenessLevel: "FULL" },
        { studentId: "SV02", dataCompletenessLevel: "INSUFFICIENT" },
      ] as unknown as MockRiskScoreLogFindMany);

      vi.mocked(prisma.importBatch.findFirst).mockResolvedValueOnce({
        completedAt: completed,
      } as unknown as MockImportBatchFindFirst);

      const metrics = await getDataQualityMetrics({ days: 30 });

      expect(metrics.totalImportBatches).toBe(1);
      expect(metrics.totalErrorRows).toBe(5);
      expect(metrics.totalSuccessRows).toBe(95);
      expect(metrics.importErrorRate).toBe(5);
      expect(metrics.insufficientStudentCount).toBe(1);
      expect(metrics.totalStudentWithScores).toBe(2);
      expect(metrics.lastSyncAt).toBe(completed.toISOString());
      expect(metrics.avgSyncDelayHours).toBe(0.5);
    });
  });

  describe("getAtRiskStudentList", () => {
    it("should sort CRITICAL alerts on top per 03-ui-design.md", async () => {
      vi.mocked(prisma.alert.count).mockResolvedValueOnce(3);
      vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([
        {
          alertId: "alert-low",
          severity: "LOW",
          status: "OPEN",
          lastDetectedAt: new Date("2026-09-15T10:00:00Z"),
          student: {
            studentId: "B21003",
            fullName: "Lê Văn C",
            classId: "CNTT01",
            departmentId: "CNTT",
          },
          riskScoreLog: { riskScoreValue: 0.2, dataCompletenessLevel: "FULL" },
          ruleTriggers: [{ rule: { ruleGroup: "ATTENDANCE" } }],
          _count: { interventions: 0 },
        },
        {
          alertId: "alert-crit",
          severity: "CRITICAL",
          status: "OPEN",
          lastDetectedAt: new Date("2026-09-15T09:00:00Z"),
          student: {
            studentId: "B21001",
            fullName: "Nguyễn Văn A",
            classId: "CNTT01",
            departmentId: "CNTT",
          },
          riskScoreLog: { riskScoreValue: 0.9, dataCompletenessLevel: "FULL" },
          ruleTriggers: [{ rule: { ruleGroup: "ACADEMIC" } }],
          _count: { interventions: 1 },
        },
        {
          alertId: "alert-high",
          severity: "HIGH",
          status: "IN_PROGRESS",
          lastDetectedAt: new Date("2026-09-15T11:00:00Z"),
          student: {
            studentId: "B21002",
            fullName: "Trần Thị B",
            classId: "CNTT01",
            departmentId: "CNTT",
          },
          riskScoreLog: { riskScoreValue: 0.7, dataCompletenessLevel: "PARTIAL" },
          ruleTriggers: [{ rule: { ruleGroup: "LMS" } }],
          _count: { interventions: 2 },
        },
      ] as unknown as MockAlertFindMany);

      const result = await getAtRiskStudentList({ page: 1, pageSize: 10 });

      expect(result.students).toHaveLength(3);
      // First row MUST be CRITICAL
      expect(result.students[0].severity).toBe("CRITICAL");
      expect(result.students[0].studentId).toBe("B21001");
      // Second row MUST be HIGH
      expect(result.students[1].severity).toBe("HIGH");
      // Third row MUST be LOW
      expect(result.students[2].severity).toBe("LOW");
    });
  });

  describe("exportReport", () => {
    const mockAlertData = [
      {
        alertId: "alert-1",
        severity: "CRITICAL",
        status: "OPEN",
        firstDetectedAt: new Date("2026-09-01T08:00:00Z"),
        lastDetectedAt: new Date("2026-09-02T08:00:00Z"),
        student: {
          studentId: "B21001",
          fullName: "Nguyễn Văn A",
          classId: "CNTT01",
          departmentId: "CNTT",
        },
        term: { termName: "Học kỳ 1 2026-2027" },
        riskScoreLog: { riskScoreValue: 0.85, dataCompletenessLevel: "FULL" },
        ruleTriggers: [
          {
            ruleCode: "HR-ATT-01",
            reason: "Vắng 3 buổi",
            severity: "HIGH",
            rule: { ruleGroup: "ATTENDANCE" },
          },
        ],
        _count: { interventions: 1 },
      },
    ];

    it("should generate CSV with UTF-8 BOM and correct headers", async () => {
      vi.mocked(prisma.alert.findMany).mockResolvedValueOnce(
        mockAlertData as unknown as MockAlertFindMany
      );

      const result = await exportReport({ termId: "2026-1", format: "csv" });
      expect(result.format).toBe("csv");
      if (result.format === "csv") {
        expect(typeof result.data).toBe("string");
        // Starts with UTF-8 BOM
        expect(result.data.startsWith("\uFEFF")).toBe(true);
        expect(result.data).toContain("MSSV,Họ tên,Lớp,Khoa,Học kỳ");
        expect(result.data).toContain("B21001,Nguyễn Văn A,CNTT01,CNTT");
      }
    });

    it("should generate JSON format when requested", async () => {
      vi.mocked(prisma.alert.findMany).mockResolvedValueOnce(
        mockAlertData as unknown as MockAlertFindMany
      );

      const result = await exportReport({ termId: "2026-1", format: "json" });
      expect(result.format).toBe("json");
      if (result.format === "json") {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data[0].mssv).toBe("B21001");
        expect(result.data[0].mucDoNghiemTrong).toBe("CRITICAL");
      }
    });
  });

  describe("getFilterOptions", () => {
    it("should return terms, departments, classes from prisma", async () => {
      vi.mocked(prisma.term.findMany).mockResolvedValueOnce([
        { termId: "2026-1", termName: "HK1", academicYear: "2026-2027" },
      ] as unknown as MockTermFindMany);
      vi.mocked(prisma.student.findMany)
        .mockResolvedValueOnce([{ departmentId: "CNTT" }] as unknown as MockStudentFindMany)
        .mockResolvedValueOnce([{ classId: "CNTT01" }] as unknown as MockStudentFindMany);

      const options = await getFilterOptions();
      expect(options.terms).toHaveLength(1);
      expect(options.terms[0].value).toBe("2026-1");
      expect(options.departments[0].value).toBe("CNTT");
      expect(options.classes[0].value).toBe("CNTT01");
    });
  });
});
