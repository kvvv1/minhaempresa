'use client'

import { useCallback, useEffect, useState } from 'react'
import { addMinutes, format } from 'date-fns'
import {
  Archive,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Inbox,
  Plus,
  Sunset,
  Tag,
  Trash2,
} from 'lucide-react'
import { ChatButton } from '@/components/ai/ChatButton'
import { PlannerActionMenu, type PlannerQuickAction } from '@/components/planner/PlannerActionMenu'
import {
  PlannerMonthBoard,
  PlannerSummaryCards,
  PlannerTimelineCard,
  PlannerTodayBoard,
  PlannerWeekBoard,
} from '@/components/planner/PlannerViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { PlannerItem, PlannerModule, PlannerResponse, PlannerSourceType } from '@/lib/planner'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type GtdBucket = 'INBOX' | 'TODAY' | 'THIS_WEEK' | 'SOMEDAY' | 'WAITING' | 'REFERENCE'
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
type GtdEnergy = 'LOW' | 'MEDIUM' | 'HIGH'
type PlannerView = 'today' | 'week' | 'month' | 'agenda'
type PlannerScheduleMode = 'manual' | 'linked'

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
  projectRef?: string
  createdAt: string
}

const BUCKET_CONFIG: Record<GtdBucket, { label: string; icon: React.ElementType; color: string }> = {
  INBOX: { label: 'Inbox', icon: Inbox, color: 'text-slate-400' },
  TODAY: { label: 'Hoje', icon: Calendar, color: 'text-red-400' },
  THIS_WEEK: { label: 'Esta Semana', icon: CalendarDays, color: 'text-orange-400' },
  SOMEDAY: { label: 'Algum Dia', icon: Sunset, color: 'text-blue-400' },
  WAITING: { label: 'Aguardando', icon: Clock, color: 'text-yellow-400' },
  REFERENCE: { label: 'Referencia', icon: Archive, color: 'text-purple-400' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  LOW: { label: 'Baixa', color: 'text-slate-400' },
  MEDIUM: { label: 'Media', color: 'text-blue-400' },
  HIGH: { label: 'Alta', color: 'text-orange-400' },
  URGENT: { label: 'Urgente', color: 'text-red-400' },
}

const ENERGY_CONFIG: Record<GtdEnergy, { label: string; icon: string }> = {
  LOW: { label: 'Baixa', icon: 'B' },
  MEDIUM: { label: 'Media', icon: 'M' },
  HIGH: { label: 'Alta', icon: 'A' },
}

const GTD_TABS: (GtdBucket | 'capturar')[] = ['capturar', 'INBOX', 'TODAY', 'THIS_WEEK', 'SOMEDAY', 'WAITING']

interface PlannerScheduleFormState {
  mode: PlannerScheduleMode
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

function formatDateInput(value: Date) {
  return format(value, 'yyyy-MM-dd')
}

function formatTimeInput(value: Date) {
  return format(value, 'HH:mm')
}

function getNextHourDate(base = new Date()) {
  const nextHour = new Date(base)
  nextHour.setMinutes(0, 0, 0)
  nextHour.setHours(nextHour.getHours() + 1)
  return nextHour
}

function buildDateTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00`)
}

function getManualBlockForm(): PlannerScheduleFormState {
  const startAt = getNextHourDate()
  const endAt = addMinutes(startAt, 60)

  return {
    mode: 'manual',
    eventId: null,
    sourceId: null,
    sourceType: null,
    sourceModule: null,
    title: '',
    description: '',
    date: formatDateInput(startAt),
    startTime: formatTimeInput(startAt),
    endTime: formatTimeInput(endAt),
    allDay: false,
  }
}

function getScheduleFormFromItem(item: PlannerItem): PlannerScheduleFormState {
  const baseStart = item.scheduledStart ? new Date(item.scheduledStart) : item.dueDate ? getNextHourDate(new Date(item.dueDate)) : getNextHourDate()
  const baseEnd = item.scheduledEnd ? new Date(item.scheduledEnd) : addMinutes(baseStart, item.estimatedMin ?? 60)
  const isManualBlock = item.sourceType === 'calendarEvent' || item.scheduleMode === 'manual'

  return {
    mode: isManualBlock ? 'manual' : 'linked',
    eventId: item.scheduleEventId ?? (item.sourceType === 'calendarEvent' ? item.sourceId : null),
    sourceId: isManualBlock ? null : item.sourceId,
    sourceType: isManualBlock ? null : item.sourceType,
    sourceModule: isManualBlock ? null : item.sourceModule,
    title: item.title,
    description: item.description ?? '',
    date: formatDateInput(baseStart),
    startTime: formatTimeInput(baseStart),
    endTime: formatTimeInput(baseEnd),
    allDay: item.allDay ?? false,
  }
}

export default function TarefasPage() {
  const [pm, setPm] = useState<{ name: string } | null>(null)
  const [tasks, setTasks] = useState<GtdTask[]>([])
  const [bucketCounts, setBucketCounts] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<GtdBucket | 'capturar'>('capturar')
  const [plannerView, setPlannerView] = useState<PlannerView>('today')
  const [captureInput, setCaptureInput] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [processDialogTask, setProcessDialogTask] = useState<GtdTask | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [plannerLoading, setPlannerLoading] = useState(true)
  const [todayPlanner, setTodayPlanner] = useState<PlannerResponse | null>(null)
  const [weekPlanner, setWeekPlanner] = useState<PlannerResponse | null>(null)
  const [monthPlanner, setMonthPlanner] = useState<PlannerResponse | null>(null)
  const [scheduleForm, setScheduleForm] = useState<PlannerScheduleFormState | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    bucket: 'INBOX' as GtdBucket,
    priority: 'MEDIUM' as TaskPriority,
    dueDate: '',
    context: '',
    energy: '' as GtdEnergy | '',
    estimatedMin: '',
  })

  const fetchTasks = useCallback(async (bucket?: GtdBucket) => {
    const url = bucket ? `/api/tarefas/gtd?bucket=${bucket}` : '/api/tarefas/gtd'
    const res = await fetch(url)
    if (res.ok) setTasks(await res.json())
  }, [])

  const fetchSummary = useCallback(async () => {
    const res = await fetch('/api/tarefas')
    if (res.ok) {
      const data = await res.json()
      setBucketCounts(data.bucketCounts ?? {})
    }
  }, [])

  const fetchPlannerData = useCallback(async () => {
    setPlannerLoading(true)

    try {
      const [todayRes, weekRes, monthRes] = await Promise.all([
        fetch('/api/planner?scope=today'),
        fetch('/api/planner?scope=week'),
        fetch('/api/planner?scope=month'),
      ])

      if (todayRes.ok) setTodayPlanner(await todayRes.json())
      if (weekRes.ok) setWeekPlanner(await weekRes.json())
      if (monthRes.ok) setMonthPlanner(await monthRes.json())
    } finally {
      setPlannerLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
    fetchPlannerData()
  }, [fetchPlannerData, fetchSummary])

  useEffect(() => {
    fetch('/api/employees?role=PROJECT_MANAGER').then((res) => (res.ok ? res.json() : null)).then((data) => {
      if (data?.[0]) setPm(data[0])
    })
  }, [])

  useEffect(() => {
    if (activeTab !== 'capturar') {
      fetchTasks(activeTab as GtdBucket)
    }
  }, [activeTab, fetchTasks])

  async function refreshTaskSurfaces(bucket?: GtdBucket) {
    fetchSummary()
    fetchPlannerData()

    if (bucket && activeTab === bucket) {
      fetchTasks(bucket)
      return
    }

    if (activeTab !== 'capturar') {
      fetchTasks(activeTab as GtdBucket)
    }
  }

  function openManualBlockDialog() {
    setScheduleForm(getManualBlockForm())
  }

  function openScheduleDialog(item: PlannerItem) {
    setScheduleForm(getScheduleFormFromItem(item))
  }

  async function handlePlannerQuickAction(item: PlannerItem, action: PlannerQuickAction) {
    try {
      const res = await fetch('/api/planner/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sourceId: item.sourceId,
          sourceType: item.sourceType,
          sourceModule: item.sourceModule,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Erro ao executar acao')
      }

      const successLabel =
        action === 'move-to-today'
          ? 'Item movido para Hoje.'
          : action === 'move-to-week'
            ? 'Item movido para Semana.'
            : action === 'defer'
              ? 'Item adiado em 1 dia.'
              : action === 'complete'
                ? 'Item concluido na origem.'
                : 'Item reaberto na origem.'

      toast.success(successLabel)
      refreshTaskSurfaces()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao executar acao')
    }
  }

  async function handleSaveSchedule() {
    if (!scheduleForm) return

    if (!scheduleForm.date) {
      toast.error('Escolha uma data para o bloco.')
      return
    }

    if (scheduleForm.mode === 'manual' && !scheduleForm.title.trim()) {
      toast.error('Informe um titulo para o bloco manual.')
      return
    }

    const scheduledStart = scheduleForm.allDay ? buildDateTime(scheduleForm.date, '00:00') : buildDateTime(scheduleForm.date, scheduleForm.startTime)
    const scheduledEnd = scheduleForm.allDay ? null : buildDateTime(scheduleForm.date, scheduleForm.endTime)

    if (scheduledEnd && scheduledEnd <= scheduledStart) {
      toast.error('O horario final precisa ser maior que o inicial.')
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

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Erro ao salvar bloco')
      }

      toast.success(scheduleForm.eventId ? 'Bloco atualizado.' : 'Bloco criado.')
      setScheduleForm(null)
      refreshTaskSurfaces()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar bloco')
    } finally {
      setSavingSchedule(false)
    }
  }

  async function handleCapture(event: React.FormEvent) {
    event.preventDefault()
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
      refreshTaskSurfaces()
    } catch {
      toast.error('Erro ao capturar')
    } finally {
      setCapturing(false)
    }
  }

  async function handleCreate() {
    try {
      const res = await fetch('/api/tarefas/gtd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          energy: form.energy || undefined,
          estimatedMin: form.estimatedMin ? Number(form.estimatedMin) : undefined,
          dueDate: form.dueDate || undefined,
        }),
      })
      if (!res.ok) throw new Error()

      toast.success('Tarefa criada.')
      setCreateOpen(false)
      setForm({
        title: '',
        description: '',
        bucket: 'INBOX',
        priority: 'MEDIUM',
        dueDate: '',
        context: '',
        energy: '',
        estimatedMin: '',
      })
      refreshTaskSurfaces(form.bucket)
    } catch {
      toast.error('Erro ao criar tarefa')
    }
  }

  async function handleStatusToggle(task: GtdTask) {
    const newStatus: TaskStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'

    try {
      const res = await fetch(`/api/tarefas/gtd/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()

      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, status: newStatus } : item)))
      refreshTaskSurfaces(task.bucket)
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/tarefas/gtd/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()

      setTasks((prev) => prev.filter((task) => task.id !== id))
      toast.success('Tarefa removida')
      refreshTaskSurfaces()
    } catch {
      toast.error('Erro ao remover')
    }
  }

  async function handleProcess(task: GtdTask, targetBucket: GtdBucket) {
    try {
      const res = await fetch('/api/tarefas/gtd/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [task.id], targetBucket }),
      })
      if (!res.ok) throw new Error()

      setTasks((prev) => prev.filter((item) => item.id !== task.id))
      setProcessDialogTask(null)
      toast.success(`Movido para ${BUCKET_CONFIG[targetBucket].label}`)
      refreshTaskSurfaces(targetBucket)
    } catch {
      toast.error('Erro ao processar')
    }
  }

  const plannerData = plannerView === 'week' ? weekPlanner : plannerView === 'month' ? monthPlanner : todayPlanner
  const renderPlannerItemActions = (item: PlannerItem) => (
    <PlannerActionMenu item={item} onQuickAction={handlePlannerQuickAction} onSchedule={openScheduleDialog} />
  )

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Central Operacional</h1>
          <p className="text-sm text-muted-foreground">Hoje, semana, mes e agenda 24h conectados ao seu fluxo GTD.</p>
        </div>
        <div className="flex items-center gap-2">
          {pm && <ChatButton employeeRole="PROJECT_MANAGER" employeeName={pm.name} moduleData={{ tasks, bucketCounts, plannerToday: todayPlanner?.summary }} />}
          <Button variant="outline" size="sm" onClick={() => setReviewOpen(true)}>
            Revisao Semanal
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Nova Tarefa</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Tarefa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Titulo</Label>
                  <Input placeholder="O que precisa ser feito?" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Descricao</Label>
                  <Textarea placeholder="Detalhes opcionais..." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Bucket</Label>
                    <Select value={form.bucket} onValueChange={(value) => setForm({ ...form, bucket: value as GtdBucket })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(BUCKET_CONFIG).map(([key, value]) => (
                          <SelectItem key={key} value={key}>{value.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Prioridade</Label>
                    <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as TaskPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_CONFIG).map(([key, value]) => (
                          <SelectItem key={key} value={key}>{value.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Prazo</Label>
                    <Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Energia</Label>
                    <Select value={form.energy} onValueChange={(value) => setForm({ ...form, energy: value as GtdEnergy })}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ENERGY_CONFIG).map(([key, value]) => (
                          <SelectItem key={key} value={key}>{value.icon} {value.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Contexto</Label>
                    <Input placeholder="@trabalho, @casa..." value={form.context} onChange={(event) => setForm({ ...form, context: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Estimativa (min)</Label>
                    <Input type="number" placeholder="30" value={form.estimatedMin} onChange={(event) => setForm({ ...form, estimatedMin: event.target.value })} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={!form.title.trim()}>Criar Tarefa</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Planejamento</h2>
            <p className="text-sm text-muted-foreground">A camada principal para decidir o que fazer agora, nesta semana e neste mes.</p>
          </div>
          <Button variant="outline" size="sm" onClick={openManualBlockDialog}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Novo bloco
          </Button>
        </div>

        {plannerLoading && !plannerData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-[34rem] w-full" />
          </div>
        ) : plannerData ? (
          <>
            <PlannerSummaryCards summary={plannerData.summary} />

            <Tabs value={plannerView} onValueChange={(value) => setPlannerView(value as PlannerView)}>
              <TabsList className="flex h-auto flex-wrap gap-1">
                <TabsTrigger value="today">Hoje</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="month">Mes</TabsTrigger>
                <TabsTrigger value="agenda">Agenda 24h</TabsTrigger>
              </TabsList>

              <TabsContent value="today" className="mt-6">
                {todayPlanner ? <PlannerTodayBoard data={todayPlanner} renderItemActions={renderPlannerItemActions} /> : null}
              </TabsContent>

              <TabsContent value="week" className="mt-6">
                {weekPlanner ? <PlannerWeekBoard data={weekPlanner} renderItemActions={renderPlannerItemActions} /> : null}
              </TabsContent>

              <TabsContent value="month" className="mt-6">
                {monthPlanner ? <PlannerMonthBoard data={monthPlanner} renderItemActions={renderPlannerItemActions} /> : null}
              </TabsContent>

              <TabsContent value="agenda" className="mt-6">
                {todayPlanner ? (
                  <PlannerTimelineCard
                    title="Agenda 24h"
                    description="Blocos com horario, tarefas sem horario e habitos esperados para o dia."
                    scheduledItems={todayPlanner.scheduledItems}
                    floatingItems={todayPlanner.focusItems}
                    habits={todayPlanner.habits}
                    renderItemActions={renderPlannerItemActions}
                  />
                ) : null}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Sistema GTD</h2>
          <p className="text-sm text-muted-foreground">Capture, processe e revise backlog, proximas acoes e itens em espera.</p>
        </div>

        {(bucketCounts.INBOX ?? 0) === 0 && Object.values(bucketCounts).some((count) => count > 0) && (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Inbox zerado. Tudo processado.
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {(Object.keys(BUCKET_CONFIG) as GtdBucket[]).map((bucket) => {
            const config = BUCKET_CONFIG[bucket]
            const count = bucketCounts[bucket] ?? 0
            return (
              <Card key={bucket} className={cn('cursor-pointer transition-colors hover:border-border', activeTab === bucket && 'border-primary/40 bg-primary/5')} onClick={() => setActiveTab(bucket)}>
                <CardContent className="p-3 text-center">
                  <config.icon className={cn('mx-auto mb-1 h-4 w-4', config.color)} />
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GtdBucket | 'capturar')}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="capturar">Capturar</TabsTrigger>
            {GTD_TABS.filter((tab) => tab !== 'capturar').map((bucket) => (
              <TabsTrigger key={bucket} value={bucket}>
                {BUCKET_CONFIG[bucket].label}
                {(bucketCounts[bucket] ?? 0) > 0 ? (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 text-xs text-primary">{bucketCounts[bucket]}</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="capturar" className="mt-6">
            <Card className="mx-auto max-w-xl">
              <CardHeader>
                <CardTitle className="text-base">Captura Rapida</CardTitle>
                <p className="text-sm text-muted-foreground">Jogue tudo aqui. O processamento vem depois.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCapture} className="flex gap-2">
                  <Input
                    placeholder="O que esta na sua cabeca?"
                    value={captureInput}
                    onChange={(event) => setCaptureInput(event.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button type="submit" disabled={capturing || !captureInput.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>
                <p className="mt-3 text-xs text-muted-foreground">Use "Nova Tarefa" quando precisar registrar prazo, contexto, energia e estimativa.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {(Object.keys(BUCKET_CONFIG) as GtdBucket[]).map((bucket) => (
            <TabsContent key={bucket} value={bucket} className="mt-6">
              <TaskList
                tasks={tasks}
                bucket={bucket}
                onToggle={handleStatusToggle}
                onDelete={handleDelete}
                onProcess={(task) => setProcessDialogTask(task)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog open={!!scheduleForm} onOpenChange={(open) => !open && setScheduleForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {scheduleForm?.mode === 'manual'
                ? scheduleForm.eventId
                  ? 'Editar bloco manual'
                  : 'Novo bloco manual'
                : scheduleForm?.eventId
                  ? 'Reagendar tarefa'
                  : 'Agendar tarefa'}
            </DialogTitle>
          </DialogHeader>

          {scheduleForm ? (
            <div className="space-y-4">
              {scheduleForm.mode === 'linked' ? (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
                  <p className="text-sm font-medium text-sky-300">{scheduleForm.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bloco vinculado ao item de origem. A Central ajusta o planejamento e reflete a mudanca no registro real do modulo dono.
                  </p>
                </div>
              ) : null}

              <div className="space-y-1">
                <Label>Titulo</Label>
                <Input
                  placeholder="Ex.: Bloco de foco"
                  value={scheduleForm.title}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, title: event.target.value })}
                  disabled={scheduleForm.mode === 'linked'}
                />
              </div>

              <div className="space-y-1">
                <Label>Descricao</Label>
                <Textarea
                  placeholder="Detalhes do bloco..."
                  value={scheduleForm.description}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, description: event.target.value })}
                  rows={2}
                  disabled={scheduleForm.mode === 'linked'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Data</Label>
                  <Input type="date" value={scheduleForm.date} onChange={(event) => setScheduleForm({ ...scheduleForm, date: event.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={scheduleForm.allDay ? 'outline' : 'default'} className="flex-1" onClick={() => setScheduleForm({ ...scheduleForm, allDay: false })}>
                      Com horario
                    </Button>
                    <Button type="button" variant={scheduleForm.allDay ? 'default' : 'outline'} className="flex-1" onClick={() => setScheduleForm({ ...scheduleForm, allDay: true })}>
                      Dia inteiro
                    </Button>
                  </div>
                </div>
              </div>

              {!scheduleForm.allDay ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Inicio</Label>
                    <Input type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fim</Label>
                    <Input type="time" value={scheduleForm.endTime} onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })} />
                  </div>
                </div>
              ) : null}

              <Button className="w-full" onClick={handleSaveSchedule} disabled={savingSchedule}>
                {savingSchedule ? 'Salvando...' : scheduleForm.eventId ? 'Atualizar bloco' : 'Criar bloco'}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisao Semanal GTD</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-2 rounded-lg bg-muted/30 p-3">
              <p className="font-medium">1. Inbox ({bucketCounts.INBOX ?? 0} itens)</p>
              <p className="text-xs text-muted-foreground">Processe cada item: delete, delegue, faca agora ou mova para o bucket correto.</p>
              {(bucketCounts.INBOX ?? 0) === 0 ? <p className="text-xs text-emerald-400">Inbox limpo.</p> : null}
            </div>
            <div className="space-y-2 rounded-lg bg-muted/30 p-3">
              <p className="font-medium">2. Esta Semana ({bucketCounts.THIS_WEEK ?? 0} itens)</p>
              <p className="text-xs text-muted-foreground">Revise se ainda fazem sentido. Rebaixe ou delete o que perdeu contexto.</p>
            </div>
            <div className="space-y-2 rounded-lg bg-muted/30 p-3">
              <p className="font-medium">3. Algum Dia ({bucketCounts.SOMEDAY ?? 0} itens)</p>
              <p className="text-xs text-muted-foreground">Promova para Hoje ou Esta Semana o que realmente entrou no radar.</p>
            </div>
            <div className="space-y-2 rounded-lg bg-muted/30 p-3">
              <p className="font-medium">4. Aguardando ({bucketCounts.WAITING ?? 0} itens)</p>
              <p className="text-xs text-muted-foreground">Veja se precisa cobrar, lembrar alguem ou transformar em proximo passo seu.</p>
            </div>
            <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="font-medium text-emerald-400">5. Planejar a semana</p>
              <p className="text-xs text-muted-foreground">Escolha as tres prioridades reais e distribua entre Hoje, Semana e Agenda 24h.</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setReviewOpen(false)}>Revisao concluida</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!processDialogTask} onOpenChange={(open) => !open && setProcessDialogTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processar tarefa</DialogTitle>
          </DialogHeader>
          {processDialogTask ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{processDialogTask.title}</p>
              <p className="text-xs text-muted-foreground">Mover para:</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(BUCKET_CONFIG) as GtdBucket[]).filter((bucket) => bucket !== processDialogTask.bucket).map((bucket) => {
                  const config = BUCKET_CONFIG[bucket]
                  return (
                    <Button key={bucket} variant="outline" className="justify-start gap-2" onClick={() => handleProcess(processDialogTask, bucket)}>
                      <config.icon className={cn('h-4 w-4', config.color)} />
                      {config.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskList({
  tasks,
  bucket,
  onToggle,
  onDelete,
  onProcess,
}: {
  tasks: GtdTask[]
  bucket: GtdBucket
  onToggle: (task: GtdTask) => void
  onDelete: (id: string) => void
  onProcess: (task: GtdTask) => void
}) {
  const filtered = tasks.filter((task) => task.bucket === bucket)

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
      {filtered.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onProcess={onProcess} />
      ))}
    </div>
  )
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onProcess,
}: {
  task: GtdTask
  onToggle: (task: GtdTask) => void
  onDelete: (id: string) => void
  onProcess: (task: GtdTask) => void
}) {
  const done = task.status === 'COMPLETED'
  const priority = PRIORITY_CONFIG[task.priority]

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-border/60', done && 'opacity-50')}>
      <button onClick={() => onToggle(task)} className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', done && 'line-through')}>{task.title}</p>
        {task.description ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.description}</p> : null}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={cn('text-xs font-medium', priority.color)}>{priority.label}</span>
          {task.context ? (
            <Badge variant="outline" className="h-5 gap-1 px-1.5 py-0 text-xs">
              <Tag className="h-2.5 w-2.5" />
              {task.context}
            </Badge>
          ) : null}
          {task.energy ? (
            <Badge variant="outline" className="h-5 px-1.5 py-0 text-xs">
              {ENERGY_CONFIG[task.energy].icon} {ENERGY_CONFIG[task.energy].label}
            </Badge>
          ) : null}
          {task.estimatedMin ? (
            <Badge variant="outline" className="h-5 px-1.5 py-0 text-xs">
              <Clock className="mr-1 h-2.5 w-2.5" />
              {task.estimatedMin}min
            </Badge>
          ) : null}
          {task.dueDate ? (
            <Badge variant="outline" className={cn('h-5 px-1.5 py-0 text-xs', new Date(task.dueDate) < new Date() && !done && 'border-red-500/50 text-red-400')}>
              {new Date(task.dueDate).toLocaleDateString('pt-BR')}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {task.bucket === 'INBOX' ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onProcess(task)} title="Processar">
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(task.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
