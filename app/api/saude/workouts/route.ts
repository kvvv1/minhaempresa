import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period')

  const dateFilter: Record<string, Date> = {}
  if (period === 'month') {
    const d = new Date()
    d.setDate(1); d.setHours(0, 0, 0, 0)
    dateFilter.gte = d
  } else if (period === 'week') {
    const d = new Date()
    d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0)
    dateFilter.gte = d
  }

  const workouts = await prisma.workout.findMany({
    where: { userId: session.user.id, ...(dateFilter.gte ? { date: dateFilter } : {}) },
    include: { exercises: { orderBy: { order: 'asc' } } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(
    workouts.map((w) => ({
      ...w,
      exercises: w.exercises.map((e) => ({ ...e, sets: JSON.parse(e.sets) })),
    }))
  )
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const workout = await prisma.workout.create({
      data: {
        userId: session.user.id,
        name: data.name,
        date: new Date(data.date),
        durationMin: data.durationMin,
        notes: data.notes,
        exercises: {
          create: (data.exercises ?? []).map((e: any, i: number) => ({
            name: e.name,
            sets: JSON.stringify(e.sets ?? []),
            order: i,
          })),
        },
      },
      include: { exercises: { orderBy: { order: 'asc' } } },
    })
    return NextResponse.json(
      { ...workout, exercises: workout.exercises.map((e) => ({ ...e, sets: JSON.parse(e.sets) })) },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: 'Erro ao criar treino' }, { status: 500 })
  }
}
