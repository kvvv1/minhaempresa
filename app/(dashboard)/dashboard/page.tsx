'use client'

import { useState, useEffect } from 'react'
import { addDays, addMonths, addWeeks, format, isSameDay, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp, Target, Calendar, Users, BookOpen,
  Sparkles, RefreshCw, Building2, ArrowUpRight,
  MessageSquare, Activity, Salad, GraduationCap,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Briefcase, ListTodo, BookMarked
} from 'lucide-react'
import { formatCurrency, getScoreColor, cn } from '@/lib/utils'
import { CrisisAlert } from '@/components/crisis/CrisisAlert'
import { ChatButton } from '@/components/ai/ChatButton'
import { ChatRichText } from '@/components/ai/ChatRichText'
import { PlannerMonthBoard, PlannerSummaryCards, PlannerTimelineCard, PlannerTodayBoard, PlannerWeekBoard } from '@/components/planner/PlannerViews'
import { PLANNER_MODULE_CONFIG, type PlannerModule, type PlannerResponse, type PlannerScope } from '@/lib/planner'
import type { DashboardPayload, DashboardValuation } from '@/lib/dashboard'

const moduleCards = [
  { name: 'Financeiro',      href: '/financeiro',    icon: TrendingUp,    key: 'financeiro',    color: 'text-blue-400' },
  { name: 'Metas',           href: '/metas',         icon: Target,        key: 'metas',         color: 'text-emerald-400' },
  { name: 'Relacionamentos', href: '/relacionamentos',icon: Users,        key: 'relacionamentos',color: 'text-pink-400' },
  { name: 'Desenvolvimento', href: '/desenvolvimento',icon: BookOpen,     key: 'desenvolvimento',color: 'text-amber-400' },
  { name: 'Diário CEO',      href: '/diario',        icon: BookMarked,    key: 'diario',        color: 'text-slate-400' },
  { name: 'Saúde & Fitness', href: '/saude',         icon: Activity,      key: 'saude',         color: 'text-emerald-400' },
  { name: 'Nutrição',        href: '/nutricao',      icon: Salad,         key: 'nutricao',      color: 'text-lime-400' },
  { name: 'Faculdade',       href: '/faculdade',     icon: GraduationCap, key: 'faculdade',     color: 'text-violet-400' },
  { name: 'Trabalho',        href: '/trabalho',      icon: Briefcase,     key: 'trabalho',      color: 'text-orange-400' },
  { name: 'Central',         href: '/tarefas',       icon: ListTodo,      key: 'tarefas',       color: 'text-sky-400' },
]

type DashboardPlannerView = PlannerScope | 'agenda'
type DashboardPlannerModuleFilter = 'all' | PlannerModule

const operationalModuleFilters: { value: DashboardPlannerModuleFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'Tudo', icon: Sparkles },
  { value: 'tarefas', label: 'Tarefas', icon: ListTodo },
  { value: 'rotina', label: 'Rotina', icon: Calendar },
  { value: 'trabalho', label: 'Trabalho', icon: Briefcase },
  { value: 'faculdade', label: 'Faculdade', icon: GraduationCap },
  { value: 'saude', label: 'Saude', icon: Activity },
  { value: 'nutricao', label: 'Nutricao', icon: Salad },
  { value: 'metas', label: 'Metas', icon: Target },
]

function getPlannerScopeForView(view: DashboardPlannerView): PlannerScope {
  return view === 'agenda' ? 'today' : view
}

function getPlannerWindowLabel(view: DashboardPlannerView, anchorDate: Date) {
  if (view === 'month') {
    return format(anchorDate, "MMMM 'de' yyyy", { locale: ptBR })
  }

  if (view === 'week') {
    return `Semana de ${format(anchorDate, "d 'de' MMM", { locale: ptBR })}`
  }

  return format(anchorDate, "d 'de' MMMM", { locale: ptBR })
}

function shiftPlannerAnchor(anchorDate: Date, view: DashboardPlannerView, direction: 1 | -1) {
  if (view === 'month') return addMonths(anchorDate, direction)
  if (view === 'week') return addWeeks(anchorDate, direction)
  return addDays(anchorDate, direction)
}

