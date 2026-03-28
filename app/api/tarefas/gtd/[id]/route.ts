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

    const task = await prisma.gtdTask.update({
      where: { id, userId: session.user.id },
      data: {
        title: data.title,
        description: data.description,
        bucket: data.bucket,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        context: data.context,
        energy: data.energy,
        estimatedMin: data.estimatedMin,
        projectRef: data.projectRef,
      },
    })
    return NextResponse.json(task)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar tarefa' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.gtdTask.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar tarefa' }, { status: 500 })
  }
}
