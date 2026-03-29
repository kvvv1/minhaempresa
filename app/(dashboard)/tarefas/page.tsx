'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addDays, addMinutes, addMonths, addWeeks,
  format, isSameDay, startOfDay, subDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Activity, Archive, ArrowRight, Bot, Briefcase, Calendar,
  CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Circle, ClipboardList, Clock, Flame, GraduationCap, Inbox,
  ListTodo, Plus, RotateCcw, Salad, Send, Sparkles, Star,
  Sunset, Tag, Target, Trash2, Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { ChatButton } from '@/components/ai/ChatButton'
import { ChatRichText } from '@/components/ai/ChatRichText'
import { PlannerActionMenu, type PlannerQuickAction } from '@/components/planner/PlannerActionMenu'
import {
  CalendarMonthView, CalendarWeekView,
  PlannerSummaryCards, PlannerTimelineCard, PlannerTodayBoard,
} from '@/components/planner/PlannerViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  PLANNER_MODULE_CONFIG,
  type PlannerItem, type PlannerModule,
  type PlannerResponse, type PlannerScope, type PlannerSourceType,
} from '@/lib/planner'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type GtdBucket = 'INBOX' | 'TODAY' | 'THIS_WEEK' | 'SOMEDAY' | 'WAITING' | 'REFERENCE'
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
type GtdEnergy = 'LOW' | 'MEDIUM' | 'HIGH'
type CalView = PlannerScope | 'agenda'
type ModuleFilter = 'all' | PlannerModule

interface GtdTask {
  id: string
  title: string
  description?: string
  bucket: GtdBucket
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  context?: string
  energy?: GtdEnergy
  estimatedMin?: number
  createdAt: string
}

interface Habit {
  id: string
  name: string
  description: string | null
  frequency: string
  streak: number
  bestStreak: number
  isActive: boolean
  logs: Array<{ id: string; date: string; completed: boolean }>
}

interface RotinaTask {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  isRecurring: boolean
}

interface ScheduleForm {
  mode: 'manual' | 'linked'
  eventId: string | null
  sourceId: string | null
  sourceType: PlannerSourceType | null
  sourceModule: PlannerModule | null
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  allDay: boolean
}

interface WeeklyReview {
  period: { start: string; end: string; label: string }
  metrics: {
    inboxCount: number
    overdueCount: number
    scheduledHours: number
    conflictCount: number
    overloadedDays: number
    lowBufferDays: number
  }
  nextActions: string[]
  topPriorities: Array<{ title: string; priority: string | null; dueDate: string | null; sourceModule: string }>
  suggestions: Array<{
    id: string
    title: string
    sourceType: PlannerSourceType
    sourceModule: string
    priority: string | null
    estimatedMin: number
    suggestedStart: string
    suggestedEnd: string
    score: number
    fitLabel: string
    impact: string
    rationale: string
  }>
  rebalances: Array<{
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
  }>
  conflicts: Array<{
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
  }>
  workload: { status: 'balanced' | 'medium' | 'high'; message: string }
  capacity: Array<{
    date: string
    label: string
    plannedHours: number
    meetingHours: number
    calendarHours: number
    remainingFocusHours: number
    conflictCount: number
    status: 'open' | 'busy' | 'overloaded'
  }>
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const BUCKET_CONFIG: Record<GtdBucket, { label: string; icon: React.ElementType; color: string }> = {
  INBOX:     { label: 'Inbox',       icon: Inbox,       color: 'text-slate-400' },
  TODAY:     { label: 'Hoje',        icon: Calendar,    color: 'text-red-400' },
  THIS_WEEK: { label: 'Esta Semana', icon: CalendarDays, color: 'text-orange-400' },
  SOMEDAY:   { label: 'Algum Dia',   icon: Sunset,      color: 'text-blue-400' },
  WAITING:   { label: 'Aguardando',  icon: Clock,       color: 'text-yellow-400' },
  REFERENCE: { label: 'Referência',  icon: Archive,     color: 'text-purple-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  LOW:    { label: 'Baixa',   color: 'text-slate-400',  dot: 'bg-slate-500' },
  MEDIUM: { label: 'Média',   color: 'text-blue-400',   dot: 'bg-blue-500' },
  HIGH:   { label: 'Alta',    color: 'text-orange-400', dot: 'bg-orange-500' },
  URGENT: { label: 'Urgente', color: 'text-red-400',    dot: 'bg-red-500' },
}

const ENERGY_CONFIG: Record<GtdEnergy, { label: string }> = {
  LOW:    { label: 'Baixa' },
  MEDIUM: { label: 'Média' },
  HIGH:   { label: 'Alta' },
}

const FREQ_LABELS: Record<string, string> = {
  DAILY: 'Diário', WEEKLY: 'Semanal', MONTHLY: 'Mensal',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente', IN_PROGRESS: 'Em Progresso',
  COMPLETED: 'Concluída', CANCELLED: 'Cancelada',
}

const MODULE_FILTERS: Array<{ value: ModuleFilter; label: string; icon: React.ElementType }> = [
  { value: 'all',       label: 'Tudo',      icon: Sparkles },
  { value: 'tarefas',   label: 'Tarefas',   icon: ListTodo },
  { value: 'rotina',    label: 'Rotina',    icon: Calendar },
  { value: 'trabalho',  label: 'Trabalho',  icon: Briefcase },
  { value: 'faculdade', label: 'Faculdade', icon: GraduationCap },
  { value: 'saude',     label: 'Saúde',     icon: Activity },
  { value: 'nutricao',  label: 'Nutrição',  icon: Salad },
  { value: 'metas',     label: 'Metas',     icon: Target },
]

const CALENDAR_COLORS = [
  '#6366f1', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#fb923c',
]

const LAST_7_DAYS = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i))

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toDateInput(d: Date) { return format(d, 'yyyy-MM-dd') }
function toTimeInput(d: Date) { return format(d, 'HH:mm') }

