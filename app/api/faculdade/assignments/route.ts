import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { AssignmentStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = parseEnumValue(AssignmentStatus, searchParams.get('status'))
  const subjectId = searchParams.get('subjectId')

  const assignments = await prisma.assignment.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status } : {}),
      ...(subjectId ? { subjectId } : {}),
    },
    include: { subject: { select: { id: true, name: true, color: true } } },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(assignments)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const assignment = await prisma.assignment.create({
      data: {
        userId: session.user.id,
        subjectId: data.subjectId ?? null,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status ?? 'PENDING',
        priority: data.priority ?? 'MEDIUM',
      },
      include: { subject: { select: { id: true, name: true, color: true } } },
    })
    return NextResponse.json(assignment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar trabalho' }, { status: 500 })
  }
}
