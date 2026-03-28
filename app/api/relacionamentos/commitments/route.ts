import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { CommitmentStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId')
  const status = parseEnumValue(CommitmentStatus, searchParams.get('status'))

  const commitments = await prisma.commitment.findMany({
    where: {
      userId: session.user.id,
      ...(contactId && { contactId }),
      ...(status && { status }),
    },
    include: { contact: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(commitments)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { contactId, description, dueDate } = await req.json()

    // Verify contact belongs to user
    const contact = await prisma.contact.findUnique({
      where: { id: contactId, userId: session.user.id },
    })
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const commitment = await prisma.commitment.create({
      data: {
        contactId,
        userId: session.user.id,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    })

    return NextResponse.json(commitment, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar compromisso' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, status } = await req.json()

    const commitment = await prisma.commitment.update({
      where: { id, userId: session.user.id },
      data: { status },
    })

    return NextResponse.json(commitment)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar compromisso' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.commitment.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar compromisso' }, { status: 500 })
  }
}
