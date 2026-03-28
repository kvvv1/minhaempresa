import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { title } = await req.json()
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
    }

    const task = await prisma.gtdTask.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        bucket: 'INBOX',
      },
    })
    return NextResponse.json(task, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao capturar tarefa' }, { status: 500 })
  }
}
