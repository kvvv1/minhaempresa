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
    const workout = await prisma.workout.update({
      where: { id, userId: session.user.id },
      data: {
        name: data.name,
        date: data.date ? new Date(data.date) : undefined,
        durationMin: data.durationMin,
        notes: data.notes,
      },
    })
    return NextResponse.json(workout)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar treino' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.workout.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar treino' }, { status: 500 })
  }
}
