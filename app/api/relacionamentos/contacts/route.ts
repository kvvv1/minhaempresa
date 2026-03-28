import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const needsFollowup = searchParams.get('needsFollowup')
  const search = searchParams.get('search')
  const relationship = searchParams.get('relationship')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '30'))
  const skip = (page - 1) * limit

  const now = new Date()

  const where = {
    userId: session.user.id,
    ...(search && { name: { contains: search } }),
    ...(relationship && { relationship }),
    ...(needsFollowup === 'true' && {
      OR: [
        { lastContact: null },
        { lastContact: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      ],
    }),
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        interactions: { orderBy: { date: 'desc' }, take: 3 },
        commitments: { where: { status: 'PENDING' }, take: 5 },
      },
      orderBy: { name: 'asc' },
      take: limit,
      skip,
    }),
    prisma.contact.count({ where }),
  ])

  if (!searchParams.get('page')) return NextResponse.json(contacts)
  return NextResponse.json({ data: contacts, total, page, limit, hasMore: skip + contacts.length < total })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const contact = await prisma.contact.create({
      data: {
        userId: session.user.id,
        name: data.name,
        relationship: data.relationship,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        followUpDays: data.followUpDays || 30,
      },
      include: { interactions: true, commitments: true },
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar contato' }, { status: 500 })
  }
}
