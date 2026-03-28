import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { CourseStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = parseEnumValue(CourseStatus, searchParams.get('status'))

  const courses = await prisma.course.findMany({
    where: {
      userId: session.user.id,
      ...(status && { status }),
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(courses)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const course = await prisma.course.create({
      data: {
        userId: session.user.id,
        title: data.title,
        platform: data.platform,
        status: data.status || 'NOT_STARTED',
        progress: data.progress || 0,
        notes: data.notes,
      },
    })

    return NextResponse.json(course, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar curso' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const existing = await prisma.course.findUnique({ where: { id: data.id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const course = await prisma.course.update({
      where: { id: data.id, userId: session.user.id },
      data: {
        title: data.title ?? existing.title,
        platform: data.platform ?? existing.platform,
        status: data.status ?? existing.status,
        progress: data.progress ?? existing.progress,
        notes: data.notes ?? existing.notes,
        startedAt:
          data.status === 'IN_PROGRESS' && !existing.startedAt
            ? new Date()
            : data.startedAt
            ? new Date(data.startedAt)
            : undefined,
        completedAt:
          data.status === 'COMPLETED' && !existing.completedAt ? new Date() : undefined,
      },
    })

    return NextResponse.json(course)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar curso' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.course.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar curso' }, { status: 500 })
  }
}
