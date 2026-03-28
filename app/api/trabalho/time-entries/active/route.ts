import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entry = await prisma.timeEntry.findFirst({
    where: { userId: session.user.id, endAt: null },
    include: { projectTask: { select: { id: true, title: true, project: { select: { id: true, name: true } } } } },
    orderBy: { startAt: 'desc' },
  })

  return NextResponse.json(entry)
}
