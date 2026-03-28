'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Inbox, Calendar, CalendarDays, Sunset, Clock, Archive, CheckCircle2, Circle, Trash2, ArrowRight, Zap, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ChatButton } from '@/components/ai/ChatButton'

type GtdBucket = 'INBOX' | 'TODAY' | 'THIS_WEEK' | 'SOMEDAY' | 'WAITING' | 'REFERENCE'
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
type GtdEnergy = 'LOW' | 'MEDIUM' | 'HIGH'

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
  INBOX:     { label: 'Inbox',      icon: Inbox,       color: 'text-slate-400' },
  TODAY:     { label: 'Hoje',       icon: Calendar,    color: 'text-red-400' },
  THIS_WEEK: { label: 'Esta Semana',icon: CalendarDays, color: 'text-orange-400' },
  SOMEDAY:   { label: 'Algum Dia',  icon: Sunset,      color: 'text-blue-400' },
  WAITING:   { label: 'Aguardando', icon: Clock,       color: 'text-yellow-400' },
  REFERENCE: { label: 'Referência', icon: Archive,     color: 'text-purple-400' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  LOW:    { label: 'Baixa',   color: 'text-slate-400' },
  MEDIUM: { label: 'Média',   color: 'text-blue-400' },
  HIGH:   { label: 'Alta',    color: 'text-orange-400' },
  URGENT: { label: 'Urgente', color: 'text-red-400' },
}

const ENERGY_CONFIG: Record<GtdEnergy, { label: string; icon: string }> = {
  LOW:    { label: 'Baixa',  icon: '🔋' },
  MEDIUM: { label: 'Média',  icon: '⚡' },
  HIGH:   { label: 'Alta',   icon: '🔥' },
}

