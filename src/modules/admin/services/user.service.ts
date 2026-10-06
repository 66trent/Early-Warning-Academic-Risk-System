import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type {
  CreateUserInput,
  UpdateUserInput,
  ListUsersFilterInput,
} from "../validators/user.schema";

export interface PaginatedUsersResult {
  users: Array<{
    userId: string;
    id: string;
    fullName: string;
    role: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    scopeConfig: unknown;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
      advisedStudents: number;
      taughtSections: number;
    };
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Lấy danh sách người dùng có phân trang và bộ lọc.
 * Pure service không phụ thuộc HTTP headers/session.
 */
export async function listUsersService(
  filter: ListUsersFilterInput
): Promise<PaginatedUsersResult> {
  const { role, search, page = 1, pageSize = 20 } = filter;
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.UserWhereInput = {};

  if (role) {
    whereClause.role = role;
  }

  if (search && search.trim() !== "") {
    const term = search.trim();
    whereClause.OR = [
      { userId: { contains: term, mode: "insensitive" } },
      { fullName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where: whereClause }),
    prisma.user.findMany({
      where: whereClause,
      select: {
        userId: true,
        id: true,
        fullName: true,
        role: true,
        email: true,
        emailVerified: true,
        image: true,
        scopeConfig: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            advisedStudents: true,
            taughtSections: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Lấy chi tiết một người dùng theo userId.
 */
export async function getUserByIdService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      id: true,
      fullName: true,
      role: true,
      email: true,
      emailVerified: true,
      image: true,
      scopeConfig: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          advisedStudents: true,
          taughtSections: true,
          importBatches: true,
          interventions: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }

  return user;
}

/**
 * Tạo mới tài khoản người dùng và thiết lập liên kết cần thiết.
 * Nếu là sinh viên, đảm bảo kiểm tra hoặc tạo hồ sơ Student tương ứng.
 */
export async function createUserService(input: CreateUserInput) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ userId: input.userId }, { email: input.email }],
    },
  });

  if (existingUser) {
    if (existingUser.userId === input.userId) {
      throw new Error(`Mã người dùng '${input.userId}' đã tồn tại trong hệ thống`);
    }
    throw new Error(`Email '${input.email}' đã được sử dụng bởi tài khoản khác`);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Tạo bản ghi User
    const user = await tx.user.create({
      data: {
        userId: input.userId,
        fullName: input.fullName,
        role: input.role,
        email: input.email,
        scopeConfig: input.scopeConfig ? (input.scopeConfig as Prisma.InputJsonValue) : undefined,
      },
    });

    // 2. Ràng buộc Student–User: với role STUDENT, tạo hồ sơ Student tương ứng nếu chưa có
    if (input.role === "STUDENT") {
      const existingStudent = await tx.student.findUnique({
        where: { studentId: input.userId },
      });

      if (!existingStudent) {
        // Tìm 1 advisor mặc định nếu chưa chỉ định
        const defaultAdvisor = await tx.user.findFirst({
          where: { role: "ADVISOR" },
        });

        await tx.student.create({
          data: {
            studentId: input.userId,
            fullName: input.fullName,
            classId: input.studentMetadata?.classId || "CNTT-K47",
            departmentId: input.studentMetadata?.departmentId || "CNTT",
            cohortYear: input.studentMetadata?.cohortYear || "2024",
            advisorId: input.studentMetadata?.advisorId || defaultAdvisor?.userId || "GV001",
            officialAcademicStatus: "ACTIVE",
          },
        });
      }
    }

    return user;
  });
}

/**
 * Cập nhật thông tin tài khoản người dùng.
 */
export async function updateUserService(input: UpdateUserInput) {
  const existingUser = await prisma.user.findUnique({
    where: { userId: input.userId },
  });

  if (!existingUser) {
    throw new Error("Không tìm thấy người dùng cần cập nhật");
  }

  if (input.email && input.email !== existingUser.email) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (emailConflict) {
      throw new Error(`Email '${input.email}' đã được sử dụng bởi người dùng khác`);
    }
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (input.fullName !== undefined) updateData.fullName = input.fullName;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.scopeConfig !== undefined) {
    updateData.scopeConfig = input.scopeConfig
      ? (input.scopeConfig as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  }

  const updatedUser = await prisma.user.update({
    where: { userId: input.userId },
    data: updateData,
    select: {
      userId: true,
      id: true,
      fullName: true,
      role: true,
      email: true,
      scopeConfig: true,
      updatedAt: true,
    },
  });

  return updatedUser;
}

/**
 * Xóa tài khoản người dùng khỏi hệ thống.
 */
export async function deleteUserService(userId: string) {
  const existingUser = await prisma.user.findUnique({
    where: { userId },
  });

  if (!existingUser) {
    throw new Error("Không tìm thấy người dùng cần xóa");
  }

  return await prisma.user.delete({
    where: { userId },
  });
}
