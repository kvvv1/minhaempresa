import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period')
  const now = new Date()
  let dateFilter: any = {}

  if (period === 'month') {
    dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) }
  } else if (period === 'year') {
    dateFilter = { gte: startOfYear(now), lte: endOfYear(now) }
  } else if (period === 'last3months') {
    dateFilter = { gte: new Date(now.getFullYear(), now.getMonth() - 2, 1) }
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: session.user.id,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    },
    orderBy: { date: 'desc' },
    take: 5000,
  })

  const header = 'Data,Tipo,Descrição,Categoria,Valor (R$)\n'
  const rows = transactions.map((t) => {
    const date = new Date(t.date).toLocaleDateString('pt-BR')
    const type = t.type === 'INCOME' ? 'Receita' : 'Despesa'
    const desc = `"${t.description.replace(/"/g, '""')}"`
    const cat = `"${t.category.replace(/"/g, '""')}"`
    const amount = t.amount.toFixed(2).replace('.', ',')
    return `${date},${type},${desc},${cat},${amount}`
  })

  const csv = header + rows.join('\n')
  const filename = `transacoes-${period ?? 'todas'}-${now.toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
