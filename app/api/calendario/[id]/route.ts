import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parsePlannerEventDescription } from '@/lib/planner'
import { deletePlannerItemForCalendarEvent, upsertPlannerItemFromCalendarEvent } from '@/lib/planner-persistence'
import { getPlannerWritableSource } from '@/lib/planner-origin'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const data = await req.json()
    const event = await prisma.calendarEvent.update({
      where: { id, userId: session.user.id },
      data: {
        title: data.title,
        description: data.description !== undefined ? data.description : undefined,
        startAt: data.startAt ? new Date(data.startAt) : undefined,
        endAt: data.endAt !== undefined ? (data.endAt ? new Date(data.endAt) : null) : undefined,
        allDay: data.allDay !== undefined ? data.allDay : undefined,
        color: data.color,
        reminderMinutes: data.reminderMinutes !== undefined ? (data.reminderMinutes ? Number(data.reminderMinutes) : null) : undefined,
        module: data.module !== undefined ? data.module : undefined,
      },
    })

    const parsedDescription = parsePlannerEventDescription(event.description)
    const linkedSource =
      parsedDescription.metadata?.scheduleMode === 'linked' && parsedDescription.metadata.sourceType && parsedDescription.metadata.sourceId
        ? await getPlannerWritableSource(parsedDescription.metadata.sourceType, parsedDescription.metadata.sourceId, session.user.id)
        : null

    await upsertPlannerItemFromCalendarEvent({
      userId: session.user.id,
      event,
      metadata: parsedDescription.metadata,
      linkedSource,
      description: parsedDescription.description,
    })

    return NextResponse.json({
      ...event,
      description: parsedDescription.description,
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar evento' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    await deletePlannerItemForCalendarEvent(id, session.user.id)
    await prisma.calendarEvent.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao remover evento' }, { status: 500 })
  }
}
