import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeChecksum, exportErrorRowsAsCSV, discardBatch } from "../services/import.service";
import { prisma } from "@/lib/prisma";

type MockImportBatch = Awaited<ReturnType<typeof prisma.importBatch.create>>;
type MockEnrollment = Awaited<ReturnType<typeof prisma.enrollment.findFirst>>;
type MockSchedule = Awaited<ReturnType<typeof prisma.courseSessionSchedule.findFirst>>;
type MockAttendanceRecord = Awaited<ReturnType<typeof prisma.attendanceRecord.create>>;
type MockErrorRows = Awaited<ReturnType<typeof prisma.importErrorRow.findMany>>;

// Mock Prisma for lifecycle and query isolation tests
vi.mock("@/lib/prisma", () => ({
  prisma: {
    importBatch: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    importErrorRow: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    enrollment: {
      findFirst: vi.fn(),
    },
    courseSessionSchedule: {
      findFirst: vi.fn(),
    },
    attendanceRecord: {
      create: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    assessmentResult: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    lMSActivityEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("FR-IMP-08: Checksum Deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates stable SHA-256 checksum for CSV content", () => {
    const csvContent = "studentId,courseSectionId\nB210001,CT101-01";
    const hash = computeChecksum(csvContent);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(computeChecksum(csvContent));
  });

  it("rejects import when identical checksum already exists in active batch", async () => {
    const { processImport } = await import("../services/import.service");
    const csv =
      "studentId,courseSectionId,sessionDate,attendanceStatus\nB210001,CT101-01,2026-09-07,PRESENT";

    // Simulate existing batch with same checksum
    vi.mocked(prisma.importBatch.findFirst).mockResolvedValueOnce({
      id: "batch-existing-123",
      sourceChecksum: computeChecksum(csv),
    } as unknown as MockImportBatch);

    await expect(
      processImport({
        csvContent: csv,
        dataType: "ATTENDANCE",
        source: "FILE",
        performedBy: "QLDT001",
        originalFilePath: "imports/test.csv",
      })
    ).rejects.toThrow(/File đã được nhập trước đó/);
  });
});

describe("FR-IMP-09: Discard STAGED Batch Constraint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully discards a batch when status is STAGED", async () => {
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValueOnce({
      id: "batch-staged-1",
      status: "STAGED",
    } as unknown as MockImportBatch);

    vi.mocked(prisma.importBatch.update).mockResolvedValueOnce({
      id: "batch-staged-1",
      status: "DISCARDED",
    } as unknown as MockImportBatch);

    await expect(discardBatch("batch-staged-1")).resolves.toBeUndefined();
    expect(prisma.importBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-staged-1" },
      data: expect.objectContaining({ status: "DISCARDED" }),
    });
  });

  it("refuses to discard a batch when status is already LOADED (protecting Rule Engine integrity)", async () => {
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValueOnce({
      id: "batch-loaded-1",
      status: "LOADED",
    } as unknown as MockImportBatch);

    await expect(discardBatch("batch-loaded-1")).rejects.toThrow(
      /Chỉ có thể hủy batch ở trạng thái STAGED/
    );
    expect(prisma.importBatch.update).not.toHaveBeenCalled();
  });

  it("refuses to discard a batch when status is RECONCILED", async () => {
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValueOnce({
      id: "batch-reconciled-1",
      status: "RECONCILED",
    } as unknown as MockImportBatch);

    await expect(discardBatch("batch-reconciled-1")).rejects.toThrow(
      /Chỉ có thể hủy batch ở trạng thái STAGED/
    );
  });

  it("throws when batch ID does not exist", async () => {
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValueOnce(null);

    await expect(discardBatch("non-existent")).rejects.toThrow(/Batch không tồn tại/);
  });
});

