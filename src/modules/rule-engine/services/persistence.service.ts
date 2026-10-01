/**
 * Persistence Service — writes Rule Engine pipeline results to DB.
 * Called by Server Actions and Workers AFTER the pure pipeline executes.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { PipelineResult } from "./orchestrator.service";
import { dispatchNotification } from "@/modules/alerts/services/notification.service";

/**
 * Persist a complete pipeline result to the database.
 * Skips persistence if dryRun is true.
 */
export async function persistPipelineResult(
  result: PipelineResult,
  ruleVersionIdForScore: string
): Promise<{
  alertsCreated: number;
  alertsUpdated: number;
  triggersCreated: number;
  riskScoreLogId: string | null;
}> {
  if (result.dryRun) {
    return {
      alertsCreated: 0,
      alertsUpdated: 0,
      triggersCreated: 0,
      riskScoreLogId: null,
    };
  }

  let alertsCreated = 0;
  let alertsUpdated = 0;
  let triggersCreated = 0;
  let riskScoreLogId: string | null = null;

  // 1. Persist RiskScoreLog
  if (result.riskScore) {
    const scoreLog = await prisma.riskScoreLog.create({
      data: {
        studentId: result.studentId,
        termId: result.termId,
        riskScoreValue: result.riskScore.riskScoreValue,
        dataCompletenessLevel: result.riskScore.dataCompletenessLevel,
        componentsUsed: result.riskScore.componentsUsed,
        ruleVersionId: ruleVersionIdForScore,
        calculatedAt: new Date(),
      },
    });
    riskScoreLogId = scoreLog.id;
  }

  // 2. Persist Alerts and RuleTriggers
  for (const alertAction of result.alertActions) {
    if (alertAction.type === "CREATE") {
      const alert = await prisma.alert.create({
        data: {
          studentId: alertAction.studentId,
          termId: alertAction.termId,
          severity: alertAction.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          status: "OPEN",
          firstDetectedAt: new Date(),
          lastDetectedAt: new Date(),
          assignedAdvisorId: alertAction.assignedAdvisorId,
          riskScoreLogId,
          isReferenceOnly: true, // MUST always be true
        },
      });

      // Create triggers
      for (const trigger of alertAction.triggers) {
        await prisma.ruleTrigger.create({
          data: {
            alertId: alert.alertId,
            ruleCode: trigger.ruleCode,
            ruleVersionId: trigger.ruleVersionId,
            studentId: trigger.studentId,
            scopeId: trigger.scopeId,
            termId: trigger.termId,
            triggeredAt: new Date(),
            inputSnapshot: trigger.inputSnapshot as Prisma.InputJsonValue,
            reason: trigger.reason,
            severity: trigger.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          },
        });
        triggersCreated++;
      }

      // Dispatch notification to advisor
      if (alertAction.assignedAdvisorId) {
        try {
          await dispatchNotification({
            alertId: alert.alertId,
            studentId: alertAction.studentId,
            ruleCode: alertAction.ruleCode,
            severity: alertAction.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            recipientId: alertAction.assignedAdvisorId,
          });
        } catch (err) {
          console.error("[Persistence] Error dispatching notification:", err);
        }
      }

      alertsCreated++;
    } else if (alertAction.type === "UPDATE" && alertAction.existingAlertId) {
      // Update existing alert
      await prisma.alert.update({
        where: { alertId: alertAction.existingAlertId },
        data: {
          lastDetectedAt: new Date(),
          severity: alertAction.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          riskScoreLogId,
        },
      });

      // Add new triggers
      for (const trigger of alertAction.triggers) {
        await prisma.ruleTrigger.create({
          data: {
            alertId: alertAction.existingAlertId,
            ruleCode: trigger.ruleCode,
            ruleVersionId: trigger.ruleVersionId,
            studentId: trigger.studentId,
            scopeId: trigger.scopeId,
            termId: trigger.termId,
            triggeredAt: new Date(),
            inputSnapshot: trigger.inputSnapshot as Prisma.InputJsonValue,
            reason: trigger.reason,
            severity: trigger.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          },
        });
        triggersCreated++;
      }

      // Dispatch notification if new trigger or high severity
      if (
        alertAction.assignedAdvisorId &&
        (alertAction.severity === "HIGH" || alertAction.severity === "CRITICAL")
      ) {
        try {
          await dispatchNotification({
            alertId: alertAction.existingAlertId,
            studentId: alertAction.studentId,
            ruleCode: alertAction.ruleCode,
            severity: alertAction.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            recipientId: alertAction.assignedAdvisorId,
          });
        } catch (err) {
          console.error("[Persistence] Error dispatching notification on update:", err);
        }
      }

      alertsUpdated++;
    }
  }

  return {
    alertsCreated,
    alertsUpdated,
    triggersCreated,
    riskScoreLogId,
  };
}
