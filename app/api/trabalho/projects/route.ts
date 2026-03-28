import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ProjectStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = parseEnumValue(ProjectStatus, searchParams.get('status'))

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id, ...(status ? { status } : {}) },
    include: {
      tasks: { select: { id: true, status: true } },
      _count: { select: { meetings: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description,
        status: data.status ?? 'ACTIVE',
        priority: data.priority ?? 'MEDIUM',
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        color: data.color,
      },
      include: { tasks: { select: { id: true, status: true } } },
    })
    return NextResponse.json(project, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar projeto' }, { status: 500 })
  }
}
