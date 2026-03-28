# HANDOFF

Este documento serve para transferir o contexto deste trabalho para o Codex rodando no terminal.

Use este handoff como ponto de partida oficial para continuar a implementacao no repo `vida-sa`.

## Como iniciar no terminal

Na raiz do projeto, rode o Codex CLI e use um prompt como:

```text
Leia AGENTS.md e HANDOFF.md. Entenda o estado atual da Central Operacional em vida-sa, confirme o que ja foi implementado e continue a Fase 2 sem reverter alteracoes locais de outros arquivos.
```

Ou, de forma mais direta:

```text
Leia HANDOFF.md e implemente a Fase 2.
```

## Regras de trabalho

Antes de editar qualquer coisa:

1. Leia `AGENTS.md`.
2. Nao reverta alteracoes locais que nao sejam suas.
3. Assuma que o worktree esta sujo e que existem mudancas paralelas do usuario.
4. Foque no escopo da Central Operacional.
5. Preserve o que ja foi feito na Fase 1.

## Objetivo do produto

O projeto esta evoluindo para que `Tarefas` deixe de ser apenas um modulo GTD e vire a `Central Operacional` do app.

Ideia central:

- `Tarefas` deve ser a camada principal de execucao.
- O calendario nao deve existir como silo separado.
- `Rotina`, `Trabalho`, `Faculdade` e outros modulos continuam existindo, mas como contextos/origens.
- A dashboard precisa mostrar o dia operacional do usuario.
- A experiencia desejada e inspirada em apps como TickTick:
  - Inbox
  - Hoje
  - Semana
  - Mes
  - Agenda 24h
  - itens conectados entre modulos

## Decisao de arquitetura

Nao unificar tudo no banco ainda.

Abordagem escolhida:

- criar uma camada agregadora de leitura
- manter os modelos atuais intactos por enquanto
- usar uma rota de planner para consolidar os dados
- transformar `/tarefas` em Central Operacional primeiro
- so numa fase posterior introduzir uma entidade de banco unificada para planejamento

## Modelos atuais relevantes

O sistema hoje esta fragmentado nestas entidades:

- `Task` para rotina
- `GtdTask` para GTD pessoal
- `ProjectTask` para trabalho
- `Assignment` para faculdade
- `CalendarEvent` para calendario
- `Meeting` para reunioes
- `Habit` e `HabitLog` para habitos

Arquivo principal do schema:

- `prisma/schema.prisma`

## O que a Fase 1 ja implementou

### 1. Rota agregadora nova

Foi criada:

- `app/api/planner/route.ts`

Ela agrega dados de:

- GTD
- tarefas da rotina
- tarefas de trabalho
- assignments da faculdade
- eventos de calendario
- reunioes
- habitos previstos no dia

Ela expõe:

- `scope=today`
- `scope=week`
- `scope=month`

Ela retorna:

- `summary`
- `items`
- `scheduledItems`
- `focusItems`
- `overdueItems`
- `habits`

### 2. Tipos e helpers compartilhados

Foi criado:

- `lib/planner.ts`

Esse arquivo contem:

- tipos do planner
- helpers de ordenacao
- regras de overdue
- configuracao visual de modulos e prioridade

### 3. Componentes reutilizaveis da Central Operacional

Foi criado:

- `components/planner/PlannerViews.tsx`

Esse arquivo contem:

- `PlannerSummaryCards`
- `PlannerTodayBoard`
- `PlannerWeekBoard`
- `PlannerMonthBoard`
- `PlannerTimelineCard`

### 4. Dashboard com "Meu Dia"

Foi alterado:

- `app/(dashboard)/dashboard/page.tsx`

Agora a dashboard mostra:

- bloco `Meu Dia`
- cards de resumo operacional
- agenda do dia
- tarefas em foco
- tarefas atrasadas
- habitos previstos

### 5. `/tarefas` virou a Central Operacional inicial

Foi alterado:

- `app/(dashboard)/tarefas/page.tsx`

