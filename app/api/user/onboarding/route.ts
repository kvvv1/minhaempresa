import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stringifyStoredArray } from '@/lib/storage'

const employeeSchema = z.object({
  role: z.enum(['CFO', 'COO', 'CHRO', 'RD', 'CHIEF_OF_STAFF', 'PERSONAL_TRAINER', 'MENTOR_ACADEMICO', 'PROJECT_MANAGER']),
  name: z.string().trim().min(1).max(50),
  personality: z.string().trim().min(1).max(500),
})

const onboardingSchema = z.object({
  companyName: z.string().trim().min(1).max(100).optional().or(z.literal('')),
  mission: z.string().trim().max(1000).optional().or(z.literal('')),
  values: z.array(z.string().trim().min(1).max(50)).min(3).max(20),
  employees: z.array(employeeSchema).min(5).max(8),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = onboardingSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }

    const { companyName, mission, values, employees } = parsed.data

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          companyName: companyName || 'Minha Vida S.A.',
          mission: mission || null,
          values: stringifyStoredArray(values),
          onboarded: true,
        },
      })

      await tx.employee.deleteMany({ where: { userId: session.user.id } })
      await tx.employee.createMany({
        data: employees.map((emp) => ({
          userId: session.user.id,
          name: emp.name,
          role: emp.role,
          personality: emp.personality,
        })),
      })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
