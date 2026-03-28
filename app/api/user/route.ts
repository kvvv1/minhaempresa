import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseStoredArray, stringifyStoredArray } from '@/lib/storage'

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  companyName: z.string().trim().min(1).max(100),
  mission: z.string().trim().max(1000).optional().or(z.literal('')),
  values: z.array(z.string().trim().min(1).max(50)).max(20),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      mission: true,
      values: true,
      employees: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...user,
    values: parseStoredArray<string>(user.values),
  })
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = updateUserSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
  }

  const data = parsed.data
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      companyName: data.companyName,
      mission: data.mission || null,
      values: stringifyStoredArray(data.values),
    },
  })

  return NextResponse.json({
    ...user,
    values: parseStoredArray<string>(user.values),
  })
}
