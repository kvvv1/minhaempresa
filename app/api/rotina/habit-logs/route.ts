import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { habitId, date, completed, note } = await req.json()
    const logDate = date ? new Date(date) : new Date()

    // Check if log already exists for that day
    const existing = await prisma.habitLog.findFirst({
      where: {
        habitId,
        userId: session.user.id,
        date: { gte: startOfDay(logDate), lte: endOfDay(logDate) },
      },
    })

    if (existing) {
      const updated = await prisma.habitLog.update({
        where: { id: existing.id },
        data: { completed: completed ?? !existing.completed, note },
      })
      return NextResponse.json(updated)
    }

    const log = await prisma.habitLog.create({
      data: {
        habitId,
        userId: session.user.id,
        date: logDate,
        completed: completed ?? true,
        note,
      },
    })

    // Recalculate streak
    const recentLogs = await prisma.habitLog.findMany({
      where: { habitId, userId: session.user.id, completed: true },
      orderBy: { date: 'desc' },
      take: 100,
    })

    let streak = 0
    const today = startOfDay(new Date())
    for (let i = 0; i < recentLogs.length; i++) {
      const logDay = startOfDay(new Date(recentLogs[i].date))
      const diff = Math.floor((today.getTime() - logDay.getTime()) / (1000 * 60 * 60 * 24))
      if (diff === i || (i === 0 && diff === 0)) {
        streak++
      } else {
        break
      }
    }

    const habit = await prisma.habit.findUnique({ where: { id: habitId } })
    await prisma.habit.update({
      where: { id: habitId },
      data: {
        streak,
        bestStreak: Math.max(streak, habit?.bestStreak || 0),
      },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao registrar hábito' }, { status: 500 })
  }
}
