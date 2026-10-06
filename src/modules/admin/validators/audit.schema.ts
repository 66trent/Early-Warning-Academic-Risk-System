import { z } from "zod";

export const ListAuditLogsFilterSchema = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  targetEntity: z.string().optional(),
  fromDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
    ),
  toDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
    ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListAuditLogsFilterInput = z.infer<typeof ListAuditLogsFilterSchema>;
