"use server";

import { getSession } from "@/lib/session";
import { assertScope } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import {
  uploadFileSchema,
  discardBatchSchema,
  listBatchesSchema,
  listErrorRowsSchema,
} from "../validators/import.schema";
import {
  processImport,
  listImportBatches,
  getImportBatchErrors,
  discardBatch as discardBatchService,
  exportErrorRowsAsCSV,
} from "../services/import.service";
import { uploadOriginalFile } from "../services/storage.service";
import type { ImportDataType, DataSource } from "@/generated/prisma/client";

// ==========================================
// Action: Upload & Process Import File
// ==========================================

export async function uploadImportFile(formData: FormData) {
  // 1. Session — KHÔNG tin role/id từ client
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate input
  const rawInput = {
    dataType: formData.get("dataType"),
    parentBatchId: formData.get("parentBatchId") || null,
  };

  const parseResult = uploadFileSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  const { dataType, parentBatchId } = parseResult.data;

  // 3. Authorization — TRAINING_OFFICER hoặc ADMIN mới được nhập dữ liệu
  await assertScope(session.user, { resourceType: "ImportBatch", action: "WRITE" });

  // 4. Read file
  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "Vui lòng chọn file để nhập." };
  }

  try {
    const csvContent = await file.text();
    const fileBuffer = Buffer.from(csvContent, "utf-8");

    // Upload original file to MinIO
    let originalFilePath: string;
    try {
      originalFilePath = await uploadOriginalFile({
        fileName: file.name,
        content: fileBuffer,
        dataType,
      });
    } catch {
      // If MinIO is not available (e.g., in dev without Docker), use a placeholder
      originalFilePath = `local://${file.name}`;
    }

    // 4. Process import through 5-stage pipeline
    const result = await processImport({
      csvContent,
      dataType: dataType as ImportDataType,
      source: "FILE" as DataSource,
      performedBy: session.user.id,
      originalFilePath,
      parentBatchId,
    });

    // 5. Audit log
    await writeAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role as string,
      action: "IMPORT_FILE",
      targetEntity: "ImportBatch",
      targetId: result.batchId,
      details: {
        dataType,
        fileName: file.name,
        totalRows: result.totalRows,
        successRows: result.successRows,
        errorRows: result.errorRows,
        status: result.status,
      },
    });

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định khi nhập dữ liệu.";
    return { success: false, error: message };
  }
}

// ==========================================
// Action: List Import Batches
// ==========================================

export async function listBatches(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = listBatchesSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  // 3. Authorization
  await assertScope(session.user, { resourceType: "ImportBatch", action: "READ" });

  // 4. Service call
  const result = await listImportBatches(parseResult.data);

  return { success: true, data: result };
}

// ==========================================
// Action: Get Error Rows for a Batch
// ==========================================

export async function getErrorRows(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = listErrorRowsSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  // 3. Authorization
  await assertScope(session.user, { resourceType: "ImportBatch", action: "READ" });

  // 4. Service call
  const result = await getImportBatchErrors(parseResult.data);

  return { success: true, data: result };
}

// ==========================================
// Action: Discard a STAGED Batch
// ==========================================

export async function discardImportBatch(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = discardBatchSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  // 3. Authorization
  await assertScope(session.user, { resourceType: "ImportBatch", action: "WRITE" });

  try {
    // 4. Service call
    await discardBatchService(parseResult.data.batchId);

    // 5. Audit log
    await writeAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role as string,
      action: "DISCARD_BATCH",
      targetEntity: "ImportBatch",
      targetId: parseResult.data.batchId,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định.";
    return { success: false, error: message };
  }
}

// ==========================================
// Action: Export Error Rows as CSV
// ==========================================

export async function exportErrors(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = discardBatchSchema.safeParse(rawInput); // Reuse schema (just needs batchId)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  // 3. Authorization
  await assertScope(session.user, { resourceType: "ImportBatch", action: "READ" });

  // 4. Service call
  const csvContent = await exportErrorRowsAsCSV(parseResult.data.batchId);

  return { success: true, data: { csvContent } };
}