Agora essa tela tem duas camadas:

1. `Planejamento`
   - Hoje
   - Semana
   - Mes
   - Agenda 24h

2. `Sistema GTD`
   - Captura
   - Inbox
   - Hoje
   - Esta Semana
   - Algum Dia
   - Aguardando

Tambem existe:

- revisao semanal
- fluxo GTD preservado
- integracao visual com os dados do planner

## Arquivos para ler primeiro

Ler nesta ordem:

1. `AGENTS.md`
2. `HANDOFF.md`
3. `app/api/planner/route.ts`
4. `lib/planner.ts`
5. `components/planner/PlannerViews.tsx`
6. `app/(dashboard)/tarefas/page.tsx`
7. `app/(dashboard)/dashboard/page.tsx`

Depois, se necessario, ler:

- `app/api/tarefas/route.ts`
- `app/api/tarefas/gtd/route.ts`
- `app/api/tarefas/gtd/[id]/route.ts`
- `app/api/tarefas/gtd/process/route.ts`
- `app/api/rotina/tasks/route.ts`
- `app/api/trabalho/tasks/route.ts`
- `app/api/trabalho/meetings/route.ts`
- `app/api/calendario/route.ts`
- `app/api/calendario/[id]/route.ts`
- `prisma/schema.prisma`

## Estado do worktree

O repositorio esta sujo.

Ha varias alteracoes locais fora do escopo imediato da Central Operacional.

Status observado durante esta sessao:

```text
 M app/(dashboard)/dashboard/page.tsx
MM app/(dashboard)/desenvolvimento/page.tsx
 M app/(dashboard)/diario/page.tsx
 M app/(dashboard)/faculdade/page.tsx
MM app/(dashboard)/financeiro/page.tsx
 M app/(dashboard)/metas/page.tsx
 M app/(dashboard)/nutricao/page.tsx
MM app/(dashboard)/relacionamentos/page.tsx
MM app/(dashboard)/rotina/page.tsx
 M app/(dashboard)/saude/page.tsx
 M app/(dashboard)/tarefas/page.tsx
 M app/(dashboard)/trabalho/page.tsx
M  app/api/employees/route.ts
 M app/api/notifications/route.ts
 M prisma/schema.prisma
?? app/api/calendario/
?? app/api/conversas/
?? app/api/financeiro/savings-goals/
?? app/api/planner/
?? app/api/rotina/heatmap/
?? app/api/saude/prs/
?? components/planner/
?? lib/planner.ts
?? scripts/
```

Consequencia:

- nao reverta mudancas em arquivos fora do escopo
- se precisar tocar em arquivo ja modificado, leia com cuidado antes
- priorize mudancas localizadas

## Limitacoes e observacoes do ambiente

### Validacao automatica

Houve tentativa de validacao com:

- `npm run build`
- lint pontual dos arquivos alterados

Problemas encontrados no ambiente:

1. `next build` demorou demais e estourou o timeout do terminal durante a sessao.
2. Em algumas execucoes do Node/ESLint houve erro:

```text
EPERM: operation not permitted, lstat 'C:\Users\DELL'
```

Interpretacao:

- isso parece ser uma peculiaridade do ambiente Windows atual
- nao assumir que o codigo esta validado completamente
- antes de fechar a proxima fase, tentar validar novamente no ambiente do terminal

### Suporte Windows

Se possivel, usar WSL para uma experiencia mais previsivel com o CLI e com validacao.

## Roadmap completo

O roadmap previsto agora e este:

1. `Fase 1: Central Operacional de leitura`
2. `Fase 2: Planejamento com escrita`
3. `Fase 3: Integracao real entre modulos`
4. `Fase 4: Modelo unificado de planejamento`
5. `Fase 5: Inteligencia e refinamento`

Importante:

- A Fase 1 ja foi implementada.
- A Fase 2 e a proxima a ser executada.
- Mas a Fase 2 precisa ser desenhada de forma compativel com as Fases 3, 4 e 5.

