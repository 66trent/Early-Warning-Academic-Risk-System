"use client";

/**
 * At-Risk Student Table — Danh sách sinh viên nguy cơ với bộ lọc.
 * MUST: Sắp xếp CRITICAL trên cùng (03-ui-design.md).
 * MUST: RiskScore luôn kèm badge DataCompletenessLevel (03-ui-design.md).
 * MUST: Dùng @tanstack/react-table + shadcn Table pattern (03-ui-design.md).
 */

import { useState, useCallback } from "react";
import { Download, Filter, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { getAtRiskStudentListAction } from "@/modules/dashboard/actions/dashboard.action";

interface AtRiskStudent {
  studentId: string;
  fullName: string;
  classId: string;
  departmentId: string;
  severity: string;
  alertStatus: string;
  alertId: string;
  riskScoreValue: number | null;
  dataCompletenessLevel: string | null;
  ruleGroupSources: string[];
  lastDetectedAt: string;
  interventionCount: number;
}

interface AtRiskStudentListData {
  students: AtRiskStudent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface FilterOption {
  value: string;
  label: string;
}

interface AtRiskStudentTableProps {
  initialData: AtRiskStudentListData;
  filterOptions: {
    terms: FilterOption[];
    departments: FilterOption[];
    classes: FilterOption[];
  };
  exportTermId?: string;
}

// Severity badge (matching 03-ui-design.md)
function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  };
  const labels: Record<string, string> = {
    CRITICAL: "Nghiêm trọng",
    HIGH: "Cao",
    MEDIUM: "Trung bình",
    LOW: "Thấp",
  };

  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${styles[severity] || "bg-neutral-100 text-neutral-700"}`}
    >
      {labels[severity] || severity}
    </span>
  );
}

// DataCompletenessLevel badge (xám/xanh dương — distinct from Severity per 03-ui-design.md)
function CompletenesssBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-[11px] text-neutral-400">—</span>;

  const styles: Record<string, string> = {
    FULL: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    PARTIAL: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    INSUFFICIENT: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
  };
  const labels: Record<string, string> = {
    FULL: "Đầy đủ",
    PARTIAL: "Một phần",
    INSUFFICIENT: "Không đủ",
  };

  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ${styles[level] || ""}`}
    >
      {labels[level] || level}
    </span>
  );
}

// Alert status badge (trung tính: xanh dương, tím, xám — not red/green per 03-ui-design.md)
function AlertStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    ACKNOWLEDGED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    IN_PROGRESS: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    REOPENED: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    RESOLVED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    DISMISSED: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  };
  const labels: Record<string, string> = {
    OPEN: "Mở",
    ACKNOWLEDGED: "Đã xác nhận",
    IN_PROGRESS: "Đang xử lý",
    REOPENED: "Mở lại",
    RESOLVED: "Đã giải quyết",
    DISMISSED: "Bác bỏ",
  };

  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ${styles[status] || "bg-neutral-100 text-neutral-600"}`}
    >
      {labels[status] || status}
    </span>
  );
}

// Rule group source badges
function RuleGroupBadges({ groups }: { groups: string[] }) {
  const labels: Record<string, string> = {
    ATTENDANCE: "Điểm danh",
    ACADEMIC: "Học lực",
    LMS: "LMS",
    COMBINED: "Tổ hợp",
  };
  const colors: Record<string, string> = {
    ATTENDANCE: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    ACADEMIC: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    LMS: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    COMBINED: "bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
  };

  return (
    <div className="flex flex-wrap gap-1">
      {groups.map((g) => (
        <span
          key={g}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[g] || "bg-neutral-100 text-neutral-600"}`}
        >
          {labels[g] || g}
        </span>
      ))}
    </div>
  );
}

