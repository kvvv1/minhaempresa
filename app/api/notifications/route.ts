import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(notifications)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json()

  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId: session.user.id },
    data: { read: true },
  })

  return NextResponse.json({ success: true })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const notification = await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: data.title,
        message: data.message,
        type: data.type ?? 'INFO',
        module: data.module ?? null,
        actionUrl: data.actionUrl ?? null,
      },
    })
    return NextResponse.json(notification)
  } catch {
    return NextResponse.json({ error: 'Erro ao criar notificação' }, { status: 500 })
  }
}
