import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const upcoming = searchParams.get('upcoming') === 'true'

  const meetings = await prisma.meeting.findMany({
    where: {
      userId: session.user.id,
      ...(projectId ? { projectId } : {}),
      ...(upcoming ? { startAt: { gte: new Date() } } : {}),
    },
    include: { project: { select: { id: true, name: true, color: true } } },
    orderBy: { startAt: upcoming ? 'asc' : 'desc' },
  })

  return NextResponse.json(
    meetings.map((m) => ({
      ...m,
      attendees: JSON.parse(m.attendees),
      actionItems: JSON.parse(m.actionItems),
    }))
  )
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const meeting = await prisma.meeting.create({
      data: {
        userId: session.user.id,
        projectId: data.projectId ?? null,
        title: data.title,
        description: data.description,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
        location: data.location,
        attendees: JSON.stringify(data.attendees ?? []),
        notes: data.notes,
        actionItems: JSON.stringify(data.actionItems ?? []),
      },
      include: { project: { select: { id: true, name: true, color: true } } },
    })
    return NextResponse.json(
      { ...meeting, attendees: JSON.parse(meeting.attendees), actionItems: JSON.parse(meeting.actionItems) },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: 'Erro ao criar reunião' }, { status: 500 })
  }
}
