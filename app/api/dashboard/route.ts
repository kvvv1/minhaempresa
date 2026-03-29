import { endOfDay, startOfDay, startOfMonth, subDays } from 'date-fns'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDailyBriefing } from '@/lib/briefing'
import type { DashboardPayload } from '@/lib/dashboard'
import { prisma } from '@/lib/prisma'
import { GET as getPlanner } from '@/app/api/planner/route'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userId = session.user.id
    const today = new Date()
    const todayStart = startOfDay(today)
    const threeDaysFromNow = endOfDay(subDays(today, -3))
    const monthStart = startOfMonth(today)
    const [
      _user,
      chiefOfStaff,
      latestValuation,
      transactions,
      habitList,
      activeHabits,
      activeGoals,
      pendingFollowups,
      lastWorkout,
      todayHydration,
      pendingAssignments,
      activeSubjects,
      activeProjects,
      overdueTasksCount,
      bucketCounts,
      todayTasks,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      prisma.employee.findFirst({
        where: { userId, role: 'CHIEF_OF_STAFF', isActive: true },
        select: { name: true, personality: true },
      }),
      prisma.companyValuation.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: monthStart } },
        select: { type: true, amount: true },
      }),
      prisma.habit.findMany({
        where: { userId, isActive: true },
        select: { id: true, name: true, streak: true, frequency: true },
      }),
      prisma.habit.count({ where: { userId, isActive: true } }),
      prisma.goal.count({ where: { userId, status: 'ACTIVE' } }),
      prisma.contact.count({
        where: {
          userId,
          OR: [{ lastContact: null }, { lastContact: { lt: subDays(today, 30) } }],
        },
      }),
      prisma.workout.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      prisma.hydrationLog.findFirst({
        where: { userId, date: { gte: todayStart } },
        select: { mlTotal: true, goalMl: true },
      }),
      prisma.assignment.count({
        where: { userId, status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } },
      }),
      prisma.subject.findMany({
        where: { userId, status: 'IN_PROGRESS' },
        select: { currentGrade: true },
      }),
      prisma.project.count({ where: { userId, status: 'ACTIVE' } }),
      prisma.projectTask.count({
        where: { userId, status: { not: 'DONE' }, dueDate: { lt: today } },
      }),
      prisma.gtdTask.groupBy({
        by: ['bucket'],
        where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        _count: { _all: true },
      }),
      prisma.gtdTask.count({
        where: {
          userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          OR: [{ bucket: 'TODAY' }, { dueDate: { gte: todayStart, lt: endOfDay(today) } }],
        },
      }),
    ])

    const income = transactions
      .filter((transaction) => transaction.type === 'INCOME')
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    const expense = transactions
      .filter((transaction) => transaction.type === 'EXPENSE')
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    const avgGradeValues = activeSubjects
      .map((subject) => subject.currentGrade)
      .filter((grade): grade is number => grade !== null)
    const avgGrade = avgGradeValues.length
      ? Math.round((avgGradeValues.reduce((sum, grade) => sum + grade, 0) / avgGradeValues.length) * 10) / 10
      : null

    const briefingResult = await getDailyBriefing(userId)

    const plannerRequest = new Request(new URL('/api/planner?scope=today', req.url), {
      headers: req.headers,
    })
    const plannerResponse = await getPlanner(plannerRequest)
    if (!plannerResponse.ok) {
      return NextResponse.json({ error: 'Erro ao carregar planner do dashboard' }, { status: plannerResponse.status })
    }

    const plannerToday = await plannerResponse.json()
    const payload: DashboardPayload = {
      briefing: briefingResult.briefing,
      briefingMeta: {
        updatedAt: briefingResult.updatedAt,
        cached: briefingResult.cached,
        source: briefingResult.source,
        frozen: briefingResult.frozen,
        collapsed: briefingResult.collapsed,
      },
      chiefOfStaff: chiefOfStaff ? { name: chiefOfStaff.name } : null,
      valuation: latestValuation
        ? {
            id: latestValuation.id,
            value: latestValuation.value,
            scores: latestValuation.scores as Record<string, number>,
            date: latestValuation.date.toISOString(),
            insights: [],
          }
        : null,
      stats: {
        monthlyBalance: income - expense,
        activeHabits,
        activeGoals,
        pendingFollowups,
        lastWorkoutDaysAgo: lastWorkout ? Math.floor((Date.now() - new Date(lastWorkout.date).getTime()) / 86400000) : null,
        todayHydrationPct: todayHydration ? Math.round((todayHydration.mlTotal / todayHydration.goalMl) * 100) : 0,
        pendingAssignments,
        avgGrade,
        activeProjects,
        overdueTasksCount,
        inboxCount: Number(bucketCounts.find((item) => item.bucket === 'INBOX')?._count._all ?? 0),
        todayTasksCount: todayTasks,
      },
      plannerToday,
    }

    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 })
  }
}
