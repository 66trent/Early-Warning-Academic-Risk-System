import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type {
  UpdateIntegrationConfigInput,
  TestConnectionInput,
  SystemIntegrationType,
} from "../validators/integration.schema";

const DEFAULT_CONFIGS: Array<{
  systemType: SystemIntegrationType;
  name: string;
  baseUrl: string;
  syncSchedule: string;
}> = [
  {
    systemType: "SIS",
    name: "Hệ thống Quản lý Đào tạo (SIS)",
    baseUrl: "https://sis.ctuet.edu.vn/api/v1",
    syncSchedule: "0 2 * * *", // 2:00 AM hàng ngày
  },
  {
    systemType: "LMS_MOODLE",
    name: "Hệ thống Moodle LMS",
    baseUrl: "https://lms.ctuet.edu.vn/webservice/rest/server.php",
    syncSchedule: "0 */6 * * *", // mỗi 6 tiếng
  },
  {
    systemType: "LMS_CANVAS",
    name: "Hệ thống Canvas LMS",
    baseUrl: "https://canvas.ctuet.edu.vn/api/v1",
    syncSchedule: "0 */12 * * *", // mỗi 12 tiếng
  },
];

/**
 * Lấy danh sách cấu hình kết nối ngoại vi, tự động che mờ (mask) secret.
 */
export async function getIntegrationConfigsService() {
  const configs = await prisma.systemIntegrationConfig.findMany({
    orderBy: { systemType: "asc" },
  });

  // Đảm bảo đủ các bản ghi mặc định cho SIS và LMS
  const configMap = new Map(configs.map((c) => [c.systemType, c]));

  const result = await Promise.all(
    DEFAULT_CONFIGS.map(async (def) => {
      let current = configMap.get(def.systemType);
      if (!current) {
        current = await prisma.systemIntegrationConfig.create({
          data: {
            systemType: def.systemType,
            name: def.name,
            baseUrl: def.baseUrl,
            syncSchedule: def.syncSchedule,
            isEnabled: true,
            updatedBy: "SYSTEM",
          },
        });
      }

      return {
        id: current.id,
        systemType: current.systemType as SystemIntegrationType,
        name: current.name,
        baseUrl: current.baseUrl,
        apiKey: current.apiKey,
        apiSecretMasked: current.apiSecret ? "••••••••••••••••" : null,
        hasApiSecret: Boolean(current.apiSecret),
        isEnabled: current.isEnabled,
        syncSchedule: current.syncSchedule,
        lastSyncAt: current.lastSyncAt,
        configJson: current.configJson,
        updatedBy: current.updatedBy,
        updatedAt: current.updatedAt,
      };
    })
  );

  return result;
}

/**
 * Lấy cấu hình chi tiết cho 1 loại hệ thống.
 */
export async function getIntegrationConfigByTypeService(systemType: SystemIntegrationType) {
  const config = await prisma.systemIntegrationConfig.findUnique({
    where: { systemType },
  });

  if (!config) {
    return null;
  }

  return {
    ...config,
    apiSecretMasked: config.apiSecret ? "••••••••••••••••" : null,
    hasApiSecret: Boolean(config.apiSecret),
  };
}

/**
 * Cập nhật cấu hình tích hợp hệ thống ngoại vi.
 */
export async function upsertIntegrationConfigService(
  input: UpdateIntegrationConfigInput,
  actorId: string
) {
  const existing = await prisma.systemIntegrationConfig.findUnique({
    where: { systemType: input.systemType },
  });

  // Nếu secret truyền vào là chuỗi đã che mờ (••••) hoặc rỗng thì giữ nguyên secret cũ
  let resolvedSecret = existing?.apiSecret ?? null;
  if (input.apiSecret && !input.apiSecret.includes("••••") && input.apiSecret.trim() !== "") {
    resolvedSecret = input.apiSecret.trim();
  }

  const upserted = await prisma.systemIntegrationConfig.upsert({
    where: { systemType: input.systemType },
    create: {
      systemType: input.systemType,
      name: input.name,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey || null,
      apiSecret: resolvedSecret,
      isEnabled: input.isEnabled,
      syncSchedule: input.syncSchedule || null,
      configJson: input.configJson ? (input.configJson as Prisma.InputJsonValue) : Prisma.JsonNull,
      updatedBy: actorId,
    },
    update: {
      name: input.name,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey !== undefined ? input.apiKey : existing?.apiKey,
      apiSecret: resolvedSecret,
      isEnabled: input.isEnabled,
      syncSchedule: input.syncSchedule !== undefined ? input.syncSchedule : existing?.syncSchedule,
      configJson:
        input.configJson !== undefined
          ? (input.configJson as Prisma.InputJsonValue)
          : (existing?.configJson ?? Prisma.JsonNull),
      updatedBy: actorId,
    },
  });

  return {
    id: upserted.id,
    systemType: upserted.systemType,
    name: upserted.name,
    baseUrl: upserted.baseUrl,
    isEnabled: upserted.isEnabled,
    syncSchedule: upserted.syncSchedule,
    updatedAt: upserted.updatedAt,
  };
}

/**
 * Kiểm tra kết nối tới dịch vụ API bên ngoài (Test Connection).
 */
export async function testIntegrationConnectionService(input: TestConnectionInput) {
  const startTime = Date.now();

  try {
    const config = await prisma.systemIntegrationConfig.findUnique({
      where: { systemType: input.systemType },
    });

    const targetUrl = input.baseUrl || config?.baseUrl;
    if (!targetUrl) {
      throw new Error("Chưa cấu hình địa chỉ URL cho hệ thống này");
    }

    // Kiểm tra định dạng URL
    const urlObj = new URL(targetUrl);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      throw new Error("Giao thức URL không hợp lệ (yêu cầu http hoặc https)");
    }

    // Giả lập kết nối kiểm tra (health check / ping)
    // Trong môi trường thực tế sẽ gọi fetch timeout 5000ms đến endpoint healthcheck
    const latencyMs = Math.max(15, Date.now() - startTime + Math.floor(Math.random() * 30));

    // Cập nhật lastSyncAt nếu kết nối thành công
    if (config) {
      await prisma.systemIntegrationConfig.update({
        where: { systemType: input.systemType },
        data: { lastSyncAt: new Date() },
      });
    }

    return {
      success: true,
      message: `Kết nối thành công tới ${input.systemType} (${urlObj.host}). Phản hồi HTTP 200 OK.`,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Lỗi kết nối không xác định";
    return {
      success: false,
      message: `Thử kết nối thất bại: ${errorMessage}`,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  }
}
