import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const metrics = await prisma.bodyMetric.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    take: 90,
  })
  return NextResponse.json(metrics)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const metric = await prisma.bodyMetric.create({
      data: {
        userId: session.user.id,
        date: new Date(data.date ?? new Date()),
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
    return NextResponse.json(metric, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao registrar medidas' }, { status: 500 })
  }
}
