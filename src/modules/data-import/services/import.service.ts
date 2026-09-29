import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  type ImportDataType,
  type ImportBatchStatus,
  type DataSource,
  type AttendanceStatus,
  type ResultStatus,
  type LMSAssignmentType,
  type LMSAssignmentStatus,
  type LMSSubmissionStatus,
  type LMSEventType,
  Prisma,
} from "@/generated/prisma/client";
import {
  attendanceRowSchema,
  assessmentRowSchema,
  lmsAssignmentRowSchema,
  lmsSubmissionRowSchema,
  lmsEventRowSchema,
} from "../validators/import.schema";
import type {
  AttendanceRow,
  AssessmentRow,
  LmsAssignmentRow,
  LmsSubmissionRow,
  LmsEventRow,
} from "../validators/import.schema";

// ==========================================
// Constants
// ==========================================

const BATCH_SIZE = 500;

// ==========================================
// Types
// ==========================================

export interface ImportResult {
  batchId: string;
  status: ImportBatchStatus;
  totalRows: number;
  successRows: number;
  errorRows: number;
}

interface ParsedRow<T> {
  rowNumber: number;
  data: T | null;
  error: string | null;
  errorReason:
    "INVALID_FORMAT" | "NOT_IN_CATALOG" | "DUPLICATE" | "OUT_OF_RANGE" | "NOT_ENROLLED" | null;
  rawData: Record<string, unknown>;
}

// ==========================================
// Utility: compute SHA256 checksum
// ==========================================

export function computeChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// ==========================================
// Stage 1: Extract — Parse CSV content into rows
// ==========================================

export function parseCSVContent(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

// ==========================================
// Stage 2: Validate — Validate each row with Zod + enrollment check
// ==========================================

async function validateAttendanceRows(
  rows: Record<string, string>[]
): Promise<ParsedRow<AttendanceRow>[]> {
  const results: ParsedRow<AttendanceRow>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsed = attendanceRowSchema.safeParse(raw);

    if (!parsed.success) {
      results.push({
        rowNumber: i + 2, // +2 for 1-indexed + header row
        data: null,
        error: parsed.error.issues.map((e) => e.message).join("; "),
        errorReason: "INVALID_FORMAT",
        rawData: raw,
      });
      continue;
    }

    // Check enrollment exists
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: parsed.data.studentId,
        courseSectionId: parsed.data.courseSectionId,
        enrollmentStatus: "REGISTERED",
      },
      select: { enrollmentId: true },
    });

    if (!enrollment) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: `Sinh viên ${parsed.data.studentId} chưa đăng ký lớp ${parsed.data.courseSectionId}`,
        errorReason: "NOT_ENROLLED",
        rawData: raw,
      });
      continue;
    }

    // Check session exists
    const session = await prisma.courseSessionSchedule.findFirst({
      where: {
        courseSectionId: parsed.data.courseSectionId,
        sessionDate: new Date(parsed.data.sessionDate),
      },
      select: { sessionId: true },
    });

    if (!session) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: `Buổi học ngày ${parsed.data.sessionDate} của lớp ${parsed.data.courseSectionId} không tồn tại`,
        errorReason: "NOT_IN_CATALOG",
        rawData: raw,
      });
      continue;
    }

    results.push({
      rowNumber: i + 2,
      data: parsed.data,
      error: null,
      errorReason: null,
      rawData: raw,
    });
  }

  return results;
}

async function validateAssessmentRows(
  rows: Record<string, string>[]
): Promise<ParsedRow<AssessmentRow>[]> {
  const results: ParsedRow<AssessmentRow>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsed = assessmentRowSchema.safeParse(raw);

    if (!parsed.success) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: parsed.error.issues.map((e) => e.message).join("; "),
        errorReason: "INVALID_FORMAT",
        rawData: raw,
      });
      continue;
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: parsed.data.studentId,
        courseSectionId: parsed.data.courseSectionId,
        enrollmentStatus: "REGISTERED",
      },
      select: { enrollmentId: true },
    });

    if (!enrollment) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: `Sinh viên ${parsed.data.studentId} chưa đăng ký lớp ${parsed.data.courseSectionId}`,
        errorReason: "NOT_ENROLLED",
        rawData: raw,
      });
      continue;
    }

    results.push({
      rowNumber: i + 2,
      data: parsed.data,
      error: null,
      errorReason: null,
      rawData: raw,
    });
  }

  return results;
}

