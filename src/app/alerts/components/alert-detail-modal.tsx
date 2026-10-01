"use client";

import { useState, useTransition } from "react";
import {
  acknowledgeAlertAction,
  startProgressAlertAction,
  resolveAlertAction,
  dismissAlertAction,
  recordInterventionAction,
} from "@/modules/alerts/actions/alert.action";
import {
  X,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Info,
  FileText,
} from "lucide-react";

export interface AlertTriggerDetail {
  id: string;
  ruleCode: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  triggeredAt: Date | string;
  inputSnapshot?: unknown;
}

export interface AlertInterventionDetail {
  interventionId: string;
  performedBy?: string;
  type: string;
  content: string;
  performedAt: Date | string;
  outcome?: string | null;
  performer?: {
    fullName: string;
    email: string;
  } | null;
}

export interface AlertModalData {
  alertId: string;
  studentId: string;
  termId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  firstDetectedAt: Date | string;
  lastDetectedAt: Date | string;
  student?: {
    studentId: string;
    fullName: string;
    classId: string;
    departmentId: string;
  } | null;
  term?: {
    termId: string;
    termName: string;
  } | null;
  ruleTriggers?: AlertTriggerDetail[];
  interventions?: AlertInterventionDetail[];
}

interface AlertDetailModalProps {
  alert: AlertModalData;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: () => void;
}

