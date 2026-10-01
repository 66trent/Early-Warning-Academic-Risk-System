-- CreateEnum
CREATE TYPE "RuleGroup" AS ENUM ('ATTENDANCE', 'ACADEMIC', 'LMS', 'COMBINED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'INVALIDATED', 'REOPENED');

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('EMAIL', 'PHONE_CALL', 'IN_PERSON_MEETING', 'ACADEMIC_PLAN', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ConfidentialityLevel" AS ENUM ('NORMAL', 'SENSITIVE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SUPPRESSED_DUPLICATE');

-- CreateEnum
CREATE TYPE "DataCompletenessLevel" AS ENUM ('FULL', 'PARTIAL', 'INSUFFICIENT');

-- CreateTable
CREATE TABLE "Rule" (
    "ruleCode" VARCHAR(20) NOT NULL,
    "ruleName" VARCHAR(100) NOT NULL,
    "ruleGroup" "RuleGroup" NOT NULL,
    "scope" VARCHAR(30) NOT NULL,
    "priority" INTEGER NOT NULL,
    "cooldown" INTEGER NOT NULL,
    "status" "RuleStatus" NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("ruleCode")
);

-- CreateTable
CREATE TABLE "RuleVersion" (
    "id" TEXT NOT NULL,
    "ruleCode" VARCHAR(20) NOT NULL,
    "version" INTEGER NOT NULL,
    "condition" JSONB NOT NULL,
    "severity" "Severity" NOT NULL,
    "action" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "RuleStatus" NOT NULL,
    "configuredBy" VARCHAR(20) NOT NULL,
    "approvedBy" VARCHAR(20),

    CONSTRAINT "RuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleTrigger" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "ruleCode" VARCHAR(20) NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "studentId" VARCHAR(20) NOT NULL,
    "scopeId" VARCHAR(20) NOT NULL,
    "termId" VARCHAR(10) NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,

    CONSTRAINT "RuleTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScoreLog" (
    "id" TEXT NOT NULL,
    "studentId" VARCHAR(20) NOT NULL,
    "termId" VARCHAR(10) NOT NULL,
    "riskScoreValue" DOUBLE PRECISION,
    "dataCompletenessLevel" "DataCompletenessLevel" NOT NULL,
    "componentsUsed" JSONB NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskScoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "alertId" TEXT NOT NULL,
    "studentId" VARCHAR(20) NOT NULL,
    "termId" VARCHAR(10) NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL,
    "assignedAdvisorId" VARCHAR(20) NOT NULL,
    "riskScoreLogId" TEXT,
    "isReferenceOnly" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("alertId")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "interventionId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "performedBy" VARCHAR(20) NOT NULL,
    "type" "InterventionType" NOT NULL,
    "content" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL,
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("interventionId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "notificationId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "recipientId" VARCHAR(20) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "dedupKey" VARCHAR(100) NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("notificationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "RuleVersion_ruleCode_version_key" ON "RuleVersion"("ruleCode", "version");

-- CreateIndex
CREATE INDEX "Notification_dedupKey_createdAt_idx" ON "Notification"("dedupKey", "createdAt");

-- AddForeignKey
ALTER TABLE "RuleVersion" ADD CONSTRAINT "RuleVersion_ruleCode_fkey" FOREIGN KEY ("ruleCode") REFERENCES "Rule"("ruleCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleVersion" ADD CONSTRAINT "RuleVersion_configuredBy_fkey" FOREIGN KEY ("configuredBy") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleVersion" ADD CONSTRAINT "RuleVersion_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleTrigger" ADD CONSTRAINT "RuleTrigger_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("alertId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleTrigger" ADD CONSTRAINT "RuleTrigger_ruleCode_fkey" FOREIGN KEY ("ruleCode") REFERENCES "Rule"("ruleCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleTrigger" ADD CONSTRAINT "RuleTrigger_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleTrigger" ADD CONSTRAINT "RuleTrigger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleTrigger" ADD CONSTRAINT "RuleTrigger_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("termId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScoreLog" ADD CONSTRAINT "RiskScoreLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScoreLog" ADD CONSTRAINT "RiskScoreLog_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("termId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScoreLog" ADD CONSTRAINT "RiskScoreLog_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("termId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_assignedAdvisorId_fkey" FOREIGN KEY ("assignedAdvisorId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_riskScoreLogId_fkey" FOREIGN KEY ("riskScoreLogId") REFERENCES "RiskScoreLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("alertId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("alertId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
