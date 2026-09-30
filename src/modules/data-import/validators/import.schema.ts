import { z } from "zod";

// ==========================================
// Row-level Zod schemas for each import data type
// ==========================================

export const attendanceRowSchema = z.object({
  studentId: z.string().min(1, "MSSV không được để trống"),
  courseSectionId: z.string().min(1, "Mã lớp HP không được để trống"),
  sessionDate: z.string().refine((v) => !isNaN(Date.parse(v)), "Ngày không hợp lệ"),
  attendanceStatus: z.enum(["PRESENT", "EXCUSED_ABSENCE", "UNEXCUSED_ABSENCE", "LATE"], {
    message: "Trạng thái điểm danh không hợp lệ",
  }),
});

export const assessmentRowSchema = z.object({
  studentId: z.string().min(1, "MSSV không được để trống"),
  courseSectionId: z.string().min(1, "Mã lớp HP không được để trống"),
  assessmentType: z.string().min(1, "Loại đánh giá không được để trống").max(30),
  weight: z.coerce.number().min(0).max(1, "Trọng số phải từ 0 đến 1"),
  score: z.coerce.number().nullable().optional(),
  scoreScale: z.string().min(1).max(10).default("10"),
  resultStatus: z.enum(["DRAFT", "FINAL", "UNDER_APPEAL", "EXEMPT", "WAIVED"], {
    message: "Trạng thái kết quả không hợp lệ",
  }),
  publishedAt: z
    .string()
    .refine((v) => !v || !isNaN(Date.parse(v)), "Ngày công bố không hợp lệ")
    .nullable()
    .optional(),
});

export const lmsAssignmentRowSchema = z.object({
  assignmentId: z.string().min(1).max(30),
  courseSectionId: z.string().min(1, "Mã lớp HP không được để trống"),
  assignmentType: z.enum(["QUIZ", "HOMEWORK", "DISCUSSION", "PROJECT"], {
    message: "Loại bài tập không hợp lệ",
  }),
  title: z.string().min(1).max(150),
  isRequired: z.coerce.boolean(),
  defaultDeadline: z.string().refine((v) => !isNaN(Date.parse(v)), "Deadline không hợp lệ"),
  sequenceNumber: z.coerce.number().int().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"], {
    message: "Trạng thái bài tập không hợp lệ",
  }),
});

export const lmsSubmissionRowSchema = z.object({
  assignmentId: z.string().min(1).max(30),
  studentId: z.string().min(1, "MSSV không được để trống"),
  courseSectionId: z.string().min(1, "Mã lớp HP không được để trống"),
  attemptNumber: z.coerce.number().int().min(1),
  isLatest: z.coerce.boolean(),
  submittedAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Ngày nộp không hợp lệ"),
  score: z.coerce.number().nullable().optional(),
  submissionStatus: z.enum(["ON_TIME", "LATE"], {
    message: "Trạng thái nộp bài không hợp lệ",
  }),
});

export const lmsEventRowSchema = z.object({
  studentId: z.string().min(1, "MSSV không được để trống"),
  courseSectionId: z.string().min(1, "Mã lớp HP không được để trống"),
  eventType: z.enum(["VIEW_MATERIAL", "DISCUSSION_POST", "LOGIN", "ACTIVITY_COMPLETE"], {
    message: "Loại sự kiện không hợp lệ",
  }),
  timestamp: z.string().refine((v) => !isNaN(Date.parse(v)), "Thời gian không hợp lệ"),
  resourceId: z.string().max(30).nullable().optional(),
});

// ==========================================
// Action-level schemas
// ==========================================

export const uploadFileSchema = z.object({
  dataType: z.enum(["ATTENDANCE", "ASSESSMENT", "LMS_ASSIGNMENT", "LMS_SUBMISSION", "LMS_EVENT"]),
  parentBatchId: z.string().uuid().nullable().optional(),
});

export const discardBatchSchema = z.object({
  batchId: z.string().uuid(),
});

export const listBatchesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  dataType: z
    .enum([
      "ENROLLMENT",
      "ATTENDANCE",
      "ASSESSMENT",
      "LMS_ASSIGNMENT",
      "LMS_SUBMISSION",
      "LMS_EVENT",
    ])
    .optional(),
  status: z
    .enum(["UPLOADING", "VALIDATING", "STAGED", "LOADED", "RECONCILED", "REJECTED", "DISCARDED"])
    .optional(),
});

export const listErrorRowsSchema = z.object({
  batchId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// Type exports
export type AttendanceRow = z.infer<typeof attendanceRowSchema>;
export type AssessmentRow = z.infer<typeof assessmentRowSchema>;
export type LmsAssignmentRow = z.infer<typeof lmsAssignmentRowSchema>;
export type LmsSubmissionRow = z.infer<typeof lmsSubmissionRowSchema>;
export type LmsEventRow = z.infer<typeof lmsEventRowSchema>;
