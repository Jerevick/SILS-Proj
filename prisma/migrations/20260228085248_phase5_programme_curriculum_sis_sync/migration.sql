-- CreateEnum
CREATE TYPE "SyllabusStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "curriculumJson" JSONB,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeModule" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "lecturerId" TEXT,
    "title" TEXT NOT NULL,
    "syllabusText" TEXT,
    "syllabusGeneratedJson" JSONB,
    "syllabusStatus" "SyllabusStatus" NOT NULL DEFAULT 'DRAFT',
    "isCore" BOOLEAN NOT NULL DEFAULT true,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "prerequisites" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgrammeEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeModuleGrade" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programmeModuleId" TEXT NOT NULL,
    "grade" TEXT,
    "completedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeModuleGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseProgrammeLink" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseProgrammeLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Faculty_tenantId_idx" ON "Faculty"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_tenantId_code_key" ON "Faculty"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE INDEX "Department_facultyId_idx" ON "Department"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_code_key" ON "Department"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Programme_departmentId_idx" ON "Programme"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_departmentId_code_key" ON "Programme"("departmentId", "code");

-- CreateIndex
CREATE INDEX "ProgrammeModule_programmeId_idx" ON "ProgrammeModule"("programmeId");

-- CreateIndex
CREATE INDEX "ProgrammeModule_lecturerId_idx" ON "ProgrammeModule"("lecturerId");

-- CreateIndex
CREATE INDEX "ProgrammeEnrollment_programmeId_idx" ON "ProgrammeEnrollment"("programmeId");

-- CreateIndex
CREATE INDEX "ProgrammeEnrollment_studentId_idx" ON "ProgrammeEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeEnrollment_programmeId_studentId_key" ON "ProgrammeEnrollment"("programmeId", "studentId");

-- CreateIndex
CREATE INDEX "ProgrammeModuleGrade_programmeModuleId_idx" ON "ProgrammeModuleGrade"("programmeModuleId");

-- CreateIndex
CREATE INDEX "ProgrammeModuleGrade_studentId_idx" ON "ProgrammeModuleGrade"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeModuleGrade_programmeModuleId_studentId_key" ON "ProgrammeModuleGrade"("programmeModuleId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseProgrammeLink_courseId_key" ON "CourseProgrammeLink"("courseId");

-- CreateIndex
CREATE INDEX "CourseProgrammeLink_programmeId_idx" ON "CourseProgrammeLink"("programmeId");

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeModule" ADD CONSTRAINT "ProgrammeModule_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeEnrollment" ADD CONSTRAINT "ProgrammeEnrollment_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeModuleGrade" ADD CONSTRAINT "ProgrammeModuleGrade_programmeModuleId_fkey" FOREIGN KEY ("programmeModuleId") REFERENCES "ProgrammeModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProgrammeLink" ADD CONSTRAINT "CourseProgrammeLink_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProgrammeLink" ADD CONSTRAINT "CourseProgrammeLink_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
