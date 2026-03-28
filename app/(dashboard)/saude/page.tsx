'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Dumbbell, Scale, Moon, Droplets, Trash2, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ChatButton } from '@/components/ai/ChatButton'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface WorkoutSet { reps?: number; loadKg?: number; note?: string }
interface WorkoutExercise { id?: string; name: string; sets: WorkoutSet[]; order: number }
interface Workout { id: string; name: string; date: string; durationMin?: number; notes?: string; exercises: WorkoutExercise[] }
interface BodyMetric { id: string; date: string; weightKg?: number; bodyFatPct?: number; muscleKg?: number; waistCm?: number; hipCm?: number; armCm?: number; notes?: string }
interface SleepLog { id: string; date: string; bedtimeAt: string; wakeAt: string; durationMin: number; quality?: number }
interface HydrationLog { id: string; date: string; mlTotal: number; goalMl: number }

const QUALITY_STARS = [1, 2, 3, 4, 5]

export default function SaudePage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([])
  const [hydration, setHydration] = useState<HydrationLog | null>(null)
  const [summary, setSummary] = useState<{ lastWorkoutDaysAgo: number | null; avgSleepMin: number | null; todayHydrationPct: number }>({ lastWorkoutDaysAgo: null, avgSleepMin: null, todayHydrationPct: 0 })

  const [prs, setPrs] = useState<{name: string; maxLoadKg: number; maxReps: number; date: string}[]>([])
  const [trainer, setTrainer] = useState<{ name: string } | null>(null)
  const [workoutOpen, setWorkoutOpen] = useState(false)
  const [metricOpen, setMetricOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null)

  const [workoutForm, setWorkoutForm] = useState({ name: '', date: new Date().toISOString().split('T')[0], durationMin: '', notes: '', exercises: [{ name: '', sets: [{ reps: '', loadKg: '' }] }] as any[] })
  const [metricForm, setMetricForm] = useState({ date: new Date().toISOString().split('T')[0], weightKg: '', bodyFatPct: '', muscleKg: '', waistCm: '', hipCm: '', armCm: '', notes: '' })
  const [sleepForm, setSleepForm] = useState({ bedtimeAt: '', wakeAt: '', quality: 0, notes: '' })

  const fetchAll = useCallback(async () => {
    const [wRes, mRes, sRes, hRes, sumRes] = await Promise.all([
      fetch('/api/saude/workouts?period=month'),
      fetch('/api/saude/body-metrics'),
      fetch('/api/saude/sleep?days=14'),
      fetch('/api/saude/hydration'),
      fetch('/api/saude'),
    ])
    if (wRes.ok) setWorkouts(await wRes.json())
    if (mRes.ok) setMetrics(await mRes.json())
    if (sRes.ok) setSleepLogs(await sRes.json())
    if (hRes.ok) setHydration(await hRes.json())
    if (sumRes.ok) setSummary(await sumRes.json())
    fetch('/api/saude/prs').then(r => r.ok ? r.json() : []).then(setPrs)
  }, [])

  useEffect(() => {
    fetchAll()
    fetch('/api/employees?role=PERSONAL_TRAINER').then(r => r.ok ? r.json() : null).then(d => { if (d?.[0]) setTrainer(d[0]) })
  }, [fetchAll])

  async function addHydration(ml: number) {
    try {
      const res = await fetch('/api/saude/hydration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addMl: ml }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setHydration(updated)
      setSummary((s) => ({ ...s, todayHydrationPct: Math.round((updated.mlTotal / updated.goalMl) * 100) }))
    } catch { toast.error('Erro ao registrar') }
  }

  function addExercise() {
    setWorkoutForm((f) => ({ ...f, exercises: [...f.exercises, { name: '', sets: [{ reps: '', loadKg: '' }] }] }))
  }

  function addSet(exIdx: number) {
    setWorkoutForm((f) => {
      const exs = [...f.exercises]
      exs[exIdx] = { ...exs[exIdx], sets: [...exs[exIdx].sets, { reps: '', loadKg: '' }] }
      return { ...f, exercises: exs }
    })
  }

  function updateExercise(exIdx: number, field: string, value: string) {
    setWorkoutForm((f) => {
      const exs = [...f.exercises]
      exs[exIdx] = { ...exs[exIdx], [field]: value }
      return { ...f, exercises: exs }
    })
  }

  function updateSet(exIdx: number, setIdx: number, field: string, value: string) {
    setWorkoutForm((f) => {
      const exs = [...f.exercises]
      const sets = [...exs[exIdx].sets]
      sets[setIdx] = { ...sets[setIdx], [field]: value }
      exs[exIdx] = { ...exs[exIdx], sets }
      return { ...f, exercises: exs }
    })
  }

  async function createWorkout() {
    try {
      const payload = {
        name: workoutForm.name,
        date: workoutForm.date,
        durationMin: workoutForm.durationMin ? Number(workoutForm.durationMin) : undefined,
        notes: workoutForm.notes,
        exercises: workoutForm.exercises
          .filter((e) => e.name.trim())
          .map((e, i) => ({
            name: e.name,
            order: i,
            sets: e.sets.filter((s: any) => s.reps || s.loadKg).map((s: any) => ({ reps: s.reps ? Number(s.reps) : undefined, loadKg: s.loadKg ? Number(s.loadKg) : undefined })),
          })),
      }
      const res = await fetch('/api/saude/workouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
      toast.success('Treino registrado!')
      setWorkoutOpen(false)
      setWorkoutForm({ name: '', date: new Date().toISOString().split('T')[0], durationMin: '', notes: '', exercises: [{ name: '', sets: [{ reps: '', loadKg: '' }] }] })
      fetchAll()
    } catch { toast.error('Erro ao salvar treino') }
  }

  async function createMetric() {
    try {
      const payload = Object.fromEntries(
        Object.entries(metricForm).map(([k, v]) => [k, v && k !== 'date' && k !== 'notes' ? Number(v) : v || undefined])
      )
      const res = await fetch('/api/saude/body-metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, date: metricForm.date }) })
      if (!res.ok) throw new Error()
      toast.success('Medidas registradas!')
      setMetricOpen(false)
      setMetricForm({ date: new Date().toISOString().split('T')[0], weightKg: '', bodyFatPct: '', muscleKg: '', waistCm: '', hipCm: '', armCm: '', notes: '' })
      fetchAll()
    } catch { toast.error('Erro ao salvar medidas') }
  }

  async function createSleep() {
    try {
      const res = await fetch('/api/saude/sleep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sleepForm) })
      if (!res.ok) throw new Error()
      toast.success('Sono registrado!')
      setSleepOpen(false)
      setSleepForm({ bedtimeAt: '', wakeAt: '', quality: 0, notes: '' })
      fetchAll()
    } catch { toast.error('Erro ao salvar sono') }
  }

  async function deleteWorkout(id: string) {
    try {
      await fetch(`/api/saude/workouts/${id}`, { method: 'DELETE' })
      setWorkouts((prev) => prev.filter((w) => w.id !== id))
    } catch { toast.error('Erro ao deletar') }
  }

  const weightData = [...metrics].reverse().filter((m) => m.weightKg).map((m) => ({ date: new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), peso: m.weightKg }))
  const sleepData = [...sleepLogs].reverse().map((s) => ({ date: new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), horas: Math.round(s.durationMin / 6) / 10 }))

  const workoutsThisWeek = workouts.filter((w) => new Date(w.date) >= new Date(Date.now() - 7 * 86400000)).length
  const workoutStreak = (() => {
    const uniqueDays = [...new Set(workouts.map((w) => new Date(w.date).toDateString()))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    if (!uniqueDays.length) return 0
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const mostRecent = new Date(uniqueDays[0]); mostRecent.setHours(0, 0, 0, 0)
    const gap = Math.floor((today.getTime() - mostRecent.getTime()) / 86400000)
    if (gap > 1) return 0
    let streak = 1
    for (let i = 1; i < uniqueDays.length; i++) {
      const prev = new Date(uniqueDays[i - 1]); prev.setHours(0, 0, 0, 0)
      const curr = new Date(uniqueDays[i]); curr.setHours(0, 0, 0, 0)
      if (Math.floor((prev.getTime() - curr.getTime()) / 86400000) === 1) streak++
      else break
    }
    return streak
  })()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Saúde & Fitness</h1>
          <p className="text-muted-foreground text-sm">Treinos, métricas, sono e hidratação</p>
        </div>
        <div className="flex items-center gap-2">
          {trainer && (
            <ChatButton
              employeeRole="PERSONAL_TRAINER"
              employeeName={trainer.name}
              moduleData={{ summary, workouts: workouts.slice(0, 5), metrics: metrics.slice(0, 3), sleepLogs: sleepLogs.slice(0, 7), hydration }}
            />
          )}
          <Button size="sm" onClick={() => setWorkoutOpen(true)}><Plus className="w-4 h-4 mr-2" />Novo Treino</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <p className={cn('text-2xl font-bold', summary.lastWorkoutDaysAgo !== null && summary.lastWorkoutDaysAgo > 3 && 'text-orange-400')}>
            {summary.lastWorkoutDaysAgo !== null ? `${summary.lastWorkoutDaysAgo}d` : '—'}
          </p>
          <p className="text-xs text-muted-foreground">Último treino</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className={cn('text-2xl font-bold', workoutsThisWeek >= 3 ? 'text-emerald-400' : workoutsThisWeek >= 1 ? 'text-yellow-400' : 'text-red-400')}>
            {workoutsThisWeek}
          </p>
          <p className="text-xs text-muted-foreground">Treinos esta semana</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className={cn('text-2xl font-bold', workoutStreak >= 7 ? 'text-emerald-400' : workoutStreak >= 3 ? 'text-yellow-400' : 'text-muted-foreground')}>
            {workoutStreak > 0 ? `🔥${workoutStreak}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground">Streak (dias)</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold">{summary.avgSleepMin ? `${Math.floor(summary.avgSleepMin / 60)}h${summary.avgSleepMin % 60}m` : '—'}</p>
          <p className="text-xs text-muted-foreground">Média de sono (7d)</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold">{summary.todayHydrationPct}%</p>
          <p className="text-xs text-muted-foreground">Hidratação hoje</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="treinos">
        <TabsList>
          <TabsTrigger value="treinos"><Dumbbell className="w-4 h-4 mr-2" />Treinos</TabsTrigger>
          <TabsTrigger value="metricas"><Scale className="w-4 h-4 mr-2" />Métricas</TabsTrigger>
          <TabsTrigger value="sono"><Moon className="w-4 h-4 mr-2" />Sono</TabsTrigger>
          <TabsTrigger value="hidratacao"><Droplets className="w-4 h-4 mr-2" />Hidratação</TabsTrigger>
        </TabsList>

        {/* Treinos */}
        <TabsContent value="treinos" className="mt-6 space-y-3">
          {prs.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                  🏆 Recordes Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {prs.slice(0, 6).map(pr => (
                    <div key={pr.name} className="p-2 rounded-lg bg-muted/30 border border-border/40">
                      <p className="text-xs font-medium truncate">{pr.name}</p>
                      <p className="text-sm font-bold text-amber-400">
                        {pr.maxLoadKg > 0 ? `${pr.maxLoadKg}kg` : ''}{pr.maxLoadKg > 0 && pr.maxReps > 0 ? ' × ' : ''}{pr.maxReps > 0 ? `${pr.maxReps} reps` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(pr.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {workouts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum treino este mês</p></div>
          ) : workouts.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{w.name}</p>
                      {w.durationMin && <Badge variant="outline" className="text-xs">{w.durationMin}min</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(w.date).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{w.exercises.length} exercício{w.exercises.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setExpandedWorkout(expandedWorkout === w.id ? null : w.id)}>
                      {expandedWorkout === w.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => deleteWorkout(w.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                {expandedWorkout === w.id && w.exercises.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                    {w.exercises.map((ex, i) => (
                      <div key={i}>
                        <p className="text-xs font-medium">{ex.name}</p>
                        {ex.sets.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {ex.sets.map((s, j) => (
                              <span key={j} className="text-xs bg-muted/40 rounded px-2 py-0.5">
                                {s.reps ? `${s.reps}x` : ''}{s.loadKg ? `${s.loadKg}kg` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Métricas */}
        <TabsContent value="metricas" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setMetricOpen(true)}><Plus className="w-4 h-4 mr-2" />Registrar Medidas</Button>
          </div>
          {weightData.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Evolução do Peso</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', fontSize: 12 }} />
                    <Line type="monotone" dataKey="peso" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {metrics.slice(0, 10).map((m) => (
              <Card key={m.id}>
                <CardContent className="p-3 flex flex-wrap gap-3 items-center">
                  <p className="text-xs text-muted-foreground w-20">{new Date(m.date).toLocaleDateString('pt-BR')}</p>
                  {m.weightKg && <Badge variant="outline" className="text-xs">⚖️ {m.weightKg}kg</Badge>}
                  {m.bodyFatPct && <Badge variant="outline" className="text-xs">🔥 {m.bodyFatPct}% BF</Badge>}
                  {m.muscleKg && <Badge variant="outline" className="text-xs">💪 {m.muscleKg}kg músculo</Badge>}
                  {m.waistCm && <Badge variant="outline" className="text-xs">📏 cintura {m.waistCm}cm</Badge>}
                  {m.armCm && <Badge variant="outline" className="text-xs">💪 braço {m.armCm}cm</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Sono */}
        <TabsContent value="sono" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setSleepOpen(true)}><Plus className="w-4 h-4 mr-2" />Registrar Sono</Button>
          </div>
          {sleepData.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Horas de Sono (14 dias)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={sleepData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 12]} />
                    <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', fontSize: 12 }} />
                    <Bar dataKey="horas" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Horas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {sleepLogs.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-3 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{Math.floor(s.durationMin / 60)}h{s.durationMin % 60}m</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  </div>
                  {s.quality && (
                    <div className="flex gap-0.5">
                      {QUALITY_STARS.map((star) => (
                        <Star key={star} className={cn('w-3.5 h-3.5', star <= s.quality! ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground')} />
                      ))}
                    </div>
                  )}
                  <Badge variant="outline" className={cn('text-xs', s.durationMin >= 420 ? 'border-emerald-500/50 text-emerald-400' : s.durationMin >= 360 ? 'border-yellow-500/50 text-yellow-400' : 'border-red-500/50 text-red-400')}>
                    {s.durationMin >= 420 ? 'Ótimo' : s.durationMin >= 360 ? 'Ok' : 'Curto'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Hidratação */}
        <TabsContent value="hidratacao" className="mt-6">
          <div className="max-w-sm mx-auto space-y-6">
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <Droplets className="w-10 h-10 mx-auto text-blue-400" />
                <div>
                  <p className="text-4xl font-bold">{hydration?.mlTotal ?? 0}<span className="text-lg text-muted-foreground">ml</span></p>
                  <p className="text-sm text-muted-foreground">de {hydration?.goalMl ?? 2000}ml</p>
                </div>
                <Progress value={summary.todayHydrationPct} className="h-3" />
                <p className={cn('text-sm font-medium', summary.todayHydrationPct >= 100 ? 'text-emerald-400' : summary.todayHydrationPct >= 60 ? 'text-yellow-400' : 'text-red-400')}>
                  {summary.todayHydrationPct >= 100 ? '🎉 Meta atingida!' : `${summary.todayHydrationPct}% da meta`}
                </p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-3 gap-3">
              {[200, 300, 500].map((ml) => (
                <Button key={ml} variant="outline" className="h-12 text-blue-400 border-blue-500/30 hover:bg-blue-500/10" onClick={() => addHydration(ml)}>
                  +{ml}ml
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Treino */}
      <Dialog open={workoutOpen} onOpenChange={setWorkoutOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Treino</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Nome</Label><Input placeholder="Treino A, Peito..." value={workoutForm.name} onChange={(e) => setWorkoutForm({ ...workoutForm, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Data</Label><Input type="date" value={workoutForm.date} onChange={(e) => setWorkoutForm({ ...workoutForm, date: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Duração (min)</Label><Input type="number" placeholder="60" value={workoutForm.durationMin} onChange={(e) => setWorkoutForm({ ...workoutForm, durationMin: e.target.value })} /></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label>Exercícios</Label><Button type="button" size="sm" variant="outline" onClick={addExercise}><Plus className="w-3 h-3 mr-1" />Add</Button></div>
              {workoutForm.exercises.map((ex, ei) => (
                <div key={ei} className="border border-border/40 rounded-lg p-3 space-y-2">
                  <Input placeholder="Nome do exercício" value={ex.name} onChange={(e) => updateExercise(ei, 'name', e.target.value)} className="h-8 text-sm" />
                  <div className="space-y-1">
                    {ex.sets.map((s: any, si: number) => (
                      <div key={si} className="flex gap-2">
                        <Input placeholder="Reps" type="number" className="h-7 text-xs" value={s.reps} onChange={(e) => updateSet(ei, si, 'reps', e.target.value)} />
                        <Input placeholder="Kg" type="number" className="h-7 text-xs" value={s.loadKg} onChange={(e) => updateSet(ei, si, 'loadKg', e.target.value)} />
                      </div>
                    ))}
                    <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={() => addSet(ei)}>+ Série</Button>
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={createWorkout} disabled={!workoutForm.name.trim()}>Salvar Treino</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Métricas */}
      <Dialog open={metricOpen} onOpenChange={setMetricOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Medidas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={metricForm.date} onChange={(e) => setMetricForm({ ...metricForm, date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              {[['weightKg', 'Peso (kg)'], ['bodyFatPct', 'BF (%)'], ['muscleKg', 'Músculo (kg)'], ['waistCm', 'Cintura (cm)'], ['hipCm', 'Quadril (cm)'], ['armCm', 'Braço (cm)']].map(([field, label]) => (
                <div key={field} className="space-y-1"><Label>{label}</Label><Input type="number" step="0.1" value={(metricForm as any)[field]} onChange={(e) => setMetricForm({ ...metricForm, [field]: e.target.value })} /></div>
              ))}
            </div>
            <div className="space-y-1"><Label>Notas</Label><Textarea rows={2} value={metricForm.notes} onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={createMetric}>Salvar Medidas</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Sono */}
      <Dialog open={sleepOpen} onOpenChange={setSleepOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Sono</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Dormiu às</Label><Input type="datetime-local" value={sleepForm.bedtimeAt} onChange={(e) => setSleepForm({ ...sleepForm, bedtimeAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Acordou às</Label><Input type="datetime-local" value={sleepForm.wakeAt} onChange={(e) => setSleepForm({ ...sleepForm, wakeAt: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>Qualidade</Label>
              <div className="flex gap-2">
                {QUALITY_STARS.map((s) => (
                  <button key={s} onClick={() => setSleepForm({ ...sleepForm, quality: s })}>
                    <Star className={cn('w-6 h-6 transition-colors', s <= sleepForm.quality ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground')} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1"><Label>Notas</Label><Textarea rows={2} value={sleepForm.notes} onChange={(e) => setSleepForm({ ...sleepForm, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={createSleep} disabled={!sleepForm.bedtimeAt || !sleepForm.wakeAt}>Salvar Sono</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
