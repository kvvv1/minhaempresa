import type { CalendarEvent, GtdEnergy, PlannerItem as PrismaPlannerItem, PlannerItemStatus, TaskPriority } from '@prisma/client'
import type { PlannerEventMetadata, PlannerScheduleMode, PlannerSourceType } from '@/lib/planner'
import type { PlannerWritableSourceRecord } from '@/lib/planner-origin'
import { prisma } from '@/lib/prisma'

function toPlannerPriority(value?: string | null): TaskPriority | null {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'URGENT' ? value : null
}

function toPlannerEnergy(value?: string | null): GtdEnergy | null {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' ? value : null
}

export function getPlannerItemStatus(value?: string | null): PlannerItemStatus {
  if (value === 'COMPLETED' || value === 'DONE' || value === 'SUBMITTED' || value === 'GRADED') {
    return 'COMPLETED'
  }

  if (value === 'IN_PROGRESS' || value === 'TODO') {
    return 'IN_PROGRESS'
  }

  if (value === 'CANCELLED') {
    return 'CANCELLED'
  }

  return 'SCHEDULED'
}

export function getPlannerOriginKey(sourceType?: string | null, sourceId?: string | null) {
  if (!sourceType || !sourceId) return null
  return `${sourceType}:${sourceId}`
}

export async function findPlannerItemForOrigin({
  userId,
  sourceType,
  sourceId,
}: {
  userId: string
  sourceType: PlannerSourceType
  sourceId: string
}) {
  return prisma.plannerItem.findFirst({
    where: {
      userId,
      originType: sourceType,
      originId: sourceId,
      status: { not: 'CANCELLED' },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })
}

export async function upsertPlannerItemFromCalendarEvent({
  userId,
  event,
  metadata,
  linkedSource,
  description,
}: {
  userId: string
  event: Pick<CalendarEvent, 'id' | 'title' | 'startAt' | 'endAt' | 'allDay'>
  metadata: PlannerEventMetadata | null
  linkedSource: PlannerWritableSourceRecord | null
  description: string | null
}) {
  const createData = {
    userId,
    title: linkedSource?.title ?? event.title,
    description: description ?? linkedSource?.description ?? null,
    kind: 'block',
    originModule: linkedSource?.sourceModule ?? metadata?.sourceModule ?? null,
    originType: linkedSource?.sourceType ?? metadata?.sourceType ?? null,
    originId: linkedSource?.id ?? metadata?.sourceId ?? null,
    status: getPlannerItemStatus(linkedSource?.status),
    priority: toPlannerPriority(linkedSource?.priority),
    scheduledStart: event.startAt,
    scheduledEnd: event.endAt,
    dueDate: linkedSource?.dueDate ?? null,
    allDay: event.allDay,
    estimatedMin: linkedSource?.estimatedMin ?? null,
    context: linkedSource?.context ?? null,
    energy: toPlannerEnergy(linkedSource?.energy),
    isManual: metadata?.scheduleMode !== 'linked',
    isDerived: metadata?.scheduleMode === 'linked',
    calendarEventId: event.id,
  } as const

  return prisma.plannerItem.upsert({
    where: { calendarEventId: event.id },
    update: createData,
    create: createData,
  })
}

export async function deletePlannerItemForCalendarEvent(calendarEventId: string, userId: string) {
  const existing = await prisma.plannerItem.findFirst({
    where: {
      calendarEventId,
      userId,
    },
    select: { id: true },
  })

  if (!existing) return null

  return prisma.plannerItem.delete({
    where: { id: existing.id },
  })
}

export async function syncPlannerItemsFromOrigin({
  userId,
  source,
}: {
  userId: string
  source: PlannerWritableSourceRecord
}) {
  return prisma.plannerItem.updateMany({
    where: {
      userId,
      originType: source.sourceType,
      originId: source.id,
      status: { not: 'CANCELLED' },
    },
    data: {
      title: source.title,
      description: source.description,
      originModule: source.sourceModule,
      dueDate: source.dueDate,
      estimatedMin: source.estimatedMin,
      priority: toPlannerPriority(source.priority),
      context: source.context,
      energy: toPlannerEnergy(source.energy),
      status: getPlannerItemStatus(source.status),
    },
  })
}

export function getPlannerScheduleFromItem(item: PrismaPlannerItem) {
  const scheduleMode: PlannerScheduleMode | null = item.isManual
    ? 'manual'
    : item.isDerived
      ? 'linked'
      : null

  return {
    plannerItemId: item.id,
    scheduledStart: item.scheduledStart?.toISOString() ?? null,
    scheduledEnd: item.scheduledEnd?.toISOString() ?? null,
    allDay: item.allDay,
    scheduleMode,
    scheduleEventId: item.calendarEventId ?? null,
    description: item.description,
    title: item.title,
    detailContext: item.context,
    detailEnergy: item.energy,
    estimatedMin: item.estimatedMin,
  }
}
