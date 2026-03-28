import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const EMPTY_RESPONSE_FALLBACK =
  'Não consegui formular uma resposta útil agora. Tente reformular sua pergunta.'

type EmployeeChatMessage = { role: 'user' | 'assistant'; content: string }
type ToolExecutor = (toolName: string, input: Record<string, unknown>) => Promise<string>

interface EmployeeSystemPromptOptions {
  canUseTools?: boolean
}

interface EmployeeAgentOptions {
  executeTool?: ToolExecutor
  maxIterations?: number
  maxTokens?: number
  tools?: Anthropic.Tool[]
}

export type EmployeeRole = 'CFO' | 'COO' | 'CHRO' | 'RD' | 'CHIEF_OF_STAFF' | 'PERSONAL_TRAINER' | 'MENTOR_ACADEMICO' | 'PROJECT_MANAGER'

export interface Employee {
  name: string
  role: EmployeeRole
  personality: string
}

export function getEmployeeSystemPrompt(
  employee: Employee,
  userData: any,
  options: EmployeeSystemPromptOptions = {}
): string {
  const roleDescriptions: Record<EmployeeRole, string> = {
    CFO: `Você é ${employee.name}, o CFO (Diretor Financeiro) pessoal do CEO.
    Você é analítico, direto e não tem papas na língua quando o assunto é dinheiro.
    Você tem acesso completo aos dados financeiros do CEO: transações, orçamentos, metas financeiras.
    Personalidade adicional: ${employee.personality}
    Sempre use dados reais ao responder. Seja específico com números.`,

    COO: `Você é ${employee.name}, a COO (Diretora de Operações) pessoal do CEO.
    Você é disciplinada, organizada e focada em execução e resultados.
    Você tem acesso aos hábitos, tarefas e rotina do CEO.
    Personalidade adicional: ${employee.personality}
    Sempre encoraje consistência e melhoria de processos.`,

    CHRO: `Você é ${employee.name}, o CHRO (Diretor de RH) pessoal do CEO.
    Você é empático, atento a relacionamentos e às pessoas que importam.
    Você tem acesso aos contatos, interações e compromissos do CEO.
    Personalidade adicional: ${employee.personality}
    Sempre lembre o CEO das pessoas importantes e de compromissos pendentes.`,

    RD: `Você é ${employee.name}, a Diretora de P&D (Pesquisa e Desenvolvimento) pessoal do CEO.
    Você é curiosa, sempre desafiando o CEO a crescer e aprender mais.
    Você tem acesso aos livros, cursos e habilidades do CEO.
    Personalidade adicional: ${employee.personality}
    Sempre sugira conexões entre aprendizados e metas.`,

    CHIEF_OF_STAFF: `Você é ${employee.name}, o Chief of Staff pessoal do CEO.
    Você coordena todos os departamentos e tem visão completa da "empresa pessoal".
    Você tem acesso a TODOS os dados: financeiro, rotina, relacionamentos, desenvolvimento, diário, saúde, nutrição, faculdade, trabalho e tarefas.
    Personalidade adicional: ${employee.personality}
    Você é o principal conselheiro do CEO. Veja o quadro completo sempre.`,

    PERSONAL_TRAINER: `Você é ${employee.name}, o Personal Trainer e Nutricionista pessoal do CEO.
    Você é motivador, orientado a performance, com linguagem direta e científica.
    Você tem acesso completo aos treinos, métricas corporais, sono, hidratação e nutrição do CEO.
    Personalidade adicional: ${employee.personality}
    Sempre use dados reais: progressão de cargas, tendências de peso, qualidade do sono.
    Conecte saúde física com performance executiva. Seja específico com protocolos.`,

    MENTOR_ACADEMICO: `Você é ${employee.name}, a Mentora Acadêmica pessoal do CEO.
    Você é metódica, encorajadora e focada em resultados de aprendizado.
    Você tem acesso às disciplinas, notas, trabalhos pendentes e sessões de estudo do CEO.
    Personalidade adicional: ${employee.personality}
    Sempre priorize prazos de trabalhos, alerte sobre médias em risco, sugira técnicas de estudo.
    Conecte o aprendizado acadêmico às metas de carreira do CEO.`,

    PROJECT_MANAGER: `Você é ${employee.name}, o Gerente de Projetos pessoal do CEO.
    Você é sistemático, orientado a entrega e não tolera gargalos sem plano de ação.
    Você tem acesso a todos os projetos, tarefas kanban, reuniões e registro de tempo do CEO.
    Personalidade adicional: ${employee.personality}
    Sempre aponte tarefas atrasadas, tempo gasto versus estimado, e próximos milestones.
    Use metodologias ágeis ao dar conselhos. Seja focado em desbloqueio de impedimentos.`,
  }

  const operationsSection = options.canUseTools
    ? `

CAPACIDADES DE ACAO - MUITO IMPORTANTE:
Voce tem acesso a ferramentas (tools) que permitem executar acoes REAIS no sistema do CEO.
Isso inclui criar, editar e remover: transacoes, orcamentos, metas, key results, habitos, tarefas,
contatos, interacoes, compromissos, livros, cursos, habilidades e entradas de diario.

REGRAS DE EXECUCAO:
- Quando o CEO pedir para adicionar, criar, registrar, remover, atualizar ou editar qualquer coisa, use a tool.
- Execute a acao imediatamente e confirme o que foi feito com os detalhes reais.
- Se precisar de informacoes para completar a acao (ex: valor, categoria, data), pergunte antes de executar.
- Se uma tool falhar, explique o erro real e sugira como corrigir.
- Nunca exponha nomes de tools, JSON, IDs internos, parametros ou detalhes tecnicos do fluxo.
- Depois de executar algo, responda apenas com o resultado final em linguagem natural.`
    : `

REGRAS OPERACIONAIS:
- Neste canal voce esta em modo consultivo.
- Nao diga que executou algo no sistema se nenhuma acao real foi disparada.
- Se o CEO pedir uma acao transacional, oriente o que deve ser feito e seja transparente.`

  const formattingSection = `

FORMATO DE RESPOSTA:
- Escreva em markdown limpo e legivel.
- Adapte o tamanho da resposta ao pedido do CEO:
  - pedido simples, status, confirmacao ou execucao: 1 paragrafo curto ou 2 a 4 bullets
  - analise, plano, revisao ou comparacao: use titulo curto e 2 a 4 secoes curtas
  - aprofunde so quando o CEO pedir explicitamente ou quando a decisao exigir contexto
- Comece pela resposta, decisao ou diagnostico principal. Nao enrole.
- Use listas com "-" para passos, prioridades e recomendacoes.
- Use tabelas markdown apenas quando comparar opcoes, metricas, status, prazos ou tradeoffs.
- Evite parede de texto, repeticao, introducoes vazias e fechamento desnecessario.
- Se executar algo, a primeira linha deve confirmar claramente o que foi feito.
- Nao invente execucao, dados ou certeza que nao existam.
- Titulos e subtitulos devem ser curtos e funcionais.`

  return `${roleDescriptions[employee.role]}

DADOS ATUAIS DO CEO:
${JSON.stringify(userData, null, 2)}
${operationsSection}
${formattingSection}

REGRAS GERAIS:
- Responda sempre em português brasileiro
- Seja conciso mas completo
- Use os dados reais fornecidos ao fazer análises
- Mantenha sua personalidade única consistentemente
- Você trabalha para o CEO — seja útil, honesto, proativo e executor`
}

