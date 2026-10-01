/**
 * Rule Engine Test Suite — Evaluators
 * Coverage target: ≥90%
 * Ma trận test: happy path / biên / loại trừ / DataStatus
 */

import { describe, it, expect } from "vitest";
import {
  evaluateExceptions,
  type ExceptionInput,
} from "../services/evaluators/exceptions.evaluator";
import {
  evaluateConsecutiveAbsence,
  evaluateExamBanThreshold,
  evaluateMultiCourseAbsence,
  evaluateNoShowStart,
  type AttendanceEvalInput,
  type MultiCourseAttendanceInput,
  type NoShowStartInput,
} from "../services/evaluators/attendance.evaluator";
import {
  evaluateFailingScore,
  evaluateAcademicWarning,
  evaluateGpaDrop,
  evaluateRetake,
  type AcaFailingScoreInput,
  type AcaWarningInput,
  type AcaGpaDropInput,
  type AcaRetakeInput,
} from "../services/evaluators/academic.evaluator";
import {
  evaluateLmsInactivity,
  evaluateMissedSubmissions,
  evaluateConsecutiveZeroScores,
  type LmsInactivityInput,
  type LmsMissedSubmissionsInput,
  type LmsConsecutiveZeroInput,
} from "../services/evaluators/lms.evaluator";
import {
  evaluateMultiSourceNegative,
  evaluateCompleteDisappearance,
  type CombMultiSourceInput,
  type CombDisappearanceInput,
} from "../services/evaluators/combined.evaluator";
import type { ExceptionResult } from "../services/evaluators/exceptions.evaluator";
import { calculateRiskScore } from "../services/risk-score.service";
import { executeRuleEnginePipeline } from "../services/orchestrator.service";
import { validateCondition } from "../validators/rule-engine.schema";

// ==========================================
// Test Helpers
// ==========================================

const NO_EXCEPTIONS: ExceptionResult = {
  skipAll: false,
  skipRules: new Set(),
  exemptAssignmentIds: new Set(),
  extendedDeadlines: new Map(),
  reasons: [],
};

const ALL_SKIPPED: ExceptionResult = {
  skipAll: true,
  skipRules: new Set(),
  exemptAssignmentIds: new Set(),
  extendedDeadlines: new Map(),
  reasons: ["All skipped"],
};

function makeDate(daysAgo: number): Date {
  const d = new Date("2026-09-15");
  d.setDate(d.getDate() - daysAgo);
  return d;
}

// ==========================================
// HR-EXC: Exception Evaluator
// ==========================================

describe("HR-EXC — Exception Evaluator", () => {
  const baseInput: ExceptionInput = {
    studentId: "SV001",
    enrollmentId: "ENR001",
    courseSectionId: "CS001",
    termId: "2026A",
    evaluationDate: new Date("2026-09-15"),
    enrollmentStatus: "REGISTERED",
    registeredAt: new Date("2026-08-01"),
    sectionStatus: "ONGOING",
    usesLMS: true,
    hasPreviousTermGPA: true,
    calendarExceptions: [],
    lmsMaintenanceWindows: [],
    closedSessionCount: 5,
    totalScheduledSessionCount: 10,
    deadlineExtensions: [],
    assignmentExemptions: [],
  };

  it("should skip all for WITHDRAWN enrollment", () => {
    const result = evaluateExceptions({ ...baseInput, enrollmentStatus: "WITHDRAWN" });
    expect(result.skipAll).toBe(true);
  });

  it("should skip all for NOT_STARTED section", () => {
    const result = evaluateExceptions({ ...baseInput, sectionStatus: "NOT_STARTED" });
    expect(result.skipAll).toBe(true);
  });

  it("should skip LMS rules when usesLMS=false", () => {
    const result = evaluateExceptions({ ...baseInput, usesLMS: false });
    expect(result.skipAll).toBe(false);
    expect(result.skipRules.has("HR-LMS-01")).toBe(true);
    expect(result.skipRules.has("HR-LMS-02")).toBe(true);
    expect(result.skipRules.has("HR-LMS-03")).toBe(true);
  });

  it("should skip ATT rules when no closed sessions", () => {
    const result = evaluateExceptions({ ...baseInput, closedSessionCount: 0 });
    expect(result.skipRules.has("HR-ATT-01")).toBe(true);
    expect(result.skipRules.has("HR-ATT-02")).toBe(true);
  });

  it("should skip HR-ACA-03 for new students without previous GPA", () => {
    const result = evaluateExceptions({ ...baseInput, hasPreviousTermGPA: false });
    expect(result.skipRules.has("HR-ACA-03")).toBe(true);
  });

  it("should skip all on holiday", () => {
    const result = evaluateExceptions({
      ...baseInput,
      calendarExceptions: [{ exceptionDate: new Date("2026-09-15"), type: "HOLIDAY" }],
    });
    expect(result.skipAll).toBe(true);
  });

  it("should skip HR-LMS-01 during maintenance", () => {
    const result = evaluateExceptions({
      ...baseInput,
      lmsMaintenanceWindows: [{ startAt: new Date("2026-09-14"), endAt: new Date("2026-09-16") }],
    });
    expect(result.skipRules.has("HR-LMS-01")).toBe(true);
  });

  it("should track deadline extensions", () => {
    const result = evaluateExceptions({
      ...baseInput,
      deadlineExtensions: [
        { assignmentId: "A1", studentId: "SV001", newDeadline: new Date("2026-10-01") },
        { assignmentId: "A2", studentId: null, newDeadline: new Date("2026-10-05") },
      ],
    });
    expect(result.extendedDeadlines.size).toBe(2);
    expect(result.extendedDeadlines.get("A1")).toBeTruthy();
    expect(result.extendedDeadlines.get("A2")).toBeTruthy();
  });

  it("should track assignment exemptions", () => {
    const result = evaluateExceptions({
      ...baseInput,
      assignmentExemptions: [{ assignmentId: "A1", studentId: null }],
    });
    expect(result.exemptAssignmentIds.has("A1")).toBe(true);
  });

  it("should allow REGISTERED + ONGOING enrollment", () => {
    const result = evaluateExceptions(baseInput);
    expect(result.skipAll).toBe(false);
    expect(result.skipRules.size).toBe(0);
  });
});

