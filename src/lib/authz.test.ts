import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertScope, AuthorizationError } from "./authz";
import { prisma } from "./prisma";

vi.mock("./prisma", () => ({
  prisma: {
    student: {
      findUnique: vi.fn(),
    },
  },
}));

type MockStudent = Awaited<ReturnType<typeof prisma.student.findUnique>>;

describe("assertScope Authorization Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chặn truy cập khi chưa đăng nhập (user null)", async () => {
    await expect(assertScope(null, { studentId: "SV01" })).rejects.toThrow(AuthorizationError);
    await expect(assertScope(undefined)).rejects.toThrow("Yêu cầu đăng nhập");
  });

  describe("Role: STUDENT", () => {
    const studentUser = {
      id: "B2101234",
      userId: "B2101234",
      role: "STUDENT",
      email: "b2101234@student.ctuet.edu.vn",
    };

    it("cho phép sinh viên xem dữ liệu của chính mình", async () => {
      await expect(assertScope(studentUser, { studentId: "B2101234" })).resolves.not.toThrow();
    });

    it("chặn sinh viên xem dữ liệu của sinh viên khác", async () => {
      await expect(assertScope(studentUser, { studentId: "B2109999" })).rejects.toThrow(
        "Sinh viên chỉ được phép truy vấn dữ liệu của chính mình"
      );
    });
  });

  describe("Role: ADVISOR", () => {
    const advisorA = { id: "GV01", userId: "GV01", role: "ADVISOR" };

    it("cho phép CVHT A truy vấn sinh viên do mình phụ trách", async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValueOnce({
        advisorId: "GV01",
      } as unknown as MockStudent);

      await expect(assertScope(advisorA, { studentId: "SV_CUA_A" })).resolves.not.toThrow();
      expect(prisma.student.findUnique).toHaveBeenCalledWith({
        where: { studentId: "SV_CUA_A" },
        select: { advisorId: true },
      });
    });

    it("CHẶN CVHT A truy vấn sinh viên thuộc quyền phụ trách của CVHT B", async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValueOnce({
        advisorId: "GV02", // SV này thuộc GV02
      } as unknown as MockStudent);

      await expect(assertScope(advisorA, { studentId: "SV_CUA_B" })).rejects.toThrow(
        "Cố vấn học tập không có quyền truy cập sinh viên thuộc quyền phụ trách của cố vấn khác"
      );
    });
  });

  describe("Role: TRAINING_OFFICER", () => {
    const officerDeptIT = {
      id: "QL01",
      userId: "QL01",
      role: "TRAINING_OFFICER",
      scopeConfig: JSON.stringify({ departments: ["CNTT"] }),
    };

    it("cho phép cán bộ QLĐT truy vấn sinh viên thuộc khoa trong phạm vi phụ trách", async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValueOnce({
        departmentId: "CNTT",
      } as unknown as MockStudent);

      await expect(assertScope(officerDeptIT, { studentId: "SV_CNTT" })).resolves.not.toThrow();
    });

    it("chặn cán bộ QLĐT truy vấn sinh viên ngoài khoa phụ trách", async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValueOnce({
        departmentId: "KINHTE",
      } as unknown as MockStudent);

      await expect(assertScope(officerDeptIT, { studentId: "SV_KINHTE" })).rejects.toThrow(
        "Sinh viên không thuộc khoa trong phạm vi phụ trách của cán bộ"
      );
    });

    it("cho phép cán bộ có phạm vi toàn trường truy cập mọi sinh viên", async () => {
      const officerAll = {
        id: "QL_TRUONG",
        userId: "QL_TRUONG",
        role: "TRAINING_OFFICER",
        scopeConfig: JSON.stringify({ scope: "ALL" }),
      };

      await expect(assertScope(officerAll, { studentId: "BAT_KY" })).resolves.not.toThrow();
    });
  });

  describe("Role: ADMIN", () => {
    const adminUser = { id: "ADMIN01", userId: "ADMIN01", role: "ADMIN" };

    it("ADMIN có toàn quyền truy cập vận hành", async () => {
      await expect(assertScope(adminUser, { studentId: "SV01" })).resolves.not.toThrow();
    });
  });
});
