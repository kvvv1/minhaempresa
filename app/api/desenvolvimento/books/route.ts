import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { BookStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = parseEnumValue(BookStatus, searchParams.get('status'))

  const books = await prisma.book.findMany({
    where: {
      userId: session.user.id,
      ...(status && { status }),
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(books)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const book = await prisma.book.create({
      data: {
        userId: session.user.id,
        title: data.title,
        author: data.author,
        status: data.status || 'WANT_TO_READ',
        notes: data.notes,
      },
    })

    return NextResponse.json(book, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar livro' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const existing = await prisma.book.findUnique({ where: { id: data.id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

    const book = await prisma.book.update({
      where: { id: data.id, userId: session.user.id },
      data: {
        title: data.title ?? existing.title,
        author: data.author ?? existing.author,
        status: data.status,
        rating: data.rating,
        notes: data.notes,
        startedAt:
          data.status === 'READING' && !existing.startedAt
            ? new Date()
            : data.startedAt
            ? new Date(data.startedAt)
            : undefined,
        finishedAt: data.status === 'COMPLETED' && !existing.finishedAt ? new Date() : undefined,
      },
    })

    return NextResponse.json(book)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar livro' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.book.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar livro' }, { status: 500 })
  }
}