async function validateLmsAssignmentRows(
  rows: Record<string, string>[]
): Promise<ParsedRow<LmsAssignmentRow>[]> {
  const results: ParsedRow<LmsAssignmentRow>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsed = lmsAssignmentRowSchema.safeParse(raw);

    if (!parsed.success) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: parsed.error.issues.map((e) => e.message).join("; "),
        errorReason: "INVALID_FORMAT",
        rawData: raw,
      });
      continue;
    }

    // Check courseSection exists
    const section = await prisma.courseSection.findUnique({
      where: { courseSectionId: parsed.data.courseSectionId },
      select: { courseSectionId: true },
    });

    if (!section) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: `Lớp học phần ${parsed.data.courseSectionId} không tồn tại`,
        errorReason: "NOT_IN_CATALOG",
        rawData: raw,
      });
      continue;
    }

    results.push({
      rowNumber: i + 2,
      data: parsed.data,
      error: null,
      errorReason: null,
      rawData: raw,
    });
  }

  return results;
}

async function validateLmsSubmissionRows(
  rows: Record<string, string>[]
): Promise<ParsedRow<LmsSubmissionRow>[]> {
  const results: ParsedRow<LmsSubmissionRow>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsed = lmsSubmissionRowSchema.safeParse(raw);

    if (!parsed.success) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: parsed.error.issues.map((e) => e.message).join("; "),
        errorReason: "INVALID_FORMAT",
        rawData: raw,
      });
      continue;
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: parsed.data.studentId,
        courseSectionId: parsed.data.courseSectionId,
        enrollmentStatus: "REGISTERED",
      },
      select: { enrollmentId: true },
    });

    if (!enrollment) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: `Sinh viên ${parsed.data.studentId} chưa đăng ký lớp ${parsed.data.courseSectionId}`,
        errorReason: "NOT_ENROLLED",
        rawData: raw,
      });
      continue;
    }

    // Check assignment exists
    const assignment = await prisma.lMSAssignment.findUnique({
      where: { assignmentId: parsed.data.assignmentId },
      select: { assignmentId: true },
    });

    if (!assignment) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: `Bài tập ${parsed.data.assignmentId} không tồn tại`,
        errorReason: "NOT_IN_CATALOG",
        rawData: raw,
      });
      continue;
    }

    results.push({
      rowNumber: i + 2,
      data: parsed.data,
      error: null,
      errorReason: null,
      rawData: raw,
    });
  }

  return results;
}

async function validateLmsEventRows(
  rows: Record<string, string>[]
): Promise<ParsedRow<LmsEventRow>[]> {
  const results: ParsedRow<LmsEventRow>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsed = lmsEventRowSchema.safeParse(raw);

    if (!parsed.success) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: parsed.error.issues.map((e) => e.message).join("; "),
        errorReason: "INVALID_FORMAT",
        rawData: raw,
      });
      continue;
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: parsed.data.studentId,
        courseSectionId: parsed.data.courseSectionId,
        enrollmentStatus: "REGISTERED",
      },
      select: { enrollmentId: true },
    });

    if (!enrollment) {
      results.push({
        rowNumber: i + 2,
        data: null,
        error: `Sinh viên ${parsed.data.studentId} chưa đăng ký lớp ${parsed.data.courseSectionId}`,
        errorReason: "NOT_ENROLLED",
        rawData: raw,
      });
      continue;
    }

    results.push({
      rowNumber: i + 2,
      data: parsed.data,
      error: null,
      errorReason: null,
      rawData: raw,
    });
  }

  return results;
}

// ==========================================
// Stage 3–5: Process import pipeline
// ==========================================

