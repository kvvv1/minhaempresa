import { endOfWeek, isSameDay, startOfDay } from 'date-fns'

export type PlannerScope = 'today' | 'week' | 'month'

export type PlannerModule = 'tarefas' | 'rotina' | 'trabalho' | 'faculdade' | 'calendario'

export type PlannerSourceType =
  | 'gtdTask'
  | 'routineTask'
  | 'projectTask'
  | 'assignment'
  | 'calendarEvent'
  | 'meeting'

export type PlannerPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type PlannerScheduleMode = 'manual' | 'linked'

export interface PlannerEventMetadata {
  scheduleMode: PlannerScheduleMode
  sourceId?: string
  sourceType?: PlannerSourceType
  sourceModule?: PlannerModule
}

export interface PlannerItem {
  id: string
  sourceId: string
  sourceType: PlannerSourceType
  sourceModule: PlannerModule
  kind: 'task' | 'event'
  title: string
  description?: string | null
  status?: string | null
  priority?: PlannerPriority | null
  bucket?: string | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
  dueDate?: string | null
  allDay?: boolean
  href: string
  detail?: string | null
  context?: string | null
  energy?: string | null
  estimatedMin?: number | null
  scheduleEventId?: string | null
  scheduleMode?: PlannerScheduleMode | null
}

export interface PlannerHabit {
  id: string
  name: string
  frequency: string
  streak: number
  completedToday: boolean
}

export interface PlannerSummary {
  inboxCount: number
  focusCount: number
  scheduledCount: number
  overdueCount: number
  habitsDueCount: number
  habitsCompletedCount: number
}

export interface PlannerResponse {
  scope: PlannerScope
  date: string
  range: {
    from: string
    to: string
  }
  summary: PlannerSummary
  items: PlannerItem[]
  scheduledItems: PlannerItem[]
  focusItems: PlannerItem[]
  overdueItems: PlannerItem[]
  habits: PlannerHabit[]
}

const PLANNER_EVENT_METADATA_PREFIX = '<!-- planner:'

function normalizePlannerText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isPlannerModuleValue(value: unknown): value is PlannerModule {
  return value === 'tarefas' || value === 'rotina' || value === 'trabalho' || value === 'faculdade' || value === 'calendario'
}

function isPlannerSourceTypeValue(value: unknown): value is PlannerSourceType {
  return (
    value === 'gtdTask' ||
    value === 'routineTask' ||
    value === 'projectTask' ||
    value === 'assignment' ||
    value === 'calendarEvent' ||
    value === 'meeting'
  )
}

function isPlannerEventMetadata(value: unknown): value is PlannerEventMetadata {
  if (!value || typeof value !== 'object') return false

  const metadata = value as Record<string, unknown>
  if (metadata.scheduleMode !== 'manual' && metadata.scheduleMode !== 'linked') return false
  if (metadata.sourceId !== undefined && metadata.sourceId !== null && typeof metadata.sourceId !== 'string') return false
  if (metadata.sourceType !== undefined && metadata.sourceType !== null && !isPlannerSourceTypeValue(metadata.sourceType)) return false
  if (metadata.sourceModule !== undefined && metadata.sourceModule !== null && !isPlannerModuleValue(metadata.sourceModule)) return false

  return true
}

export function parsePlannerEventDescription(value?: string | null) {
  const raw = value ?? ''
  const markerIndex = raw.lastIndexOf(PLANNER_EVENT_METADATA_PREFIX)

  if (markerIndex === -1) {
    return {
      description: normalizePlannerText(raw),
      metadata: null as PlannerEventMetadata | null,
    }
  }

  const metadataBlock = raw.slice(markerIndex).trim()
  if (!metadataBlock.endsWith('-->')) {
    return {
      description: normalizePlannerText(raw),
      metadata: null as PlannerEventMetadata | null,
    }
  }

  const payload = metadataBlock.slice(PLANNER_EVENT_METADATA_PREFIX.length, -'-->'.length).trim()

  try {
    const parsed = JSON.parse(payload)
    if (!isPlannerEventMetadata(parsed)) {
      return {
        description: normalizePlannerText(raw),
        metadata: null as PlannerEventMetadata | null,
      }
    }

    return {
      description: normalizePlannerText(raw.slice(0, markerIndex)),
      metadata: parsed,
    }
  } catch {
    return {
      description: normalizePlannerText(raw),
      metadata: null as PlannerEventMetadata | null,
    }
  }
}

