import { addDays, endOfDay, endOfWeek } from 'date-fns'
import type { PlannerModule, PlannerSourceType } from '@/lib/planner'
import { getSuggestedGtdBucketForDate } from '@/lib/planner'
import { prisma } from '@/lib/prisma'

export type PlannerWritableSourceType = 'gtdTask' | 'routineTask' | 'projectTask' | 'assignment'
export type PlannerOriginAction = 'move-to-today' | 'move-to-week' | 'defer'

export interface PlannerWritableSourceRecord {
  id: string
  title: string
  description: string | null
  dueDate: Date | null
  estimatedMin: number | null
  status: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null
  context: string | null
  energy: 'LOW' | 'MEDIUM' | 'HIGH' | null
  sourceType: PlannerWritableSourceType
  sourceModule: PlannerModule
}

function isPlannerWritableSourceType(value: PlannerSourceType): value is PlannerWritableSourceType {
  return value === 'gtdTask' || value === 'routineTask' || value === 'projectTask' || value === 'assignment'
}

export function canPlannerSourceMutate(value: PlannerSourceType): value is PlannerWritableSourceType {
  return isPlannerWritableSourceType(value)
}

export async function getPlannerWritableSource(sourceType: PlannerSourceType, sourceId: string, userId: string): Promise<PlannerWritableSourceRecord | null> {
  if (!isPlannerWritableSourceType(sourceType)) return null

  if (sourceType === 'gtdTask') {
    const task = await prisma.gtdTask.findFirst({
      where: { id: sourceId, userId },
    })

    if (!task) return null

    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      dueDate: task.dueDate ?? null,
      estimatedMin: task.estimatedMin ?? null,
      status: task.status,
      priority: task.priority,
      context: task.context ?? null,
      energy: task.energy ?? null,
      sourceType: 'gtdTask',
      sourceModule: 'tarefas',
    }
  }

  if (sourceType === 'routineTask') {
    const task = await prisma.task.findFirst({
      where: { id: sourceId, userId },
    })

    if (!task) return null

    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      dueDate: task.dueDate ?? null,
      estimatedMin: null,
      status: task.status,
      priority: task.priority,
      context: null,
      energy: null,
      sourceType: 'routineTask',
      sourceModule: 'rotina',
    }
  }

  if (sourceType === 'projectTask') {
    const task = await prisma.projectTask.findFirst({
      where: { id: sourceId, userId },
    })

    if (!task) return null

    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      dueDate: task.dueDate ?? null,
      estimatedMin: task.estimatedMin ?? null,
      status: task.status,
      priority: task.priority,
      context: null,
      energy: null,
      sourceType: 'projectTask',
      sourceModule: 'trabalho',
    }
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: sourceId, userId },
  })

  if (!assignment) return null

  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description ?? null,
    dueDate: assignment.dueDate ?? null,
    estimatedMin: null,
    status: assignment.status,
    priority: assignment.priority,
    context: null,
    energy: null,
    sourceType: 'assignment',
    sourceModule: 'faculdade',
  }
}

export async function syncPlannerSourceSchedule({
  sourceType,
  sourceId,
  userId,
  scheduledStart,
}: {
  sourceType: PlannerSourceType
  sourceId: string
  userId: string
  scheduledStart: Date
}) {
  if (!isPlannerWritableSourceType(sourceType)) return null

  if (sourceType === 'gtdTask') {
    const nextBucket = getSuggestedGtdBucketForDate(scheduledStart)

    return prisma.gtdTask.update({
      where: { id: sourceId, userId },
      data: {
        dueDate: scheduledStart,
        ...(nextBucket ? { bucket: nextBucket } : {}),
      },
    })
  }

  if (sourceType === 'routineTask') {
    return prisma.task.update({
      where: { id: sourceId, userId },
      data: {
        dueDate: scheduledStart,
        status: 'IN_PROGRESS',
      },
    })
  }

  if (sourceType === 'projectTask') {
    const task = await prisma.projectTask.findFirst({
      where: { id: sourceId, userId },
      select: { status: true },
    })

    if (!task) return null

    return prisma.projectTask.update({
      where: { id: sourceId, userId },
      data: {
        dueDate: scheduledStart,
        status: task.status === 'BACKLOG' ? 'TODO' : task.status,
      },
    })
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: sourceId, userId },
    select: { status: true },
  })

  if (!assignment) return null

  return prisma.assignment.update({
    where: { id: sourceId, userId },
    data: {
      dueDate: scheduledStart,
      status: assignment.status === 'OVERDUE' ? 'IN_PROGRESS' : assignment.status,
    },
  })
}