export function getTextFromContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function parseToolResult(rawResult: string) {
  try {
    const parsed = JSON.parse(rawResult) as {
      error?: string
      id?: string
      message?: string
      success?: boolean
    }

    return {
      success: parsed.success !== false,
      internalId: parsed.id,
      message: parsed.message?.trim() || parsed.error?.trim() || EMPTY_RESPONSE_FALLBACK,
    }
  } catch {
    return {
      success: true,
      internalId: undefined,
      message: rawResult.trim() || EMPTY_RESPONSE_FALLBACK,
    }
  }
}

function getModelVisibleToolResult(rawResult: string) {
  const parsed = parseToolResult(rawResult)
  const status = parsed.success ? 'SUCESSO' : 'ERRO'
  const internalReference = parsed.internalId
    ? ` Referencia interna: ${parsed.internalId}.`
    : ''

  return `${status}: ${parsed.message}.${internalReference} Nunca exponha a referencia interna ao CEO.`
}

function getUserVisibleToolResult(rawResult: string) {
  return parseToolResult(rawResult).message
}

export async function runEmployeeAgent(
  employee: Employee,
  userData: any,
  messages: EmployeeChatMessage[],
  options: EmployeeAgentOptions = {}
): Promise<string> {
  const systemPrompt = getEmployeeSystemPrompt(employee, userData, {
    canUseTools: Boolean(options.tools?.length && options.executeTool),
  })

  if (!options.tools?.length || !options.executeTool) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: options.maxTokens ?? 1024,
      system: systemPrompt,
      messages,
    })

    return getTextFromContent(response.content) || EMPTY_RESPONSE_FALLBACK
  }

  const loopMessages: Anthropic.MessageParam[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))

  let finalText = ''
  let lastToolSummary = ''
  let iterations = 0

  while (iterations < (options.maxIterations ?? 10)) {
    iterations++

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: options.maxTokens ?? 2048,
      system: systemPrompt,
      tools: options.tools,
      messages: loopMessages,
    })

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )
    const textContent = getTextFromContent(response.content)

    if (toolUseBlocks.length === 0) {
      finalText = textContent || lastToolSummary || EMPTY_RESPONSE_FALLBACK
      break
    }

    loopMessages.push({ role: 'assistant', content: response.content })

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const rawResult = await options.executeTool?.(
          block.name,
          block.input as Record<string, unknown>
        )

        if (rawResult) {
          lastToolSummary = getUserVisibleToolResult(rawResult)
        }

        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: getModelVisibleToolResult(rawResult ?? ''),
        }
      })
    )

    loopMessages.push({ role: 'user', content: toolResults })
  }

  return finalText || lastToolSummary || EMPTY_RESPONSE_FALLBACK
}

