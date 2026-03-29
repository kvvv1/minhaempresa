import { addDays, differenceInMinutes, endOfDay, endOfWeek, format, isWithinInterval, setHours, setMinutes, startOfDay, startOfWeek } from 'date-fns'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parsePlannerEventDescription } from '@/lib/planner'
import { prisma } from '@/lib/prisma'

function durationMinutes(start: Date, end?: Date | null) {
  if (!end) return 0
  return Math.max(0, differenceInMinutes(end, start))
}

function resolveRangeEnd(start: Date, end?: Date | null, fallbackMinutes = 30) {
  if (end && end > start) return end
  return new Date(start.getTime() + fallbackMinutes * 60000)
}

function mergeBusyRanges(ranges: Array<{ start: Date; end: Date }>) {
  const sorted = [...ranges].sort((left, right) => left.start.getTime() - right.start.getTime())
  const merged: Array<{ start: Date; end: Date }> = []

  for (const range of sorted) {
    const last = merged.at(-1)

    if (!last || range.start > last.end) {
      merged.push({ ...range })
      continue
    }

    if (range.end > last.end) {
      last.end = range.end
    }
  }

  return merged
}

function buildWorkWindow(day: Date) {
  return {
    start: setMinutes(setHours(new Date(day), 8), 0),
    end: setMinutes(setHours(new Date(day), 20), 0),
  }
}

function countConflicts(ranges: Array<{ start: Date; end: Date }>) {
  const sorted = [...ranges].sort((left, right) => left.start.getTime() - right.start.getTime())
  let conflicts = 0

  for (let index = 0; index < sorted.length - 1; index++) {
    if (sorted[index].end > sorted[index + 1].start) {
      conflicts++
    }
  }

  return conflicts
}

function findAvailableSlotForDay({
  day,
  duration,
  plannerItems,
  meetings,
  calendarEvents,
  excludeEventId,
}: {
  day: Date
  duration: number
  plannerItems: Array<{ calendarEventId: string | null; scheduledStart: Date | null; scheduledEnd: Date | null }>
  meetings: Array<{ startAt: Date; endAt: Date | null }>
  calendarEvents: Array<{ id: string; startAt: Date; endAt: Date | null }>
  excludeEventId?: string | null
}) {
  const workWindow = buildWorkWindow(day)
  const busyRanges = mergeBusyRanges([
    ...plannerItems
      .filter((item) => item.calendarEventId !== excludeEventId && item.scheduledStart && isWithinInterval(item.scheduledStart, { start: workWindow.start, end: endOfDay(workWindow.end) }))
      .map((item) => ({
        start: item.scheduledStart!,
        end: resolveRangeEnd(item.scheduledStart!, item.scheduledEnd, 45),
      })),
    ...meetings
      .filter((meeting) => isWithinInterval(meeting.startAt, { start: workWindow.start, end: endOfDay(workWindow.end) }))
      .map((meeting) => ({
        start: meeting.startAt,
        end: resolveRangeEnd(meeting.startAt, meeting.endAt, 30),
      })),
    ...calendarEvents
      .filter((event) => event.id !== excludeEventId && isWithinInterval(event.startAt, { start: workWindow.start, end: endOfDay(workWindow.end) }))
      .map((event) => ({
        start: event.startAt,
        end: resolveRangeEnd(event.startAt, event.endAt, 30),
      })),
  ])

  let cursor = workWindow.start

  for (const busy of busyRanges) {
    const gapMin = differenceInMinutes(busy.start, cursor)
    if (gapMin >= duration) {
      return {
        start: cursor,
        end: new Date(cursor.getTime() + duration * 60000),
      }
    }

    if (busy.end > cursor) {
      cursor = busy.end
    }
  }

  if (differenceInMinutes(workWindow.end, cursor) >= duration) {
    return {
      start: cursor,
      end: new Date(cursor.getTime() + duration * 60000),
    }
  }

  return null
}

