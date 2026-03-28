import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const createKeyResultSchema = z.object({
  goalId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  target: z.coerce.number().positive().max(1_000_000).optional(),
  unit: z.string().trim().max(20).optional().nullable(),
})

const updateKeyResultSchema = z.object({
  id: z.string().min(1),
  progress: z.coerce.number().min(0).max(1_000_000),
})

const deleteKeyResultSchema = z.object({
  id: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const parsed = createKeyResultSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }

    const goal = await prisma.goal.findFirst({
      where: { id: parsed.data.goalId, userId: session.user.id },
      select: { id: true },
    })

    if (!goal) {
      return NextResponse.json({ error: 'Meta nao encontrada' }, { status: 404 })
    }

    const kr = await prisma.keyResult.create({
      data: {
        goalId: goal.id,
        title: parsed.data.title,
        target: parsed.data.target ?? 100,
        unit: parsed.data.unit || null,
      },
    })

    return NextResponse.json(kr, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar key result' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const parsed = updateKeyResultSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }

    const existing = await prisma.keyResult.findFirst({
      where: { id: parsed.data.id, goal: { userId: session.user.id } },
      select: { id: true, goalId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Key result nao encontrado' }, { status: 404 })
    }

    const kr = await prisma.keyResult.update({
      where: { id: existing.id },
      data: { progress: parsed.data.progress },
    })

    const goal = await prisma.goal.findUnique({
      where: { id: existing.goalId },
      include: { keyResults: true },
    })

    if (goal && goal.keyResults.length > 0) {
      const avgProgress =
        goal.keyResults.reduce((sum, item) => sum + item.progress, 0) / goal.keyResults.length

      await prisma.goal.update({
        where: { id: existing.goalId },
        data: { progress: avgProgress },
      })
    }

    return NextResponse.json(kr)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar key result' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const parsed = deleteKeyResultSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }

    const existing = await prisma.keyResult.findFirst({
      where: { id: parsed.data.id, goal: { userId: session.user.id } },
      select: { id: true, goalId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Key result nao encontrado' }, { status: 404 })
    }

    await prisma.keyResult.delete({ where: { id: existing.id } })

    const remaining = await prisma.keyResult.findMany({
      where: { goalId: existing.goalId },
      select: { progress: true },
    })

    await prisma.goal.update({
      where: { id: existing.goalId },
      data: {
        progress:
          remaining.length > 0
            ? remaining.reduce((sum, item) => sum + item.progress, 0) / remaining.length
            : 0,
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar key result' }, { status: 500 })
  }
}
