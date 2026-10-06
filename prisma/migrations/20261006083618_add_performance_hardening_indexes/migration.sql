-- CreateIndex
CREATE INDEX "Alert_studentId_termId_status_idx" ON "Alert"("studentId", "termId", "status");

-- CreateIndex
CREATE INDEX "Alert_termId_severity_status_idx" ON "Alert"("termId", "severity", "status");

-- CreateIndex
CREATE INDEX "Alert_assignedAdvisorId_status_idx" ON "Alert"("assignedAdvisorId", "status");

-- CreateIndex
CREATE INDEX "ImportErrorRow_importBatchId_resolved_idx" ON "ImportErrorRow"("importBatchId", "resolved");

-- CreateIndex
CREATE INDEX "RiskScoreLog_studentId_termId_calculatedAt_idx" ON "RiskScoreLog"("studentId", "termId", "calculatedAt");

-- CreateIndex
CREATE INDEX "RuleTrigger_termId_ruleCode_idx" ON "RuleTrigger"("termId", "ruleCode");

-- CreateIndex
CREATE INDEX "RuleTrigger_studentId_termId_idx" ON "RuleTrigger"("studentId", "termId");
