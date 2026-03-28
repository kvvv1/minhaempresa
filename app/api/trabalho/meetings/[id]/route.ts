import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const { id } = await params
    const meeting = await prisma.meeting.update({
      where: { id, userId: session.user.id },
      data: {
        title: data.title,
        description: data.description,
        startAt: data.startAt ? new Date(data.startAt) : undefined,
        endAt: data.endAt ? new Date(data.endAt) : null,
        location: data.location,
        attendees: data.attendees !== undefined ? JSON.stringify(data.attendees) : undefined,
        notes: data.notes,
        actionItems: data.actionItems !== undefined ? JSON.stringify(data.actionItems) : undefined,
        projectId: data.projectId,
      },
    })
    return NextResponse.json({
      ...meeting,
      attendees: JSON.parse(meeting.attendees),
      actionItems: JSON.parse(meeting.actionItems),
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar reunião' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.meeting.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar reunião' }, { status: 500 })
  }
}
