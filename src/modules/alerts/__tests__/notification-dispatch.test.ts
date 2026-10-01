import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeDedupKey,
  getDebounceWindowMs,
  dispatchNotification,
  suppressQueuedNotificationsForAlert,
  type DispatchNotificationParams,
} from "../services/notification.service";

vi.mock("@/lib/queue", () => ({
  redisConnection: {
    status: "ready",
    get: vi.fn(),
    set: vi.fn(),
  },
  sendNotificationsQueue: {
    add: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendNotificationsQueue, redisConnection } from "@/lib/queue";

type MockNotificationCreate = Awaited<ReturnType<typeof prisma.notification.create>>;

describe("Phase 4 — Notification Dispatch & Dedup Policy (Skill notification-dispatch & 06-security.md)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams: DispatchNotificationParams = {
    alertId: "alert-uuid-001",
    studentId: "B210001",
    ruleCode: "HR-ATT-01",
    severity: "HIGH",
    recipientId: "GV001",
    recipientEmail: "nguyenvana@ctuet.edu.vn",
    recipientName: "ThS. Nguyễn Văn A",
  };

  describe("1. Deduplication Key Formula", () => {
    it("Tính dedupKey = studentId + ruleCode + severity đúng chuẩn", () => {
      const key = computeDedupKey("B210001", "HR-ATT-01", "HIGH");
      expect(key).toBe("B210001|HR-ATT-01|HIGH");
    });
  });

  describe("2. Debounce Window by Severity", () => {
    it("Trả về đúng cửa sổ debounce theo quy định 06-security.md", () => {
      expect(getDebounceWindowMs("CRITICAL")).toBe(0); // Luôn gửi ngay
      expect(getDebounceWindowMs("HIGH")).toBe(6 * 60 * 60 * 1000); // 6 giờ
      expect(getDebounceWindowMs("MEDIUM")).toBe(24 * 60 * 60 * 1000); // 24 giờ
      expect(getDebounceWindowMs("LOW")).toBeNull(); // Không gửi riêng lẻ
    });
  });

  describe("3. Dispatch Notification Execution & Dedup Suppression", () => {
    it("Mức LOW: Không gửi riêng lẻ, chỉ hiển thị trên dashboard", async () => {
      const result = await dispatchNotification({
        ...baseParams,
        severity: "LOW",
      });

      expect(result.status).toBe("SKIPPED_LOW_SEVERITY");
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(sendNotificationsQueue.add).not.toHaveBeenCalled();
    });

    it("Mức CRITICAL: Luôn gửi ngay lập tức, không bị debounce chặn", async () => {
      vi.mocked(prisma.notification.create).mockResolvedValueOnce({
        notificationId: "notif-critical-1",
        alertId: baseParams.alertId,
        recipientId: baseParams.recipientId,
        channel: "EMAIL",
        dedupKey: "B210001|HR-ATT-02|CRITICAL",
        status: "QUEUED",
        sentAt: null,
        createdAt: new Date(),
      } as unknown as MockNotificationCreate);

      const result = await dispatchNotification({
        ...baseParams,
        ruleCode: "HR-ATT-02",
        severity: "CRITICAL",
      });

      expect(result.status).toBe("QUEUED");
      expect(sendNotificationsQueue.add).toHaveBeenCalledWith(
        "send-alert-notification",
        expect.objectContaining({
          isCritical: true,
          severity: "CRITICAL",
        }),
        expect.any(Object)
      );
    });

    it("Mức HIGH: Lần đầu gửi hợp lệ → trạng thái QUEUED và đẩy vào BullMQ queue", async () => {
      vi.mocked(redisConnection.get).mockResolvedValueOnce(null);
      vi.mocked(prisma.notification.findFirst).mockResolvedValueOnce(null);

      vi.mocked(prisma.notification.create).mockResolvedValueOnce({
        notificationId: "notif-high-1",
        alertId: baseParams.alertId,
        recipientId: baseParams.recipientId,
        channel: "EMAIL",
        dedupKey: "B210001|HR-ATT-01|HIGH",
        status: "QUEUED",
        sentAt: null,
        createdAt: new Date(),
      } as unknown as MockNotificationCreate);

      const result = await dispatchNotification(baseParams);

      expect(result.status).toBe("QUEUED");
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "QUEUED",
          dedupKey: "B210001|HR-ATT-01|HIGH",
        }),
      });
      expect(sendNotificationsQueue.add).toHaveBeenCalledTimes(1);
    });

    it("TEST DEDUP: Gửi lần 2 trong cửa sổ debounce → bị SUPPRESSED_DUPLICATE và KHÔNG gọi Nodemailer/BullMQ", async () => {
      // Giả lập Redis cache hoặc DB có thông báo SENT trong vòng 6 giờ gần nhất
      vi.mocked(redisConnection.get).mockResolvedValueOnce("1");

      vi.mocked(prisma.notification.create).mockResolvedValueOnce({
        notificationId: "notif-high-dup",
        alertId: baseParams.alertId,
        recipientId: baseParams.recipientId,
        channel: "EMAIL",
        dedupKey: "B210001|HR-ATT-01|HIGH",
        status: "SUPPRESSED_DUPLICATE",
        sentAt: null,
        createdAt: new Date(),
      } as unknown as MockNotificationCreate);

      const result = await dispatchNotification(baseParams);

      expect(result.status).toBe("SUPPRESSED_DUPLICATE");
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "SUPPRESSED_DUPLICATE",
        }),
      });
      // BẮT BUỘC: KHÔNG đẩy job gửi email vào queue
      expect(sendNotificationsQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("4. Suppress Queued Notifications When Alert is Resolved", () => {
    it("Hủy toàn bộ thông báo đang QUEUED khi Alert đã được giải quyết", async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 2 });

      const count = await suppressQueuedNotificationsForAlert("alert-uuid-001");

      expect(count).toBe(2);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          alertId: "alert-uuid-001",
          status: "QUEUED",
        },
        data: {
          status: "SUPPRESSED_DUPLICATE",
        },
      });
    });
  });
});
