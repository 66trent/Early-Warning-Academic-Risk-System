import { describe, it, expect, beforeEach } from "vitest";
import { computeChecksum, parseCSVContent } from "../services/import.service";

// ==========================================
// Unit Tests — parseCSVContent
// ==========================================

describe("parseCSVContent", () => {
  it("should parse valid CSV with header and rows", () => {
    const csv = `studentId,courseSectionId,sessionDate,attendanceStatus
B21001,CT101-01,2026-09-05,PRESENT
B21002,CT101-01,2026-09-05,LATE`;

    const rows = parseCSVContent(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      studentId: "B21001",
      courseSectionId: "CT101-01",
      sessionDate: "2026-09-05",
      attendanceStatus: "PRESENT",
    });
    expect(rows[1].attendanceStatus).toBe("LATE");
  });

  it("should return empty array for empty CSV", () => {
    expect(parseCSVContent("")).toEqual([]);
    expect(parseCSVContent("\n")).toEqual([]);
  });

  it("should return empty array for header-only CSV", () => {
    expect(parseCSVContent("col1,col2\n")).toEqual([]);
  });

  it("should handle CRLF line endings", () => {
    const csv = "a,b\r\n1,2\r\n3,4\r\n";
    const rows = parseCSVContent(csv);
    expect(rows).toHaveLength(2);
  });
});

// ==========================================
// Unit Tests — computeChecksum
// ==========================================

describe("computeChecksum", () => {
  it("should return consistent hash for same content", () => {
    const hash1 = computeChecksum("test content");
    const hash2 = computeChecksum("test content");
    expect(hash1).toBe(hash2);
  });

  it("should return different hash for different content", () => {
    const hash1 = computeChecksum("content A");
    const hash2 = computeChecksum("content B");
    expect(hash1).not.toBe(hash2);
  });

  it("should return a 64-character hex string (SHA-256)", () => {
    const hash = computeChecksum("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ==========================================
// Unit Tests — Zod validators
// ==========================================

describe("Import validators", () => {
  let attendanceRowSchema: (typeof import("../validators/import.schema"))["attendanceRowSchema"];
  let assessmentRowSchema: (typeof import("../validators/import.schema"))["assessmentRowSchema"];
  let lmsSubmissionRowSchema: (typeof import("../validators/import.schema"))["lmsSubmissionRowSchema"];

  beforeEach(async () => {
    const validators = await import("../validators/import.schema");
    attendanceRowSchema = validators.attendanceRowSchema;
    assessmentRowSchema = validators.assessmentRowSchema;
    lmsSubmissionRowSchema = validators.lmsSubmissionRowSchema;
  });

  describe("attendanceRowSchema", () => {
    it("should accept valid attendance data", () => {
      const result = attendanceRowSchema.safeParse({
        studentId: "B21001",
        courseSectionId: "CT101-01",
        sessionDate: "2026-09-05",
        attendanceStatus: "PRESENT",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid attendance status", () => {
      const result = attendanceRowSchema.safeParse({
        studentId: "B21001",
        courseSectionId: "CT101-01",
        sessionDate: "2026-09-05",
        attendanceStatus: "INVALID",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty student ID", () => {
      const result = attendanceRowSchema.safeParse({
        studentId: "",
        courseSectionId: "CT101-01",
        sessionDate: "2026-09-05",
        attendanceStatus: "PRESENT",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid date", () => {
      const result = attendanceRowSchema.safeParse({
        studentId: "B21001",
        courseSectionId: "CT101-01",
        sessionDate: "not-a-date",
        attendanceStatus: "PRESENT",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("assessmentRowSchema", () => {
    it("should accept valid assessment with score", () => {
      const result = assessmentRowSchema.safeParse({
        studentId: "B21001",
        courseSectionId: "CT101-01",
        assessmentType: "MIDTERM",
        weight: 0.3,
        score: 7.5,
        scoreScale: "10",
        resultStatus: "FINAL",
      });
      expect(result.success).toBe(true);
    });

    it("should accept assessment without score (null)", () => {
      const result = assessmentRowSchema.safeParse({
        studentId: "B21001",
        courseSectionId: "CT101-01",
        assessmentType: "FINAL",
        weight: 0.7,
        score: null,
        scoreScale: "10",
        resultStatus: "DRAFT",
      });
      expect(result.success).toBe(true);
    });

    it("should reject weight > 1", () => {
      const result = assessmentRowSchema.safeParse({
        studentId: "B21001",
        courseSectionId: "CT101-01",
        assessmentType: "MIDTERM",
        weight: 1.5,
        score: 7.5,
        scoreScale: "10",
        resultStatus: "FINAL",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("lmsSubmissionRowSchema", () => {
    it("should accept valid submission", () => {
      const result = lmsSubmissionRowSchema.safeParse({
        assignmentId: "HW-001",
        studentId: "B21001",
        courseSectionId: "CT101-01",
        attemptNumber: 1,
        isLatest: true,
        submittedAt: "2026-09-15T10:00:00Z",
        score: 8.0,
        submissionStatus: "ON_TIME",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid submission status (NOT_SUBMITTED not allowed)", () => {
      const result = lmsSubmissionRowSchema.safeParse({
        assignmentId: "HW-001",
        studentId: "B21001",
        courseSectionId: "CT101-01",
        attemptNumber: 1,
        isLatest: true,
        submittedAt: "2026-09-15T10:00:00Z",
        submissionStatus: "NOT_SUBMITTED",
      });
      expect(result.success).toBe(false);
    });
  });
});

// ==========================================
// Test: checksum dedup — stub test
// ==========================================

describe("Checksum dedup logic", () => {
  it("same file content should produce same checksum", () => {
    const fileA = "studentId,courseSectionId\nB21001,CT101-01";
    const fileB = "studentId,courseSectionId\nB21001,CT101-01";
    expect(computeChecksum(fileA)).toBe(computeChecksum(fileB));
  });

  it("different file content should produce different checksum", () => {
    const fileA = "studentId,courseSectionId\nB21001,CT101-01";
    const fileB = "studentId,courseSectionId\nB21002,CT102-01";
    expect(computeChecksum(fileA)).not.toBe(computeChecksum(fileB));
  });
});
