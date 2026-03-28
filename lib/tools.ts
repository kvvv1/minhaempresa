import { prisma } from './prisma'

// ============================================================
// DEFINIÇÕES DAS TOOLS (formato Anthropic)
// ============================================================

export const ALL_TOOLS = [
  // ── TRANSAÇÕES ──────────────────────────────────────────
  {
    name: 'create_transaction',
    description: 'Cria uma transação financeira (receita ou despesa) para o CEO',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'], description: 'INCOME = receita, EXPENSE = despesa' },
        amount: { type: 'number', description: 'Valor em reais (positivo)' },
        description: { type: 'string', description: 'Descrição da transação' },
        category: { type: 'string', description: 'Categoria (ex: alimentação, transporte, salário, farmácia)' },
        date: { type: 'string', description: 'Data ISO 8601. Omitir = hoje.' },
        isRecurring: { type: 'boolean', description: 'Se é recorrente mensal' },
        recurringDay: { type: 'number', description: 'Dia do mês para recorrência (1-31)' },
      },
      required: ['type', 'amount', 'description', 'category'],
    },
  },
  {
    name: 'update_transaction',
    description: 'Atualiza uma transação financeira existente pelo ID',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da transação' },
        amount: { type: 'number' },
        description: { type: 'string' },
        category: { type: 'string' },
        date: { type: 'string', description: 'Data ISO 8601' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_transaction',
    description: 'Remove uma transação financeira pelo ID',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da transação' },
      },
      required: ['id'],
    },
  },

  // ── ORÇAMENTOS ──────────────────────────────────────────
  {
    name: 'create_budget',
    description: 'Cria um orçamento mensal para uma categoria de gastos',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nome do orçamento' },
        category: { type: 'string', description: 'Categoria' },
        limit: { type: 'number', description: 'Limite em reais' },
        month: { type: 'number', description: 'Mês 1-12. Omitir = mês atual.' },
        year: { type: 'number', description: 'Ano. Omitir = ano atual.' },
      },
      required: ['name', 'category', 'limit'],
    },
  },
  {
    name: 'update_budget',
    description: 'Atualiza um orçamento existente',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do orçamento' },
        name: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_budget',
    description: 'Remove um orçamento',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do orçamento' },
      },
      required: ['id'],
    },
  },

  // ── METAS / OKRs ────────────────────────────────────────
  {
    name: 'create_goal',
    description: 'Cria uma meta/objetivo para o CEO',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Título da meta' },
        description: { type: 'string', description: 'Descrição detalhada' },
        category: {
          type: 'string',
          enum: ['FINANCIAL', 'PERSONAL', 'PROFESSIONAL', 'HEALTH', 'RELATIONSHIPS', 'LEARNING'],
          description: 'Categoria da meta',
        },
        targetDate: { type: 'string', description: 'Data alvo ISO 8601' },
        quarter: { type: 'number', description: 'Trimestre 1-4' },
        year: { type: 'number', description: 'Ano. Omitir = ano atual.' },
      },
      required: ['title', 'category'],
    },
  },
  {
    name: 'update_goal',
    description: 'Atualiza uma meta existente (status, progresso, título, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da meta' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED'] },
        progress: { type: 'number', description: 'Progresso 0-100' },
        targetDate: { type: 'string', description: 'Data alvo ISO 8601' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_goal',
    description: 'Remove uma meta',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da meta' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_key_result',
    description: 'Cria um Key Result (KR) dentro de uma meta',
    input_schema: {
      type: 'object' as const,
      properties: {
        goalId: { type: 'string', description: 'ID da meta pai' },
        title: { type: 'string', description: 'Título do KR' },
        target: { type: 'number', description: 'Valor alvo (ex: 100). Padrão: 100.' },
        unit: { type: 'string', description: 'Unidade (ex: %, R$, km, livros, kg)' },
      },
      required: ['goalId', 'title'],
    },
  },
  {
    name: 'update_key_result',
    description: 'Atualiza o progresso ou detalhes de um Key Result',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do Key Result' },
        progress: { type: 'number', description: 'Progresso atual' },
        title: { type: 'string' },
        target: { type: 'number' },
        unit: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_key_result',
    description: 'Remove um Key Result',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do Key Result' },
      },
      required: ['id'],
    },
  },

  // ── HÁBITOS ─────────────────────────────────────────────
  {
    name: 'create_habit',
    description: 'Cria um novo hábito para o CEO acompanhar',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nome do hábito' },
        description: { type: 'string', description: 'Descrição opcional' },
        frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'], description: 'Frequência' },
        targetDays: {
          type: 'array',
          items: { type: 'number' },
          description: 'Para hábitos semanais: dias da semana (0=dom, 1=seg, ..., 6=sab)',
        },
      },
      required: ['name', 'frequency'],
    },
  },
  {
    name: 'update_habit',
    description: 'Atualiza um hábito existente',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do hábito' },
        name: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean', description: 'Ativar/desativar hábito' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_habit',
    description: 'Remove um hábito permanentemente',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do hábito' },
      },
      required: ['id'],
    },
  },
  {
    name: 'log_habit',
    description: 'Registra a conclusão (ou não) de um hábito em uma data',
    input_schema: {
      type: 'object' as const,
      properties: {
        habitId: { type: 'string', description: 'ID do hábito' },
        date: { type: 'string', description: 'Data ISO 8601. Omitir = hoje.' },
        completed: { type: 'boolean', description: 'true = concluído, false = não concluído. Padrão: true.' },
        note: { type: 'string', description: 'Observação opcional' },
      },
      required: ['habitId'],
    },
  },

  // ── TAREFAS ─────────────────────────────────────────────
  {
    name: 'create_task',
    description: 'Cria uma nova tarefa para o CEO',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Título da tarefa' },
        description: { type: 'string', description: 'Descrição opcional' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Prioridade. Padrão: MEDIUM.' },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Atualiza status, prioridade ou prazo de uma tarefa',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da tarefa' },
        title: { type: 'string' },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Remove uma tarefa',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da tarefa' },
      },
      required: ['id'],
    },
  },

  // ── CONTATOS / RELACIONAMENTOS ───────────────────────────
  {
    name: 'create_contact',
    description: 'Adiciona um novo contato ao CRM pessoal do CEO',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nome do contato' },
        relationship: { type: 'string', description: 'Tipo: amigo, familiar, colega, cliente, mentor, etc.' },
        email: { type: 'string', description: 'Email' },
        phone: { type: 'string', description: 'Telefone' },
        notes: { type: 'string', description: 'Observações' },
        followUpDays: { type: 'number', description: 'Dias para próximo follow-up. Padrão: 30.' },
      },
      required: ['name', 'relationship'],
    },
  },
  {
    name: 'update_contact',
    description: 'Atualiza informações de um contato',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do contato' },
        name: { type: 'string' },
        relationship: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        notes: { type: 'string' },
        followUpDays: { type: 'number' },
        lastContact: { type: 'string', description: 'Data do último contato ISO 8601' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_contact',
    description: 'Remove um contato do CRM',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do contato' },
      },
      required: ['id'],
    },
  },
  {
    name: 'log_interaction',
    description: 'Registra uma interação com um contato (reunião, ligação, mensagem, almoço, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: { type: 'string', description: 'ID do contato' },
        type: { type: 'string', description: 'Tipo: reunião, ligação, mensagem, almoço, evento, etc.' },
        notes: { type: 'string', description: 'O que foi discutido ou aconteceu' },
        date: { type: 'string', description: 'Data ISO 8601. Omitir = hoje.' },
      },
      required: ['contactId', 'type'],
    },
  },
  {
    name: 'create_commitment',
    description: 'Cria um compromisso ou promessa feita a um contato',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: { type: 'string', description: 'ID do contato' },
        description: { type: 'string', description: 'O que foi prometido ou comprometido' },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
      },
      required: ['contactId', 'description'],
    },
  },
  {
    name: 'update_commitment',
    description: 'Atualiza o status de um compromisso (cumprir, cancelar, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do compromisso' },
        status: { type: 'string', enum: ['PENDING', 'FULFILLED', 'OVERDUE'] },
        description: { type: 'string' },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_commitment',
    description: 'Remove um compromisso',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do compromisso' },
      },
      required: ['id'],
    },
  },

  // ── LIVROS ──────────────────────────────────────────────
  {
    name: 'create_book',
    description: 'Adiciona um livro à biblioteca do CEO',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Título do livro' },
        author: { type: 'string', description: 'Autor' },
        status: { type: 'string', enum: ['WANT_TO_READ', 'READING', 'COMPLETED', 'ABANDONED'], description: 'Status. Padrão: WANT_TO_READ.' },
        notes: { type: 'string', description: 'Notas ou resumo' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_book',
    description: 'Atualiza status, avaliação ou notas de um livro',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do livro' },
        status: { type: 'string', enum: ['WANT_TO_READ', 'READING', 'COMPLETED', 'ABANDONED'] },
        rating: { type: 'number', description: 'Avaliação 1-5' },
        notes: { type: 'string' },
        startedAt: { type: 'string', description: 'Data de início ISO 8601' },
        finishedAt: { type: 'string', description: 'Data de conclusão ISO 8601' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_book',
    description: 'Remove um livro da biblioteca',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do livro' },
      },
      required: ['id'],
    },
  },

  // ── CURSOS ──────────────────────────────────────────────
  {
    name: 'create_course',
    description: 'Adiciona um curso ao plano de desenvolvimento do CEO',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Título do curso' },
        platform: { type: 'string', description: 'Plataforma: Udemy, Coursera, YouTube, etc.' },
        status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED'], description: 'Status. Padrão: NOT_STARTED.' },
        notes: { type: 'string', description: 'Notas' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_course',
    description: 'Atualiza progresso ou status de um curso',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do curso' },
        status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED'] },
        progress: { type: 'number', description: 'Progresso 0-100' },
        notes: { type: 'string' },
        startedAt: { type: 'string', description: 'Data de início ISO 8601' },
        completedAt: { type: 'string', description: 'Data de conclusão ISO 8601' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_course',
    description: 'Remove um curso',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do curso' },
      },
      required: ['id'],
    },
  },

  // ── HABILIDADES ─────────────────────────────────────────
  {
    name: 'create_skill',
    description: 'Adiciona uma habilidade ao inventário do CEO',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nome da habilidade' },
        category: { type: 'string', description: 'Categoria: tecnologia, liderança, comunicação, finanças, etc.' },
        level: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'], description: 'Nível atual. Padrão: BEGINNER.' },
        targetLevel: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'], description: 'Nível alvo. Padrão: ADVANCED.' },
        notes: { type: 'string', description: 'Observações' },
      },
      required: ['name', 'category'],
    },
  },
  {
    name: 'update_skill',
    description: 'Atualiza o nível de uma habilidade',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da habilidade' },
        level: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] },
        targetLevel: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] },
        notes: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_skill',
    description: 'Remove uma habilidade do inventário',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da habilidade' },
      },
      required: ['id'],
    },
  },

  // ── DIÁRIO ──────────────────────────────────────────────
  {
    name: 'create_diary_entry',
    description: 'Cria uma entrada no diário pessoal do CEO',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'Conteúdo da entrada' },
        mood: { type: 'number', description: 'Humor de 1 (péssimo) a 10 (excelente)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags para categorizar a entrada' },
        date: { type: 'string', description: 'Data ISO 8601. Omitir = hoje.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_diary_entry',
    description: 'Atualiza uma entrada do diário',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da entrada' },
        content: { type: 'string' },
        mood: { type: 'number', description: 'Humor 1-10' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_diary_entry',
    description: 'Remove uma entrada do diário',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da entrada' },
      },
      required: ['id'],
    },
  },
]

