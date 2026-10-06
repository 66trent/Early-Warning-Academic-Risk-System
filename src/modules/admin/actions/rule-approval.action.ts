"use server";

import { getSession } from "@/lib/session";
import { AuthorizationError } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import {
  ApproveRuleVersionSchema,
  RejectRuleVersionSchema,
  ListPendingRuleVersionsSchema,
} from "../validators/rule-approval.schema";
import {
  listPendingRuleVersionsService,
  approveRuleVersionService,
  rejectRuleVersionService,
  getRuleVersionDiffService,
} from "../services/rule-approval.service";

/**
 * Kiểm tra quyền phê duyệt luật: chỉ cán bộ quản lý đào tạo (TRAINING_OFFICER)
 * hoặc quản trị viên (ADMIN) mới có quyền duyệt luật.
 */
async function requireApproverSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new AuthorizationError("Yêu cầu đăng nhập để truy cập tính năng phê duyệt luật", 401);
  }
  if (session.user.role !== "TRAINING_OFFICER" && session.user.role !== "ADMIN") {
    throw new AuthorizationError(
      "Chỉ Cán bộ quản lý đào tạo hoặc Quản trị viên mới có thẩm quyền phê duyệt luật",
      403
    );
  }
  return session;
}

/**
 * Server Action lấy danh sách các phiên bản luật đang chờ duyệt.
 */
export async function listPendingRuleVersionsAction(rawInput?: unknown) {
  await requireApproverSession();
  const input = ListPendingRuleVersionsSchema.parse(rawInput || {});
  return await listPendingRuleVersionsService(input);
}

/**
 * Server Action lấy so sánh chi tiết giữa phiên bản chờ duyệt và phiên bản hiện tại.
 */
export async function getRuleVersionDiffAction(rawInput: { ruleCode: string; version: number }) {
  await requireApproverSession();
  if (!rawInput?.ruleCode || !rawInput?.version) {
    throw new Error("Thông tin phiên bản luật không hợp lệ");
  }
  return await getRuleVersionDiffService(rawInput.ruleCode, rawInput.version);
}

/**
 * Server Action phê duyệt phiên bản luật (RuleVersion).
 * Bắt buộc kiểm tra Separation of Duties: người cấu hình KHÔNG được tự duyệt.
 */
export async function approveRuleVersionAction(rawInput: unknown) {
  const session = await requireApproverSession();
  const input = ApproveRuleVersionSchema.parse(rawInput);

  const userObj = session.user as Record<string, unknown>;
  const approverId = (userObj.userId as string) || (userObj.id as string) || session.user.id;

  const approved = await approveRuleVersionService(input, approverId);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "APPROVE_RULE_VERSION",
    targetEntity: "RuleVersion",
    targetId: `${input.ruleCode}@v${input.version}`,
    details: {
      ruleCode: input.ruleCode,
      version: input.version,
      severity: approved.severity,
      approvedBy: approverId,
      note: input.note,
    },
  });

  return approved;
}

/**
 * Server Action từ chối phê duyệt phiên bản luật.
 */
export async function rejectRuleVersionAction(rawInput: unknown) {
  const session = await requireApproverSession();
  const input = RejectRuleVersionSchema.parse(rawInput);

  const userObj = session.user as Record<string, unknown>;
  const rejectorId = (userObj.userId as string) || (userObj.id as string) || session.user.id;

  const rejected = await rejectRuleVersionService(input, rejectorId);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "REJECT_RULE_VERSION",
    targetEntity: "RuleVersion",
    targetId: `${input.ruleCode}@v${input.version}`,
    details: {
      ruleCode: input.ruleCode,
      version: input.version,
      rejectedBy: rejectorId,
      reason: input.reason,
    },
  });

  return rejected;
}
