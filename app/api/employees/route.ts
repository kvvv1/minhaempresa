import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { EmployeeRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleParam = new URL(req.url).searchParams.get('role')
  if (roleParam && !Object.values(EmployeeRole).includes(roleParam as EmployeeRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const employees = await prisma.employee.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
      ...(roleParam ? { role: roleParam as EmployeeRole } : {}),
    },
    orderBy: { role: 'asc' },
  })

  return NextResponse.json(employees)
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, personality } = await req.json()

  const employee = await prisma.employee.update({
    where: { id, userId: session.user.id },
    data: { name, personality },
  })

  return NextResponse.json(employee)
}