// Todos os funcionários têm acesso a TODAS as tools.
// A personalidade e o papel guiam o que cada um naturalmente faz.
// O Chief of Staff é explicitamente o "fallback universal".
export function getToolsForRole(_role: string) {
  return ALL_TOOLS
}

// ============================================================
// EXECUTORES DAS TOOLS
// ============================================================

type ToolInput = Record<string, any>

export async function executeTool(toolName: string, input: ToolInput, userId: string): Promise<string> {
  try {
    switch (toolName) {

      // ── TRANSAÇÕES ────────────────────────────────────────
      case 'create_transaction': {
        const record = await prisma.transaction.create({
          data: {
            userId,
            type: input.type,
            amount: Number(input.amount),
            description: input.description,
            category: input.category,
            date: input.date ? new Date(input.date) : new Date(),
            isRecurring: input.isRecurring ?? false,
            recurringDay: input.recurringDay ?? null,
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Transação registrada: ${input.description} — R$${input.amount}` })
      }

      case 'update_transaction': {
        const { id, date, ...rest } = input
        await prisma.transaction.update({
          where: { id },
          data: {
            ...rest,
            ...(date && { date: new Date(date) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Transação atualizada com sucesso' })
      }

      case 'delete_transaction': {
        await prisma.transaction.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Transação removida com sucesso' })
      }

      // ── ORÇAMENTOS ────────────────────────────────────────
      case 'create_budget': {
        const now = new Date()
        const record = await prisma.budget.create({
          data: {
            userId,
            name: input.name,
            category: input.category,
            limit: Number(input.limit),
            month: input.month ?? (now.getMonth() + 1),
            year: input.year ?? now.getFullYear(),
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Orçamento criado: ${input.name} — limite R$${input.limit}` })
      }

      case 'update_budget': {
        const { id, ...rest } = input
        await prisma.budget.update({ where: { id }, data: rest })
        return JSON.stringify({ success: true, message: 'Orçamento atualizado' })
      }

      case 'delete_budget': {
        await prisma.budget.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Orçamento removido' })
      }

      // ── METAS ─────────────────────────────────────────────
      case 'create_goal': {
        const record = await prisma.goal.create({
          data: {
            userId,
            title: input.title,
            description: input.description ?? null,
            category: input.category,
            targetDate: input.targetDate ? new Date(input.targetDate) : null,
            quarter: input.quarter ?? null,
            year: input.year ?? new Date().getFullYear(),
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Meta criada: "${input.title}"` })
      }

      case 'update_goal': {
        const { id, targetDate, ...rest } = input
        await prisma.goal.update({
          where: { id },
          data: {
            ...rest,
            ...(targetDate && { targetDate: new Date(targetDate) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Meta atualizada' })
      }

      case 'delete_goal': {
        await prisma.goal.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Meta removida' })
      }

      case 'create_key_result': {
        const record = await prisma.keyResult.create({
          data: {
            goalId: input.goalId,
            title: input.title,
            target: input.target ?? 100,
            unit: input.unit ?? null,
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Key Result criado: "${input.title}"` })
      }

      case 'update_key_result': {
        const { id, ...rest } = input
        await prisma.keyResult.update({ where: { id }, data: rest })
        return JSON.stringify({ success: true, message: 'Key Result atualizado' })
      }

      case 'delete_key_result': {
        await prisma.keyResult.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Key Result removido' })
      }

      // ── HÁBITOS ───────────────────────────────────────────
      case 'create_habit': {
        const record = await prisma.habit.create({
          data: {
            userId,
            name: input.name,
            description: input.description ?? null,
            frequency: input.frequency,
            targetDays: JSON.stringify(input.targetDays ?? []),
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Hábito criado: "${input.name}" (${input.frequency})` })
      }

      case 'update_habit': {
        const { id, ...rest } = input
        await prisma.habit.update({ where: { id }, data: rest })
        return JSON.stringify({ success: true, message: 'Hábito atualizado' })
      }

      case 'delete_habit': {
        await prisma.habit.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Hábito removido' })
      }

      case 'log_habit': {
        const record = await prisma.habitLog.create({
          data: {
            habitId: input.habitId,
            userId,
            date: input.date ? new Date(input.date) : new Date(),
            completed: input.completed ?? true,
            note: input.note ?? null,
          },
        })
        const status = input.completed === false ? 'não concluído' : 'concluído'
        return JSON.stringify({ success: true, id: record.id, message: `Hábito registrado como ${status}` })
      }

      // ── TAREFAS ───────────────────────────────────────────
      case 'create_task': {
        const record = await prisma.task.create({
          data: {
            userId,
            title: input.title,
            description: input.description ?? null,
            priority: input.priority ?? 'MEDIUM',
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Tarefa criada: "${input.title}"` })
      }

      case 'update_task': {
        const { id, dueDate, ...rest } = input
        await prisma.task.update({
          where: { id },
          data: {
            ...rest,
            ...(dueDate && { dueDate: new Date(dueDate) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Tarefa atualizada' })
      }

      case 'delete_task': {
        await prisma.task.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Tarefa removida' })
      }

      // ── CONTATOS ──────────────────────────────────────────
      case 'create_contact': {
        const record = await prisma.contact.create({
          data: {
            userId,
            name: input.name,
            relationship: input.relationship,
            email: input.email ?? null,
            phone: input.phone ?? null,
            notes: input.notes ?? null,
            followUpDays: input.followUpDays ?? 30,
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Contato adicionado: "${input.name}"` })
      }

      case 'update_contact': {
        const { id, lastContact, ...rest } = input
        await prisma.contact.update({
          where: { id },
          data: {
            ...rest,
            ...(lastContact && { lastContact: new Date(lastContact) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Contato atualizado' })
      }

      case 'delete_contact': {
        await prisma.contact.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Contato removido' })
      }

      case 'log_interaction': {
        const record = await prisma.interaction.create({
          data: {
            contactId: input.contactId,
            userId,
            type: input.type,
            notes: input.notes ?? null,
            date: input.date ? new Date(input.date) : new Date(),
          },
        })
        await prisma.contact.update({
          where: { id: input.contactId },
          data: { lastContact: new Date() },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Interação registrada: ${input.type}` })
      }

      case 'create_commitment': {
        const record = await prisma.commitment.create({
          data: {
            contactId: input.contactId,
            userId,
            description: input.description,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Compromisso criado: "${input.description}"` })
      }

      case 'update_commitment': {
        const { id, dueDate, ...rest } = input
        await prisma.commitment.update({
          where: { id },
          data: {
            ...rest,
            ...(dueDate && { dueDate: new Date(dueDate) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Compromisso atualizado' })
      }

      case 'delete_commitment': {
        await prisma.commitment.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Compromisso removido' })
      }

      // ── LIVROS ────────────────────────────────────────────
      case 'create_book': {
        const record = await prisma.book.create({
          data: {
            userId,
            title: input.title,
            author: input.author ?? null,
            status: input.status ?? 'WANT_TO_READ',
            notes: input.notes ?? null,
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Livro adicionado: "${input.title}"` })
      }

      case 'update_book': {
        const { id, startedAt, finishedAt, ...rest } = input
        await prisma.book.update({
          where: { id },
          data: {
            ...rest,
            ...(startedAt && { startedAt: new Date(startedAt) }),
            ...(finishedAt && { finishedAt: new Date(finishedAt) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Livro atualizado' })
      }

      case 'delete_book': {
        await prisma.book.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Livro removido' })
      }

      // ── CURSOS ────────────────────────────────────────────
      case 'create_course': {
        const record = await prisma.course.create({
          data: {
            userId,
            title: input.title,
            platform: input.platform ?? null,
            status: input.status ?? 'NOT_STARTED',
            notes: input.notes ?? null,
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Curso adicionado: "${input.title}"` })
      }

      case 'update_course': {
        const { id, startedAt, completedAt, ...rest } = input
        await prisma.course.update({
          where: { id },
          data: {
            ...rest,
            ...(startedAt && { startedAt: new Date(startedAt) }),
            ...(completedAt && { completedAt: new Date(completedAt) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Curso atualizado' })
      }

      case 'delete_course': {
        await prisma.course.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Curso removido' })
      }

      // ── HABILIDADES ───────────────────────────────────────
      case 'create_skill': {
        const record = await prisma.skill.create({
          data: {
            userId,
            name: input.name,
            category: input.category,
            level: input.level ?? 'BEGINNER',
            targetLevel: input.targetLevel ?? 'ADVANCED',
            notes: input.notes ?? null,
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Habilidade adicionada: "${input.name}"` })
      }

      case 'update_skill': {
        const { id, ...rest } = input
        await prisma.skill.update({ where: { id }, data: rest })
        return JSON.stringify({ success: true, message: 'Habilidade atualizada' })
      }

      case 'delete_skill': {
        await prisma.skill.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Habilidade removida' })
      }

      // ── DIÁRIO ────────────────────────────────────────────
      case 'create_diary_entry': {
        const record = await prisma.diaryEntry.create({
          data: {
            userId,
            content: input.content,
            mood: input.mood ?? null,
            tags: JSON.stringify(input.tags ?? []),
            date: input.date ? new Date(input.date) : new Date(),
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: 'Entrada de diário criada' })
      }

      case 'update_diary_entry': {
        const { id, tags, ...rest } = input
        await prisma.diaryEntry.update({
          where: { id },
          data: {
            ...rest,
            ...(tags !== undefined && { tags: JSON.stringify(tags) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Entrada de diário atualizada' })
      }

      case 'delete_diary_entry': {
        await prisma.diaryEntry.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Entrada de diário removida' })
      }

      default:
        return JSON.stringify({ success: false, error: `Tool desconhecida: ${toolName}` })
    }
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error?.message ?? 'Erro ao executar a ação no sistema',
    })
  }
}
