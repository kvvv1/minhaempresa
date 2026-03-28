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
    const entry = await prisma.timeEntry.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!entry) {
      return NextResponse.json({ error: 'Entrada nao encontrada' }, { status: 404 })
    }

    if (data.endAt && !durationMin) {
      durationMin = Math.round((new Date(data.endAt).getTime() - entry.startAt.getTime()) / 60000)
    }

    const updatedEntry = await prisma.timeEntry.update({
      where: { id, userId: session.user.id },
      data: {
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        description: data.description,
        billable: data.billable,
        durationMin,
      },
    })
    return NextResponse.json(updatedEntry)
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
