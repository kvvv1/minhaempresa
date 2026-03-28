import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { TransactionType } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseCSV(content: string) {
  const lines = content.trim().split('\n')
  const transactions: Array<{
    date: Date
    description: string
    amount: number
    type: TransactionType
    category: string
  }> = []

  // Try to detect format (Brazilian bank CSVs vary)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Handle quoted CSV
    const cols = line.match(/(".*?"|[^,]+)/g)?.map(c => c.replace(/"/g, '').trim()) || line.split(',')

    if (cols.length >= 3) {
      const dateStr = cols[0]
      const description = cols[1] || 'Importado'
      const amountStr = cols[2]?.replace(/[R$\s.]/g, '').replace(',', '.')

      const amount = parseFloat(amountStr)
      if (isNaN(amount)) continue

      // Parse date (dd/mm/yyyy or yyyy-mm-dd)
      let date: Date
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/')
        date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
      } else {
        date = new Date(dateStr)
      }

      if (isNaN(date.getTime())) continue

      transactions.push({
        date,
        description,
        amount: Math.abs(amount),
        type: amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME,
        category: 'Importado',
      })
    }
  }

  return transactions
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const content = await file.text()
    const parsed = parseCSV(content)

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'Nenhuma transação encontrada no arquivo' }, { status: 400 })
    }

    const created = await prisma.transaction.createMany({
      data: parsed.map(t => ({
        userId: session.user.id,
        ...t,
        isRecurring: false,
      })),
    })

    return NextResponse.json({ imported: created.count, total: parsed.length })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao importar arquivo' }, { status: 500 })
  }
}
