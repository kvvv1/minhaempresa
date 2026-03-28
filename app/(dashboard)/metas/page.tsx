'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Target,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trash2,
  TrendingUp,
  Trophy,
  Activity,
  BarChart3,
  Key,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChatButton } from '@/components/ai/ChatButton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeyResult {
  id: string
  goalId: string
  title: string
  progress: number
  target: number
  unit: string | null
}

interface Goal {
  id: string
  title: string
  description: string | null
  category: string
  status: string
  progress: number
  targetDate: string | null
  quarter: number | null
  year: number | null
  keyResults: KeyResult[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  FINANCIAL: 'Financeiro',
  PERSONAL: 'Pessoal',
  PROFESSIONAL: 'Profissional',
  HEALTH: 'Saúde',
  RELATIONSHIPS: 'Relacionamentos',
  LEARNING: 'Aprendizado',
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  FINANCIAL:     { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/30',   bar: 'bg-blue-500' },
  PERSONAL:      { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', bar: 'bg-purple-500' },
  PROFESSIONAL:  { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', bar: 'bg-indigo-500' },
  HEALTH:        { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/30',  bar: 'bg-green-500' },
  RELATIONSHIPS: { bg: 'bg-pink-500/10',   text: 'text-pink-400',   border: 'border-pink-500/30',   bar: 'bg-pink-500' },
  LEARNING:      { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/30',  bar: 'bg-amber-500' },
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE:    { label: 'Ativa',     className: 'bg-blue-500/20 text-blue-400' },
  COMPLETED: { label: 'Concluída', className: 'bg-green-500/20 text-green-400' },
  PAUSED:    { label: 'Pausada',   className: 'bg-yellow-500/20 text-yellow-400' },
  CANCELLED: { label: 'Cancelada', className: 'bg-red-500/20 text-red-400' },
}

const CATEGORIES = Object.keys(CATEGORY_LABELS)
const QUARTERS = [1, 2, 3, 4]
const CURRENT_YEAR = new Date().getFullYear()

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onRefresh,
}: {
  goal: Goal
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [addKrOpen, setAddKrOpen] = useState(false)
  const [editStatusOpen, setEditStatusOpen] = useState(false)
  const [krForm, setKrForm] = useState({ title: '', target: '100', unit: '' })
  const [localKrs, setLocalKrs] = useState<KeyResult[]>(goal.keyResults)
  const [updatingKr, setUpdatingKr] = useState<string | null>(null)
  const colors = CATEGORY_COLORS[goal.category] || CATEGORY_COLORS.PERSONAL
  const status = STATUS_CONFIG[goal.status] || STATUS_CONFIG.ACTIVE

  useEffect(() => {
    setLocalKrs(goal.keyResults)
  }, [goal.keyResults])

  async function handleAddKr(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/metas/key-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalId: goal.id,
        title: krForm.title,
        target: parseFloat(krForm.target) || 100,
        unit: krForm.unit || null,
      }),
    })
    if (res.ok) {
      toast.success('Key Result adicionado!')
      setAddKrOpen(false)
      setKrForm({ title: '', target: '100', unit: '' })
      onRefresh()
    } else {
      toast.error('Erro ao adicionar Key Result.')
    }
  }

  async function handleKrProgress(kr: KeyResult, value: number) {
    setUpdatingKr(kr.id)
    setLocalKrs(prev => prev.map(k => k.id === kr.id ? { ...k, progress: value } : k))
    const res = await fetch('/api/metas/key-results', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kr.id, progress: value }),
    })
    setUpdatingKr(null)
    if (!res.ok) {
      toast.error('Erro ao atualizar progresso.')
      setLocalKrs(goal.keyResults)
    } else {
      onRefresh()
    }
  }

  async function handleDeleteKr(krId: string) {
    const res = await fetch('/api/metas/key-results', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: krId }),
    })
    if (res.ok) {
      toast.success('Key Result removido.')
      onRefresh()
    } else {
      toast.error('Erro ao remover Key Result.')
    }
  }

  async function handleDeleteGoal() {
    if (!confirm('Deletar esta meta?')) return
    const res = await fetch(`/api/metas/goals/${goal.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Meta deletada.')
      onRefresh()
    } else {
      toast.error('Erro ao deletar meta.')
    }
  }

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/metas/goals/${goal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      toast.success('Status atualizado!')
      setEditStatusOpen(false)
      onRefresh()
    } else {
      toast.error('Erro ao atualizar status.')
    }
  }

  const progressPct = Math.round(goal.progress)

  return (
    <Card className={cn('border', colors.border)}>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', colors.bg, colors.text)}>
                {CATEGORY_LABELS[goal.category]}
              </span>
              <button
                onClick={() => setEditStatusOpen(true)}
                className={cn('text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity', status.className)}
              >
                {status.label}
              </button>
              {goal.quarter && (
                <span className="text-xs text-muted-foreground">
                  Q{goal.quarter}/{goal.year}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-sm leading-snug">{goal.title}</h3>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setExpanded(e => !e)}
              className="text-muted-foreground"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={handleDeleteGoal}
              className="text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso geral</span>
            <span className={cn('font-medium', colors.text)}>{progressPct}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
        </div>

        {/* Target date */}
        {goal.targetDate && (
          <p className="text-xs text-muted-foreground">
            Prazo: {format(new Date(goal.targetDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        )}

        {/* Key Results (collapsed summary) */}
        {!expanded && localKrs.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Key className="w-3 h-3" />
            <span>{localKrs.filter(k => k.progress >= k.target).length}/{localKrs.length} Key Results concluídos</span>
          </div>
        )}

        {/* Expanded key results */}
        {expanded && (
          <div className="space-y-3 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Results</p>
              <Dialog open={addKrOpen} onOpenChange={setAddKrOpen}>
                <DialogTrigger
                  render={
                    <Button size="xs" variant="ghost" className={cn('h-6 text-xs', colors.text)}>
                      <Plus className="w-3 h-3 mr-1" />
                      Adicionar KR
                    </Button>
                  }
                />
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Novo Key Result</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddKr} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Título do KR</Label>
                      <Input
                        placeholder="Ex: Economizar R$ 10.000"
                        value={krForm.title}
                        onChange={e => setKrForm(f => ({ ...f, title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Meta (target)</Label>
                        <Input
                          type="number"
                          placeholder="100"
                          value={krForm.target}
                          onChange={e => setKrForm(f => ({ ...f, target: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unidade (opcional)</Label>
                        <Input
                          placeholder="%, km, R$..."
                          value={krForm.unit}
                          onChange={e => setKrForm(f => ({ ...f, unit: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancelar</DialogClose>
                      <Button type="submit" className="flex-1">Adicionar</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {localKrs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum Key Result. Adicione resultados mensuráveis para esta meta.
              </p>
            ) : (
              <div className="space-y-3">
                {localKrs.map(kr => {
                  const pct = Math.min(100, (kr.progress / kr.target) * 100)
                  const done = kr.progress >= kr.target
                  return (
                    <div key={kr.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <CheckCircle2
                            className={cn('w-3.5 h-3.5 shrink-0', done ? 'text-green-400' : 'text-muted-foreground')}
                          />
                          <span className="text-xs text-muted-foreground truncate">{kr.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-medium tabular-nums">
                            {Math.round(kr.progress)}/{kr.target}{kr.unit}
                          </span>
                          <button
                            onClick={() => handleDeleteKr(kr.id)}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={kr.target}
                          step={kr.target / 100 > 1 ? Math.ceil(kr.target / 100) : 1}
                          value={kr.progress}
                          disabled={updatingKr === kr.id}
                          onChange={e => setLocalKrs(prev =>
                            prev.map(k => k.id === kr.id ? { ...k, progress: Number(e.target.value) } : k)
                          )}
                          onMouseUp={e => handleKrProgress(kr, Number((e.target as HTMLInputElement).value))}
                          onTouchEnd={e => handleKrProgress(kr, Number((e.target as HTMLInputElement).value))}
                          className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Status dialog */}
      <Dialog open={editStatusOpen} onOpenChange={setEditStatusOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Alterar Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => handleStatusChange(key)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  goal.status === key
                    ? cn(cfg.className, 'ring-1 ring-current')
                    : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MetasPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [addGoalOpen, setAddGoalOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [chiefOfStaff, setChiefOfStaff] = useState<{ name: string } | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'PERSONAL',
    targetDate: '',
    quarter: '',
    year: String(CURRENT_YEAR),
  })

  const fetchGoals = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterStatus !== 'ALL') params.set('status', filterStatus)
    if (filterCategory !== 'ALL') params.set('category', filterCategory)
    const res = await fetch(`/api/metas/goals?${params.toString()}`)
    if (res.ok) setGoals(await res.json())
    setLoading(false)
  }, [filterCategory, filterStatus])

  useEffect(() => {
    fetchGoals()
    fetch('/api/employees?role=CHIEF_OF_STAFF').then(r => r.ok ? r.json() : null).then(d => { if (d?.[0]) setChiefOfStaff(d[0]) })
  }, [fetchGoals])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/metas/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        quarter: form.quarter ? parseInt(form.quarter) : null,
        year: parseInt(form.year) || CURRENT_YEAR,
        targetDate: form.targetDate || null,
      }),
    })
    if (res.ok) {
      toast.success('Meta criada!')
      setAddGoalOpen(false)
      setForm({ title: '', description: '', category: 'PERSONAL', targetDate: '', quarter: '', year: String(CURRENT_YEAR) })
      fetchGoals()
    } else {
      toast.error('Erro ao criar meta.')
    }
  }

  // Stats
  const total = goals.length
  const completed = goals.filter(g => g.status === 'COMPLETED').length
  const active = goals.filter(g => g.status === 'ACTIVE').length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const avgProgress = active > 0
    ? Math.round(goals.filter(g => g.status === 'ACTIVE').reduce((s, g) => s + g.progress, 0) / active)
    : 0

  // Group by category
  const byCategory = CATEGORIES.reduce<Record<string, Goal[]>>((acc, cat) => {
    const filtered = goals.filter(g => g.category === cat)
    if (filtered.length > 0) acc[cat] = filtered
    return acc
  }, {})

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Metas & OKRs</h1>
          <p className="text-muted-foreground text-sm">CEO — Planejamento estratégico de vida</p>
        </div>
        <div className="flex items-center gap-2">
          {chiefOfStaff && (
            <ChatButton
              employeeRole="CHIEF_OF_STAFF"
              employeeName={chiefOfStaff.name}
              moduleData={{ goals, total, active, completed, completionRate, avgProgress }}
            />
          )}
        <Dialog open={addGoalOpen} onOpenChange={setAddGoalOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Nova Meta
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Nova Meta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>Título *</Label>
                <Input
                  placeholder="Ex: Alcançar independência financeira"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva sua meta em detalhe..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select
                    value={form.category}
                    onValueChange={v => setForm(f => ({ ...f, category: v ?? f.category }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={form.targetDate}
                    onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Trimestre</Label>
                  <Select
                    value={form.quarter}
                    onValueChange={v => setForm(f => ({ ...f, quarter: v ?? '' }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {QUARTERS.map(q => (
                        <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    min={2020}
                    max={2040}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>
                  Cancelar
                </DialogClose>
                <Button type="submit" className="flex-1">Criar Meta</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total de Metas</p>
            </div>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-muted-foreground">Em Progresso</p>
            </div>
            <p className="text-2xl font-bold text-blue-400">{active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-green-400" />
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
            <p className="text-2xl font-bold text-green-400">{completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <p className="text-xs text-muted-foreground">Taxa de Conclusão</p>
            </div>
            <p className="text-2xl font-bold text-indigo-400">{completionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress summary (active) */}
      {active > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Progresso médio das metas ativas</p>
              <span className="text-sm font-bold text-indigo-400">{avgProgress}%</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">Filtrar:</span>
        <div className="flex flex-wrap gap-1.5">
          {['ALL', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                'text-xs px-3 py-1 rounded-full border transition-colors',
                filterCategory === cat
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'border-border text-muted-foreground hover:border-indigo-400 hover:text-indigo-400'
              )}
            >
              {cat === 'ALL' ? 'Todas' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 ml-2">
          {['ALL', 'ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'text-xs px-3 py-1 rounded-full border transition-colors',
                filterStatus === s
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'border-border text-muted-foreground hover:border-indigo-400 hover:text-indigo-400'
              )}
            >
              {s === 'ALL' ? 'Status' : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Goals by Category */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-2 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">Nenhuma meta encontrada</p>
            <p className="text-sm text-muted-foreground">
              {filterCategory !== 'ALL' || filterStatus !== 'ALL'
                ? 'Tente remover os filtros ou '
                : ''}
              Crie sua primeira meta clicando em "Nova Meta".
            </p>
          </CardContent>
        </Card>
      ) : filterCategory !== 'ALL' ? (
        // Flat list when filtered by single category
        <div className="space-y-3">
          {goals.map(goal => (
            <GoalCard key={goal.id} goal={goal} onRefresh={fetchGoals} />
          ))}
        </div>
      ) : (
        // Grouped by category
        <div className="space-y-6">
          {Object.entries(byCategory).map(([cat, catGoals]) => {
            const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.PERSONAL
            return (
              <div key={cat} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', colors.bar)} />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <span className="text-xs text-muted-foreground">({catGoals.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {catGoals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} onRefresh={fetchGoals} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