export function AtRiskStudentTable({
  initialData,
  filterOptions,
  exportTermId,
}: AtRiskStudentTableProps) {
  const [data, setData] = useState<AtRiskStudentListData>(initialData);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    termId: "",
    departmentId: "",
    classId: "",
    severity: "",
    page: 1,
    pageSize: 20,
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(
    async (overrides: Partial<typeof filters> = {}) => {
      setLoading(true);
      try {
        const params = { ...filters, ...overrides };
        const result = await getAtRiskStudentListAction({
          termId: params.termId || undefined,
          departmentId: params.departmentId || undefined,
          classId: params.classId || undefined,
          severity: params.severity || undefined,
          page: params.page,
          pageSize: params.pageSize,
        });
        if (result.success && result.data) {
          setData(result.data as AtRiskStudentListData);
        }
      } catch {
        // Silent error handling
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
    fetchData(newFilters);
  };

  const handlePageChange = (newPage: number) => {
    const newFilters = { ...filters, page: newPage };
    setFilters(newFilters);
    fetchData(newFilters);
  };

  // Build export URL
  const exportUrl = `/api/dashboard/export?termId=${exportTermId || filterOptions.terms[0]?.value || ""}${filters.departmentId ? `&departmentId=${filters.departmentId}` : ""}${filters.classId ? `&classId=${filters.classId}` : ""}`;

  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200/60 p-4 dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Danh sách Sinh viên Nguy cơ
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Sắp xếp theo mức độ nghiêm trọng giảm dần · Tổng: {data.total} sinh viên
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Filter className="h-3.5 w-3.5" />
            Bộ lọc
          </button>
          <a
            href={exportUrl}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <Download className="h-3.5 w-3.5" />
            Xuất CSV
          </a>
        </div>
      </div>

      {/* Filter Bar (toggle) */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 bg-neutral-50/50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950/30">
          <select
            value={filters.termId}
            onChange={(e) => handleFilterChange("termId", e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option value="">Tất cả học kỳ</option>
            {filterOptions.terms.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={filters.departmentId}
            onChange={(e) => handleFilterChange("departmentId", e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option value="">Tất cả khoa</option>
            {filterOptions.departments.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <select
            value={filters.classId}
            onChange={(e) => handleFilterChange("classId", e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option value="">Tất cả lớp</option>
            {filterOptions.classes.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={filters.severity}
            onChange={(e) => handleFilterChange("severity", e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <option value="">Tất cả mức độ</option>
            <option value="CRITICAL">Nghiêm trọng</option>
            <option value="HIGH">Cao</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="LOW">Thấp</option>
          </select>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200/60 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-950/40">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap text-neutral-500 uppercase">
                MSSV
              </th>
              <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap text-neutral-500 uppercase">
                Họ tên
              </th>
              <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap text-neutral-500 uppercase">
                Lớp / Khoa
              </th>
              <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap text-neutral-500 uppercase">
                Mức độ
              </th>
              <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap text-neutral-500 uppercase">
                Trạng thái
              </th>
              <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap text-neutral-500 uppercase">
                Điểm rủi ro
              </th>
              <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap text-neutral-500 uppercase">
                Nguồn cảnh báo
              </th>
              <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap text-neutral-500 uppercase">
                Can thiệp
              </th>
              <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap text-neutral-500 uppercase">
                Phát hiện
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {loading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-sm text-neutral-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-500" />
                    Đang tải...
                  </div>
                </td>
              </tr>
            ) : data.students.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-sm text-neutral-400">
                  Không có sinh viên nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              data.students.map((student) => (
                <tr
                  key={student.alertId}
                  className="transition hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30"
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium whitespace-nowrap text-neutral-800 dark:text-neutral-200">
                    {student.studentId}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium whitespace-nowrap text-neutral-900 dark:text-neutral-100">
                    {student.fullName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-xs text-neutral-700 dark:text-neutral-300">
                      {student.classId}
                    </div>
                    <div className="text-[10px] text-neutral-400">{student.departmentId}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <SeverityBadge severity={student.severity} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AlertStatusBadge status={student.alertStatus} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {/* MUST: RiskScore luôn kèm badge DataCompletenessLevel (03-ui-design.md) */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        {student.riskScoreValue !== null
                          ? `${(student.riskScoreValue * 100).toFixed(0)}%`
                          : "—"}
                      </span>
                      <CompletenesssBadge level={student.dataCompletenessLevel} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RuleGroupBadges groups={student.ruleGroupSources} />
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        student.interventionCount > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {student.interventionCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] whitespace-nowrap text-neutral-500">
                    {new Date(student.lastDetectedAt).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a
                      href={`/alerts`}
                      className="text-blue-500 transition hover:text-blue-700 dark:text-blue-400"
                      title="Xem chi tiết cảnh báo"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-200/60 px-4 py-3 dark:border-neutral-800">
          <span className="text-[11px] text-neutral-500">
            Trang {data.page} / {data.totalPages} · Tổng {data.total} sinh viên
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={data.page <= 1}
              onClick={() => handlePageChange(data.page - 1)}
              className="rounded-lg border border-neutral-200 p-1.5 text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={data.page >= data.totalPages}
              onClick={() => handlePageChange(data.page + 1)}
              className="rounded-lg border border-neutral-200 p-1.5 text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
