import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getIntegrationConfigsAction,
  updateIntegrationConfigAction,
  testIntegrationConnectionAction,
} from "../actions/integration.action";
import * as sessionModule from "@/lib/session";
import * as integrationServiceModule from "../services/integration.service";
import * as auditModule from "@/lib/audit";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("../services/integration.service", () => ({
  getIntegrationConfigsService: vi.fn(),
  getIntegrationConfigByTypeService: vi.fn(),
  upsertIntegrationConfigService: vi.fn(),
  testIntegrationConnectionService: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

type MockSessionReturn = Awaited<ReturnType<typeof sessionModule.getSession>>;

describe("Phase 6 Admin: System Integrations (LMS & SIS)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Phân quyền RBAC cho Cấu hình Tích hợp", () => {
    it("Chặn người dùng không phải ADMIN truy cập cấu hình tích hợp", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "QLDT001", role: "TRAINING_OFFICER" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(getIntegrationConfigsAction()).rejects.toThrow(
        "Chỉ Quản trị viên hệ thống (ADMIN) mới có quyền cấu hình tích hợp"
      );
    });

    it("ADMIN lấy danh sách cấu hình và đảm bảo thông tin bí mật đã được che mờ", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockConfigs = [
        {
          id: "cfg-1",
          systemType: "SIS" as const,
          name: "Hệ thống SIS",
          baseUrl: "https://sis.ctuet.edu.vn/api/v1",
          apiKey: "sis-client-key",
          apiSecretMasked: "••••••••••••••••", // Che mờ an toàn
          hasApiSecret: true,
          isEnabled: true,
          syncSchedule: "0 2 * * *",
          lastSyncAt: new Date(),
          configJson: null,
          updatedBy: "SYSTEM",
          updatedAt: new Date(),
        },
      ];
      vi.mocked(integrationServiceModule.getIntegrationConfigsService).mockResolvedValueOnce(
        mockConfigs
      );

      const result = await getIntegrationConfigsAction();
      expect(result).toEqual(mockConfigs);
      expect(result[0].apiSecretMasked).toBe("••••••••••••••••");
      // @ts-expect-error apiSecret không được trả về
      expect(result[0].apiSecret).toBeUndefined();
    });
  });

  describe("2. Cập nhật Cấu hình & Ghi nhận Audit Log", () => {
    it("Cập nhật thông số kết nối LMS Moodle thành công và ghi Audit Log", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockUpdated = {
        id: "cfg-moodle",
        systemType: "LMS_MOODLE",
        name: "Moodle Đại học Kỹ thuật Công nghệ Cần Thơ",
        baseUrl: "https://lms.ctuet.edu.vn/webservice/rest/server.php",
        isEnabled: true,
        syncSchedule: "0 */4 * * *",
        updatedAt: new Date(),
      };
      vi.mocked(integrationServiceModule.upsertIntegrationConfigService).mockResolvedValueOnce(
        mockUpdated
      );

      const result = await updateIntegrationConfigAction({
        systemType: "LMS_MOODLE",
        name: "Moodle Đại học Kỹ thuật Công nghệ Cần Thơ",
        baseUrl: "https://lms.ctuet.edu.vn/webservice/rest/server.php",
        apiKey: "new-token",
        isEnabled: true,
        syncSchedule: "0 */4 * * *",
      });

      expect(result).toEqual(mockUpdated);
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "ADMIN001",
          action: "UPDATE_SYSTEM_INTEGRATION",
          targetEntity: "SystemIntegrationConfig",
          targetId: "LMS_MOODLE",
        })
      );
    });
  });

  describe("3. Kiểm tra Kết nối Ngoại vi (Test Connection)", () => {
    it("Test connection thành công và ghi nhận nhật ký kiểm toán", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockTestRes = {
        success: true,
        message: "Kết nối thành công tới SIS (sis.ctuet.edu.vn). Phản hồi HTTP 200 OK.",
        latencyMs: 45,
        timestamp: new Date().toISOString(),
      };
      vi.mocked(integrationServiceModule.testIntegrationConnectionService).mockResolvedValueOnce(
        mockTestRes
      );

      const result = await testIntegrationConnectionAction({
        systemType: "SIS",
      });

      expect(result).toEqual(mockTestRes);
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "ADMIN001",
          action: "TEST_SYSTEM_INTEGRATION_CONNECTION",
          targetEntity: "SystemIntegrationConfig",
          targetId: "SIS",
        })
      );
    });
  });
});