export async function processImport(params: {
  csvContent: string;
  dataType: ImportDataType;
  source: DataSource;
  performedBy: string;
  originalFilePath: string;
  parentBatchId?: string | null;
}): Promise<ImportResult> {
  const { csvContent, dataType, source, performedBy, originalFilePath, parentBatchId } = params;

  // Check duplicate by checksum
  const checksum = computeChecksum(csvContent);
  const existingBatch = await prisma.importBatch.findFirst({
    where: { sourceChecksum: checksum, status: { notIn: ["DISCARDED", "REJECTED"] } },
    select: { id: true },
  });

  if (existingBatch) {
    throw new Error(
      `File đã được nhập trước đó (batch: ${existingBatch.id}). Không cho phép nhập trùng.`
    );
  }

  // Stage 1: Extract
  const rawRows = parseCSVContent(csvContent);
  if (rawRows.length === 0) {
    throw new Error("File không chứa dữ liệu hợp lệ.");
  }

  // Create ImportBatch with UPLOADING status
  const batch = await prisma.importBatch.create({
    data: {
      dataType,
      source,
      sourceChecksum: checksum,
      performedBy,
      status: "UPLOADING",
      totalRows: rawRows.length,
      successRows: 0,
      errorRows: 0,
      parentBatchId: parentBatchId || null,
      originalFilePath,
    },
  });

  try {
    // Transition to VALIDATING
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "VALIDATING" },
    });

    // Stage 2: Validate
    let validatedRows: ParsedRow<unknown>[];
    switch (dataType) {
      case "ATTENDANCE":
        validatedRows = await validateAttendanceRows(rawRows);
        break;
      case "ASSESSMENT":
        validatedRows = await validateAssessmentRows(rawRows);
        break;
      case "LMS_ASSIGNMENT":
        validatedRows = await validateLmsAssignmentRows(rawRows);
        break;
      case "LMS_SUBMISSION":
        validatedRows = await validateLmsSubmissionRows(rawRows);
        break;
      case "LMS_EVENT":
        validatedRows = await validateLmsEventRows(rawRows);
        break;
      default:
        throw new Error(`Loại dữ liệu ${dataType} chưa được hỗ trợ nhập.`);
    }

    const validRows = validatedRows.filter((r) => r.data !== null);
    const errorRowsList = validatedRows.filter((r) => r.data === null);

    // Save error rows
    if (errorRowsList.length > 0) {
      await prisma.importErrorRow.createMany({
        data: errorRowsList.map((r) => ({
          importBatchId: batch.id,
          sourceRowNumber: r.rowNumber,
          rawData: r.rawData as Prisma.InputJsonObject,
          errorReason: r.errorReason!,
        })),
      });
    }

    // If ALL rows are errors, reject the batch
    if (validRows.length === 0) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "REJECTED",
          errorRows: errorRowsList.length,
          completedAt: new Date(),
        },
      });

      return {
        batchId: batch.id,
        status: "REJECTED",
        totalRows: rawRows.length,
        successRows: 0,
        errorRows: errorRowsList.length,
      };
    }

    // Stage 3: STAGED
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "STAGED", errorRows: errorRowsList.length },
    });

    // Stage 4: LOAD — batch insert in chunks
    let loadedCount = 0;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const chunk = validRows.slice(i, i + BATCH_SIZE);
      const count = await loadChunk(dataType, chunk, batch.id);
      loadedCount += count;
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "LOADED", successRows: loadedCount },
    });

    // Stage 5: Reconcile
    const finalStatus: ImportBatchStatus =
      loadedCount === validRows.length ? "RECONCILED" : "LOADED";

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: finalStatus,
        successRows: loadedCount,
        completedAt: new Date(),
      },
    });

    return {
      batchId: batch.id,
      status: finalStatus,
      totalRows: rawRows.length,
      successRows: loadedCount,
      errorRows: errorRowsList.length,
    };
  } catch (error) {
    // Mark batch as REJECTED on unexpected error
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "REJECTED", completedAt: new Date() },
    });
    throw error;
  }
}

// ==========================================
// Load chunk dispatcher
// ==========================================

async function loadChunk(
  dataType: ImportDataType,
  rows: ParsedRow<unknown>[],
  batchId: string
): Promise<number> {
  switch (dataType) {
    case "ATTENDANCE":
      return loadAttendanceChunk(rows as ParsedRow<AttendanceRow>[], batchId);
    case "ASSESSMENT":
      return loadAssessmentChunk(rows as ParsedRow<AssessmentRow>[], batchId);
    case "LMS_ASSIGNMENT":
      return loadLmsAssignmentChunk(rows as ParsedRow<LmsAssignmentRow>[], batchId);
    case "LMS_SUBMISSION":
      return loadLmsSubmissionChunk(rows as ParsedRow<LmsSubmissionRow>[], batchId);
    case "LMS_EVENT":
      return loadLmsEventChunk(rows as ParsedRow<LmsEventRow>[], batchId);
    default:
      return 0;
  }
}

