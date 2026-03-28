import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { TaskStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const status = parseEnumValue(TaskStatus, searchParams.get('status'))

    const tasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        ...(status
          ? { status }
          : { status: { in: ['PENDING', 'IN_PROGRESS'] } }),
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    })

    return NextResponse.json(tasks)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar tarefas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const task = await prisma.task.create({
      data: {
        userId: session.user.id,
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isRecurring: data.isRecurring || false,
        recurringFrequency: data.recurringFrequency,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar tarefa' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const task = await prisma.task.update({
      where: { id: data.id, userId: session.user.id },
      data: {
        title: data.title,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar tarefa' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.task.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar tarefa' }, { status: 500 })
  }
}
