-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'EXCUSED_ABSENCE', 'UNEXCUSED_ABSENCE', 'LATE');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'FINAL', 'UNDER_APPEAL', 'EXEMPT', 'WAIVED');

-- CreateEnum
CREATE TYPE "LMSAssignmentType" AS ENUM ('QUIZ', 'HOMEWORK', 'DISCUSSION', 'PROJECT');

-- CreateEnum
CREATE TYPE "LMSAssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LMSSubmissionStatus" AS ENUM ('ON_TIME', 'LATE');

-- CreateEnum
CREATE TYPE "LMSEventType" AS ENUM ('VIEW_MATERIAL', 'DISCUSSION_POST', 'LOGIN', 'ACTIVITY_COMPLETE');

-- CreateEnum
CREATE TYPE "ImportDataType" AS ENUM ('ENROLLMENT', 'ATTENDANCE', 'ASSESSMENT', 'LMS_ASSIGNMENT', 'LMS_SUBMISSION', 'LMS_EVENT');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('FILE', 'API');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADING', 'VALIDATING', 'STAGED', 'LOADED', 'RECONCILED', 'REJECTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "ImportErrorReason" AS ENUM ('INVALID_FORMAT', 'NOT_IN_CATALOG', 'DUPLICATE', 'OUT_OF_RANGE', 'NOT_ENROLLED');

-- CreateEnum
CREATE TYPE "CalendarExceptionType" AS ENUM ('HOLIDAY', 'MAKEUP_SESSION', 'EXAM_WEEK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN     "image" TEXT;

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attendanceStatus" "AttendanceStatus" NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResult" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "assessmentType" VARCHAR(30) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION,
    "scoreScale" VARCHAR(10) NOT NULL,
    "resultStatus" "ResultStatus" NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LMSAssignment" (
    "assignmentId" VARCHAR(30) NOT NULL,
    "courseSectionId" VARCHAR(20) NOT NULL,
    "assignmentType" "LMSAssignmentType" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "isRequired" BOOLEAN NOT NULL,
    "defaultDeadline" TIMESTAMP(3) NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "status" "LMSAssignmentStatus" NOT NULL,
    "importBatchId" TEXT NOT NULL,

    CONSTRAINT "LMSAssignment_pkey" PRIMARY KEY ("assignmentId")
);

-- CreateTable
CREATE TABLE "LMSDeadlineExtension" (
    "id" TEXT NOT NULL,
    "assignmentId" VARCHAR(30) NOT NULL,
    "studentId" VARCHAR(20),
    "newDeadline" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "grantedBy" VARCHAR(20) NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LMSDeadlineExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LMSAssignmentExemption" (
    "id" TEXT NOT NULL,
    "assignmentId" VARCHAR(30) NOT NULL,
    "studentId" VARCHAR(20),
    "reason" TEXT,
    "grantedBy" VARCHAR(20) NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LMSAssignmentExemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LMSSubmission" (
    "submissionId" TEXT NOT NULL,
    "assignmentId" VARCHAR(30) NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "isLatest" BOOLEAN NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION,
    "submissionStatus" "LMSSubmissionStatus" NOT NULL,
    "importBatchId" TEXT NOT NULL,

    CONSTRAINT "LMSSubmission_pkey" PRIMARY KEY ("submissionId")
);

-- CreateTable
CREATE TABLE "LMSActivityEvent" (
    "eventId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "eventType" "LMSEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "resourceId" VARCHAR(30),
    "importBatchId" TEXT NOT NULL,

    CONSTRAINT "LMSActivityEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "dataType" "ImportDataType" NOT NULL,
    "source" "DataSource" NOT NULL,
    "sourceChecksum" VARCHAR(64) NOT NULL,
    "performedBy" VARCHAR(20) NOT NULL,
    "status" "ImportBatchStatus" NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL,
    "errorRows" INTEGER NOT NULL,
    "parentBatchId" TEXT,
    "originalFilePath" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportErrorRow" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "errorReason" "ImportErrorReason" NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ImportErrorRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCalendarException" (
    "id" TEXT NOT NULL,
    "exceptionDate" DATE NOT NULL,
    "type" "CalendarExceptionType" NOT NULL,
    "description" TEXT,

    CONSTRAINT "AcademicCalendarException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LMSMaintenanceWindow" (
    "id" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,

    CONSTRAINT "LMSMaintenanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_enrollmentId_sessionId_key" ON "AttendanceRecord"("enrollmentId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResult_enrollmentId_assessmentType_key" ON "AssessmentResult"("enrollmentId", "assessmentType");

-- CreateIndex
CREATE UNIQUE INDEX "LMSSubmission_assignmentId_enrollmentId_attemptNumber_key" ON "LMSSubmission"("assignmentId", "enrollmentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("enrollmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CourseSessionSchedule"("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("enrollmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSAssignment" ADD CONSTRAINT "LMSAssignment_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "CourseSection"("courseSectionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSAssignment" ADD CONSTRAINT "LMSAssignment_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSDeadlineExtension" ADD CONSTRAINT "LMSDeadlineExtension_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "LMSAssignment"("assignmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSDeadlineExtension" ADD CONSTRAINT "LMSDeadlineExtension_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSDeadlineExtension" ADD CONSTRAINT "LMSDeadlineExtension_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSAssignmentExemption" ADD CONSTRAINT "LMSAssignmentExemption_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "LMSAssignment"("assignmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSAssignmentExemption" ADD CONSTRAINT "LMSAssignmentExemption_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSAssignmentExemption" ADD CONSTRAINT "LMSAssignmentExemption_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSSubmission" ADD CONSTRAINT "LMSSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "LMSAssignment"("assignmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSSubmission" ADD CONSTRAINT "LMSSubmission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("enrollmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSSubmission" ADD CONSTRAINT "LMSSubmission_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSActivityEvent" ADD CONSTRAINT "LMSActivityEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("enrollmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMSActivityEvent" ADD CONSTRAINT "LMSActivityEvent_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_parentBatchId_fkey" FOREIGN KEY ("parentBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportErrorRow" ADD CONSTRAINT "ImportErrorRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
