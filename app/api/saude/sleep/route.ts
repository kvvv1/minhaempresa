import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Number(searchParams.get('days') ?? '14')

  const since = new Date()
  since.setDate(since.getDate() - days)

  const logs = await prisma.sleepLog.findMany({
    where: { userId: session.user.id, date: { gte: since } },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(logs)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const bedtime = new Date(data.bedtimeAt)
    const wake = new Date(data.wakeAt)
    const durationMin = Math.round((wake.getTime() - bedtime.getTime()) / 60000)

    const log = await prisma.sleepLog.create({
      data: {
        userId: session.user.id,
        date: new Date(data.date ?? bedtime),
        bedtimeAt: bedtime,
        wakeAt: wake,
        durationMin,
        quality: data.quality,
        notes: data.notes,
      },
    })
    return NextResponse.json(log, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao registrar sono' }, { status: 500 })
  }
}
