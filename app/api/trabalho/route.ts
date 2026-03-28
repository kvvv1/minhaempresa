import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const [activeProjects, tasksByStatus, overdueCount, weekHours] = await Promise.all([
    prisma.project.count({ where: { userId, status: 'ACTIVE' } }),
    prisma.projectTask.groupBy({
      by: ['status'],
      where: { userId, status: { not: 'DONE' } },
      _count: { _all: true },
    }),
    prisma.projectTask.count({
      where: { userId, status: { not: 'DONE' }, dueDate: { lt: new Date() } },
    }),
    prisma.timeEntry.aggregate({
      where: { userId, startAt: { gte: weekStart }, durationMin: { not: null } },
      _sum: { durationMin: true },
    }),
  ])

  return NextResponse.json({
    activeProjects,
    tasksByStatus: Object.fromEntries(tasksByStatus.map((t) => [t.status, t._count._all])),
    overdueCount,
    weekMinutes: weekHours._sum.durationMin ?? 0,
  })
}
