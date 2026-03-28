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
    description: 'Cria uma tarefa de rotina na aba Rotina do CEO',
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
    description: 'Atualiza status, prioridade ou prazo de uma tarefa de rotina',
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
    description: 'Remove uma tarefa de rotina',
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
  {
    name: 'create_gtd_task',
    description: 'Cria uma tarefa GTD na caixa de Tarefas do CEO',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Titulo da tarefa' },
        description: { type: 'string', description: 'Descricao opcional' },
        bucket: {
          type: 'string',
          enum: ['INBOX', 'TODAY', 'THIS_WEEK', 'SOMEDAY', 'WAITING', 'REFERENCE'],
          description: 'Bucket GTD. Padrao: INBOX.',
        },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Prioridade. Padrao: MEDIUM.' },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
        context: { type: 'string', description: 'Contexto como @trabalho, @casa, @faculdade' },
        energy: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], description: 'Energia necessaria' },
        estimatedMin: { type: 'number', description: 'Estimativa em minutos' },
        projectRef: { type: 'string', description: 'Referencia livre de projeto' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_gtd_task',
    description: 'Atualiza uma tarefa GTD existente',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da tarefa GTD' },
        title: { type: 'string' },
        description: { type: 'string' },
        bucket: { type: 'string', enum: ['INBOX', 'TODAY', 'THIS_WEEK', 'SOMEDAY', 'WAITING', 'REFERENCE'] },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
        context: { type: 'string' },
        energy: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
        estimatedMin: { type: 'number' },
        projectRef: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_gtd_task',
    description: 'Remove uma tarefa GTD',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da tarefa GTD' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_project_task',
    description: 'Cria uma tarefa de projeto/kanban na area de Trabalho',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Titulo da tarefa' },
        description: { type: 'string', description: 'Descricao opcional' },
        projectId: { type: 'string', description: 'ID do projeto. Opcional.' },
        projectName: { type: 'string', description: 'Nome do projeto. Opcional; use quando nao souber o ID.' },
        status: { type: 'string', enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'], description: 'Status kanban. Padrao: BACKLOG.' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Prioridade. Padrao: MEDIUM.' },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
        estimatedMin: { type: 'number', description: 'Estimativa em minutos' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_project_task',
    description: 'Atualiza uma tarefa de projeto/kanban',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da tarefa de projeto' },
        title: { type: 'string' },
        description: { type: 'string' },
        projectId: { type: 'string' },
        projectName: { type: 'string', description: 'Nome do projeto para localizar o vinculo' },
        status: { type: 'string', enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
        estimatedMin: { type: 'number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_project_task',
    description: 'Remove uma tarefa de projeto/kanban',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID da tarefa de projeto' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_assignment',
    description: 'Cria um trabalho academico na area de Faculdade',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Titulo do trabalho, prova ou entrega' },
        description: { type: 'string', description: 'Descricao opcional' },
        subjectId: { type: 'string', description: 'ID da disciplina. Opcional.' },
        subjectName: { type: 'string', description: 'Nome da disciplina. Opcional; use quando nao souber o ID.' },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'GRADED', 'OVERDUE'], description: 'Status. Padrao: PENDING.' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Prioridade. Padrao: MEDIUM.' },
        grade: { type: 'number', description: 'Nota, se ja existir' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_assignment',
    description: 'Atualiza um trabalho academico existente',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do trabalho academico' },
        title: { type: 'string' },
        description: { type: 'string' },
        subjectId: { type: 'string' },
        subjectName: { type: 'string', description: 'Nome da disciplina para localizar o vinculo' },
        dueDate: { type: 'string', description: 'Prazo ISO 8601' },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'GRADED', 'OVERDUE'] },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        grade: { type: 'number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_assignment',
    description: 'Remove um trabalho academico',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID do trabalho academico' },
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

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== ''
}

function toNullableNumber(value: unknown) {
  if (!hasValue(value)) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function hasOwnKey(input: ToolInput, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key)
}

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

async function assertEntityOwnership(userId: string, entity: string, id: string) {
  if (!hasValue(id)) throw new Error(`ID invalido para ${entity}.`)

  let record: { id: string } | null = null

  switch (entity) {
    case 'transaction':
      record = await prisma.transaction.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'budget':
      record = await prisma.budget.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'goal':
      record = await prisma.goal.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'keyResult':
      record = await prisma.keyResult.findFirst({ where: { id, goal: { userId } }, select: { id: true } })
      break
    case 'habit':
      record = await prisma.habit.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'task':
      record = await prisma.task.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'gtdTask':
      record = await prisma.gtdTask.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'project':
      record = await prisma.project.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'projectTask':
      record = await prisma.projectTask.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'subject':
      record = await prisma.subject.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'assignment':
      record = await prisma.assignment.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'contact':
      record = await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'commitment':
      record = await prisma.commitment.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'book':
      record = await prisma.book.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'course':
      record = await prisma.course.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'skill':
      record = await prisma.skill.findFirst({ where: { id, userId }, select: { id: true } })
      break
    case 'diaryEntry':
      record = await prisma.diaryEntry.findFirst({ where: { id, userId }, select: { id: true } })
      break
    default:
      throw new Error(`Entidade nao suportada: ${entity}`)
  }

  if (!record) throw new Error(`${entity} nao encontrado para este usuario.`)
}

async function resolveProjectId(userId: string, input: ToolInput): Promise<string | null | undefined> {
  if (hasOwnKey(input, 'projectId')) {
    if (!hasValue(input.projectId)) return null

    const projectId = String(input.projectId)
    await assertEntityOwnership(userId, 'project', projectId)
    return projectId
  }

  if (!hasOwnKey(input, 'projectName')) return undefined
  if (!hasValue(input.projectName)) return null

  const target = normalizeLookupValue(String(input.projectName))
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, name: true },
  })

  const exactMatches = projects.filter((project) => normalizeLookupValue(project.name) === target)
  if (exactMatches.length === 1) return exactMatches[0].id
  if (exactMatches.length > 1) throw new Error(`Projeto "${input.projectName}" esta ambiguo. Use o ID do projeto.`)

  const partialMatches = projects.filter((project) => normalizeLookupValue(project.name).includes(target))
  if (partialMatches.length === 1) return partialMatches[0].id
  if (partialMatches.length > 1) throw new Error(`Projeto "${input.projectName}" esta ambiguo. Use o ID do projeto.`)

  throw new Error(`Projeto "${input.projectName}" nao foi encontrado.`)
}

