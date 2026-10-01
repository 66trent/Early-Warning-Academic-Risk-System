"use server";

import { getSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  createRuleVersionSchema,
  activateRuleVersionSchema,
  listRulesSchema,
  validateCondition,
  ruleVersionActionSchema,
} from "../validators/rule-engine.schema";

// ==========================================
// Action: List Rules & Versions
// ==========================================

export async function listRules(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = listRulesSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  // 3. Authorization — TRAINING_OFFICER or ADMIN
  const role = session.user.role;
  if (role !== "TRAINING_OFFICER" && role !== "ADMIN") {
    return { success: false, error: "Không đủ quyền truy cập cấu hình luật." };
  }

  // 4. Query
  const where: Record<string, unknown> = {};
  if (parseResult.data.ruleGroup) where.ruleGroup = parseResult.data.ruleGroup;
  if (parseResult.data.status) where.status = parseResult.data.status;

  const rules = await prisma.rule.findMany({
    where,
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 5,
        include: {
          configurator: { select: { userId: true, fullName: true } },
          approver: { select: { userId: true, fullName: true } },
        },
      },
    },
    orderBy: { priority: "asc" },
  });

  return { success: true, data: rules };
}

// ==========================================
// Action: Create Draft RuleVersion
// ==========================================

export async function createRuleVersion(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = createRuleVersionSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  // 3. Authorization — TRAINING_OFFICER or ADMIN
  const role = session.user.role;
  if (role !== "TRAINING_OFFICER" && role !== "ADMIN") {
    return { success: false, error: "Không đủ quyền tạo phiên bản luật." };
  }

  const { ruleCode, condition, severity, action, effectiveFrom } = parseResult.data;

  try {
    // Validate condition JSON against rule-specific schema
    validateCondition(ruleCode, condition);

    // Validate action JSON
    ruleVersionActionSchema.parse(action);

    // Get next version number
    const latestVersion = await prisma.ruleVersion.findFirst({
      where: { ruleCode },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // 4. Create DRAFT version
    const ruleVersion = await prisma.ruleVersion.create({
      data: {
        ruleCode,
        version: nextVersion,
        condition: condition as Prisma.InputJsonValue,
        severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        action: action as Prisma.InputJsonValue,
        effectiveFrom: new Date(effectiveFrom),
        status: "DRAFT",
        configuredBy: session.user.id,
        approvedBy: null, // MUST be null for draft
      },
    });

    // 5. Audit Log
    await writeAuditLog({
      actorId: session.user.id,
      actorRole: role,
      action: "CREATE_RULE_VERSION",
      targetEntity: "RuleVersion",
      targetId: ruleVersion.id,
      details: {
        ruleCode,
        version: nextVersion,
        severity,
        status: "DRAFT",
      },
    });

    return { success: true, data: ruleVersion };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định.";
    return { success: false, error: message };
  }
}

// ==========================================
// Action: Activate RuleVersion (requires approvedBy)
// ==========================================

export async function activateRuleVersion(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = activateRuleVersionSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  // 3. Authorization — Only TRAINING_OFFICER or ADMIN can approve
  const role = session.user.role;
  if (role !== "TRAINING_OFFICER" && role !== "ADMIN") {
    return { success: false, error: "Không đủ quyền duyệt phiên bản luật." };
  }

  const { ruleVersionId } = parseResult.data;

  try {
    // Fetch the version
    const ruleVersion = await prisma.ruleVersion.findUnique({
      where: { id: ruleVersionId },
    });

    if (!ruleVersion) {
      return { success: false, error: "Không tìm thấy phiên bản luật." };
    }

    if (ruleVersion.status !== "DRAFT" && ruleVersion.status !== "INACTIVE") {
      return {
        success: false,
        error: `Không thể kích hoạt phiên bản ở trạng thái ${ruleVersion.status}.`,
      };
    }

    // Constraint: approvedBy must be set AND different from configuredBy
    // (Separation of duties: creator cannot self-approve)
    if (session.user.id === ruleVersion.configuredBy) {
      return {
        success: false,
        error: "Người tạo không thể tự duyệt phiên bản luật của mình.",
      };
    }

    // Deactivate existing ACTIVE version for this rule
    await prisma.ruleVersion.updateMany({
      where: {
        ruleCode: ruleVersion.ruleCode,
        status: "ACTIVE",
      },
      data: {
        status: "ARCHIVED",
        effectiveTo: new Date(),
      },
    });

    // 4. Activate
    const updated = await prisma.ruleVersion.update({
      where: { id: ruleVersionId },
      data: {
        status: "ACTIVE",
        approvedBy: session.user.id, // Set approver
        effectiveFrom: new Date(),
      },
    });

    // 5. Audit Log
    await writeAuditLog({
      actorId: session.user.id,
      actorRole: role,
      action: "ACTIVATE_RULE_VERSION",
      targetEntity: "RuleVersion",
      targetId: ruleVersionId,
      details: {
        ruleCode: ruleVersion.ruleCode,
        version: ruleVersion.version,
        previousStatus: ruleVersion.status,
        approvedBy: session.user.id,
      },
    });

    return { success: true, data: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định.";
    return { success: false, error: message };
  }
}

// ==========================================
// Action: Archive RuleVersion
// ==========================================

export async function archiveRuleVersion(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = activateRuleVersionSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  // 3. Authorization
  const role = session.user.role;
  if (role !== "TRAINING_OFFICER" && role !== "ADMIN") {
    return { success: false, error: "Không đủ quyền." };
  }

  try {
    const updated = await prisma.ruleVersion.update({
      where: { id: parseResult.data.ruleVersionId },
      data: {
        status: "ARCHIVED",
        effectiveTo: new Date(),
      },
    });

    // 4. Audit Log
    await writeAuditLog({
      actorId: session.user.id,
      actorRole: role,
      action: "ARCHIVE_RULE_VERSION",
      targetEntity: "RuleVersion",
      targetId: parseResult.data.ruleVersionId,
      details: {
        ruleCode: updated.ruleCode,
        version: updated.version,
      },
    });

    return { success: true, data: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định.";
    return { success: false, error: message };
  }
}
