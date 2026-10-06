"use server";

import { getSession } from "@/lib/session";
import { AuthorizationError } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import {
  CreateUserSchema,
  UpdateUserSchema,
  DeleteUserSchema,
  ListUsersFilterSchema,
} from "../validators/user.schema";
import {
  listUsersService,
  getUserByIdService,
  createUserService,
  updateUserService,
  deleteUserService,
} from "../services/user.service";

/**
 * Kiểm tra người dùng có quyền quản trị tối cao (ADMIN).
 */
async function requireAdminSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new AuthorizationError("Yêu cầu đăng nhập để thực hiện thao tác này", 401);
  }
  if (session.user.role !== "ADMIN") {
    throw new AuthorizationError("Chỉ Quản trị viên hệ thống (ADMIN) mới có quyền truy cập", 403);
  }
  return session;
}

/**
 * Server Action lấy danh sách người dùng có phân trang.
 */
export async function listUsersAction(rawInput: unknown) {
  await requireAdminSession();
  const filter = ListUsersFilterSchema.parse(rawInput || {});
  return await listUsersService(filter);
}

/**
 * Server Action lấy thông tin chi tiết một người dùng.
 */
export async function getUserAction(rawInput: { userId: string }) {
  await requireAdminSession();
  if (!rawInput?.userId) {
    throw new Error("Mã người dùng không hợp lệ");
  }
  return await getUserByIdService(rawInput.userId);
}

/**
 * Server Action tạo mới người dùng.
 * Bắt buộc kiểm tra email SV đuôi @student.ctuet.edu.vn và ghi Audit Log.
 */
export async function createUserAction(rawInput: unknown) {
  const session = await requireAdminSession();
  const input = CreateUserSchema.parse(rawInput);

  const newUser = await createUserService(input);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "CREATE_USER",
    targetEntity: "User",
    targetId: newUser.userId,
    details: {
      fullName: newUser.fullName,
      role: newUser.role,
      email: newUser.email,
    },
  });

  return newUser;
}

/**
 * Server Action cập nhật người dùng.
 * THỰC THI STRIDE Elevation of Privilege:
 * Tuyệt đối CHẶN người dùng tự nâng/sửa vai trò hoặc scopeConfig của chính mình.
 */
export async function updateUserAction(rawInput: unknown) {
  const session = await requireAdminSession();
  const input = UpdateUserSchema.parse(rawInput);

  const userObj = session.user as Record<string, unknown>;
  const effectiveActorId = (userObj.userId as string) || (userObj.id as string) || session.user.id;

  // STRIDE CHECK: Chống Elevation of Privilege (tự nâng quyền)
  if (effectiveActorId === input.userId) {
    if (input.role !== undefined && input.role !== session.user.role) {
      throw new AuthorizationError(
        "Người dùng không được phép tự thay đổi vai trò của chính mình (Elevation of Privilege prevented)",
        403
      );
    }
    if (input.scopeConfig !== undefined) {
      throw new AuthorizationError(
        "Người dùng không được phép tự thay đổi phạm vi phân quyền của chính mình (Elevation of Privilege prevented)",
        403
      );
    }
  }

  const updatedUser = await updateUserService(input);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "UPDATE_USER",
    targetEntity: "User",
    targetId: updatedUser.userId,
    details: {
      role: updatedUser.role,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
    },
  });

  return updatedUser;
}

/**
 * Server Action xóa người dùng khỏi hệ thống.
 * Chặn tự xóa tài khoản của chính mình.
 */
export async function deleteUserAction(rawInput: unknown) {
  const session = await requireAdminSession();
  const input = DeleteUserSchema.parse(rawInput);

  const userObj = session.user as Record<string, unknown>;
  const effectiveActorId = (userObj.userId as string) || (userObj.id as string) || session.user.id;

  if (effectiveActorId === input.userId) {
    throw new AuthorizationError(
      "Quản trị viên không được phép tự xóa tài khoản của chính mình",
      400
    );
  }

  const deletedUser = await deleteUserService(input.userId);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "DELETE_USER",
    targetEntity: "User",
    targetId: deletedUser.userId,
    details: {
      fullName: deletedUser.fullName,
      role: deletedUser.role,
    },
  });

  return { success: true, userId: deletedUser.userId };
}
