import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EmployeeRole } from '@prisma/client'

const DEFAULT_EMPLOYEES: { role: EmployeeRole; name: string; personality: string }[] = [
  { role: EmployeeRole.CHIEF_OF_STAFF,   name: 'Leo',     personality: 'Proativo, visionário e sempre otimista. Coordena tudo com maestria.' },
  { role: EmployeeRole.CFO,              name: 'Carlos',  personality: 'Analítico, direto e não aceita desculpas sobre dinheiro.' },
  { role: EmployeeRole.COO,              name: 'Ana',     personality: 'Disciplinada, focada em resultados e amante de processos.' },
  { role: EmployeeRole.CHRO,             name: 'Pedro',   personality: 'Empático, atento e sempre lembrando das pessoas que importam.' },
  { role: EmployeeRole.RD,               name: 'Sofia',   personality: 'Curiosa, criativa e constantemente desafiando limites.' },
  { role: EmployeeRole.PERSONAL_TRAINER, name: 'Bruno',   personality: 'Motivador, científico e focado em performance máxima.' },
  { role: EmployeeRole.MENTOR_ACADEMICO, name: 'Juliana', personality: 'Metódica, encorajadora e orientada a resultados acadêmicos.' },
  { role: EmployeeRole.PROJECT_MANAGER,  name: 'Rafael',  personality: 'Sistemático, orientado a entrega e não tolera bloqueios.' },
]

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const existing = await prisma.employee.findMany({
    where: { userId },
    select: { role: true },
  })
  const existingRoles = new Set(existing.map((e) => e.role))

  const missing = DEFAULT_EMPLOYEES.filter((e) => !existingRoles.has(e.role))
  if (missing.length === 0) return NextResponse.json({ created: 0 })

  await prisma.employee.createMany({
    data: missing.map((e) => ({ userId, ...e })),
  })

  return NextResponse.json({ created: missing.length })
}
