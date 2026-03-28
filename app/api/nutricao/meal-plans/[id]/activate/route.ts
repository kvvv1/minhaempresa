import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const userId = session.user.id

    await prisma.$transaction([
      prisma.mealPlan.updateMany({ where: { userId }, data: { isActive: false } }),
      prisma.mealPlan.update({ where: { id, userId }, data: { isActive: true } }),
    ])

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao ativar plano' }, { status: 500 })
  }
}