export function serializePlannerEventDescription(description?: string | null, metadata?: PlannerEventMetadata | null) {
  const normalizedDescription = normalizePlannerText(description)
  if (!metadata) return normalizedDescription

  const normalizedMetadata: PlannerEventMetadata = {
    scheduleMode: metadata.scheduleMode,
    ...(metadata.sourceId ? { sourceId: metadata.sourceId } : {}),
    ...(metadata.sourceType ? { sourceType: metadata.sourceType } : {}),
    ...(metadata.sourceModule ? { sourceModule: metadata.sourceModule } : {}),
  }

  const metadataBlock = `${PLANNER_EVENT_METADATA_PREFIX}${JSON.stringify(normalizedMetadata)} -->`
  return normalizedDescription ? `${normalizedDescription}\n\n${metadataBlock}` : metadataBlock
}

export function getSuggestedGtdBucketForDate(date: Date, now = new Date()) {
  const todayStart = startOfDay(now)
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  if (date <= todayStart || isSameDay(date, now)) return 'TODAY' as const
  if (date <= weekEnd) return 'THIS_WEEK' as const

  return null
}

export const PLANNER_MODULE_CONFIG: Record<PlannerModule, { label: string; className: string }> = {
  tarefas: { label: 'Tarefas', className: 'border-sky-500/30 text-sky-300' },
  rotina: { label: 'Rotina', className: 'border-violet-500/30 text-violet-300' },
  trabalho: { label: 'Trabalho', className: 'border-orange-500/30 text-orange-300' },
  faculdade: { label: 'Faculdade', className: 'border-emerald-500/30 text-emerald-300' },
  calendario: { label: 'Calendario', className: 'border-amber-500/30 text-amber-300' },
}

export const PLANNER_PRIORITY_CONFIG: Record<PlannerPriority, { label: string; className: string }> = {
  LOW: { label: 'Baixa', className: 'text-slate-400' },
  MEDIUM: { label: 'Media', className: 'text-blue-400' },
  HIGH: { label: 'Alta', className: 'text-orange-400' },
  URGENT: { label: 'Urgente', className: 'text-red-400' },
}

export function getPlannerItemPrimaryDate(item: PlannerItem) {
  const date = item.scheduledStart ?? item.dueDate
  return date ? new Date(date) : null
}

export function isPlannerItemScheduled(item: PlannerItem) {
  return Boolean(item.scheduledStart)
}

export function isPlannerItemOverdue(item: PlannerItem, now = new Date()) {
  if (item.kind !== 'task') return false
  if (!item.dueDate) return false
  if (item.status === 'COMPLETED' || item.status === 'DONE' || item.status === 'SUBMITTED' || item.status === 'GRADED') {
    return false
  }

  return new Date(item.dueDate) < now
}

function getPriorityRank(priority?: PlannerPriority | null) {
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

export function sortPlannerItems(items: PlannerItem[]) {
  return [...items].sort((left, right) => {
    const leftDate = getPlannerItemPrimaryDate(left)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const rightDate = getPlannerItemPrimaryDate(right)?.getTime() ?? Number.MAX_SAFE_INTEGER

    if (leftDate !== rightDate) return leftDate - rightDate

    const priorityDelta = getPriorityRank(right.priority) - getPriorityRank(left.priority)
    if (priorityDelta !== 0) return priorityDelta

    return left.title.localeCompare(right.title, 'pt-BR')
  })
}