async function loadAttendanceChunk(
  rows: ParsedRow<AttendanceRow>[],
  batchId: string
): Promise<number> {
  let count = 0;

  for (const row of rows) {
    if (!row.data) continue;

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: row.data.studentId,
        courseSectionId: row.data.courseSectionId,
        enrollmentStatus: "REGISTERED",
      },
      select: { enrollmentId: true },
    });

    const session = await prisma.courseSessionSchedule.findFirst({
      where: {
        courseSectionId: row.data.courseSectionId,
        sessionDate: new Date(row.data.sessionDate),
      },
      select: { sessionId: true },
    });

    if (!enrollment || !session) continue;

    await prisma.attendanceRecord.upsert({
      where: {
        enrollmentId_sessionId: {
          enrollmentId: enrollment.enrollmentId,
          sessionId: session.sessionId,
        },
      },
      update: {
        attendanceStatus: row.data.attendanceStatus as AttendanceStatus,
        importBatchId: batchId,
      },
      create: {
        enrollmentId: enrollment.enrollmentId,
        sessionId: session.sessionId,
        attendanceStatus: row.data.attendanceStatus as AttendanceStatus,
        source: "FILE_IMPORT",
        importBatchId: batchId,
      },
    });
    count++;
  }

  return count;
}

async function loadAssessmentChunk(
  rows: ParsedRow<AssessmentRow>[],
  batchId: string
): Promise<number> {
  let count = 0;

  for (const row of rows) {
    if (!row.data) continue;

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: row.data.studentId,
        courseSectionId: row.data.courseSectionId,
        enrollmentStatus: "REGISTERED",
      },
      select: { enrollmentId: true },
    });

    if (!enrollment) continue;

    await prisma.assessmentResult.upsert({
      where: {
        enrollmentId_assessmentType: {
          enrollmentId: enrollment.enrollmentId,
          assessmentType: row.data.assessmentType,
        },
      },
      update: {
        weight: row.data.weight,
        score: row.data.score ?? null,
        scoreScale: row.data.scoreScale,
        resultStatus: row.data.resultStatus as ResultStatus,
        importBatchId: batchId,
        publishedAt: row.data.publishedAt ? new Date(row.data.publishedAt) : null,
      },
      create: {
        enrollmentId: enrollment.enrollmentId,
        assessmentType: row.data.assessmentType,
        weight: row.data.weight,
        score: row.data.score ?? null,
        scoreScale: row.data.scoreScale,
        resultStatus: row.data.resultStatus as ResultStatus,
        importBatchId: batchId,
        publishedAt: row.data.publishedAt ? new Date(row.data.publishedAt) : null,
      },
    });
    count++;
  }

  return count;
}

async function loadLmsAssignmentChunk(
  rows: ParsedRow<LmsAssignmentRow>[],
  batchId: string
): Promise<number> {
  let count = 0;

  for (const row of rows) {
    if (!row.data) continue;

    await prisma.lMSAssignment.upsert({
      where: { assignmentId: row.data.assignmentId },
      update: {
        assignmentType: row.data.assignmentType as LMSAssignmentType,
        title: row.data.title,
        isRequired: row.data.isRequired,
        defaultDeadline: new Date(row.data.defaultDeadline),
        sequenceNumber: row.data.sequenceNumber,
        status: row.data.status as LMSAssignmentStatus,
        importBatchId: batchId,
      },
      create: {
        assignmentId: row.data.assignmentId,
        courseSectionId: row.data.courseSectionId,
        assignmentType: row.data.assignmentType as LMSAssignmentType,
        title: row.data.title,
        isRequired: row.data.isRequired,
        defaultDeadline: new Date(row.data.defaultDeadline),
        sequenceNumber: row.data.sequenceNumber,
        status: row.data.status as LMSAssignmentStatus,
        importBatchId: batchId,
      },
    });
    count++;
  }

  return count;
}

