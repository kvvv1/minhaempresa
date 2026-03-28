import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoalStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = parseEnumValue(GoalStatus, searchParams.get('status'))

  const goals = await prisma.goal.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status } : {}),
    },
    include: { keyResults: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(goals)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const goal = await prisma.goal.create({
      data: {
        userId: session.user.id,
        title: data.title,
        description: data.description,
        category: data.category,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        quarter: data.quarter,
        year: data.year,
      },
      include: { keyResults: true },
    })
    return NextResponse.json(goal, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar meta' }, { status: 500 })
  }
}
