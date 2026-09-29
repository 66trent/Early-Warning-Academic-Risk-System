import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadImportFile, discardImportBatch, listBatches } from "../actions/import.action";
import * as sessionModule from "@/lib/session";
import * as auditModule from "@/lib/audit";
import * as importServiceModule from "../services/import.service";

type MockSessionReturn = Awaited<ReturnType<typeof sessionModule.getSession>>;

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("../services/import.service", () => ({
  processImport: vi.fn(),
  discardBatch: vi.fn(),
  listImportBatches: vi.fn(),
  getImportBatchErrors: vi.fn(),
  exportErrorRowsAsCSV: vi.fn(),
}));

vi.mock("../services/storage.service", () => ({
  uploadOriginalFile: vi.fn().mockResolvedValue("imports/test-uuid.csv"),
  downloadOriginalFile: vi.fn(),
}));

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("Data Import Server Actions: Authorization & Audit Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadImportFile action", () => {
    it("rejects unauthenticated users", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.set("dataType", "ATTENDANCE");
      const result = await uploadImportFile(formData);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Yêu cầu đăng nhập/);
    });

    it("rejects STUDENT role from importing data (403 forbidden)", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "B210001", role: "STUDENT" },
        session: { id: "s-1" },
      } as unknown as MockSessionReturn);

      const formData = new FormData();
      formData.set("dataType", "ATTENDANCE");
      formData.set("file", new File(["test"], "test.csv"));

      await expect(uploadImportFile(formData)).rejects.toThrow(
        /Chỉ cán bộ đào tạo hoặc quản trị viên/
      );
    });

    it("rejects ADVISOR role from importing data (only TRAINING_OFFICER & ADMIN)", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "GV001", role: "ADVISOR" },
        session: { id: "s-2" },
      } as unknown as MockSessionReturn);

      const formData = new FormData();
      formData.set("dataType", "ATTENDANCE");
      formData.set("file", new File(["test"], "test.csv"));

      await expect(uploadImportFile(formData)).rejects.toThrow(
        /Chỉ cán bộ đào tạo hoặc quản trị viên/
      );
    });

    it("allows TRAINING_OFFICER to import data and logs audit", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "QLDT001", role: "TRAINING_OFFICER" },
        session: { id: "s-3" },
      } as unknown as MockSessionReturn);

      vi.mocked(importServiceModule.processImport).mockResolvedValueOnce({
        batchId: VALID_UUID,
        status: "RECONCILED",
        totalRows: 10,
        successRows: 10,
        errorRows: 0,
      });

      const formData = new FormData();
      formData.set("dataType", "ATTENDANCE");
      formData.set(
        "file",
        new File(
          [
            "studentId,courseSectionId,sessionDate,attendanceStatus\nB210001,CT101-01,2026-09-07,PRESENT",
          ],
          "att.csv"
        )
      );

      const result = await uploadImportFile(formData);

      expect(result.success).toBe(true);
      expect(result.data?.batchId).toBe(VALID_UUID);
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "QLDT001",
          actorRole: "TRAINING_OFFICER",
          action: "IMPORT_FILE",
          targetEntity: "ImportBatch",
          targetId: VALID_UUID,
        })
      );
    });
  });

  describe("discardImportBatch action", () => {
    it("writes audit log when a batch is successfully discarded", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "ADMIN001", role: "ADMIN" },
        session: { id: "s-4" },
      } as unknown as MockSessionReturn);

      vi.mocked(importServiceModule.discardBatch).mockResolvedValueOnce(undefined);

      const result = await discardImportBatch({ batchId: VALID_UUID });

      expect(result.success).toBe(true);
      expect(auditModule.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "ADMIN001",
          actorRole: "ADMIN",
          action: "DISCARD_BATCH",
          targetEntity: "ImportBatch",
          targetId: VALID_UUID,
        })
      );
    });

    it("rejects discard if user is not authorized", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "B210001", role: "STUDENT" },
        session: { id: "s-5" },
      } as unknown as MockSessionReturn);

      await expect(discardImportBatch({ batchId: VALID_UUID })).rejects.toThrow(
        /Chỉ cán bộ đào tạo hoặc quản trị viên/
      );
    });
  });

  describe("listBatches action", () => {
    it("returns paginated batches for authorized user", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "QLDT001", role: "TRAINING_OFFICER" },
        session: { id: "s-6" },
      } as unknown as MockSessionReturn);

      vi.mocked(importServiceModule.listImportBatches).mockResolvedValueOnce({
        batches: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const result = await listBatches({ page: 1, pageSize: 20 });
      expect(result.success).toBe(true);
      expect(importServiceModule.listImportBatches).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
      });
    });
  });
});