export function AlertDetailModal({
  alert,
  isOpen,
  onClose,
  onStatusUpdated,
}: AlertDetailModalProps) {
  const [isPending, startTransition] = useTransition();
  const [expandedTriggers, setExpandedTriggers] = useState<Record<string, boolean>>({});
  const [showInterventionForm, setShowInterventionForm] = useState(false);
  const [showDismissPrompt, setShowDismissPrompt] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Intervention form state
  const [interventionType, setInterventionType] = useState<
    "PHONE_CALL" | "EMAIL" | "IN_PERSON_MEETING" | "ACADEMIC_PLAN" | "REFERRAL" | "OTHER"
  >("PHONE_CALL");
  const [interventionContent, setInterventionContent] = useState("");
  const [interventionOutcome, setInterventionOutcome] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [confidentiality, setConfidentiality] = useState<"NORMAL" | "SENSITIVE">("NORMAL");

  if (!isOpen || !alert) return null;

  const toggleTrigger = (triggerId: string) => {
    setExpandedTriggers((prev) => ({
      ...prev,
      [triggerId]: !prev[triggerId],
    }));
  };

  const handleAcknowledge = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await acknowledgeAlertAction({ alertId: alert.alertId });
      if (res.success) {
        onStatusUpdated();
      } else {
        setErrorMessage(res.error || "Lỗi khi xác nhận cảnh báo");
      }
    });
  };

  const handleStartProgress = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await startProgressAlertAction({ alertId: alert.alertId });
      if (res.success) {
        onStatusUpdated();
      } else {
        setErrorMessage(res.error || "Lỗi khi chuyển trạng thái đang xử lý");
      }
    });
  };

  const handleResolve = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await resolveAlertAction({
        alertId: alert.alertId,
        resolutionSummary: "Đã can thiệp và hỗ trợ sinh viên hoàn tất",
      });
      if (res.success) {
        onStatusUpdated();
      } else {
        setErrorMessage(res.error || "Lỗi khi đóng giải quyết cảnh báo");
      }
    });
  };

  const handleDismiss = () => {
    if (!dismissReason.trim() || dismissReason.trim().length < 5) {
      setErrorMessage("Vui lòng nhập lý do bác bỏ tối thiểu 5 ký tự");
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      const res = await dismissAlertAction({
        alertId: alert.alertId,
        reason: dismissReason.trim(),
      });
      if (res.success) {
        setShowDismissPrompt(false);
        setDismissReason("");
        onStatusUpdated();
      } else {
        setErrorMessage(res.error || "Lỗi khi bác bỏ cảnh báo");
      }
    });
  };

  const handleSaveIntervention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interventionContent.trim() || interventionContent.trim().length < 5) {
      setErrorMessage("Nội dung can thiệp bắt buộc tối thiểu 5 ký tự");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      const res = await recordInterventionAction({
        alertId: alert.alertId,
        type: interventionType,
        content: interventionContent.trim(),
        outcome: interventionOutcome.trim() || undefined,
        nextFollowUpAt: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
        confidentialityLevel: confidentiality,
      });

      if (res.success) {
        setInterventionContent("");
        setInterventionOutcome("");
        setNextFollowUpDate("");
        setShowInterventionForm(false);
        onStatusUpdated();
      } else {
        setErrorMessage(res.error || "Lỗi khi lưu can thiệp");
      }
    });
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900";
      case "HIGH":
        return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900";
      case "MEDIUM":
        return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const getStatusBadgeClass = (st: string) => {
    switch (st) {
      case "OPEN":
        return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
      case "ACKNOWLEDGED":
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300";
      case "IN_PROGRESS":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300";
      case "RESOLVED":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "DISMISSED":
        return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-lg border px-3 py-1 text-xs font-bold tracking-wide uppercase ${getSeverityBadgeClass(alert.severity)}`}
            >
              {alert.severity}
            </span>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Chi tiết Cảnh báo: {alert.student?.fullName} ({alert.studentId})
              </h2>
              <p className="text-xs text-neutral-500">
                Lớp: {alert.student?.classId} • Khoa: {alert.student?.departmentId} • Học kỳ:{" "}
                {alert.term?.termName || alert.termId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mandatory Policy Disclaimer (03-ui-design.md) */}
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Cảnh báo sớm — mang tính tham khảo, không phải quyết định học vụ chính thức.</span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-2 font-bold text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Content Body (Scrollable) */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Quick Action Toolbar — Luồng ≤2 Click */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Trạng thái hiện tại:</span>
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(alert.status)}`}
              >
                {alert.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Nút Xác nhận (khi OPEN) */}
              {alert.status === "OPEN" && (
                <button
                  onClick={handleAcknowledge}
                  disabled={isPending}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Xác nhận cảnh báo
                </button>
              )}

              {/* Nút Chuyển Đang xử lý (khi ACKNOWLEDGED) */}
              {alert.status === "ACKNOWLEDGED" && (
                <button
                  onClick={handleStartProgress}
                  disabled={isPending}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Bắt đầu xử lý
                </button>
              )}

              {/* Nút Ghi can thiệp (≤2 clicks) */}
              {(alert.status === "OPEN" ||
                alert.status === "ACKNOWLEDGED" ||
                alert.status === "IN_PROGRESS") && (
                <button
                  onClick={() => setShowInterventionForm(!showInterventionForm)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {showInterventionForm ? "Đóng form can thiệp" : "Ghi nhận can thiệp"}
                </button>
              )}

              {/* Nút Đóng cảnh báo (RESOLVE) */}
              {alert.status === "IN_PROGRESS" && (
                <button
                  onClick={handleResolve}
                  disabled={isPending}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đóng cảnh báo (Đã hỗ trợ)
                </button>
              )}

              {/* Nút Bác bỏ (DISMISS) */}
              {(alert.status === "ACKNOWLEDGED" || alert.status === "IN_PROGRESS") && (
                <button
                  onClick={() => setShowDismissPrompt(!showDismissPrompt)}
                  className="cursor-pointer rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  Bác bỏ cảnh báo
                </button>
              )}
            </div>
          </div>

          {/* Form Bác bỏ cảnh báo */}
          {showDismissPrompt && (
            <div className="space-y-3 rounded-xl border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                Nhập lý do bác bỏ cảnh báo (Bắt buộc theo quy định kiểm toán):
              </h4>
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Ví dụ: Sinh viên có đơn nghỉ phép được khoa duyệt, hoặc đã học bù đầy đủ..."
                className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDismissPrompt(false)}
                  className="cursor-pointer px-3 py-1 text-xs text-neutral-600 hover:text-neutral-900"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Xác nhận Bác bỏ
                </button>
              </div>
            </div>
          )}

          {/* Form Ghi nhận can thiệp inline */}
          {showInterventionForm && (
            <form
              onSubmit={handleSaveIntervention}
              className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20"
            >
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-300">
                  <FileText className="h-4 w-4" />
                  Ghi nhận hoạt động can thiệp / Hỗ trợ sinh viên
                </h4>
                <span className="text-[11px] text-blue-600 dark:text-blue-400">
                  (Lưu can thiệp sẽ tự động chuyển cảnh báo sang Đang xử lý)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    Hình thức can thiệp
                  </label>
                  <select
                    value={interventionType}
                    onChange={(e) =>
                      setInterventionType(
                        e.target.value as
                          | "PHONE_CALL"
                          | "EMAIL"
                          | "IN_PERSON_MEETING"
                          | "ACADEMIC_PLAN"
                          | "REFERRAL"
                          | "OTHER"
                      )
                    }
                    className="w-full rounded-lg border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  >
                    <option value="PHONE_CALL">Gọi điện thoại</option>
                    <option value="EMAIL">Gửi Email</option>
                    <option value="IN_PERSON_MEETING">Gặp trực tiếp</option>
                    <option value="ACADEMIC_PLAN">Lập kế hoạch học tập</option>
                    <option value="REFERRAL">Chuyển tiếp hỗ trợ (Khoa/Tâm lý)</option>
                    <option value="OTHER">Hình thức khác</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    Ngày theo dõi tiếp theo (Tùy chọn)
                  </label>
                  <input
                    type="date"
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    Mức độ bảo mật
                  </label>
                  <select
                    value={confidentiality}
                    onChange={(e) => setConfidentiality(e.target.value as "NORMAL" | "SENSITIVE")}
                    className="w-full rounded-lg border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  >
                    <option value="NORMAL">Bình thường (CVHT & QLĐT)</option>
                    <option value="SENSITIVE">Nhạy cảm (Chỉ CVHT)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  Nội dung trao đổi / Biện pháp can thiệp *
                </label>
                <textarea
                  value={interventionContent}
                  onChange={(e) => setInterventionContent(e.target.value)}
                  placeholder="Nhập chi tiết nội dung đã trao đổi với sinh viên và hướng khắc phục..."
                  rows={3}
                  required
                  className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  Kết quả bước đầu (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={interventionOutcome}
                  onChange={(e) => setInterventionOutcome(e.target.value)}
                  placeholder="Ví dụ: Sinh viên cam kết đi học lại từ tuần sau và nộp bù bài tập..."
                  className="w-full rounded-lg border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowInterventionForm(false)}
                  className="cursor-pointer px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Lưu can thiệp
                </button>
              </div>
            </form>
          )}

          {/* Accordion: Dấu hiệu & Bằng chứng quy tắc kích hoạt (RuleTriggers) */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-neutral-700 uppercase dark:text-neutral-300">
              <ShieldAlert className="h-4 w-4 text-orange-500" />
              Các dấu hiệu kích hoạt cảnh báo ({alert.ruleTriggers?.length || 0})
            </h3>

            <div className="space-y-2">
              {alert.ruleTriggers?.map((trigger) => {
                const isExpanded = !!expandedTriggers[trigger.id];
                return (
                  <div
                    key={trigger.id}
                    className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
                  >
                    <button
                      onClick={() => toggleTrigger(trigger.id)}
                      className="flex w-full cursor-pointer items-center justify-between bg-neutral-50/70 p-3.5 text-left transition hover:bg-neutral-100/70 dark:bg-neutral-800/40 dark:hover:bg-neutral-800"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="rounded bg-neutral-200 px-2 py-0.5 font-mono text-xs font-bold text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200">
                          {trigger.ruleCode}
                        </span>
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {trigger.reason}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${getSeverityBadgeClass(trigger.severity)}`}
                        >
                          {trigger.severity}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-neutral-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-neutral-500" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="space-y-2 border-t border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="text-[11px] text-neutral-500">
                          Thời điểm phát hiện:{" "}
                          {new Date(trigger.triggeredAt).toLocaleString("vi-VN")}
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                            Bằng chứng dữ liệu (Input Snapshot):
                          </span>
                          <pre className="mt-1 max-h-48 overflow-x-auto rounded-lg bg-neutral-900 p-2.5 font-mono text-[11px] text-neutral-100">
                            {JSON.stringify(trigger.inputSnapshot, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lịch sử Can thiệp (Interventions Timeline) */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-neutral-700 uppercase dark:text-neutral-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Lịch sử can thiệp hỗ trợ ({alert.interventions?.length || 0})
            </h3>

            {!alert.interventions || alert.interventions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-500 dark:border-neutral-800">
                Chưa có hoạt động can thiệp nào được ghi nhận cho cảnh báo này.
              </div>
            ) : (
              <div className="space-y-2.5">
                {alert.interventions.map((inv) => (
                  <div
                    key={inv.interventionId}
                    className="space-y-1.5 rounded-xl border border-neutral-200 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-800/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                          {inv.type === "PHONE_CALL"
                            ? "📞 Gọi điện thoại"
                            : inv.type === "EMAIL"
                              ? "✉️ Gửi Email"
                              : inv.type === "IN_PERSON_MEETING"
                                ? "🤝 Gặp mặt trực tiếp"
                                : inv.type === "ACADEMIC_PLAN"
                                  ? "📋 Lập kế hoạch học tập"
                                  : inv.type === "REFERRAL"
                                    ? "🔄 Chuyển tiếp hỗ trợ"
                                    : "📝 Ghi chú"}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          bởi {inv.performer?.fullName || inv.performedBy}
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-400">
                        {new Date(inv.performedAt).toLocaleString("vi-VN")}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
                      {inv.content}
                    </p>

                    {inv.outcome && (
                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        ✓ Kết quả: {inv.outcome}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end rounded-b-2xl border-t border-neutral-200 bg-neutral-50 px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900/80">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-200"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
