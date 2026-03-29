import { endOfDay, endOfMonth, endOfWeek, isWithinInterval, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  type PlannerHabit,
  type PlannerInsight,
  type PlannerItem,
  type PlannerResponse,
  type PlannerScope,
  isPlannerItemOverdue,
  isPlannerItemScheduled,
  parsePlannerEventDescription,
  sortPlannerItems,
} from '@/lib/planner'
import { getPlannerOriginKey, getPlannerScheduleFromItem } from '@/lib/planner-persistence'
import { prisma } from '@/lib/prisma'
import { parseStoredArray } from '@/lib/storage'

function parseScope(value: string | null): PlannerScope {
  if (value === 'week' || value === 'month') return value
  return 'today'
}

function parseDate(value: string | null) {
  if (!value) return new Date()

  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) return new Date()
    return parsed
  } catch {
    return new Date()
  }
}

function getRange(scope: PlannerScope, anchor: Date) {
  if (scope === 'week') {
    return {
      from: startOfWeek(anchor, { weekStartsOn: 1 }),
      to: endOfWeek(anchor, { weekStartsOn: 1 }),
    }
  }

  if (scope === 'month') {
    return {
      from: startOfMonth(anchor),
      to: endOfMonth(anchor),
    }
  }

  return {
    from: startOfDay(anchor),
    to: endOfDay(anchor),
  }
}

function isDueToday(habit: { frequency: string; targetDays: unknown }, date: Date) {
  const weekday = date.getDay()
  const dayOfMonth = date.getDate()
  const targetDays = parseStoredArray<number>(habit.targetDays)

  if (habit.frequency === 'DAILY') return true

  if (habit.frequency === 'WEEKLY') {
    return targetDays.length === 0 ? weekday === 1 : targetDays.includes(weekday)
  }

  if (habit.frequency === 'MONTHLY') {
    return targetDays.length === 0 ? dayOfMonth === 1 : targetDays.includes(dayOfMonth)
  }

  return false
}

function itemFallsInScope(item: PlannerItem, scope: PlannerScope, from: Date, to: Date) {
  const relevantDate = item.scheduledStart ?? item.dueDate

  if (relevantDate) {
    return isWithinInterval(new Date(relevantDate), { start: from, end: to })
  }

  if (item.sourceType === 'gtdTask') {
    if (scope === 'today') return item.bucket === 'TODAY'
    if (scope === 'week') return item.bucket === 'TODAY' || item.bucket === 'THIS_WEEK'
  }

  if (scope !== 'month' && item.status === 'IN_PROGRESS') return true

  return false
}

function getEventModule(module: string | null) {
  if (
    module === 'trabalho' ||
    module === 'faculdade' ||
    module === 'rotina' ||
    module === 'tarefas' ||
    module === 'saude' ||
    module === 'nutricao' ||
    module === 'metas'
  ) {
    return module
  }

  return 'calendario'
}

function getEventHref(module: string | null) {
  if (
    module === 'trabalho' ||
    module === 'faculdade' ||
    module === 'rotina' ||
    module === 'tarefas' ||
    module === 'saude' ||
    module === 'nutricao' ||
    module === 'metas'
  ) {
    return `/${module}`
  }

  return '/tarefas'
}

function getScheduledDurationMinutes(item: PlannerItem) {
  if (!item.scheduledStart) return 0
  if (item.scheduledEnd) {
    return Math.max(0, (new Date(item.scheduledEnd).getTime() - new Date(item.scheduledStart).getTime()) / 60000)
  }

  return item.estimatedMin ?? 0
}

