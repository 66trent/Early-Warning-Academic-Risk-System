import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isTransitionAllowed,
  acknowledgeAlert,
  startProgressAlert,
  resolveAlert,
  dismissAlert,
  reopenAlert,
  invalidateAlert,
  AlertLifecycleError,
  type ActorContext,
} from "../services/alert-lifecycle.service";
import * as notificationModule from "../services/notification.service";
import * as auditModule from "@/lib/audit";

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("../services/notification.service", () => ({
  suppressQueuedNotificationsForAlert: vi.fn().mockResolvedValue(2),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alert: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    intervention: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

type MockAlertFindUnique = Awaited<ReturnType<typeof prisma.alert.findUnique>>;
type MockAlertUpdate = Awaited<ReturnType<typeof prisma.alert.update>>;

describe("Phase 4 — Alert Lifecycle Finite State Machine (Skill alert-lifecycle-transition)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdvisor: ActorContext = {
    id: "GV001",
    userId: "GV001",
    role: "ADVISOR",
    fullName: "ThS. Nguyễn Văn A",
    email: "nguyenvana@ctuet.edu.vn",
  };

  const mockOtherAdvisor: ActorContext = {
    id: "GV002",
    userId: "GV002",
    role: "ADVISOR",
    fullName: "TS. Trần Thị B",
    email: "tranthib@ctuet.edu.vn",
  };

  const mockAdmin: ActorContext = {
    id: "ADMIN001",
    userId: "ADMIN001",
    role: "ADMIN",
    fullName: "Quản trị viên",
    email: "admin@ctuet.edu.vn",
  };

  const baseAlert = {
    alertId: "11111111-1111-4111-8111-111111111111",
    studentId: "B210001",
    termId: "HK1_2627",
    severity: "HIGH" as const,
    status: "OPEN" as const,
    firstDetectedAt: new Date("2026-09-10T08:00:00Z"),
    lastDetectedAt: new Date("2026-09-10T08:00:00Z"),
    assignedAdvisorId: "GV001",
    interventions: [],
    student: {
      studentId: "B210001",
      fullName: "Nguyễn Văn Sinh Viên",
      advisorId: "GV001",
    },
  };

  describe("1. State Transition Matrix (isTransitionAllowed)", () => {
    it("Cho phép các transition hợp lệ theo sơ đồ", () => {
      expect(isTransitionAllowed("OPEN", "ACKNOWLEDGED")).toBe(true);
      expect(isTransitionAllowed("ACKNOWLEDGED", "IN_PROGRESS")).toBe(true);
      expect(isTransitionAllowed("ACKNOWLEDGED", "DISMISSED")).toBe(true);
      expect(isTransitionAllowed("IN_PROGRESS", "RESOLVED")).toBe(true);
      expect(isTransitionAllowed("IN_PROGRESS", "DISMISSED")).toBe(true);
      expect(isTransitionAllowed("RESOLVED", "REOPENED")).toBe(true);
      expect(isTransitionAllowed("DISMISSED", "REOPENED")).toBe(true);
      expect(isTransitionAllowed("REOPENED", "ACKNOWLEDGED")).toBe(true);

      // Bất kỳ trạng thái nào cũng có thể INVALIDATED
      expect(isTransitionAllowed("OPEN", "INVALIDATED")).toBe(true);
      expect(isTransitionAllowed("ACKNOWLEDGED", "INVALIDATED")).toBe(true);
      expect(isTransitionAllowed("IN_PROGRESS", "INVALIDATED")).toBe(true);
      expect(isTransitionAllowed("RESOLVED", "INVALIDATED")).toBe(true);
      expect(isTransitionAllowed("DISMISSED", "INVALIDATED")).toBe(true);
    });

    it("Chặn tuyệt đối các transition KHÔNG có trong sơ đồ", () => {
      // OPEN không được nhảy cóc sang RESOLVED hoặc DISMISSED
      expect(isTransitionAllowed("OPEN", "RESOLVED")).toBe(false);
      expect(isTransitionAllowed("OPEN", "DISMISSED")).toBe(false);
      expect(isTransitionAllowed("OPEN", "IN_PROGRESS")).toBe(false);

      // ACKNOWLEDGED không thể trực tiếp RESOLVED nếu chưa IN_PROGRESS
      expect(isTransitionAllowed("ACKNOWLEDGED", "RESOLVED")).toBe(false);

      // RESOLVED không thể trực tiếp về OPEN hoặc IN_PROGRESS
      expect(isTransitionAllowed("RESOLVED", "OPEN")).toBe(false);
      expect(isTransitionAllowed("RESOLVED", "IN_PROGRESS")).toBe(false);
      expect(isTransitionAllowed("RESOLVED", "ACKNOWLEDGED")).toBe(false);

      // DISMISSED không thể trực tiếp RESOLVED
      expect(isTransitionAllowed("DISMISSED", "RESOLVED")).toBe(false);

      // INVALIDATED là trạng thái kết thúc, không thể đi tiếp
      expect(isTransitionAllowed("INVALIDATED", "OPEN")).toBe(false);
      expect(isTransitionAllowed("INVALIDATED", "ACKNOWLEDGED")).toBe(false);
    });
  });

  describe("2. Transition: OPEN → ACKNOWLEDGED", () => {
    it("CVHT được phân công xác nhận cảnh báo thành công và ghi Audit Log", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "OPEN",
      } as unknown as MockAlertFindUnique);

      vi.mocked(prisma.alert.update).mockResolvedValueOnce({
        ...baseAlert,
        status: "ACKNOWLEDGED",
      } as unknown as MockAlertUpdate);

      const result = await acknowledgeAlert(baseAlert.alertId, mockAdvisor);

      expect(result.status).toBe("ACKNOWLEDGED");
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { alertId: baseAlert.alertId },
        data: { status: "ACKNOWLEDGED" },
      });
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "GV001",
          action: "ALERT_STATUS_ACKNOWLEDGED",
          targetEntity: "Alert",
          targetId: baseAlert.alertId,
        })
      );
    });

    it("Chặn CVHT khác không phụ trách sinh viên xác nhận cảnh báo", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "OPEN",
        assignedAdvisorId: "GV001",
        student: { ...baseAlert.student, advisorId: "GV001" },
      } as unknown as MockAlertFindUnique);

      await expect(acknowledgeAlert(baseAlert.alertId, mockOtherAdvisor)).rejects.toThrow(
        /Chỉ Cố vấn học tập được phân công phụ trách/
      );
    });
  });

  describe("3. Transition: ACKNOWLEDGED → IN_PROGRESS", () => {
    it("Chuyển sang IN_PROGRESS thành công khi alert đang ACKNOWLEDGED", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "ACKNOWLEDGED",
      } as unknown as MockAlertFindUnique);

      vi.mocked(prisma.alert.update).mockResolvedValueOnce({
        ...baseAlert,
        status: "IN_PROGRESS",
      } as unknown as MockAlertUpdate);

      const result = await startProgressAlert(baseAlert.alertId, mockAdvisor);
      expect(result.status).toBe("IN_PROGRESS");
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ALERT_STATUS_IN_PROGRESS",
        })
      );
    });

    it("Chặn chuyển sang IN_PROGRESS nếu alert đang ở trạng thái OPEN", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "OPEN",
      } as unknown as MockAlertFindUnique);

      await expect(startProgressAlert(baseAlert.alertId, mockAdvisor)).rejects.toThrow(
        AlertLifecycleError
      );
    });
  });

  describe("4. Transition: IN_PROGRESS → RESOLVED", () => {
    it("Đóng cảnh báo (RESOLVED) thành công khi có can thiệp và suppress queued notifications", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "IN_PROGRESS",
        interventions: [
          {
            interventionId: "int-1",
            alertId: baseAlert.alertId,
            type: "PHONE_CALL",
            content: "Đã liên hệ sinh viên trao đổi",
            performedAt: new Date(),
          },
        ],
      } as unknown as MockAlertFindUnique);

      vi.mocked(prisma.alert.update).mockResolvedValueOnce({
        ...baseAlert,
        status: "RESOLVED",
      } as unknown as MockAlertUpdate);

      const result = await resolveAlert(
        baseAlert.alertId,
        mockAdvisor,
        "Sinh viên cam kết đi học đầy đủ"
      );

      expect(result.status).toBe("RESOLVED");
      expect(notificationModule.suppressQueuedNotificationsForAlert).toHaveBeenCalledWith(
        baseAlert.alertId
      );
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ALERT_STATUS_RESOLVED",
        })
      );
    });

    it("RÀNG BUỘC: Chặn RESOLVED nếu chưa có can thiệp (0 interventions)", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "IN_PROGRESS",
        interventions: [], // Không có can thiệp nào
      } as unknown as MockAlertFindUnique);

      await expect(resolveAlert(baseAlert.alertId, mockAdvisor)).rejects.toThrow(
        /Cảnh báo cần có ít nhất 1 hoạt động can thiệp/
      );
    });
  });

  describe("5. Transition: DISMISSED", () => {
    it("Bác bỏ cảnh báo kèm lý do bắt buộc và tạo bản ghi can thiệp ghi chú", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "ACKNOWLEDGED",
      } as unknown as MockAlertFindUnique);

      vi.mocked(prisma.alert.update).mockResolvedValueOnce({
        ...baseAlert,
        status: "DISMISSED",
      } as unknown as MockAlertUpdate);

      const reason = "Sinh viên đã có đơn xin nghỉ phép hợp lệ được khoa phê duyệt";
      const result = await dismissAlert(baseAlert.alertId, mockAdvisor, reason);

      expect(result.status).toBe("DISMISSED");
      expect(prisma.intervention.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertId: baseAlert.alertId,
          type: "OTHER",
          content: `Bác bỏ cảnh báo: ${reason}`,
          status: "DISMISSED",
        }),
      });
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ALERT_STATUS_DISMISSED",
        })
      );
    });

    it("RÀNG BUỘC: Chặn DISMISSED nếu lý do để trống hoặc quá ngắn (< 5 ký tự)", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "ACKNOWLEDGED",
      } as unknown as MockAlertFindUnique);

      await expect(dismissAlert(baseAlert.alertId, mockAdvisor, "abc")).rejects.toThrow(
        /Bắt buộc phải cung cấp lý do bác bỏ cảnh báo/
      );
    });
  });

  describe("6. Transition: REOPENED", () => {
    it("Mở lại cảnh báo đã RESOLVED: Cập nhật lastDetectedAt, giữ nguyên firstDetectedAt gốc", async () => {
      const originalFirstDetected = new Date("2026-09-10T08:00:00Z");

      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "RESOLVED",
        firstDetectedAt: originalFirstDetected,
      } as unknown as MockAlertFindUnique);

      vi.mocked(prisma.alert.update).mockResolvedValueOnce({
        ...baseAlert,
        status: "REOPENED",
        firstDetectedAt: originalFirstDetected,
        lastDetectedAt: new Date(),
      } as unknown as MockAlertUpdate);

      const result = await reopenAlert(
        baseAlert.alertId,
        mockAdvisor,
        "Sinh viên tiếp tục tái diễn vắng học sau 2 tuần"
      );

      expect(result.status).toBe("REOPENED");
      expect(result.firstDetectedAt).toEqual(originalFirstDetected);
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { alertId: baseAlert.alertId },
        data: expect.objectContaining({
          status: "REOPENED",
          lastDetectedAt: expect.any(Date),
        }),
      });
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ALERT_STATUS_REOPENED",
        })
      );
    });
  });

  describe("7. Transition: INVALIDATED", () => {
    it("ADMIN vô hiệu hóa cảnh báo khi dữ liệu nguồn bị sửa", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "OPEN",
      } as unknown as MockAlertFindUnique);

      vi.mocked(prisma.alert.update).mockResolvedValueOnce({
        ...baseAlert,
        status: "INVALIDATED",
      } as unknown as MockAlertUpdate);

      const result = await invalidateAlert(
        baseAlert.alertId,
        mockAdmin,
        "Giảng viên điểm danh nhầm và đã cập nhật lại file điểm danh"
      );

      expect(result.status).toBe("INVALIDATED");
      expect(notificationModule.suppressQueuedNotificationsForAlert).toHaveBeenCalledWith(
        baseAlert.alertId
      );
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ALERT_STATUS_INVALIDATED",
        })
      );
    });

    it("Chặn CVHT thông thường tự tiện vô hiệu hóa cảnh báo", async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValueOnce({
        ...baseAlert,
        status: "OPEN",
      } as unknown as MockAlertFindUnique);

      await expect(
        invalidateAlert(baseAlert.alertId, mockAdvisor, "CVHT muốn hủy cảnh báo này")
      ).rejects.toThrow(/Chỉ Quản trị viên hệ thống hoặc quy trình tự động/);
    });
  });
});
