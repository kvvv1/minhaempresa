import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runEmployeeAgent, MODEL_HAIKU } from '@/lib/claude'
import { getToolsForRole, executeTool } from '@/lib/tools'
import { EMPLOYEE_ROLE_LABELS } from '@/lib/utils'

const MAX_CONTEXT_MESSAGES = 60
const MAX_SPECIALISTS = 2

const ROLE_DATA_SECTIONS: Record<string, string[]> = {
  CFO:              ['financeiro'],
  COO:              ['rotina', 'metas'],
  CHRO:             ['relacionamentos'],
  RD:               ['desenvolvimento'],
  PERSONAL_TRAINER: ['saude', 'nutricao'],
  MENTOR_ACADEMICO: ['faculdade'],
  PROJECT_MANAGER:  ['trabalho', 'tarefas'],
  CHIEF_OF_STAFF:   ['financeiro', 'metas', 'rotina', 'relacionamentos', 'desenvolvimento', 'diario', 'saude', 'nutricao', 'faculdade', 'trabalho', 'tarefas'],
}
const ROLE_PRIORITY = [
  'CHIEF_OF_STAFF',
  'CFO',
  'COO',
  'CHRO',
  'RD',
  'PERSONAL_TRAINER',
  'MENTOR_ACADEMICO',
  'PROJECT_MANAGER',
] as const

const BOARD_WIDE_HINTS = [
  'todos',
  'todo mundo',
  'board',
  'diretoria',
  'cada diretor',
  'cada um',
  'reuniao',
  'mesa toda',
]

const ROLE_KEYWORDS: Record<string, string[]> = {
  CFO: ['financeiro', 'dinheiro', 'renda', 'receita', 'despesa', 'gasto', 'orcamento', 'investir', 'caixa'],
  COO: ['rotina', 'habito', 'disciplina', 'produtividade', 'foco', 'agenda', 'execucao', 'processo', 'tarefa'],
  CHRO: ['relacionamento', 'pessoas', 'contato', 'familia', 'amigo', 'networking', 'namoro', 'conversa'],
  RD: ['aprender', 'aprendizado', 'livro', 'curso', 'habilidade', 'desenvolvimento', 'estudar', 'crescimento'],
  PERSONAL_TRAINER: ['saude', 'treino', 'sono', 'nutricao', 'dieta', 'alimentacao', 'hidrata', 'peso', 'corpo'],
  MENTOR_ACADEMICO: ['faculdade', 'materia', 'prova', 'nota', 'trabalho academico', 'estudo', 'disciplina'],
  PROJECT_MANAGER: ['projeto', 'entrega', 'sprint', 'backlog', 'reuniao', 'deadline', 'prazo', 'kanban', 'milestone'],
}

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'employee']),
        content: z.string().trim().max(4000).default(''),
        employeeRole: z.string().optional(),
        imageData: z.string().optional(),
        imageMimeType: z.string().optional(),
      })
    )
    .min(1)
    .max(MAX_CONTEXT_MESSAGES),
  activeRoles: z.array(z.string()).optional(),
  responseMode: z.enum(['orchestrated', 'full-board']).optional(),
})

