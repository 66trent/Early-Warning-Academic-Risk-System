/**
 * BullMQ Worker — evaluate-hard-triggers
 * Processes batch evaluation jobs from the queue.
 */

import type { Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  fetchActiveRuleVersions,
  fetchStudentEvaluationData,
} from "@/modules/rule-engine/services/data-fetcher.service";
import { executeRuleEnginePipeline } from "@/modules/rule-engine/services/orchestrator.service";
import { persistPipelineResult } from "@/modules/rule-engine/services/persistence.service";
import { sendNotificationsQueue } from "@/lib/queue";

interface EvaluationJobData {
  termId: string;
  studentIds?: string[];
  dryRun: boolean;
  requestedBy: string;
}

export async function processEvaluationJob(job: Job<EvaluationJobData>) {
  const { termId, studentIds, dryRun, requestedBy } = job.data;

  console.log(
    `[evaluate-hard-triggers] Starting ${dryRun ? "DRY RUN" : "evaluation"} for term ${termId} requested by ${requestedBy}`
  );

  // Fetch active rules
  const activeRuleVersions = await fetchActiveRuleVersions();
  if (activeRuleVersions.length === 0) {
    console.warn("[evaluate-hard-triggers] No ACTIVE rule versions found.");
    return { success: true, studentsProcessed: 0 };
  }

  // Determine students
  let targetStudentIds: string[];
  if (studentIds && studentIds.length > 0) {
    targetStudentIds = studentIds;
  } else {
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
  let processedCount = 0;
  let errorCount = 0;
  let totalTriggers = 0;

  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < targetStudentIds.length; i += batchSize) {
    const batch = targetStudentIds.slice(i, i + batchSize);

    await job.updateProgress(Math.round((i / targetStudentIds.length) * 100));

    for (const studentId of batch) {
      try {
        const studentData = await fetchStudentEvaluationData(studentId, termId, evaluationDate);

        const pipelineResult = executeRuleEnginePipeline(studentData, activeRuleVersions, {
          studentId,
          termId,
          evaluationDate,
          dryRun,
        });

        if (!dryRun) {
          const persistResult = await persistPipelineResult(
            pipelineResult,
            activeRuleVersions[0].id
          );

          // Queue notifications for new alerts
          if (persistResult.alertsCreated > 0) {
            for (const alertAction of pipelineResult.alertActions) {
              if (alertAction.type === "CREATE") {
                await sendNotificationsQueue.add(
                  "alert-notification",
                  {
                    studentId: alertAction.studentId,
                    termId: alertAction.termId,
                    ruleCode: alertAction.ruleCode,
                    severity: alertAction.severity,
                    advisorId: alertAction.assignedAdvisorId,
                    triggerCount: alertAction.triggers.length,
                  },
                  {
                    jobId: `notif-${alertAction.correlationKey}-${Date.now()}`,
                    attempts: 3,
                    backoff: { type: "exponential", delay: 3000 },
                  }
                );
              }
            }
          }

          totalTriggers += persistResult.triggersCreated;
        } else {
          totalTriggers += pipelineResult.triggers.length;
        }

        processedCount++;
      } catch (err) {
        console.error(`[evaluate-hard-triggers] Error processing student ${studentId}:`, err);
        errorCount++;
      }
    }
  }

  await job.updateProgress(100);

  console.log(
    `[evaluate-hard-triggers] Complete: ${processedCount} students processed, ${totalTriggers} triggers, ${errorCount} errors`
  );

  return {
    success: true,
    studentsProcessed: processedCount,
    triggersGenerated: totalTriggers,
    errors: errorCount,
    dryRun,
  };
}
