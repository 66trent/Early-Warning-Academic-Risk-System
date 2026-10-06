import { prisma } from "@/lib/prisma";
import type {
  ApproveRuleVersionInput,
  RejectRuleVersionInput,
  ListPendingRuleVersionsInput,
} from "../validators/rule-approval.schema";

/**
 * Lấy danh sách các phiên bản luật đang chờ phê duyệt.
 * Tiêu chí: status = DRAFT hoặc approvedBy = null.
 */
export async function listPendingRuleVersionsService(input: ListPendingRuleVersionsInput = {}) {
  const whereClause: {
    status?: "DRAFT";
    ruleCode?: string;
  } = {
    status: "DRAFT",
  };

  if (input.ruleCode && input.ruleCode.trim() !== "") {
    whereClause.ruleCode = input.ruleCode.trim();
  }

  const versions = await prisma.ruleVersion.findMany({
    where: whereClause,
    include: {
      rule: true,
      configurator: {
        select: {
          userId: true,
          fullName: true,
          role: true,
          email: true,
        },
      },
    },
    orderBy: [{ ruleCode: "asc" }, { version: "desc" }],
  });

  return versions;
}

/**
 * Phê duyệt phiên bản luật (RuleVersion).
 * BẮT BUỘC kiểm tra Separation of Duties:
 * Người phê duyệt (approverId) KHÔNG ĐƯỢC là người cấu hình (configuredBy).
 */
export async function approveRuleVersionService(
  input: ApproveRuleVersionInput,
  approverId: string
) {
  const ruleVersion = await prisma.ruleVersion.findUnique({
    where: {
      ruleCode_version: {
        ruleCode: input.ruleCode,
        version: input.version,
      },
    },
    include: {
      rule: true,
    },
  });

  if (!ruleVersion) {
    throw new Error(`Không tìm thấy phiên bản v${input.version} của luật '${input.ruleCode}'`);
  }

  // RÀNG BUỘC PHÂN CHIA NHIỆM VỤ (Separation of Duties)
  if (ruleVersion.configuredBy === approverId) {
    throw new Error(
      "Cán bộ cấu hình luật không được tự phê duyệt phiên bản do chính mình tạo (Vi phạm nguyên tắc Separation of Duties)"
    );
  }

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // 1. Chuyển phiên bản ACTIVE hiện tại của luật này thành ARCHIVED
    await tx.ruleVersion.updateMany({
      where: {
        ruleCode: input.ruleCode,
        status: "ACTIVE",
      },
      data: {
        status: "ARCHIVED",
        effectiveTo: now,
      },
    });

    // 2. Kích hoạt phiên bản mới với approvedBy
    const approved = await tx.ruleVersion.update({
      where: {
        ruleCode_version: {
          ruleCode: input.ruleCode,
          version: input.version,
        },
      },
      data: {
        status: "ACTIVE",
        approvedBy: approverId,
        effectiveFrom: now,
        effectiveTo: null,
      },
      include: {
        rule: true,
        approver: {
          select: {
            userId: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    return approved;
  });
}

/**
 * Từ chối phê duyệt phiên bản luật.
 */
export async function rejectRuleVersionService(input: RejectRuleVersionInput, rejectorId: string) {
  const ruleVersion = await prisma.ruleVersion.findUnique({
    where: {
      ruleCode_version: {
        ruleCode: input.ruleCode,
        version: input.version,
      },
    },
  });

  if (!ruleVersion) {
    throw new Error(`Không tìm thấy phiên bản v${input.version} của luật '${input.ruleCode}'`);
  }

  const rejected = await prisma.ruleVersion.update({
    where: {
      ruleCode_version: {
        ruleCode: input.ruleCode,
        version: input.version,
      },
    },
    data: {
      status: "INACTIVE",
    },
    include: {
      rule: true,
    },
  });

  return {
    ...rejected,
    rejectReason: input.reason,
    rejectedBy: rejectorId,
  };
}

/**
 * So sánh phiên bản luật cần duyệt với phiên bản ACTIVE hiện tại.
 */
export async function getRuleVersionDiffService(ruleCode: string, version: number) {
  const [targetVersion, currentActive] = await Promise.all([
    prisma.ruleVersion.findUnique({
      where: {
        ruleCode_version: { ruleCode, version },
      },
      include: { configurator: true, rule: true },
    }),
    prisma.ruleVersion.findFirst({
      where: {
        ruleCode,
        status: "ACTIVE",
      },
      include: { approver: true, configurator: true },
    }),
  ]);

  if (!targetVersion) {
    throw new Error(`Không tìm thấy phiên bản v${version} của luật '${ruleCode}'`);
  }

  return {
    targetVersion,
    currentActive,
    hasChangedSeverity: currentActive ? currentActive.severity !== targetVersion.severity : true,
    conditionDiff: {
      before: currentActive?.condition ?? null,
      after: targetVersion.condition,
    },
  };
}
