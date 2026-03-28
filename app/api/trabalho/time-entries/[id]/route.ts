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

    let durationMin = data.durationMin ?? null
    if (data.endAt && !durationMin) {
      const entry = await prisma.timeEntry.findUnique({ where: { id } })
      if (entry) {
        durationMin = Math.round((new Date(data.endAt).getTime() - entry.startAt.getTime()) / 60000)
      }
    }

    const entry = await prisma.timeEntry.update({
      where: { id, userId: session.user.id },
      data: {
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        description: data.description,
        billable: data.billable,
        durationMin,
      },
    })
    return NextResponse.json(entry)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar entrada' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.timeEntry.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar entrada' }, { status: 500 })
  }
}
