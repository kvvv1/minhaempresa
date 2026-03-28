import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const skills = await prisma.skill.findMany({
    where: {
      userId: session.user.id,
      ...(category && { category }),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(skills)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const skill = await prisma.skill.create({
      data: {
        userId: session.user.id,
        name: data.name,
        category: data.category,
        level: data.level || 'BEGINNER',
        targetLevel: data.targetLevel || 'ADVANCED',
      },
    })

    return NextResponse.json(skill, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar habilidade' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const existing = await prisma.skill.findUnique({ where: { id: data.id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

    const skill = await prisma.skill.update({
      where: { id: data.id, userId: session.user.id },
      data: {
        name: data.name ?? existing.name,
        category: data.category ?? existing.category,
        level: data.level ?? existing.level,
        targetLevel: data.targetLevel ?? existing.targetLevel,
      },
    })

    return NextResponse.json(skill)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar habilidade' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.skill.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar habilidade' }, { status: 500 })
  }
}
