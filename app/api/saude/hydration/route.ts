import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const log = await prisma.hydrationLog.findFirst({
    where: { userId: session.user.id, date: { gte: today } },
  })
  return NextResponse.json(log)
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    await prisma.hydrationLog.deleteMany({
      where: { userId: session.user.id, date: { gte: today } },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao resetar hidratação' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existing = await prisma.hydrationLog.findFirst({
      where: { userId: session.user.id, date: { gte: today } },
    })

    if (existing) {
      const updated = await prisma.hydrationLog.update({
        where: { id: existing.id },
        data: {
          mlTotal: data.mlTotal !== undefined ? data.mlTotal : existing.mlTotal + (data.addMl ?? 0),
          goalMl: data.goalMl ?? existing.goalMl,
        },
      })
      return NextResponse.json(updated)
    }

    const log = await prisma.hydrationLog.create({
      data: {
        userId: session.user.id,
        date: today,
        mlTotal: data.mlTotal ?? data.addMl ?? 0,
        goalMl: data.goalMl ?? 2000,
      },
    })
    return NextResponse.json(log, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao registrar hidratação' }, { status: 500 })
  }
}
