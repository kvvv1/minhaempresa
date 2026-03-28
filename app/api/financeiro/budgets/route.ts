import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

  const budgets = await prisma.budget.findMany({
    where: { userId: session.user.id, month, year },
    include: { transactions: true },
  })

  return NextResponse.json(budgets)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const now = new Date()

  const budget = await prisma.budget.create({
    data: {
      userId: session.user.id,
      name: data.name,
      category: data.category,
      limit: parseFloat(data.limit),
      month: data.month || now.getMonth() + 1,
      year: data.year || now.getFullYear(),
    },
  })

  return NextResponse.json(budget, { status: 201 })
}
