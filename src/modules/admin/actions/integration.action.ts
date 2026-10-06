"use server";

import { getSession } from "@/lib/session";
import { AuthorizationError } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import {
  UpdateIntegrationConfigSchema,
  TestConnectionSchema,
} from "../validators/integration.schema";
import {
  getIntegrationConfigsService,
  getIntegrationConfigByTypeService,
  upsertIntegrationConfigService,
  testIntegrationConnectionService,
} from "../services/integration.service";

/**
 * Kiểm tra quyền quản trị tối cao (ADMIN).
 */
async function requireAdminSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new AuthorizationError("Yêu cầu đăng nhập để truy cập cấu hình tích hợp", 401);
  }
  if (session.user.role !== "ADMIN") {
    throw new AuthorizationError(
      "Chỉ Quản trị viên hệ thống (ADMIN) mới có quyền cấu hình tích hợp",
      403
    );
  }
  return session;
}

/**
 * Server Action lấy danh sách cấu hình kết nối ngoại vi.
 */
export async function getIntegrationConfigsAction() {
  await requireAdminSession();
  return await getIntegrationConfigsService();
}

/**
 * Server Action lấy chi tiết cấu hình của 1 hệ thống.
 */
export async function getIntegrationConfigByTypeAction(
  systemType: "SIS" | "LMS_MOODLE" | "LMS_CANVAS"
) {
  await requireAdminSession();
  return await getIntegrationConfigByTypeService(systemType);
}

/**
 * Server Action cập nhật thông số kết nối API LMS/SIS.
 */
export async function updateIntegrationConfigAction(rawInput: unknown) {
  const session = await requireAdminSession();
  const input = UpdateIntegrationConfigSchema.parse(rawInput);

  const result = await upsertIntegrationConfigService(input, session.user.id);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "UPDATE_SYSTEM_INTEGRATION",
    targetEntity: "SystemIntegrationConfig",
    targetId: input.systemType,
    details: {
      name: input.name,
      baseUrl: input.baseUrl,
      isEnabled: input.isEnabled,
      syncSchedule: input.syncSchedule,
    },
  });

  return result;
}

/**
 * Server Action kiểm tra kết nối API tới hệ thống ngoại vi (Test Connection).
 */
export async function testIntegrationConnectionAction(rawInput: unknown) {
  const session = await requireAdminSession();
  const input = TestConnectionSchema.parse(rawInput);

  const testResult = await testIntegrationConnectionService(input);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "TEST_SYSTEM_INTEGRATION_CONNECTION",
    targetEntity: "SystemIntegrationConfig",
    targetId: input.systemType,
    details: {
      success: testResult.success,
      latencyMs: testResult.latencyMs,
    },
  });

  return testResult;
}
