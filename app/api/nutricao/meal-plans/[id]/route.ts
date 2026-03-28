import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const { id } = await params
    const plan = await prisma.mealPlan.update({
      where: { id, userId: session.user.id },
      data: { name: data.name, targetCalories: data.targetCalories, targetProteinG: data.targetProteinG, targetCarbsG: data.targetCarbsG, targetFatG: data.targetFatG, notes: data.notes },
    })
    return NextResponse.json(plan)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.mealPlan.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar plano' }, { status: 500 })
  }
}
