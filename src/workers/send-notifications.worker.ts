/**
 * BullMQ Worker: send-notifications
 * Nhận job từ queue SEND_NOTIFICATIONS, gửi email qua Nodemailer và cập nhật trạng thái bản ghi Notification.
 */

import { Worker, type Job } from "bullmq";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma";
import { QUEUE_NAMES, redisConnection } from "../lib/queue";

// Cấu hình transporter Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT) || 1025, // Mặc định 1025 cho MailHog
  secure: false,
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
});

export interface NotificationJobData {
  notificationId: string;
  alertId: string;
  studentId: string;
  ruleCode: string;
  severity: string;
  recipientId: string;
  recipientEmail?: string;
  recipientName?: string;
  channel: string;
  title: string;
  message: string;
  isCritical?: boolean;
}

export async function processNotificationJob(job: Job<NotificationJobData>) {
  const {
    notificationId,
    recipientEmail,
    recipientName = "Quý Thầy/Cô",
    title,
    message,
    severity,
    isCritical,
  } = job.data;

  console.log(`[send-notifications] Xử lý thông báo #${notificationId} gửi đến ${recipientEmail}`);

  try {
    if (recipientEmail) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background-color: ${isCritical ? "#dc2626" : "#2563eb"}; color: #ffffff; padding: 16px 24px;">
            <h2 style="margin: 0; font-size: 18px;">HỆ THỐNG CẢNH BÁO SỚM HỌC VỤ (CTUET-EWARS)</h2>
          </div>
          
          <div style="padding: 24px;">
            <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Kính gửi ${recipientName},</p>
            <p>${message}</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid ${isCritical ? "#dc2626" : "#f59e0b"}; padding: 12px 16px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px;"><strong>Mức độ ưu tiên:</strong> <span style="color: ${isCritical ? "#dc2626" : "#b45309"}; font-weight: bold;">${severity}</span></p>
              ${
                isCritical
                  ? '<p style="margin: 8px 0 0 0; font-size: 14px; color: #b91c1c;"><strong>Khuyến nghị CVHT:</strong> Vui lòng ưu tiên liên hệ trực tiếp (gọi điện thoại hoặc gặp mặt) với sinh viên trong vòng 24 giờ tới.</p>'
                  : ""
              }
            </div>

            <p style="font-size: 14px; color: #4b5563;">
              Quý Thầy/Cô vui lòng đăng nhập vào hệ thống CTUET-EWARS để xem đầy đủ thông tin chi tiết và ghi nhận phương án can thiệp hỗ trợ.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            
            <p style="font-size: 12px; color: #6b7280; font-style: italic; margin-bottom: 0;">
              * Lưu ý quan trọng: Đây là cảnh báo sớm mang tính tham khảo từ hệ thống nhằm hỗ trợ cố vấn học tập, không phải quyết định học vụ chính thức.
            </p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"CTUET EWARS" <ewars-no-reply@ctuet.edu.vn>',
        to: recipientEmail,
        subject: title,
        html: emailHtml,
      });
    }

    // Cập nhật trạng thái bản ghi Notification sang SENT
    await prisma.notification.update({
      where: { notificationId },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    console.log(`[send-notifications] Đã gửi thành công thông báo #${notificationId}`);
    return { success: true, notificationId };
  } catch (error) {
    console.error(`[send-notifications] Lỗi khi gửi thông báo #${notificationId}:`, error);

    // Cập nhật trạng thái bản ghi Notification sang FAILED
    await prisma.notification.update({
      where: { notificationId },
      data: {
        status: "FAILED",
      },
    });

    throw error;
  }
}

export const sendNotificationsWorker = new Worker(
  QUEUE_NAMES.SEND_NOTIFICATIONS,
  processNotificationJob,
  { connection: redisConnection, concurrency: 5 }
);
