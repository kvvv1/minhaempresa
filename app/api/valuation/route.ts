import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  scoreDesenvolvimento,
  scoreFaculdade,
  scoreFinanceiro,
  scoreMetas,
  scoreNutricao,
  scoreRelacionamentos,
  scoreRotina,
  scoreSaude,
  scoreTarefas,
  scoreTrabalho,
} from '@/lib/valuation'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateInsights(scores: Record<string, number>): Promise<string[]> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Scores da Vida S.A.: ${JSON.stringify(scores)}.
Gere exatamente 3 insights curtos (1 frase cada) em portugues sobre o que melhorar.
Responda so com JSON array: ["insight1","insight2","insight3"]`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0]) as string[]
  } catch {}

  return []
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const history = await prisma.companyValuation.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    take: 12,
  })

  return NextResponse.json(history)
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userId = session.user.id

    const [
      transactions,
      budgets,
      habits,
      habitLogs,
      tasks,
      goals,
      contacts,
      interactions,
      books,
      courses,
      skills,
      workouts,
      bodyMetrics,
      sleepLogs,
      meals,
      subjects,
      assignments,
      studySessions,
      projects,
      projectTasks,
      gtdTasks,
    ] = await Promise.all([
      prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 100 }),
      prisma.budget.findMany({ where: { userId } }),
      prisma.habit.findMany({ where: { userId, isActive: true } }),
      prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 90 }),
      prisma.task.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId }, include: { keyResults: true } }),
      prisma.contact.findMany({ where: { userId } }),
      prisma.interaction.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 50 }),
      prisma.book.findMany({ where: { userId } }),
      prisma.course.findMany({ where: { userId } }),
      prisma.skill.findMany({ where: { userId } }),
      prisma.workout.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 20 }),
      prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 10 }),
      prisma.sleepLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 14 }),
      prisma.meal.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 50 }),
      prisma.subject.findMany({ where: { userId, status: 'IN_PROGRESS' } }),
      prisma.assignment.findMany({ where: { userId } }),
      prisma.studySession.findMany({ where: { userId }, orderBy: { startAt: 'desc' }, take: 20 }),
      prisma.project.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.projectTask.findMany({ where: { userId } }),
      prisma.gtdTask.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 50 }),
    ])

    const scores = {
      financeiro: scoreFinanceiro(transactions, budgets),
      rotina: scoreRotina(habits, habitLogs, tasks),
      metas: scoreMetas(goals),
      relacionamentos: scoreRelacionamentos(contacts, interactions),
      desenvolvimento: scoreDesenvolvimento(books, courses, skills),
      saude: scoreSaude(workouts, bodyMetrics, sleepLogs),
      nutricao: scoreNutricao(meals),
      faculdade: scoreFaculdade(subjects, assignments, studySessions),
      trabalho: scoreTrabalho(projects, projectTasks),
      tarefas: scoreTarefas(gtdTasks),
    }

    const total = Math.round(
      Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length
    )

    const insights = await generateInsights(scores)

    const valuation = await prisma.companyValuation.create({
      data: { userId, value: total, scores },
    })

    return NextResponse.json({
      ...valuation,
      insights,
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao calcular valuation' }, { status: 500 })
  }
}
