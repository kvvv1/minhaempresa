import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseStoredArray } from '@/lib/storage'

type HabitRouteContext = {
  params: Promise<{ id: string }>
}

function serializeHabit<T extends { targetDays: unknown }>(habit: T) {
  return {
    ...habit,
    targetDays: parseStoredArray<number>(habit.targetDays),
  }
}

export async function PUT(req: Request, { params }: HabitRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const { id } = await params

    const habit = await prisma.habit.update({
      where: { id, userId: session.user.id },
      data: { name: data.name, description: data.description, isActive: data.isActive },
      include: { logs: { take: 30, orderBy: { date: 'desc' } } },
    })

    return NextResponse.json(serializeHabit(habit))
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar habito' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: HabitRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    await prisma.habit.update({
      where: { id, userId: session.user.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar habito' }, { status: 500 })
  }
}
