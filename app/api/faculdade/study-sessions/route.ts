import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const subjectId = searchParams.get('subjectId')
  const days = Number(searchParams.get('days') ?? '30')

  const since = new Date()
  since.setDate(since.getDate() - days)

  const sessions = await prisma.studySession.findMany({
    where: {
      userId: session.user.id,
      startAt: { gte: since },
      ...(subjectId ? { subjectId } : {}),
    },
    include: { subject: { select: { id: true, name: true, color: true } } },
    orderBy: { startAt: 'desc' },
  })

  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const studySession = await prisma.studySession.create({
      data: {
        userId: session.user.id,
        subjectId: data.subjectId ?? null,
        startAt: new Date(data.startAt ?? new Date()),
        notes: data.notes,
        technique: data.technique,
      },
      include: { subject: { select: { id: true, name: true, color: true } } },
    })
    return NextResponse.json(studySession, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao iniciar sessão' }, { status: 500 })
  }
}
