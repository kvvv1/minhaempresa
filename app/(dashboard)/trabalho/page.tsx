'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Briefcase, Kanban, CalendarRange, Timer,
  Trash2, Circle, CheckCircle2, Clock,
  Play, Square, Users, MapPin, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { cn, formatDateTime } from '@/lib/utils'
import { ChatButton } from '@/components/ai/ChatButton'

type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
type KanbanStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

interface Project {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  priority: TaskPriority
  startDate?: string
  dueDate?: string
  color?: string
  tasks: { id: string; status: KanbanStatus }[]
}

interface ProjectTask {
  id: string
  title: string
  description?: string
  status: KanbanStatus
  priority: TaskPriority
  dueDate?: string
  estimatedMin?: number
  projectId?: string
  project?: { id: string; name: string; color?: string }
}

interface Meeting {
  id: string
  title: string
  description?: string
  startAt: string
  endAt?: string
  location?: string
  attendees: string[]
  notes?: string
  actionItems: { text: string; done: boolean }[]
  project?: { id: string; name: string; color?: string }
}

interface TimeEntry {
  id: string
  description?: string
  startAt: string
  endAt?: string
  durationMin?: number
  billable: boolean
  projectTask?: { id: string; title: string; project?: { id: string; name: string } }
}

const STATUS_CONFIG: Record<KanbanStatus, { label: string; color: string; bg: string }> = {
  BACKLOG:     { label: 'Backlog',      color: 'text-slate-400',  bg: 'bg-slate-400/10' },
  TODO:        { label: 'A Fazer',      color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  IN_PROGRESS: { label: 'Em Progresso', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  IN_REVIEW:   { label: 'Em Revisão',   color: 'text-purple-400', bg: 'bg-purple-400/10' },
  DONE:        { label: 'Concluído',    color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  LOW:    { label: 'Baixa',   color: 'text-slate-400' },
  MEDIUM: { label: 'Média',   color: 'text-blue-400' },
  HIGH:   { label: 'Alta',    color: 'text-orange-400' },
  URGENT: { label: 'Urgente', color: 'text-red-400' },
}

const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#f97316']

export default function TrabalhoPage() {
  const [pm, setPm] = useState<{ name: string } | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [projectForm, setProjectForm] = useState({ title: '', description: '', priority: 'MEDIUM' as TaskPriority, dueDate: '', color: PROJECT_COLORS[0] })
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM' as TaskPriority, status: 'BACKLOG' as KanbanStatus, projectId: '', dueDate: '', estimatedMin: '' })
  const [meetingForm, setMeetingForm] = useState({ title: '', description: '', startAt: '', endAt: '', location: '', attendees: '', projectId: '' })
  const [projectOpen, setProjectOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [summary, setSummary] = useState({ activeProjects: 0, overdueCount: 0, weekMinutes: 0 })

  const fetchAll = useCallback(async () => {
    const [pRes, tRes, mRes, teRes, timerRes, sumRes] = await Promise.all([
      fetch('/api/trabalho/projects'),
      fetch('/api/trabalho/tasks'),
      fetch('/api/trabalho/meetings?upcoming=true'),
      fetch('/api/trabalho/time-entries'),
      fetch('/api/trabalho/time-entries/active'),
      fetch('/api/trabalho'),
    ])
    if (pRes.ok) setProjects(await pRes.json())
    if (tRes.ok) setTasks(await tRes.json())
    if (mRes.ok) setMeetings(await mRes.json())
    if (teRes.ok) setTimeEntries(await teRes.json())
    if (timerRes.ok) {
      const t = await timerRes.json()
      setActiveTimer(t)
      if (t) {
        const elapsed = Math.floor((Date.now() - new Date(t.startAt).getTime()) / 1000)
        setTimerSeconds(elapsed)
      }
    }
    if (sumRes.ok) setSummary(await sumRes.json())
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    fetch('/api/employees?role=PROJECT_MANAGER').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.[0]) setPm(d[0]) })
  }, [])

  useEffect(() => {
    if (activeTimer) {
      timerRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setTimerSeconds(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activeTimer])

  function formatTimer(s: number) {
    const h = Math.floor(s / 3600).toString().padStart(2, '0')
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${h}:${m}:${sec}`
  }

  async function startTimer(taskId?: string) {
    try {
      const res = await fetch('/api/trabalho/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectTaskId: taskId || null, startAt: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error()
      const entry = await res.json()
      setActiveTimer(entry)
      setTimerSeconds(0)
      toast.success('Timer iniciado')
    } catch {
      toast.error('Erro ao iniciar timer')
    }
  }

  async function stopTimer() {
    if (!activeTimer) return
    try {
      const res = await fetch(`/api/trabalho/time-entries/${activeTimer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endAt: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error()
      setActiveTimer(null)
      fetchAll()
      toast.success('Timer parado')
    } catch {
      toast.error('Erro ao parar timer')
    }
  }

  async function createProject() {
    try {
      const res = await fetch('/api/trabalho/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectForm.title, description: projectForm.description, priority: projectForm.priority, dueDate: projectForm.dueDate || undefined, color: projectForm.color }),
      })
      if (!res.ok) throw new Error()
      toast.success('Projeto criado!')
      setProjectOpen(false)
      setProjectForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', color: PROJECT_COLORS[0] })
      fetchAll()
    } catch { toast.error('Erro ao criar projeto') }
  }

  async function createTask() {
    try {
      const res = await fetch('/api/trabalho/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskForm, projectId: taskForm.projectId || null, dueDate: taskForm.dueDate || undefined, estimatedMin: taskForm.estimatedMin ? Number(taskForm.estimatedMin) : undefined }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tarefa criada!')
      setTaskOpen(false)
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'BACKLOG', projectId: '', dueDate: '', estimatedMin: '' })
      fetchAll()
    } catch { toast.error('Erro ao criar tarefa') }
  }

  async function createMeeting() {
    try {
      const res = await fetch('/api/trabalho/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meetingForm, projectId: meetingForm.projectId || null, attendees: meetingForm.attendees.split(',').map((a) => a.trim()).filter(Boolean), endAt: meetingForm.endAt || undefined }),
      })
      if (!res.ok) throw new Error()
      toast.success('Reunião criada!')
      setMeetingOpen(false)
      setMeetingForm({ title: '', description: '', startAt: '', endAt: '', location: '', attendees: '', projectId: '' })
      fetchAll()
    } catch { toast.error('Erro ao criar reunião') }
  }

  async function moveTask(taskId: string, newStatus: KanbanStatus) {
    try {
      await fetch(`/api/trabalho/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
    } catch { toast.error('Erro ao mover tarefa') }
  }

  async function deleteTask(id: string) {
    try {
      await fetch(`/api/trabalho/tasks/${id}`, { method: 'DELETE' })
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch { toast.error('Erro ao deletar') }
  }

  async function deleteProject(id: string) {
    try {
      await fetch(`/api/trabalho/projects/${id}`, { method: 'DELETE' })
      setProjects((prev) => prev.filter((p) => p.id !== id))
      toast.success('Projeto removido')
    } catch { toast.error('Erro ao deletar') }
  }

  async function toggleActionItem(meeting: Meeting, idx: number) {
    const updated = meeting.actionItems.map((a, i) => i === idx ? { ...a, done: !a.done } : a)
    try {
      await fetch(`/api/trabalho/meetings/${meeting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItems: updated }),
      })
      setMeetings((prev) => prev.map((m) => m.id === meeting.id ? { ...m, actionItems: updated } : m))
    } catch { toast.error('Erro ao atualizar') }
  }

  const filteredTasks = selectedProjectId === 'all' ? tasks : tasks.filter((t) => t.projectId === selectedProjectId)
  const weekHours = Math.round(summary.weekMinutes / 60 * 10) / 10

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trabalho</h1>
          <p className="text-muted-foreground text-sm">Projetos, tarefas e reuniões</p>
        </div>
        <div className="flex gap-2">
          {pm && <ChatButton employeeRole="PROJECT_MANAGER" employeeName={pm.name} moduleData={{ summary, projects, tasks, meetings }} />}
          <Button variant="outline" size="sm" onClick={() => setMeetingOpen(true)}><CalendarRange className="w-4 h-4 mr-2" />Reunião</Button>
          <Button variant="outline" size="sm" onClick={() => setTaskOpen(true)}><Plus className="w-4 h-4 mr-2" />Tarefa</Button>
          <Button size="sm" onClick={() => setProjectOpen(true)}><Plus className="w-4 h-4 mr-2" />Projeto</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{summary.activeProjects}</p><p className="text-xs text-muted-foreground">Projetos ativos</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{filteredTasks.filter((t) => t.status === 'IN_PROGRESS').length}</p><p className="text-xs text-muted-foreground">Em progresso</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className={cn('text-2xl font-bold', summary.overdueCount > 0 && 'text-red-400')}>{summary.overdueCount}</p><p className="text-xs text-muted-foreground">Atrasadas</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{weekHours}h</p><p className="text-xs text-muted-foreground">Esta semana</p></CardContent></Card>
      </div>

      {/* Alerta de tarefas atrasadas */}
      {summary.overdueCount > 0 && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-red-400">
            {summary.overdueCount} tarefa{summary.overdueCount > 1 ? 's' : ''} atrasada{summary.overdueCount > 1 ? 's' : ''}
          </AlertTitle>
          <AlertDescription className="text-red-300/80">
            Acesse o Kanban para resolver as pendências críticas.
          </AlertDescription>
        </Alert>
      )}

      {/* Timer ativo */}
      {activeTimer && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium">Timer rodando</p>
              {activeTimer.projectTask && <p className="text-xs text-muted-foreground">{activeTimer.projectTask.title}</p>}
            </div>
            <span className="text-xl font-mono font-bold text-yellow-400">{formatTimer(timerSeconds)}</span>
            <Button variant="outline" size="sm" onClick={stopTimer}><Square className="w-4 h-4 mr-2" />Parar</Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="projetos">
        <TabsList>
          <TabsTrigger value="projetos"><Briefcase className="w-4 h-4 mr-2" />Projetos</TabsTrigger>
          <TabsTrigger value="kanban"><Kanban className="w-4 h-4 mr-2" />Kanban</TabsTrigger>
          <TabsTrigger value="reunioes"><CalendarRange className="w-4 h-4 mr-2" />Reuniões</TabsTrigger>
          <TabsTrigger value="tempo"><Timer className="w-4 h-4 mr-2" />Tempo</TabsTrigger>
        </TabsList>

        {/* Projetos */}
        <TabsContent value="projetos" className="mt-6">
          {projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum projeto ainda</p></div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => {
                const done = p.tasks.filter((t) => t.status === 'DONE').length
                const total = p.tasks.length
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <Card key={p.id} className="hover:border-border/60 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color ?? '#6366f1' }} />
                          <CardTitle className="text-sm">{p.name}</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => deleteProject(p.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{done}/{total} tarefas</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{PRIORITY_CONFIG[p.priority].label}</Badge>
                        {p.dueDate && <Badge variant="outline" className={cn('text-xs', new Date(p.dueDate) < new Date() && 'border-red-500/50 text-red-400')}>{new Date(p.dueDate).toLocaleDateString('pt-BR')}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Kanban */}
        <TabsContent value="kanban" className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm">Projeto:</Label>
            <Select value={selectedProjectId} onValueChange={(v) => setSelectedProjectId(v ?? 'all')}>
              <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(STATUS_CONFIG) as KanbanStatus[]).map((status) => {
              const config = STATUS_CONFIG[status]
              const col = filteredTasks.filter((t) => t.status === status)
              return (
                <div key={status} className="space-y-2">
                  <div className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg', config.bg)}>
                    <span className={cn('text-xs font-semibold', config.color)}>{config.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{col.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[100px]">
                    {col.map((task) => (
                      <div key={task.id} className="p-2.5 rounded-lg border bg-card text-sm space-y-2">
                        <p className="font-medium text-xs leading-tight">{task.title}</p>
                        <div className="flex flex-wrap gap-1">
                          <span className={cn('text-xs', PRIORITY_CONFIG[task.priority].color)}>{PRIORITY_CONFIG[task.priority].label}</span>
                          {task.estimatedMin && <span className="text-xs text-muted-foreground">{task.estimatedMin}min</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Select value={task.status} onValueChange={(v) => moveTask(task.id, v as KanbanStatus)}>
                            <SelectTrigger className="h-6 text-xs flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_CONFIG) as KanbanStatus[]).map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">{STATUS_CONFIG[s].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="w-6 h-6 flex-shrink-0" onClick={() => startTimer(task.id)} title="Iniciar timer"><Play className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="w-6 h-6 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>

        {/* Reuniões */}
        <TabsContent value="reunioes" className="mt-6">
          {meetings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><CalendarRange className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhuma reunião próxima</p></div>
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(m.startAt)}</p>
                      </div>
                      {m.project && <Badge variant="outline" className="text-xs" style={{ borderColor: m.project.color ?? undefined }}>{m.project.name}</Badge>}
                    </div>
                    {m.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{m.location}</p>}
                    {m.attendees.length > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{m.attendees.join(', ')}</p>
                    )}
                    {m.actionItems.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Action Items</p>
                        {m.actionItems.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 cursor-pointer" onClick={() => toggleActionItem(m, i)}>
                            {a.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                            <span className={cn('text-xs', a.done && 'line-through text-muted-foreground')}>{a.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tempo */}
        <TabsContent value="tempo" className="mt-6 space-y-4">
          {!activeTimer && (
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <Timer className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground flex-1">Nenhum timer ativo</p>
                <Button size="sm" onClick={() => startTimer()}><Play className="w-4 h-4 mr-2" />Iniciar</Button>
              </CardContent>
            </Card>
          )}
          {(() => {
            const tasksWithEstimate = tasks.filter(t => t.estimatedMin)
            if (tasksWithEstimate.length === 0) return null
            return (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Estimativa vs. Real
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasksWithEstimate.slice(0, 5).map(task => {
                    const actual = timeEntries.filter(e => e.projectTask?.id === task.id).reduce((s, e) => s + (e.durationMin ?? 0), 0)
                    const pct = task.estimatedMin! > 0 ? Math.round((actual / task.estimatedMin!) * 100) : 0
                    const over = actual > task.estimatedMin!
                    return (
                      <div key={task.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="truncate font-medium max-w-[60%]">{task.title}</span>
                          <span className={cn(over ? 'text-red-400' : 'text-emerald-400')}>
                            {actual}min / {task.estimatedMin}min estimado
                          </span>
                        </div>
                        <Progress value={Math.min(100, pct)} className="h-1.5" />
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })()}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Últimos 7 dias</p>
            {timeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma entrada de tempo ainda</p>
            ) : (
              timeEntries.map((e) => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {e.projectTask ? (
                      <p className="font-medium text-xs truncate">{e.projectTask.title}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem tarefa</p>
                    )}
                    {e.description && <p className="text-xs text-muted-foreground truncate">{e.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {e.durationMin ? (
                      <p className="text-xs font-mono">{Math.floor(e.durationMin / 60)}h{e.durationMin % 60}m</p>
                    ) : (
                      <p className="text-xs text-yellow-400">Em andamento</p>
                    )}
                    <p className="text-xs text-muted-foreground">{new Date(e.startAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Projeto */}
      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Nome</Label><Input placeholder="Nome do projeto" value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} /></div>
            <div className="space-y-1"><Label>Descrição</Label><Textarea placeholder="Opcional" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select value={projectForm.priority} onValueChange={(v) => setProjectForm({ ...projectForm, priority: v as TaskPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Prazo</Label><Input type="date" value={projectForm.dueDate} onChange={(e) => setProjectForm({ ...projectForm, dueDate: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button key={c} className={cn('w-6 h-6 rounded-full border-2 transition-transform', projectForm.color === c ? 'border-white scale-110' : 'border-transparent')} style={{ background: c }} onClick={() => setProjectForm({ ...projectForm, color: c })} />
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={createProject} disabled={!projectForm.title.trim()}>Criar Projeto</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Tarefa */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Título</Label><Input placeholder="O que precisa ser feito?" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
            <div className="space-y-1"><Label>Projeto</Label>
              <Select value={taskForm.projectId} onValueChange={(v) => setTaskForm({ ...taskForm, projectId: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem projeto</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v as KanbanStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v as TaskPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Prazo</Label><Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></div>
              <div className="space-y-1"><Label>Estimativa (min)</Label><Input type="number" placeholder="30" value={taskForm.estimatedMin} onChange={(e) => setTaskForm({ ...taskForm, estimatedMin: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={createTask} disabled={!taskForm.title.trim()}>Criar Tarefa</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Reunião */}
      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Reunião</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Título</Label><Input placeholder="Título da reunião" value={meetingForm.title} onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Início</Label><Input type="datetime-local" value={meetingForm.startAt} onChange={(e) => setMeetingForm({ ...meetingForm, startAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Fim</Label><Input type="datetime-local" value={meetingForm.endAt} onChange={(e) => setMeetingForm({ ...meetingForm, endAt: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Local</Label><Input placeholder="Sala, link, endereço..." value={meetingForm.location} onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })} /></div>
            <div className="space-y-1"><Label>Participantes</Label><Input placeholder="João, Maria, Pedro (separados por vírgula)" value={meetingForm.attendees} onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Projeto</Label>
              <Select value={meetingForm.projectId} onValueChange={(v) => setMeetingForm({ ...meetingForm, projectId: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem projeto</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={createMeeting} disabled={!meetingForm.title.trim() || !meetingForm.startAt}>Criar Reunião</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
