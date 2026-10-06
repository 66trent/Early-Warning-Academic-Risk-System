import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAuditLogsAction,
  getAuditLogDetailAction,
  getAuditLogStatisticsAction,
} from "../actions/audit.action";
import * as auditActions from "../actions/audit.action";
import * as auditServiceModule from "../services/audit.service";
import * as sessionModule from "@/lib/session";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("../services/audit.service", () => ({
  listAuditLogsService: vi.fn(),
  getAuditLogByIdService: vi.fn(),
  getAuditLogStatisticsService: vi.fn(),
}));

type MockSessionReturn = Awaited<ReturnType<typeof sessionModule.getSession>>;

describe("Phase 6 Admin: Audit Log Viewer & Append-only Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Kiểm tra tính toàn vẹn Append-only (DoD Phase 6)", () => {
    it("Audit Log TUYỆT ĐỐI KHÔNG có Server Action nào cho phép sửa hoặc xóa", () => {
      // Đảm bảo không tồn tại bất kỳ hàm update hoặc delete nào trong export của action & service
      const exportedActionNames = Object.keys(auditActions);
      const exportedServiceNames = Object.keys(auditServiceModule);

      const forbiddenKeywords = [
        "update",
        "edit",
        "modify",
        "delete",
        "remove",
        "purge",
        "clear",
        "drop",
      ];

      for (const name of exportedActionNames) {
        for (const kw of forbiddenKeywords) {
          expect(
            name.toLowerCase().includes(kw),
            `Phát hiện action nguy hiểm '${name}' vi phạm nguyên tắc append-only của Audit Log`
          ).toBe(false);
        }
      }

      for (const name of exportedServiceNames) {
        for (const kw of forbiddenKeywords) {
          expect(
            name.toLowerCase().includes(kw),
            `Phát hiện service nguy hiểm '${name}' vi phạm nguyên tắc append-only của Audit Log`
          ).toBe(false);
        }
      }
    });
  });

  describe("2. Phân quyền RBAC xem Audit Log", () => {
    it("Chặn người dùng STUDENT và ADVISOR truy cập Audit Log", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "B2101001", role: "STUDENT" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(listAuditLogsAction({})).rejects.toThrow(
        "Chỉ Quản trị viên hoặc Cán bộ quản lý đào tạo mới có quyền xem nhật ký kiểm toán"
      );

      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "GV001", role: "ADVISOR" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(listAuditLogsAction({})).rejects.toThrow(
        "Chỉ Quản trị viên hoặc Cán bộ quản lý đào tạo mới có quyền xem nhật ký kiểm toán"
      );
    });

    it("Cho phép TRAINING_OFFICER xem Audit Log", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "QLDT001", role: "TRAINING_OFFICER" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockData = {
        logs: [],
        total: 0,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      };
      vi.mocked(auditServiceModule.listAuditLogsService).mockResolvedValueOnce(mockData);

      const result = await listAuditLogsAction({ page: 1 });
      expect(result).toEqual(mockData);
    });

    it("Cho phép ADMIN xem Audit Log và áp dụng bộ lọc", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockData = {
        logs: [
          {
            id: "log-1",
            actorId: "ADMIN001",
            actorRole: "ADMIN",
            action: "UPDATE_USER",
            targetEntity: "User",
            targetId: "GV001",
            details: {},
            ipAddress: "127.0.0.1",
            userAgent: "Mozilla/5.0",
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      };
      vi.mocked(auditServiceModule.listAuditLogsService).mockResolvedValueOnce(mockData);

      const result = await listAuditLogsAction({
        actorId: "ADMIN001",
        action: "UPDATE_USER",
        targetEntity: "User",
      });

      expect(result).toEqual(mockData);
      expect(auditServiceModule.listAuditLogsService).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "ADMIN001",
          action: "UPDATE_USER",
          targetEntity: "User",
        })
      );
    });
  });

  describe("3. Xem chi tiết & thống kê Audit Log", () => {
    it("Lấy chi tiết bản ghi kiểm toán thành công", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockDetail = {
        id: "log-123",
        actorId: "ADMIN001",
        actorRole: "ADMIN",
        action: "CREATE_USER",
        targetEntity: "User",
        targetId: "B2101001",
        details: { fullName: "Nguyễn Văn A" },
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      };
      vi.mocked(auditServiceModule.getAuditLogByIdService).mockResolvedValueOnce(mockDetail);

      const result = await getAuditLogDetailAction("log-123");
      expect(result).toEqual(mockDetail);
    });

    it("Lấy thống kê Audit Log thành công", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockStats = {
        totalCount: 150,
        last24hCount: 25,
        topActions: [
          { action: "UPDATE_ALERT_STATUS", count: 12 },
          { action: "CREATE_USER", count: 5 },
        ],
      };
      vi.mocked(auditServiceModule.getAuditLogStatisticsService).mockResolvedValueOnce(mockStats);

      const result = await getAuditLogStatisticsAction();
      expect(result).toEqual(mockStats);
    });
  });
});
