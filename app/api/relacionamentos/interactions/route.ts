import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { contactId, type, notes, date } = await req.json()

    // Verify contact belongs to user
    const contact = await prisma.contact.findUnique({
      where: { id: contactId, userId: session.user.id },
    })
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const interaction = await prisma.interaction.create({
      data: {
        contactId,
        userId: session.user.id,
        type,
        notes,
        date: date ? new Date(date) : new Date(),
      },
    })

    // Update lastContact on the contact
    await prisma.contact.update({
      where: { id: contactId, userId: session.user.id },
      data: { lastContact: new Date() },
    })

    return NextResponse.json(interaction, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao registrar interação' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId')

  const interactions = await prisma.interaction.findMany({
    where: {
      userId: session.user.id,
      ...(contactId && { contactId }),
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(interactions)
}