function getPlannerPriorityRank(priority: string | null) {
  switch (priority) {
    case 'URGENT':
      return 4
    case 'HIGH':
      return 3
    case 'MEDIUM':
      return 2
    case 'LOW':
      return 1
    default:
      return 0
  }
}

function getUrgencyScore(dueDate: Date | null, now: Date) {
  if (!dueDate) return 0

  const daysUntilDue = differenceInMinutes(dueDate, now) / (60 * 24)
  if (daysUntilDue <= 0) return 4
  if (daysUntilDue <= 1) return 3
  if (daysUntilDue <= 3) return 2
  if (daysUntilDue <= 7) return 1

  return 0
}

function getEnergyWindowScore(energy: string | null, slotStart: Date) {
  const hour = slotStart.getHours()

  if (energy === 'HIGH') {
    if (hour >= 8 && hour < 12) return 3
    if (hour >= 12 && hour < 15) return 1
    return -1
  }

  if (energy === 'MEDIUM') {
    if (hour >= 9 && hour < 16) return 2
    return 0
  }

  if (energy === 'LOW') {
    if (hour >= 15 && hour < 19) return 2
    if (hour >= 12 && hour < 15) return 1
  }

  return 0
}

function getDurationFitScore(duration: number, slotStart: Date) {
  const hour = slotStart.getHours()

  if (duration >= 90) {
    return hour < 12 ? 2 : -1
  }

  if (duration <= 30) {
    return hour >= 15 ? 2 : 1
  }

  return hour >= 9 && hour < 16 ? 1 : 0
}

function getContextScore(context: string | null, slotStart: Date) {
  if (!context) return 0

  const normalized = context.toLowerCase()
  const hour = slotStart.getHours()

  if (normalized.includes('liga') || normalized.includes('call') || normalized.includes('telefone')) {
    return hour >= 14 ? 2 : 0
  }

  if (normalized.includes('comput') || normalized.includes('deep') || normalized.includes('estud')) {
    return hour < 12 ? 2 : 0
  }

  if (normalized.includes('rua') || normalized.includes('extern')) {
    return hour >= 10 && hour < 17 ? 1 : 0
  }

  return 0
}

function buildSuggestionRationale({
  dueDate,
  now,
  energy,
  context,
  duration,
  slotStart,
}: {
  dueDate: Date | null
  now: Date
  energy: string | null
  context: string | null
  duration: number
  slotStart: Date
}) {
  const reasons: string[] = []

  if (dueDate && getUrgencyScore(dueDate, now) >= 3) {
    reasons.push('prazo proximo')
  }

  if (energy === 'HIGH' && slotStart.getHours() < 12) {
    reasons.push('janela de foco forte pela manha')
  } else if (energy === 'LOW' && slotStart.getHours() >= 15) {
    reasons.push('horario leve para energia baixa')
  }

  if (context) {
    const normalized = context.toLowerCase()
    if (normalized.includes('comput')) reasons.push('contexto de computador melhor encaixado')
    if (normalized.includes('liga') || normalized.includes('call')) reasons.push('contexto de ligacoes em horario mais facil')
  }

  if (duration >= 90 && slotStart.getHours() < 12) {
    reasons.push('bloco longo em periodo mais limpo')
  } else if (duration <= 30) {
    reasons.push('bloco curto aproveitando janela pequena')
  }

  if (reasons.length === 0) {
    return 'Janela livre encontrada sem sobrepor blocos existentes.'
  }

  return `${reasons[0].charAt(0).toUpperCase()}${reasons[0].slice(1)}${reasons.length > 1 ? `, ${reasons.slice(1).join(', ')}.` : '.'}`
}

