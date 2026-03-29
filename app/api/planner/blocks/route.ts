import { addMinutes, endOfDay } from 'date-fns'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { type PlannerEventMetadata, parsePlannerEventDescription, serializePlannerEventDescription } from '@/lib/planner'
import { findPlannerItemForOrigin, upsertPlannerItemFromCalendarEvent } from '@/lib/planner-persistence'
import { getPlannerWritableSource, syncPlannerSourceSchedule } from '@/lib/planner-origin'
import { prisma } from '@/lib/prisma'

function parseDateTime(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatorio`)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} invalido`)
  }

  return parsed
}

function parseOptionalDateTime(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null
  return parseDateTime(value, field)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const scheduledStart = parseDateTime(data.scheduledStart, 'scheduledStart')
    const scheduledEnd = parseOptionalDateTime(data.scheduledEnd, 'scheduledEnd')
    const allDay = Boolean(data.allDay)

    let linkedSource: Awaited<ReturnType<typeof getPlannerWritableSource>> | null = null
    if (data.sourceType || data.sourceId) {
      linkedSource = await getPlannerWritableSource(data.sourceType, data.sourceId, session.user.id)

      if (!linkedSource) {
        return NextResponse.json({ error: 'Origem ainda nao suportada ou nao encontrada' }, { status: 404 })
      }
    }

    const startAt = scheduledStart
    const endAt =
      scheduledEnd ??
      (allDay ? endOfDay(startAt) : addMinutes(startAt, linkedSource?.estimatedMin ?? 60))

    if (endAt <= startAt) {
      return NextResponse.json({ error: 'scheduledEnd deve ser maior que scheduledStart' }, { status: 400 })
    }

    const metadata: PlannerEventMetadata = linkedSource
      ? {
          scheduleMode: 'linked',
          sourceId: linkedSource.id,
          sourceType: linkedSource.sourceType,
          sourceModule: linkedSource.sourceModule,
        }
      : {
          scheduleMode: 'manual',
        }

    const title = linkedSource?.title ?? (typeof data.title === 'string' ? data.title.trim() : '')
    if (!title) {
      return NextResponse.json({ error: 'title obrigatorio' }, { status: 400 })
    }

    const description =
      linkedSource
        ? linkedSource.description ?? null
        : data.description !== undefined
          ? data.description
          : null

    const serializedDescription = serializePlannerEventDescription(description, metadata)
    const calendarEventData = {
      title,
      description: serializedDescription,
      startAt,
      endAt,
      allDay,
      color:
        linkedSource?.sourceModule === 'tarefas'
          ? '#38bdf8'
          : linkedSource?.sourceModule === 'rotina'
            ? '#8b5cf6'
            : linkedSource?.sourceModule === 'trabalho'
              ? '#f97316'
              : linkedSource?.sourceModule === 'faculdade'
                ? '#10b981'
                : '#f59e0b',
      module: linkedSource?.sourceModule ?? 'calendario',
    }

    const existingPlannerItem =
      linkedSource
        ? await findPlannerItemForOrigin({
            userId: session.user.id,
            sourceType: linkedSource.sourceType,
            sourceId: linkedSource.id,
          })
        : null

    const event =
      existingPlannerItem?.calendarEventId
        ? await prisma.calendarEvent.update({
            where: {
              id: existingPlannerItem.calendarEventId,
              userId: session.user.id,
            },
            data: calendarEventData,
          })
        : await prisma.calendarEvent.create({
            data: {
              userId: session.user.id,
              ...calendarEventData,
            },
          })

    if (linkedSource) {
      await syncPlannerSourceSchedule({
        sourceType: linkedSource.sourceType,
        sourceId: linkedSource.id,
        userId: session.user.id,
        scheduledStart: startAt,
      })
    }

    const parsedDescription = parsePlannerEventDescription(event.description)

    await upsertPlannerItemFromCalendarEvent({
      userId: session.user.id,
      event,
      metadata,
      linkedSource,
      description: parsedDescription.description,
    })

    return NextResponse.json({
      ...event,
      description: parsedDescription.description,
      scheduleMode: metadata.scheduleMode,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar bloco'
    const status = message.includes('obrigatorio') || message.includes('invalido') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
