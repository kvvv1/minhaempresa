import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import { parseStoredArray, stringifyStoredArray } from '@/lib/storage'

function serializeEntry<T extends { tags: unknown }>(entry: T) {
  return {
    ...entry,
    tags: parseStoredArray<string>(entry.tags),
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const limit = parseInt(searchParams.get('limit') || '30', 10)

  const now = new Date()
  const targetDate = month && year ? new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1) : now

  const entries = await prisma.diaryEntry.findMany({
    where: {
      userId: session.user.id,
      ...(month &&
        year && {
          date: {
            gte: startOfMonth(targetDate),
            lte: endOfMonth(targetDate),
          },
        }),
    },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return NextResponse.json(entries.map(serializeEntry))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, mood, tags } = await req.json()

  const today = new Date()
  const existing = await prisma.diaryEntry.findFirst({
    where: {
      userId: session.user.id,
      date: { gte: startOfDay(today), lte: endOfDay(today) },
    },
  })

  if (existing) {
    const updated = await prisma.diaryEntry.update({
      where: { id: existing.id },
      data: {
        content,
        mood,
        tags: stringifyStoredArray(tags),
      },
    })

    return NextResponse.json(serializeEntry(updated))
  }

  const entry = await prisma.diaryEntry.create({
    data: {
      userId: session.user.id,
      content,
      mood,
      tags: stringifyStoredArray(tags),
      date: today,
    },
  })

  return NextResponse.json(serializeEntry(entry), { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.diaryEntry.delete({ where: { id, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