function suggestRebalances({
  weekStart,
  capacity,
  plannerItems,
  meetings,
  calendarEvents,
}: {
  weekStart: Date
  capacity: Array<{ date: string; label: string; status: 'open' | 'busy' | 'overloaded'; remainingFocusHours: number }>
  plannerItems: Array<{
    id: string
    title: string
    priority: string | null
    originModule: string | null
    scheduledStart: Date | null
    scheduledEnd: Date | null
    calendarEventId: string | null
    allDay: boolean
  }>
  meetings: Array<{ startAt: Date; endAt: Date | null }>
  calendarEvents: Array<{ id: string; startAt: Date; endAt: Date | null }>
}) {
  const overloadedDayKeys = new Set(
    capacity
      .filter((day) => day.status === 'overloaded')
      .map((day) => format(new Date(day.date), 'yyyy-MM-dd'))
  )

  const movableItems = plannerItems
    .filter((item) => item.calendarEventId && item.scheduledStart && !item.allDay && overloadedDayKeys.has(format(item.scheduledStart, 'yyyy-MM-dd')))
    .map((item) => ({
      ...item,
      duration: durationMinutes(item.scheduledStart!, resolveRangeEnd(item.scheduledStart!, item.scheduledEnd, 45)),
    }))
    .filter((item) => item.duration >= 30)
    .sort((left, right) => {
      const priorityDelta = getPlannerPriorityRank(left.priority) - getPlannerPriorityRank(right.priority)
      if (priorityDelta !== 0) return priorityDelta
      return right.duration - left.duration
    })

  const targetDays = capacity
    .filter((day) => day.status !== 'overloaded' && day.remainingFocusHours >= 1)
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === 'open' ? -1 : 1
      return right.remainingFocusHours - left.remainingFocusHours
    })

  const suggestions: Array<{
    eventId: string
    title: string
    sourceModule: string
    priority: string | null
    fromStart: string
    fromEnd: string
    suggestedStart: string
    suggestedEnd: string
    impact: string
    rationale: string
  }> = []

  for (const item of movableItems) {
    const currentDayKey = format(item.scheduledStart!, 'yyyy-MM-dd')

    for (const targetDay of targetDays) {
      const targetDate = new Date(targetDay.date)
      if (format(targetDate, 'yyyy-MM-dd') === currentDayKey) continue

      const slot = findAvailableSlotForDay({
        day: startOfDay(targetDate),
        duration: item.duration,
        plannerItems: plannerItems.map((plannerItem) => ({
          calendarEventId: plannerItem.calendarEventId,
          scheduledStart: plannerItem.scheduledStart,
          scheduledEnd: plannerItem.scheduledEnd,
        })),
        meetings,
        calendarEvents,
        excludeEventId: item.calendarEventId,
      })

      if (!slot) continue

      suggestions.push({
        eventId: item.calendarEventId!,
        title: item.title,
        sourceModule: item.originModule ?? 'calendario',
        priority: item.priority,
        fromStart: item.scheduledStart!.toISOString(),
        fromEnd: resolveRangeEnd(item.scheduledStart!, item.scheduledEnd, 45).toISOString(),
        suggestedStart: slot.start.toISOString(),
        suggestedEnd: slot.end.toISOString(),
        impact: targetDay.status === 'open' ? 'alivia um dia sobrecarregado' : 'reduz a pressao da semana',
        rationale: targetDay.status === 'open'
          ? 'Mover este bloco libera um dia sobrecarregado e leva a tarefa para uma janela mais aberta.'
          : 'Mover este bloco reduz conflito de capacidade sem perder uma janela viavel nesta semana.',
      })
      break
    }

    if (suggestions.length >= 5) break
  }

  return suggestions
}