export async function applyPlannerOriginAction({
  sourceType,
  sourceId,
  userId,
  action,
}: {
  sourceType: PlannerSourceType
  sourceId: string
  userId: string
  action: PlannerOriginAction
}) {
  if (!isPlannerWritableSourceType(sourceType)) return null

  const now = new Date()
  const source = await getPlannerWritableSource(sourceType, sourceId, userId)
  if (!source) return null

  const deferBase = source.dueDate && source.dueDate > now ? source.dueDate : now
  const targetDate =
    action === 'move-to-today'
      ? endOfDay(now)
      : action === 'move-to-week'
        ? endOfWeek(now, { weekStartsOn: 1 })
        : endOfDay(addDays(deferBase, 1))

  if (sourceType === 'gtdTask') {
    const suggestedBucket =
      action === 'move-to-today'
        ? 'TODAY'
        : action === 'move-to-week'
          ? 'THIS_WEEK'
          : getSuggestedGtdBucketForDate(targetDate) ?? 'SOMEDAY'

    return prisma.gtdTask.update({
      where: { id: sourceId, userId },
      data: {
        dueDate: targetDate,
        bucket: suggestedBucket,
      },
    })
  }

  if (sourceType === 'routineTask') {
    return prisma.task.update({
      where: { id: sourceId, userId },
      data: {
        dueDate: targetDate,
        status: action === 'defer' ? 'PENDING' : 'IN_PROGRESS',
      },
    })
  }

  if (sourceType === 'projectTask') {
    const task = await prisma.projectTask.findFirst({
      where: { id: sourceId, userId },
      select: { status: true },
    })

    if (!task) return null

    return prisma.projectTask.update({
      where: { id: sourceId, userId },
      data: {
        dueDate: targetDate,
        status: task.status === 'BACKLOG' && action !== 'defer' ? 'TODO' : task.status,
      },
    })
  }

  return prisma.assignment.update({
    where: { id: sourceId, userId },
    data: {
      dueDate: targetDate,
      status: action === 'defer' ? 'PENDING' : 'IN_PROGRESS',
    },
  })
}

export async function setPlannerOriginCompletion({
  sourceType,
  sourceId,
  userId,
  completed,
}: {
  sourceType: PlannerSourceType
  sourceId: string
  userId: string
  completed: boolean
}) {
  if (!isPlannerWritableSourceType(sourceType)) return null

  if (sourceType === 'gtdTask') {
    return prisma.gtdTask.update({
      where: { id: sourceId, userId },
      data: {
        status: completed ? 'COMPLETED' : 'PENDING',
      },
    })
  }

  if (sourceType === 'routineTask') {
    return prisma.task.update({
      where: { id: sourceId, userId },
      data: {
        status: completed ? 'COMPLETED' : 'PENDING',
      },
    })
  }

  if (sourceType === 'projectTask') {
    return prisma.projectTask.update({
      where: { id: sourceId, userId },
      data: {
        status: completed ? 'DONE' : 'TODO',
      },
    })
  }

  return prisma.assignment.update({
    where: { id: sourceId, userId },
    data: {
      status: completed ? 'SUBMITTED' : 'PENDING',
    },
  })
}
