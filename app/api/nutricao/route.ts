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

  const [todayMeals, activePlan] = await Promise.all([
    prisma.meal.findMany({
      where: { userId, date: { gte: today, lt: tomorrow } },
      include: { items: true },
    }),
    prisma.mealPlan.findFirst({ where: { userId, isActive: true } }),
  ])

  const totals = todayMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      proteinG: acc.proteinG + (m.proteinG ?? 0),
      carbsG: acc.carbsG + (m.carbsG ?? 0),
      fatG: acc.fatG + (m.fatG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  )

  return NextResponse.json({ todayTotals: totals, activePlan, mealCount: todayMeals.length })
}
