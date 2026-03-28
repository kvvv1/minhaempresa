import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subjects = await prisma.subject.findMany({
    where: { userId: session.user.id },
    include: {
      grades: true,
      assignments: {
        where: { status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(subjects)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const subject = await prisma.subject.create({
      data: {
        userId: session.user.id,
        name: data.name,
        professor: data.professor,
        credits: data.credits,
        semester: data.semester,
        targetGrade: data.targetGrade,
        color: data.color,
        schedule: JSON.stringify(data.schedule ?? []),
      },
      include: { grades: true, assignments: true },
    })
    return NextResponse.json(subject, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar disciplina' }, { status: 500 })
  }
}
