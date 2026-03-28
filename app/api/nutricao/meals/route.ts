import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')

  let dateFilter = {}
  if (dateParam) {
    const start = new Date(dateParam)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    dateFilter = { date: { gte: start, lt: end } }
  }

  const meals = await prisma.meal.findMany({
    where: { userId: session.user.id, ...dateFilter },
    include: { items: true },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(meals)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const meal = await prisma.meal.create({
      data: {
        userId: session.user.id,
        name: data.name,
        type: data.type,
        date: new Date(data.date ?? new Date()),
        calories: data.calories,
        proteinG: data.proteinG,
        carbsG: data.carbsG,
        fatG: data.fatG,
        notes: data.notes,
        mealPlanId: data.mealPlanId ?? null,
        items: data.items?.length
          ? { create: data.items.map((i: any) => ({ name: i.name, quantityG: i.quantityG, calories: i.calories, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG })) }
          : undefined,
      },
      include: { items: true },
    })
    return NextResponse.json(meal, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar refeição' }, { status: 500 })
  }
}