function filterPlannerResponse(data: PlannerResponse, moduleFilter: DashboardPlannerModuleFilter): PlannerResponse {
  if (moduleFilter === 'all') return data

  const matchesModule = <T extends { sourceModule: PlannerModule }>(items: T[]) => items.filter((item) => item.sourceModule === moduleFilter)
  const filteredHabits = moduleFilter === 'rotina' ? data.habits : []
  const items = matchesModule(data.items)
  const scheduledItems = matchesModule(data.scheduledItems)
  const focusItems = matchesModule(data.focusItems)
  const overdueItems = matchesModule(data.overdueItems)

  return {
    ...data,
    items,
    scheduledItems,
    focusItems,
    overdueItems,
    habits: filteredHabits,
    summary: {
      inboxCount: moduleFilter === 'tarefas' ? data.summary.inboxCount : 0,
      focusCount: focusItems.length,
      scheduledCount: scheduledItems.length,
      overdueCount: overdueItems.length,
      habitsDueCount: filteredHabits.length,
      habitsCompletedCount: filteredHabits.filter((habit) => habit.completedToday).length,
    },
  }
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [loadingValuation, setLoadingValuation] = useState(false)
  const [loadingBriefingRefresh, setLoadingBriefingRefresh] = useState(false)
  const [savingBriefing, setSavingBriefing] = useState(false)
  const [briefingCollapsed, setBriefingCollapsed] = useState(false)
  const [editingBriefing, setEditingBriefing] = useState(false)
  const [briefingDraft, setBriefingDraft] = useState('')
  const [plannerView, setPlannerView] = useState<DashboardPlannerView>('today')
  const [plannerModuleFilter, setPlannerModuleFilter] = useState<DashboardPlannerModuleFilter>('all')
  const [plannerAnchorDate, setPlannerAnchorDate] = useState(() => startOfDay(new Date()))
  const [plannerData, setPlannerData] = useState<PlannerResponse | null>(null)
  const [loadingPlanner, setLoadingPlanner] = useState(true)

  useEffect(() => {
    void fetchDashboard()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchPlannerData() {
      const isTodaySeed =
        plannerView === 'today' &&
        dashboard?.plannerToday &&
        isSameDay(plannerAnchorDate, new Date())

      if (isTodaySeed) {
        setPlannerData(dashboard.plannerToday)
        setLoadingPlanner(false)
        return
      }

      setLoadingPlanner(true)

      try {
        const scope = getPlannerScopeForView(plannerView)
        const query = new URLSearchParams({
          scope,
          date: format(plannerAnchorDate, 'yyyy-MM-dd'),
        })

        const res = await fetch(`/api/planner?${query.toString()}`)
        if (!res.ok) return

        const nextData: PlannerResponse = await res.json()
        if (!cancelled) {
          setPlannerData(nextData)
        }
      } finally {
        if (!cancelled) {
          setLoadingPlanner(false)
        }
      }
    }

    void fetchPlannerData()

    return () => {
      cancelled = true
    }
  }, [dashboard?.plannerToday, plannerAnchorDate, plannerView])

  async function fetchDashboard() {
    setLoadingDashboard(true)
    const res = await fetch('/api/dashboard')
    if (res.ok) {
      setDashboard(await res.json())
    }
    setLoadingDashboard(false)
  }

  async function recalculateValuation() {
    setLoadingValuation(true)
    const res = await fetch('/api/valuation', { method: 'POST' })
    if (res.ok) {
      const data: DashboardValuation = await res.json()
      setDashboard((current) => current ? { ...current, valuation: data } : current)
    }
    setLoadingValuation(false)
  }

  async function refreshBriefing() {
    setLoadingBriefingRefresh(true)
    const res = await fetch('/api/ai/briefing', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setDashboard((current) => current ? {
        ...current,
        briefing: data.briefing,
        briefingMeta: {
          updatedAt: data.updatedAt,
          cached: data.cached,
          source: data.source,
          frozen: data.frozen,
          collapsed: data.collapsed,
        },
      } : current)
      setEditingBriefing(false)
    }
    setLoadingBriefingRefresh(false)
  }

  async function saveBriefing() {
    const content = briefingDraft.trim()
    if (!content) return

    setSavingBriefing(true)
    const res = await fetch('/api/ai/briefing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    if (res.ok) {
      const data = await res.json()
      setDashboard((current) => current ? {
        ...current,
        briefing: data.briefing,
        briefingMeta: {
          updatedAt: data.updatedAt,
          cached: data.cached,
          source: data.source,
          frozen: data.frozen,
          collapsed: data.collapsed,
        },
      } : current)
      setEditingBriefing(false)
    }

    setSavingBriefing(false)
  }

  function toggleBriefingCollapsed() {
    setBriefingCollapsed((current) => {
      const next = !current
      void fetch('/api/ai/briefing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collapsed: next }),
      })
      setDashboard((dashboardCurrent) => dashboardCurrent ? {
        ...dashboardCurrent,
        briefingMeta: {
          ...dashboardCurrent.briefingMeta,
          collapsed: next,
        },
      } : dashboardCurrent)
      return next
    })
  }

  const briefing = dashboard?.briefing ?? ''
  const briefingMeta = dashboard?.briefingMeta ?? null
  const valuation = dashboard?.valuation ?? null
  const stats = dashboard?.stats ?? null
  const chiefOfStaff = dashboard?.chiefOfStaff ?? null
  const operationalPlanner = plannerData ? filterPlannerResponse(plannerData, plannerModuleFilter) : null

  function startBriefingEdit() {
    setBriefingDraft(briefing)
    setEditingBriefing(true)
    setBriefingCollapsed(false)
  }

  useEffect(() => {
    if (dashboard?.briefingMeta) {
      setBriefingCollapsed(dashboard.briefingMeta.collapsed)
    }
  }, [dashboard?.briefingMeta])

  function navigatePlanner(direction: 1 | -1) {
    setPlannerAnchorDate((current) => shiftPlannerAnchor(current, plannerView, direction))
  }

  function resetPlannerDate() {
    setPlannerAnchorDate(startOfDay(new Date()))
  }

  return (
    <div className="space-y-6">
      {/* Crisis Alert */}
      {valuation?.scores && Object.keys(valuation.scores).length > 0 && (
        <CrisisAlert scores={valuation.scores} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard CEO</h1>
          <p className="text-muted-foreground text-sm">Visao geral da sua empresa pessoal</p>
        </div>
        <div className="flex items-center gap-2">
          {chiefOfStaff && (
            <ChatButton
              employeeRole="CHIEF_OF_STAFF"
              employeeName={chiefOfStaff.name}
              moduleData={{ briefing, valuation, stats }}
            />
          )}
          <Link href="/board-meeting">
            <Button variant="outline" size="sm">
              <MessageSquare className="w-4 h-4 mr-2" />
              Board Meeting
            </Button>
          </Link>
        </div>
      </div>

      {/* Briefing */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Briefing Matinal
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {briefingMeta?.updatedAt && (
                  <span>Atualizado em {format(new Date(briefingMeta.updatedAt), "dd/MM 'as' HH:mm")}</span>
                )}
                {briefingMeta?.source === 'manual' && <Badge variant="secondary">Versao manual</Badge>}
                {briefingMeta?.frozen && <Badge variant="outline">Fixado hoje</Badge>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={startBriefingEdit}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={refreshBriefing}
                disabled={loadingBriefingRefresh}
              >
                <RefreshCw className={cn('w-3 h-3', loadingBriefingRefresh && 'animate-spin')} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleBriefingCollapsed}>
                {briefingCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {!briefingCollapsed && (
          <CardContent>
            {loadingDashboard ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ) : editingBriefing ? (
              <div className="space-y-3">
                <Textarea
                  value={briefingDraft}
                  onChange={(event) => setBriefingDraft(event.target.value)}
                  className="min-h-48 bg-background/70"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingBriefing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={saveBriefing} disabled={savingBriefing || briefingDraft.trim().length === 0}>
                    {savingBriefing ? 'Salvando...' : 'Salvar e fixar'}
                  </Button>
                </div>
              </div>
            ) : (
              <ChatRichText content={briefing} tone="default" />
            )}
          </CardContent>
        )}
      </Card>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 md:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Radar Operacional</p>
                <h2 className="text-xl font-semibold">Calendario executivo com tudo que pede atencao</h2>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Tarefas, faculdade, trabalho, calendario e treinos no mesmo resumo para voce decidir a semana sem trocar de modulo.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="h-9 px-3 text-sm">
                  {getPlannerWindowLabel(plannerView, plannerAnchorDate)}
                </Badge>
                <Button variant="outline" size="sm" onClick={resetPlannerDate}>
                  Hoje
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePlanner(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePlanner(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Link href="/tarefas">
                  <Button size="sm">Abrir Central Operacional</Button>
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <Tabs value={plannerView} onValueChange={(value) => setPlannerView(value as DashboardPlannerView)}>
                <TabsList className="flex h-auto flex-wrap gap-1">
                  <TabsTrigger value="today">Hoje</TabsTrigger>
                  <TabsTrigger value="week">Semana</TabsTrigger>
                  <TabsTrigger value="month">Mes</TabsTrigger>
                  <TabsTrigger value="agenda">Agenda 24h</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-wrap gap-2">
                {operationalModuleFilters.map((filter) => {
                  const active = plannerModuleFilter === filter.value

                  return (
                    <Button
                      key={filter.value}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'gap-2',
                        !active && filter.value !== 'all' && PLANNER_MODULE_CONFIG[filter.value].className,
                      )}
                      onClick={() => setPlannerModuleFilter(filter.value)}
                    >
                      <filter.icon className="h-3.5 w-3.5" />
                      {filter.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {loadingPlanner && !operationalPlanner ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : operationalPlanner ? (
          <>
            <PlannerSummaryCards summary={operationalPlanner.summary} />

            {plannerView === 'today' ? (
              <PlannerTodayBoard data={operationalPlanner} />
            ) : plannerView === 'week' ? (
              <PlannerWeekBoard data={operationalPlanner} />
            ) : plannerView === 'month' ? (
              <PlannerMonthBoard data={operationalPlanner} />
            ) : (
              <PlannerTimelineCard
                title="Agenda 24h"
                description="Linha do dia com blocos, itens sem horario e habitos previstos para o recorte selecionado."
                scheduledItems={operationalPlanner.scheduledItems}
                floatingItems={operationalPlanner.focusItems}
                habits={operationalPlanner.habits}
              />
            )}
          </>
        ) : null}
      </div>

      {/* Valuation + Scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Valuation
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={recalculateValuation}
                disabled={loadingValuation}
              >
                <RefreshCw className={cn('w-3 h-3', loadingValuation && 'animate-spin')} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-2">
              <p className={cn('text-5xl font-bold', getScoreColor(valuation?.value || 0))}>
                {valuation ? Math.round(valuation.value) : '--'}
              </p>
              <p className="text-xs text-muted-foreground">Score da empresa / 100</p>
              {valuation?.insights && (
                <div className="mt-3 space-y-1 text-left">
                  {(valuation.insights as string[]).map((insight: string, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground flex gap-1">
                      <span className="text-primary">•</span> {insight}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Saúde por Departamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {moduleCards.map((mod) => {
              const score = valuation?.scores?.[mod.key] || 0
              return (
                <div key={mod.key} className="flex items-center gap-3">
                  <mod.icon className={cn('w-4 h-4 flex-shrink-0', mod.color)} />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{mod.name}</span>
                      <span className={getScoreColor(score)}>{Math.round(score)}</span>
                    </div>
                    <Progress value={score} className="h-1.5" />
                  </div>
                  <Link href={mod.href}>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </Link>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Saldo do Mês</p>
            <p className={cn('text-xl font-bold mt-1', (stats.monthlyBalance || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatCurrency(stats.monthlyBalance || 0)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Hábitos Ativos</p>
            <p className="text-xl font-bold mt-1 text-purple-400">{stats.activeHabits || 0}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Metas Ativas</p>
            <p className="text-xl font-bold mt-1 text-emerald-400">{stats.activeGoals || 0}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Follow-ups</p>
            <p className="text-xl font-bold mt-1 text-pink-400">{stats.pendingFollowups || 0}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Último Treino</p>
            <p className={cn('text-xl font-bold mt-1', (stats.lastWorkoutDaysAgo ?? 0) > 3 ? 'text-orange-400' : 'text-emerald-400')}>
              {stats.lastWorkoutDaysAgo != null ? `${stats.lastWorkoutDaysAgo}d` : '—'}
            </p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Trabalhos Pendentes</p>
            <p className={cn('text-xl font-bold mt-1', (stats.pendingAssignments || 0) > 0 ? 'text-orange-400' : 'text-emerald-400')}>{stats.pendingAssignments || 0}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Projetos Ativos</p>
            <p className="text-xl font-bold mt-1 text-orange-400">{stats.activeProjects || 0}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Tarefas Hoje</p>
            <p className="text-xl font-bold mt-1 text-sky-400">{stats.todayTasksCount || 0}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Module Cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Departamentos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {moduleCards.map((mod) => (
            <Link key={mod.href} href={mod.href}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer group">
                <CardContent className="pt-4 pb-4 flex flex-col items-center gap-2">
                  <div className={cn('p-2 rounded-lg bg-muted/30 group-hover:bg-primary/10 transition-colors')}>
                    <mod.icon className={cn('w-5 h-5', mod.color)} />
                  </div>
                  <p className="text-xs font-medium text-center">{mod.name}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
