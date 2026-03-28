import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const data = await req.json()
    const goal = await prisma.savingsGoal.update({
      where: { id, userId: session.user.id },
      data: {
        name: data.name,
        targetAmount: data.targetAmount !== undefined ? Number(data.targetAmount) : undefined,
        currentAmount: data.currentAmount !== undefined ? Number(data.currentAmount) : undefined,
        deadline: data.deadline !== undefined ? (data.deadline ? new Date(data.deadline) : null) : undefined,
        notes: data.notes,
        achieved: data.achieved,
      },
    })
    return NextResponse.json(goal)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar meta' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    await prisma.savingsGoal.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao remover meta' }, { status: 500 })
  }
}
