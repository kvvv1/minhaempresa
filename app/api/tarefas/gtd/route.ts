import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GtdBucket, TaskPriority } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const bucket = parseEnumValue(GtdBucket, searchParams.get('bucket'))
  const showCompleted = searchParams.get('completed') === 'true'

  const tasks = await prisma.gtdTask.findMany({
    where: {
      userId: session.user.id,
      ...(bucket ? { bucket } : {}),
      ...(!showCompleted ? { status: { in: ['PENDING', 'IN_PROGRESS'] } } : {}),
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const task = await prisma.gtdTask.create({
      data: {
        userId: session.user.id,
        title: data.title,
        description: data.description,
        bucket: data.bucket ?? 'INBOX',
        priority: data.priority ?? 'MEDIUM',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        context: data.context,
        energy: data.energy,
        estimatedMin: data.estimatedMin,
        projectRef: data.projectRef,
      },
    })
    return NextResponse.json(task, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar tarefa' }, { status: 500 })
  }
}