async function resolveSubjectId(userId: string, input: ToolInput): Promise<string | null | undefined> {
  if (hasOwnKey(input, 'subjectId')) {
    if (!hasValue(input.subjectId)) return null

    const subjectId = String(input.subjectId)
    await assertEntityOwnership(userId, 'subject', subjectId)
    return subjectId
  }

  if (!hasOwnKey(input, 'subjectName')) return undefined
  if (!hasValue(input.subjectName)) return null

  const target = normalizeLookupValue(String(input.subjectName))
  const subjects = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, name: true },
  })

  const exactMatches = subjects.filter((subject) => normalizeLookupValue(subject.name) === target)
  if (exactMatches.length === 1) return exactMatches[0].id
  if (exactMatches.length > 1) throw new Error(`Disciplina "${input.subjectName}" esta ambigua. Use o ID da disciplina.`)

  const partialMatches = subjects.filter((subject) => normalizeLookupValue(subject.name).includes(target))
  if (partialMatches.length === 1) return partialMatches[0].id
  if (partialMatches.length > 1) throw new Error(`Disciplina "${input.subjectName}" esta ambigua. Use o ID da disciplina.`)

  throw new Error(`Disciplina "${input.subjectName}" nao foi encontrada.`)
}

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
        await assertEntityOwnership(userId, 'transaction', id)
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
        await assertEntityOwnership(userId, 'transaction', input.id)
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
        await assertEntityOwnership(userId, 'budget', id)
        await prisma.budget.update({ where: { id }, data: rest })
        return JSON.stringify({ success: true, message: 'Orçamento atualizado' })
      }

      case 'delete_budget': {
        await assertEntityOwnership(userId, 'budget', input.id)
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
        await assertEntityOwnership(userId, 'goal', id)
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
        await assertEntityOwnership(userId, 'goal', input.id)
        await prisma.goal.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Meta removida' })
      }

      case 'create_key_result': {
        await assertEntityOwnership(userId, 'goal', input.goalId)
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
        await assertEntityOwnership(userId, 'keyResult', id)
        await prisma.keyResult.update({ where: { id }, data: rest })
        return JSON.stringify({ success: true, message: 'Key Result atualizado' })
      }

      case 'delete_key_result': {
        await assertEntityOwnership(userId, 'keyResult', input.id)
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
        await assertEntityOwnership(userId, 'habit', id)
        await prisma.habit.update({ where: { id }, data: rest })
        return JSON.stringify({ success: true, message: 'Hábito atualizado' })
      }

      case 'delete_habit': {
        await assertEntityOwnership(userId, 'habit', input.id)
        await prisma.habit.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Hábito removido' })
      }

      case 'log_habit': {
        await assertEntityOwnership(userId, 'habit', input.habitId)
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
        await assertEntityOwnership(userId, 'task', id)
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
        await assertEntityOwnership(userId, 'task', input.id)
        await prisma.task.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Tarefa removida' })
      }

      case 'create_gtd_task': {
        const record = await prisma.gtdTask.create({
          data: {
            userId,
            title: input.title,
            description: input.description ?? null,
            bucket: input.bucket ?? 'INBOX',
            status: input.status ?? 'PENDING',
            priority: input.priority ?? 'MEDIUM',
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            context: input.context ?? null,
            energy: input.energy ?? null,
            estimatedMin: toNullableNumber(input.estimatedMin),
            projectRef: input.projectRef ?? null,
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Tarefa GTD criada: "${input.title}"` })
      }

      case 'update_gtd_task': {
        const { id, dueDate, estimatedMin, ...rest } = input
        await assertEntityOwnership(userId, 'gtdTask', id)
        await prisma.gtdTask.update({
          where: { id },
          data: {
            ...rest,
            ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
            ...(estimatedMin !== undefined && { estimatedMin: toNullableNumber(estimatedMin) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Tarefa GTD atualizada' })
      }

      case 'delete_gtd_task': {
        await assertEntityOwnership(userId, 'gtdTask', input.id)
        await prisma.gtdTask.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Tarefa GTD removida' })
      }

      case 'create_project_task': {
        const projectId = await resolveProjectId(userId, input)
        const record = await prisma.projectTask.create({
          data: {
            userId,
            title: input.title,
            description: input.description ?? null,
            projectId: projectId ?? null,
            status: input.status ?? 'BACKLOG',
            priority: input.priority ?? 'MEDIUM',
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            estimatedMin: toNullableNumber(input.estimatedMin),
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Tarefa de projeto criada: "${input.title}"` })
      }

      case 'update_project_task': {
        const { id, dueDate, estimatedMin, projectId: _projectId, projectName: _projectName, ...rest } = input
        await assertEntityOwnership(userId, 'projectTask', id)
        const projectId = await resolveProjectId(userId, input)
        await prisma.projectTask.update({
          where: { id },
          data: {
            ...rest,
            ...(projectId !== undefined && { projectId }),
            ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
            ...(estimatedMin !== undefined && { estimatedMin: toNullableNumber(estimatedMin) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Tarefa de projeto atualizada' })
      }

      case 'delete_project_task': {
        await assertEntityOwnership(userId, 'projectTask', input.id)
        await prisma.projectTask.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Tarefa de projeto removida' })
      }

      case 'create_assignment': {
        const subjectId = await resolveSubjectId(userId, input)
        const record = await prisma.assignment.create({
          data: {
            userId,
            title: input.title,
            description: input.description ?? null,
            subjectId: subjectId ?? null,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            status: input.status ?? 'PENDING',
            priority: input.priority ?? 'MEDIUM',
            grade: toNullableNumber(input.grade),
          },
        })
        return JSON.stringify({ success: true, id: record.id, message: `Trabalho academico criado: "${input.title}"` })
      }

      case 'update_assignment': {
        const { id, dueDate, grade, subjectId: _subjectId, subjectName: _subjectName, ...rest } = input
        await assertEntityOwnership(userId, 'assignment', id)
        const subjectId = await resolveSubjectId(userId, input)
        await prisma.assignment.update({
          where: { id },
          data: {
            ...rest,
            ...(subjectId !== undefined && { subjectId }),
            ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
            ...(grade !== undefined && { grade: toNullableNumber(grade) }),
          },
        })
        return JSON.stringify({ success: true, message: 'Trabalho academico atualizado' })
      }

      case 'delete_assignment': {
        await assertEntityOwnership(userId, 'assignment', input.id)
        await prisma.assignment.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Trabalho academico removido' })
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
        await assertEntityOwnership(userId, 'contact', id)
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
        await assertEntityOwnership(userId, 'contact', input.id)
        await prisma.contact.delete({ where: { id: input.id } })
        return JSON.stringify({ success: true, message: 'Contato removido' })
      }

      case 'log_interaction': {
        await assertEntityOwnership(userId, 'contact', input.contactId)
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
        await assertEntityOwnership(userId, 'contact', input.contactId)
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
        await assertEntityOwnership(userId, 'commitment', id)
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
        await assertEntityOwnership(userId, 'commitment', input.id)
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
        await assertEntityOwnership(userId, 'book', id)
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
        await assertEntityOwnership(userId, 'book', input.id)
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
        await assertEntityOwnership(userId, 'course', id)
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
        await assertEntityOwnership(userId, 'course', input.id)
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
        await assertEntityOwnership(userId, 'skill', id)
        await prisma.skill.update({ where: { id }, data: rest })
        return JSON.stringify({ success: true, message: 'Habilidade atualizada' })
      }

      case 'delete_skill': {
        await assertEntityOwnership(userId, 'skill', input.id)
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
        await assertEntityOwnership(userId, 'diaryEntry', id)
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
        await assertEntityOwnership(userId, 'diaryEntry', input.id)
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
