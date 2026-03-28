'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp, Target, Calendar, Users, BookOpen,
  Sparkles, RefreshCw, Building2, ArrowUpRight,
  MessageSquare, Activity, Salad, GraduationCap,
  Briefcase, ListTodo, BookMarked
} from 'lucide-react'
import { formatCurrency, getScoreColor, cn } from '@/lib/utils'
import Link from 'next/link'
import { CrisisAlert } from '@/components/crisis/CrisisAlert'
import { ChatButton } from '@/components/ai/ChatButton'
import { ChatRichText } from '@/components/ai/ChatRichText'
import { PlannerSummaryCards, PlannerTodayBoard } from '@/components/planner/PlannerViews'
import type { PlannerResponse } from '@/lib/planner'

const moduleCards = [
  { name: 'Financeiro',      href: '/financeiro',    icon: TrendingUp,    key: 'financeiro',    color: 'text-blue-400' },
  { name: 'Metas',           href: '/metas',         icon: Target,        key: 'metas',         color: 'text-emerald-400' },
  { name: 'Rotina',          href: '/rotina',        icon: Calendar,      key: 'rotina',        color: 'text-purple-400' },
  { name: 'Relacionamentos', href: '/relacionamentos',icon: Users,        key: 'relacionamentos',color: 'text-pink-400' },
  { name: 'Desenvolvimento', href: '/desenvolvimento',icon: BookOpen,     key: 'desenvolvimento',color: 'text-amber-400' },
  { name: 'Diário CEO',      href: '/diario',        icon: BookMarked,    key: 'diario',        color: 'text-slate-400' },
  { name: 'Saúde & Fitness', href: '/saude',         icon: Activity,      key: 'saude',         color: 'text-emerald-400' },
  { name: 'Nutrição',        href: '/nutricao',      icon: Salad,         key: 'nutricao',      color: 'text-lime-400' },
  { name: 'Faculdade',       href: '/faculdade',     icon: GraduationCap, key: 'faculdade',     color: 'text-violet-400' },
  { name: 'Trabalho',        href: '/trabalho',      icon: Briefcase,     key: 'trabalho',      color: 'text-orange-400' },
  { name: 'Tarefas',         href: '/tarefas',       icon: ListTodo,      key: 'tarefas',       color: 'text-sky-400' },
]

export default function DashboardPage() {
  const [briefing, setBriefing] = useState('')
  const [loadingBriefing, setLoadingBriefing] = useState(true)
  const [valuation, setValuation] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loadingValuation, setLoadingValuation] = useState(false)
  const [chiefOfStaff, setChiefOfStaff] = useState<{ name: string } | null>(null)
  const [plannerToday, setPlannerToday] = useState<PlannerResponse | null>(null)

  useEffect(() => {
    fetchBriefing()
    fetchValuation()
    fetchStats()
    fetchPlannerToday()
    fetch('/api/employees?role=CHIEF_OF_STAFF').then(r => r.ok ? r.json() : null).then(d => { if (d?.[0]) setChiefOfStaff(d[0]) })
  }, [])

  async function fetchBriefing() {
    setLoadingBriefing(true)
    const res = await fetch('/api/ai/briefing')
    if (res.ok) {
      const data = await res.json()
      setBriefing(data.briefing)
    }
    setLoadingBriefing(false)
  }

  async function fetchValuation() {
    const res = await fetch('/api/valuation')
    if (res.ok) {
      const data = await res.json()
      if (data.length > 0) setValuation(data[0])
    }
  }

  async function fetchPlannerToday() {
    const res = await fetch('/api/planner?scope=today')
    if (res.ok) {
      setPlannerToday(await res.json())
    }
  }

  async function fetchStats() {
    const [transRes, habitRes, goalRes, contactRes, saudeRes, faculdadeRes, trabalhoRes, tarefasRes] = await Promise.all([
      fetch('/api/financeiro/transactions?period=month'),
      fetch('/api/rotina/habits'),
      fetch('/api/metas/goals?status=ACTIVE'),
      fetch('/api/relacionamentos/contacts?needsFollowup=true'),
      fetch('/api/saude'),
      fetch('/api/faculdade'),
      fetch('/api/trabalho'),
      fetch('/api/tarefas'),
    ])

    const stats: any = {}
    if (transRes.ok) {
      const transactions = await transRes.json()
      const income = transactions.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + t.amount, 0)
      const expense = transactions.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + t.amount, 0)
      stats.monthlyBalance = income - expense
    }
    if (habitRes.ok) stats.activeHabits = (await habitRes.json()).length
    if (goalRes.ok) stats.activeGoals = (await goalRes.json()).length
    if (contactRes.ok) stats.pendingFollowups = (await contactRes.json()).length
    if (saudeRes.ok) { const d = await saudeRes.json(); stats.lastWorkoutDaysAgo = d.lastWorkoutDaysAgo; stats.todayHydrationPct = d.todayHydrationPct }
    if (faculdadeRes.ok) { const d = await faculdadeRes.json(); stats.pendingAssignments = d.pendingAssignments; stats.avgGrade = d.avgGrade }
    if (trabalhoRes.ok) { const d = await trabalhoRes.json(); stats.activeProjects = d.activeProjects; stats.overdueTasksCount = d.overdueCount }
    if (tarefasRes.ok) { const d = await tarefasRes.json(); stats.inboxCount = d.bucketCounts?.INBOX ?? 0; stats.todayTasksCount = d.bucketCounts?.TODAY ?? 0 }

    setStats(stats)
  }

  async function recalculateValuation() {
    setLoadingValuation(true)
    const res = await fetch('/api/valuation', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setValuation(data)
    }
    setLoadingValuation(false)
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
          <p className="text-muted-foreground text-sm">Visão geral da sua empresa pessoal</p>
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
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Briefing Matinal
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={fetchBriefing}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBriefing ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : (
            <ChatRichText content={briefing} tone="default" />
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Meu Dia</h2>
            <p className="text-sm text-muted-foreground">Agenda, foco e pendencias conectadas entre os modulos.</p>
          </div>
          <Link href="/tarefas">
            <Button variant="outline" size="sm">
              Abrir Central Operacional
            </Button>
          </Link>
        </div>

        {plannerToday ? (
          <>
            <PlannerSummaryCards summary={plannerToday.summary} />
            <PlannerTodayBoard data={plannerToday} />
          </>
        ) : (
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
        )}
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
            <p className={cn('text-xl font-bold mt-1', stats.lastWorkoutDaysAgo > 3 ? 'text-orange-400' : 'text-emerald-400')}>
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
