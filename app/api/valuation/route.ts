import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseStoredObject, stringifyStoredObject } from '@/lib/storage'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Deterministic scoring — no AI required ────────────────────────────────

function scoreFinanceiro(transactions: any[], budgets: any[]): number {
  let score = 0
  if (transactions.length === 0) return 0

  score += 20 // has data

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthTx = transactions.filter((t) => new Date(t.date) >= monthStart)
  const income = monthTx.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const expense = monthTx.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)

  if (income > 0) score += 20
  if (income > expense) score += 30
  else if (income > 0 && expense > 0) score += 10

  const savingsRate = income > 0 ? (income - expense) / income : 0
  if (savingsRate >= 0.2) score += 30
  else if (savingsRate >= 0.1) score += 20
  else if (savingsRate >= 0) score += 10

  if (budgets.length > 0) score += 10 // has budgets set

  return Math.min(100, score)
}

function scoreRotina(habits: any[], habitLogs: any[], tasks: any[]): number {
  if (habits.length === 0 && tasks.length === 0) return 0
  let score = 0

  if (habits.length > 0) score += 20
  if (tasks.length > 0) score += 10

  // Completion rate last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentLogs = habitLogs.filter((l) => new Date(l.date) >= sevenDaysAgo)
  const completedLogs = recentLogs.filter((l) => l.completed)
  const completionRate = recentLogs.length > 0 ? completedLogs.length / recentLogs.length : 0

  if (completionRate >= 0.8) score += 40
  else if (completionRate >= 0.5) score += 25
  else if (completionRate > 0) score += 10

  // Average streak
  const avgStreak = habits.length > 0
    ? habits.reduce((s, h) => s + (h.streak || 0), 0) / habits.length
    : 0
  if (avgStreak >= 14) score += 30
  else if (avgStreak >= 7) score += 20
  else if (avgStreak >= 3) score += 10

  return Math.min(100, score)
}

function scoreMetas(goals: any[]): number {
  if (goals.length === 0) return 0
  let score = 20 // has goals

  const active = goals.filter((g) => g.status === 'ACTIVE')
  const completed = goals.filter((g) => g.status === 'COMPLETED')

  if (active.length > 0) score += 20
  if (completed.length > 0) score += 20

  const avgProgress = active.length > 0
    ? active.reduce((s, g) => s + (g.progress || 0), 0) / active.length
    : 0
  if (avgProgress >= 70) score += 40
  else if (avgProgress >= 40) score += 25
  else if (avgProgress >= 10) score += 10

  return Math.min(100, score)
}

function scoreRelacionamentos(contacts: any[], interactions: any[]): number {
  if (contacts.length === 0) return 0
  let score = 20

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const recentInteractions = interactions.filter((i) => new Date(i.date) >= fourteenDaysAgo)
  if (recentInteractions.length > 0) score += 30
  if (recentInteractions.length >= 3) score += 20

  const contactsWithRecentContact = contacts.filter(
    (c) => c.lastContact && new Date(c.lastContact) >= fourteenDaysAgo
  )
  const coverageRate = contacts.length > 0 ? contactsWithRecentContact.length / contacts.length : 0
  if (coverageRate >= 0.5) score += 30
  else if (coverageRate >= 0.2) score += 15

  return Math.min(100, score)
}

function scoreDesenvolvimento(books: any[], courses: any[], skills: any[]): number {
  let score = 0
  if (books.length === 0 && courses.length === 0 && skills.length === 0) return 0

  if (books.length > 0) score += 15
  if (courses.length > 0) score += 15
  if (skills.length > 0) score += 10

  const readingNow = books.filter((b) => b.status === 'READING').length
  const completedBooks = books.filter((b) => b.status === 'COMPLETED').length
  const inProgressCourses = courses.filter((c) => c.status === 'IN_PROGRESS').length
  const completedCourses = courses.filter((c) => c.status === 'COMPLETED').length

  if (readingNow > 0) score += 20
  if (completedBooks > 0) score += 10
  if (completedBooks >= 3) score += 10
  if (inProgressCourses > 0) score += 10
  if (completedCourses > 0) score += 10

  return Math.min(100, score)
}

function scoreSaude(workouts: any[], bodyMetrics: any[], sleepLogs: any[]): number {
  if (workouts.length === 0 && bodyMetrics.length === 0 && sleepLogs.length === 0) return 50
  let score = 0

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentWorkouts = workouts.filter((w) => new Date(w.date) >= sevenDaysAgo)
  if (recentWorkouts.length >= 3) score += 40
  else if (recentWorkouts.length >= 1) score += 20
  else if (workouts.length > 0) score += 10

  const recentSleep = sleepLogs.filter((s) => new Date(s.date) >= sevenDaysAgo)
  if (recentSleep.length > 0) {
    const avgMin = recentSleep.reduce((s: number, l: any) => s + l.durationMin, 0) / recentSleep.length
    if (avgMin >= 420) score += 40
    else if (avgMin >= 360) score += 25
    else score += 10
  }

  if (bodyMetrics.length > 0) score += 20

  return Math.min(100, score)
}

