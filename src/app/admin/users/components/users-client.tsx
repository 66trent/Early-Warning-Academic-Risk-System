"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  X,
  Lock,
} from "lucide-react";
import {
  createUserAction,
  updateUserAction,
  deleteUserAction,
} from "@/modules/admin/actions/user.action";
import type { PaginatedUsersResult } from "@/modules/admin/services/user.service";

type UserItem = PaginatedUsersResult["users"][number];
type UserRoleType = "STUDENT" | "ADVISOR" | "TRAINING_OFFICER" | "ADMIN";

interface UsersClientProps {
  initialData: PaginatedUsersResult;
  currentActorId: string;
  initialFilter: { role: string; search: string };
}

export function UsersClient({ initialData, currentActorId, initialFilter }: UsersClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(initialFilter.search);
  const [selectedRole, setSelectedRole] = useState(initialFilter.role);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State Create
  const [createForm, setCreateForm] = useState({
    userId: "",
    fullName: "",
    role: "STUDENT" as "STUDENT" | "ADVISOR" | "TRAINING_OFFICER" | "ADMIN",
    email: "",
    scope: "ALL",
    departmentId: "CNTT",
    classId: "CNTT-K47",
    cohortYear: "2024",
  });

  // Form State Edit
  const [editForm, setEditForm] = useState({
    userId: "",
    fullName: "",
    role: "STUDENT" as "STUDENT" | "ADVISOR" | "TRAINING_OFFICER" | "ADMIN",
    email: "",
    scope: "ALL",
    departmentId: "CNTT",
  });

  const handleFilterChange = (role: string) => {
    setSelectedRole(role);
    startTransition(() => {
      const params = new URLSearchParams();
      if (role && role !== "ALL") params.set("role", role);
      if (search) params.set("search", search);
      router.push(`/admin/users?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (selectedRole && selectedRole !== "ALL") params.set("role", selectedRole);
      if (search) params.set("search", search);
      router.push(`/admin/users?${params.toString()}`);
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const scopeConfig =
        createForm.role === "TRAINING_OFFICER" || createForm.role === "ADVISOR"
          ? createForm.scope === "ALL"
            ? { scope: "ALL" }
            : { scope: "DEPARTMENT", departmentId: createForm.departmentId }
          : undefined;

      await createUserAction({
        userId: createForm.userId.trim(),
        fullName: createForm.fullName.trim(),
        role: createForm.role,
        email: createForm.email.trim(),
        scopeConfig,
        studentMetadata:
          createForm.role === "STUDENT"
            ? {
                classId: createForm.classId,
                departmentId: createForm.departmentId,
                cohortYear: createForm.cohortYear,
              }
            : undefined,
      });

      setSuccessMessage(`Tạo tài khoản ${createForm.userId} thành công!`);
      setIsCreateOpen(false);
      setCreateForm({
        userId: "",
        fullName: "",
        role: "STUDENT",
        email: "",
        scope: "ALL",
        departmentId: "CNTT",
        classId: "CNTT-K47",
        cohortYear: "2024",
      });
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi tạo tài khoản");
    }
  };

  const handleEditOpen = (user: UserItem) => {
    setEditingUser(user);
    setErrorMessage(null);

    let scope = "ALL";
    let departmentId = "CNTT";

    if (user.scopeConfig) {
      const cfg =
        typeof user.scopeConfig === "string" ? JSON.parse(user.scopeConfig) : user.scopeConfig;
      if (typeof cfg === "object" && cfg !== null && "departmentId" in cfg) {
        scope = "DEPARTMENT";
        departmentId = (cfg as { departmentId: string }).departmentId;
      }
    }

    setEditForm({
      userId: user.userId,
      fullName: user.fullName,
      role: user.role as UserRoleType,
      email: user.email,
      scope,
      departmentId,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const isSelf = editingUser?.userId === currentActorId;

      const scopeConfig =
        editForm.scope === "ALL"
          ? { scope: "ALL" }
          : { scope: "DEPARTMENT", departmentId: editForm.departmentId };

      await updateUserAction({
        userId: editForm.userId,
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        // Nếu là chính mình, không gửi role hay scopeConfig (hoặc giữ nguyên) để tuân thủ STRIDE
        role: isSelf ? undefined : editForm.role,
        scopeConfig: isSelf ? undefined : scopeConfig,
      });

      setSuccessMessage(`Cập nhật người dùng ${editForm.userId} thành công!`);
      setEditingUser(null);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi cập nhật người dùng");
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingUser) return;
    setErrorMessage(null);

    try {
      await deleteUserAction({ userId: deletingUser.userId });
      setSuccessMessage(`Đã xóa tài khoản ${deletingUser.userId}`);
      setDeletingUser(null);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi xóa tài khoản");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300">
            Quản trị viên (ADMIN)
          </span>
        );
      case "TRAINING_OFFICER":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
            QL Đào tạo (QLĐT)
          </span>
        );
      case "ADVISOR":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
            Cố vấn học tập (CVHT)
          </span>
        );
      case "STUDENT":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
            Sinh viên (STUDENT)
          </span>
        );
      default:
        return <span>{role}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="cursor-pointer text-emerald-600 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="cursor-pointer text-rose-600 hover:text-rose-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Role Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-100/70 p-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
          {[
            { id: "ALL", label: "Tất cả" },
            { id: "STUDENT", label: "Sinh viên" },
            { id: "ADVISOR", label: "CVHT" },
            { id: "TRAINING_OFFICER", label: "QL Đào tạo" },
            { id: "ADMIN", label: "Quản trị" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleFilterChange(tab.id)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 font-medium transition ${
                selectedRole === tab.id
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-neutral-800 dark:text-white"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Add button */}
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Tìm theo MSSV, tên, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-60 rounded-xl border border-neutral-200 bg-white pr-3 pl-8 text-xs placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-neutral-400" />
          </form>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm Tài khoản</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Người dùng</th>
                <th className="px-5 py-3.5 font-semibold">Mã định danh (MSSV/ID)</th>
                <th className="px-5 py-3.5 font-semibold">Vai trò</th>
                <th className="px-5 py-3.5 font-semibold">Email</th>
                <th className="px-5 py-3.5 font-semibold">Phạm vi phụ trách</th>
                <th className="px-5 py-3.5 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {initialData.users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-neutral-500">
                    Không tìm thấy người dùng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                initialData.users.map((user) => {
                  const isSelf = user.userId === currentActorId;
                  let scopeDisplay = "—";
                  if (user.scopeConfig) {
                    const cfg =
                      typeof user.scopeConfig === "string"
                        ? JSON.parse(user.scopeConfig)
                        : user.scopeConfig;
                    if (cfg.scope === "ALL") scopeDisplay = "Toàn trường";
                    else if (cfg.departmentId) scopeDisplay = `Khoa ${cfg.departmentId}`;
                    else if (cfg.departments) scopeDisplay = `Khoa ${cfg.departments.join(", ")}`;
                  }

                  return (
                    <tr
                      key={user.userId}
                      className="transition hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            {user.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-white">
                              {user.fullName}
                              {isSelf && (
                                <span className="py-0.2 rounded bg-indigo-100 px-1.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              Tạo ngày {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-medium text-neutral-700 dark:text-neutral-300">
                        {user.userId}
                      </td>
                      <td className="px-5 py-3.5">{getRoleBadge(user.role)}</td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                        {user.email}
                      </td>
                      <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-400">
                        {scopeDisplay}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditOpen(user)}
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingUser(user)}
                            disabled={isSelf}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 transition ${
                              isSelf
                                ? "cursor-not-allowed text-neutral-300 dark:border-neutral-800 dark:text-neutral-600"
                                : "cursor-pointer text-rose-600 hover:bg-rose-50 dark:border-neutral-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            }`}
                            title={isSelf ? "Không thể tự xóa bản thân" : "Xóa tài khoản"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        {/* Pagination summary */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50/50 px-5 py-3 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div>
            Hiển thị {initialData.users.length} trên tổng số {initialData.total} người dùng
          </div>
          <div>
            Trang {initialData.page} / {initialData.totalPages}
          </div>
        </div>
      </div>

      {/* Modal Tạo Người Dùng */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Thêm Người Dùng Mới
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Mã người dùng (MSSV/ID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.userId}
                    onChange={(e) => setCreateForm({ ...createForm, userId: e.target.value })}
                    placeholder="VD: B2101001 hoặc QLDT002"
                    className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Vai trò (Role) *
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        role: e.target.value as UserRoleType,
                        email:
                          e.target.value === "STUDENT" && createForm.userId
                            ? `${createForm.userId.toLowerCase()}@student.ctuet.edu.vn`
                            : createForm.email,
                      })
                    }

                    className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <option value="STUDENT">Sinh viên (STUDENT)</option>
                    <option value="ADVISOR">Cố vấn học tập (ADVISOR)</option>
                    <option value="TRAINING_OFFICER">Cán bộ QLĐT (TRAINING_OFFICER)</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="VD: Nguyễn Văn An"
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Địa chỉ Email *
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder={
                    createForm.role === "STUDENT"
                      ? "mssv@student.ctuet.edu.vn"
                      : "canbo@ctuet.edu.vn"
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                />
                {createForm.role === "STUDENT" && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    Bắt buộc email sinh viên có đuôi @student.ctuet.edu.vn (theo
                    09-data-schema-identity.md)
                  </p>
                )}
              </div>

              {/* Phạm vi cho QLĐT hoặc CVHT */}
              {(createForm.role === "TRAINING_OFFICER" || createForm.role === "ADVISOR") && (
                <div className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Phạm vi truy cập dữ liệu (scopeConfig)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={createForm.scope}
                      onChange={(e) => setCreateForm({ ...createForm, scope: e.target.value })}
                      className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <option value="ALL">Toàn trường</option>
                      <option value="DEPARTMENT">Theo Khoa cụ thể</option>
                    </select>
                    {createForm.scope === "DEPARTMENT" && (
                      <select
                        value={createForm.departmentId}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, departmentId: e.target.value })
                        }
                        className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900"
                      >
                        <option value="CNTT">Khoa Công nghệ Thông tin</option>
                        <option value="DTVT">Khoa Điện tử - Viễn thông</option>
                        <option value="QTKD">Khoa Quản trị Kinh doanh</option>
                        <option value="CK">Khoa Cơ khí</option>
                      </select>
                    )}
                  </div>
                </div>
              )}

              {/* Thông tin lớp cho sinh viên */}
              {createForm.role === "STUDENT" && (
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <div>
                    <label className="font-semibold text-neutral-600 dark:text-neutral-400">
                      Lớp
                    </label>
                    <input
                      type="text"
                      value={createForm.classId}
                      onChange={(e) => setCreateForm({ ...createForm, classId: e.target.value })}
                      className="mt-1 w-full rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-neutral-600 dark:text-neutral-400">
                      Khoa
                    </label>
                    <select
                      value={createForm.departmentId}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, departmentId: e.target.value })
                      }
                      className="mt-1 w-full rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <option value="CNTT">CNTT</option>
                      <option value="DTVT">DTVT</option>
                      <option value="QTKD">QTKD</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-neutral-600 dark:text-neutral-400">
                      Khóa
                    </label>
                    <input
                      type="text"
                      value={createForm.cohortYear}
                      onChange={(e) => setCreateForm({ ...createForm, cohortYear: e.target.value })}
                      className="mt-1 w-full rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg border border-neutral-200 px-4 py-2 font-semibold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-indigo-700"
                >
                  Tạo Tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa Người Dùng & STRIDE Notice */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Chỉnh sửa Người Dùng: {editingUser.userId}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* STRIDE ELEVATION OF PRIVILEGE NOTICE */}
            {editingUser.userId === currentActorId && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <div className="font-bold">Bảo vệ STRIDE Elevation of Privilege</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    Bạn đang chỉnh sửa tài khoản của chính mình. Để ngăn chặn việc tự nâng/hạ quyền,
                    các trường Vai trò và Phạm vi phân quyền đã được khóa tự động.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Địa chỉ Email *
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Vai trò (Role)
                </label>
                <select
                  disabled={editingUser.userId === currentActorId}
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as UserRoleType })
                  }

                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <option value="STUDENT">Sinh viên (STUDENT)</option>
                  <option value="ADVISOR">Cố vấn học tập (ADVISOR)</option>
                  <option value="TRAINING_OFFICER">Cán bộ QLĐT (TRAINING_OFFICER)</option>
                  <option value="ADMIN">Quản trị viên (ADMIN)</option>
                </select>
              </div>

              {/* ScopeConfig */}
              <div className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Phạm vi truy cập (scopeConfig)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    disabled={editingUser.userId === currentActorId}
                    value={editForm.scope}
                    onChange={(e) => setEditForm({ ...editForm, scope: e.target.value })}
                    className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <option value="ALL">Toàn trường</option>
                    <option value="DEPARTMENT">Theo Khoa cụ thể</option>
                  </select>
                  {editForm.scope === "DEPARTMENT" && (
                    <select
                      disabled={editingUser.userId === currentActorId}
                      value={editForm.departmentId}
                      onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                      className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <option value="CNTT">Khoa CNTT</option>
                      <option value="DTVT">Khoa ĐTVT</option>
                      <option value="QTKD">Khoa QTKD</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg border border-neutral-200 px-4 py-2 font-semibold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-indigo-700"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xóa Tài Khoản */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-2 flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Xác nhận Xóa Tài Khoản
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              Bạn có chắc chắn muốn xóa tài khoản <strong>{deletingUser.fullName}</strong> (Mã:{" "}
              <code className="font-mono font-bold">{deletingUser.userId}</code>)? Thao tác này sẽ
              ghi nhận vào nhật ký kiểm toán.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteSubmit}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
