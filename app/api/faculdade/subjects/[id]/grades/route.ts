import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const { id: subjectId } = await params
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, userId: session.user.id },
      select: { id: true },
    })
    if (!subject) {
      return NextResponse.json({ error: 'Disciplina nao encontrada' }, { status: 404 })
    }

    const grade = await prisma.subjectGrade.create({
      data: {
        subjectId,
        name: data.name,
        grade: Number(data.grade),
        weight: Number(data.weight ?? 1),
        date: data.date ? new Date(data.date) : null,
        notes: data.notes,
      },
    })

    // Recalculate weighted average
    const allGrades = await prisma.subjectGrade.findMany({ where: { subjectId } })
    const totalWeight = allGrades.reduce((s, g) => s + g.weight, 0)
    const weightedSum = allGrades.reduce((s, g) => s + g.grade * g.weight, 0)
    const currentGrade = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null

    await prisma.subject.update({
      where: { id: subjectId, userId: session.user.id },
      data: { currentGrade },
    })

    return NextResponse.json(grade, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao registrar nota' }, { status: 500 })
  }
}
