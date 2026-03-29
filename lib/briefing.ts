import { endOfDay, startOfDay } from 'date-fns'
import { Prisma } from '@prisma/client'
import { generateDailyBriefing } from './claude'
import { prisma } from './prisma'
import { parseStoredObject } from './storage'

interface BriefingCacheEntry {
  content: string
  date: string
  updatedAt: string
  source: 'ai' | 'manual'
  frozen: boolean
}

interface UserBriefingPrefs extends Record<string, unknown> {
  dailyBriefing?: BriefingCacheEntry
  dailyBriefingCollapsed?: boolean
}

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function readCachedBriefing(notificationPrefs: unknown, today: Date) {
  const prefs = parseStoredObject<UserBriefingPrefs>(notificationPrefs, {})
  const cached = prefs.dailyBriefing
  if (!cached?.content) return null
  if (cached.date !== getDayKey(today)) return null
  return cached
}

function readBriefingCollapsed(notificationPrefs: unknown) {
  const prefs = parseStoredObject<UserBriefingPrefs>(notificationPrefs, {})
  return prefs.dailyBriefingCollapsed === true
}

async function saveBriefing(userId: string, notificationPrefs: unknown, content: string, today: Date) {
  return saveBriefingEntry(userId, notificationPrefs, {
    content,
    date: getDayKey(today),
    updatedAt: new Date().toISOString(),
    source: 'ai',
    frozen: false,
  })
}

async function saveBriefingEntry(
  userId: string,
  notificationPrefs: unknown,
  entry: BriefingCacheEntry
) {
  const prefs = parseStoredObject<UserBriefingPrefs>(notificationPrefs, {})
  prefs.dailyBriefing = entry

  await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: prefs as Prisma.InputJsonValue },
  })

  return prefs.dailyBriefing
}

async function buildBriefingContext(userId: string) {
  const today = new Date()

  const [user, chiefOfStaff, transactions, habits, habitLogs, tasks, contacts, goals, gtdTasksToday, urgentAssignments, inProgressTasks, lastWorkout, todayHydration] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, companyName: true, mission: true, notificationPrefs: true },
      }),
      prisma.employee.findFirst({
        where: { userId, role: 'CHIEF_OF_STAFF', isActive: true },
        select: { name: true, personality: true },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } },
        orderBy: { date: 'desc' },
        take: 20,
      }),
      prisma.habit.findMany({ where: { userId, isActive: true } }),
      prisma.habitLog.findMany({ where: { userId, date: { gte: startOfDay(today), lte: endOfDay(today) } } }),
      prisma.task.findMany({ where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] } }, orderBy: { dueDate: 'asc' }, take: 10 }),
      prisma.contact.findMany({
        where: { userId, OR: [{ lastContact: null }, { lastContact: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }] },
        take: 5,
      }),
      prisma.goal.findMany({ where: { userId, status: 'ACTIVE' }, include: { keyResults: true }, take: 5 }),
      prisma.gtdTask.findMany({ where: { userId, bucket: 'TODAY', status: { in: ['PENDING', 'IN_PROGRESS'] } }, take: 5 }),
      prisma.assignment.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
          dueDate: { lte: endOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)) },
        },
        include: { subject: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      prisma.projectTask.findMany({ where: { userId, status: 'IN_PROGRESS' }, include: { project: { select: { name: true } } }, take: 5 }),
      prisma.workout.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
      prisma.hydrationLog.findFirst({ where: { userId, date: { gte: startOfDay(today) } } }),
    ])

  return {
    today,
    user,
    chiefOfStaff,
    data: {
      user: { name: user?.name, companyName: user?.companyName, mission: user?.mission },
      financeiro: { transactions },
      rotina: { habits, todayLogs: habitLogs, tasks },
      relacionamentos: { contactsNeedingAttention: contacts },
      metas: { goals },
      tarefas: { urgentToday: gtdTasksToday },
      faculdade: { urgentAssignments },
      trabalho: { inProgressTasks },
      saude: {
        lastWorkoutDaysAgo: lastWorkout ? Math.floor((Date.now() - new Date(lastWorkout.date).getTime()) / 86400000) : null,
        todayHydrationPct: todayHydration ? Math.round((todayHydration.mlTotal / todayHydration.goalMl) * 100) : 0,
      },
    },
  }
}

export async function getDailyBriefing(userId: string, forceRefresh = false) {
  const context = await buildBriefingContext(userId)

  if (!context.chiefOfStaff) {
    return {
      briefing: 'Configure seu Chief of Staff no onboarding.',
      cached: false,
      updatedAt: null as string | null,
      source: 'ai' as const,
      frozen: false,
      collapsed: false,
    }
  }

  const cached = !forceRefresh
    ? readCachedBriefing(context.user?.notificationPrefs, context.today)
    : null

  if (cached) {
    return {
      briefing: cached.content,
      cached: true,
      updatedAt: cached.updatedAt,
      source: cached.source,
      frozen: cached.frozen,
      collapsed: readBriefingCollapsed(context.user?.notificationPrefs),
    }
  }

  const briefing = await generateDailyBriefing(
    { name: context.chiefOfStaff.name, role: 'CHIEF_OF_STAFF', personality: context.chiefOfStaff.personality },
    context.data
  )

  const saved = await saveBriefing(userId, context.user?.notificationPrefs, briefing, context.today)
  return {
    briefing,
    cached: false,
    updatedAt: saved.updatedAt,
    source: saved.source,
    frozen: saved.frozen,
    collapsed: readBriefingCollapsed(context.user?.notificationPrefs),
  }
}

export async function saveManualBriefing(userId: string, content: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  })

  const today = new Date()
  const saved = await saveBriefingEntry(userId, user?.notificationPrefs, {
    content: content.trim(),
    date: getDayKey(today),
    updatedAt: new Date().toISOString(),
    source: 'manual',
    frozen: true,
  })

  return {
    briefing: saved.content,
    cached: true,
    updatedAt: saved.updatedAt,
    source: saved.source,
    frozen: saved.frozen,
    collapsed: readBriefingCollapsed(user?.notificationPrefs),
  }
}

export async function setBriefingCollapsed(userId: string, collapsed: boolean) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  })

  const prefs = parseStoredObject<UserBriefingPrefs>(user?.notificationPrefs, {})
  prefs.dailyBriefingCollapsed = collapsed

  await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: prefs as Prisma.InputJsonValue },
  })

  return { collapsed }
}
