-- CreateEnum
CREATE TYPE "PlannerItemStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PlannerItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'block',
    "originModule" TEXT,
    "originType" TEXT,
    "originId" TEXT,
    "status" "PlannerItemStatus" NOT NULL DEFAULT 'SCHEDULED',
    "priority" "TaskPriority",
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMin" INTEGER,
    "context" TEXT,
    "energy" "GtdEnergy",
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "isDerived" BOOLEAN NOT NULL DEFAULT false,
    "calendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlannerItem_calendarEventId_key" ON "PlannerItem"("calendarEventId");

-- CreateIndex
CREATE INDEX "PlannerItem_userId_scheduledStart_idx" ON "PlannerItem"("userId", "scheduledStart");

-- CreateIndex
CREATE INDEX "PlannerItem_userId_originType_originId_idx" ON "PlannerItem"("userId", "originType", "originId");

-- CreateIndex
CREATE INDEX "PlannerItem_userId_status_idx" ON "PlannerItem"("userId", "status");

-- AddForeignKey
ALTER TABLE "PlannerItem" ADD CONSTRAINT "PlannerItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