function suggestConflictResolutions({
  now,
  plannerItems,
  meetings,
  calendarEvents,
}: {
  now: Date
  plannerItems: Array<{
    id: string
    title: string
    priority: string | null
    originModule: string | null
    scheduledStart: Date | null
    scheduledEnd: Date | null
    calendarEventId: string | null
    allDay: boolean
  }>
  meetings: Array<{ startAt: Date; endAt: Date | null }>
  calendarEvents: Array<{ id: string; startAt: Date; endAt: Date | null }>
}) {
  const scheduledItems = plannerItems
    .filter((item) => item.calendarEventId && item.scheduledStart && !item.allDay)
    .map((item) => ({
      ...item,
      effectiveEnd: resolveRangeEnd(item.scheduledStart!, item.scheduledEnd, 45),
      duration: durationMinutes(item.scheduledStart!, resolveRangeEnd(item.scheduledStart!, item.scheduledEnd, 45)),
    }))
    .sort((left, right) => left.scheduledStart!.getTime() - right.scheduledStart!.getTime())

  const suggestions: Array<{
    eventId: string
    title: string
    sourceModule: string
    priority: string | null
    blockingTitle: string
    currentStart: string
    currentEnd: string
    suggestedStart: string
    suggestedEnd: string
    impact: string
    rationale: string
  }> = []
  const seenEventIds = new Set<string>()

  for (let index = 0; index < scheduledItems.length - 1; index++) {
    const current = scheduledItems[index]
    const next = scheduledItems[index + 1]

    if (current.effectiveEnd <= next.scheduledStart!) continue

    const currentRank = getPlannerPriorityRank(current.priority)
    const nextRank = getPlannerPriorityRank(next.priority)
    const movable =
      currentRank < nextRank
        ? current
        : nextRank < currentRank
          ? next
          : current.scheduledStart! > next.scheduledStart!
            ? current
            : next

    if (seenEventIds.has(movable.calendarEventId!)) continue

    let foundSlot: { start: Date; end: Date } | null = null

    for (let dayOffset = 0; dayOffset < 3 && !foundSlot; dayOffset++) {
      const targetDay = startOfDay(addDays(movable.scheduledStart!, dayOffset))
      foundSlot = findAvailableSlotForDay({
        day: targetDay,
        duration: movable.duration,
        plannerItems: plannerItems.map((item) => ({
          calendarEventId: item.calendarEventId,
          scheduledStart: item.scheduledStart,
          scheduledEnd: item.scheduledEnd,
        })),
        meetings,
        calendarEvents,
        excludeEventId: movable.calendarEventId,
      })

      if (foundSlot && foundSlot.start.getTime() === movable.scheduledStart!.getTime()) {
        foundSlot = null
      }
    }

    if (!foundSlot) continue

    seenEventIds.add(movable.calendarEventId!)
    suggestions.push({
      eventId: movable.calendarEventId!,
      title: movable.title,
      sourceModule: movable.originModule ?? 'calendario',
      priority: movable.priority,
      blockingTitle: movable.id === current.id ? next.title : current.title,
      currentStart: movable.scheduledStart!.toISOString(),
      currentEnd: movable.effectiveEnd.toISOString(),
      suggestedStart: foundSlot.start.toISOString(),
      suggestedEnd: foundSlot.end.toISOString(),
      impact: 'remove uma sobreposicao direta',
      rationale: `Mover este bloco elimina a sobreposicao com ${movable.id === current.id ? next.title : current.title} sem alterar automaticamente a agenda.`,
    })

    if (suggestions.length >= 5) break
  }

  return suggestions
}

