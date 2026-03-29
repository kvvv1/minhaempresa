import { addMinutes, endOfDay } from 'date-fns'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parsePlannerEventDescription, serializePlannerEventDescription } from '@/lib/planner'
import { deletePlannerItemForCalendarEvent, upsertPlannerItemFromCalendarEvent } from '@/lib/planner-persistence'
import { getPlannerWritableSource, syncPlannerSourceSchedule } from '@/lib/planner-origin'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

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

export async function PUT(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Bloco nao encontrado' }, { status: 404 })
    }

    const data = await req.json()
    const parsedExisting = parsePlannerEventDescription(existingEvent.description)
    const scheduledStart = parseDateTime(data.scheduledStart, 'scheduledStart')
    const scheduledEnd = parseOptionalDateTime(data.scheduledEnd, 'scheduledEnd')
    const allDay = Boolean(data.allDay)

    const linkedSource =
      parsedExisting.metadata?.scheduleMode === 'linked' && parsedExisting.metadata.sourceType && parsedExisting.metadata.sourceId
        ? await getPlannerWritableSource(parsedExisting.metadata.sourceType, parsedExisting.metadata.sourceId, session.user.id)
        : null

    if (parsedExisting.metadata?.scheduleMode === 'linked' && parsedExisting.metadata.sourceType && parsedExisting.metadata.sourceId && !linkedSource) {
      return NextResponse.json({ error: 'Origem vinculada nao encontrada' }, { status: 404 })
    }

    const endAt =
      scheduledEnd ??
      (allDay ? endOfDay(scheduledStart) : addMinutes(scheduledStart, linkedSource?.estimatedMin ?? 60))

    if (endAt <= scheduledStart) {
      return NextResponse.json({ error: 'scheduledEnd deve ser maior que scheduledStart' }, { status: 400 })
    }

    const title =
      linkedSource?.title ??
      (typeof data.title === 'string' ? data.title.trim() : existingEvent.title)

    if (!title) {
      return NextResponse.json({ error: 'title obrigatorio' }, { status: 400 })
    }

    const nextDescription =
      linkedSource
        ? linkedSource.description ?? parsedExisting.description
        : data.description !== undefined
          ? data.description
          : parsedExisting.description

    const event = await prisma.calendarEvent.update({
      where: { id, userId: session.user.id },
      data: {
        title,
        description: serializePlannerEventDescription(nextDescription, parsedExisting.metadata),
        startAt: scheduledStart,
        endAt,
        allDay,
        module: linkedSource?.sourceModule ?? (data.module ?? existingEvent.module),
      },
    })

    if (linkedSource) {
      await syncPlannerSourceSchedule({
        sourceType: linkedSource.sourceType,
        sourceId: linkedSource.id,
        userId: session.user.id,
        scheduledStart,
      })
    }

    await upsertPlannerItemFromCalendarEvent({
      userId: session.user.id,
      event,
      metadata: parsedExisting.metadata,
      linkedSource,
      description: parsePlannerEventDescription(event.description).description,
    })

    return NextResponse.json({
      ...event,
      description: parsePlannerEventDescription(event.description).description,
      scheduleMode: parsedExisting.metadata?.scheduleMode ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar bloco'
    const status = message.includes('obrigatorio') || message.includes('invalido') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Bloco nao encontrado' }, { status: 404 })
    }

    const parsedExisting = parsePlannerEventDescription(existingEvent.description)
    if (parsedExisting.metadata?.scheduleMode === 'linked') {
      return NextResponse.json(
        { error: 'Blocos vinculados devem ser replanejados ou concluídos pela origem.' },
        { status: 409 }
      )
    }

    await deletePlannerItemForCalendarEvent(id, session.user.id)
    await prisma.calendarEvent.delete({
      where: {
        id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao remover bloco' }, { status: 500 })
  }
}