## Proxima fase: Fase 2

### Nome

`Planejamento com escrita`

### Objetivo

Transformar a Central Operacional de uma camada forte de leitura em uma ferramenta real de planejamento.

### O que precisa entregar

1. Permitir agendar itens em blocos de horario.
2. Permitir mover ou reajustar blocos da agenda.
3. Criar bloco manual de calendario pela Central Operacional.
4. Adicionar quick actions:
   - jogar para hoje
   - mover para semana
   - adiar
   - transformar tarefa em bloco agendado
5. Comecar a ligar mudancas da Central Operacional ao registro de origem, sem quebrar os modelos atuais.

### Abordagem recomendada

Nao criar `PlannerItem` no banco ainda.

Fazer primeiro uma camada de escrita incremental usando os modelos existentes:

- `GtdTask`
- `CalendarEvent`
- possivelmente `Task`, `ProjectTask`, `Assignment` em casos selecionados

### Escopo recomendado da Fase 2

Implementar em duas subetapas:

#### Fase 2A

Adicionar escrita via calendario/manual:

- criar evento manual na agenda
- criar bloco de horario para item GTD
- quick actions em itens GTD da Central Operacional

#### Fase 2B

Expandir para origens adicionais:

- tarefa de rotina
- tarefa de trabalho
- assignment da faculdade

## Sugerindo a implementacao da Fase 2

### Passo 1

Revisar se `CalendarEvent` precisa de mais campos ou se da para reutilizar como esta.

Hoje ele tem:

- `title`
- `description`
- `startAt`
- `endAt`
- `allDay`
- `module`

Provavelmente ainda faltam campos de ligacao com origem, por exemplo:

- `sourceType`
- `sourceId`

Mas antes de mudar schema, avaliar se da para comecar com uma estrategia leve:

- criar bloco via `CalendarEvent`
- embutir referencia no `description` ou em convencao interna apenas temporariamente

Se a solucao ficar feia, abrir uma pequena migracao controlada no schema.

### Passo 2

Na UI da Central Operacional:

- adicionar botao ou menu em cada item:
  - `Agendar`
  - `Adiar`
  - `Hoje`
  - `Semana`

### Passo 3

Criar uma interacao minima para agendamento:

- dialog simples com:
  - data
  - hora inicial
  - hora final ou duracao
  - all day

### Passo 4

Na agenda 24h:

- exibir blocos mais claramente
- permitir ao menos remarcacao por acao de UI, mesmo sem drag-and-drop total no primeiro momento

### Passo 5

Ao atualizar um item:

- se for GTD, atualizar `GtdTask`
- se for bloco manual, atualizar `CalendarEvent`
- se for item de outro modulo, decidir caso a caso se a fase atual so cria espelho no calendario ou se sincroniza tambem na origem

## Criticos de produto

Ao implementar a Fase 2, preservar estas decisoes:

1. `Tarefas` continua sendo a Central Operacional.
2. O calendario continua sendo uma visao dentro da Central Operacional.
3. Os outros modulos continuam sendo contextos especializados, nao substitutos da Central.
4. Nao introduzir um quarto silo.
5. Qualquer acao nova deve reforcar o fluxo principal, nao fragmentar.

## Fase 3

### Nome

`Integracao real entre modulos`

### Objetivo

Fazer com que a Central Operacional deixe de ser apenas uma camada de leitura e planejamento e passe a alterar tambem o registro de origem.

Em outras palavras:

- mexer na Central precisa mexer no item real
- concluir, reagendar, mover ou priorizar um item deve refletir no modulo dono daquele item

### Exemplos esperados

- concluir uma tarefa de `trabalho` atualiza `ProjectTask`
- reagendar um item da `faculdade` reflete no registro de `Assignment`
- atualizar uma tarefa de `rotina` reflete em `Task`
- um evento de calendario pode apontar para origem e saber se e manual ou vinculado

### Regras de arquitetura da Fase 3

