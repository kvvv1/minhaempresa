import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ContactRouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: ContactRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const contact = await prisma.contact.findUnique({
    where: { id, userId: session.user.id },
    include: {
      interactions: { orderBy: { date: 'desc' } },
      commitments: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  return NextResponse.json(contact)
}

export async function PUT(req: Request, { params }: ContactRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const { id } = await params

    const contact = await prisma.contact.update({
      where: { id, userId: session.user.id },
      data: {
        name: data.name,
        relationship: data.relationship,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        followUpDays: data.followUpDays,
        lastContact: data.lastContact ? new Date(data.lastContact) : undefined,
      },
      include: {
        interactions: { take: 3, orderBy: { date: 'desc' } },
        commitments: { where: { status: 'PENDING' } },
      },
    })

    return NextResponse.json(contact)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar contato' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: ContactRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.contact.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar contato' }, { status: 500 })
  }
}
