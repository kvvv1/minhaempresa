'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, BookOpen, ClipboardList, Timer, Trash2, CheckCircle2, Circle, AlertCircle, ChevronDown, ChevronUp, Play, Square, GraduationCap, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ChatButton } from '@/components/ai/ChatButton'

type SubjectStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
type AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'OVERDUE'
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

interface SubjectGrade { id: string; name: string; grade: number; weight: number; date?: string }
interface Assignment { id: string; title: string; description?: string; dueDate?: string; status: AssignmentStatus; priority: TaskPriority; grade?: number; subject?: { id: string; name: string; color?: string } }
interface Subject { id: string; name: string; professor?: string; credits?: number; semester?: string; targetGrade?: number; currentGrade?: number; status: SubjectStatus; color?: string; grades: SubjectGrade[]; assignments: Assignment[] }
interface StudySession { id: string; startAt: string; endAt?: string; durationMin?: number; notes?: string; technique?: string; subject?: { id: string; name: string; color?: string } }

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; color: string }> = {
  PENDING:     { label: 'Pendente',   color: 'text-slate-400' },
  IN_PROGRESS: { label: 'Fazendo',    color: 'text-yellow-400' },
  SUBMITTED:   { label: 'Entregue',   color: 'text-blue-400' },
  GRADED:      { label: 'Corrigido',  color: 'text-emerald-400' },
  OVERDUE:     { label: 'Atrasado',   color: 'text-red-400' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  LOW:    { label: 'Baixa',   color: 'text-slate-400' },
  MEDIUM: { label: 'Média',   color: 'text-blue-400' },
  HIGH:   { label: 'Alta',    color: 'text-orange-400' },
  URGENT: { label: 'Urgente', color: 'text-red-400' },
}

const SUBJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#f97316']
const TECHNIQUES = ['Pomodoro', 'Active Recall', 'Mind Map', 'Resumo', 'Exercícios', 'Leitura']

function getGradeColor(grade: number) {
  if (grade >= 7) return 'text-emerald-400'
  if (grade >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

export default function FaculdadePage() {
  const [mentor, setMentor] = useState<{ name: string } | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [studySessions, setStudySessions] = useState<StudySession[]>([])
  const [activeSession, setActiveSession] = useState<StudySession | null>(null)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [summary, setSummary] = useState({ activeSubjects: 0, pendingAssignments: 0, avgGrade: null as number | null, weekStudyMin: 0 })
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)

  const [subjectOpen, setSubjectOpen] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [gradeOpen, setGradeOpen] = useState<string | null>(null)

  const [subjectForm, setSubjectForm] = useState({ name: '', professor: '', credits: '', semester: '', targetGrade: '', color: SUBJECT_COLORS[0] })
  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', subjectId: '', dueDate: '', priority: 'MEDIUM' as TaskPriority })
  const [gradeForm, setGradeForm] = useState({ name: '', grade: '', weight: '1', date: '' })
  const [sessionSubjectId, setSessionSubjectId] = useState('')
  const [sessionTechnique, setSessionTechnique] = useState('')

  const fetchAll = useCallback(async () => {
    const [subRes, aRes, ssRes, sumRes] = await Promise.all([
      fetch('/api/faculdade/subjects'),
      fetch('/api/faculdade/assignments'),
      fetch('/api/faculdade/study-sessions'),
      fetch('/api/faculdade'),
    ])
    if (subRes.ok) setSubjects(await subRes.json())
    if (aRes.ok) setAssignments(await aRes.json())
    if (ssRes.ok) {
      const sessions: StudySession[] = await ssRes.json()
      setStudySessions(sessions)
      const running = sessions.find((s) => !s.endAt)
      setActiveSession(running ?? null)
      if (running) setSessionSeconds(Math.floor((Date.now() - new Date(running.startAt).getTime()) / 1000))
    }
    if (sumRes.ok) setSummary(await sumRes.json())
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    fetch('/api/employees?role=MENTOR_ACADEMICO').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.[0]) setMentor(d[0]) })
  }, [])

  useEffect(() => {
    if (activeSession) {
      timerRef.current = setInterval(() => setSessionSeconds((s) => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setSessionSeconds(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activeSession])

  function formatTimer(s: number) {
    const h = Math.floor(s / 3600).toString().padStart(2, '0')
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${h}:${m}:${sec}`
  }

  async function startSession() {
    try {
      const res = await fetch('/api/faculdade/study-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: sessionSubjectId || null, technique: sessionTechnique || null, startAt: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error()
      const session = await res.json()
      setActiveSession(session)
      setSessionSeconds(0)
      toast.success('Sessão iniciada!')
    } catch { toast.error('Erro ao iniciar sessão') }
  }

  async function stopSession() {
    if (!activeSession) return
    try {
      await fetch(`/api/faculdade/study-sessions/${activeSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endAt: new Date().toISOString() }),
      })
      setActiveSession(null)
      fetchAll()
      toast.success('Sessão finalizada!')
    } catch { toast.error('Erro ao parar sessão') }
  }

  async function createSubject() {
    try {
      const res = await fetch('/api/faculdade/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...subjectForm, credits: subjectForm.credits ? Number(subjectForm.credits) : undefined, targetGrade: subjectForm.targetGrade ? Number(subjectForm.targetGrade) : undefined }),
      })
      if (!res.ok) throw new Error()
      toast.success('Disciplina adicionada!')
      setSubjectOpen(false)
      setSubjectForm({ name: '', professor: '', credits: '', semester: '', targetGrade: '', color: SUBJECT_COLORS[0] })
      fetchAll()
    } catch { toast.error('Erro ao criar disciplina') }
  }

  async function createAssignment() {
    try {
      const res = await fetch('/api/faculdade/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...assignmentForm, subjectId: assignmentForm.subjectId || null, dueDate: assignmentForm.dueDate || undefined }),
      })
      if (!res.ok) throw new Error()
      toast.success('Trabalho criado!')
      setAssignmentOpen(false)
      setAssignmentForm({ title: '', description: '', subjectId: '', dueDate: '', priority: 'MEDIUM' })
      fetchAll()
    } catch { toast.error('Erro ao criar trabalho') }
  }

  async function addGrade(subjectId: string) {
    try {
      const res = await fetch(`/api/faculdade/subjects/${subjectId}/grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...gradeForm, grade: Number(gradeForm.grade), weight: Number(gradeForm.weight) }),
      })
      if (!res.ok) throw new Error()
      toast.success('Nota registrada!')
      setGradeOpen(null)
      setGradeForm({ name: '', grade: '', weight: '1', date: '' })
      fetchAll()
    } catch { toast.error('Erro ao registrar nota') }
  }

  async function updateAssignmentStatus(id: string, status: AssignmentStatus) {
    try {
      await fetch(`/api/faculdade/assignments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status } : a))
    } catch { toast.error('Erro ao atualizar') }
  }

  async function deleteSubject(id: string) {
    try {
      await fetch(`/api/faculdade/subjects/${id}`, { method: 'DELETE' })
      setSubjects((prev) => prev.filter((s) => s.id !== id))
      toast.success('Disciplina removida')
    } catch { toast.error('Erro ao deletar') }
  }

  async function deleteAssignment(id: string) {
    try {
      await fetch(`/api/faculdade/assignments/${id}`, { method: 'DELETE' })
      setAssignments((prev) => prev.filter((a) => a.id !== id))
    } catch { toast.error('Erro ao deletar') }
  }

  const pendingAssignments = assignments.filter((a) => ['PENDING', 'IN_PROGRESS', 'OVERDUE'].includes(a.status))
  const weekStudyHours = Math.round(summary.weekStudyMin / 60 * 10) / 10

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Faculdade</h1>
          <p className="text-muted-foreground text-sm">Disciplinas, notas, trabalhos e estudo</p>
        </div>
        <div className="flex gap-2">
          {mentor && <ChatButton employeeRole="MENTOR_ACADEMICO" employeeName={mentor.name} moduleData={{ summary, subjects, assignments, studySessions }} />}
          <Button variant="outline" size="sm" onClick={() => setAssignmentOpen(true)}><Plus className="w-4 h-4 mr-2" />Trabalho</Button>
          <Button size="sm" onClick={() => setSubjectOpen(true)}><Plus className="w-4 h-4 mr-2" />Disciplina</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{summary.activeSubjects}</p><p className="text-xs text-muted-foreground">Disciplinas ativas</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className={cn('text-2xl font-bold', summary.avgGrade !== null && getGradeColor(summary.avgGrade))}>{summary.avgGrade !== null ? summary.avgGrade.toFixed(1) : '—'}</p><p className="text-xs text-muted-foreground">Média geral</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className={cn('text-2xl font-bold', summary.pendingAssignments > 0 && 'text-orange-400')}>{summary.pendingAssignments}</p><p className="text-xs text-muted-foreground">Trabalhos pendentes</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{weekStudyHours}h</p><p className="text-xs text-muted-foreground">Estudo esta semana</p></CardContent></Card>
      </div>

      {/* Risco de reprovação */}
      {subjects.filter((s) => s.currentGrade !== null && s.currentGrade !== undefined && s.currentGrade < 5).length > 0 && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-red-400">Risco de reprovação</AlertTitle>
          <AlertDescription className="text-red-300/80">
            {subjects
              .filter((s) => s.currentGrade !== null && s.currentGrade !== undefined && s.currentGrade < 5)
              .map((s) => `${s.name} (${s.currentGrade!.toFixed(1)})`)
              .join(' • ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Próximos trabalhos urgentes */}
      {assignments.filter((a) => ['PENDING', 'IN_PROGRESS'].includes(a.status) && a.dueDate && new Date(a.dueDate) <= new Date(Date.now() + 3 * 86400000)).length > 0 && (
        <Alert className="border-orange-500/50 bg-orange-500/10">
          <AlertCircle className="h-4 w-4 text-orange-400" />
          <AlertTitle className="text-orange-400">Entrega nos próximos 3 dias</AlertTitle>
          <AlertDescription className="text-orange-300/80">
            {assignments
              .filter((a) => ['PENDING', 'IN_PROGRESS'].includes(a.status) && a.dueDate && new Date(a.dueDate) <= new Date(Date.now() + 3 * 86400000))
              .map((a) => `${a.title} — ${new Date(a.dueDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`)
              .join(' • ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Timer ativo */}
      {activeSession && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium">Estudando agora</p>
              {activeSession.subject && <p className="text-xs text-muted-foreground">{activeSession.subject.name}</p>}
              {activeSession.technique && <p className="text-xs text-muted-foreground">{activeSession.technique}</p>}
            </div>
            <span className="text-xl font-mono font-bold text-violet-400">{formatTimer(sessionSeconds)}</span>
            <Button variant="outline" size="sm" onClick={stopSession}><Square className="w-4 h-4 mr-2" />Parar</Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="disciplinas">
        <TabsList>
          <TabsTrigger value="disciplinas"><BookOpen className="w-4 h-4 mr-2" />Disciplinas</TabsTrigger>
          <TabsTrigger value="trabalhos">
            <ClipboardList className="w-4 h-4 mr-2" />Trabalhos
            {pendingAssignments.length > 0 && <span className="ml-1.5 text-xs bg-orange-500/20 text-orange-400 rounded-full px-1.5">{pendingAssignments.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="estudo"><Timer className="w-4 h-4 mr-2" />Sessões de Estudo</TabsTrigger>
        </TabsList>

        {/* Disciplinas */}
        <TabsContent value="disciplinas" className="mt-6 space-y-3">
          {subjects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhuma disciplina cadastrada</p></div>
          ) : subjects.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: s.color ?? '#6366f1' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        {s.professor && <p className="text-xs text-muted-foreground">{s.professor}</p>}
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {s.semester && <Badge variant="outline" className="text-xs">{s.semester}</Badge>}
                          {s.credits && <Badge variant="outline" className="text-xs">{s.credits} créditos</Badge>}
                          {s.currentGrade !== null && s.currentGrade !== undefined && (
                            <Badge variant="outline" className={cn('text-xs', getGradeColor(s.currentGrade))}>Média: {s.currentGrade.toFixed(1)}</Badge>
                          )}
                          {s.targetGrade && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Meta: {s.targetGrade}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setGradeOpen(s.id)}>+ Nota</Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setExpandedSubject(expandedSubject === s.id ? null : s.id)}>
                          {expandedSubject === s.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => deleteSubject(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>

                    {expandedSubject === s.id && (
                      <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
                        {s.grades.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Notas</p>
                            <div className="space-y-1">
                              {s.grades.map((g) => (
                                <div key={g.id} className="flex items-center justify-between text-xs">
                                  <span>{g.name}</span>
                                  <div className="flex items-center gap-2">
                                    {g.weight !== 1 && <span className="text-muted-foreground">peso {g.weight}</span>}
                                    <span className={cn('font-bold', getGradeColor(g.grade))}>{g.grade.toFixed(1)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {s.assignments.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Trabalhos pendentes</p>
                            {s.assignments.map((a) => (
                              <div key={a.id} className="flex items-center justify-between text-xs py-0.5">
                                <span>{a.title}</span>
                                {a.dueDate && <span className="text-muted-foreground">{new Date(a.dueDate).toLocaleDateString('pt-BR')}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Trabalhos */}
        <TabsContent value="trabalhos" className="mt-6 space-y-3">
          {assignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum trabalho cadastrado</p></div>
          ) : assignments.map((a) => {
            const isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && !['SUBMITTED', 'GRADED'].includes(a.status)
            return (
              <Card key={a.id} className={cn(isOverdue && 'border-red-500/30')}>
                <CardContent className="p-3 flex items-start gap-3">
                  <button onClick={() => updateAssignmentStatus(a.id, a.status === 'SUBMITTED' ? 'PENDING' : 'SUBMITTED')} className="mt-0.5 flex-shrink-0">
                    {['SUBMITTED', 'GRADED'].includes(a.status)
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      : isOverdue
                        ? <AlertCircle className="w-5 h-5 text-red-400" />
                        : <Circle className="w-5 h-5 text-muted-foreground hover:text-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', ['SUBMITTED', 'GRADED'].includes(a.status) && 'line-through text-muted-foreground')}>{a.title}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {a.subject && (
                        <Badge variant="outline" className="text-xs" style={{ borderColor: a.subject.color ?? undefined }}>{a.subject.name}</Badge>
                      )}
                      <span className={cn('text-xs', STATUS_CONFIG[a.status].color)}>{STATUS_CONFIG[a.status].label}</span>
                      <span className={cn('text-xs', PRIORITY_CONFIG[a.priority].color)}>{PRIORITY_CONFIG[a.priority].label}</span>
                      {a.dueDate && (
                        <span className={cn('text-xs', isOverdue ? 'text-red-400 font-medium' : 'text-muted-foreground')}>
                          {new Date(a.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Select value={a.status} onValueChange={(v) => updateAssignmentStatus(a.id, (v ?? a.status) as AssignmentStatus)}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => deleteAssignment(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* Sessões de Estudo */}
        <TabsContent value="estudo" className="mt-6 space-y-4">
          {!activeSession && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium">Iniciar Sessão de Estudo</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Disciplina</Label>
                    <Select value={sessionSubjectId} onValueChange={(v) => setSessionSubjectId(v ?? '')}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sem disciplina</SelectItem>
                        {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Técnica</Label>
                    <Select value={sessionTechnique} onValueChange={(v) => setSessionTechnique(v ?? '')}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sem técnica</SelectItem>
                        {TECHNIQUES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" size="sm" onClick={startSession}><Play className="w-4 h-4 mr-2" />Iniciar Sessão</Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Últimas sessões</p>
            {studySessions.filter((s) => s.endAt).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sessão registrada ainda</p>
            ) : (
              studySessions.filter((s) => s.endAt).map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card text-sm">
                  <Timer className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{s.subject?.name ?? 'Estudo geral'}</p>
                    {s.technique && <p className="text-xs text-muted-foreground">{s.technique}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {s.durationMin && <p className="text-xs font-mono font-medium">{Math.floor(s.durationMin / 60)}h{s.durationMin % 60}m</p>}
                    <p className="text-xs text-muted-foreground">{new Date(s.startAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Disciplina */}
      <Dialog open={subjectOpen} onOpenChange={setSubjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Disciplina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Nome</Label><Input placeholder="Ex: Cálculo I" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Professor</Label><Input placeholder="Opcional" value={subjectForm.professor} onChange={(e) => setSubjectForm({ ...subjectForm, professor: e.target.value })} /></div>
              <div className="space-y-1"><Label>Semestre</Label><Input placeholder="2025.1" value={subjectForm.semester} onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })} /></div>
              <div className="space-y-1"><Label>Créditos</Label><Input type="number" placeholder="4" value={subjectForm.credits} onChange={(e) => setSubjectForm({ ...subjectForm, credits: e.target.value })} /></div>
              <div className="space-y-1"><Label>Média mínima</Label><Input type="number" step="0.1" placeholder="6.0" value={subjectForm.targetGrade} onChange={(e) => setSubjectForm({ ...subjectForm, targetGrade: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <button key={c} className={cn('w-6 h-6 rounded-full border-2 transition-transform', subjectForm.color === c ? 'border-white scale-110' : 'border-transparent')} style={{ background: c }} onClick={() => setSubjectForm({ ...subjectForm, color: c })} />
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={createSubject} disabled={!subjectForm.name.trim()}>Adicionar Disciplina</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Trabalho */}
      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Trabalho/Prova</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Título</Label><Input placeholder="Ex: Prova 1, Trabalho Final..." value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Disciplina</Label>
              <Select value={assignmentForm.subjectId} onValueChange={(v) => setAssignmentForm({ ...assignmentForm, subjectId: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Selecionar disciplina" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem disciplina</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select value={assignmentForm.priority} onValueChange={(v) => setAssignmentForm({ ...assignmentForm, priority: (v ?? 'MEDIUM') as TaskPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Prazo</Label><Input type="date" value={assignmentForm.dueDate} onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Descrição</Label><Textarea rows={2} placeholder="Detalhes opcionais..." value={assignmentForm.description} onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })} /></div>
            <Button className="w-full" onClick={createAssignment} disabled={!assignmentForm.title.trim()}>Criar Trabalho</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Nota */}
      <Dialog open={!!gradeOpen} onOpenChange={(o) => !o && setGradeOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Nota</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Avaliação</Label><Input placeholder="Ex: Prova 1, Trabalho..." value={gradeForm.name} onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Nota (0–10)</Label><Input type="number" step="0.1" min="0" max="10" placeholder="7.5" value={gradeForm.grade} onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })} /></div>
              <div className="space-y-1"><Label>Peso</Label><Input type="number" step="0.5" min="0.5" placeholder="1" value={gradeForm.weight} onChange={(e) => setGradeForm({ ...gradeForm, weight: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={gradeForm.date} onChange={(e) => setGradeForm({ ...gradeForm, date: e.target.value })} /></div>
            <Button className="w-full" onClick={() => gradeOpen && addGrade(gradeOpen)} disabled={!gradeForm.name.trim() || !gradeForm.grade}>Salvar Nota</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