Cada item operacional precisa carregar metadados fortes de origem:

- `originModule`
- `originType`
- `originId`

Hoje a camada atual usa conceitos parecidos via:

- `sourceModule`
- `sourceType`
- `sourceId`

Isso deve continuar como base.

### O que a Fase 3 deve entregar

1. Acoes da Central atualizando corretamente o modelo de origem.
2. Distincao clara entre:
   - item nativo de modulo
   - bloco manual de calendario
   - bloco derivado/vinculado
3. Sincronizacao bidirecional minima:
   - origem muda -> central reflete
   - central muda -> origem reflete
4. Regras de prioridade e status coerentes entre modulos.

### Riscos da Fase 3

- loops de sincronizacao
- ambiguidades de ownership
- duplicacao de itens
- um modulo sobrescrever o outro sem regra clara

### Diretriz importante para a Fase 2

A Fase 2 nao pode criar UI ou contratos que escondam a origem do item.

Se a Fase 2 criar blocos de agenda para GTD ou eventos manuais, isso deve deixar claro:

- de onde o item veio
- se ele e vinculavel
- qual entidade precisa ser atualizada depois na Fase 3

## Fase 4

### Nome

`Modelo unificado de planejamento`

### Objetivo

Criar a infraestrutura oficial de planejamento no banco, em vez de depender apenas de agregacao em tempo de leitura.

Aqui entra a ideia de uma entidade como:

- `PlannerItem`
- ou `ExecutionItem`
- ou `ScheduleBlock`

O nome pode mudar, mas a funcao e a mesma:

- concentrar agendamento
- time blocking
- relacao com origem
- visao oficial da agenda

### O que muda de verdade na Fase 4

Antes:

- a agenda e majoritariamente leitura agregada
- o planner consolida varios modelos sem ser o centro persistente

Depois:

- a agenda vira infraestrutura oficial
- blocos, agendamentos e vinculacoes passam a existir como primeira classe no banco
- fica viavel construir drag-and-drop, reschedule, conflito, backlog planejado e timeline persistente

### Estrutura sugerida para a entidade unificada

A entidade futura precisa contemplar algo proximo de:

- `id`
- `userId`
- `title`
- `description`
- `kind` (`task`, `event`, `block`)
- `originModule`
- `originType`
- `originId`
- `status`
- `priority`
- `scheduledStart`
- `scheduledEnd`
- `allDay`
- `estimatedMin`
- `context`
- `energy`
- `isManual`
- `isDerived`

### O que a Fase 4 deve entregar

1. Nova entidade persistida no banco.
2. Migracao gradual sem quebrar as telas atuais.
3. `/api/planner` passando a ler prioritariamente da infraestrutura nova quando fizer sentido.
4. Regras claras para:
   - item manual
   - item vinculado
   - item espelhado
   - item apenas agregado

### Riscos da Fase 4

- migracao pesada demais
- perda de compatibilidade com modulos existentes
- tentativa de unificar tudo de uma vez

### Diretriz importante para a Fase 2 e 3

Mesmo antes da entidade nova existir, qualquer contrato novo deve se parecer com o futuro modelo.

Ou seja:

- usar metadados de origem
- separar `kind`
- separar `scheduledStart` e `scheduledEnd`
- nao amarrar tudo a buckets GTD

## Fase 5

### Nome

`Inteligencia e refinamento`

### Objetivo

Transformar a Central Operacional em algo realmente assistivo, com planejamento inteligente e UX madura.

### O que entra nessa fase

- sugestao automatica de horarios
- deteccao de conflito de agenda
- recomendacao de melhor horario com base em energia/contexto
- revisao semanal inteligente
- priorizacao automatica por prazo, energia e modulo
- refinamento visual e interacional estilo TickTick

### Casos de uso esperados

- sugerir onde encaixar uma tarefa de 45 minutos hoje
- detectar conflito entre reuniao, bloco manual e entrega
- sugerir mover item de alta energia para horario melhor
- identificar semana sobrecarregada
- destacar backlog que precisa ser planejado