export async function chatWithEmployee(
  employee: Employee,
  userData: any,
  messages: EmployeeChatMessage[]
): Promise<string> {
  return runEmployeeAgent(employee, userData, messages)
}

export async function generateDailyBriefing(
  chiefOfStaff: Employee,
  allData: any
): Promise<string> {
  const prompt = `Gere o briefing matinal do CEO para hoje (${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}).

Inclua (apenas se houver dados relevantes para cada área):
1. Saudação personalizada
2. Estado financeiro (alertas de saldo ou orçamento)
3. Hábitos e tarefas GTD do dia
4. Relacionamentos que precisam de atenção
5. Metas com prazos próximos
6. Saúde: último treino e hidratação
7. Faculdade: trabalhos urgentes ou com prazo próximo
8. Trabalho: tarefas em andamento ou atrasadas
9. Uma frase motivacional alinhada com a missão pessoal
10. Top 3 prioridades do dia

Seja conciso, direto e energizante. Máximo 350 palavras.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: getEmployeeSystemPrompt(chiefOfStaff, allData),
    messages: [{ role: 'user', content: prompt }],
  })

  return getTextFromContent(response.content) || EMPTY_RESPONSE_FALLBACK
}

function buildBoardMeetingPrompt(topic?: string) {
  if (topic) {
    return `O CEO quer discutir: "${topic}".

Monte seu relatorio em markdown limpo.
Estrutura esperada:
## Leitura do tema
## O que importa para meu departamento
## Recomendacoes

Regras:
- Seja objetivo e direto.
- Use no maximo 4 bullets por secao.
- Prefira bullets curtos a tabelas.
- Se usar tabela, use no maximo 1 tabela curta.
- Termine com no maximo 3 recomendacoes praticas.`
  }

  return `De seu relatorio trimestral em markdown limpo.

Estrutura esperada:
## Situacao atual
## Principais avancos
## Riscos e gargalos
## Recomendacoes

Regras:
- Seja executivo e especifico.
- Use no maximo 4 bullets por secao.
- Prefira bullets curtos a tabelas.
- Se usar tabela, use no maximo 1 tabela curta.
- Termine com no maximo 3 recomendacoes para o CEO.`
}

export async function generateBoardMeeting(
  employees: Employee[],
  allData: any,
  topic?: string
): Promise<{ employee: Employee; report: string }[]> {
  const reports = await Promise.all(
    employees.map(async (employee) => {
      let prompt = topic
        ? `O CEO quer discutir: "${topic}". Dê seu relatório e perspectiva do seu departamento sobre esse tema.`
        : `Dê seu relatório trimestral. Cubra: situação atual, principais conquistas, desafios, e suas 3 recomendações para o CEO.`

      prompt = buildBoardMeetingPrompt(topic)

      const report = await chatWithEmployee(employee, allData, [
        { role: 'user', content: prompt },
      ])

      return { employee, report }
    })
  )

  return reports
}

export async function generateInsight(
  employee: Employee,
  moduleData: any,
  insightType: string
): Promise<string> {
  const prompt = `Gere um insight proativo sobre: ${insightType}.
Seja direto, específico e acionável. Máximo 100 palavras.`

  return chatWithEmployee(employee, moduleData, [
    { role: 'user', content: prompt },
  ])
}

export async function calculateCompanyScore(allData: any): Promise<{
  total: number
  scores: Record<string, number>
  insights: string[]
}> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'Você é um sistema de análise de saúde pessoal. Analise os dados e retorne JSON válido.',
    messages: [
      {
        role: 'user',
        content: `Analise os dados abaixo e calcule scores de 0-100 para cada área.
Retorne JSON com este formato exato:
{
  "total": <média geral>,
  "scores": {
    "financeiro": <score>,
    "rotina": <score>,
    "relacionamentos": <score>,
    "desenvolvimento": <score>,
    "metas": <score>,
    "saude": <score>,
    "nutricao": <score>,
    "faculdade": <score>,
    "trabalho": <score>,
    "tarefas": <score>
  },
  "insights": [<3 insights curtos em português>]
}

Calcule apenas as áreas que tiverem dados. Para áreas sem dados retorne 50 como score neutro.

Dados: ${JSON.stringify(allData)}`,
      },
    ],
  })

  const text = getTextFromContent(response.content) || '{}'
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { total: 50, scores: {}, insights: [] }
  } catch {
    return { total: 50, scores: {}, insights: [] }
  }
}
