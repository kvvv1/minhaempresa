import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json([])

  const userId = session.user.id

  const [transactions, goals, contacts, habits, books] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, description: { contains: q } },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, description: true, amount: true, type: true, date: true },
    }),
    prisma.goal.findMany({
      where: { userId, title: { contains: q } },
      take: 5,
      select: { id: true, title: true, status: true, progress: true },
    }),
    prisma.contact.findMany({
      where: { userId, name: { contains: q } },
      take: 5,
      select: { id: true, name: true, relationship: true },
    }),
    prisma.habit.findMany({
      where: { userId, name: { contains: q }, isActive: true },
      take: 5,
      select: { id: true, name: true, streak: true },
    }),
    prisma.book.findMany({
      where: { userId, OR: [{ title: { contains: q } }, { author: { contains: q } }] },
      take: 5,
      select: { id: true, title: true, author: true, status: true },
    }),
  ])

  const results = [
    ...transactions.map((t) => ({
      type: 'transaction' as const,
      id: t.id,
      title: t.description,
      subtitle: `R$ ${t.amount.toFixed(2)} · ${new Date(t.date).toLocaleDateString('pt-BR')}`,
      href: '/financeiro',
    })),
    ...goals.map((g) => ({
      type: 'goal' as const,
      id: g.id,
      title: g.title,
      subtitle: `Meta · ${g.progress}% concluído`,
      href: '/metas',
    })),
    ...contacts.map((c) => ({
      type: 'contact' as const,
      id: c.id,
      title: c.name,
      subtitle: `Contato · ${c.relationship}`,
      href: '/relacionamentos',
    })),
    ...habits.map((h) => ({
      type: 'habit' as const,
      id: h.id,
      title: h.name,
      subtitle: `Hábito · ${h.streak} dias de sequência`,
      href: '/rotina',
    })),
    ...books.map((b) => ({
      type: 'book' as const,
      id: b.id,
      title: b.title,
      subtitle: `Livro · ${b.author ?? 'Autor desconhecido'} · ${b.status}`,
      href: '/desenvolvimento',
    })),
  ]

  return NextResponse.json(results)
}
