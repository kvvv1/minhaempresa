import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type EmployeeRouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(req: Request, { params }: EmployeeRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, personality } = await req.json()
  const { id } = await params

  const employee = await prisma.employee.update({
    where: { id, userId: session.user.id },
    data: { name, personality },
  })

  return NextResponse.json(employee)
}
