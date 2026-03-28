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
    const metric = await prisma.bodyMetric.update({
      where: { id, userId: session.user.id },
      data: {
        date: data.date ? new Date(data.date) : undefined,
        weightKg: data.weightKg,
        bodyFatPct: data.bodyFatPct,
        muscleKg: data.muscleKg,
        waistCm: data.waistCm,
        hipCm: data.hipCm,
        chestCm: data.chestCm,
        armCm: data.armCm,
        thighCm: data.thighCm,
        notes: data.notes,
      },
    })
    return NextResponse.json(metric)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar medida' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    await prisma.bodyMetric.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao remover medida' }, { status: 500 })
  }
}
