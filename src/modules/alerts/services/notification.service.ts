/**
 * Notification Service — Quản lý điểm phát sinh thông báo và chống trùng theo Severity.
 * Tuân thủ nghiêm ngặt skill notification-dispatch và quy định 06-security.md.
 */

import { prisma } from "@/lib/prisma";
import { redisConnection, sendNotificationsQueue } from "@/lib/queue";
import type { NotificationChannel, Severity } from "@/generated/prisma/client";

export interface DispatchNotificationParams {
  alertId: string;
  studentId: string;
  ruleCode: string;
  severity: Severity;
  recipientId: string;
  recipientEmail?: string;
  recipientName?: string;
  channel?: NotificationChannel;
  title?: string;
  message?: string;
}

export interface DispatchNotificationResult {
  notificationId?: string;
  status: "QUEUED" | "SUPPRESSED_DUPLICATE" | "SKIPPED_LOW_SEVERITY";
  dedupKey: string;
  reason?: string;
}

/**
 * 1. Tính dedupKey = studentId + ruleCode + severity
 */
export function computeDedupKey(studentId: string, ruleCode: string, severity: Severity): string {
  return `${studentId}|${ruleCode}|${severity}`;
}

/**
 * Lấy cửa sổ debounce (tính bằng mili-giây) theo Severity:
 * - CRITICAL: 0ms (gửi ngay lập tức, không giới hạn tần suất)
 * - HIGH: 6 giờ (6 * 3600 * 1000 ms)
 * - MEDIUM: 24 giờ (24 * 3600 * 1000 ms)
 * - LOW: không gửi riêng lẻ
 */
export function getDebounceWindowMs(severity: Severity): number | null {
  switch (severity) {
    case "CRITICAL":
      return 0; // Luôn gửi
    case "HIGH":
      return 6 * 60 * 60 * 1000; // 6 giờ
    case "MEDIUM":
      return 24 * 60 * 60 * 1000; // 24 giờ
    case "LOW":
      return null; // Không gửi riêng lẻ
  }
}

/**
 * Dispatch notification theo chính sách chống gửi trùng
 */
export async function dispatchNotification(
  params: DispatchNotificationParams
): Promise<DispatchNotificationResult> {
  const {
    alertId,
    studentId,
    ruleCode,
    severity,
    recipientId,
    recipientEmail,
    recipientName,
    channel = "EMAIL",
    title,
    message,
  } = params;

  // 1. Mức LOW: không gửi riêng lẻ — chỉ hiển thị trên dashboard
  if (severity === "LOW") {
    return {
      status: "SKIPPED_LOW_SEVERITY",
      dedupKey: computeDedupKey(studentId, ruleCode, severity),
      reason: "LOW severity notifications are only displayed on dashboard",
    };
  }

  const dedupKey = computeDedupKey(studentId, ruleCode, severity);
  const debounceWindowMs = getDebounceWindowMs(severity);

  // 2. Tra cứu debounce window (Redis cache & DB)
  if (debounceWindowMs !== null && debounceWindowMs > 0) {
    const redisKey = `dedup:notif:${dedupKey}`;
    let isSuppressed = false;

    try {
      if (redisConnection && redisConnection.status === "ready") {
        const cached = await redisConnection.get(redisKey);
        if (cached) {
          isSuppressed = true;
        }
      }
    } catch {
      // Redis error fallback to DB check
    }

    if (!isSuppressed) {
      const windowStart = new Date(Date.now() - debounceWindowMs);
      const recentSent = await prisma.notification.findFirst({
        where: {
          dedupKey,
          status: "SENT",
          sentAt: { gte: windowStart },
        },
      });

      if (recentSent) {
        isSuppressed = true;
      }
    }

    // 3. Nếu còn trong cửa sổ debounce -> SUPPRESSED_DUPLICATE
    if (isSuppressed) {
      const suppressedRecord = await prisma.notification.create({
        data: {
          alertId,
          recipientId,
          channel,
          dedupKey,
          status: "SUPPRESSED_DUPLICATE",
          sentAt: null,
        },
      });

      return {
        notificationId: suppressedRecord.notificationId,
        status: "SUPPRESSED_DUPLICATE",
        dedupKey,
        reason: `Suppressed duplicate within ${debounceWindowMs / (60 * 60 * 1000)}h debounce window`,
      };
    }
  }

  // 4. Hợp lệ để gửi -> Tạo bản ghi QUEUED và đẩy vào BullMQ
  const queuedRecord = await prisma.notification.create({
    data: {
      alertId,
      recipientId,
      channel,
      dedupKey,
      status: "QUEUED",
      sentAt: null,
    },
  });

  // Ghi cache Redis nếu có debounce window
  if (debounceWindowMs && debounceWindowMs > 0) {
    try {
      if (redisConnection && redisConnection.status === "ready") {
        const ttlSeconds = Math.ceil(debounceWindowMs / 1000);
        await redisConnection.set(`dedup:notif:${dedupKey}`, "1", "EX", ttlSeconds);
      }
    } catch {
      // Bỏ qua lỗi cache Redis, DB đã có bản ghi
    }
  }

  // Lấy email người nhận nếu chưa có
  let targetEmail = recipientEmail;
  let targetName = recipientName;
  if (!targetEmail) {
    const user = await prisma.user.findUnique({
      where: { userId: recipientId },
      select: { email: true, fullName: true },
    });
    if (user) {
      targetEmail = user.email;
      targetName = targetName || user.fullName;
    }
  }

  // Đẩy job vào BullMQ queue
  try {
    await sendNotificationsQueue.add(
      "send-alert-notification",
      {
        notificationId: queuedRecord.notificationId,
        alertId,
        studentId,
        ruleCode,
        severity,
        recipientId,
        recipientEmail: targetEmail,
        recipientName: targetName,
        channel,
        title: title || `[CTUET-EWARS] Cảnh báo sớm học vụ — Mức độ: ${severity}`,
        message:
          message ||
          `Hệ thống phát hiện dấu hiệu cần lưu ý cho sinh viên ${studentId} theo quy tắc ${ruleCode}.`,
        isCritical: severity === "CRITICAL",
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    );
  } catch (error) {
    console.error(`[Notification] Failed to enqueue BullMQ job:`, error);
  }

  return {
    notificationId: queuedRecord.notificationId,
    status: "QUEUED",
    dedupKey,
  };
}

/**
 * 5. Suppress mọi Notification QUEUED còn lại khi Alert được RESOLVED
 */
export async function suppressQueuedNotificationsForAlert(alertId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      alertId,
      status: "QUEUED",
    },
    data: {
      status: "SUPPRESSED_DUPLICATE",
    },
  });

  return result.count;
}
