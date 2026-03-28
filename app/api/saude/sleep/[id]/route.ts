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
    const bedtime = data.bedtimeAt ? new Date(data.bedtimeAt) : undefined
    const wake = data.wakeAt ? new Date(data.wakeAt) : undefined
    const durationMin = bedtime && wake
      ? Math.round((wake.getTime() - bedtime.getTime()) / 60000)
      : undefined

    const log = await prisma.sleepLog.update({
      where: { id, userId: session.user.id },
      data: {
        date: data.date ? new Date(data.date) : undefined,
        bedtimeAt: bedtime,
        wakeAt: wake,
        durationMin,
        quality: data.quality,
        notes: data.notes,
      },
    })
    return NextResponse.json(log)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar sono' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    await prisma.sleepLog.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao remover registro de sono' }, { status: 500 })
  }
}
