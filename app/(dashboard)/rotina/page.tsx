'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Calendar,
  Plus,
  Check,
  Flame,
  Trash2,
  ClipboardList,
  Activity,
  Trophy,
  Bot,
  Send,
  ListTodo,
  RotateCcw,
  Star,
} from 'lucide-react'
import { ChatRichText } from '@/components/ai/ChatRichText'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format, subDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HabitLog {
  id: string
  date: string
  completed: boolean
  note?: string
}

interface Habit {
  id: string
  name: string
  description: string | null
  frequency: string
  streak: number
  bestStreak: number
  isActive: boolean
  logs: HabitLog[]
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  isRecurring: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  URGENT: { label: 'Urgente',  color: 'text-red-400',    dot: 'bg-red-500' },
  HIGH:   { label: 'Alta',     color: 'text-orange-400', dot: 'bg-orange-500' },
  MEDIUM: { label: 'Média',    color: 'text-yellow-400', dot: 'bg-yellow-500' },
  LOW:    { label: 'Baixa',    color: 'text-slate-400',  dot: 'bg-slate-500' },
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:     'Pendente',
  IN_PROGRESS: 'Em Progresso',
  COMPLETED:   'Concluída',
  CANCELLED:   'Cancelada',
}

const FREQ_LABELS: Record<string, string> = {
  DAILY:   'Diário',
  WEEKLY:  'Semanal',
  MONTHLY: 'Mensal',
}

const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i))

// ─── Habit Grid Dot ───────────────────────────────────────────────────────────

function DayDot({ habit, day }: { habit: Habit; day: Date }) {
  const dayStr = startOfDay(day).toDateString()
  const isToday = dayStr === startOfDay(new Date()).toDateString()
  const isFuture = day > new Date()

  const log = habit.logs.find(l => startOfDay(new Date(l.date)).toDateString() === dayStr)

  let bg = 'bg-slate-700'
  if (isFuture) bg = 'bg-slate-800 opacity-40'
  else if (log?.completed) bg = 'bg-green-500'
  else if (!isFuture && !isToday) bg = 'bg-red-500/60'

  return (
    <div
      className={cn('w-6 h-6 rounded-md flex items-center justify-center text-xs', bg, isToday && 'ring-1 ring-white/30')}
      title={format(day, 'd MMM', { locale: ptBR })}
    >
      {log?.completed ? <Check className="w-3 h-3 text-white" /> : null}
    </div>
  )
}

// ─── Habit Card ───────────────────────────────────────────────────────────────

