import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseStoredArray, stringifyStoredArray } from '@/lib/storage'

function serializeEntry<T extends { tags: unknown }>(entry: T) {
  return {
    ...entry,
    tags: parseStoredArray<string>(entry.tags),
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entries = await prisma.diaryEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    take: 50,
  })

  return NextResponse.json(entries.map(serializeEntry))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const entry = await prisma.diaryEntry.create({
      data: {
        userId: session.user.id,
        content: data.content,
        mood: data.mood,
        tags: stringifyStoredArray(data.tags),
        date: new Date(),
      },
    })

    return NextResponse.json(serializeEntry(entry), { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar entrada' }, { status: 500 })
  }
}
