import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDashboardOverviewAction,
  getRiskScoreTrendAction,
  getDataQualityAction,
  getAtRiskStudentListAction,
  exportReportAction,
  getFilterOptionsAction,
} from "../actions/dashboard.action";
import * as sessionModule from "@/lib/session";
import * as auditModule from "@/lib/audit";
import { GET as exportRouteHandler } from "@/app/api/dashboard/export/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  assertScope: vi.fn().mockImplementation((actor, opts) => {
    if (
      opts?.departmentId &&
      actor?.scopeConfig?.departmentId &&
      actor.scopeConfig.departmentId !== opts.departmentId
    ) {
      throw new Error("Không có quyền truy cập khoa này.");
    }
    return Promise.resolve();
  }),
}));

vi.mock("../services/dashboard.service", () => ({
  getDashboardOverview: vi.fn().mockResolvedValue({ kpiCards: { totalStudents: 100 } }),
  getRiskScoreTrend: vi.fn().mockResolvedValue([{ date: "2026-09-01", averageScore: 0.5 }]),
  getDataQualityMetrics: vi.fn().mockResolvedValue({ importErrorRate: 2.5 }),
  getAtRiskStudentList: vi.fn().mockResolvedValue({ students: [], total: 0 }),
  exportReport: vi
    .fn()
    .mockResolvedValue({ format: "csv", data: "\uFEFFMSSV,Họ tên\nB21001,Test" }),
  getFilterOptions: vi.fn().mockResolvedValue({ terms: [], departments: [], classes: [] }),
}));

type MockSessionReturn = Awaited<ReturnType<typeof sessionModule.getSession>>;

describe("Phase 5 — Dashboard Server Actions (scaffold-server-action & RBAC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOfficerSession = {
    user: {
      id: "QLDT001",
      userId: "QLDT001",
      role: "TRAINING_OFFICER",
      fullName: "Cán bộ Đào tạo",
      email: "qldt@ctuet.edu.vn",
      scopeConfig: {},
    },
    session: { id: "sess-qldt" },
  };

  const mockAdminSession = {
    user: {
      id: "ADMIN001",
      userId: "ADMIN001",
      role: "ADMIN",
      fullName: "Quản trị viên",
      email: "admin@ctuet.edu.vn",
      scopeConfig: {},
    },
    session: { id: "sess-admin" },
  };

  const mockStudentSession = {
    user: {
      id: "B21001",
      userId: "B21001",
      role: "STUDENT",
      fullName: "Sinh viên",
      email: "b21001@student.ctuet.edu.vn",
    },
    session: { id: "sess-sv" },
  };

  const mockAdvisorSession = {
    user: {
      id: "GV001",
      userId: "GV001",
      role: "ADVISOR",
      fullName: "Cố vấn học tập",
      email: "advisor@ctuet.edu.vn",
    },
    session: { id: "sess-cvht" },
  };

  describe("RBAC Permissions", () => {
    it("should reject unauthenticated request", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(null);

      const result = await getDashboardOverviewAction({});
      expect(result.success).toBe(false);
      expect(result.error).toContain("đăng nhập");
    });

    it("should reject STUDENT role from accessing dashboard", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockStudentSession as unknown as MockSessionReturn
      );

      const result = await getDashboardOverviewAction({});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Chỉ Cán bộ Đào tạo");
    });

    it("should reject ADVISOR role from accessing global dashboard", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockAdvisorSession as unknown as MockSessionReturn
      );

      const result = await getRiskScoreTrendAction({});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Chỉ Cán bộ Đào tạo");
    });

    it("should allow TRAINING_OFFICER to access overview and charts", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockOfficerSession as unknown as MockSessionReturn
      );

      const result = await getDashboardOverviewAction({});
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should allow ADMIN to access data quality metrics", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockAdminSession as unknown as MockSessionReturn
      );

      const result = await getDataQualityAction({});
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should allow TRAINING_OFFICER to get filter options", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockOfficerSession as unknown as MockSessionReturn
      );

      const result = await getFilterOptionsAction();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("exportReportAction & Audit Log", () => {
    it("should write audit log upon exporting reports", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockOfficerSession as unknown as MockSessionReturn
      );

      const result = await exportReportAction({
        termId: "2026-1",
        departmentId: "CNTT",
        format: "csv",
      });

      expect(result.success).toBe(true);
      expect(auditModule.writeAuditLog).toHaveBeenCalledTimes(1);
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "QLDT001",
          actorRole: "TRAINING_OFFICER",
          action: "EXPORT_REPORT",
          targetEntity: "Dashboard",
        })
      );
    });

    it("should reject export with invalid payload", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockOfficerSession as unknown as MockSessionReturn
      );

      const result = await exportReportAction({});
      expect(result.success).toBe(false);
      expect(auditModule.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe("getAtRiskStudentListAction with Scope assertion", () => {
    it("should assert department scope when departmentId is provided", async () => {
      const officerWithScope = {
        user: {
          ...mockOfficerSession.user,
          scopeConfig: { departmentId: "CNTT" },
        },
        session: { id: "sess-scope" },
      };

      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        officerWithScope as unknown as MockSessionReturn
      );

      const result = await getAtRiskStudentListAction({
        departmentId: "CNTT",
        page: 1,
        pageSize: 20,
      });

      expect(result.success).toBe(true);
    });
  });
});

describe("Phase 5 — Route Handler: GET /api/dashboard/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/dashboard/export?termId=2026-1");
    const res = await exportRouteHandler(req);

    expect(res.status).toBe(401);
  });

  it("should return 403 when user is not TRAINING_OFFICER or ADMIN", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
      user: { role: "STUDENT", id: "SV01", userId: "SV01" },
    } as unknown as MockSessionReturn);

    const req = new NextRequest("http://localhost:3000/api/dashboard/export?termId=2026-1");
    const res = await exportRouteHandler(req);

    expect(res.status).toBe(403);
  });

  it("should return 400 when missing termId", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
      user: { role: "TRAINING_OFFICER", id: "QLDT01", userId: "QLDT01" },
    } as unknown as MockSessionReturn);

    const req = new NextRequest("http://localhost:3000/api/dashboard/export");
    const res = await exportRouteHandler(req);

    expect(res.status).toBe(400);
  });

  it("should return CSV attachment with UTF-8 and write audit log when valid", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
      user: { role: "TRAINING_OFFICER", id: "QLDT01", userId: "QLDT01" },
    } as unknown as MockSessionReturn);

    const req = new NextRequest(
      "http://localhost:3000/api/dashboard/export?termId=2026-1&departmentId=CNTT"
    );
    const res = await exportRouteHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment; filename=");
    expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EXPORT_REPORT_CSV",
        actorRole: "TRAINING_OFFICER",
      })
    );
  });
});
