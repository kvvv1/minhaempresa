import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conversations = await prisma.savedConversation.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    conversations.map((c) => ({
      ...c,
      messages: JSON.parse(c.messages),
      tags: JSON.parse(c.tags),
    }))
  )
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const conversation = await prisma.savedConversation.create({
      data: {
        userId: session.user.id,
        employeeName: data.employeeName,
        employeeRole: data.employeeRole,
        title: data.title,
        messages: JSON.stringify(data.messages ?? []),
        tags: JSON.stringify(data.tags ?? []),
      },
    })
    return NextResponse.json({ ...conversation, messages: data.messages, tags: data.tags ?? [] })
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar conversa' }, { status: 500 })
  }
}
