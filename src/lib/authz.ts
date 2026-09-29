import { prisma } from "./prisma";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface UserSessionContext {
  id: string;
  userId?: string;
  role: string;
  email?: string;
  scopeConfig?: unknown;
}

export interface ScopeCheckOptions {
  studentId?: string;
  departmentId?: string;
  resourceType?: string;
  action?: "READ" | "WRITE" | "DELETE" | "APPROVE";
}

/**
 * Kiểm tra phạm vi truy cập dữ liệu theo đúng Ma trận Scope-based Authorization (00-project-context.md).
 * Bắt buộc gọi ở tầng Server Action / Route Handler trước khi truy vấn dữ liệu sinh viên.
 */
export async function assertScope(
  user: UserSessionContext | null | undefined,
  options: ScopeCheckOptions = {}
): Promise<void> {
  if (!user) {
    throw new AuthorizationError("Yêu cầu đăng nhập để truy cập tài nguyên này", 401);
  }

  const effectiveUserId = user.userId || user.id;
  const role = user.role;

  // 1. ADMIN: Toàn quyền truy cập vận hành
  if (role === "ADMIN") {
    return;
  }

  // 2. STUDENT: Chỉ được phép truy cập dữ liệu của chính mình
  if (role === "STUDENT") {
    if (options.studentId && options.studentId !== effectiveUserId) {
      throw new AuthorizationError("Sinh viên chỉ được phép truy vấn dữ liệu của chính mình", 403);
    }
    return;
  }

  // 3. ADVISOR (CVHT): Chỉ sinh viên đang phụ trách (Student.advisorId === user.userId)
  if (role === "ADVISOR") {
    if (!options.studentId) {
      return; // Không giới hạn student cụ thể (ví dụ xem trang danh sách của chính mình)
    }

    const student = await prisma.student.findUnique({
      where: { studentId: options.studentId },
      select: { advisorId: true },
    });

    if (!student) {
      throw new AuthorizationError("Không tìm thấy thông tin sinh viên", 404);
    }

    if (student.advisorId !== effectiveUserId) {
      throw new AuthorizationError(
        "Cố vấn học tập không có quyền truy cập sinh viên thuộc quyền phụ trách của cố vấn khác",
        403
      );
    }
    return;
  }

  // 4. TRAINING_OFFICER (QLĐT): Theo phạm vi User.scopeConfig
  if (role === "TRAINING_OFFICER") {
    if (!options.studentId && !options.departmentId) {
      return;
    }

    let allowedDepartments: string[] = [];
    if (user.scopeConfig) {
      try {
        const config =
          typeof user.scopeConfig === "string"
            ? JSON.parse(user.scopeConfig)
            : (user.scopeConfig as Record<string, unknown>);

        if (config.scope === "ALL" || config.departmentId === "ALL") {
          return; // Toàn trường
        }
        if (Array.isArray(config.departments)) {
          allowedDepartments = config.departments;
        } else if (typeof config.departmentId === "string") {
          allowedDepartments = [config.departmentId];
        }
      } catch {
        allowedDepartments = [];
      }
    }

    if (options.departmentId && !allowedDepartments.includes(options.departmentId)) {
      throw new AuthorizationError("Cán bộ quản lý đào tạo không phụ trách khoa này", 403);
    }

    if (options.studentId) {
      const student = await prisma.student.findUnique({
        where: { studentId: options.studentId },
        select: { departmentId: true },
      });

      if (!student) {
        throw new AuthorizationError("Không tìm thấy thông tin sinh viên", 404);
      }

      if (allowedDepartments.length > 0 && !allowedDepartments.includes(student.departmentId)) {
        throw new AuthorizationError(
          "Sinh viên không thuộc khoa trong phạm vi phụ trách của cán bộ",
          403
        );
      }
    }

    return;
  }

  throw new AuthorizationError("Vai trò người dùng không hợp lệ", 403);
}
