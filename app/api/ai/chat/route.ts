import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { streamEmployeeAgent } from '@/lib/claude'
import { getToolsForRole, executeTool } from '@/lib/tools'

const chatSchema = z.object({
  employeeRole: z.enum([
    'CFO',
    'COO',
    'CHRO',
    'RD',
    'CHIEF_OF_STAFF',
    'PERSONAL_TRAINER',
    'MENTOR_ACADEMICO',
    'PROJECT_MANAGER',
  ]),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().max(4000).default(''),
        imageData: z.string().optional(),
        imageMimeType: z.string().optional(),
      })
    )
    .min(1)
    .max(30),
  moduleData: z.unknown().optional(),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 })

  const parsed = chatSchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Dados invalidos', { status: 400 })

  const { employeeRole, messages, moduleData } = parsed.data
  const userId = session.user.id

  const employee = await prisma.employee.findFirst({
    where: { userId, role: employeeRole, isActive: true },
  })
  if (!employee) return new Response('Funcionario nao encontrado', { status: 404 })

  const stream = streamEmployeeAgent(
    { name: employee.name, role: employee.role as any, personality: employee.personality },
    moduleData ?? null,
    messages,
    {
      tools: getToolsForRole(employeeRole),
      maxIterations: 3,
      maxTokens: 2048,
      executeTool: (toolName, input) => executeTool(toolName, input, userId),
    }
  )

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
  })
}
