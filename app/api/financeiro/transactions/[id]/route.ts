import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type TransactionRouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(req: Request, { params }: TransactionRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const { id } = await params

  const transaction = await prisma.transaction.update({
    where: { id, userId: session.user.id },
    data: {
      type: data.type,
      amount: parseFloat(data.amount),
      description: data.description,
      category: data.category,
      date: new Date(data.date),
    },
  })

  return NextResponse.json(transaction)
}

export async function DELETE(_req: Request, { params }: TransactionRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await prisma.transaction.delete({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}
