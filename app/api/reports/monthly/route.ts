import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { startOfMonth, endOfMonth, eachWeekOfInterval, endOfWeek } from 'date-fns'

const client = new Anthropic()

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [transactions, habitLogs, goals, diaryEntries, contacts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: 'asc' },
    }),
    prisma.habitLog.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd } },
      include: { habit: true },
    }),
    prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { keyResults: true },
    }),
    prisma.diaryEntry.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: 'asc' },
    }),
    prisma.contact.findMany({
      where: { userId },
      include: { interactions: { where: { date: { gte: monthStart, lte: monthEnd } } } },
    }),
  ])

  const income = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const expenses = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const expensesByCategory: Record<string, number> = {}
  transactions
    .filter((t) => t.type === 'EXPENSE')
    .forEach((t) => {
      const cat = t.category || 'Outros'
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(t.amount)
    })

  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 })
  const weeklySpending = weeks.map((weekStart) => {
    const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
    const weekTotal = transactions
      .filter((t) => {
        const d = new Date(t.date)
        return t.type === 'EXPENSE' && d >= weekStart && d <= wEnd
      })
      .reduce((sum, t) => sum + Number(t.amount), 0)

    return {
      week: weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      total: Math.round(weekTotal * 100) / 100,
    }
  })

  const habitStats: Record<string, { name: string; completed: number; total: number; rate: number }> = {}
  const daysInMonth = monthEnd.getDate()

  habitLogs.forEach((log) => {
    const habitId = log.habitId
    const habitName = (log.habit as { name?: string } | null)?.name || habitId
    if (!habitStats[habitId]) {
      habitStats[habitId] = { name: habitName, completed: 0, total: daysInMonth, rate: 0 }
    }
    if (log.completed) habitStats[habitId].completed++
  })

  Object.values(habitStats).forEach((stat) => {
    stat.rate = Math.round((stat.completed / stat.total) * 100)
  })

  const goalProgress = goals.map((goal) => {
    const krs = goal.keyResults || []
    const avgProgress =
      krs.length > 0
        ? Math.round(krs.reduce((sum, kr) => sum + (kr.progress || 0), 0) / krs.length)
        : goal.progress || 0

    return {
      id: goal.id,
      title: goal.title,
      progress: avgProgress,
      dueDate: goal.targetDate,
      keyResults: krs.map((kr) => ({
        title: kr.title,
        progress: kr.progress || 0,
        target: kr.target,
        current: kr.progress,
      })),
    }
  })

  const moodTrend = diaryEntries
    .filter((e) => e.mood !== null)
    .map((e) => ({
      date: new Date(e.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      mood: e.mood,
    }))

  const avgMood =
    moodTrend.length > 0
      ? Math.round((moodTrend.reduce((sum, e) => sum + (e.mood || 0), 0) / moodTrend.length) * 10) / 10
      : null

  const chiefOfStaff = await prisma.employee.findFirst({
    where: { userId, role: 'CHIEF_OF_STAFF', isActive: true },
  })

  const summaryData = {
    period: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    financial: { income, expenses, balance: income - expenses, expensesByCategory },
    habits: Object.values(habitStats),
    goals: goalProgress,
    diary: { entries: diaryEntries.length, avgMood },
    contacts: { interactions: contacts.reduce((sum, c) => sum + c.interactions.length, 0) },
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: `Voce e ${chiefOfStaff?.name || 'Leo'}, Chief of Staff. Gere o relatorio mensal executivo do CEO em portugues. Seja analitico, identifique tendencias e de recomendacoes acionaveis.`,
    messages: [
      {
        role: 'user',
        content: `Gere o relatorio mensal de ${summaryData.period}.
Inclua: resumo executivo, desempenho financeiro, consistencia de habitos, progresso de metas, bem-estar e top 5 prioridades do proximo mes.
Dados: ${JSON.stringify(summaryData)}`,
      },
    ],
  })

  return NextResponse.json({
    report: response.content[0].type === 'text' ? response.content[0].text : '',
    period: { start: monthStart, end: monthEnd, label: summaryData.period },
    data: {
      financial: {
        income,
        expenses,
        balance: income - expenses,
        expensesByCategory,
        weeklySpending,
      },
      habits: Object.values(habitStats),
      goals: goalProgress,
      diary: { entries: diaryEntries.length, avgMood, moodTrend },
    },
  })
}
