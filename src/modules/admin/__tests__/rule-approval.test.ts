import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listPendingRuleVersionsAction,
  approveRuleVersionAction,
  rejectRuleVersionAction,
} from "../actions/rule-approval.action";
import * as ruleApprovalServiceModule from "../services/rule-approval.service";
import * as sessionModule from "@/lib/session";
import * as auditModule from "@/lib/audit";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("../services/rule-approval.service", () => ({
  listPendingRuleVersionsService: vi.fn(),
  approveRuleVersionService: vi.fn(),
  rejectRuleVersionService: vi.fn(),
  getRuleVersionDiffService: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

type MockSessionReturn = Awaited<ReturnType<typeof sessionModule.getSession>>;

describe("Phase 6 Admin: Rule Version Approval & Separation of Duties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Phân quyền RBAC cho Duyệt Luật", () => {
    it("Chặn người dùng vai trò STUDENT hoặc ADVISOR phê duyệt luật", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "B2101001", role: "STUDENT" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(
        approveRuleVersionAction({
          ruleCode: "HR-ATT-01",
          version: 2,
        })
      ).rejects.toThrow(
        "Chỉ Cán bộ quản lý đào tạo hoặc Quản trị viên mới có thẩm quyền phê duyệt luật"
      );

      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "GV001", role: "ADVISOR" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(
        approveRuleVersionAction({
          ruleCode: "HR-ATT-01",
          version: 2,
        })
      ).rejects.toThrow(
        "Chỉ Cán bộ quản lý đào tạo hoặc Quản trị viên mới có thẩm quyền phê duyệt luật"
      );
    });

    it("Cho phép TRAINING_OFFICER lấy danh sách luật chờ duyệt", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "QLDT001", role: "TRAINING_OFFICER" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      vi.mocked(ruleApprovalServiceModule.listPendingRuleVersionsService).mockResolvedValueOnce([]);

      const result = await listPendingRuleVersionsAction({});
      expect(result).toEqual([]);
      expect(ruleApprovalServiceModule.listPendingRuleVersionsService).toHaveBeenCalled();
    });
  });

  describe("2. Ràng buộc Phân chia Nhiệm vụ (Separation of Duties)", () => {
    it("CHẶN cán bộ cấu hình tự phê duyệt phiên bản do chính mình tạo ra", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "QLDT001", userId: "QLDT001", role: "TRAINING_OFFICER" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      // Giả lập service ném lỗi Separation of Duties khi phát hiện configuredBy === approverId
      vi.mocked(ruleApprovalServiceModule.approveRuleVersionService).mockRejectedValueOnce(
        new Error(
          "Cán bộ cấu hình luật không được tự phê duyệt phiên bản do chính mình tạo (Vi phạm nguyên tắc Separation of Duties)"
        )
      );

      await expect(
        approveRuleVersionAction({
          ruleCode: "HR-ATT-01",
          version: 2,
        })
      ).rejects.toThrow(
        "Cán bộ cấu hình luật không được tự phê duyệt phiên bản do chính mình tạo (Vi phạm nguyên tắc Separation of Duties)"
      );

      expect(auditModule.writeAuditLog).not.toHaveBeenCalled();
    });

    it("Cho phép cán bộ khác phê duyệt, chuyển trạng thái ACTIVE và ghi nhận Audit Log", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "QLDT002", userId: "QLDT002", role: "TRAINING_OFFICER" }, // Người duyệt khác với người tạo
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockApproved = {
        id: "v2-uuid",
        ruleCode: "HR-ATT-01",
        version: 2,
        status: "ACTIVE" as const,
        severity: "HIGH" as const,
        configuredBy: "QLDT001",
        approvedBy: "QLDT002",
        effectiveFrom: new Date(),
        effectiveTo: null,
        condition: { consecutiveDays: 4 },
        action: {},
        rule: { ruleCode: "HR-ATT-01", ruleName: "Vắng liên tiếp" },
      };
      vi.mocked(ruleApprovalServiceModule.approveRuleVersionService).mockResolvedValueOnce(
        mockApproved as unknown as Awaited<
          ReturnType<typeof ruleApprovalServiceModule.approveRuleVersionService>
        >
      );

      const result = await approveRuleVersionAction({
        ruleCode: "HR-ATT-01",
        version: 2,
        note: "Đã họp thống nhất nâng ngưỡng vắng liên tiếp lên 4 buổi",
      });

      expect(result).toEqual(mockApproved);
      expect(ruleApprovalServiceModule.approveRuleVersionService).toHaveBeenCalledWith(
        {
          ruleCode: "HR-ATT-01",
          version: 2,
          note: "Đã họp thống nhất nâng ngưỡng vắng liên tiếp lên 4 buổi",
        },
        "QLDT002"
      );
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "QLDT002",
          action: "APPROVE_RULE_VERSION",
          targetEntity: "RuleVersion",
          targetId: "HR-ATT-01@v2",
        })
      );
    });
  });

  describe("3. Từ chối phê duyệt (Reject)", () => {
    it("Từ chối phiên bản luật với lý do cụ thể và ghi nhận Audit Log", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", userId: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockRejected = {
        id: "v2-uuid",
        ruleCode: "HR-LMS-01",
        version: 2,
        status: "INACTIVE" as const,
        severity: "MEDIUM" as const,
        configuredBy: "QLDT001",
        approvedBy: null,
        effectiveFrom: new Date(),
        effectiveTo: null,
        condition: {},
        action: {},
        rule: { ruleCode: "HR-LMS-01", ruleName: "LMS Inactive" },
        rejectReason: "Ngưỡng 7 ngày quá chặt đối với các học phần tự học",
        rejectedBy: "ADMIN001",
      };
      vi.mocked(ruleApprovalServiceModule.rejectRuleVersionService).mockResolvedValueOnce(
        mockRejected as unknown as Awaited<
          ReturnType<typeof ruleApprovalServiceModule.rejectRuleVersionService>
        >
      );

      const result = await rejectRuleVersionAction({
        ruleCode: "HR-LMS-01",
        version: 2,
        reason: "Ngưỡng 7 ngày quá chặt đối với các học phần tự học",
      });

      expect(result).toEqual(mockRejected);
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "ADMIN001",
          action: "REJECT_RULE_VERSION",
          targetEntity: "RuleVersion",
          targetId: "HR-LMS-01@v2",
        })
      );
    });
  });
});
