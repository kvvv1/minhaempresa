import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type GoalRouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(req: Request, { params }: GoalRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const { id } = await params

    const goal = await prisma.goal.update({
      where: { id, userId: session.user.id },
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        progress: data.progress,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      },
      include: { keyResults: true },
    })

    return NextResponse.json(goal)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar meta' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: GoalRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.goal.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar meta' }, { status: 500 })
  }
}