function nextHour(base = new Date()) {
  const d = new Date(base)
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

function buildDT(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function blankScheduleForm(): ScheduleForm {
  const s = nextHour()
  return {
    mode: 'manual', eventId: null, sourceId: null, sourceType: null, sourceModule: null,
    title: '', description: '', allDay: false,
    date: toDateInput(s), startTime: toTimeInput(s), endTime: toTimeInput(addMinutes(s, 60)),
  }
}

function scheduleFormFromItem(item: PlannerItem): ScheduleForm {
  const s = item.scheduledStart
    ? new Date(item.scheduledStart)
    : item.dueDate ? nextHour(new Date(item.dueDate)) : nextHour()
  const e = item.scheduledEnd
    ? new Date(item.scheduledEnd)
    : addMinutes(s, item.estimatedMin ?? 60)
  const isManual = item.sourceType === 'calendarEvent' || item.scheduleMode === 'manual'
  return {
    mode: isManual ? 'manual' : 'linked',
    eventId: item.scheduleEventId ?? (item.sourceType === 'calendarEvent' ? item.sourceId : null),
    sourceId: isManual ? null : item.sourceId,
    sourceType: isManual ? null : item.sourceType,
    sourceModule: isManual ? null : item.sourceModule,
    title: item.title,
    description: item.description ?? '',
    allDay: item.allDay ?? false,
    date: toDateInput(s),
    startTime: toTimeInput(s),
    endTime: toTimeInput(e),
  }
}

function filterPlanner(data: PlannerResponse, filter: ModuleFilter): PlannerResponse {
  if (filter === 'all') return data
  const keep = <T extends { sourceModule: PlannerModule }>(arr: T[]) =>
    arr.filter(i => i.sourceModule === filter)
  const habits = filter === 'rotina' ? data.habits : []
  const items = keep(data.items)
  const scheduledItems = keep(data.scheduledItems)
  const focusItems = keep(data.focusItems)
  const overdueItems = keep(data.overdueItems)
  return {
    ...data, items, scheduledItems, focusItems, overdueItems, habits,
    summary: {
      inboxCount: filter === 'tarefas' ? data.summary.inboxCount : 0,
      focusCount: focusItems.length,
      scheduledCount: scheduledItems.length,
      overdueCount: overdueItems.length,
      habitsDueCount: habits.length,
      habitsCompletedCount: habits.filter(h => h.completedToday).length,
    },
  }
}

function calWindowLabel(view: CalView, anchor: Date) {
  if (view === 'month') return format(anchor, "MMMM 'de' yyyy", { locale: ptBR })
  if (view === 'week') return `Semana de ${format(anchor, "d 'de' MMM", { locale: ptBR })}`
  return format(anchor, "EEEE, d 'de' MMMM", { locale: ptBR })
}

function shiftAnchor(anchor: Date, view: CalView, dir: 1 | -1): Date {
  if (view === 'month') return addMonths(anchor, dir)
  if (view === 'week') return addWeeks(anchor, dir)
  return addDays(anchor, dir)
}

function toScope(view: CalView): PlannerScope {
  return view === 'agenda' ? 'today' : view
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function DayDot({ habit, day }: { habit: Habit; day: Date }) {
  const dayStr = startOfDay(day).toDateString()
  const isToday = dayStr === startOfDay(new Date()).toDateString()
  const isFuture = day > new Date()
  const log = habit.logs.find(l => startOfDay(new Date(l.date)).toDateString() === dayStr)

  let bg = 'bg-slate-700'
  if (isFuture) bg = 'bg-slate-800 opacity-40'
  else if (log?.completed) bg = 'bg-green-500'
  else if (!isToday) bg = 'bg-red-500/60'

  return (
    <div
      title={format(day, 'd MMM', { locale: ptBR })}
      className={cn('w-6 h-6 rounded-md flex items-center justify-center', bg, isToday && 'ring-1 ring-white/30')}
    >
      {log?.completed && <Check className="w-3 h-3 text-white" />}
    </div>
  )
}

function HabitCard({ habit, onLog, onDelete }: {
  habit: Habit
  onLog: (id: string) => void
  onDelete: (id: string) => void
}) {
  const todayStr = startOfDay(new Date()).toDateString()
  const doneToday = habit.logs.some(
    l => startOfDay(new Date(l.date)).toDateString() === todayStr && l.completed
  )

  return (
    <Card className={cn(doneToday ? 'border-green-500/30 bg-green-500/5' : 'border-border')}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{habit.name}</h3>
              {doneToday && (
                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                  <Check className="w-3 h-3" /> Feito hoje
                </span>
              )}
            </div>
            {habit.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{habit.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge variant="outline" className="text-xs h-5">{FREQ_LABELS[habit.frequency]}</Badge>
              {habit.streak > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <Flame className="w-3 h-3" /> {habit.streak} dias
                </span>
              )}
              {habit.bestStreak > 1 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy className="w-3 h-3" /> Recorde: {habit.bestStreak}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {!doneToday && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                onClick={() => onLog(habit.id)}
              >
                <Check className="w-3 h-3 mr-1" /> Feito
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-red-400"
              onClick={() => onDelete(habit.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          <div className="flex gap-1">
            {LAST_7_DAYS.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {format(day, 'EEE', { locale: ptBR }).slice(0, 3)}
                </span>
                <DayDot habit={habit} day={day} />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RotinaTaskCard({ task, onStatusChange, onDelete }: {
  task: RotinaTask
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const p = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM
  const done = task.status === 'COMPLETED'
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && !done

  return (
    <Card className={cn('border transition-colors', done ? 'opacity-60' : overdue ? 'border-red-500/30' : 'border-border')}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => onStatusChange(task.id, done ? 'PENDING' : 'COMPLETED')}
            className={cn(
              'mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
              done ? 'bg-green-500 border-green-500' : 'border-muted-foreground hover:border-green-400'
            )}
          >
            {done && <Check className="w-2.5 h-2.5 text-white" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>
                {task.title}
              </span>
              <span className="flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full', p.dot)} />
                <span className={cn('text-xs', p.color)}>{p.label}</span>
              </span>
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {task.dueDate && (
                <span className={cn('text-xs', overdue ? 'text-red-400' : 'text-muted-foreground')}>
                  {overdue ? '⚠ ' : ''}Prazo: {format(new Date(task.dueDate), 'd MMM', { locale: ptBR })}
                </span>
              )}
              {task.isRecurring && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RotateCcw className="w-3 h-3" /> Recorrente
                </span>
              )}
              <Badge variant="outline" className={cn('text-xs h-4', task.status === 'IN_PROGRESS' && 'border-blue-500/40 text-blue-400')}>
                {STATUS_LABELS[task.status] ?? task.status}
              </Badge>
            </div>
          </div>

          <div className="flex gap-1 shrink-0">
            {task.status === 'PENDING' && (
              <Button
                size="sm"
                variant="ghost"
                className="text-blue-400 hover:bg-blue-500/10 text-xs h-6"
                onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}
              >
                Iniciar
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-red-400"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function HabitHeatmap({ data }: { data: Record<string, number> }) {
  const today = new Date()
  const days: Array<{ date: string; count: number }> = []
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, count: data[key] ?? 0 })
  }
  const firstDay = new Date(days[0].date)
  const startPad = (firstDay.getDay() + 6) % 7
  const padded: Array<typeof days[0] | null> = [...Array(startPad).fill(null), ...days]
  const weeks: Array<Array<typeof days[0] | null>> = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))

  function cellColor(n: number) {
    if (n === 0) return 'bg-muted/40'
    if (n === 1) return 'bg-emerald-900/60'
    if (n === 2) return 'bg-emerald-700/70'
    if (n <= 4) return 'bg-emerald-500/80'
    return 'bg-emerald-400'
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">Consistência — último ano</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex gap-0.5 min-w-max">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => (
                  <div
                    key={di}
                    title={day ? `${day.date}: ${day.count} hábito(s)` : ''}
                    className={cn('w-3 h-3 rounded-sm', day ? cellColor(day.count) : 'bg-transparent')}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>Menos</span>
          <div className="flex gap-0.5">
            {['bg-muted/40', 'bg-emerald-900/60', 'bg-emerald-700/70', 'bg-emerald-500/80', 'bg-emerald-400'].map((c, i) => (
              <div key={i} className={cn('w-3 h-3 rounded-sm', c)} />
            ))}
          </div>
          <span>Mais</span>
        </div>
      </CardContent>
    </Card>
  )
}

function GtdTaskRow({ task, onToggle, onDelete, onProcess }: {
  task: GtdTask
  onToggle: (t: GtdTask) => void
  onDelete: (id: string) => void
  onProcess: (t: GtdTask) => void
}) {
  const done = task.status === 'COMPLETED'
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-border/60', done && 'opacity-50')}>
      <button onClick={() => onToggle(task)} className="mt-0.5 shrink-0">
        {done
          ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          : <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        }
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', done && 'line-through')}>{task.title}</p>
        {task.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={cn('text-xs font-medium', priority.color)}>{priority.label}</span>
          {task.context && (
            <Badge variant="outline" className="h-5 gap-1 px-1.5 py-0 text-xs">
              <Tag className="h-2.5 w-2.5" />{task.context}
            </Badge>
          )}
          {task.energy && (
            <Badge variant="outline" className="h-5 px-1.5 py-0 text-xs">
              {ENERGY_CONFIG[task.energy].label}
            </Badge>
          )}
          {task.estimatedMin && (
            <Badge variant="outline" className="h-5 px-1.5 py-0 text-xs">
              <Clock className="mr-1 h-2.5 w-2.5" />{task.estimatedMin}min
            </Badge>
          )}
          {task.dueDate && (
            <Badge
              variant="outline"
              className={cn('h-5 px-1.5 py-0 text-xs', new Date(task.dueDate) < new Date() && !done && 'border-red-500/50 text-red-400')}
            >
              {new Date(task.dueDate).toLocaleDateString('pt-BR')}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {task.bucket === 'INBOX' && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Processar" onClick={() => onProcess(task)}>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function GtdTaskList({ tasks, bucket, onToggle, onDelete, onProcess }: {
  tasks: GtdTask[]
  bucket: GtdBucket
  onToggle: (t: GtdTask) => void
  onDelete: (id: string) => void
  onProcess: (t: GtdTask) => void
}) {
  const filtered = tasks.filter(t => t.bucket === bucket)

  if (filtered.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
        <p className="text-sm">Nenhuma tarefa aqui</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {filtered.map(t => (
        <GtdTaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} onProcess={onProcess} />
      ))}
    </div>
  )
}

function CooChat({ habits, tasks }: { habits: Habit[]; tasks: RotinaTask[] }) {
  type Msg = { role: 'user' | 'assistant'; content: string }
  const [messages, setMessages] = useState<Msg[]>([{
    role: 'assistant',
    content: 'Olá! Sou seu COO. Posso analisar seus hábitos, tarefas e planejar sua rotina. O que você precisa?',
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const todayStr = startOfDay(new Date()).toDateString()
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeRole: 'COO',
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          moduleData: {
            habits: habits.map(h => ({
              name: h.name,
              frequency: h.frequency,
              streak: h.streak,
              doneToday: h.logs.some(l => startOfDay(new Date(l.date)).toDateString() === todayStr && l.completed),
            })),
            tasks: tasks.map(t => ({ title: t.title, priority: t.priority, status: t.status, dueDate: t.dueDate })),
          },
        }),
      })
      const text = (await res.text()).trim()
      setMessages(prev => [...prev, { role: 'assistant', content: res.ok ? (text || 'Sem resposta.') : 'Erro ao conectar.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="py-3 px-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <CardTitle className="text-sm">COO — Chief Operating Officer</CardTitle>
            <p className="text-xs text-muted-foreground">Conselheiro de Rotina & Produtividade</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-400">Online</span>
          </div>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-indigo-400" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                msg.role === 'user' ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
              )}>
                {msg.role === 'user'
                  ? <p className="whitespace-pre-wrap">{msg.content}</p>
                  : <ChatRichText content={msg.content} />
                }
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-3 h-3 text-indigo-400" />
              </div>
              <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2 flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border/50">
        <form onSubmit={send} className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pergunte ao seu COO..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  )
}

function NewCalEventDialog({ defaultDate, onCreated }: { defaultDate: Date; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startAt, setStartAt] = useState(format(defaultDate, "yyyy-MM-dd'T'HH:mm"))
  const [endAt, setEndAt] = useState(format(defaultDate, "yyyy-MM-dd'T'") + '01:00')
  const [allDay, setAllDay] = useState(false)
  const [color, setColor] = useState('#6366f1')
  const [moduleVal, setModuleVal] = useState('')
  const [reminder, setReminder] = useState('')

  async function save() {
    if (!title.trim()) { toast.error('Informe o título.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          startAt: new Date(startAt).toISOString(),
          endAt: allDay ? undefined : new Date(endAt).toISOString(),
          allDay,
          color,
          module: moduleVal || undefined,
          reminderMinutes: reminder ? Number(reminder) : undefined,
        }),
      })
      if (!res.ok) { toast.error('Erro ao criar evento.'); return }
      toast.success('Evento criado!')
      setOpen(false)
      setTitle(''); setDescription('')
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="h-4 w-4 mr-2" /> Novo Evento
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo evento no calendário</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input placeholder="Ex.: Reunião de equipe" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea placeholder="Opcional" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={allDay} onCheckedChange={setAllDay} />
            <Label>Dia inteiro</Label>
          </div>
          {allDay ? (
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={startAt.slice(0, 10)} onChange={e => setStartAt(e.target.value + 'T00:00')} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Módulo</Label>
              <Select value={moduleVal} onValueChange={v => setModuleVal(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {(Object.entries(PLANNER_MODULE_CONFIG) as [PlannerModule, { label: string }][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lembrete</Label>
              <Select value={reminder} onValueChange={v => setReminder(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  <SelectItem value="15">15 min antes</SelectItem>
                  <SelectItem value="30">30 min antes</SelectItem>
                  <SelectItem value="60">1h antes</SelectItem>
                  <SelectItem value="1440">1 dia antes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {CALENDAR_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn('h-7 w-7 rounded-full border-2 transition-all', color === c ? 'border-white scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Criar evento'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function CentralPage() {
  // PM employee
  const [pm, setPm] = useState<{ name: string } | null>(null)

  // GTD state
  const [gtdTasks, setGtdTasks] = useState<GtdTask[]>([])
  const [bucketCounts, setBucketCounts] = useState<Record<string, number>>({})
  const [activeGtdTab, setActiveGtdTab] = useState<GtdBucket | 'capturar'>('capturar')
  const [captureInput, setCaptureInput] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [processTarget, setProcessTarget] = useState<GtdTask | null>(null)
  const [createGtdOpen, setCreateGtdOpen] = useState(false)
  const [gtdForm, setGtdForm] = useState({
    title: '', description: '', bucket: 'INBOX' as GtdBucket,
    priority: 'MEDIUM' as TaskPriority, dueDate: '',
    context: '', energy: '' as GtdEnergy | '', estimatedMin: '',
  })

  // Calendar / Planner state
  const [calView, setCalView] = useState<CalView>('month')
  const [calAnchor, setCalAnchor] = useState(() => startOfDay(new Date()))
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all')
  const [calData, setCalData] = useState<PlannerResponse | null>(null)
  const [calLoading, setCalLoading] = useState(true)
  const [calVersion, setCalVersion] = useState(0)
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewData, setReviewData] = useState<WeeklyReview | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [rebalancingId, setRebalancingId] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // Rotina state
  const [habits, setHabits] = useState<Habit[]>([])
  const [rotinaTasks, setRotinaTasks] = useState<RotinaTask[]>([])
  const [loadingHabits, setLoadingHabits] = useState(true)
  const [loadingRotinaTasks, setLoadingRotinaTasks] = useState(true)
  const [showAllRotinaT, setShowAllRotinaT] = useState(false)
  const [heatmap, setHeatmap] = useState<Record<string, number>>({})
  const [addHabitOpen, setAddHabitOpen] = useState(false)
  const [addRotinaTaskOpen, setAddRotinaTaskOpen] = useState(false)
  const [habitForm, setHabitForm] = useState({ name: '', description: '', frequency: 'DAILY' })
  const [rotinaTaskForm, setRotinaTaskForm] = useState({
    title: '', description: '', priority: 'MEDIUM', dueDate: '', isRecurring: false,
  })

  // ── Fetch helpers ──────────────────────────────────────────

  const fetchGtd = useCallback(async (bucket?: GtdBucket) => {
    const url = bucket ? `/api/tarefas/gtd?bucket=${bucket}` : '/api/tarefas/gtd'
    const res = await fetch(url)
    if (res.ok) setGtdTasks(await res.json())
  }, [])

  const fetchCounts = useCallback(async () => {
    const res = await fetch('/api/tarefas')
    if (res.ok) {
      const d = await res.json()
      setBucketCounts(d.bucketCounts ?? {})
    }
  }, [])

  const fetchCalData = useCallback(async () => {
    setCalLoading(true)
    try {
      const qs = new URLSearchParams({ scope: toScope(calView), date: format(calAnchor, 'yyyy-MM-dd') })
      const res = await fetch(`/api/planner?${qs}`)
      if (res.ok) setCalData(await res.json())
    } finally {
      setCalLoading(false)
    }
  }, [calView, calAnchor, calVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHabits = useCallback(async () => {
    const res = await fetch('/api/rotina/habits')
    if (res.ok) setHabits(await res.json())
    setLoadingHabits(false)
  }, [])

  const fetchRotinaTasks = useCallback(async () => {
    const url = showAllRotinaT ? '/api/rotina/tasks?status=ALL' : '/api/rotina/tasks'
    const res = await fetch(url)
    if (res.ok) setRotinaTasks(await res.json())
    setLoadingRotinaTasks(false)
  }, [showAllRotinaT])

  function refreshCal() { setCalVersion(v => v + 1) }

  // ── Effects ────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/employees?role=PROJECT_MANAGER')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.[0]) setPm(d[0]) })
  }, [])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  useEffect(() => {
    if (activeGtdTab !== 'capturar') fetchGtd(activeGtdTab as GtdBucket)
  }, [activeGtdTab, fetchGtd])

  useEffect(() => { void fetchCalData() }, [fetchCalData])
  useEffect(() => { fetchHabits() }, [fetchHabits])
  useEffect(() => { fetchRotinaTasks() }, [fetchRotinaTasks])
  useEffect(() => {
    fetch('/api/rotina/heatmap').then(r => r.ok ? r.json() : {}).then(d => setHeatmap(d))
  }, [])

  // ── Calendar handlers ──────────────────────────────────────

  function navigateCal(dir: 1 | -1) {
    setCalAnchor(prev => shiftAnchor(prev, calView, dir))
  }

  // ── GTD handlers ───────────────────────────────────────────

  async function handleCapture(e: React.FormEvent) {
    e.preventDefault()
    if (!captureInput.trim()) return
    setCapturing(true)
    try {
      const res = await fetch('/api/tarefas/gtd/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: captureInput.trim() }),
      })
      if (!res.ok) throw new Error()
      setCaptureInput('')
      toast.success('Capturado no Inbox.')
      fetchCounts()
      refreshCal()
    } catch {
      toast.error('Erro ao capturar')
    } finally {
      setCapturing(false)
    }
  }

  async function handleCreateGtd() {
    try {
      const res = await fetch('/api/tarefas/gtd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...gtdForm,
          energy: gtdForm.energy || undefined,
          estimatedMin: gtdForm.estimatedMin ? Number(gtdForm.estimatedMin) : undefined,
          dueDate: gtdForm.dueDate || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tarefa criada.')
      setCreateGtdOpen(false)
      setGtdForm({ title: '', description: '', bucket: 'INBOX', priority: 'MEDIUM', dueDate: '', context: '', energy: '', estimatedMin: '' })
      fetchCounts()
      fetchGtd(gtdForm.bucket)
      refreshCal()
    } catch {
      toast.error('Erro ao criar tarefa')
    }
  }

  async function handleGtdToggle(task: GtdTask) {
    const newStatus: TaskStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    try {
      const res = await fetch(`/api/tarefas/gtd/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setGtdTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
      fetchCounts()
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  async function handleGtdDelete(id: string) {
    try {
      const res = await fetch(`/api/tarefas/gtd/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setGtdTasks(prev => prev.filter(t => t.id !== id))
      toast.success('Tarefa removida')
      fetchCounts()
    } catch {
      toast.error('Erro ao remover')
    }
  }

  async function handleGtdProcess(task: GtdTask, targetBucket: GtdBucket) {
    try {
      const res = await fetch('/api/tarefas/gtd/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [task.id], targetBucket }),
      })
      if (!res.ok) throw new Error()
      setGtdTasks(prev => prev.filter(t => t.id !== task.id))
      setProcessTarget(null)
      toast.success(`Movido para ${BUCKET_CONFIG[targetBucket].label}`)
      fetchCounts()
    } catch {
      toast.error('Erro ao processar')
    }
  }

  // ── Planner handlers ───────────────────────────────────────

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/planner/sync', { method: 'POST' })
      if (!res.ok) throw new Error()
      const d = await res.json()
      toast.success(`Sincronizado: ${d.syncedEvents} blocos, ${d.syncedOrigins} origens.`)
      refreshCal()
    } catch {
      toast.error('Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  async function openReview() {
    setReviewOpen(true)
    setReviewLoading(true)
    try {
      const res = await fetch('/api/planner/review')
      if (!res.ok) throw new Error()
      setReviewData(await res.json())
    } catch {
      toast.error('Erro ao carregar revisão')
    } finally {
      setReviewLoading(false)
    }
  }

  async function handleScheduleSuggestion(s: WeeklyReview['suggestions'][number]) {
    setSchedulingId(s.id)
    try {
      const res = await fetch('/api/planner/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: s.title, description: null, allDay: false, scheduledStart: s.suggestedStart, scheduledEnd: s.suggestedEnd, sourceId: s.id, sourceType: s.sourceType, sourceModule: s.sourceModule }),
      })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error ?? 'Erro') }
      toast.success('Sugestão agendada.')
      refreshCal()
      openReview()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSchedulingId(null)
    }
  }

  async function handleApplyRebalance(r: WeeklyReview['rebalances'][number]) {
    setRebalancingId(r.eventId)
    try {
      const res = await fetch(`/api/planner/blocks/${r.eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: r.title, allDay: false, scheduledStart: r.suggestedStart, scheduledEnd: r.suggestedEnd }),
      })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error ?? 'Erro') }
      toast.success('Bloco redistribuído.')
      refreshCal()
      openReview()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setRebalancingId(null)
    }
  }

  async function handleResolveConflict(c: WeeklyReview['conflicts'][number]) {
    setResolvingId(c.eventId)
    try {
      const res = await fetch(`/api/planner/blocks/${c.eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: c.title, allDay: false, scheduledStart: c.suggestedStart, scheduledEnd: c.suggestedEnd }),
      })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error ?? 'Erro') }
      toast.success('Conflito resolvido.')
      refreshCal()
      openReview()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setResolvingId(null)
    }
  }

  async function handleSaveSchedule() {
    if (!scheduleForm) return
    if (!scheduleForm.date) { toast.error('Escolha uma data.'); return }
    if (scheduleForm.mode === 'manual' && !scheduleForm.title.trim()) { toast.error('Informe um título.'); return }

    const scheduledStart = scheduleForm.allDay
      ? buildDT(scheduleForm.date, '00:00')
      : buildDT(scheduleForm.date, scheduleForm.startTime)
    const scheduledEnd = scheduleForm.allDay ? null : buildDT(scheduleForm.date, scheduleForm.endTime)

    if (scheduledEnd && scheduledEnd <= scheduledStart) {
      toast.error('O horário final precisa ser depois do início.')
      return
    }

    setSavingSchedule(true)
    try {
      const endpoint = scheduleForm.eventId ? `/api/planner/blocks/${scheduleForm.eventId}` : '/api/planner/blocks'
      const method = scheduleForm.eventId ? 'PUT' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scheduleForm.title,
          description: scheduleForm.description || null,
          allDay: scheduleForm.allDay,
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd?.toISOString() ?? null,
          sourceId: scheduleForm.sourceId,
          sourceType: scheduleForm.sourceType,
          sourceModule: scheduleForm.sourceModule,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error ?? 'Erro') }
      toast.success(scheduleForm.eventId ? 'Bloco atualizado.' : 'Bloco criado.')
      setScheduleForm(null)
      refreshCal()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSavingSchedule(false)
    }
  }

  async function handleQuickAction(item: PlannerItem, action: PlannerQuickAction) {
    try {
      const res = await fetch('/api/planner/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sourceId: item.sourceId, sourceType: item.sourceType, sourceModule: item.sourceModule }),
      })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error ?? 'Erro') }
      const label: Record<PlannerQuickAction, string> = {
        'move-to-today': 'Movido para Hoje.',
        'move-to-week': 'Movido para Semana.',
        'defer': 'Adiado 1 dia.',
        'complete': 'Concluído.',
        'reopen': 'Reaberto.',
      }
      toast.success(label[action])
      refreshCal()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  // ── Rotina handlers ────────────────────────────────────────

  async function handleAddHabit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/rotina/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(habitForm),
    })
    if (res.ok) {
      toast.success('Hábito criado!')
      setAddHabitOpen(false)
      setHabitForm({ name: '', description: '', frequency: 'DAILY' })
      fetchHabits()
      refreshCal()
    } else {
      toast.error('Erro ao criar hábito.')
    }
  }

  async function handleLogHabit(habitId: string) {
    const res = await fetch('/api/rotina/habit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitId, date: new Date().toISOString(), completed: true }),
    })
    if (res.ok) {
      toast.success('Hábito registrado! 🔥')
      fetchHabits()
    } else {
      toast.error('Erro ao registrar.')
    }
  }

  async function handleDeleteHabit(habitId: string) {
    if (!confirm('Remover este hábito?')) return
    const res = await fetch(`/api/rotina/habits/${habitId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Hábito removido.')
      fetchHabits()
    } else {
      toast.error('Erro ao remover.')
    }
  }

  async function handleAddRotinaTask(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/rotina/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rotinaTaskForm, dueDate: rotinaTaskForm.dueDate || null }),
    })
    if (res.ok) {
      toast.success('Tarefa criada!')
      setAddRotinaTaskOpen(false)
      setRotinaTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', isRecurring: false })
      fetchRotinaTasks()
      refreshCal()
    } else {
      toast.error('Erro ao criar tarefa.')
    }
  }

  async function handleRotinaTaskStatus(taskId: string, status: string) {
    const res = await fetch('/api/rotina/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status }),
    })
    if (res.ok) {
      fetchRotinaTasks()
    } else {
      toast.error('Erro ao atualizar.')
    }
  }

  async function handleDeleteRotinaTask(taskId: string) {
    const res = await fetch('/api/rotina/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId }),
    })
    if (res.ok) {
      toast.success('Tarefa deletada.')
      fetchRotinaTasks()
    } else {
      toast.error('Erro ao deletar.')
    }
  }

  // ── Derived ────────────────────────────────────────────────

  const filteredCalData = calData ? filterPlanner(calData, moduleFilter) : null
  const renderActions = (item: PlannerItem) => (
    <PlannerActionMenu
      item={item}
      onQuickAction={handleQuickAction}
      onSchedule={it => setScheduleForm(scheduleFormFromItem(it))}
    />
  )

  const todayStr = startOfDay(new Date()).toDateString()
  const dailyHabits = habits.filter(h => h.frequency === 'DAILY')
  const doneToday = dailyHabits.filter(h =>
    h.logs.some(l => startOfDay(new Date(l.date)).toDateString() === todayStr && l.completed)
  ).length
  const productivityScore = dailyHabits.length > 0 ? Math.round((doneToday / dailyHabits.length) * 100) : 0
  const pendingRotinaTasks = rotinaTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS')
  const urgentRotinaTasks = pendingRotinaTasks.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH')

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Central Operacional</h1>
          <p className="text-sm text-muted-foreground">
            Calendário, tarefas, hábitos e rotina — tudo em um lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pm && (
            <ChatButton employeeRole="PROJECT_MANAGER" employeeName={pm.name} moduleData={{ bucketCounts }} />
          )}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
          <Button variant="outline" size="sm" onClick={openReview}>
            Revisão Semanal
          </Button>
          <Button variant="outline" size="sm" onClick={() => setScheduleForm(blankScheduleForm())}>
            <CalendarDays className="mr-2 h-4 w-4" /> Novo Bloco
          </Button>
          <NewCalEventDialog defaultDate={calAnchor} onCreated={refreshCal} />

          {/* Nova Tarefa GTD */}
          <Dialog open={createGtdOpen} onOpenChange={setCreateGtdOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-2 h-4 w-4" /> Nova Tarefa
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Tarefa (GTD)</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Título</Label>
                  <Input placeholder="O que precisa ser feito?" value={gtdForm.title} onChange={e => setGtdForm({ ...gtdForm, title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Textarea placeholder="Detalhes..." value={gtdForm.description} onChange={e => setGtdForm({ ...gtdForm, description: e.target.value })} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Bucket</Label>
                    <Select value={gtdForm.bucket} onValueChange={v => setGtdForm({ ...gtdForm, bucket: v as GtdBucket })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(BUCKET_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Prioridade</Label>
                    <Select value={gtdForm.priority} onValueChange={v => setGtdForm({ ...gtdForm, priority: v as TaskPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Prazo</Label>
                    <Input type="date" value={gtdForm.dueDate} onChange={e => setGtdForm({ ...gtdForm, dueDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Energia</Label>
                    <Select value={gtdForm.energy} onValueChange={v => setGtdForm({ ...gtdForm, energy: v as GtdEnergy })}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ENERGY_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Contexto</Label>
                    <Input placeholder="@trabalho, @casa..." value={gtdForm.context} onChange={e => setGtdForm({ ...gtdForm, context: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Estimativa (min)</Label>
                    <Input type="number" placeholder="30" value={gtdForm.estimatedMin} onChange={e => setGtdForm({ ...gtdForm, estimatedMin: e.target.value })} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateGtd} disabled={!gtdForm.title.trim()}>
                  Criar Tarefa
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Novo Hábito */}
          <Dialog open={addHabitOpen} onOpenChange={setAddHabitOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" />}>
              <Flame className="mr-2 h-4 w-4" /> Novo Hábito
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Criar Novo Hábito</DialogTitle></DialogHeader>
              <form onSubmit={handleAddHabit} className="space-y-4">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input placeholder="Ex: Meditar 10 minutos" value={habitForm.name} onChange={e => setHabitForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Input placeholder="Detalhes..." value={habitForm.description} onChange={e => setHabitForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Frequência</Label>
                  <Select value={habitForm.frequency} onValueChange={v => setHabitForm(f => ({ ...f, frequency: v ?? f.frequency }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Diário</SelectItem>
                      <SelectItem value="WEEKLY">Semanal</SelectItem>
                      <SelectItem value="MONTHLY">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setAddHabitOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="flex-1">Criar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ══ MAIN TABS ═══════════════════════════════════════════════ */}
      <Tabs defaultValue="calendario">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="calendario">
            <Calendar className="mr-1.5 h-3.5 w-3.5" /> Calendário
          </TabsTrigger>
          <TabsTrigger value="tarefas">
            <ListTodo className="mr-1.5 h-3.5 w-3.5" /> Tarefas GTD
            {(bucketCounts.INBOX ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 text-xs text-primary">
                {bucketCounts.INBOX}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rotina">
            <Flame className="mr-1.5 h-3.5 w-3.5" /> Rotina
            {habits.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                {habits.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="coo">
            <Bot className="mr-1.5 h-3.5 w-3.5" /> COO AI
          </TabsTrigger>
        </TabsList>

        {/* ── CALENDÁRIO ──────────────────────────────────────── */}
        <TabsContent value="calendario" className="mt-5 space-y-4">

          {/* Toolbar */}
          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalAnchor(startOfDay(new Date()))}
                  className={cn(isSameDay(calAnchor, new Date()) && 'border-primary text-primary')}
                >
                  Hoje
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateCal(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateCal(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Badge variant="outline" className="h-8 px-3 text-sm font-medium">
                  {calWindowLabel(calView, calAnchor)}
                </Badge>
              </div>
              <Tabs value={calView} onValueChange={v => setCalView(v as CalView)}>
                <TabsList>
                  <TabsTrigger value="today">Dia</TabsTrigger>
                  <TabsTrigger value="week">Semana</TabsTrigger>
                  <TabsTrigger value="month">Mês</TabsTrigger>
                  <TabsTrigger value="agenda">Agenda 24h</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Module filters */}
            <div className="flex flex-wrap gap-2">
              {MODULE_FILTERS.map(f => {
                const active = moduleFilter === f.value
                const cfg = f.value !== 'all' ? PLANNER_MODULE_CONFIG[f.value] : null
                return (
                  <Button
                    key={f.value}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    className={cn('gap-1.5', !active && cfg?.className)}
                    onClick={() => setModuleFilter(f.value)}
                  >
                    <f.icon className="h-3.5 w-3.5" />
                    {f.label}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(Object.entries(PLANNER_MODULE_CONFIG) as [PlannerModule, { label: string; chipCn: string }][]).map(([, cfg]) => (
              <div key={cfg.label} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-sm border', cfg.chipCn)} />
                <span className="text-[11px] text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Summary cards */}
          {calLoading && !filteredCalData ? (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : filteredCalData ? (
            <PlannerSummaryCards summary={filteredCalData.summary} />
          ) : null}

          {/* Insights */}
          {filteredCalData && filteredCalData.insights.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {filteredCalData.insights.map(insight => (
                <Card
                  key={insight.id}
                  className={cn(
                    insight.level === 'alert' ? 'border-red-500/30 bg-red-500/10'
                    : insight.level === 'warning' ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-sky-500/30 bg-sky-500/10'
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{insight.title}</CardTitle>
                      <Badge variant="outline" className="capitalize">{insight.level}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{insight.message}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Calendar views */}
          {calLoading && !filteredCalData ? (
            <Skeleton className="h-[36rem] w-full" />
          ) : filteredCalData ? (
            <>
              {calView === 'today' && (
                <PlannerTodayBoard data={filteredCalData} renderItemActions={renderActions} />
              )}
              {calView === 'week' && (
                <CalendarWeekView data={filteredCalData} renderItemActions={renderActions} />
              )}
              {calView === 'month' && (
                <CalendarMonthView data={filteredCalData} renderItemActions={renderActions} />
              )}
              {calView === 'agenda' && (
                <PlannerTimelineCard
                  title="Agenda 24h"
                  description="Blocos com horário, itens sem horário e hábitos."
                  scheduledItems={filteredCalData.scheduledItems}
                  floatingItems={filteredCalData.focusItems}
                  habits={filteredCalData.habits}
                  renderItemActions={renderActions}
                />
              )}
            </>
          ) : null}
        </TabsContent>

        {/* ── TAREFAS GTD ─────────────────────────────────────── */}
        <TabsContent value="tarefas" className="mt-5 space-y-4">
          {(bucketCounts.INBOX ?? 0) === 0 && Object.values(bucketCounts).some(c => c > 0) && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Inbox zerado. Tudo processado.
            </div>
          )}

          {/* Bucket cards */}
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {(Object.keys(BUCKET_CONFIG) as GtdBucket[]).map(bucket => {
              const cfg = BUCKET_CONFIG[bucket]
              const count = bucketCounts[bucket] ?? 0
              return (
                <Card
                  key={bucket}
                  className={cn('cursor-pointer transition-colors', activeGtdTab === bucket && 'border-primary/40 bg-primary/5')}
                  onClick={() => setActiveGtdTab(bucket)}
                >
                  <CardContent className="p-3 text-center">
                    <cfg.icon className={cn('mx-auto mb-1 h-4 w-4', cfg.color)} />
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* GTD tabs */}
          <Tabs value={activeGtdTab} onValueChange={v => setActiveGtdTab(v as GtdBucket | 'capturar')}>
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="capturar">Capturar</TabsTrigger>
              {(Object.keys(BUCKET_CONFIG) as GtdBucket[]).map(bucket => (
                <TabsTrigger key={bucket} value={bucket}>
                  {BUCKET_CONFIG[bucket].label}
                  {(bucketCounts[bucket] ?? 0) > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 text-xs text-primary">
                      {bucketCounts[bucket]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="capturar" className="mt-6">
              <Card className="mx-auto max-w-xl">
                <CardHeader>
                  <CardTitle className="text-base">Captura Rápida</CardTitle>
                  <p className="text-sm text-muted-foreground">Jogue tudo aqui. O processamento vem depois.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCapture} className="flex gap-2">
                    <Input
                      placeholder="O que está na sua cabeça?"
                      value={captureInput}
                      onChange={e => setCaptureInput(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button type="submit" disabled={capturing || !captureInput.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </form>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Use "Nova Tarefa" para registrar prazo, contexto e energia.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {(Object.keys(BUCKET_CONFIG) as GtdBucket[]).map(bucket => (
              <TabsContent key={bucket} value={bucket} className="mt-6">
                <GtdTaskList
                  tasks={gtdTasks}
                  bucket={bucket}
                  onToggle={handleGtdToggle}
                  onDelete={handleGtdDelete}
                  onProcess={t => setProcessTarget(t)}
                />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* ── ROTINA ──────────────────────────────────────────── */}
        <TabsContent value="rotina" className="mt-5 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <p className="text-xs text-muted-foreground">Score Hoje</p>
                </div>
                <p className={cn('text-2xl font-bold', productivityScore >= 80 ? 'text-green-400' : productivityScore >= 50 ? 'text-yellow-400' : 'text-red-400')}>
                  {productivityScore}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{doneToday}/{dailyHabits.length} hábitos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <p className="text-xs text-muted-foreground">Melhor Streak</p>
                </div>
                <p className="text-2xl font-bold text-amber-400">
                  {habits.length > 0 ? Math.max(...habits.map(h => h.streak), 0) : 0}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">dias consecutivos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-muted-foreground">Tarefas Pendentes</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">{pendingRotinaTasks.length}</p>
                {urgentRotinaTasks.length > 0 && (
                  <p className="text-xs text-red-400 mt-0.5">{urgentRotinaTasks.length} urgentes</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-green-400" />
                  <p className="text-xs text-muted-foreground">Hábitos Ativos</p>
                </div>
                <p className="text-2xl font-bold text-green-400">{habits.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">em acompanhamento</p>
              </CardContent>
            </Card>
          </div>

          <HabitHeatmap data={heatmap} />

          {dailyHabits.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Check-in de hoje</p>
                  <span className={cn('text-sm font-bold', productivityScore >= 80 ? 'text-green-400' : productivityScore >= 50 ? 'text-yellow-400' : 'text-red-400')}>
                    {productivityScore >= 80 ? '🔥 Excelente!' : productivityScore >= 50 ? '💪 Bom progresso!' : '⚡ Vamos lá!'}
                  </span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', productivityScore >= 80 ? 'bg-green-500' : productivityScore >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                    style={{ width: `${productivityScore}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {doneToday} de {dailyHabits.length} hábitos diários concluídos
                </p>
              </CardContent>
            </Card>
          )}

          {/* Hábitos / Tarefas sub-tabs */}
          <Tabs defaultValue="habits">
            <TabsList>
              <TabsTrigger value="habits">
                <Flame className="w-3.5 h-3.5 mr-1.5" /> Hábitos
                {habits.length > 0 && (
                  <span className="ml-1.5 bg-muted text-muted-foreground rounded-full px-1.5 text-xs">{habits.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="tasks">
                <ListTodo className="w-3.5 h-3.5 mr-1.5" /> Tarefas de Rotina
                {pendingRotinaTasks.length > 0 && (
                  <span className="ml-1.5 bg-muted text-muted-foreground rounded-full px-1.5 text-xs">{pendingRotinaTasks.length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="habits" className="mt-4">
              {loadingHabits ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="flex gap-1">
                          {[1,2,3,4,5,6,7].map(j => <div key={j} className="w-6 h-6 bg-muted rounded animate-pulse" />)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : habits.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Flame className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium mb-1">Nenhum hábito cadastrado</p>
                    <p className="text-sm text-muted-foreground">Crie seus primeiros hábitos para construir uma rotina sólida.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {dailyHabits.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        Check-in de {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dailyHabits.map(h => (
                          <HabitCard key={h.id} habit={h} onLog={handleLogHabit} onDelete={handleDeleteHabit} />
                        ))}
                      </div>
                    </div>
                  )}
                  {habits.filter(h => h.frequency !== 'DAILY').length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Hábitos Semanais / Mensais
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {habits.filter(h => h.frequency !== 'DAILY').map(h => (
                          <HabitCard key={h.id} habit={h} onLog={handleLogHabit} onDelete={handleDeleteHabit} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {showAllRotinaT ? 'Todas as tarefas' : 'Tarefas ativas'}
                  </h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setShowAllRotinaT(s => !s)}>
                      {showAllRotinaT ? 'Mostrar ativas' : 'Ver todas'}
                    </Button>

                    {/* Nova Tarefa de Rotina */}
                    <Dialog open={addRotinaTaskOpen} onOpenChange={setAddRotinaTaskOpen}>
                      <DialogTrigger render={<Button size="sm" variant="outline" />}>
                        <Plus className="h-4 w-4 mr-1.5" /> Nova
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Nova Tarefa de Rotina</DialogTitle></DialogHeader>
                        <form onSubmit={handleAddRotinaTask} className="space-y-4">
                          <div className="space-y-1">
                            <Label>Título *</Label>
                            <Input placeholder="Ex: Revisar contrato" value={rotinaTaskForm.title} onChange={e => setRotinaTaskForm(f => ({ ...f, title: e.target.value }))} required />
                          </div>
                          <div className="space-y-1">
                            <Label>Descrição</Label>
                            <Textarea placeholder="Detalhes..." value={rotinaTaskForm.description} onChange={e => setRotinaTaskForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label>Prioridade</Label>
                              <Select value={rotinaTaskForm.priority} onValueChange={v => setRotinaTaskForm(f => ({ ...f, priority: v ?? f.priority }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="URGENT">🔴 Urgente</SelectItem>
                                  <SelectItem value="HIGH">🟠 Alta</SelectItem>
                                  <SelectItem value="MEDIUM">🟡 Média</SelectItem>
                                  <SelectItem value="LOW">⚪ Baixa</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label>Prazo</Label>
                              <Input type="date" value={rotinaTaskForm.dueDate} onChange={e => setRotinaTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="isRecurring"
                              checked={rotinaTaskForm.isRecurring}
                              onChange={e => setRotinaTaskForm(f => ({ ...f, isRecurring: e.target.checked }))}
                              className="rounded"
                            />
                            <Label htmlFor="isRecurring" className="cursor-pointer">Recorrente</Label>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setAddRotinaTaskOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="flex-1">Criar</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {loadingRotinaTasks ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <Card key={i}>
                        <CardContent className="pt-3 pb-3">
                          <div className="flex gap-3">
                            <div className="w-4 h-4 bg-muted rounded animate-pulse mt-0.5" />
                            <div className="flex-1 h-4 bg-muted rounded animate-pulse" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : rotinaTasks.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="font-medium mb-1">Nenhuma tarefa</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {urgentRotinaTasks.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                          <Star className="w-3 h-3" /> Prioridade Alta
                        </h4>
                        <div className="space-y-2">
                          {urgentRotinaTasks.map(t => (
                            <RotinaTaskCard key={t.id} task={t} onStatusChange={handleRotinaTaskStatus} onDelete={handleDeleteRotinaTask} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {urgentRotinaTasks.length > 0 && (
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Demais</h4>
                      )}
                      {rotinaTasks
                        .filter(t => !(t.priority === 'URGENT' || t.priority === 'HIGH') || t.status === 'COMPLETED' || t.status === 'CANCELLED')
                        .map(t => (
                          <RotinaTaskCard key={t.id} task={t} onStatusChange={handleRotinaTaskStatus} onDelete={handleDeleteRotinaTask} />
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── COO AI ──────────────────────────────────────────── */}
        <TabsContent value="coo" className="mt-5">
          <CooChat habits={habits} tasks={rotinaTasks} />
        </TabsContent>
      </Tabs>

      {/* ═══ Dialogs ════════════════════════════════════════════════ */}

      {/* Schedule / Bloco */}
      <Dialog open={!!scheduleForm} onOpenChange={open => { if (!open) setScheduleForm(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {scheduleForm?.mode === 'manual'
                ? scheduleForm.eventId ? 'Editar bloco manual' : 'Novo bloco manual'
                : scheduleForm?.eventId ? 'Reagendar tarefa' : 'Agendar tarefa'}
            </DialogTitle>
          </DialogHeader>
          {scheduleForm && (
            <div className="space-y-4">
              {scheduleForm.mode === 'linked' && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
                  <p className="text-sm font-medium text-sky-300">{scheduleForm.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Bloco vinculado ao item de origem.</p>
                </div>
              )}
              <div className="space-y-1">
                <Label>Título</Label>
                <Input
                  placeholder="Ex.: Bloco de foco"
                  value={scheduleForm.title}
                  disabled={scheduleForm.mode === 'linked'}
                  onChange={e => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Detalhes..."
                  value={scheduleForm.description}
                  disabled={scheduleForm.mode === 'linked'}
                  rows={2}
                  onChange={e => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={scheduleForm.date}
                    onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={scheduleForm.allDay ? 'outline' : 'default'}
                      className="flex-1"
                      onClick={() => setScheduleForm({ ...scheduleForm, allDay: false })}
                    >
                      Com horário
                    </Button>
                    <Button
                      type="button"
                      variant={scheduleForm.allDay ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setScheduleForm({ ...scheduleForm, allDay: true })}
                    >
                      Dia inteiro
                    </Button>
                  </div>
                </div>
              </div>
              {!scheduleForm.allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Início</Label>
                    <Input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fim</Label>
                    <Input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} />
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={handleSaveSchedule} disabled={savingSchedule}>
                {savingSchedule ? 'Salvando...' : scheduleForm.eventId ? 'Atualizar bloco' : 'Criar bloco'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revisão Semanal */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Revisão Semanal GTD</DialogTitle></DialogHeader>
          {reviewLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : reviewData ? (
            <ScrollArea className="max-h-[65vh] pr-2">
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Semana {reviewData.period.label}</p>
                      <p className="text-xs text-muted-foreground">{reviewData.workload.message}</p>
                    </div>
                    <Badge variant="outline" className={cn(
                      reviewData.workload.status === 'high' ? 'border-red-500/40 text-red-400'
                      : reviewData.workload.status === 'medium' ? 'border-amber-500/40 text-amber-400'
                      : 'border-emerald-500/40 text-emerald-400'
                    )}>
                      {reviewData.workload.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Inbox', reviewData.metrics.inboxCount],
                    ['Vencidas', reviewData.metrics.overdueCount],
                    ['Horas planejadas', `${reviewData.metrics.scheduledHours}h`],
                    ['Conflitos', reviewData.metrics.conflictCount],
                    ['Dias sobrecarregados', reviewData.metrics.overloadedDays],
                    ['Sem buffer', reviewData.metrics.lowBufferDays],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-semibold">{val}</p>
                    </div>
                  ))}
                </div>

                {reviewData.nextActions.length > 0 && (
                  <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                    <p className="font-medium">Próximas ações</p>
                    {reviewData.nextActions.map((a, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{i + 1}. {a}</p>
                    ))}
                  </div>
                )}

                {reviewData.suggestions.length > 0 && (
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 space-y-2">
                    <p className="font-medium text-sky-300">Sugestões de horário</p>
                    {reviewData.suggestions.map((s, i) => (
                      <div key={`${s.title}-${i}`} className="rounded-lg bg-background/40 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate">{s.title}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={schedulingId === s.id}
                            onClick={() => handleScheduleSuggestion(s)}
                          >
                            {schedulingId === s.id ? 'Agendando...' : 'Agendar'}
                          </Button>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {new Date(s.suggestedStart).toLocaleString('pt-BR')} – {new Date(s.suggestedEnd).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {reviewData.rebalances.length > 0 && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 space-y-2">
                    <p className="font-medium text-rose-300">Redistribuir carga</p>
                    {reviewData.rebalances.map(r => (
                      <div key={`${r.eventId}`} className="rounded-lg bg-background/40 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate">{r.title}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={rebalancingId === r.eventId}
                            onClick={() => handleApplyRebalance(r)}
                          >
                            {rebalancingId === r.eventId ? 'Movendo...' : 'Aplicar'}
                          </Button>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          Sugerido: {new Date(r.suggestedStart).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {reviewData.conflicts.length > 0 && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2">
                    <p className="font-medium text-red-300">Resolver conflitos</p>
                    {reviewData.conflicts.map(c => (
                      <div key={`${c.eventId}`} className="rounded-lg bg-background/40 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{c.title}</p>
                            <p className="text-muted-foreground">Conflita com {c.blockingTitle}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={resolvingId === c.eventId}
                            onClick={() => handleResolveConflict(c)}
                          >
                            {resolvingId === c.eventId ? 'Resolvendo...' : 'Resolver'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">Não foi possível carregar a revisão.</p>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setReviewOpen(false)}>Revisão concluída</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Processar tarefa GTD */}
      <Dialog open={!!processTarget} onOpenChange={open => { if (!open) setProcessTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Processar tarefa</DialogTitle></DialogHeader>
          {processTarget && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{processTarget.title}</p>
              <p className="text-xs text-muted-foreground">Mover para:</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(BUCKET_CONFIG) as GtdBucket[])
                  .filter(b => b !== processTarget.bucket)
                  .map(bucket => {
                    const cfg = BUCKET_CONFIG[bucket]
                    return (
                      <Button
                        key={bucket}
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => handleGtdProcess(processTarget, bucket)}
                      >
                        <cfg.icon className={cn('h-4 w-4', cfg.color)} />
                        {cfg.label}
                      </Button>
                    )
                  })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
