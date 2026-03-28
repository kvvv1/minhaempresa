import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseStoredArray, stringifyStoredArray } from '@/lib/storage'

function serializeHabit<T extends { targetDays: unknown }>(habit: T) {
  return {
    ...habit,
    targetDays: parseStoredArray<number>(habit.targetDays),
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      logs: {
        orderBy: { date: 'desc' },
        take: 30,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(habits.map(serializeHabit))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const habit = await prisma.habit.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description,
        frequency: data.frequency,
        targetDays: stringifyStoredArray(data.targetDays),
      },
    })

    return NextResponse.json(serializeHabit(habit), { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar habito' }, { status: 500 })
  }
}
