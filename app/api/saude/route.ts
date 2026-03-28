import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [lastWorkout, sleepLogs, todayHydration, lastMetric] = await Promise.all([
    prisma.workout.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.sleepLog.findMany({ where: { userId, date: { gte: sevenDaysAgo } }, orderBy: { date: 'desc' } }),
    prisma.hydrationLog.findFirst({ where: { userId, date: { gte: today } } }),
    prisma.bodyMetric.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
  ])

  const avgSleepMin = sleepLogs.length
    ? Math.round(sleepLogs.reduce((s, l) => s + l.durationMin, 0) / sleepLogs.length)
    : null

  const lastWorkoutDaysAgo = lastWorkout
    ? Math.floor((Date.now() - new Date(lastWorkout.date).getTime()) / 86400000)
    : null

  return NextResponse.json({
    lastWorkoutDaysAgo,
    avgSleepMin,
    todayHydrationPct: todayHydration ? Math.round((todayHydration.mlTotal / todayHydration.goalMl) * 100) : 0,
    todayHydration,
    lastMetric,
  })
}
