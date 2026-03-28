import { endOfDay, endOfMonth, endOfWeek, isWithinInterval, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  type PlannerHabit,
  type PlannerItem,
  type PlannerResponse,
  type PlannerScope,
  isPlannerItemOverdue,
  isPlannerItemScheduled,
  parsePlannerEventDescription,
  sortPlannerItems,
} from '@/lib/planner'
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
  if (module === 'trabalho' || module === 'faculdade' || module === 'rotina' || module === 'tarefas') {
    return module
  }

  return 'calendario'
}

function getEventHref(module: string | null) {
  if (module === 'trabalho' || module === 'faculdade' || module === 'rotina' || module === 'tarefas') {
    return `/${module}`
  }

  return '/tarefas'
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

  const [gtdTasks, routineTasks, projectTasks, assignments, calendarEvents, meetings, habits, habitLogs] = await Promise.all([
    prisma.gtdTask.findMany({
      where: { userId: session.user.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.task.findMany({
      where: { userId: session.user.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.projectTask.findMany({
      where: { userId: session.user.id, status: { not: 'DONE' } },
      include: { project: { select: { name: true } } },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    }),
    prisma.assignment.findMany({
      where: { userId: session.user.id, status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } },
      include: { subject: { select: { name: true } } },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
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

  function getLinkedSchedule(sourceType: PlannerItem['sourceType'], sourceId: string) {
    return linkedCalendarEvents.get(`${sourceType}:${sourceId}`) ?? null
  }

  const gtdItems: PlannerItem[] = gtdTasks.map((task) => {
    const linkedSchedule = getLinkedSchedule('gtdTask', task.id)

    return {
      id: `gtd:${task.id}`,
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
      scheduledStart: linkedSchedule?.event.startAt.toISOString() ?? null,
      scheduledEnd: linkedSchedule?.event.endAt?.toISOString() ?? null,
      allDay: linkedSchedule?.event.allDay ?? false,
      href: '/tarefas',
      detail: task.context || null,
      context: task.context,
      energy: task.energy,
      estimatedMin: task.estimatedMin,
      scheduleEventId: linkedSchedule?.event.id ?? null,
      scheduleMode: linkedSchedule?.metadata?.scheduleMode ?? null,
    }
  })

  const routineItems: PlannerItem[] = routineTasks.map((task) => {
    const linkedSchedule = getLinkedSchedule('routineTask', task.id)

    return {
      id: `routine:${task.id}`,
      sourceId: task.id,
      sourceType: 'routineTask',
      sourceModule: 'rotina',
      kind: 'task',
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      scheduledStart: linkedSchedule?.event.startAt.toISOString() ?? null,
      scheduledEnd: linkedSchedule?.event.endAt?.toISOString() ?? null,
      allDay: linkedSchedule?.event.allDay ?? false,
      href: '/rotina',
      detail: task.isRecurring ? 'Recorrente' : 'Rotina',
      scheduleEventId: linkedSchedule?.event.id ?? null,
      scheduleMode: linkedSchedule?.metadata?.scheduleMode ?? null,
    }
  })

  const projectItems: PlannerItem[] = projectTasks.map((task) => {
    const linkedSchedule = getLinkedSchedule('projectTask', task.id)

    return {
      id: `project:${task.id}`,
      sourceId: task.id,
      sourceType: 'projectTask',
      sourceModule: 'trabalho',
      kind: 'task',
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      scheduledStart: linkedSchedule?.event.startAt.toISOString() ?? null,
      scheduledEnd: linkedSchedule?.event.endAt?.toISOString() ?? null,
      allDay: linkedSchedule?.event.allDay ?? false,
      href: '/trabalho',
      detail: task.project?.name ? `Projeto: ${task.project.name}` : 'Trabalho',
      estimatedMin: task.estimatedMin,
      scheduleEventId: linkedSchedule?.event.id ?? null,
      scheduleMode: linkedSchedule?.metadata?.scheduleMode ?? null,
    }
  })

  const assignmentItems: PlannerItem[] = assignments.map((assignment) => {
    const linkedSchedule = getLinkedSchedule('assignment', assignment.id)

    return {
      id: `assignment:${assignment.id}`,
      sourceId: assignment.id,
      sourceType: 'assignment',
      sourceModule: 'faculdade',
      kind: 'task',
      title: assignment.title,
      description: assignment.description,
      status: assignment.status,
      priority: assignment.priority,
      dueDate: assignment.dueDate?.toISOString() ?? null,
      scheduledStart: linkedSchedule?.event.startAt.toISOString() ?? null,
      scheduledEnd: linkedSchedule?.event.endAt?.toISOString() ?? null,
      allDay: linkedSchedule?.event.allDay ?? false,
      href: '/faculdade',
      detail: assignment.subject?.name ? `Materia: ${assignment.subject.name}` : 'Faculdade',
      scheduleEventId: linkedSchedule?.event.id ?? null,
      scheduleMode: linkedSchedule?.metadata?.scheduleMode ?? null,
    }
  })

  const calendarItems: PlannerItem[] = parsedCalendarEvents
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
  }))

  const allItems = [...gtdItems, ...routineItems, ...projectItems, ...assignmentItems, ...calendarItems, ...meetingItems]

  const scopedItems = sortPlannerItems(
    allItems.filter((item) => itemFallsInScope(item, scope, from, to) || isPlannerItemOverdue(item, todayEnd))
  )

  const scheduledItems = scopedItems.filter((item) => isPlannerItemScheduled(item))
  const overdueItems = scopedItems.filter((item) => isPlannerItemOverdue(item, todayEnd))
  const focusItems = scopedItems.filter((item) => item.kind === 'task' && !isPlannerItemScheduled(item))

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
  }

  return NextResponse.json(response)
}
