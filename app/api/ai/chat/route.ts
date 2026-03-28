import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runEmployeeAgent } from '@/lib/claude'
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
        content: z.string().trim().min(1).max(4000),
      })
    )
    .min(1)
    .max(30),
  moduleData: z.unknown().optional(),
})

const MAX_ITERATIONS = 10

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

  const finalText = await runEmployeeAgent(
    { name: employee.name, role: employee.role as any, personality: employee.personality },
    moduleData ?? null,
    messages,
    {
      tools: getToolsForRole(employeeRole),
      maxIterations: MAX_ITERATIONS,
      maxTokens: 2048,
      executeTool: (toolName, input) => executeTool(toolName, input, userId),
    }
  )

  if (finalText) {
    const readable = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        const words = finalText.split(' ')
        let index = 0

        const interval = setInterval(() => {
          if (index < words.length) {
            controller.enqueue(encoder.encode((index === 0 ? '' : ' ') + words[index]))
            index++
            return
          }

          clearInterval(interval)
          controller.close()
        }, 15)
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
    })
  }

  return new Response('Nao consegui processar sua solicitacao. Tente novamente.', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
