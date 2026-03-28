import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateBoardMeeting } from '@/lib/claude'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { topic } = await req.json()
    const userId = session.user.id

    const [
      employees, transactions, habits, goals, contacts, books,
      workouts, sleepLogs, bodyMetrics, meals,
      subjects, assignments, studySessions,
      projects, projectTasks, meetings,
      gtdTasks,
    ] = await Promise.all([
      prisma.employee.findMany({ where: { userId, isActive: true } }),
      prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 30 }),
      prisma.habit.findMany({ where: { userId, isActive: true }, include: { logs: { take: 30 } } }),
      prisma.goal.findMany({ where: { userId, status: 'ACTIVE' }, include: { keyResults: true } }),
      prisma.contact.findMany({ where: { userId }, include: { interactions: { take: 5 } } }),
      prisma.book.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 10 }),
      prisma.workout.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 10 }),
      prisma.sleepLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 7 }),
      prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 5 }),
      prisma.meal.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 20 }),
      prisma.subject.findMany({ where: { userId, status: 'IN_PROGRESS' } }),
      prisma.assignment.findMany({ where: { userId, status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } }, orderBy: { dueDate: 'asc' }, take: 10 }),
      prisma.studySession.findMany({ where: { userId }, orderBy: { startAt: 'desc' }, take: 10 }),
      prisma.project.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.projectTask.findMany({ where: { userId, status: { not: 'DONE' } }, take: 20 }),
      prisma.meeting.findMany({ where: { userId }, orderBy: { startAt: 'desc' }, take: 10 }),
      prisma.gtdTask.findMany({ where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] } }, orderBy: { updatedAt: 'desc' }, take: 20 }),
    ])

    const allData = {
      transactions, habits, goals, contacts, books,
      saude: { workouts, sleepLogs, bodyMetrics },
      nutricao: { meals },
      faculdade: { subjects, assignments, studySessions },
      trabalho: { projects, projectTasks, meetings },
      tarefas: { gtdTasks },
    }

    const reports = await generateBoardMeeting(
      employees.map((e) => ({ name: e.name, role: e.role as any, personality: e.personality })),
      allData,
      topic
    )

    return NextResponse.json({ reports })
  } catch (error) {
    return NextResponse.json({ error: 'Erro na reunião' }, { status: 500 })
  }
}
