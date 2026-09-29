-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADVISOR', 'TRAINING_OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OfficialAcademicStatus" AS ENUM ('ACTIVE', 'RESERVED', 'SUSPENDED', 'GRADUATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('NOT_STARTED', 'ONGOING', 'ENDED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('REGISTERED', 'WITHDRAWN', 'COMPLETED', 'CANCELLED_BY_SECTION');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('NORMAL', 'RETAKE_FAILED', 'RETAKE_IMPROVEMENT', 'RETAKE_CURRICULUM_CHANGE');

-- CreateEnum
CREATE TYPE "AttemptOutcome" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "userId" TEXT NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "scopeConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Student" (
    "studentId" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "classId" VARCHAR(20) NOT NULL,
    "departmentId" VARCHAR(10) NOT NULL,
    "cohortYear" VARCHAR(10) NOT NULL,
    "advisorId" VARCHAR(20) NOT NULL,
    "officialAcademicStatus" "OfficialAcademicStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "Term" (
    "termId" VARCHAR(10) NOT NULL,
    "termName" VARCHAR(50) NOT NULL,
    "academicYear" VARCHAR(10) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("termId")
);

-- CreateTable
CREATE TABLE "Course" (
    "courseId" VARCHAR(20) NOT NULL,
    "courseName" VARCHAR(150) NOT NULL,
    "credits" INTEGER NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("courseId")
);

-- CreateTable
CREATE TABLE "CourseSection" (
    "courseSectionId" VARCHAR(20) NOT NULL,
    "courseId" VARCHAR(20) NOT NULL,
    "termId" VARCHAR(10) NOT NULL,
    "instructorId" VARCHAR(20),
    "usesLMS" BOOLEAN NOT NULL,
    "sectionStatus" "SectionStatus" NOT NULL,

    CONSTRAINT "CourseSection_pkey" PRIMARY KEY ("courseSectionId")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "enrollmentId" TEXT NOT NULL,
    "studentId" VARCHAR(20) NOT NULL,
    "courseSectionId" VARCHAR(20) NOT NULL,
    "enrollmentStatus" "EnrollmentStatus" NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "attemptNumber" INTEGER NOT NULL,
    "attemptOutcome" "AttemptOutcome",
    "enrollmentType" "EnrollmentType" NOT NULL,
    "sourceSystem" VARCHAR(30) NOT NULL,
    "sourceRecordKey" VARCHAR(50) NOT NULL,
    "importBatchId" TEXT NOT NULL DEFAULT 'bootstrap-batch',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("enrollmentId")
);

-- CreateTable
CREATE TABLE "CourseSessionSchedule" (
    "sessionId" TEXT NOT NULL,
    "courseSectionId" VARCHAR(20) NOT NULL,
    "sessionDate" DATE NOT NULL,
    "sessionStatus" "SessionStatus" NOT NULL,
    "cancelReason" TEXT,

    CONSTRAINT "CourseSessionSchedule_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_sourceSystem_sourceRecordKey_key" ON "Enrollment"("sourceSystem", "sourceRecordKey");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSessionSchedule_courseSectionId_sessionDate_key" ON "CourseSessionSchedule"("courseSectionId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("courseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("termId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "CourseSection"("courseSectionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSessionSchedule" ADD CONSTRAINT "CourseSessionSchedule_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "CourseSection"("courseSectionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
