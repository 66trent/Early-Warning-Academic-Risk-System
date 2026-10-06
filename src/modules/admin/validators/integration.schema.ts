import { z } from "zod";

export const SystemIntegrationTypeSchema = z.enum(["SIS", "LMS_MOODLE", "LMS_CANVAS"]);

export const UpdateIntegrationConfigSchema = z.object({
  systemType: SystemIntegrationTypeSchema,
  name: z.string().min(1, "Tên kết nối không được để trống").max(100),
  baseUrl: z.string().url("Địa chỉ URL API không hợp lệ"),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  isEnabled: z.boolean().default(true),
  syncSchedule: z.string().optional(),
  configJson: z.record(z.string(), z.unknown()).optional(),
});

export const TestConnectionSchema = z.object({
  systemType: SystemIntegrationTypeSchema,
  baseUrl: z.string().url("Địa chỉ URL API không hợp lệ").optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
});

export type SystemIntegrationType = z.infer<typeof SystemIntegrationTypeSchema>;
export type UpdateIntegrationConfigInput = z.infer<typeof UpdateIntegrationConfigSchema>;
export type TestConnectionInput = z.infer<typeof TestConnectionSchema>;
