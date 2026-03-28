import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { ids, targetBucket } = await req.json()
    if (!ids?.length || !targetBucket) {
      return NextResponse.json({ error: 'ids e targetBucket obrigatórios' }, { status: 400 })
    }

    await prisma.gtdTask.updateMany({
      where: { id: { in: ids }, userId: session.user.id },
      data: { bucket: targetBucket },
    })

    return NextResponse.json({ success: true, updated: ids.length })
  } catch {
    return NextResponse.json({ error: 'Erro ao processar tarefas' }, { status: 500 })
  }
}