type MultiMessage = z.infer<typeof schema>['messages'][number]
type ResponseMode = z.infer<typeof schema>['responseMode']
type EmployeeRecord = {
  name: string
  personality: string
  role: string
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizePayload(body: unknown) {
  const source = typeof body === 'object' && body !== null ? body : {}
  const rawMessages = Array.isArray((source as { messages?: unknown }).messages)
    ? (source as { messages: unknown[] }).messages
    : []
  const rawRoles = Array.isArray((source as { activeRoles?: unknown }).activeRoles)
    ? (source as { activeRoles: unknown[] }).activeRoles
    : []
  const rawMode = (source as { responseMode?: unknown }).responseMode

  return {
    messages: rawMessages
      .filter((message): message is Record<string, unknown> => typeof message === 'object' && message !== null)
      .map((message) => ({
        role: message.role,
        content: typeof message.content === 'string' ? message.content.trim() : message.content,
        employeeRole:
          typeof message.employeeRole === 'string' ? message.employeeRole.trim() : message.employeeRole,
      }))
      .filter(
        (message) =>
          typeof message.role === 'string' &&
          (message.role === 'user' || message.role === 'employee') &&
          typeof message.content === 'string' &&
          message.content.length > 0
      )
      .slice(-MAX_CONTEXT_MESSAGES),
    activeRoles: Array.from(
      new Set(
        rawRoles
          .filter((role): role is string => typeof role === 'string')
          .map((role) => role.trim())
          .filter(Boolean)
      )
    ),
    responseMode: rawMode === 'full-board' ? 'full-board' : 'orchestrated',
  }
}

function getLatestUserPrompt(messages: MultiMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  return latestUserMessage?.content ?? ''
}

function getRolePriority(role: string) {
  const index = ROLE_PRIORITY.indexOf(role as (typeof ROLE_PRIORITY)[number])
  return index === -1 ? 99 : index
}

function buildHistoryForEmployee(messages: MultiMessage[], employeeRole: string) {
  return messages.map((message) => ({
    role:
      message.role === 'user'
        ? ('user' as const)
        : message.employeeRole === employeeRole
          ? ('assistant' as const)
          : ('user' as const),
    content:
      message.role === 'employee' && message.employeeRole !== employeeRole
        ? `[${message.employeeRole} disse: ${message.content}]`
        : message.content,
    imageData: message.role === 'user' ? message.imageData : undefined,
    imageMimeType: message.role === 'user' ? message.imageMimeType : undefined,
  }))
}

function appendInstructionToLatestUserMessage(
  history: { role: 'user' | 'assistant'; content: string }[],
  instruction: string
) {
  const nextHistory = [...history]
  const lastMessage = nextHistory[nextHistory.length - 1]

  if (lastMessage?.role === 'user') {
    nextHistory[nextHistory.length - 1] = {
      role: 'user',
      content: `${lastMessage.content}\n\n${instruction}`,
    }
    return nextHistory
  }

  nextHistory.push({ role: 'user', content: instruction })
  return nextHistory
}

function scoreEmployee(prompt: string, employee: EmployeeRecord) {
  const normalizedPrompt = normalizeText(prompt)
  const normalizedName = normalizeText(employee.name)
  const normalizedRole = normalizeText(employee.role)
  const normalizedLabel = normalizeText(EMPLOYEE_ROLE_LABELS[employee.role] ?? employee.role)

  let score = 0
  if (normalizedPrompt.includes(normalizedName)) score += 8
  if (normalizedPrompt.includes(normalizedRole)) score += 6
  if (normalizedPrompt.includes(normalizedLabel)) score += 6

  for (const keyword of ROLE_KEYWORDS[employee.role] ?? []) {
    if (normalizedPrompt.includes(keyword)) score += 2
  }

  return score
}

function shouldOpenFullBoard(prompt: string, mode: ResponseMode) {
  if (mode === 'full-board') return true
  const normalizedPrompt = normalizeText(prompt)
  return BOARD_WIDE_HINTS.some((hint) => normalizedPrompt.includes(hint))
}

function selectParticipants(
  employees: EmployeeRecord[],
  messages: MultiMessage[],
  mode: ResponseMode
) {
  const prompt = getLatestUserPrompt(messages)
  const chiefOfStaff = employees.find((employee) => employee.role === 'CHIEF_OF_STAFF')
  const rankedEmployees = employees
    .map((employee) => ({
      employee,
      score: scoreEmployee(prompt, employee),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || getRolePriority(left.employee.role) - getRolePriority(right.employee.role)
    )

  const lead = chiefOfStaff ?? rankedEmployees[0]?.employee ?? employees[0]
  if (!lead) return { lead: null, panel: [] as EmployeeRecord[] }

  if (shouldOpenFullBoard(prompt, mode)) {
    return {
      lead,
      panel: employees
        .filter((employee) => employee.role !== lead.role)
        .sort((left, right) => getRolePriority(left.role) - getRolePriority(right.role)),
    }
  }

  const rankedPanel = rankedEmployees
    .filter(({ employee }) => employee.role !== lead.role)
    .filter(({ score }) => score > 0)
    .slice(0, MAX_SPECIALISTS)
    .map(({ employee }) => employee)

  if (rankedPanel.length > 0) {
    return {
      lead,
      panel: rankedPanel.sort((left, right) => getRolePriority(left.role) - getRolePriority(right.role)),
    }
  }

  const fallbackSpecialist = rankedEmployees.find(({ employee }) => employee.role !== lead.role)?.employee
  return {
    lead,
    panel: fallbackSpecialist ? [fallbackSpecialist] : [],
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const parsed = schema.safeParse(normalizePayload(await req.json()))
    if (!parsed.success) return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })

    const { messages, activeRoles, responseMode = 'orchestrated' } = parsed.data
    const userId = session.user.id

    const employees = await prisma.employee.findMany({
      where: {
        userId,
        isActive: true,
        ...(activeRoles?.length ? { role: { in: activeRoles as any } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!employees.length) {
      return NextResponse.json({ error: 'Nenhum funcionario encontrado' }, { status: 404 })
    }

    const selectedEmployees = employees.map((employee) => ({
      name: employee.name,
      role: employee.role as string,
      personality: employee.personality,
    }))
    const { lead, panel } = selectParticipants(selectedEmployees, messages, responseMode)

    if (!lead) {
      return NextResponse.json({ error: 'Nao foi possivel organizar o board' }, { status: 500 })
    }

    // Determina quais seções de dados são necessárias para os participantes desta rodada
    const neededSections = new Set<string>()
    for (const role of [lead.role, ...panel.map((e) => e.role)]) {
      for (const section of ROLE_DATA_SECTIONS[role] ?? ROLE_DATA_SECTIONS['CHIEF_OF_STAFF']) {
        neededSections.add(section)
      }
    }

    // Busca apenas as seções necessárias
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const queryMap: Record<string, Promise<unknown>> = {}
    if (neededSections.has('financeiro')) {
      queryMap.transactions = prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 30 })
      queryMap.budgets = prisma.budget.findMany({ where: { userId } })
    }
    if (neededSections.has('metas')) {
      queryMap.goals = prisma.goal.findMany({ where: { userId }, include: { keyResults: true }, take: 20 })
    }
    if (neededSections.has('rotina')) {
      queryMap.habits = prisma.habit.findMany({ where: { userId, isActive: true }, take: 30 })
      queryMap.habitLogs = prisma.habitLog.findMany({ where: { userId, date: { gte: sevenDaysAgo } } })
      queryMap.tasks = prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 })
    }
    if (neededSections.has('relacionamentos')) {
      queryMap.contacts = prisma.contact.findMany({ where: { userId }, take: 30 })
      queryMap.interactions = prisma.interaction.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 20 })
    }
    if (neededSections.has('desenvolvimento')) {
      queryMap.books = prisma.book.findMany({ where: { userId }, take: 20 })
      queryMap.courses = prisma.course.findMany({ where: { userId }, take: 20 })
      queryMap.skills = prisma.skill.findMany({ where: { userId }, take: 20 })
    }
    if (neededSections.has('diario')) {
      queryMap.diaryEntries = prisma.diaryEntry.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 10 })
    }
    if (neededSections.has('saude')) {
      queryMap.workouts = prisma.workout.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 10 })
      queryMap.sleepLogs = prisma.sleepLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 7 })
    }
    if (neededSections.has('nutricao')) {
      queryMap.meals = prisma.meal.findMany({ where: { userId, date: { gte: sevenDaysAgo } } })
    }
    if (neededSections.has('faculdade')) {
      queryMap.subjects = prisma.subject.findMany({ where: { userId }, take: 20 })
      queryMap.assignments = prisma.assignment.findMany({ where: { userId }, orderBy: { dueDate: 'asc' }, take: 20 })
    }
    if (neededSections.has('trabalho')) {
      queryMap.projects = prisma.project.findMany({ where: { userId }, take: 20 })
      queryMap.projectTasks = prisma.projectTask.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 })
    }
    if (neededSections.has('tarefas')) {
      queryMap.gtdTasks = prisma.gtdTask.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 30 })
    }

    const queryKeys = Object.keys(queryMap)
    const queryResults = await Promise.all(Object.values(queryMap))
    const raw = Object.fromEntries(queryKeys.map((k, i) => [k, queryResults[i]])) as Record<string, any>

    // Monta o objeto completo de dados (apenas seções buscadas)
    const transactions = raw.transactions ?? []
    const income = transactions.filter((t: any) => t.type === 'INCOME' && new Date(t.date) >= monthStart).reduce((s: number, t: any) => s + t.amount, 0)
    const expenses = transactions.filter((t: any) => t.type === 'EXPENSE' && new Date(t.date) >= monthStart).reduce((s: number, t: any) => s + t.amount, 0)

    const allSectionsData: Record<string, unknown> = {}
    if (neededSections.has('financeiro')) allSectionsData.financeiro = { transactions: transactions.slice(0, 20), budgets: raw.budgets ?? [], income, expenses, balance: income - expenses }
    if (neededSections.has('metas')) allSectionsData.metas = raw.goals ?? []
    if (neededSections.has('rotina')) allSectionsData.rotina = { habits: raw.habits ?? [], habitLogs: raw.habitLogs ?? [], tasks: raw.tasks ?? [] }
    if (neededSections.has('relacionamentos')) allSectionsData.relacionamentos = { contacts: raw.contacts ?? [], interactions: raw.interactions ?? [] }
    if (neededSections.has('desenvolvimento')) allSectionsData.desenvolvimento = { books: raw.books ?? [], courses: raw.courses ?? [], skills: raw.skills ?? [] }
    if (neededSections.has('diario')) allSectionsData.diario = raw.diaryEntries ?? []
    if (neededSections.has('saude')) allSectionsData.saude = { workouts: raw.workouts ?? [], sleepLogs: raw.sleepLogs ?? [] }
    if (neededSections.has('nutricao')) allSectionsData.nutricao = { meals: raw.meals ?? [] }
    if (neededSections.has('faculdade')) allSectionsData.faculdade = { subjects: raw.subjects ?? [], assignments: raw.assignments ?? [] }
    if (neededSections.has('trabalho')) allSectionsData.trabalho = { projects: raw.projects ?? [], projectTasks: raw.projectTasks ?? [] }
    if (neededSections.has('tarefas')) allSectionsData.tarefas = raw.gtdTasks ?? []

    // Retorna apenas as seções relevantes para o role
    function dataForRole(role: string) {
      const keys = ROLE_DATA_SECTIONS[role] ?? ROLE_DATA_SECTIONS['CHIEF_OF_STAFF']
      return Object.fromEntries(keys.filter((k) => k in allSectionsData).map((k) => [k, allSectionsData[k]]))
    }

    const consulted = await Promise.all(
      panel.map(async (employee) => {
        const specialistHistory = appendInstructionToLatestUserMessage(
          buildHistoryForEmployee(messages, employee.role),
          [
            'Voce foi consultado pelo Chief of Staff nesta rodada.',
            'Responda como especialista do seu departamento em ate 120 palavras.',
            'Escreva em markdown limpo.',
            'Seja objetivo: diagnostico, recomendacao e proximo passo.',
            'Use no maximo 3 bullets curtos se isso ajudar.',
            'Prefira bullets a tabelas.',
            'Se usar tabela, use no maximo 1 tabela curta.',
            'Nao diga que executou nada no sistema.',
            'Nao cite tools, funcoes, JSON ou detalhes internos.',
          ].join('\n')
        )

        const response = await runEmployeeAgent(employee as any, dataForRole(employee.role), specialistHistory, {
          model: MODEL_HAIKU,
          maxTokens: 512,
        })

        return {
          employeeRole: employee.role,
          employeeName: employee.name,
          response: response.trim(),
        }
      })
    )

    const leadHistory = appendInstructionToLatestUserMessage(
      buildHistoryForEmployee(messages, lead.role),
      [
        'Voce esta conduzindo esta rodada do board.',
        consulted.length
          ? `Consultas internas desta rodada:\n${consulted
              .map(
                (item) =>
                  `- ${item.employeeName} (${EMPLOYEE_ROLE_LABELS[item.employeeRole] ?? item.employeeRole}): ${item.response}`
              )
              .join('\n')}`
          : 'Nenhum especialista adicional foi consultado nesta rodada.',
        'Agora responda ao CEO com uma sintese final unica.',
        'Se a solicitacao exigir uma acao real no sistema e voce tiver ferramentas, execute.',
        'Ao registrar itens, use a entidade correta: GTD para captura geral, tarefa de projeto para trabalho e trabalho academico para faculdade.',
        'Nunca cite tools, funcoes, parametros, JSON ou bastidores.',
        'Se algo foi executado, confirme apenas o resultado final e o que mudou.',
        'Se nada precisou ser executado, responda como coordenador estrategico do board.',
        'Escreva em markdown limpo.',
        'Comece pela resposta principal ou decisao.',
        'Se for simples, responda em 1 paragrafo curto ou ate 4 bullets.',
        'Se exigir analise, use no maximo 3 secoes curtas com titulos objetivos.',
        'Prefira bullets a tabelas.',
        'Se usar tabela, use no maximo 1 tabela curta.',
        'Mantenha a resposta direta, organizada e em ate 220 palavras.',
      ].join('\n\n')
    )

    const leadResponse = await runEmployeeAgent(lead as any, dataForRole(lead.role), leadHistory, {
      tools: getToolsForRole(lead.role),
      maxIterations: 10,
      maxTokens: 2048,
      executeTool: (toolName, input) => executeTool(toolName, input, userId),
    })

    return NextResponse.json({
      mode: responseMode,
      lead: {
        employeeRole: lead.role,
        employeeName: lead.name,
        response: leadResponse.trim(),
      },
      consulted: consulted.filter((entry) => entry.response.length > 0),
    })
  } catch (err) {
    console.error('[multi/route] erro no chat do board:', err)
    return NextResponse.json({ error: 'Erro no chat do board' }, { status: 500 })
  }
}
