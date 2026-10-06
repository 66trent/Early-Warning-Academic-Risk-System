"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Lock,
  User,
  ShieldCheck,
  X,
  FileCode,
} from "lucide-react";
import {
  approveRuleVersionAction,
  rejectRuleVersionAction,
} from "@/modules/admin/actions/rule-approval.action";

export interface PendingRuleVersionItem {
  id: string;
  ruleCode: string;
  version: number;
  condition: unknown;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  action: unknown;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  configuredBy: string;
  approvedBy: string | null;
  rule?: {
    ruleCode: string;
    ruleName: string;
    ruleGroup: string;
  };
  configurator?: {
    userId: string;
    fullName: string;
    role: string;
    email: string;
  };
}

interface RuleApprovalsClientProps {
  pendingVersions: PendingRuleVersionItem[];
  currentActorId: string;
  currentRole?: string;
}

export function RuleApprovalsClient({ pendingVersions, currentActorId }: RuleApprovalsClientProps) {
  const router = useRouter();

  const [inspectingVersion, setInspectingVersion] = useState<PendingRuleVersionItem | null>(null);
  const [approvingVersion, setApprovingVersion] = useState<PendingRuleVersionItem | null>(null);
  const [rejectingVersion, setRejectingVersion] = useState<PendingRuleVersionItem | null>(null);

  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingVersion) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      await approveRuleVersionAction({
        ruleCode: approvingVersion.ruleCode,
        version: approvingVersion.version,
        note: approveNote.trim() || undefined,
      });

      setMessage({
        type: "success",
        text: `Đã phê duyệt thành công phiên bản v${approvingVersion.version} của luật ${approvingVersion.ruleCode}!`,
      });
      setApprovingVersion(null);
      setApproveNote("");
      router.refresh();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi phê duyệt phiên bản luật",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingVersion) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      await rejectRuleVersionAction({
        ruleCode: rejectingVersion.ruleCode,
        version: rejectingVersion.version,
        reason: rejectReason.trim(),
      });

      setMessage({
        type: "success",
        text: `Đã từ chối phiên bản v${rejectingVersion.version} của luật ${rejectingVersion.ruleCode}.`,
      });
      setRejectingVersion(null);
      setRejectReason("");
      router.refresh();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi từ chối phiên bản luật",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950/70 dark:text-red-300">
            CRITICAL
          </span>
        );
      case "HIGH":
        return (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
            HIGH
          </span>
        );
      case "MEDIUM":
        return (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800 dark:bg-yellow-950/70 dark:text-yellow-300">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert toast */}
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
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Overview Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Mã Luật</th>
                <th className="px-5 py-3.5 font-semibold">Tên Quy tắc</th>
                <th className="px-5 py-3.5 font-semibold">Phiên bản</th>
                <th className="px-5 py-3.5 font-semibold">Mức độ (Severity)</th>
                <th className="px-5 py-3.5 font-semibold">Cán bộ cấu hình</th>
                <th className="px-5 py-3.5 font-semibold">Trạng thái duyệt</th>
                <th className="px-5 py-3.5 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {pendingVersions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-neutral-500">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                    Hiện tại không có phiên bản luật nào đang chờ phê duyệt. Toàn bộ luật đang ở
                    trạng thái hiệu lực.
                  </td>
                </tr>
              ) : (
                pendingVersions.map((item) => {
                  const isSelfConfigured = item.configuredBy === currentActorId;

                  return (
                    <tr
                      key={`${item.ruleCode}-v${item.version}`}
                      className="transition hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40"
                    >
                      <td className="px-5 py-3.5 font-mono font-bold text-neutral-900 dark:text-white">
                        {item.ruleCode}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {item.rule?.ruleName || item.ruleCode}
                        </div>
                        <div className="font-mono text-[10px] text-neutral-400">
                          Nhóm: {item.rule?.ruleGroup}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          v{item.version}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">{getSeverityBadge(item.severity)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-neutral-400" />
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {item.configurator?.fullName || item.configuredBy}
                          </span>
                        </div>
                        {isSelfConfigured && (
                          <span className="mt-0.5 inline-block text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            (Do chính bạn tạo)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                          Chờ Thẩm định
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectingVersion(item)}
                            className="flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                          >
                            <Eye className="h-3 w-3" />
                            <span>So sánh</span>
                          </button>

                          <button
                            onClick={() => setRejectingVersion(item)}
                            className="flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-rose-400"
                          >
                            <XCircle className="h-3 w-3" />
                            <span>Từ chối</span>
                          </button>

                          <button
                            onClick={() => setApprovingVersion(item)}
                            disabled={isSelfConfigured}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs transition ${
                              isSelfConfigured
                                ? "cursor-not-allowed bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600"
                                : "cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                            }`}
                            title={
                              isSelfConfigured
                                ? "Không thể tự phê duyệt phiên bản do chính mình tạo (Separation of Duties)"
                                : "Phê duyệt kích hoạt"
                            }
                          >
                            {isSelfConfigured ? (
                              <Lock className="h-3 w-3" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            <span>Duyệt</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Chi tiết / Diff */}
      {inspectingVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Chi tiết Cấu hình: {inspectingVersion.ruleCode} (v{inspectingVersion.version})
                </h3>
                <p className="text-xs text-neutral-500">
                  {inspectingVersion.rule?.ruleName} • Mức độ {inspectingVersion.severity}
                </p>
              </div>
              <button
                onClick={() => setInspectingVersion(null)}
                className="cursor-pointer text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-xs">
              <div>
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-neutral-300">
                  <FileCode className="h-4 w-4 text-indigo-500" />
                  <span>Điều kiện kích hoạt (Condition Logic JSON)</span>
                </div>
                <pre className="overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-400">
                  {JSON.stringify(inspectingVersion.condition, null, 2)}
                </pre>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-neutral-300">
                  <Sliders className="h-4 w-4 text-indigo-500" />
                  <span>Hành động cấu hình (Action JSON)</span>
                </div>
                <pre className="overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-950 p-4 font-mono text-[11px] leading-relaxed text-blue-400">
                  {JSON.stringify(inspectingVersion.action, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <button
                onClick={() => setInspectingVersion(null)}
                className="cursor-pointer rounded-lg bg-neutral-200 px-4 py-2 font-semibold text-neutral-800 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Phê duyệt & Separation of Duties Check */}
      {approvingVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-2 flex items-center gap-3 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Phê duyệt Kích hoạt Luật
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              Bạn đang phê duyệt phiên bản <strong>v{approvingVersion.version}</strong> của luật{" "}
              <strong>{approvingVersion.ruleCode}</strong> ({approvingVersion.rule?.ruleName}).
              Phiên bản này sẽ chuyển sang trạng thái <code>ACTIVE</code> và các phiên bản cũ sẽ
              được lưu trữ (ARCHIVED).
            </p>

            <form onSubmit={handleApproveSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Ghi chú phê duyệt (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="Ghi nhận căn cứ quyết định hoặc số hiệu biên bản họp..."
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setApprovingVersion(null)}
                  className="cursor-pointer rounded-lg border border-neutral-200 px-4 py-2 font-semibold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-emerald-700"
                >
                  {isSubmitting ? "Đang phê duyệt..." : "Xác nhận Phê duyệt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Từ chối */}
      {rejectingVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-2 flex items-center gap-3 text-rose-600">
              <XCircle className="h-6 w-6" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Từ chối Phiên bản Luật
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              Bạn đang từ chối phiên bản <strong>v{rejectingVersion.version}</strong> của luật{" "}
              <strong>{rejectingVersion.ruleCode}</strong>. Phiên bản này sẽ chuyển sang trạng thái{" "}
              <code>INACTIVE</code>.
            </p>

            <form onSubmit={handleRejectSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Lý do từ chối * (Tối thiểu 5 ký tự)
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Nêu rõ lý do từ chối để cán bộ soạn thảo điều chỉnh lại ngưỡng..."
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setRejectingVersion(null)}
                  className="cursor-pointer rounded-lg border border-neutral-200 px-4 py-2 font-semibold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || rejectReason.trim().length < 5}
                  className="cursor-pointer rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Đang xử lý..." : "Xác nhận Từ chối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
