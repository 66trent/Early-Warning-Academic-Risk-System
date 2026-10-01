"use server";

import { getSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { runEvaluationSchema } from "../validators/rule-engine.schema";
import {
  fetchActiveRuleVersions,
  fetchStudentEvaluationData,
} from "../services/data-fetcher.service";
import { executeRuleEnginePipeline } from "../services/orchestrator.service";
import { persistPipelineResult } from "../services/persistence.service";
import { prisma } from "@/lib/prisma";
import { evaluateHardTriggersQueue } from "@/lib/queue";

// ==========================================
// Action: Run Evaluation (manual trigger or dry-run)
// ==========================================

export async function runEvaluation(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = runEvaluationSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join("; "),
    };
  }

  // 3. Authorization — TRAINING_OFFICER or ADMIN
  const role = session.user.role;
  if (role !== "TRAINING_OFFICER" && role !== "ADMIN") {
    return { success: false, error: "Không đủ quyền chạy đánh giá." };
  }

  const { termId, studentIds, dryRun } = parseResult.data;

  try {
    // Fetch active rule versions
    const activeRuleVersions = await fetchActiveRuleVersions();
    if (activeRuleVersions.length === 0) {
      return {
        success: false,
        error: "Không có phiên bản luật nào đang ACTIVE.",
      };
    }

    // Determine students to evaluate
    let targetStudentIds: string[];
    if (studentIds && studentIds.length > 0) {
      targetStudentIds = studentIds;
    } else {
      // Fetch all students with REGISTERED enrollments in this term
      const enrollments = await prisma.enrollment.findMany({
        where: {
          courseSection: { termId },
          enrollmentStatus: "REGISTERED",
        },
        select: { studentId: true },
        distinct: ["studentId"],
      });
      targetStudentIds = enrollments.map((e) => e.studentId);
    }

    const evaluationDate = new Date();
    const results = [];

    // Evaluate each student
    for (const studentId of targetStudentIds) {
      try {
        const studentData = await fetchStudentEvaluationData(studentId, termId, evaluationDate);

        const pipelineResult = executeRuleEnginePipeline(studentData, activeRuleVersions, {
          studentId,
          termId,
          evaluationDate,
          dryRun,
        });

        // Persist if not dry-run
        if (!dryRun) {
          const persistResult = await persistPipelineResult(
            pipelineResult,
            activeRuleVersions[0].id // Use first active version for score logging
          );

          results.push({
            studentId,
            triggersCount: pipelineResult.triggers.length,
            alertActions: pipelineResult.alertActions.length,
            riskScore: pipelineResult.riskScore?.riskScoreValue,
            dataCompleteness: pipelineResult.riskScore?.dataCompletenessLevel,
            ...persistResult,
          });
        } else {
          results.push({
            studentId,
            triggersCount: pipelineResult.triggers.length,
            alertActions: pipelineResult.alertActions.length,
            riskScore: pipelineResult.riskScore?.riskScoreValue,
            dataCompleteness: pipelineResult.riskScore?.dataCompletenessLevel,
            steps: pipelineResult.steps,
            dryRun: true,
          });
        }
      } catch (err) {
        console.error(`[rule-engine] Error evaluating student ${studentId}:`, err);
        results.push({
          studentId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // 5. Audit Log
    await writeAuditLog({
      actorId: session.user.id,
      actorRole: role,
      action: dryRun ? "DRY_RUN_EVALUATION" : "RUN_EVALUATION",
      targetEntity: "RuleEngine",
      details: {
        termId,
        studentsEvaluated: targetStudentIds.length,
        dryRun,
        activeRuleVersions: activeRuleVersions.length,
      },
    });

    return {
      success: true,
      data: {
        termId,
        dryRun,
        studentsEvaluated: targetStudentIds.length,
        results,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định.";
    return { success: false, error: message };
  }
}

// ==========================================
// Action: Queue Batch Evaluation (async via BullMQ)
// ==========================================

export async function queueBatchEvaluation(rawInput: unknown) {
  // 1. Session
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Yêu cầu đăng nhập." };
  }

  // 2. Validate
  const parseResult = runEvaluationSchema.safeParse(rawInput);
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
    // Queue the job
    const job = await evaluateHardTriggersQueue.add(
      "batch-evaluation",
      {
        termId: parseResult.data.termId,
        studentIds: parseResult.data.studentIds,
        dryRun: parseResult.data.dryRun,
        requestedBy: session.user.id,
      },
      {
        jobId: `eval-${parseResult.data.termId}-${Date.now()}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }
    );

    // 5. Audit Log
    await writeAuditLog({
      actorId: session.user.id,
      actorRole: role,
      action: "QUEUE_BATCH_EVALUATION",
      targetEntity: "RuleEngine",
      details: {
        termId: parseResult.data.termId,
        jobId: job.id,
        dryRun: parseResult.data.dryRun,
      },
    });

    return {
      success: true,
      data: { jobId: job.id, status: "queued" },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định.";
    return { success: false, error: message };
  }
}