function HabitCard({
  habit,
  onLog,
  onDelete,
}: {
  habit: Habit
  onLog: (id: string) => void
  onDelete: (id: string) => void
}) {
  const today = startOfDay(new Date()).toDateString()
  const doneToday = habit.logs.some(l =>
    startOfDay(new Date(l.date)).toDateString() === today && l.completed
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
              <Badge variant="outline" className="text-xs h-5">
                {FREQ_LABELS[habit.frequency]}
              </Badge>
              {habit.streak > 0 && (
                <div className="flex items-center gap-1 text-xs text-amber-400">
                  <Flame className="w-3 h-3" />
                  <span>{habit.streak} dias</span>
                </div>
              )}
              {habit.bestStreak > 1 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy className="w-3 h-3" />
                  <span>Recorde: {habit.bestStreak}</span>
                </div>
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
                <Check className="w-3 h-3 mr-1" />
                Feito
              </Button>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onDelete(habit.id)}
              className="text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* 7-day grid */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          <div className="flex gap-1">
            {WEEK_DAYS.map((day, i) => (
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

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM
  const isCompleted = task.status === 'COMPLETED'
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted

  return (
    <Card className={cn(
      'border transition-colors',
      isCompleted ? 'opacity-60 border-border' : isOverdue ? 'border-red-500/30' : 'border-border'
    )}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => onStatusChange(task.id, isCompleted ? 'PENDING' : 'COMPLETED')}
            className={cn(
              'mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
              isCompleted ? 'bg-green-500 border-green-500' : 'border-muted-foreground hover:border-green-400'
            )}
          >
            {isCompleted && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm font-medium', isCompleted && 'line-through text-muted-foreground')}>
                {task.title}
              </span>
              <div className="flex items-center gap-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', priority.dot)} />
                <span className={cn('text-xs', priority.color)}>{priority.label}</span>
              </div>
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {task.dueDate && (
                <span className={cn('text-xs', isOverdue ? 'text-red-400' : 'text-muted-foreground')}>
                  {isOverdue ? '⚠ ' : ''}Prazo: {format(new Date(task.dueDate), 'd MMM', { locale: ptBR })}
                </span>
              )}
              {task.isRecurring && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RotateCcw className="w-3 h-3" />
                  Recorrente
                </div>
              )}
              <Badge
                variant="outline"
                className={cn('text-xs h-4', task.status === 'IN_PROGRESS' && 'border-blue-500/40 text-blue-400')}
              >
                {STATUS_LABELS[task.status]}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {task.status === 'PENDING' && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}
                className="text-blue-400 hover:bg-blue-500/10 text-xs h-6"
              >
                Iniciar
              </Button>
            )}
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => onDelete(task.id)}
              className="text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── COO Chat Panel ───────────────────────────────────────────────────────────

function COOChatPanel({ habits, tasks }: { habits: Habit[]; tasks: Task[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou seu COO de Vida S.A. Posso te ajudar a otimizar sua rotina, analisar seus hábitos e tarefas, ou sugerir melhorias de produtividade. O que você precisa?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
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
              doneToday: h.logs.some(l =>
                startOfDay(new Date(l.date)).toDateString() === startOfDay(new Date()).toDateString() && l.completed
              ),
            })),
            tasks: tasks.map(t => ({
              title: t.title,
              priority: t.priority,
              status: t.status,
              dueDate: t.dueDate,
            })),
          },
        }),
      })

      const responseText = (await res.text()).trim()

      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: responseText || 'Nao consegui processar sua solicitacao. Tente novamente.' }])
      } else {
        toast.error(responseText || 'Erro ao conectar com o COO.')
      }
    } catch {
      toast.error('Erro de conexão.')
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-2',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3 h-3 text-indigo-400" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-indigo-500 text-white rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              )}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <ChatRichText content={msg.content} />
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Bot className="w-3 h-3 text-indigo-400" />
            </div>
            <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/50">
        <form onSubmit={sendMessage} className="flex gap-2">
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RotinaPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingHabits, setLoadingHabits] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [addHabitOpen, setAddHabitOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [habitForm, setHabitForm] = useState({ name: '', description: '', frequency: 'DAILY' })
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: '',
    isRecurring: false,
  })

  const fetchHabits = useCallback(async () => {
    const res = await fetch('/api/rotina/habits')
    if (res.ok) setHabits(await res.json())
    setLoadingHabits(false)
  }, [])

  const fetchTasks = useCallback(async () => {
    const url = showAllTasks ? '/api/rotina/tasks?status=ALL' : '/api/rotina/tasks'
    const res = await fetch(url)
    if (res.ok) setTasks(await res.json())
    setLoadingTasks(false)
  }, [showAllTasks])

  useEffect(() => { fetchHabits() }, [fetchHabits])
  useEffect(() => { fetchTasks() }, [fetchTasks])

  // ── Habit actions

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
      toast.error('Erro ao registrar hábito.')
    }
  }

  async function handleDeleteHabit(habitId: string) {
    if (!confirm('Remover este hábito?')) return
    const res = await fetch(`/api/rotina/habits/${habitId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Hábito removido.')
      fetchHabits()
    } else {
      toast.error('Erro ao remover hábito.')
    }
  }

  // ── Task actions

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/rotina/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...taskForm,
        dueDate: taskForm.dueDate || null,
      }),
    })
    if (res.ok) {
      toast.success('Tarefa criada!')
      setAddTaskOpen(false)
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', isRecurring: false })
      fetchTasks()
    } else {
      toast.error('Erro ao criar tarefa.')
    }
  }

  async function handleTaskStatus(taskId: string, status: string) {
    const res = await fetch('/api/rotina/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status }),
    })
    if (res.ok) fetchTasks()
    else toast.error('Erro ao atualizar tarefa.')
  }

  async function handleDeleteTask(taskId: string) {
    const res = await fetch('/api/rotina/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId }),
    })
    if (res.ok) {
      toast.success('Tarefa deletada.')
      fetchTasks()
    } else {
      toast.error('Erro ao deletar tarefa.')
    }
  }

  // ── Productivity score
  const today = startOfDay(new Date()).toDateString()
  const dailyHabits = habits.filter(h => h.frequency === 'DAILY')
  const doneToday = dailyHabits.filter(h =>
    h.logs.some(l => startOfDay(new Date(l.date)).toDateString() === today && l.completed)
  ).length
  const productivityScore = dailyHabits.length > 0
    ? Math.round((doneToday / dailyHabits.length) * 100)
    : 0

  const pendingTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS')
  const urgentTasks = pendingTasks.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH')

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rotina & Hábitos</h1>
          <p className="text-muted-foreground text-sm">COO — Disciplina e excelência operacional</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <ListTodo className="w-4 h-4 mr-1.5" />
                  Nova Tarefa
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Tarefa</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddTask} className="space-y-4">
                <div className="space-y-1">
                  <Label>Título *</Label>
                  <Input
                    placeholder="Ex: Revisar contrato de aluguel"
                    value={taskForm.title}
                    onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Detalhes da tarefa..."
                    value={taskForm.description}
                    onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Prioridade</Label>
                    <Select
                      value={taskForm.priority}
                      onValueChange={v => setTaskForm(f => ({ ...f, priority: v ?? f.priority }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
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
                    <Input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isRecurring"
                    checked={taskForm.isRecurring}
                    onChange={e => setTaskForm(f => ({ ...f, isRecurring: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="isRecurring" className="cursor-pointer">Tarefa recorrente</Label>
                </div>
                <div className="flex gap-2">
                  <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>
                    Cancelar
                  </DialogClose>
                  <Button type="submit" className="flex-1">Criar Tarefa</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={addHabitOpen} onOpenChange={setAddHabitOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Novo Hábito
                </Button>
              }
            />
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Criar Novo Hábito</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddHabit} className="space-y-4">
                <div className="space-y-1">
                  <Label>Nome do hábito *</Label>
                  <Input
                    placeholder="Ex: Meditar 10 minutos"
                    value={habitForm.name}
                    onChange={e => setHabitForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    placeholder="Detalhes do hábito..."
                    value={habitForm.description}
                    onChange={e => setHabitForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Frequência</Label>
                  <Select
                    value={habitForm.frequency}
                    onValueChange={v => setHabitForm(f => ({ ...f, frequency: v ?? f.frequency }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Diário</SelectItem>
                      <SelectItem value="WEEKLY">Semanal</SelectItem>
                      <SelectItem value="MONTHLY">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>
                    Cancelar
                  </DialogClose>
                  <Button type="submit" className="flex-1">Criar Hábito</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats row */}
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
            <p className="text-2xl font-bold text-blue-400">{pendingTasks.length}</p>
            {urgentTasks.length > 0 && (
              <p className="text-xs text-red-400 mt-0.5">{urgentTasks.length} urgentes</p>
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

      {/* Productivity bar */}
      {dailyHabits.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Check-in de hoje</p>
              <span className={cn(
                'text-sm font-bold',
                productivityScore >= 80 ? 'text-green-400' : productivityScore >= 50 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {productivityScore >= 80 ? '🔥 Excelente!' : productivityScore >= 50 ? '💪 Bom progresso!' : '⚡ Vamos lá!'}
              </span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  productivityScore >= 80 ? 'bg-green-500' : productivityScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${productivityScore}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {doneToday} de {dailyHabits.length} hábitos diários concluídos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Hábitos | Tarefas | COO */}
      <Tabs defaultValue="habits">
        <TabsList>
          <TabsTrigger value="habits">
            <Flame className="w-3.5 h-3.5 mr-1.5" />
            Hábitos
            {habits.length > 0 && (
              <span className="ml-1.5 bg-muted text-muted-foreground rounded-full px-1.5 text-xs">
                {habits.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo className="w-3.5 h-3.5 mr-1.5" />
            Tarefas
            {pendingTasks.length > 0 && (
              <span className="ml-1.5 bg-muted text-muted-foreground rounded-full px-1.5 text-xs">
                {pendingTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="coo">
            <Bot className="w-3.5 h-3.5 mr-1.5" />
            COO AI
          </TabsTrigger>
        </TabsList>

        {/* ── HABITS TAB */}
        <TabsContent value="habits" className="mt-4">
          {loadingHabits ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                    <div className="flex gap-1">
                      {[1,2,3,4,5,6,7].map(j => (
                        <div key={j} className="w-6 h-6 bg-muted rounded animate-pulse" />
                      ))}
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
                <p className="text-sm text-muted-foreground">
                  Crie seus primeiros hábitos para começar a construir uma rotina sólida.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Today's check-in section */}
              {dailyHabits.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    Check-in de {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dailyHabits.map(habit => (
                      <HabitCard
                        key={habit.id}
                        habit={habit}
                        onLog={handleLogHabit}
                        onDelete={handleDeleteHabit}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly/Monthly habits */}
              {habits.filter(h => h.frequency !== 'DAILY').length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Hábitos Semanais / Mensais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {habits
                      .filter(h => h.frequency !== 'DAILY')
                      .map(habit => (
                        <HabitCard
                          key={habit.id}
                          habit={habit}
                          onLog={handleLogHabit}
                          onDelete={handleDeleteHabit}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TASKS TAB */}
        <TabsContent value="tasks" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {showAllTasks ? 'Todas as tarefas' : 'Tarefas ativas'}
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAllTasks(s => !s)}
                className="text-xs text-muted-foreground"
              >
                {showAllTasks ? 'Mostrar apenas ativas' : 'Ver todas'}
              </Button>
            </div>

            {loadingTasks ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex gap-3">
                        <div className="w-4 h-4 bg-muted rounded animate-pulse mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                          <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium mb-1">Nenhuma tarefa encontrada</p>
                  <p className="text-sm text-muted-foreground">
                    Crie tarefas para acompanhar suas obrigações diárias.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Urgent / High priority */}
                {urgentTasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Star className="w-3 h-3" /> Prioridade Alta
                    </h4>
                    <div className="space-y-2">
                      {urgentTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={handleTaskStatus}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Other tasks */}
                {tasks.filter(t => t.priority !== 'URGENT' && t.priority !== 'HIGH' || t.status === 'COMPLETED' || t.status === 'CANCELLED').length > 0 && (
                  <div className="space-y-2">
                    {urgentTasks.length > 0 && (
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Demais Tarefas
                      </h4>
                    )}
                    <div className="space-y-2">
                      {tasks
                        .filter(t => !(t.priority === 'URGENT' || t.priority === 'HIGH') || t.status === 'COMPLETED' || t.status === 'CANCELLED')
                        .map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onStatusChange={handleTaskStatus}
                            onDelete={handleDeleteTask}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── COO CHAT TAB */}
        <TabsContent value="coo" className="mt-4">
          <COOChatPanel habits={habits} tasks={tasks} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