describe("FR-IMP-10 & FR-IMP-11: Enrollment Verification & Rule Engine Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags row with NOT_ENROLLED when student is not registered in section", async () => {
    const { processImport } = await import("../services/import.service");
    const csv =
      "studentId,courseSectionId,sessionDate,attendanceStatus\nB210999,CT101-01,2026-09-07,PRESENT";

    // No existing duplicate batch
    vi.mocked(prisma.importBatch.findFirst).mockResolvedValueOnce(null);

    // Create batch
    vi.mocked(prisma.importBatch.create).mockResolvedValueOnce({
      id: "batch-unregistered-student",
      status: "UPLOADING",
    } as unknown as MockImportBatch);

    vi.mocked(prisma.importBatch.update).mockResolvedValue({
      id: "batch-unregistered-student",
    } as unknown as MockImportBatch);

    // Enrollment lookup returns null (student not enrolled)
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValueOnce(null);

    const result = await processImport({
      csvContent: csv,
      dataType: "ATTENDANCE",
      source: "FILE",
      performedBy: "QLDT001",
      originalFilePath: "imports/test.csv",
    });

    // When 0 valid rows, status should be REJECTED
    expect(result.status).toBe("REJECTED");
    expect(result.errorRows).toBe(1);
    expect(result.successRows).toBe(0);

    // Verify error row was persisted with NOT_ENROLLED
    expect(prisma.importErrorRow.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          errorReason: "NOT_ENROLLED",
          sourceRowNumber: 2,
        }),
      ]),
    });

    // CRITICAL: Ensure NO domain AttendanceRecord was created (Rule Engine isolation)
    expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
    expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
  });

  it("loads valid rows into domain records when enrollment is verified (status reaches RECONCILED)", async () => {
    const { processImport } = await import("../services/import.service");
    const csv =
      "studentId,courseSectionId,sessionDate,attendanceStatus\nB210001,CT101-01,2026-09-07,PRESENT";

    vi.mocked(prisma.importBatch.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.importBatch.create).mockResolvedValueOnce({
      id: "batch-valid-1",
      status: "UPLOADING",
    } as unknown as MockImportBatch);
    vi.mocked(prisma.importBatch.update).mockResolvedValue({
      id: "batch-valid-1",
    } as unknown as MockImportBatch);

    // Enrollment found for validation & load
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
      enrollmentId: "enr-001",
      studentId: "B210001",
      courseSectionId: "CT101-01",
      enrollmentStatus: "REGISTERED",
    } as unknown as MockEnrollment);

    // CourseSessionSchedule found for validation & load
    vi.mocked(prisma.courseSessionSchedule.findFirst).mockResolvedValue({
      sessionId: "session-001",
      sessionScheduleId: "session-001",
    } as unknown as MockSchedule);

    // Attendance record upserted successfully
    vi.mocked(prisma.attendanceRecord.upsert).mockResolvedValueOnce({
      id: "att-001",
    } as unknown as MockAttendanceRecord);

    const result = await processImport({
      csvContent: csv,
      dataType: "ATTENDANCE",
      source: "FILE",
      performedBy: "QLDT001",
      originalFilePath: "imports/test.csv",
    });

    expect(result.status).toBe("RECONCILED");
    expect(result.successRows).toBe(1);
    expect(result.errorRows).toBe(0);
    expect(prisma.attendanceRecord.upsert).toHaveBeenCalled();
  });
});

