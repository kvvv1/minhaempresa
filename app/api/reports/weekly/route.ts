import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { startOfWeek, endOfWeek } from 'date-fns'

const client = new Anthropic()

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  const [transactions, habitLogs, tasks, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.habitLog.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      include: { habit: true },
    }),
    prisma.task.findMany({
      where: { userId, updatedAt: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { keyResults: true },
    }),
  ])

  const chiefOfStaff = await prisma.employee.findFirst({
    where: { userId, role: 'CHIEF_OF_STAFF', isActive: true },
  })

  const weekData = { transactions, habitLogs, tasks, goals }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `Você é ${chiefOfStaff?.name || 'Leo'}, Chief of Staff. Gere o relatório semanal do CEO em português.`,
    messages: [
      {
        role: 'user',
        content: `Gere o relatório semanal (${weekStart.toLocaleDateString('pt-BR')} - ${weekEnd.toLocaleDateString('pt-BR')}).
Inclua: conquistas, financeiro, hábitos cumpridos, tarefas concluídas, metas em progresso e recomendações.
Dados: ${JSON.stringify(weekData)}`,
      },
    ],
  })

  return NextResponse.json({
    report: response.content[0].type === 'text' ? response.content[0].text : '',
    period: { start: weekStart, end: weekEnd },
  })
}
