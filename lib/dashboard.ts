import type { PlannerResponse } from './planner'

export interface DashboardBriefingMeta {
  updatedAt: string | null
  cached: boolean
  source: 'ai' | 'manual'
  frozen: boolean
  collapsed: boolean
}

export interface DashboardValuation {
  id: string
  value: number
  scores: Record<string, number>
  date: string
  insights: string[]
}

export interface DashboardStats {
  monthlyBalance: number
  activeHabits: number
  activeGoals: number
  pendingFollowups: number
  lastWorkoutDaysAgo: number | null
  todayHydrationPct: number
  pendingAssignments: number
  avgGrade: number | null
  activeProjects: number
  overdueTasksCount: number
  inboxCount: number
  todayTasksCount: number
}

export interface DashboardPayload {
  briefing: string
  briefingMeta: DashboardBriefingMeta
  chiefOfStaff: { name: string } | null
  valuation: DashboardValuation | null
  stats: DashboardStats
  plannerToday: PlannerResponse
}