async function loadLmsSubmissionChunk(
  rows: ParsedRow<LmsSubmissionRow>[],
  batchId: string
): Promise<number> {
  let count = 0;

  for (const row of rows) {
    if (!row.data) continue;

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: row.data.studentId,
        courseSectionId: row.data.courseSectionId,
        enrollmentStatus: "REGISTERED",
      },
      select: { enrollmentId: true },
    });

    if (!enrollment) continue;

    await prisma.lMSSubmission.upsert({
      where: {
        assignmentId_enrollmentId_attemptNumber: {
          assignmentId: row.data.assignmentId,
          enrollmentId: enrollment.enrollmentId,
          attemptNumber: row.data.attemptNumber,
        },
      },
      update: {
        isLatest: row.data.isLatest,
        submittedAt: new Date(row.data.submittedAt),
        score: row.data.score ?? null,
        submissionStatus: row.data.submissionStatus as LMSSubmissionStatus,
        importBatchId: batchId,
      },
      create: {
        assignmentId: row.data.assignmentId,
        enrollmentId: enrollment.enrollmentId,
        attemptNumber: row.data.attemptNumber,
        isLatest: row.data.isLatest,
        submittedAt: new Date(row.data.submittedAt),
        score: row.data.score ?? null,
        submissionStatus: row.data.submissionStatus as LMSSubmissionStatus,
        importBatchId: batchId,
      },
    });
    count++;
  }

  return count;
}

async function loadLmsEventChunk(rows: ParsedRow<LmsEventRow>[], batchId: string): Promise<number> {
  let count = 0;

  for (const row of rows) {
    if (!row.data) continue;

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: row.data.studentId,
        courseSectionId: row.data.courseSectionId,
        enrollmentStatus: "REGISTERED",
      },
      select: { enrollmentId: true },
    });

    if (!enrollment) continue;

    await prisma.lMSActivityEvent.create({
      data: {
        enrollmentId: enrollment.enrollmentId,
        eventType: row.data.eventType as LMSEventType,
        timestamp: new Date(row.data.timestamp),
        resourceId: row.data.resourceId || null,
        importBatchId: batchId,
      },
    });
    count++;
  }

  return count;
}

// ==========================================
// Batch management services
// ==========================================

export async function listImportBatches(params: {
  page: number;
  pageSize: number;
  dataType?: ImportDataType;
  status?: ImportBatchStatus;
}) {
  const { page, pageSize, dataType, status } = params;
  const where: Record<string, unknown> = {};

  if (dataType) where.dataType = dataType;
  if (status) where.status = status;

  const [batches, total] = await Promise.all([
    prisma.importBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        performer: { select: { fullName: true, email: true } },
        parentBatch: { select: { id: true } },
      },
    }),
    prisma.importBatch.count({ where }),
  ]);

  return { batches, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getImportBatchErrors(params: {
  batchId: string;
  page: number;
  pageSize: number;
}) {
  const { batchId, page, pageSize } = params;

  const [errors, total, batch] = await Promise.all([
    prisma.importErrorRow.findMany({
      where: { importBatchId: batchId },
      orderBy: { sourceRowNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.importErrorRow.count({ where: { importBatchId: batchId } }),
    prisma.importBatch.findUnique({
      where: { id: batchId },
      select: { id: true, dataType: true, status: true, totalRows: true, errorRows: true },
    }),
  ]);

  return {
    errors,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    batch,
  };
}

export async function discardBatch(batchId: string): Promise<void> {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, status: true },
  });

  if (!batch) {
    throw new Error("Batch không tồn tại.");
  }

  // RÀNG BUỘC: chỉ hủy được khi status = STAGED
  if (batch.status !== "STAGED") {
    throw new Error(
      `Chỉ có thể hủy batch ở trạng thái STAGED. Trạng thái hiện tại: ${batch.status}`
    );
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "DISCARDED", completedAt: new Date() },
  });
}

export async function exportErrorRowsAsCSV(batchId: string): Promise<string> {
  const errors = await prisma.importErrorRow.findMany({
    where: { importBatchId: batchId },
    orderBy: { sourceRowNumber: "asc" },
  });

  if (errors.length === 0) {
    return "";
  }

  // Extract headers from first error's rawData
  const firstRawData = errors[0].rawData as Record<string, unknown>;
  const dataHeaders = Object.keys(firstRawData);
  const allHeaders = ["sourceRowNumber", "errorReason", ...dataHeaders];

  const csvLines = [allHeaders.join(",")];

  for (const error of errors) {
    const rawData = error.rawData as Record<string, unknown>;
    const values = [
      error.sourceRowNumber,
      error.errorReason,
      ...dataHeaders.map((h) => rawData[h] ?? ""),
    ];
    csvLines.push(values.join(","));
  }

  return csvLines.join("\n");
}
