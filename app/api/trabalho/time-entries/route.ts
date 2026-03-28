import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectTaskId = searchParams.get('projectTaskId')

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId: session.user.id,
      ...(projectTaskId ? { projectTaskId } : {}),
      startAt: { gte: weekStart },
    },
    include: { projectTask: { select: { id: true, title: true, project: { select: { id: true, name: true, color: true } } } } },
    orderBy: { startAt: 'desc' },
  })

  return NextResponse.json(entries)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const entry = await prisma.timeEntry.create({
      data: {
        userId: session.user.id,
        projectTaskId: data.projectTaskId ?? null,
        description: data.description,
        startAt: new Date(data.startAt ?? new Date()),
        endAt: data.endAt ? new Date(data.endAt) : null,
        durationMin: data.durationMin ?? null,
        billable: data.billable ?? false,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar entrada de tempo' }, { status: 500 })
  }
}
