-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" VARCHAR(50) NOT NULL,
    "actorRole" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "targetEntity" VARCHAR(50) NOT NULL,
    "targetId" VARCHAR(100),
    "details" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemIntegrationConfig" (
    "id" TEXT NOT NULL,
    "systemType" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "baseUrl" VARCHAR(255) NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncSchedule" VARCHAR(50),
    "lastSyncAt" TIMESTAMP(3),
    "configJson" JSONB,
    "updatedBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemIntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetEntity_createdAt_idx" ON "AuditLog"("targetEntity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemIntegrationConfig_systemType_key" ON "SystemIntegrationConfig"("systemType");
