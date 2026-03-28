import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { KanbanStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const status = parseEnumValue(KanbanStatus, searchParams.get('status'))

  const tasks = await prisma.projectTask.findMany({
    where: {
      userId: session.user.id,
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
    },
    include: { project: { select: { id: true, name: true, color: true } } },
    orderBy: [{ status: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const task = await prisma.projectTask.create({
      data: {
        userId: session.user.id,
        projectId: data.projectId ?? null,
        title: data.title,
        description: data.description,
        status: data.status ?? 'BACKLOG',
        priority: data.priority ?? 'MEDIUM',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        estimatedMin: data.estimatedMin,
      },
      include: { project: { select: { id: true, name: true, color: true } } },
    })
    return NextResponse.json(task, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar tarefa' }, { status: 500 })
  }
}
