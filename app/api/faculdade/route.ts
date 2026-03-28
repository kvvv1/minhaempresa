import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)

  const [subjects, pendingAssignments, studyHours] = await Promise.all([
    prisma.subject.findMany({
      where: { userId, status: 'IN_PROGRESS' },
      include: { grades: true },
    }),
    prisma.assignment.count({
      where: { userId, status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } },
    }),
    prisma.studySession.aggregate({
      where: { userId, startAt: { gte: weekStart }, durationMin: { not: null } },
      _sum: { durationMin: true },
    }),
  ])

  const avgGrade =
    subjects.length > 0
      ? Math.round(
          (subjects.reduce((s, sub) => s + (sub.currentGrade ?? 0), 0) / subjects.length) * 10
        ) / 10
      : null

  return NextResponse.json({
    activeSubjects: subjects.length,
    pendingAssignments,
    avgGrade,
    weekStudyMin: studyHours._sum.durationMin ?? 0,
  })
}