function buildPlannerInsights({
  scope,
  scheduledItems,
  focusItems,
  overdueItems,
}: {
  scope: PlannerScope
  scheduledItems: PlannerItem[]
  focusItems: PlannerItem[]
  overdueItems: PlannerItem[]
}) {
  const insights: PlannerInsight[] = []

  const sortedScheduled = [...scheduledItems]
    .filter((item) => item.scheduledStart)
    .sort((left, right) => new Date(left.scheduledStart!).getTime() - new Date(right.scheduledStart!).getTime())

  let conflictCount = 0
  for (let index = 0; index < sortedScheduled.length - 1; index++) {
    const current = sortedScheduled[index]
    const next = sortedScheduled[index + 1]
    const currentEnd = current.scheduledEnd ? new Date(current.scheduledEnd).getTime() : new Date(current.scheduledStart!).getTime()
    const nextStart = new Date(next.scheduledStart!).getTime()

    if (currentEnd > nextStart) {
      conflictCount++
    }
  }

  if (conflictCount > 0) {
    insights.push({
      id: 'schedule-conflicts',
      level: conflictCount > 2 ? 'alert' : 'warning',
      title: 'Conflitos de agenda',
      message: `${conflictCount} conflito(s) de horario detectado(s) na agenda atual.`,
    })
  }

  const scheduledLoadMin = scheduledItems.reduce((total, item) => total + getScheduledDurationMinutes(item), 0)
  const overloadThreshold = scope === 'today' ? 8 * 60 : scope === 'week' ? 32 * 60 : 120 * 60

  if (scheduledLoadMin > overloadThreshold) {
    insights.push({
      id: 'load-overflow',
      level: scheduledLoadMin > overloadThreshold * 1.25 ? 'alert' : 'warning',
      title: 'Carga planejada alta',
      message: `Ha ${Math.round(scheduledLoadMin / 60)}h planejadas para este recorte, acima do limite operacional sugerido.`,
    })
  }

  const unscheduledHighPriority = focusItems.filter((item) => item.priority === 'HIGH' || item.priority === 'URGENT')
  if (unscheduledHighPriority.length > 0) {
    insights.push({
      id: 'focus-gap',
      level: 'info',
      title: 'Foco sem bloco',
      message: `${unscheduledHighPriority.length} item(ns) de alta prioridade ainda estao sem horario reservado.`,
    })
  }

  if (overdueItems.length > 0) {
    insights.push({
      id: 'overdue-items',
      level: overdueItems.length > 3 ? 'alert' : 'warning',
      title: 'Pendencias vencidas',
      message: `${overdueItems.length} item(ns) estao vencidos e competem com o plano atual.`,
    })
  }

  return insights
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const scope = parseScope(searchParams.get('scope'))
  const anchorDate = parseDate(searchParams.get('date'))
  const { from, to } = getRange(scope, anchorDate)
  const todayStart = startOfDay(anchorDate)
  const todayEnd = endOfDay(anchorDate)

  const [gtdTasks, routineTasks, projects, projectTasks, goals, assignments, studySessions, workouts, meals, calendarEvents, plannerItems, meetings, habits, habitLogs] = await Promise.all([
    prisma.gtdTask.findMany({
      where: { userId: session.user.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.task.findMany({
      where: { userId: session.user.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.project.findMany({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
        dueDate: { not: null },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    }),
    prisma.projectTask.findMany({
      where: { userId: session.user.id, status: { not: 'DONE' } },
      include: { project: { select: { name: true } } },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    }),
    prisma.goal.findMany({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
        targetDate: { not: null },
      },
      orderBy: { targetDate: 'asc' },
    }),
    prisma.assignment.findMany({
      where: { userId: session.user.id, status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } },
      include: { subject: { select: { name: true } } },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    }),
    prisma.studySession.findMany({
      where: {
        userId: session.user.id,
        startAt: { gte: from, lte: to },
      },
      include: { subject: { select: { name: true } } },
      orderBy: { startAt: 'asc' },
    }),
    prisma.workout.findMany({
      where: {
        userId: session.user.id,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.meal.findMany({
      where: {
        userId: session.user.id,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId: session.user.id,
        startAt: { lte: to },
        OR: [
          { endAt: null, startAt: { gte: from } },
          { endAt: { gte: from } },
        ],
      },
      orderBy: { startAt: 'asc' },
    }),
    prisma.plannerItem.findMany({
      where: {
        userId: session.user.id,
        status: { not: 'CANCELLED' },
        OR: [
          {
            scheduledStart: { lte: to },
            OR: [
              { scheduledEnd: null },
              { scheduledEnd: { gte: from } },
            ],
          },
          {
            dueDate: { gte: from, lte: to },
          },
        ],
      },
      orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.meeting.findMany({
      where: {
        userId: session.user.id,
        startAt: { gte: from, lte: to },
      },
      include: { project: { select: { name: true } } },
      orderBy: { startAt: 'asc' },
    }),
    prisma.habit.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.habitLog.findMany({
      where: {
        userId: session.user.id,
        date: { gte: todayStart, lte: todayEnd },
        completed: true,
      },
      select: { habitId: true },
    }),
  ])

  const habitLogIds = new Set(habitLogs.map((log) => log.habitId))
  const dueHabits: PlannerHabit[] = habits
    .filter((habit) => isDueToday(habit, anchorDate))
    .map((habit) => ({
      id: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      streak: habit.streak,
      completedToday: habitLogIds.has(habit.id),
    }))

  const parsedCalendarEvents = calendarEvents.map((event) => {
    const parsed = parsePlannerEventDescription(event.description)

    return {
      event,
      description: parsed.description,
      metadata: parsed.metadata,
    }
  })

  const linkedCalendarEvents = new Map<
    string,
    {
      event: (typeof parsedCalendarEvents)[number]['event']
      description: string | null
      metadata: (typeof parsedCalendarEvents)[number]['metadata']
    }
  >()

  parsedCalendarEvents.forEach((entry) => {
    if (entry.metadata?.scheduleMode !== 'linked' || !entry.metadata.sourceType || !entry.metadata.sourceId) return
    linkedCalendarEvents.set(`${entry.metadata.sourceType}:${entry.metadata.sourceId}`, entry)
  })

  const plannerItemsByOrigin = new Map<string, (typeof plannerItems)[number]>()
  const mirroredCalendarEventIds = new Set<string>()

  plannerItems.forEach((item) => {
    if (item.calendarEventId) {
      mirroredCalendarEventIds.add(item.calendarEventId)
    }

    const key = getPlannerOriginKey(item.originType, item.originId)
    if (key && !plannerItemsByOrigin.has(key)) {
      plannerItemsByOrigin.set(key, item)
    }
  })

  function getLinkedSchedule(sourceType: PlannerItem['sourceType'], sourceId: string) {
    return linkedCalendarEvents.get(`${sourceType}:${sourceId}`) ?? null
  }

  function getSchedule(sourceType: PlannerItem['sourceType'], sourceId: string) {
    const persisted = plannerItemsByOrigin.get(`${sourceType}:${sourceId}`)
    if (persisted) {
      return getPlannerScheduleFromItem(persisted)
    }

    const linkedSchedule = getLinkedSchedule(sourceType, sourceId)
    if (!linkedSchedule) return null

    return {
      plannerItemId: null,
      scheduledStart: linkedSchedule.event.startAt.toISOString(),
      scheduledEnd: linkedSchedule.event.endAt?.toISOString() ?? null,
      allDay: linkedSchedule.event.allDay,
      scheduleMode: linkedSchedule.metadata?.scheduleMode ?? null,
      scheduleEventId: linkedSchedule.event.id,
      description: linkedSchedule.description,
      title: linkedSchedule.event.title,
      detailContext: null,
      detailEnergy: null,
      estimatedMin: null,
    }
  }

  const gtdItems: PlannerItem[] = gtdTasks.map((task) => {
    const schedule = getSchedule('gtdTask', task.id)

    return {
      id: `gtd:${task.id}`,
      plannerItemId: schedule?.plannerItemId ?? null,
      sourceId: task.id,
      sourceType: 'gtdTask',
      sourceModule: 'tarefas',
      kind: 'task',
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      bucket: task.bucket,
      dueDate: task.dueDate?.toISOString() ?? null,
      scheduledStart: schedule?.scheduledStart ?? null,
      scheduledEnd: schedule?.scheduledEnd ?? null,
      allDay: schedule?.allDay ?? false,
      href: '/tarefas',
      detail: task.context || null,
      context: task.context,
      energy: task.energy,
      estimatedMin: task.estimatedMin,
      scheduleEventId: schedule?.scheduleEventId ?? null,
      scheduleMode: schedule?.scheduleMode ?? null,
      ownership: 'origin',
      persisted: Boolean(schedule?.plannerItemId),
    }
  })

  const routineItems: PlannerItem[] = routineTasks.map((task) => {
    const schedule = getSchedule('routineTask', task.id)

    return {
      id: `routine:${task.id}`,
      plannerItemId: schedule?.plannerItemId ?? null,
      sourceId: task.id,
      sourceType: 'routineTask',
      sourceModule: 'rotina',
      kind: 'task',
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      scheduledStart: schedule?.scheduledStart ?? null,
      scheduledEnd: schedule?.scheduledEnd ?? null,
      allDay: schedule?.allDay ?? false,
      href: '/rotina',
      detail: task.isRecurring ? 'Recorrente' : 'Rotina',
      scheduleEventId: schedule?.scheduleEventId ?? null,
      scheduleMode: schedule?.scheduleMode ?? null,
      ownership: 'origin',
      persisted: Boolean(schedule?.plannerItemId),
    }
  })

  const projectItems: PlannerItem[] = projectTasks.map((task) => {
    const schedule = getSchedule('projectTask', task.id)

    return {
      id: `project:${task.id}`,
      plannerItemId: schedule?.plannerItemId ?? null,
      sourceId: task.id,
      sourceType: 'projectTask',
      sourceModule: 'trabalho',
      kind: 'task',
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      scheduledStart: schedule?.scheduledStart ?? null,
      scheduledEnd: schedule?.scheduledEnd ?? null,
      allDay: schedule?.allDay ?? false,
      href: '/trabalho',
      detail: task.project?.name ? `Projeto: ${task.project.name}` : 'Trabalho',
      estimatedMin: task.estimatedMin,
      scheduleEventId: schedule?.scheduleEventId ?? null,
      scheduleMode: schedule?.scheduleMode ?? null,
      ownership: 'origin',
      persisted: Boolean(schedule?.plannerItemId),
    }
  })

  const projectDeadlineItems: PlannerItem[] = projects.map((project) => ({
    id: `project-deadline:${project.id}`,
    sourceId: project.id,
    sourceType: 'project',
    sourceModule: 'trabalho',
    kind: 'task',
    title: project.name,
    description: project.description,
    status: project.status,
    priority: project.priority,
    dueDate: project.dueDate?.toISOString() ?? null,
    href: '/trabalho',
    detail: 'Prazo do projeto',
  }))

  const assignmentItems: PlannerItem[] = assignments.map((assignment) => {
    const schedule = getSchedule('assignment', assignment.id)

    return {
      id: `assignment:${assignment.id}`,
      plannerItemId: schedule?.plannerItemId ?? null,
      sourceId: assignment.id,
      sourceType: 'assignment',
      sourceModule: 'faculdade',
      kind: 'task',
      title: assignment.title,
      description: assignment.description,
      status: assignment.status,
      priority: assignment.priority,
      dueDate: assignment.dueDate?.toISOString() ?? null,
      scheduledStart: schedule?.scheduledStart ?? null,
      scheduledEnd: schedule?.scheduledEnd ?? null,
      allDay: schedule?.allDay ?? false,
      href: '/faculdade',
      detail: assignment.subject?.name ? `Materia: ${assignment.subject.name}` : 'Faculdade',
      scheduleEventId: schedule?.scheduleEventId ?? null,
      scheduleMode: schedule?.scheduleMode ?? null,
      ownership: 'origin',
      persisted: Boolean(schedule?.plannerItemId),
    }
  })

  const goalItems: PlannerItem[] = goals.map((goal) => ({
    id: `goal:${goal.id}`,
    sourceId: goal.id,
    sourceType: 'goal',
    sourceModule: 'metas',
    kind: 'task',
    title: goal.title,
    description: goal.description,
    status: goal.status,
    dueDate: goal.targetDate?.toISOString() ?? null,
    href: '/metas',
    detail: `${goal.category} - ${Math.round(goal.progress)}%`,
  }))

  const studySessionItems: PlannerItem[] = studySessions.map((session) => ({
    id: `study-session:${session.id}`,
    sourceId: session.id,
    sourceType: 'studySession',
    sourceModule: 'faculdade',
    kind: 'event',
    title: session.subject?.name ? `Estudo - ${session.subject.name}` : 'Sessao de estudo',
    description: session.notes,
    scheduledStart: session.startAt.toISOString(),
    scheduledEnd: session.endAt?.toISOString() ?? null,
    allDay: false,
    href: '/faculdade',
    detail: session.technique ? `Tecnica: ${session.technique}` : 'Sessao de estudo',
    estimatedMin: session.durationMin,
  }))

  const workoutItems: PlannerItem[] = workouts.map((workout) => ({
    id: `workout:${workout.id}`,
    sourceId: workout.id,
    sourceType: 'workout',
    sourceModule: 'saude',
    kind: 'event',
    title: workout.name,
    description: workout.notes,
    scheduledStart: workout.date.toISOString(),
    scheduledEnd: null,
    allDay: true,
    href: '/saude',
    detail: workout.durationMin ? `Treino - ${workout.durationMin} min` : 'Treino',
    ownership: 'origin',
    persisted: false,
  }))

  const mealTypeLabel: Record<string, string> = {
    BREAKFAST: 'Cafe da manha',
    MORNING_SNACK: 'Lanche da manha',
    LUNCH: 'Almoco',
    AFTERNOON_SNACK: 'Lanche da tarde',
    DINNER: 'Jantar',
    SUPPER: 'Ceia',
  }

  const mealItems: PlannerItem[] = meals.map((meal) => ({
    id: `meal:${meal.id}`,
    sourceId: meal.id,
    sourceType: 'meal',
    sourceModule: 'nutricao',
    kind: 'event',
    title: meal.name,
    description: meal.notes,
    scheduledStart: meal.date.toISOString(),
    scheduledEnd: null,
    allDay: true,
    href: '/nutricao',
    detail: mealTypeLabel[meal.type] ?? 'Refeicao',
  }))

  const persistedManualItems: PlannerItem[] = plannerItems
    .filter((item) => !item.originType && !item.originId)
    .map((item) => ({
      id: `planner:${item.id}`,
      plannerItemId: item.id,
      sourceId: item.calendarEventId ?? item.id,
      sourceType: 'calendarEvent',
      sourceModule: 'calendario',
      kind: 'event',
      title: item.title,
      description: item.description,
      status: item.status,
      priority: item.priority,
      scheduledStart: item.scheduledStart?.toISOString() ?? null,
      scheduledEnd: item.scheduledEnd?.toISOString() ?? null,
      dueDate: item.dueDate?.toISOString() ?? null,
      allDay: item.allDay,
      href: '/tarefas',
      detail: item.isManual ? 'Bloco manual persistido' : 'Planejamento',
      context: item.context,
      energy: item.energy,
      estimatedMin: item.estimatedMin,
      scheduleEventId: item.calendarEventId ?? null,
      scheduleMode: item.isManual ? 'manual' : item.isDerived ? 'linked' : null,
      ownership: 'planner',
      persisted: true,
    }))

  const calendarItems: PlannerItem[] = parsedCalendarEvents
    .filter(({ event }) => !mirroredCalendarEventIds.has(event.id))
    .filter((entry) => entry.metadata?.scheduleMode !== 'linked' || !entry.metadata.sourceType || !entry.metadata.sourceId)
    .map(({ event, description, metadata }) => ({
      id: `event:${event.id}`,
      sourceId: event.id,
      sourceType: 'calendarEvent',
      sourceModule: getEventModule(event.module),
      kind: 'event',
      title: event.title,
      description,
      scheduledStart: event.startAt.toISOString(),
      scheduledEnd: event.endAt?.toISOString() ?? null,
      allDay: event.allDay,
      href: getEventHref(event.module),
      detail: metadata?.scheduleMode === 'manual' ? 'Bloco manual' : event.module ? `Modulo: ${event.module}` : 'Calendario',
      scheduleEventId: event.id,
      scheduleMode: metadata?.scheduleMode ?? null,
      ownership: 'calendar',
      persisted: false,
    }))

  const meetingItems: PlannerItem[] = meetings.map((meeting) => ({
    id: `meeting:${meeting.id}`,
    sourceId: meeting.id,
    sourceType: 'meeting',
    sourceModule: 'trabalho',
    kind: 'event',
    title: meeting.title,
    description: meeting.description,
    scheduledStart: meeting.startAt.toISOString(),
    scheduledEnd: meeting.endAt?.toISOString() ?? null,
    href: '/trabalho',
    detail: meeting.project?.name ? `Reuniao: ${meeting.project.name}` : 'Reuniao',
    ownership: 'origin',
    persisted: false,
  }))

  const allItems = [
    ...gtdItems,
    ...routineItems,
    ...projectDeadlineItems,
    ...projectItems,
    ...goalItems,
    ...assignmentItems,
    ...studySessionItems,
    ...workoutItems,
    ...mealItems,
    ...persistedManualItems,
    ...calendarItems,
    ...meetingItems,
  ]

  const scopedItems = sortPlannerItems(
    allItems.filter((item) => itemFallsInScope(item, scope, from, to) || isPlannerItemOverdue(item, todayEnd))
  )

  const scheduledItems = scopedItems.filter((item) => isPlannerItemScheduled(item))
  const overdueItems = scopedItems.filter((item) => isPlannerItemOverdue(item, todayEnd))
  const focusItems = scopedItems.filter((item) => item.kind === 'task' && !isPlannerItemScheduled(item))
  const insights = buildPlannerInsights({
    scope,
    scheduledItems,
    focusItems,
    overdueItems,
  })

  const response: PlannerResponse = {
    scope,
    date: anchorDate.toISOString(),
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    summary: {
      inboxCount: gtdItems.filter((item) => item.bucket === 'INBOX').length,
      focusCount: focusItems.length,
      scheduledCount: scheduledItems.length,
      overdueCount: overdueItems.length,
      habitsDueCount: dueHabits.length,
      habitsCompletedCount: dueHabits.filter((habit) => habit.completedToday).length,
    },
    items: scopedItems,
    scheduledItems,
    focusItems,
    overdueItems,
    habits: dueHabits,
    insights,
  }

  return NextResponse.json(response)
}
