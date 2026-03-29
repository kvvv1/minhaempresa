import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { PlannerSourceType } from '@/lib/planner'
import { parsePlannerEventDescription } from '@/lib/planner'
import { deletePlannerItemForCalendarEvent, syncPlannerItemsFromOrigin, upsertPlannerItemFromCalendarEvent } from '@/lib/planner-persistence'
import { getPlannerWritableSource } from '@/lib/planner-origin'
import { prisma } from '@/lib/prisma'

function isPlannerSourceType(value: string): value is PlannerSourceType {
  return value === 'gtdTask' || value === 'routineTask' || value === 'projectTask' || value === 'assignment'
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const [events, plannerItems] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.plannerItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  let syncedEvents = 0
  let syncedOrigins = 0
  let removedOrphans = 0

  const eventIds = new Set(events.map((event) => event.id))

  for (const plannerItem of plannerItems) {
    if (plannerItem.calendarEventId && !eventIds.has(plannerItem.calendarEventId)) {
      await prisma.plannerItem.delete({ where: { id: plannerItem.id } })
      removedOrphans++
    }
  }

  for (const event of events) {
    const parsed = parsePlannerEventDescription(event.description)
    const linkedSource =
      parsed.metadata?.scheduleMode === 'linked' && parsed.metadata.sourceType && parsed.metadata.sourceId
        ? await getPlannerWritableSource(parsed.metadata.sourceType, parsed.metadata.sourceId, userId)
        : null

    await upsertPlannerItemFromCalendarEvent({
      userId,
      event,
      metadata: parsed.metadata,
      linkedSource,
      description: parsed.description,
    })

    syncedEvents++
  }

  const originPlannerItems = await prisma.plannerItem.findMany({
    where: {
      userId,
      originType: { not: null },
      originId: { not: null },
    },
    select: {
      id: true,
      originType: true,
      originId: true,
    },
  })

  const seenOrigins = new Set<string>()

  for (const item of originPlannerItems) {
    if (!item.originType || !item.originId) continue
    if (!isPlannerSourceType(item.originType)) continue

    const key = `${item.originType}:${item.originId}`
    if (seenOrigins.has(key)) continue
    seenOrigins.add(key)

    const source = await getPlannerWritableSource(item.originType, item.originId, userId)

    if (!source) {
      const linkedItems = await prisma.plannerItem.findMany({
        where: {
          userId,
          originType: item.originType,
          originId: item.originId,
        },
        select: {
          calendarEventId: true,
        },
      })

      for (const linkedItem of linkedItems) {
        if (linkedItem.calendarEventId) {
          await deletePlannerItemForCalendarEvent(linkedItem.calendarEventId, userId)
        }
      }

      continue
    }

    await syncPlannerItemsFromOrigin({
      userId,
      source,
    })

    syncedOrigins++
  }

  return NextResponse.json({
    syncedEvents,
    syncedOrigins,
    removedOrphans,
  })
}