// ==========================================
// HR-ATT-01: Consecutive Absence
// ==========================================

describe("HR-ATT-01 — Consecutive Absence", () => {
  const baseInput: AttendanceEvalInput = {
    studentId: "SV001",
    termId: "2026A",
    enrollmentId: "ENR001",
    courseSectionId: "CS001",
    courseId: "C001",
    courseName: "Toán cao cấp",
    registeredAt: new Date("2026-08-01"),
    evaluationDate: new Date("2026-09-15"),
    ruleVersionId: "rv1",
    sessions: [],
    exceptions: NO_EXCEPTIONS,
  };

  it("should trigger when 3 consecutive unexcused absences", () => {
    const input: AttendanceEvalInput = {
      ...baseInput,
      sessions: [
        {
          sessionId: "s1",
          sessionDate: makeDate(5),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s2",
          sessionDate: makeDate(4),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s3",
          sessionDate: makeDate(3),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
      ],
    };
    const result = evaluateConsecutiveAbsence(input, { consecutiveThreshold: 3 });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-ATT-01");
    expect(result!.severity).toBe("HIGH");
  });

  it("should NOT trigger with only 2 consecutive absences", () => {
    const input: AttendanceEvalInput = {
      ...baseInput,
      sessions: [
        {
          sessionId: "s1",
          sessionDate: makeDate(5),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s2",
          sessionDate: makeDate(4),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s3",
          sessionDate: makeDate(3),
          sessionStatus: "CLOSED",
          attendanceStatus: "PRESENT",
        },
      ],
    };
    const result = evaluateConsecutiveAbsence(input, { consecutiveThreshold: 3 });
    expect(result).toBeNull();
  });

  it("should ignore CANCELLED sessions", () => {
    const input: AttendanceEvalInput = {
      ...baseInput,
      sessions: [
        {
          sessionId: "s1",
          sessionDate: makeDate(6),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s2",
          sessionDate: makeDate(5),
          sessionStatus: "CANCELLED",
          attendanceStatus: null,
        },
        {
          sessionId: "s3",
          sessionDate: makeDate(4),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s4",
          sessionDate: makeDate(3),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
      ],
    };
    const result = evaluateConsecutiveAbsence(input, { consecutiveThreshold: 3 });
    expect(result).not.toBeNull();
  });

  it("should NOT count EXCUSED_ABSENCE as break in streak", () => {
    const input: AttendanceEvalInput = {
      ...baseInput,
      sessions: [
        {
          sessionId: "s1",
          sessionDate: makeDate(6),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s2",
          sessionDate: makeDate(5),
          sessionStatus: "CLOSED",
          attendanceStatus: "EXCUSED_ABSENCE",
        },
        {
          sessionId: "s3",
          sessionDate: makeDate(4),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s4",
          sessionDate: makeDate(3),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
      ],
    };
    // EXCUSED_ABSENCE doesn't increment or reset streak
    const result = evaluateConsecutiveAbsence(input, { consecutiveThreshold: 3 });
    expect(result).not.toBeNull();
  });

  it("should respect exception skipRules", () => {
    const excResult: ExceptionResult = {
      ...NO_EXCEPTIONS,
      skipRules: new Set(["HR-ATT-01"]),
    };
    const input: AttendanceEvalInput = {
      ...baseInput,
      exceptions: excResult,
      sessions: [
        {
          sessionId: "s1",
          sessionDate: makeDate(5),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s2",
          sessionDate: makeDate(4),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s3",
          sessionDate: makeDate(3),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
      ],
    };
    const result = evaluateConsecutiveAbsence(input, { consecutiveThreshold: 3 });
    expect(result).toBeNull();
  });

  it("should prevent temporal leakage (ignore future sessions)", () => {
    const input: AttendanceEvalInput = {
      ...baseInput,
      evaluationDate: new Date("2026-09-10"),
      sessions: [
        {
          sessionId: "s1",
          sessionDate: makeDate(5),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s2",
          sessionDate: makeDate(4),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s3",
          sessionDate: new Date("2026-09-15"),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
      ],
    };
    const result = evaluateConsecutiveAbsence(input, { consecutiveThreshold: 3 });
    // Only 2 sessions before evaluation date
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-ATT-02: Exam Ban Threshold
// ==========================================

describe("HR-ATT-02 — Exam Ban Threshold", () => {
  const baseInput: AttendanceEvalInput = {
    studentId: "SV001",
    termId: "2026A",
    enrollmentId: "ENR001",
    courseSectionId: "CS001",
    courseId: "C001",
    courseName: "Toán cao cấp",
    registeredAt: new Date("2026-08-01"),
    evaluationDate: new Date("2026-09-15"),
    ruleVersionId: "rv1",
    sessions: [],
    exceptions: NO_EXCEPTIONS,
  };

  it("should trigger at 20% absence rate with >= operator", () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      sessionId: `s${i}`,
      sessionDate: makeDate(10 - i),
      sessionStatus: "CLOSED" as const,
      attendanceStatus: i < 2 ? "UNEXCUSED_ABSENCE" : "PRESENT",
    }));
    const result = evaluateExamBanThreshold(
      { ...baseInput, sessions },
      {
        absenceRateThreshold: 0.2,
        comparisonOperator: ">=",
        countLateAsAbsence: false,
        countExcusedAbsence: false,
        countMakeupSessions: true,
      }
    );
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("CRITICAL");
  });

  it("should NOT trigger below threshold with > operator", () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      sessionId: `s${i}`,
      sessionDate: makeDate(10 - i),
      sessionStatus: "CLOSED" as const,
      attendanceStatus: i < 2 ? "UNEXCUSED_ABSENCE" : "PRESENT",
    }));
    const result = evaluateExamBanThreshold(
      { ...baseInput, sessions },
      {
        absenceRateThreshold: 0.2,
        comparisonOperator: ">",
        countLateAsAbsence: false,
        countExcusedAbsence: false,
        countMakeupSessions: true,
      }
    );
    // 2/10 = 0.2, not > 0.2
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-ATT-03: Multi-Course Absence
// ==========================================

describe("HR-ATT-03 — Multi-Course Absence", () => {
  it("should trigger when >=2 absences across >=2 courses in window", () => {
    const input: MultiCourseAttendanceInput = {
      studentId: "SV001",
      termId: "2026A",
      evaluationDate: new Date("2026-09-15"),
      ruleVersionId: "rv1",
      courses: [
        {
          courseSectionId: "CS001",
          courseName: "Toán",
          sessions: [
            {
              sessionId: "s1",
              sessionDate: makeDate(2),
              sessionStatus: "CLOSED",
              attendanceStatus: "UNEXCUSED_ABSENCE",
            },
          ],
        },
        {
          courseSectionId: "CS002",
          courseName: "Lý",
          sessions: [
            {
              sessionId: "s2",
              sessionDate: makeDate(3),
              sessionStatus: "CLOSED",
              attendanceStatus: "UNEXCUSED_ABSENCE",
            },
          ],
        },
      ],
    };
    const result = evaluateMultiCourseAbsence(input, {
      windowDays: 7,
      minAbsences: 2,
      minCourses: 2,
    });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-ATT-03");
    expect(result!.severity).toBe("MEDIUM");
  });

  it("should NOT trigger when only 1 course has absences", () => {
    const input: MultiCourseAttendanceInput = {
      studentId: "SV001",
      termId: "2026A",
      evaluationDate: new Date("2026-09-15"),
      ruleVersionId: "rv1",
      courses: [
        {
          courseSectionId: "CS001",
          courseName: "Toán",
          sessions: [
            {
              sessionId: "s1",
              sessionDate: makeDate(2),
              sessionStatus: "CLOSED",
              attendanceStatus: "UNEXCUSED_ABSENCE",
            },
            {
              sessionId: "s2",
              sessionDate: makeDate(3),
              sessionStatus: "CLOSED",
              attendanceStatus: "UNEXCUSED_ABSENCE",
            },
          ],
        },
      ],
    };
    const result = evaluateMultiCourseAbsence(input, {
      windowDays: 7,
      minAbsences: 2,
      minCourses: 2,
    });
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-ATT-04: No Show Start
// ==========================================

describe("HR-ATT-04 — No Show Start", () => {
  const baseNoShowInput: NoShowStartInput = {
    studentId: "SV001",
    termId: "2026A",
    enrollmentId: "ENR001",
    courseSectionId: "CS001",
    courseName: "Toán",
    ruleVersionId: "rv1",
    evaluationDate: new Date("2026-09-15"),
    termStartDate: new Date("2026-09-01"),
    registeredAt: new Date("2026-08-25"),
    sectionStatus: "ONGOING",
    usesLMS: false,
    hasScheduledSessions: true,
    sessions: [],
    exceptions: NO_EXCEPTIONS,
  };

  it("should trigger when student misses all early term sessions", () => {
    const input: NoShowStartInput = {
      ...baseNoShowInput,
      sessions: [
        {
          sessionId: "s1",
          sessionDate: new Date("2026-09-03"),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
        {
          sessionId: "s2",
          sessionDate: new Date("2026-09-07"),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
      ],
    };
    const result = evaluateNoShowStart(input, { earlyTermDays: 14 });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-ATT-04");
    expect(result!.severity).toBe("HIGH");
  });

  it("should NOT trigger if registered late (exclusion)", () => {
    const input: NoShowStartInput = {
      ...baseNoShowInput,
      registeredAt: new Date("2026-09-05"), // registered after term start
      sessions: [
        {
          sessionId: "s1",
          sessionDate: new Date("2026-09-03"),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
      ],
    };
    const result = evaluateNoShowStart(input, { earlyTermDays: 14 });
    expect(result).toBeNull();
  });

  it("should NOT trigger if attended at least one session", () => {
    const input: NoShowStartInput = {
      ...baseNoShowInput,
      sessions: [
        {
          sessionId: "s1",
          sessionDate: new Date("2026-09-03"),
          sessionStatus: "CLOSED",
          attendanceStatus: "PRESENT",
        },
        {
          sessionId: "s2",
          sessionDate: new Date("2026-09-07"),
          sessionStatus: "CLOSED",
          attendanceStatus: "UNEXCUSED_ABSENCE",
        },
      ],
    };
    const result = evaluateNoShowStart(input, { earlyTermDays: 14 });
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-ACA-01: Failing Score
// ==========================================

describe("HR-ACA-01 — Failing Score", () => {
  const baseInput: AcaFailingScoreInput = {
    studentId: "SV001",
    termId: "2026A",
    enrollmentId: "ENR001",
    courseSectionId: "CS001",
    courseName: "Toán cao cấp",
    ruleVersionId: "rv1",
    evaluationDate: new Date("2026-09-15"),
    assessments: [],
    exceptions: NO_EXCEPTIONS,
  };

  it("should trigger when score=0 on weighted assessment", () => {
    const result = evaluateFailingScore(
      {
        ...baseInput,
        assessments: [
          {
            id: "a1",
            assessmentType: "MIDTERM",
            weight: 0.4,
            score: 0,
            scoreScale: "10",
            resultStatus: "FINAL",
            publishedAt: new Date("2026-09-10"),
          },
        ],
      },
      { minimumAssessmentWeight: 0.3, failingScore: 0 }
    );
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-ACA-01");
  });

  it("should NOT trigger for DRAFT status assessments", () => {
    const result = evaluateFailingScore(
      {
        ...baseInput,
        assessments: [
          {
            id: "a1",
            assessmentType: "MIDTERM",
            weight: 0.5,
            score: 0,
            scoreScale: "10",
            resultStatus: "DRAFT",
            publishedAt: null,
          },
        ],
      },
      { minimumAssessmentWeight: 0.3, failingScore: 0 }
    );
    expect(result).toBeNull();
  });

  it("should NOT trigger for low-weight assessments", () => {
    const result = evaluateFailingScore(
      {
        ...baseInput,
        assessments: [
          {
            id: "a1",
            assessmentType: "QUIZ",
            weight: 0.1,
            score: 0,
            scoreScale: "10",
            resultStatus: "FINAL",
            publishedAt: new Date("2026-09-10"),
          },
        ],
      },
      { minimumAssessmentWeight: 0.3, failingScore: 0 }
    );
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-ACA-02: Academic Warning
// ==========================================

describe("HR-ACA-02 — Academic Warning", () => {
  it("should trigger when cumulative GPA <= threshold", () => {
    const input: AcaWarningInput = {
      studentId: "SV001",
      termId: "2026A",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      currentCumulativeGPA: 1.8,
      currentTermGPA: 1.7,
      cumulativeCredits: 30,
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateAcademicWarning(input, {
      gpaWarningThreshold: 2.0,
      cumulativeCreditsMin: 15,
    });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-ACA-02");
    expect(result!.severity).toBe("CRITICAL");
  });

  it("should NOT trigger when cumulative credits < min", () => {
    const input: AcaWarningInput = {
      studentId: "SV001",
      termId: "2026A",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      currentCumulativeGPA: 1.8,
      currentTermGPA: 1.7,
      cumulativeCredits: 10,
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateAcademicWarning(input, {
      gpaWarningThreshold: 2.0,
      cumulativeCreditsMin: 15,
    });
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-ACA-03: GPA Drop
// ==========================================

describe("HR-ACA-03 — GPA Drop", () => {
  it("should trigger when end-of-term GPA drops significantly", () => {
    const input: AcaGpaDropInput = {
      studentId: "SV001",
      termId: "2026A",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      currentTermGPA: { termId: "2026A", gpa: 2.0, totalCredits: 16, isComplete: true },
      previousTermGPA: { termId: "2025B", gpa: 3.2, totalCredits: 16, isComplete: true },
      currentInTermAvgScore: null,
      previousInTermAvgScore: null,
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateGpaDrop(input, {
      gpaDropThreshold: 1.0,
      minCreditsPerTerm: 12,
      inTermScoreDropThreshold: 2.5,
    });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-ACA-03");
  });

  it("should trigger for in-term score drop", () => {
    const input: AcaGpaDropInput = {
      studentId: "SV001",
      termId: "2026A",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      currentTermGPA: null,
      previousTermGPA: null,
      currentInTermAvgScore: 4.0,
      previousInTermAvgScore: 7.0,
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateGpaDrop(input, {
      gpaDropThreshold: 1.0,
      minCreditsPerTerm: 12,
      inTermScoreDropThreshold: 2.5,
    });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-ACA-03");
  });
});

// ==========================================
// HR-ACA-04: Retake
// ==========================================

describe("HR-ACA-04 — Retake", () => {
  it("should trigger when attemptNumber >= 3 and RETAKE_FAILED", () => {
    const input: AcaRetakeInput = {
      studentId: "SV001",
      termId: "2026A",
      enrollmentId: "ENR003",
      courseSectionId: "CS003",
      courseId: "C001",
      courseName: "Toán cao cấp",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      currentAttemptNumber: 3,
      currentEnrollmentType: "RETAKE_FAILED",
      previousAttempts: [
        {
          enrollmentId: "ENR001",
          courseSectionId: "CS001",
          courseId: "C001",
          courseName: "Toán",
          attemptNumber: 1,
          enrollmentType: "RETAKE_FAILED",
          attemptOutcome: "FAILED",
        },
        {
          enrollmentId: "ENR002",
          courseSectionId: "CS002",
          courseId: "C001",
          courseName: "Toán",
          attemptNumber: 2,
          enrollmentType: "RETAKE_FAILED",
          attemptOutcome: "FAILED",
        },
      ],
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateRetake(input, { maxRetakeAttempts: 3 });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-ACA-04");
  });

  it("should NOT trigger for RETAKE_IMPROVEMENT", () => {
    const input: AcaRetakeInput = {
      studentId: "SV001",
      termId: "2026A",
      enrollmentId: "ENR003",
      courseSectionId: "CS003",
      courseId: "C001",
      courseName: "Toán",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      currentAttemptNumber: 3,
      currentEnrollmentType: "RETAKE_IMPROVEMENT",
      previousAttempts: [],
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateRetake(input, { maxRetakeAttempts: 3 });
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-LMS-01: LMS Inactivity
// ==========================================

describe("HR-LMS-01 — LMS Inactivity", () => {
  it("should trigger CRITICAL when >=14 days inactive and missed past due assignment", () => {
    const input: LmsInactivityInput = {
      studentId: "SV001",
      termId: "2026A",
      enrollmentId: "ENR001",
      courseSectionId: "CS001",
      courseName: "Tin đại cương",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      usesLMS: true,
      activityEvents: [{ eventId: "e1", eventType: "VIEW", timestamp: makeDate(16) }],
      submissions: [],
      pastDueAssignments: [
        {
          assignmentId: "a1",
          title: "Bài tập 1",
          isRequired: true,
          defaultDeadline: makeDate(5),
          sequenceNumber: 1,
          status: "PUBLISHED",
          assignmentType: "ASSIGNMENT",
        },
      ],
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateLmsInactivity(input, {
      mediumDaysMin: 5,
      mediumDaysMax: 7,
      highDaysMin: 8,
      highDaysMax: 13,
      criticalDaysMin: 14,
    });
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("CRITICAL");
  });

  it("should NOT trigger when recent activity exists", () => {
    const input: LmsInactivityInput = {
      studentId: "SV001",
      termId: "2026A",
      enrollmentId: "ENR001",
      courseSectionId: "CS001",
      courseName: "Tin đại cương",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      usesLMS: true,
      activityEvents: [{ eventId: "e1", eventType: "VIEW", timestamp: makeDate(2) }],
      submissions: [],
      pastDueAssignments: [],
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateLmsInactivity(input, {
      mediumDaysMin: 5,
      mediumDaysMax: 7,
      highDaysMin: 8,
      highDaysMax: 13,
      criticalDaysMin: 14,
    });
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-LMS-02: Missed Submissions
// ==========================================

describe("HR-LMS-02 — Missed Submissions", () => {
  it("should trigger when 2 consecutive required assignments missed", () => {
    const input: LmsMissedSubmissionsInput = {
      studentId: "SV001",
      termId: "2026A",
      enrollmentId: "ENR001",
      courseSectionId: "CS001",
      courseName: "Tin đại cương",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      assignments: [
        {
          assignmentId: "a1",
          title: "BT1",
          isRequired: true,
          defaultDeadline: makeDate(10),
          sequenceNumber: 1,
          status: "PUBLISHED",
          assignmentType: "ASSIGNMENT",
        },
        {
          assignmentId: "a2",
          title: "BT2",
          isRequired: true,
          defaultDeadline: makeDate(5),
          sequenceNumber: 2,
          status: "PUBLISHED",
          assignmentType: "ASSIGNMENT",
        },
      ],
      submissions: [],
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateMissedSubmissions(input, { consecutiveMissedThreshold: 2 });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-LMS-02");
    expect(result!.severity).toBe("MEDIUM");
  });

  it("should NOT trigger if student submitted one of them", () => {
    const input: LmsMissedSubmissionsInput = {
      studentId: "SV001",
      termId: "2026A",
      enrollmentId: "ENR001",
      courseSectionId: "CS001",
      courseName: "Tin đại cương",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      assignments: [
        {
          assignmentId: "a1",
          title: "BT1",
          isRequired: true,
          defaultDeadline: makeDate(10),
          sequenceNumber: 1,
          status: "PUBLISHED",
          assignmentType: "ASSIGNMENT",
        },
        {
          assignmentId: "a2",
          title: "BT2",
          isRequired: true,
          defaultDeadline: makeDate(5),
          sequenceNumber: 2,
          status: "PUBLISHED",
          assignmentType: "ASSIGNMENT",
        },
      ],
      submissions: [
        {
          submissionId: "s1",
          assignmentId: "a1",
          isLatest: true,
          submittedAt: makeDate(11),
          score: 8,
        },
      ],
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateMissedSubmissions(input, { consecutiveMissedThreshold: 2 });
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-LMS-03: Consecutive Zero Scores
// ==========================================

describe("HR-LMS-03 — Consecutive Zero Scores", () => {
  it("should trigger when 2 consecutive auto-graded tests score 0", () => {
    const input: LmsConsecutiveZeroInput = {
      studentId: "SV001",
      termId: "2026A",
      enrollmentId: "ENR001",
      courseSectionId: "CS001",
      courseName: "Tin đại cương",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      assignments: [
        {
          assignmentId: "q1",
          title: "Quiz 1",
          isRequired: true,
          defaultDeadline: makeDate(10),
          sequenceNumber: 1,
          status: "PUBLISHED",
          assignmentType: "QUIZ",
        },
        {
          assignmentId: "q2",
          title: "Quiz 2",
          isRequired: true,
          defaultDeadline: makeDate(5),
          sequenceNumber: 2,
          status: "PUBLISHED",
          assignmentType: "QUIZ",
        },
      ],
      submissions: [
        {
          submissionId: "s1",
          assignmentId: "q1",
          isLatest: true,
          submittedAt: makeDate(10),
          score: 0,
        },
        {
          submissionId: "s2",
          assignmentId: "q2",
          isLatest: true,
          submittedAt: makeDate(5),
          score: 0,
        },
      ],
      exceptions: NO_EXCEPTIONS,
    };
    const result = evaluateConsecutiveZeroScores(input, {
      consecutiveZeroThreshold: 2,
      failingScore: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-LMS-03");
    expect(result!.severity).toBe("MEDIUM");
  });
});

// ==========================================
// HR-COMB-01: Multi-Source Negative Signal
// ==========================================

describe("HR-COMB-01 — Multi-Source Negative Signal", () => {
  it("should trigger when >=2 sources show negative signals", () => {
    const input: CombMultiSourceInput = {
      studentId: "SV001",
      termId: "2026A",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      exceptions: NO_EXCEPTIONS,
      attendanceSignal: { hasNegativeSignal: true, absenceRate: 0.15, details: "Vắng 15%" },
      academicSignal: { hasNegativeSignal: true, avgRecentScore: 3.5, details: "Điểm TB 3.5" },
      lmsSignal: null,
    };
    const result = evaluateMultiSourceNegative(input, {
      windowDays: 14,
      minSourceGroups: 2,
      attendanceNegativeThreshold: 0.1,
      academicNegativeThreshold: 5.0,
      lmsNegativeThreshold: 7,
    });
    expect(result).not.toBeNull();
    expect(result!.ruleCode).toBe("HR-COMB-01");
    expect(result!.severity).toBe("CRITICAL");
  });

  it("should NOT trigger when only 1 source shows negative signal", () => {
    const input: CombMultiSourceInput = {
      studentId: "SV001",
      termId: "2026A",
      ruleVersionId: "rv1",
      evaluationDate: new Date("2026-09-15"),
      exceptions: NO_EXCEPTIONS,
      attendanceSignal: { hasNegativeSignal: true, absenceRate: 0.15, details: "Vắng 15%" },
      academicSignal: null,
      lmsSignal: null,
    };
    const result = evaluateMultiSourceNegative(input, {
      windowDays: 14,
      minSourceGroups: 2,
      attendanceNegativeThreshold: 0.1,
      academicNegativeThreshold: 5.0,
      lmsNegativeThreshold: 7,
    });
    expect(result).toBeNull();
  });
});

// ==========================================
// HR-COMB-02: Complete Disappearance
// ==========================================

describe("HR-COMB-02 — Complete Disappearance", () => {
  const baseInput: CombDisappearanceInput = {
    studentId: "SV001",
    termId: "2026A",
    ruleVersionId: "rv1",
    evaluationDate: new Date("2026-09-15"),
    exceptions: NO_EXCEPTIONS,
    lastKnownActivityDate: null,
  };

  it("should trigger when no activity ever recorded", () => {
    const result = evaluateCompleteDisappearance(baseInput, { disappearanceDays: 10 });
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("CRITICAL");
    expect(result!.inputSnapshot.dataPoints).toHaveProperty("urgentContactRequired", true);
  });

  it("should trigger when inactive for 10+ days", () => {
    const result = evaluateCompleteDisappearance(
      { ...baseInput, lastKnownActivityDate: makeDate(12) },
      { disappearanceDays: 10 }
    );
    expect(result).not.toBeNull();
  });

  it("should NOT trigger when recent activity", () => {
    const result = evaluateCompleteDisappearance(
      { ...baseInput, lastKnownActivityDate: makeDate(5) },
      { disappearanceDays: 10 }
    );
    expect(result).toBeNull();
  });

  it("should skip when exceptions.skipAll is true", () => {
    const result = evaluateCompleteDisappearance(
      { ...baseInput, exceptions: ALL_SKIPPED },
      { disappearanceDays: 10 }
    );
    expect(result).toBeNull();
  });
});

// ==========================================
// RiskScore Calculator
// ==========================================

describe("RiskScore Calculator", () => {
  it("should return FULL when all groups AVAILABLE", () => {
    const result = calculateRiskScore([
      { group: "ATTENDANCE", weight: 0.35, normalizedRisk: 0.5, dataStatus: "AVAILABLE" },
      { group: "ACADEMIC", weight: 0.4, normalizedRisk: 0.3, dataStatus: "AVAILABLE" },
      { group: "LMS", weight: 0.25, normalizedRisk: 0.2, dataStatus: "AVAILABLE" },
    ]);
    expect(result.dataCompletenessLevel).toBe("FULL");
    expect(result.riskScoreValue).not.toBeNull();
    // (0.35*0.5 + 0.40*0.3 + 0.25*0.2) / (0.35+0.40+0.25) = (0.175+0.12+0.05)/1.0 = 0.345
    expect(result.riskScoreValue!).toBeCloseTo(0.345, 3);
  });

  it("should return PARTIAL and renormalize when one group MISSING", () => {
    const result = calculateRiskScore([
      { group: "ATTENDANCE", weight: 0.35, normalizedRisk: 0.5, dataStatus: "AVAILABLE" },
      { group: "ACADEMIC", weight: 0.4, normalizedRisk: 0.3, dataStatus: "AVAILABLE" },
      { group: "LMS", weight: 0.25, normalizedRisk: 0.2, dataStatus: "MISSING" },
    ]);
    expect(result.dataCompletenessLevel).toBe("PARTIAL");
    expect(result.riskScoreValue).not.toBeNull();
    // Renormalized: (0.35*0.5 + 0.40*0.3) / (0.35+0.40) = 0.295/0.75 ≈ 0.3933
    expect(result.riskScoreValue!).toBeCloseTo(0.3933, 3);
  });

  it("should return INSUFFICIENT and NULL score when no groups AVAILABLE", () => {
    const result = calculateRiskScore([
      { group: "ATTENDANCE", weight: 0.35, normalizedRisk: 0.5, dataStatus: "MISSING" },
      { group: "ACADEMIC", weight: 0.4, normalizedRisk: 0.3, dataStatus: "STALE" },
      { group: "LMS", weight: 0.25, normalizedRisk: 0.2, dataStatus: "NOT_APPLICABLE" },
    ]);
    expect(result.dataCompletenessLevel).toBe("INSUFFICIENT");
    expect(result.riskScoreValue).toBeNull();
  });

  it("should handle NOT_APPLICABLE correctly (excluded from calculation)", () => {
    const result = calculateRiskScore([
      { group: "ATTENDANCE", weight: 0.35, normalizedRisk: 0.8, dataStatus: "AVAILABLE" },
      { group: "ACADEMIC", weight: 0.4, normalizedRisk: 0.6, dataStatus: "AVAILABLE" },
      { group: "LMS", weight: 0.25, normalizedRisk: 0, dataStatus: "NOT_APPLICABLE" },
    ]);
    expect(result.dataCompletenessLevel).toBe("PARTIAL");
    // (0.35*0.8 + 0.40*0.6) / (0.35+0.40) = 0.52/0.75 ≈ 0.6933
    expect(result.riskScoreValue!).toBeCloseTo(0.6933, 3);
  });
});

// ==========================================
// Pipeline Integration Test
// ==========================================

describe("Pipeline — 10-Step Order", () => {
  it("should execute all 10 steps in order", () => {
    const data = {
      studentId: "SV001",
      termId: "2026A",
      advisorId: "CVHT01",
      enrollmentExceptions: [],
      attendanceInputs: [],
      multiCourseAttendanceInput: null,
      noShowStartInputs: [],
      failingScoreInputs: [],
      warningInput: null,
      gpaDropInput: null,
      retakeInputs: [],
      lmsInactivityInputs: [],
      lmsMissedInputs: [],
      lmsZeroInputs: [],
      multiSourceInput: null,
      disappearanceInput: null,
      riskScoreInputs: [],
      existingAlerts: [],
    };

    const result = executeRuleEnginePipeline(data, [], {
      studentId: "SV001",
      termId: "2026A",
      evaluationDate: new Date("2026-09-15"),
      dryRun: true,
    });

    expect(result.steps).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(result.steps[i].step).toBe(i + 1);
    }
  });

  it("should not persist anything in dry-run mode", () => {
    const data = {
      studentId: "SV001",
      termId: "2026A",
      advisorId: "CVHT01",
      enrollmentExceptions: [],
      attendanceInputs: [],
      multiCourseAttendanceInput: null,
      noShowStartInputs: [],
      failingScoreInputs: [],
      warningInput: null,
      gpaDropInput: null,
      retakeInputs: [],
      lmsInactivityInputs: [],
      lmsMissedInputs: [],
      lmsZeroInputs: [],
      multiSourceInput: null,
      disappearanceInput: null,
      riskScoreInputs: [],
      existingAlerts: [],
    };

    const result = executeRuleEnginePipeline(data, [], {
      studentId: "SV001",
      termId: "2026A",
      evaluationDate: new Date("2026-09-15"),
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    // Step 9 and 10 should say DRY RUN
    expect(result.steps[8].name).toContain("DRY RUN");
    expect(result.steps[9].name).toContain("DRY RUN");
  });
});

// ==========================================
// Zod Validators
// ==========================================

describe("Zod Validators", () => {
  it("should validate HR-ATT-01 condition", () => {
    const result = validateCondition("HR-ATT-01", { consecutiveThreshold: 5 });
    expect(result).toHaveProperty("consecutiveThreshold", 5);
  });

  it("should apply defaults for HR-ATT-01", () => {
    const result = validateCondition("HR-ATT-01", {});
    expect(result).toHaveProperty("consecutiveThreshold", 3);
  });

  it("should reject unknown ruleCode", () => {
    expect(() => validateCondition("INVALID", {})).toThrow("Unknown ruleCode");
  });

  it("should validate HR-ATT-02 with all fields", () => {
    const result = validateCondition("HR-ATT-02", {
      absenceRateThreshold: 0.3,
      comparisonOperator: ">",
      countLateAsAbsence: true,
      lateToAbsenceRatio: 0.5,
      countExcusedAbsence: true,
      countMakeupSessions: false,
    });
    expect(result).toHaveProperty("absenceRateThreshold", 0.3);
    expect(result).toHaveProperty("comparisonOperator", ">");
  });
});
