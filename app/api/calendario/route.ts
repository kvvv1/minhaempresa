import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parsePlannerEventDescription } from '@/lib/planner'
import { upsertPlannerItemFromCalendarEvent } from '@/lib/planner-persistence'
import { getPlannerWritableSource } from '@/lib/planner-origin'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const events = await prisma.calendarEvent.findMany({
    where: {
      userId: session.user.id,
      ...(from && to ? { startAt: { gte: new Date(from), lte: new Date(to) } } : {}),
    },
    orderBy: { startAt: 'asc' },
  })

  return NextResponse.json(
    events.map((event) => ({
      ...event,
      description: parsePlannerEventDescription(event.description).description,
    }))
  )
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const event = await prisma.calendarEvent.create({
      data: {
        userId: session.user.id,
        title: data.title,
        description: data.description ?? null,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
        allDay: data.allDay ?? false,
        color: data.color ?? '#6366f1',
        reminderMinutes: data.reminderMinutes ? Number(data.reminderMinutes) : null,
        module: data.module ?? null,
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
    return NextResponse.json({ error: 'Erro ao criar evento' }, { status: 500 })
  }
}
