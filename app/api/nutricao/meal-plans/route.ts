import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plans = await prisma.mealPlan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(plans)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const plan = await prisma.mealPlan.create({
      data: {
        userId: session.user.id,
        name: data.name,
        weekStart: new Date(data.weekStart),
        targetCalories: data.targetCalories,
        targetProteinG: data.targetProteinG,
        targetCarbsG: data.targetCarbsG,
        targetFatG: data.targetFatG,
        notes: data.notes,
      },
    })
    return NextResponse.json(plan, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar plano' }, { status: 500 })
  }
}