function scoreNutricao(meals: any[]): number {
  if (meals.length === 0) return 50
  let score = 0

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentMeals = meals.filter((m) => new Date(m.date) >= sevenDaysAgo)
  const daysWithMeals = new Set(recentMeals.map((m) => new Date(m.date).toDateString())).size

  if (daysWithMeals >= 6) score += 50
  else if (daysWithMeals >= 4) score += 35
  else if (daysWithMeals >= 2) score += 20

  if (recentMeals.some((m) => m.proteinG)) score += 30
  if (recentMeals.some((m) => m.calories)) score += 20

  return Math.min(100, score)
}

function scoreFaculdade(subjects: any[], assignments: any[], studySessions: any[]): number {
  if (subjects.length === 0 && assignments.length === 0) return 50
  let score = 0

  if (subjects.length > 0) score += 20

  const avgGrade = subjects.filter((s) => s.currentGrade != null).reduce((s: number, sub: any) => s + sub.currentGrade, 0) / (subjects.filter((s) => s.currentGrade != null).length || 1)
  if (avgGrade >= 8) score += 40
  else if (avgGrade >= 6) score += 25
  else if (avgGrade > 0) score += 10

  const overdueCount = assignments.filter((a: any) => a.status === 'OVERDUE').length
  const pendingCount = assignments.filter((a: any) => ['PENDING', 'IN_PROGRESS'].includes(a.status)).length
  if (overdueCount === 0 && pendingCount === 0) score += 20
  else if (overdueCount === 0) score += 10
  else score -= 10

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentStudy = studySessions.filter((s: any) => new Date(s.startAt) >= sevenDaysAgo && s.durationMin)
  if (recentStudy.length >= 3) score += 20
  else if (recentStudy.length >= 1) score += 10

  return Math.min(100, Math.max(0, score))
}

function scoreTrabalho(projects: any[], tasks: any[]): number {
  if (projects.length === 0 && tasks.length === 0) return 50
  let score = 0

  if (projects.length > 0) score += 20

  const doneTasks = tasks.filter((t) => t.status === 'DONE').length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? doneTasks / totalTasks : 0
  if (completionRate >= 0.7) score += 40
  else if (completionRate >= 0.4) score += 25
  else if (completionRate > 0) score += 10

  const overdue = tasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < new Date()).length
  if (overdue === 0) score += 20
  else if (overdue <= 2) score += 10

  if (projects.length > 0) score += 20

  return Math.min(100, score)
}

function scoreTarefas(gtdTasks: any[]): number {
  if (gtdTasks.length === 0) return 50
  let score = 0

  const inboxCount = gtdTasks.filter((t) => t.bucket === 'INBOX').length
  const totalActive = gtdTasks.filter((t) => ['PENDING', 'IN_PROGRESS'].includes(t.status)).length

  if (inboxCount === 0) score += 30
  else if (inboxCount <= 5) score += 15

  const completedToday = gtdTasks.filter((t) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return t.status === 'COMPLETED' && new Date(t.updatedAt) >= today
  }).length
  if (completedToday >= 3) score += 40
  else if (completedToday >= 1) score += 25

  if (totalActive > 0) score += 30

  return Math.min(100, score)
}

// ── AI Insights (non-blocking, fails gracefully) ──────────────────────────

async function generateInsights(scores: Record<string, number>): Promise<string[]> {
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Scores da Vida S.A.: ${JSON.stringify(scores)}.
Gere exatamente 3 insights curtos (1 frase cada) em português sobre o que melhorar.
Responda só com JSON array: ["insight1","insight2","insight3"]`,
        },
      ],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
  } catch {}
  return []
}

// ─────────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const history = await prisma.companyValuation.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    take: 12,
  })

  return NextResponse.json(
    history.map((item) => ({
      ...item,
      scores: parseStoredObject<Record<string, number>>(item.scores, {}),
    }))
  )
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userId = session.user.id

    const [transactions, budgets, habits, habitLogs, tasks, goals, contacts, interactions, books, courses, skills,
           workouts, bodyMetrics, sleepLogs, meals, subjects, assignments, studySessions, projects, projectTasks, gtdTasks] =
      await Promise.all([
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
      financeiro:    scoreFinanceiro(transactions, budgets),
      rotina:        scoreRotina(habits, habitLogs, tasks),
      metas:         scoreMetas(goals),
      relacionamentos: scoreRelacionamentos(contacts, interactions),
      desenvolvimento: scoreDesenvolvimento(books, courses, skills),
      saude:         scoreSaude(workouts, bodyMetrics, sleepLogs),
      nutricao:      scoreNutricao(meals),
      faculdade:     scoreFaculdade(subjects, assignments, studySessions),
      trabalho:      scoreTrabalho(projects, projectTasks),
      tarefas:       scoreTarefas(gtdTasks),
    }

    const total = Math.round(
      Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length
    )

    // Fire-and-forget insights from AI
    const insights = await generateInsights(scores)

    const valuation = await prisma.companyValuation.create({
      data: { userId, value: total, scores: stringifyStoredObject(scores) },
    })

    return NextResponse.json({
      ...valuation,
      scores,
      insights,
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao calcular valuation' }, { status: 500 })
  }
}
