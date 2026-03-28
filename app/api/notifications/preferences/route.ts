import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULT_PREFS = {
  dailyBriefing: true,
  weeklyReport: true,
  goalDeadlines: true,
  followupReminders: true,
  crisisAlerts: true,
}

const prefsSchema = z.object({
  dailyBriefing: z.boolean(),
  weeklyReport: z.boolean(),
  goalDeadlines: z.boolean(),
  followupReminders: z.boolean(),
  crisisAlerts: z.boolean(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPrefs: true },
  })

  try {
    const prefs = JSON.parse(user?.notificationPrefs || '{}')
    return NextResponse.json({ ...DEFAULT_PREFS, ...prefs })
  } catch {
    return NextResponse.json(DEFAULT_PREFS)
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = prefsSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPrefs: JSON.stringify(parsed.data) },
  })

  return NextResponse.json(parsed.data)
}
