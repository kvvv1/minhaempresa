import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateDailyBriefing } from '@/lib/claude'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userId = session.user.id
    const today = new Date()

    const threeDaysFromNow = new Date(today)
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const [user, chiefOfStaff, transactions, habits, habitLogs, tasks, contacts, goals,
           gtdTasksToday, urgentAssignments, inProgressTasks, lastWorkout, todayHydration] =
      await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.employee.findFirst({ where: { userId, role: 'CHIEF_OF_STAFF', isActive: true } }),
        prisma.transaction.findMany({
          where: { userId, date: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } },
          orderBy: { date: 'desc' }, take: 20,
        }),
        prisma.habit.findMany({ where: { userId, isActive: true } }),
        prisma.habitLog.findMany({ where: { userId, date: { gte: startOfDay(today), lte: endOfDay(today) } } }),
        prisma.task.findMany({ where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] } }, orderBy: { dueDate: 'asc' }, take: 10 }),
        prisma.contact.findMany({
          where: { userId, OR: [{ lastContact: null }, { lastContact: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }] },
          take: 5,
        }),
        prisma.goal.findMany({ where: { userId, status: 'ACTIVE' }, include: { keyResults: true }, take: 5 }),
        prisma.gtdTask.findMany({ where: { userId, bucket: 'TODAY', status: { in: ['PENDING', 'IN_PROGRESS'] } }, take: 5 }),
        prisma.assignment.findMany({ where: { userId, status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] }, dueDate: { lte: threeDaysFromNow } }, include: { subject: { select: { name: true } } }, orderBy: { dueDate: 'asc' }, take: 5 }),
        prisma.projectTask.findMany({ where: { userId, status: 'IN_PROGRESS' }, include: { project: { select: { name: true } } }, take: 5 }),
        prisma.workout.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
        prisma.hydrationLog.findFirst({ where: { userId, date: { gte: startOfDay(today) } } }),
      ])

    if (!chiefOfStaff) {
      return NextResponse.json({ briefing: 'Configure seu Chief of Staff no onboarding.' })
    }

    const allData = {
      user: { name: user?.name, companyName: user?.companyName, mission: user?.mission },
      financeiro: { transactions },
      rotina: { habits, todayLogs: habitLogs, tasks },
      relacionamentos: { contactsNeedingAttention: contacts },
      metas: { goals },
      tarefas: { urgentToday: gtdTasksToday },
      faculdade: { urgentAssignments },
      trabalho: { inProgressTasks },
      saude: {
        lastWorkoutDaysAgo: lastWorkout ? Math.floor((Date.now() - new Date(lastWorkout.date).getTime()) / 86400000) : null,
        todayHydrationPct: todayHydration ? Math.round((todayHydration.mlTotal / todayHydration.goalMl) * 100) : 0,
      },
    }

    const briefing = await generateDailyBriefing(
      { name: chiefOfStaff.name, role: 'CHIEF_OF_STAFF', personality: chiefOfStaff.personality },
      allData
    )

    return NextResponse.json({ briefing })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao gerar briefing' }, { status: 500 })
  }
}
