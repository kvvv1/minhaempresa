import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const goals = await prisma.savingsGoal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(goals)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const goal = await prisma.savingsGoal.create({
      data: {
        userId: session.user.id,
        name: data.name,
        targetAmount: Number(data.targetAmount),
        currentAmount: Number(data.currentAmount ?? 0),
        deadline: data.deadline ? new Date(data.deadline) : null,
        notes: data.notes,
      },
    })
    return NextResponse.json(goal, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar meta' }, { status: 500 })
  }
}
