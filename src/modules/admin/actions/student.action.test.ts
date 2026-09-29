import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStudentProfileAction } from "./student.action";
import * as sessionModule from "@/lib/session";
import * as studentServiceModule from "../services/student.service";
import * as auditModule from "@/lib/audit";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("../services/student.service", () => ({
  getStudentProfileService: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

type MockSessionReturn = Awaited<ReturnType<typeof sessionModule.getSession>>;
type MockProfile = Awaited<ReturnType<typeof studentServiceModule.getStudentProfileService>>;
type MockStudentReturn = Awaited<ReturnType<typeof prisma.student.findUnique>>;

describe("Phase 1 Server Action: getStudentProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Role STUDENT xem đúng hồ sơ của chính mình", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
      user: { id: "B2101001", role: "STUDENT" },
      session: { id: "s1" },
    } as unknown as MockSessionReturn);

    const mockProfile = {
      studentId: "B2101001",
      fullName: "Sinh viên Demo 001",
    } as unknown as MockProfile;
    vi.mocked(studentServiceModule.getStudentProfileService).mockResolvedValueOnce(mockProfile);

    const result = await getStudentProfileAction({ studentId: "B2101001" });
    expect(result).toEqual(mockProfile);
    expect(studentServiceModule.getStudentProfileService).toHaveBeenCalledWith({
      studentId: "B2101001",
    });
  });

  it("2. Role STUDENT bị chặn khi cố xem hồ sơ sinh viên khác", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
      user: { id: "B2101001", role: "STUDENT" },
      session: { id: "s1" },
    } as unknown as MockSessionReturn);

    await expect(getStudentProfileAction({ studentId: "B2101002" })).rejects.toThrow(
      "Sinh viên chỉ được phép truy vấn dữ liệu của chính mình"
    );
    expect(studentServiceModule.getStudentProfileService).not.toHaveBeenCalled();
  });

  it("3. Role ADVISOR A xem được sinh viên mình phụ trách", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
      user: { id: "GV001", role: "ADVISOR" },
      session: { id: "s1" },
    } as unknown as MockSessionReturn);

    vi.mocked(prisma.student.findUnique).mockResolvedValueOnce({
      advisorId: "GV001",
    } as unknown as MockStudentReturn);

    const mockProfile = {
      studentId: "B2101001",
      advisorId: "GV001",
    } as unknown as MockProfile;
    vi.mocked(studentServiceModule.getStudentProfileService).mockResolvedValueOnce(mockProfile);

    const result = await getStudentProfileAction({ studentId: "B2101001" });
    expect(result).toEqual(mockProfile);
  });

  it("4. Role ADVISOR A bị CHẶN khi xem sinh viên của ADVISOR B", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
      user: { id: "GV001", role: "ADVISOR" },
      session: { id: "s1" },
    } as unknown as MockSessionReturn);

    vi.mocked(prisma.student.findUnique).mockResolvedValueOnce({
      advisorId: "GV002", // Thuộc GV002
    } as unknown as MockStudentReturn);

    await expect(getStudentProfileAction({ studentId: "B2101015" })).rejects.toThrow(
      "Cố vấn học tập không có quyền truy cập sinh viên thuộc quyền phụ trách của cố vấn khác"
    );
    expect(studentServiceModule.getStudentProfileService).not.toHaveBeenCalled();
  });

  it("5. Role TRAINING_OFFICER xem sinh viên và tự động ghi Audit Log", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
      user: {
        id: "QLDT001",
        role: "TRAINING_OFFICER",
        scopeConfig: JSON.stringify({ scope: "ALL" }),
      },
      session: { id: "s1" },
    } as unknown as MockSessionReturn);

    const mockProfile = {
      studentId: "B2101001",
      departmentId: "CNTT",
    } as unknown as MockProfile;
    vi.mocked(studentServiceModule.getStudentProfileService).mockResolvedValueOnce(mockProfile);

    const result = await getStudentProfileAction({ studentId: "B2101001" });
    expect(result).toEqual(mockProfile);

    // Xác nhận đã ghi Audit Log
    expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "QLDT001",
        actorRole: "TRAINING_OFFICER",
        action: "READ_STUDENT_PROFILE",
        targetEntity: "Student",
        targetId: "B2101001",
      })
    );
  });

  it("6. Role ADMIN xem sinh viên và tự động ghi Audit Log", async () => {
    vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
      user: { id: "ADMIN001", role: "ADMIN" },
      session: { id: "s1" },
    } as unknown as MockSessionReturn);

    const mockProfile = {
      studentId: "B2101005",
      departmentId: "CNTT",
    } as unknown as MockProfile;
    vi.mocked(studentServiceModule.getStudentProfileService).mockResolvedValueOnce(mockProfile);

    const result = await getStudentProfileAction({ studentId: "B2101005" });
    expect(result).toEqual(mockProfile);
    expect(auditModule.writeAuditLog).toHaveBeenCalled();
  });
});