export default function TarefasPage() {
  const [pm, setPm] = useState<{ name: string } | null>(null)
  const [tasks, setTasks] = useState<GtdTask[]>([])
  const [bucketCounts, setBucketCounts] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<GtdBucket | 'capturar'>('capturar')
  const [captureInput, setCaptureInput] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [processDialogTask, setProcessDialogTask] = useState<GtdTask | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', bucket: 'INBOX' as GtdBucket, priority: 'MEDIUM' as TaskPriority, dueDate: '', context: '', energy: '' as GtdEnergy | '', estimatedMin: '' })

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

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])
  useEffect(() => {
    fetch('/api/employees?role=PROJECT_MANAGER').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.[0]) setPm(d[0]) })
  }, [])

  useEffect(() => {
    if (activeTab !== 'capturar') {
      fetchTasks(activeTab as GtdBucket)
    }
  }, [activeTab, fetchTasks])

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
      toast.success('Capturado no Inbox!')
      fetchSummary()
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
      toast.success('Tarefa criada!')
      setCreateOpen(false)
      setForm({ title: '', description: '', bucket: 'INBOX', priority: 'MEDIUM', dueDate: '', context: '', energy: '', estimatedMin: '' })
      fetchSummary()
      if (activeTab === form.bucket) fetchTasks(form.bucket)
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
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)))
      fetchSummary()
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/tarefas/gtd/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setTasks((prev) => prev.filter((t) => t.id !== id))
      fetchSummary()
      toast.success('Tarefa removida')
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
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      setProcessDialogTask(null)
      fetchSummary()
      toast.success(`Movido para ${BUCKET_CONFIG[targetBucket].label}`)
    } catch {
      toast.error('Erro ao processar')
    }
  }

  const tabBuckets: (GtdBucket | 'capturar')[] = ['capturar', 'INBOX', 'TODAY', 'THIS_WEEK', 'SOMEDAY', 'WAITING']

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground text-sm">Sistema GTD — capture tudo, processe depois</p>
        </div>
        <div className="flex items-center gap-2">
          {pm && <ChatButton employeeRole="PROJECT_MANAGER" employeeName={pm.name} moduleData={{ tasks, bucketCounts }} />}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm"><Plus className="w-4 h-4 mr-2" />Nova Tarefa</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Título</Label>
                <Input placeholder="O que precisa ser feito?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea placeholder="Detalhes opcionais..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Bucket</Label>
                  <Select value={form.bucket} onValueChange={(v) => setForm({ ...form, bucket: v as GtdBucket })}>
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
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
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
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Energia</Label>
                  <Select value={form.energy} onValueChange={(v) => setForm({ ...form, energy: v as GtdEnergy })}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ENERGY_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Contexto</Label>
                  <Input placeholder="@trabalho, @casa..." value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Estimativa (min)</Label>
                  <Input type="number" placeholder="30" value={form.estimatedMin} onChange={(e) => setForm({ ...form, estimatedMin: e.target.value })} />
                </div>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={!form.title.trim()}>Criar Tarefa</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Bucket summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {(Object.keys(BUCKET_CONFIG) as GtdBucket[]).map((bucket) => {
          const config = BUCKET_CONFIG[bucket]
          const count = bucketCounts[bucket] ?? 0
          return (
            <Card key={bucket} className={cn('cursor-pointer transition-colors hover:border-border', activeTab === bucket && 'border-primary/40 bg-primary/5')} onClick={() => setActiveTab(bucket)}>
              <CardContent className="p-3 text-center">
                <config.icon className={cn('w-4 h-4 mx-auto mb-1', config.color)} />
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="capturar">⚡ Capturar</TabsTrigger>
          {(Object.keys(BUCKET_CONFIG) as GtdBucket[]).map((b) => (
            <TabsTrigger key={b} value={b}>
              {BUCKET_CONFIG[b].label}
              {(bucketCounts[b] ?? 0) > 0 && (
                <span className="ml-1.5 text-xs bg-primary/20 text-primary rounded-full px-1.5">{bucketCounts[b]}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Capturar */}
        <TabsContent value="capturar" className="mt-6">
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle className="text-base">Captura Rápida</CardTitle>
              <p className="text-sm text-muted-foreground">Jogue tudo na sua cabeça aqui. Processe depois.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCapture} className="flex gap-2">
                <Input
                  placeholder="O que está na sua cabeça?"
                  value={captureInput}
                  onChange={(e) => setCaptureInput(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={capturing || !captureInput.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-3">Dica: use o botão "Nova Tarefa" para adicionar contexto, prazo e energia.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Task lists por bucket */}
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

      {/* Process dialog */}
      <Dialog open={!!processDialogTask} onOpenChange={(o) => !o && setProcessDialogTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Processar tarefa</DialogTitle></DialogHeader>
          {processDialogTask && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{processDialogTask.title}</p>
              <p className="text-xs text-muted-foreground">Mover para:</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(BUCKET_CONFIG) as GtdBucket[]).filter((b) => b !== processDialogTask.bucket).map((b) => {
                  const config = BUCKET_CONFIG[b]
                  return (
                    <Button key={b} variant="outline" className="justify-start gap-2" onClick={() => handleProcess(processDialogTask, b)}>
                      <config.icon className={cn('w-4 h-4', config.color)} />
                      {config.label}
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

function TaskList({ tasks, bucket, onToggle, onDelete, onProcess }: {
  tasks: GtdTask[]
  bucket: GtdBucket
  onToggle: (t: GtdTask) => void
  onDelete: (id: string) => void
  onProcess: (t: GtdTask) => void
}) {
  const filtered = tasks.filter((t) => t.bucket === bucket)

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
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

function TaskRow({ task, onToggle, onDelete, onProcess }: {
  task: GtdTask
  onToggle: (t: GtdTask) => void
  onDelete: (id: string) => void
  onProcess: (t: GtdTask) => void
}) {
  const done = task.status === 'COMPLETED'
  const priority = PRIORITY_CONFIG[task.priority]

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg border bg-card hover:border-border/60 transition-colors', done && 'opacity-50')}>
      <button onClick={() => onToggle(task)} className="mt-0.5 flex-shrink-0">
        {done
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          : <Circle className="w-5 h-5 text-muted-foreground hover:text-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', done && 'line-through')}>{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className={cn('text-xs font-medium', priority.color)}>{priority.label}</span>
          {task.context && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-1">
              <Tag className="w-2.5 h-2.5" />{task.context}
            </Badge>
          )}
          {task.energy && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
              {ENERGY_CONFIG[task.energy].icon} {ENERGY_CONFIG[task.energy].label}
            </Badge>
          )}
          {task.estimatedMin && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
              <Clock className="w-2.5 h-2.5 mr-1" />{task.estimatedMin}min
            </Badge>
          )}
          {task.dueDate && (
            <Badge variant="outline" className={cn('text-xs px-1.5 py-0 h-5', new Date(task.dueDate) < new Date() && !done && 'border-red-500/50 text-red-400')}>
              {new Date(task.dueDate).toLocaleDateString('pt-BR')}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {task.bucket === 'INBOX' && (
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => onProcess(task)} title="Processar">
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(task.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
