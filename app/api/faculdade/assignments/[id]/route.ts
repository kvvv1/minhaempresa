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
    const assignment = await prisma.assignment.update({
      where: { id, userId: session.user.id },
      data: {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status,
        priority: data.priority,
        grade: data.grade,
      },
      include: { subject: { select: { id: true, name: true, color: true } } },
    })
    return NextResponse.json(assignment)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar trabalho' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.assignment.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar trabalho' }, { status: 500 })
  }
}
