/**
 * Risk Score Calculator
 *
 * Implements the weighted renormalized RiskScore formula from 00-project-context.md:
 * RiskScore = Σ(weight_i × normalizedRisk_i) / Σ(weight_i)
 * Only over indicators with DataStatus = AVAILABLE.
 *
 * Pure function — KHÔNG import next/* hoặc gọi Prisma bên trong.
 */

import type { DataStatus, RiskScoreInput } from "../validators/rule-engine.schema";
import type { ComponentUsed } from "../validators/rule-engine.schema";

export interface RiskScoreResult {
  /** Calculated risk score (0-1 scale), NULL if INSUFFICIENT */
  riskScoreValue: number | null;
  /** Data completeness level */
  dataCompletenessLevel: "FULL" | "PARTIAL" | "INSUFFICIENT";
  /** Components used in calculation (for audit) */
  componentsUsed: ComponentUsed[];
}

/**
 * Calculate the RiskScore for a student, applying renormalization
 * for missing data groups.
 *
 * @param inputs - Array of risk inputs per group (ATTENDANCE, ACADEMIC, LMS)
 * @returns RiskScoreResult with value and completeness level
 */
export function calculateRiskScore(inputs: RiskScoreInput[]): RiskScoreResult {
  const componentsUsed: ComponentUsed[] = inputs.map((input) => ({
    group: input.group,
    weight: input.weight,
    normalizedRisk: input.normalizedRisk,
    dataStatus: input.dataStatus,
  }));

  // Filter to AVAILABLE inputs only (renormalize)
  const availableInputs = inputs.filter((i) => i.dataStatus === "AVAILABLE");

  // Determine DataCompletenessLevel
  const totalGroups = inputs.length;
  const availableGroups = availableInputs.length;

  let dataCompletenessLevel: "FULL" | "PARTIAL" | "INSUFFICIENT";

  if (availableGroups === totalGroups && totalGroups > 0) {
    dataCompletenessLevel = "FULL";
  } else if (availableGroups >= 1) {
    dataCompletenessLevel = "PARTIAL";
  } else {
    dataCompletenessLevel = "INSUFFICIENT";
  }

  // INSUFFICIENT: riskScoreValue = NULL
  // CẤM hiển thị là rủi ro thấp
  if (dataCompletenessLevel === "INSUFFICIENT") {
    return {
      riskScoreValue: null,
      dataCompletenessLevel,
      componentsUsed,
    };
  }

  // Calculate renormalized weighted sum
  const totalWeight = availableInputs.reduce((sum, i) => sum + i.weight, 0);

  if (totalWeight === 0) {
    return {
      riskScoreValue: null,
      dataCompletenessLevel: "INSUFFICIENT",
      componentsUsed,
    };
  }

  const weightedSum = availableInputs.reduce((sum, i) => sum + i.weight * i.normalizedRisk, 0);

  const riskScoreValue = weightedSum / totalWeight;

  // Clamp to [0, 1]
  const clampedScore = Math.max(0, Math.min(1, riskScoreValue));

  return {
    riskScoreValue: clampedScore,
    dataCompletenessLevel,
    componentsUsed,
  };
}

/**
 * Determine the DataStatus for an indicator group based on
 * the available data for that group.
 */
export function determineDataStatus(params: {
  hasData: boolean;
  isApplicable: boolean;
  lastSyncAge?: number; // hours since last sync
  stalenessThresholdHours?: number;
  hasValidationErrors?: boolean;
}): DataStatus {
  if (!params.isApplicable) return "NOT_APPLICABLE";
  if (params.hasValidationErrors) return "INVALID";
  if (!params.hasData) return "MISSING";
  if (
    params.lastSyncAge !== undefined &&
    params.stalenessThresholdHours !== undefined &&
    params.lastSyncAge > params.stalenessThresholdHours
  ) {
    return "STALE";
  }
  return "AVAILABLE";
}