### Dependencias da Fase 5

Ela depende fortemente de:

- Fase 3 bem resolvida em termos de ownership/origem
- Fase 4 bem resolvida em termos de persistencia de agenda

Sem isso, a inteligencia fica superficial ou instavel.

### O que a Fase 5 deve entregar

1. Motor de sugestao operacional.
2. Regras de conflito e recomendacao.
3. Revisao semanal inteligente baseada em dados reais.
4. Melhorias de UX:
   - feedback rapido
   - atalhos
   - densidade visual boa
   - agenda mais fluida
   - interacoes mais proximas de um app de produtividade real

## Como a Fase 2 deve respeitar as fases futuras

Ao implementar a Fase 2, seguir estas restricoes para nao bloquear as fases seguintes:

1. Toda nova acao precisa saber qual e a origem do item.
2. Toda acao de agenda deve diferenciar:
   - bloco manual
   - bloco vinculado a origem
   - item apenas visualizado
3. Nao criar contratos acoplados so a GTD.
4. Sempre que possivel, modelar os dados da UI com:
   - `kind`
   - `sourceModule`
   - `sourceType`
   - `sourceId`
   - `scheduledStart`
   - `scheduledEnd`
5. Nao esconder o caminho de migracao para uma entidade futura tipo `PlannerItem`.
6. Quick actions devem ser pensadas para futuramente funcionar tambem em:
   - rotina
   - trabalho
   - faculdade
   - calendario

## Backlog por fase

### Backlog da Fase 2

- agendar GTD em bloco de horario
- criar bloco manual
- quick actions basicas
- atualizacao basica do calendario

### Backlog da Fase 3

- sincronizacao com `ProjectTask`
- sincronizacao com `Task`
- sincronizacao com `Assignment`
- definicao de ownership entre calendario e origem

### Backlog da Fase 4

- desenhar entidade unificada
- migrar sem quebrar consumo atual
- adaptar `/api/planner`
- revisar contratos de escrita

### Backlog da Fase 5

- score de carga semanal
- heuristicas de conflito
- sugestao de horario
- revisao semanal automatizada
- refinamento de UX

## Criterios de aceite da Fase 2

A Fase 2 pode ser considerada pronta se:

1. Um item da Central Operacional puder ser agendado em horario.
2. O bloco aparecer corretamente na Agenda 24h.
3. O usuario puder ajustar esse bloco sem sair da Central.
4. Houver pelo menos quick actions de planejamento para GTD.
5. A dashboard continuar consumindo os dados agregados sem quebrar.
6. O comportamento nao duplicar silos de navegacao.
7. A implementacao nao bloquear a futura sincronizacao da Fase 3.
8. A modelagem da UI continuar compativel com a futura entidade unificada da Fase 4.

## O que evitar agora

- nao refatorar o app inteiro
- nao unificar todos os modelos no banco nesta fase
- nao reinventar o calendario inteiro antes de colocar escrita minima
- nao tocar em modulos paralelos sem necessidade
- nao reverter alteracoes locais de outras areas

## Se houver duvida sobre a direcao

Relembrar a regra:

`Central Operacional primeiro, unificacao estrutural depois.`

## Resumo executavel para o Codex

Se quiser um resumo curto para o prompt do terminal:

```text
Leia AGENTS.md e HANDOFF.md.

Contexto:
- Fase 1 da Central Operacional ja foi implementada.
- /tarefas agora mostra Hoje, Semana, Mes e Agenda 24h usando /api/planner.
- dashboard ja tem Meu Dia.
- O banco ainda nao foi unificado.

Sua tarefa:
- Implementar a Fase 2: planejamento com escrita.
- Comece por GTD + CalendarEvent.
- Permita agendar item em bloco de horario, ajustar esse bloco e criar bloco manual.
- Adicione quick actions de planejamento.
- Nao reverta alteracoes locais de outros arquivos.
- Valide o que for possivel no ambiente atual.
```
