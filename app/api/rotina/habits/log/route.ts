import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { habitId, date } = await req.json()
    const logDate = new Date(date)
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId: session.user.id },
      select: { id: true },
    })
    if (!habit) {
      return NextResponse.json({ error: 'Habito nao encontrado' }, { status: 404 })
    }

    // Check if already logged today
    const existing = await prisma.habitLog.findFirst({
      where: {
        habitId,
        userId: session.user.id,
        date: { gte: startOfDay(logDate), lte: endOfDay(logDate) },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Já registrado hoje' }, { status: 409 })
    }

    const log = await prisma.habitLog.create({
      data: {
        habitId,
        userId: session.user.id,
        date: logDate,
        completed: true,
      },
    })

    // Update streak
    await prisma.habit.update({
      where: { id: habitId, userId: session.user.id },
      data: { streak: { increment: 1 } },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao registrar hábito' }, { status: 500 })
  }
}