describe("FR-IMP-06 & FR-IMP-07: Error Export & Re-import Linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports error rows as formatted CSV with source row number and error reason", async () => {
    vi.mocked(prisma.importErrorRow.findMany).mockResolvedValueOnce([
      {
        id: "err-1",
        importBatchId: "batch-err-1",
        sourceRowNumber: 2,
        errorReason: "NOT_ENROLLED",
        resolved: false,
        rawData: {
          studentId: "B210999",
          courseSectionId: "CT101-01",
          sessionDate: "2026-09-07",
          attendanceStatus: "PRESENT",
        },
      },
    ] as unknown as MockErrorRows);

    const csvOutput = await exportErrorRowsAsCSV("batch-err-1");
    expect(csvOutput).toContain(
      "sourceRowNumber,errorReason,studentId,courseSectionId,sessionDate,attendanceStatus"
    );
    expect(csvOutput).toContain("2,NOT_ENROLLED,B210999,CT101-01,2026-09-07,PRESENT");
  });

  it("re-import links new batch with parentBatchId", async () => {
    const { processImport } = await import("../services/import.service");
    const correctedCsv =
      "studentId,courseSectionId,sessionDate,attendanceStatus\nB210001,CT101-01,2026-09-07,PRESENT";

    vi.mocked(prisma.importBatch.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.importBatch.create).mockResolvedValueOnce({
      id: "batch-fixed-2",
      parentBatchId: "batch-err-1",
      status: "UPLOADING",
    } as unknown as MockImportBatch);
    vi.mocked(prisma.importBatch.update).mockResolvedValue({
      id: "batch-fixed-2",
    } as unknown as MockImportBatch);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
      enrollmentId: "enr-001",
      studentId: "B210001",
      courseSectionId: "CT101-01",
      enrollmentStatus: "REGISTERED",
    } as unknown as MockEnrollment);
    vi.mocked(prisma.courseSessionSchedule.findFirst).mockResolvedValue({
      sessionId: "session-001",
      sessionScheduleId: "session-001",
    } as unknown as MockSchedule);
    vi.mocked(prisma.attendanceRecord.upsert).mockResolvedValueOnce({
      id: "att-002",
    } as unknown as MockAttendanceRecord);

    const result = await processImport({
      csvContent: correctedCsv,
      dataType: "ATTENDANCE",
      source: "FILE",
      performedBy: "QLDT001",
      originalFilePath: "imports/fixed.csv",
      parentBatchId: "batch-err-1",
    });

    expect(result.status).toBe("RECONCILED");
    expect(prisma.importBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentBatchId: "batch-err-1",
      }),
    });
  });

  it("complete roundtrip: import file with errors -> export error rows -> fix errors -> re-import linked with parentBatchId", async () => {
    const { processImport } = await import("../services/import.service");

    // 1. Initial file with 1 valid row and 1 invalid row (student not enrolled)
    const initialCsv = [
      "studentId,courseSectionId,sessionDate,attendanceStatus",
      "B210001,CT101-01,2026-09-07,PRESENT",
      "B210999,CT101-01,2026-09-07,PRESENT",
    ].join("\n");

    vi.mocked(prisma.importBatch.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.importBatch.create).mockResolvedValueOnce({
      id: "batch-roundtrip-1",
      status: "UPLOADING",
    } as unknown as MockImportBatch);
    vi.mocked(prisma.importBatch.update).mockResolvedValue({
      id: "batch-roundtrip-1",
    } as unknown as MockImportBatch);

    // B210001 enrolled, B210999 not enrolled
    vi.mocked(prisma.enrollment.findFirst)
      .mockResolvedValueOnce({
        enrollmentId: "enr-001",
        studentId: "B210001",
        courseSectionId: "CT101-01",
        enrollmentStatus: "REGISTERED",
      } as unknown as MockEnrollment)
      .mockResolvedValueOnce(null) // for B210999 in validation
      .mockResolvedValueOnce({
        enrollmentId: "enr-001",
        studentId: "B210001",
        courseSectionId: "CT101-01",
        enrollmentStatus: "REGISTERED",
      } as unknown as MockEnrollment); // for loading valid row

    vi.mocked(prisma.courseSessionSchedule.findFirst).mockResolvedValue({
      sessionId: "session-001",
      sessionScheduleId: "session-001",
    } as unknown as MockSchedule);
    vi.mocked(prisma.attendanceRecord.upsert).mockResolvedValue({
      id: "att-roundtrip-1",
    } as unknown as MockAttendanceRecord);

    const step1Result = await processImport({
      csvContent: initialCsv,
      dataType: "ATTENDANCE",
      source: "FILE",
      performedBy: "QLDT001",
      originalFilePath: "imports/initial.csv",
    });

    expect(step1Result.status).toBe("RECONCILED");
    expect(step1Result.successRows).toBe(1);
    expect(step1Result.errorRows).toBe(1);

    // 2. Export error rows
    vi.mocked(prisma.importErrorRow.findMany).mockResolvedValueOnce([
      {
        id: "err-rt-1",
        importBatchId: "batch-roundtrip-1",
        sourceRowNumber: 3,
        errorReason: "NOT_ENROLLED",
        resolved: false,
        rawData: {
          studentId: "B210999",
          courseSectionId: "CT101-01",
          sessionDate: "2026-09-07",
          attendanceStatus: "PRESENT",
        },
      },
    ] as unknown as MockErrorRows);

    const errorCsv = await exportErrorRowsAsCSV("batch-roundtrip-1");
    expect(errorCsv).toContain("3,NOT_ENROLLED,B210999,CT101-01,2026-09-07,PRESENT");

    // 3. User corrects the student ID from B210999 to B210002 and re-imports
    const correctedCsv = [
      "studentId,courseSectionId,sessionDate,attendanceStatus",
      "B210002,CT101-01,2026-09-07,PRESENT",
    ].join("\n");

    vi.mocked(prisma.importBatch.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.importBatch.create).mockResolvedValueOnce({
      id: "batch-roundtrip-2",
      parentBatchId: "batch-roundtrip-1",
      status: "UPLOADING",
    } as unknown as MockImportBatch);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
      enrollmentId: "enr-002",
      studentId: "B210002",
      courseSectionId: "CT101-01",
      enrollmentStatus: "REGISTERED",
    } as unknown as MockEnrollment);

    const step3Result = await processImport({
      csvContent: correctedCsv,
      dataType: "ATTENDANCE",
      source: "FILE",
      performedBy: "QLDT001",
      originalFilePath: "imports/corrected.csv",
      parentBatchId: "batch-roundtrip-1",
    });

    expect(step3Result.status).toBe("RECONCILED");
    expect(step3Result.successRows).toBe(1);
    expect(step3Result.errorRows).toBe(0);
    expect(prisma.importBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentBatchId: "batch-roundtrip-1",
      }),
    });
  });
});
