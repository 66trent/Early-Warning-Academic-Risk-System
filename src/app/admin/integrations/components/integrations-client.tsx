"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Server, Activity, CheckCircle2, AlertCircle, Save, KeyRound } from "lucide-react";
import {
  updateIntegrationConfigAction,
  testIntegrationConnectionAction,
} from "@/modules/admin/actions/integration.action";

export interface IntegrationConfigItem {
  id: string;
  systemType: "SIS" | "LMS_MOODLE" | "LMS_CANVAS";
  name: string;
  baseUrl: string;
  apiKey: string | null;
  apiSecretMasked: string | null;
  apiSecret?: string;
  hasApiSecret: boolean;
  isEnabled: boolean;
  syncSchedule: string | null;
  lastSyncAt: Date | null;
  configJson: unknown;
  updatedBy: string;
  updatedAt: Date;
}

interface IntegrationsClientProps {
  initialConfigs: IntegrationConfigItem[];
}

export function IntegrationsClient({ initialConfigs }: IntegrationsClientProps) {
  const router = useRouter();

  const [configs, setConfigs] = useState(initialConfigs);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);

  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string; latencyMs?: number; timestamp?: string }>
  >({});

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleFieldChange = (systemType: string, field: string, value: unknown) => {
    setConfigs((prev) =>
      prev.map((c) => (c.systemType === systemType ? { ...c, [field]: value } : c))
    );
  };

  const handleTestConnection = async (config: IntegrationConfigItem) => {
    setTestingType(config.systemType);
    setMessage(null);

    try {
      const result = await testIntegrationConnectionAction({
        systemType: config.systemType,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey || undefined,
        apiSecret: config.apiSecret || undefined,
      });

      setTestResults((prev) => ({
        ...prev,
        [config.systemType]: result,
      }));
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [config.systemType]: {
          success: false,
          message: err instanceof Error ? err.message : "Lỗi kiểm tra kết nối",
        },
      }));
    } finally {
      setTestingType(null);
    }
  };

  const handleSaveConfig = async (config: IntegrationConfigItem) => {
    setSavingType(config.systemType);
    setMessage(null);

    try {
      await updateIntegrationConfigAction({
        systemType: config.systemType,
        name: config.name,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey || undefined,
        apiSecret: config.apiSecret || undefined,
        isEnabled: config.isEnabled,
        syncSchedule: config.syncSchedule || undefined,
      });

      setMessage({
        type: "success",
        text: `Đã lưu cấu hình kết nối cho ${config.name}!`,
      });
      router.refresh();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi lưu cấu hình tích hợp",
      });
    } finally {
      setSavingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl p-4 text-xs font-semibold ${
            message.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Cards list */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {configs.map((config) => {
          const testRes = testResults[config.systemType];
          const isTesting = testingType === config.systemType;
          const isSaving = savingType === config.systemType;

          return (
            <div
              key={config.systemType}
              className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
                      <Server className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                        {config.name}
                      </h3>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {config.systemType}
                      </span>
                    </div>
                  </div>

                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={config.isEnabled}
                      onChange={(e) =>
                        handleFieldChange(config.systemType, "isEnabled", e.target.checked)
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-4 w-8 rounded-full bg-neutral-200 peer-checked:bg-indigo-600 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-neutral-600 dark:bg-neutral-700"></div>
                  </label>
                </div>

                {/* Form fields */}
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                      API Endpoint URL *
                    </label>
                    <input
                      type="url"
                      value={config.baseUrl}
                      onChange={(e) =>
                        handleFieldChange(config.systemType, "baseUrl", e.target.value)
                      }
                      placeholder="https://api.example.com"
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                      API Key / Client ID
                    </label>
                    <input
                      type="text"
                      value={config.apiKey || ""}
                      onChange={(e) =>
                        handleFieldChange(config.systemType, "apiKey", e.target.value)
                      }
                      placeholder="Không bắt buộc"
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                        Secret Token / Web Service Token
                      </label>
                      {config.hasApiSecret && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Đã lưu mật khẩu
                        </span>
                      )}
                    </div>
                    <div className="relative mt-1">
                      <input
                        type="password"
                        value={config.apiSecret || ""}
                        onChange={(e) =>
                          handleFieldChange(config.systemType, "apiSecret", e.target.value)
                        }
                        placeholder={config.apiSecretMasked || "Nhập token bí mật..."}
                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      />
                      <KeyRound className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-neutral-400" />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                      Lịch Đồng bộ Tự động (Cron Expression)
                    </label>
                    <input
                      type="text"
                      value={config.syncSchedule || ""}
                      onChange={(e) =>
                        handleFieldChange(config.systemType, "syncSchedule", e.target.value)
                      }
                      placeholder="0 2 * * *"
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>
                </div>

                {/* Test Connection Result Box */}
                {testRes && (
                  <div
                    className={`rounded-xl border p-3 text-[11px] ${
                      testRes.success
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      {testRes.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      <span>{testRes.success ? "Kết nối Thành công" : "Kết nối Thất bại"}</span>
                      {testRes.latencyMs && (
                        <span className="ml-auto font-mono text-[10px]">{testRes.latencyMs}ms</span>
                      )}
                    </div>
                    <div className="mt-1 leading-relaxed">{testRes.message}</div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4 dark:border-neutral-800">
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={() => handleTestConnection(config)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>{isTesting ? "Đang thử..." : "Thử kết nối"}</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveConfig(config)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? "Đang lưu..." : "Lưu cấu hình"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
