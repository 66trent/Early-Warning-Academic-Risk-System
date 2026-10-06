import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listUsersAction,
  createUserAction,
  updateUserAction,
  deleteUserAction,
} from "../actions/user.action";
import * as sessionModule from "@/lib/session";
import * as userServiceModule from "../services/user.service";
import * as auditModule from "@/lib/audit";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("../services/user.service", () => ({
  listUsersService: vi.fn(),
  getUserByIdService: vi.fn(),
  createUserService: vi.fn(),
  updateUserService: vi.fn(),
  deleteUserService: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

type MockSessionReturn = Awaited<ReturnType<typeof sessionModule.getSession>>;

describe("Phase 6 Admin: User Management & STRIDE Elevation of Privilege", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Phân quyền RBAC cho CRUD Người dùng", () => {
    it("Chặn người dùng chưa đăng nhập", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(null);

      await expect(listUsersAction({})).rejects.toThrow(
        "Yêu cầu đăng nhập để thực hiện thao tác này"
      );
    });

    it("Chặn role ADVISOR hoặc STUDENT truy cập danh sách người dùng", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "GV001", role: "ADVISOR" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(listUsersAction({})).rejects.toThrow(
        "Chỉ Quản trị viên hệ thống (ADMIN) mới có quyền truy cập"
      );
    });

    it("Role ADMIN được phép lấy danh sách người dùng", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockResult = {
        users: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
      vi.mocked(userServiceModule.listUsersService).mockResolvedValueOnce(mockResult);

      const result = await listUsersAction({ page: 1, pageSize: 20 });
      expect(result).toEqual(mockResult);
      expect(userServiceModule.listUsersService).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe("2. Tạo người dùng & Kiểm tra tên miền email Sinh viên", () => {
    it("Từ chối tạo tài khoản STUDENT nếu email không kết thúc bằng @student.ctuet.edu.vn", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(
        createUserAction({
          userId: "B2101999",
          fullName: "Nguyễn Văn Test",
          role: "STUDENT",
          email: "test.student@gmail.com", // SAI DOMAIN
        })
      ).rejects.toThrow("Email sinh viên bắt buộc phải có đuôi @student.ctuet.edu.vn");

      expect(userServiceModule.createUserService).not.toHaveBeenCalled();
    });

    it("Tạo tài khoản STUDENT thành công khi email chuẩn và ghi nhận Audit Log", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockCreated = {
        userId: "B2101999",
        fullName: "Nguyễn Văn Test",
        role: "STUDENT" as const,
        email: "b2101999@student.ctuet.edu.vn",
      };
      vi.mocked(userServiceModule.createUserService).mockResolvedValueOnce(
        mockCreated as unknown as Awaited<ReturnType<typeof userServiceModule.createUserService>>
      );

      const result = await createUserAction({
        userId: "B2101999",
        fullName: "Nguyễn Văn Test",
        role: "STUDENT",
        email: "b2101999@student.ctuet.edu.vn",
      });

      expect(result).toEqual(mockCreated);
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "ADMIN001",
          action: "CREATE_USER",
          targetEntity: "User",
          targetId: "B2101999",
        })
      );
    });
  });

  describe("3. STRIDE Elevation of Privilege: Chống tự nâng/sửa quyền của chính mình", () => {
    it("CHẶN người dùng tự đổi vai trò của chính mình (Self-role elevation)", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", userId: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(
        updateUserAction({
          userId: "ADMIN001", // Chính bản thân
          role: "STUDENT", // Cố tình đổi role
        })
      ).rejects.toThrow(
        "Người dùng không được phép tự thay đổi vai trò của chính mình (Elevation of Privilege prevented)"
      );

      expect(userServiceModule.updateUserService).not.toHaveBeenCalled();
    });

    it("CHẶN người dùng tự thay đổi scopeConfig của chính mình (Self-scope modification)", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", userId: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(
        updateUserAction({
          userId: "ADMIN001", // Chính bản thân
          scopeConfig: { scope: "ALL" },
        })
      ).rejects.toThrow(
        "Người dùng không được phép tự thay đổi phạm vi phân quyền của chính mình (Elevation of Privilege prevented)"
      );

      expect(userServiceModule.updateUserService).not.toHaveBeenCalled();
    });

    it("Cho phép cập nhật thông tin người dùng khác và ghi nhận Audit Log", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", userId: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      const mockUpdated = {
        userId: "GV002",
        id: "uuid-2",
        fullName: "Thầy Giáo Mới",
        role: "ADVISOR" as const,
        email: "gv002@ctuet.edu.vn",
        scopeConfig: null,
        updatedAt: new Date(),
      };
      vi.mocked(userServiceModule.updateUserService).mockResolvedValueOnce(mockUpdated);

      const result = await updateUserAction({
        userId: "GV002",
        fullName: "Thầy Giáo Mới",
      });

      expect(result).toEqual(mockUpdated);
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "ADMIN001",
          action: "UPDATE_USER",
          targetEntity: "User",
          targetId: "GV002",
        })
      );
    });

    it("CHẶN quản trị viên tự xóa tài khoản của chính mình", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", userId: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      await expect(
        deleteUserAction({
          userId: "ADMIN001",
        })
      ).rejects.toThrow("Quản trị viên không được phép tự xóa tài khoản của chính mình");

      expect(userServiceModule.deleteUserService).not.toHaveBeenCalled();
    });

    it("Cho phép xóa tài khoản người dùng khác và ghi nhận Audit Log", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", userId: "ADMIN001", role: "ADMIN" },
        session: { id: "s1" },
      } as unknown as MockSessionReturn);

      vi.mocked(userServiceModule.deleteUserService).mockResolvedValueOnce({
        userId: "TEMP_USER",
        fullName: "Tài khoản tạm",
        role: "STUDENT",
      } as unknown as Awaited<ReturnType<typeof userServiceModule.deleteUserService>>);

      const result = await deleteUserAction({ userId: "TEMP_USER" });

      expect(result).toEqual({ success: true, userId: "TEMP_USER" });
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "ADMIN001",
          action: "DELETE_USER",
          targetEntity: "User",
          targetId: "TEMP_USER",
        })
      );
    });
  });
});
