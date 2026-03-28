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
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [counts, todayTasks] = await Promise.all([
    prisma.gtdTask.groupBy({
      by: ['bucket'],
      where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      _count: { _all: true },
    }),
    prisma.gtdTask.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        OR: [
          { bucket: 'TODAY' },
          { dueDate: { gte: today, lt: tomorrow } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    }),
  ])

  const bucketCounts = Object.fromEntries(counts.map((c) => [c.bucket, c._count._all]))

  return NextResponse.json({ bucketCounts, todayTasks })
}