function findSuggestedSlots({
  tasks,
  plannerItems,
  meetings,
  calendarEvents,
  now,
}: {
  tasks: Array<{ id: string; sourceType: string; title: string; priority: string | null; dueDate: Date | null; sourceModule: string; estimatedMin: number | null; energy: string | null; context: string | null }>
  plannerItems: Array<{ scheduledStart: Date | null; scheduledEnd: Date | null }>
  meetings: Array<{ startAt: Date; endAt: Date | null }>
  calendarEvents: Array<{ startAt: Date; endAt: Date | null }>
  now: Date
}) {
  const suggestions: Array<{
    id: string
    title: string
    sourceType: string
    sourceModule: string
    priority: string | null
    estimatedMin: number
    suggestedStart: string
    suggestedEnd: string
    score: number
    fitLabel: string
    impact: string
    rationale: string
  }> = []

  const candidateTasks = tasks
    .filter((task) => task.priority === 'HIGH' || task.priority === 'URGENT')
    .slice(0, 5)

  for (const task of candidateTasks) {
    const duration = task.estimatedMin ?? 60
    let foundSlot: { start: Date; end: Date } | null = null

    for (let dayOffset = 0; dayOffset < 3 && !foundSlot; dayOffset++) {
      const day = startOfDay(addDays(now, dayOffset))
      const workWindow = buildWorkWindow(day)
      const busyRanges = mergeBusyRanges([
        ...plannerItems
          .filter((item) => item.scheduledStart && isWithinInterval(item.scheduledStart, { start: workWindow.start, end: endOfDay(workWindow.end) }))
          .map((item) => ({
            start: item.scheduledStart!,
            end: resolveRangeEnd(item.scheduledStart!, item.scheduledEnd, 45),
          })),
        ...meetings
          .filter((meeting) => isWithinInterval(meeting.startAt, { start: workWindow.start, end: endOfDay(workWindow.end) }))
          .map((meeting) => ({
            start: meeting.startAt,
            end: resolveRangeEnd(meeting.startAt, meeting.endAt, 30),
          })),
        ...calendarEvents
          .filter((event) => isWithinInterval(event.startAt, { start: workWindow.start, end: endOfDay(workWindow.end) }))
          .map((event) => ({
            start: event.startAt,
            end: resolveRangeEnd(event.startAt, event.endAt, 30),
          })),
      ])

      let cursor = dayOffset === 0 && now > workWindow.start ? now : workWindow.start

      for (const busy of busyRanges) {
        const gapMin = differenceInMinutes(busy.start, cursor)
        if (gapMin >= duration) {
          foundSlot = {
            start: cursor,
            end: addDays(cursor, 0),
          }
          foundSlot.end = new Date(foundSlot.start.getTime() + duration * 60000)
          break
        }

        if (busy.end > cursor) {
          cursor = busy.end
        }
      }

      if (!foundSlot && differenceInMinutes(workWindow.end, cursor) >= duration) {
        foundSlot = {
          start: cursor,
          end: new Date(cursor.getTime() + duration * 60000),
        }
      }
    }

    if (foundSlot) {
      const priorityScore = getPlannerPriorityRank(task.priority)
      const urgencyScore = getUrgencyScore(task.dueDate, now)
      const energyScore = getEnergyWindowScore(task.energy, foundSlot.start)
      const contextScore = getContextScore(task.context, foundSlot.start)
      const durationScore = getDurationFitScore(duration, foundSlot.start)
      const score = priorityScore + urgencyScore + energyScore + contextScore + durationScore

      suggestions.push({
        id: task.id,
        sourceType: task.sourceType,
        title: task.title,
        sourceModule: task.sourceModule,
        priority: task.priority,
        estimatedMin: duration,
        suggestedStart: foundSlot.start.toISOString(),
        suggestedEnd: foundSlot.end.toISOString(),
        score,
        fitLabel: score >= 10 ? 'ajuste forte' : score >= 7 ? 'ajuste bom' : 'ajuste viavel',
        impact: duration >= 90 ? 'protege um bloco de foco' : task.dueDate && getUrgencyScore(task.dueDate, now) >= 3 ? 'antecipa um item urgente' : 'aproveita uma boa janela livre',
        rationale: buildSuggestionRationale({
          dueDate: task.dueDate,
          now,
          energy: task.energy,
          context: task.context,
          duration,
          slotStart: foundSlot.start,
        }),
      })
    }
  }

  return suggestions.sort((left, right) => right.score - left.score)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const todayStart = startOfDay(now)

  const [gtdTasks, routineTasks, projectTasks, assignments, plannerItems, calendarEvents, meetings] = await Promise.all([
    prisma.gtdTask.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    }),
    prisma.task.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    }),
    prisma.projectTask.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    }),
    prisma.assignment.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    }),
    prisma.plannerItem.findMany({
      where: {
        userId,
        status: { not: 'CANCELLED' },
      },
      orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        startAt: { gte: startOfDay(now), lte: weekEnd },
      },
      orderBy: { startAt: 'asc' },
    }),
    prisma.meeting.findMany({
      where: {
        userId,
        startAt: { gte: startOfDay(now), lte: weekEnd },
      },
      orderBy: { startAt: 'asc' },
    }),
  ])

  const inboxCount = gtdTasks.filter((task) => task.bucket === 'INBOX' && task.status !== 'COMPLETED').length
  const waitingCount = gtdTasks.filter((task) => task.bucket === 'WAITING' && task.status !== 'COMPLETED').length
  const somedayCount = gtdTasks.filter((task) => task.bucket === 'SOMEDAY' && task.status !== 'COMPLETED').length

  const openTasks = [
    ...gtdTasks.filter((task) => task.status !== 'COMPLETED').map((task) => ({ id: task.id, sourceType: 'gtdTask', title: task.title, priority: task.priority, dueDate: task.dueDate, sourceModule: 'tarefas', estimatedMin: task.estimatedMin ?? 45, energy: task.energy ?? null, context: task.context ?? null })),
    ...routineTasks.filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED').map((task) => ({ id: task.id, sourceType: 'routineTask', title: task.title, priority: task.priority, dueDate: task.dueDate, sourceModule: 'rotina', estimatedMin: 45, energy: null, context: null })),
    ...projectTasks.filter((task) => task.status !== 'DONE').map((task) => ({ id: task.id, sourceType: 'projectTask', title: task.title, priority: task.priority, dueDate: task.dueDate, sourceModule: 'trabalho', estimatedMin: task.estimatedMin ?? 60, energy: null, context: null })),
    ...assignments.filter((assignment) => assignment.status !== 'SUBMITTED' && assignment.status !== 'GRADED').map((assignment) => ({ id: assignment.id, sourceType: 'assignment', title: assignment.title, priority: assignment.priority, dueDate: assignment.dueDate, sourceModule: 'faculdade', estimatedMin: 60, energy: null, context: null })),
  ]

  const overdue = openTasks.filter((item) => item.dueDate && item.dueDate < todayStart)
  const plannedSourceKeys = new Set(
    plannerItems
      .filter((item) => item.originId && item.originType && item.status !== 'COMPLETED' && item.status !== 'CANCELLED')
      .map((item) => `${item.originType}:${item.originId}`)
  )
  const unplannedOpenTasks = openTasks.filter((item) => !plannedSourceKeys.has(`${item.sourceType}:${item.id}`))
  const highPriorityUnplanned = unplannedOpenTasks.filter((item) => item.priority === 'HIGH' || item.priority === 'URGENT')

  const weekPlannerItems = plannerItems.filter((item) => {
    if (!item.scheduledStart) return false
    return isWithinInterval(item.scheduledStart, { start: weekStart, end: weekEnd })
  })

  const scheduledMinutes = weekPlannerItems.reduce((total, item) => total + durationMinutes(item.scheduledStart ?? now, item.scheduledEnd), 0)

  const plannerConflictRanges = weekPlannerItems
    .filter((item) => item.scheduledStart)
    .map((item) => ({
      start: item.scheduledStart!,
      end: resolveRangeEnd(item.scheduledStart!, item.scheduledEnd, 45),
    }))
  const conflictCount = countConflicts(plannerConflictRanges)

  const manualBlocks = calendarEvents.filter((event) => parsePlannerEventDescription(event.description).metadata?.scheduleMode !== 'linked')
  const topPriorities = highPriorityUnplanned
    .sort((left, right) => {
      const priorityRank = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
      return (priorityRank[right.priority as keyof typeof priorityRank] ?? 0) - (priorityRank[left.priority as keyof typeof priorityRank] ?? 0)
    })
    .slice(0, 5)

  const suggestions = findSuggestedSlots({
    tasks: unplannedOpenTasks,
    plannerItems: plannerItems.map((item) => ({
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
    })),
    meetings: meetings.map((meeting) => ({
      startAt: meeting.startAt,
      endAt: meeting.endAt,
    })),
    calendarEvents: calendarEvents.map((event) => ({
      startAt: event.startAt,
      endAt: event.endAt,
    })),
    now,
  })

  const capacity = Array.from({ length: 7 }).map((_, index) => {
    const day = addDays(weekStart, index)
    const dayKey = format(day, 'yyyy-MM-dd')
    const plannerDayRanges = weekPlannerItems
      .filter((item) => item.scheduledStart && format(item.scheduledStart, 'yyyy-MM-dd') === dayKey)
      .map((item) => ({
        start: item.scheduledStart!,
        end: resolveRangeEnd(item.scheduledStart!, item.scheduledEnd, 45),
      }))
    const meetingDayRanges = meetings
      .filter((meeting) => format(meeting.startAt, 'yyyy-MM-dd') === dayKey)
      .map((meeting) => ({
        start: meeting.startAt,
        end: resolveRangeEnd(meeting.startAt, meeting.endAt, 30),
      }))
    const calendarDayRanges = calendarEvents
      .filter((event) => format(event.startAt, 'yyyy-MM-dd') === dayKey)
      .map((event) => ({
        start: event.startAt,
        end: resolveRangeEnd(event.startAt, event.endAt, 30),
      }))

    const plannerMinutes = plannerDayRanges.reduce((total, range) => total + durationMinutes(range.start, range.end), 0)
    const meetingMinutes = meetingDayRanges.reduce((total, range) => total + durationMinutes(range.start, range.end), 0)
    const calendarMinutes = calendarDayRanges.reduce((total, range) => total + durationMinutes(range.start, range.end), 0)
    const totalBusyMinutes = plannerMinutes + meetingMinutes + calendarMinutes
    const conflictRanges = [...plannerDayRanges, ...meetingDayRanges, ...calendarDayRanges]
    const dayConflicts = countConflicts(conflictRanges)
    const remainingFocusHours = Math.max(0, Math.round(((6 * 60 - totalBusyMinutes) / 60) * 10) / 10)
    const status: 'overloaded' | 'busy' | 'open' =
      totalBusyMinutes >= 8 * 60 || dayConflicts > 0
        ? 'overloaded'
        : totalBusyMinutes >= 5 * 60
          ? 'busy'
          : 'open'

    return {
      date: day.toISOString(),
      label: format(day, 'EEE dd/MM'),
      plannedHours: Math.round((plannerMinutes / 60) * 10) / 10,
      meetingHours: Math.round((meetingMinutes / 60) * 10) / 10,
      calendarHours: Math.round((calendarMinutes / 60) * 10) / 10,
      remainingFocusHours,
      conflictCount: dayConflicts,
      status,
    }
  })

  const overloadedDays = capacity.filter((day) => day.status === 'overloaded').length
  const lowBufferDays = capacity.filter((day) => day.remainingFocusHours < 1).length
  const workloadStatus = scheduledMinutes > 32 * 60 || overloadedDays >= 2 ? 'high' : scheduledMinutes > 24 * 60 || overloadedDays === 1 ? 'medium' : 'balanced'
  const rebalances = suggestRebalances({
    weekStart,
    capacity,
    plannerItems: weekPlannerItems.map((item) => ({
      id: item.id,
      title: item.title,
      priority: item.priority,
      originModule: item.originModule,
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
      calendarEventId: item.calendarEventId,
      allDay: item.allDay,
    })),
    meetings: meetings.map((meeting) => ({
      startAt: meeting.startAt,
      endAt: meeting.endAt,
    })),
    calendarEvents: calendarEvents.map((event) => ({
      id: event.id,
      startAt: event.startAt,
      endAt: event.endAt,
    })),
  })
  const conflicts = suggestConflictResolutions({
    now,
    plannerItems: weekPlannerItems.map((item) => ({
      id: item.id,
      title: item.title,
      priority: item.priority,
      originModule: item.originModule,
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
      calendarEventId: item.calendarEventId,
      allDay: item.allDay,
    })),
    meetings: meetings.map((meeting) => ({
      startAt: meeting.startAt,
      endAt: meeting.endAt,
    })),
    calendarEvents: calendarEvents.map((event) => ({
      id: event.id,
      startAt: event.startAt,
      endAt: event.endAt,
    })),
  })
  const nextActions = [
    ...(inboxCount > 0 ? [`Processar ${inboxCount} item(ns) da Inbox ainda hoje.`] : []),
    ...(overdue.length > 0 ? [`Replanejar ${overdue.length} pendencia(s) vencida(s) antes de adicionar novos blocos.`] : []),
    ...(conflictCount > 0 ? [`Resolver ${conflictCount} conflito(s) de agenda nesta semana.`] : []),
    ...(highPriorityUnplanned.length > 0 ? [`Reservar horario para ${Math.min(highPriorityUnplanned.length, 3)} prioridade(s) altas sem bloco.`] : []),
    ...(waitingCount > 0 ? [`Revisar ${waitingCount} item(ns) em Aguardando e definir proximo passo.`] : []),
    ...(overloadedDays > 0 ? [`Redistribuir carga de ${overloadedDays} dia(s) acima da capacidade segura.`] : []),
    ...(lowBufferDays > 0 ? [`Proteger buffer em ${lowBufferDays} dia(s) com menos de 1h livre de foco.`] : []),
    ...(rebalances.length > 0 ? [`Aplicar ${Math.min(rebalances.length, 3)} sugestao(oes) de redistribuicao para aliviar a semana.`] : []),
    ...(conflicts.length > 0 ? [`Corrigir ${Math.min(conflicts.length, 3)} conflito(s) com sugestao de novo horario.`] : []),
  ].slice(0, 5)

  return NextResponse.json({
    period: {
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      label: `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
    },
    metrics: {
      inboxCount,
      waitingCount,
      somedayCount,
      overdueCount: overdue.length,
      scheduledHours: Math.round((scheduledMinutes / 60) * 10) / 10,
      conflictCount,
      manualBlocks: manualBlocks.length,
      plannedItems: weekPlannerItems.length,
      overloadedDays,
      lowBufferDays,
    },
    topPriorities,
    nextActions,
    suggestions,
    rebalances,
    conflicts,
    workload: {
      status: workloadStatus,
      message:
        workloadStatus === 'high'
          ? 'Semana acima da capacidade recomendada.'
          : workloadStatus === 'medium'
            ? 'Semana com carga elevada, vale revisar buffers.'
            : 'Carga semanal em faixa administravel.',
    },
    capacity,
    timeline: Array.from({ length: 7 }).map((_, index) => {
      const day = addDays(weekStart, index)
      const dayItems = weekPlannerItems.filter((item) => item.scheduledStart && format(item.scheduledStart, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
      const dayMinutes = dayItems.reduce((total, item) => total + durationMinutes(item.scheduledStart ?? day, item.scheduledEnd), 0)

      return {
        date: day.toISOString(),
        label: format(day, 'EEE dd/MM'),
        plannedItems: dayItems.length,
        plannedHours: Math.round((dayMinutes / 60) * 10) / 10,
      }
    }),
  })
}
