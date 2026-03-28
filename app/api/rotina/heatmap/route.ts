import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date()
  since.setFullYear(since.getFullYear() - 1)
  since.setHours(0, 0, 0, 0)

  const logs = await prisma.habitLog.findMany({
    where: { userId: session.user.id, date: { gte: since }, completed: true },
    select: { date: true },
  })

  // Count completions per day
  const countByDay: Record<string, number> = {}
  for (const log of logs) {
    const key = new Date(log.date).toISOString().slice(0, 10)
    countByDay[key] = (countByDay[key] ?? 0) + 1
  }

  return NextResponse.json(countByDay)
}
