"use client";

/**
 * Dashboard Charts — Biểu đồ phân bố và xu hướng dùng Recharts.
 * MUST: Dùng Recharts cho khu vực dashboard/báo cáo (Tremor không tương thích React 19).
 * Dữ liệu đã tổng hợp sẵn ở server, client chỉ render.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";

// ==========================================
// 1. Biểu đồ phân bố Alert theo nhóm nguyên nhân
// ==========================================

interface RuleGroupData {
  ruleGroup: string;
  count: number;
  label: string;
}

const RULE_GROUP_COLORS: Record<string, string> = {
  ATTENDANCE: "#f59e0b",
  ACADEMIC: "#ef4444",
  LMS: "#6366f1",
  COMBINED: "#ec4899",
  EXCEPTION: "#94a3b8",
};

export function RuleGroupChart({ data }: { data: RuleGroupData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        Chưa có dữ liệu phân bố theo nhóm nguyên nhân
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Phân bố cảnh báo theo nhóm nguyên nhân
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: unknown) => [`${value ?? 0} cảnh báo`, "Số lượng"]}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {data.map((entry) => (
                <Cell
                  key={entry.ruleGroup}
                  fill={RULE_GROUP_COLORS[entry.ruleGroup] || "#8884d8"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==========================================
// 2. Biểu đồ tròn trạng thái Alert
// ==========================================

interface AlertStatusData {
  status: string;
  count: number;
  label: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6",
  ACKNOWLEDGED: "#8b5cf6",
  IN_PROGRESS: "#06b6d4",
  RESOLVED: "#10b981",
  DISMISSED: "#9ca3af",
  INVALIDATED: "#64748b",
  REOPENED: "#f97316",
};

export function AlertStatusChart({ data }: { data: AlertStatusData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        Chưa có dữ liệu trạng thái cảnh báo
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Trạng thái xử lý cảnh báo
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={3}
              dataKey="count"
              nameKey="label"
              label={(props: { name?: string; label?: string; percent?: number }) => {
                const percent = props.percent ?? 0;
                const label = props.label || props.name || "";
                return percent > 0.05 ? `${label} (${(percent * 100).toFixed(0)}%)` : "";
              }}
              labelLine={false}
              style={{ fontSize: "11px" }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={STATUS_COLORS[entry.status] || "#8884d8"}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: unknown) => [`${value ?? 0} cảnh báo`, "Số lượng"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {data.map((entry) => (
          <div key={entry.status} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[entry.status] || "#8884d8" }}
            />
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {entry.label} ({entry.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 3. Biểu đồ xu hướng RiskScore theo thời gian
// ==========================================

interface TrendPoint {
  date: string;
  averageScore: number;
  studentCount: number;
  fullCount: number;
  partialCount: number;
  insufficientCount: number;
}

export function RiskScoreTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-neutral-400">
        Chưa có dữ liệu xu hướng RiskScore
      </div>
    );
  }

  // Format date to display
  const formattedData = data.map((point) => ({
    ...point,
    displayDate: new Date(point.date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));

  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Xu hướng Điểm Rủi ro Trung bình theo Thời gian
        </h3>
        <span className="text-[11px] text-neutral-400">
          {data.length} ngày · {data.reduce((s, d) => s + d.studentCount, 0)} lượt đánh giá
        </span>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="riskScoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: unknown) => [
                `${((Number(value) || 0) * 100).toFixed(1)}%`,
                "Điểm rủi ro TB",
              ]}
              labelFormatter={(label) => `Ngày: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="averageScore"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#riskScoreGradient)"
              dot={{ r: 3, fill: "#ef4444" }}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==========================================
// 4. Biểu đồ Data Completeness theo thời gian (stacked area)
// ==========================================

export function DataCompletenessChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        Chưa có dữ liệu mức hoàn thiện dữ liệu
      </div>
    );
  }

  const formattedData = data.map((point) => ({
    ...point,
    displayDate: new Date(point.date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));

  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Mức Hoàn thiện Dữ liệu theo Thời gian
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Area
              type="monotone"
              dataKey="fullCount"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
              name="Đầy đủ (FULL)"
            />
            <Area
              type="monotone"
              dataKey="partialCount"
              stackId="1"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.6}
              name="Một phần (PARTIAL)"
            />
            <Area
              type="monotone"
              dataKey="insufficientCount"
              stackId="1"
              stroke="#94a3b8"
              fill="#94a3b8"
              fillOpacity={0.6}
              name="Không đủ (INSUFFICIENT)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
