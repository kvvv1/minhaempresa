import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { TransactionType } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { parseEnumValue } from '@/lib/enum'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period')
  const type = parseEnumValue(TransactionType, searchParams.get('type'))
  const category = searchParams.get('category')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))
  const skip = (page - 1) * limit

  const now = new Date()
  let dateFilter: any = {}

  if (period === 'month') {
    dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) }
  } else if (period === 'year') {
    dateFilter = { gte: startOfYear(now), lte: endOfYear(now) }
  } else if (period === 'last3months') {
    dateFilter = { gte: new Date(now.getFullYear(), now.getMonth() - 2, 1) }
  }

  const where = {
    userId: session.user.id,
    ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    ...(type && { type }),
    ...(category && { category }),
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { budget: true },
      orderBy: { date: 'desc' },
      take: limit,
      skip,
    }),
    prisma.transaction.count({ where }),
  ])

  // Return array directly when no pagination params (backward-compat), otherwise paginated
  if (!searchParams.get('page')) {
    return NextResponse.json(transactions)
  }
  return NextResponse.json({ data: transactions, total, page, limit, hasMore: skip + transactions.length < total })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const userId = session.user.id

  if (data.budgetId) {
    const budget = await prisma.budget.findFirst({
      where: { id: data.budgetId, userId },
      select: { id: true },
    })

    if (!budget) {
      return NextResponse.json({ error: 'Orcamento nao encontrado' }, { status: 404 })
    }
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: data.type,
      amount: parseFloat(data.amount),
      description: data.description,
      category: data.category,
      date: new Date(data.date),
      isRecurring: data.isRecurring || false,
      recurringDay: data.recurringDay,
      budgetId: data.budgetId,
    },
    include: { budget: true },
  })

  // Budget alert — check on every expense linked to a budget
  if (data.type === 'EXPENSE' && data.budgetId) {
    try {
      const budget = await prisma.budget.findFirst({
        where: { id: data.budgetId, userId },
      })
      if (budget) {
        const now = new Date()
        const monthStart = startOfMonth(now)
        const monthEnd = endOfMonth(now)
        const agg = await prisma.transaction.aggregate({
          where: { userId, budgetId: data.budgetId, type: 'EXPENSE', date: { gte: monthStart, lte: monthEnd } },
          _sum: { amount: true },
        })
        const spent = agg._sum.amount ?? 0
        const pct = (spent / budget.limit) * 100
        const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

        if (pct >= 100) {
          await prisma.notification.create({
            data: {
              userId,
              title: `⛔ Orçamento estourado: ${budget.name}`,
              message: `Você gastou ${pct.toFixed(0)}% do limite de ${fmt(budget.limit)} em "${budget.name}".`,
              type: 'ALERT',
              module: 'financeiro',
              actionUrl: '/financeiro',
            },
          })
        } else if (pct >= 80) {
          const alreadyNotified = await prisma.notification.findFirst({
            where: { userId, module: 'financeiro', type: 'WARNING', createdAt: { gte: monthStart }, title: { contains: budget.name } },
          })
          if (!alreadyNotified) {
            await prisma.notification.create({
              data: {
                userId,
                title: `⚠️ Orçamento em ${pct.toFixed(0)}%: ${budget.name}`,
                message: `Você já usou ${pct.toFixed(0)}% do limite de ${fmt(budget.limit)}. Restam ${fmt(budget.limit - spent)}.`,
                type: 'WARNING',
                module: 'financeiro',
                actionUrl: '/financeiro',
              },
            })
          }
        }
      }
    } catch {}
  }

  return NextResponse.json(transaction, { status: 201 })
}
