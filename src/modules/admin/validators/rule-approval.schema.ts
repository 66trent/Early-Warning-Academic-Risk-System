import { z } from "zod";

export const ApproveRuleVersionSchema = z.object({
  ruleCode: z.string().min(1, "Mã luật không được để trống"),
  version: z.coerce.number().int().min(1, "Phiên bản phải lớn hơn 0"),
  note: z.string().optional(),
});

export const RejectRuleVersionSchema = z.object({
  ruleCode: z.string().min(1, "Mã luật không được để trống"),
  version: z.coerce.number().int().min(1, "Phiên bản phải lớn hơn 0"),
  reason: z.string().min(5, "Lý do từ chối phải có ít nhất 5 ký tự"),
});

export const ListPendingRuleVersionsSchema = z.object({
  ruleCode: z.string().optional(),
});

export type ApproveRuleVersionInput = z.infer<typeof ApproveRuleVersionSchema>;
export type RejectRuleVersionInput = z.infer<typeof RejectRuleVersionSchema>;
export type ListPendingRuleVersionsInput = z.infer<typeof ListPendingRuleVersionsSchema>;
