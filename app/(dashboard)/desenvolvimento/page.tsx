'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatRichText } from '@/components/ai/ChatRichText'
import {
  BookOpen, Plus, BookMarked, GraduationCap, Zap, Bot, Send, X,
  Star, Trash2, ChevronRight, TrendingUp, Award, Clock, CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOK_STATUS: Record<string, { label: string; color: string }> = {
  WANT_TO_READ: { label: 'Quero Ler', color: 'bg-zinc-500/20 text-zinc-300' },
  READING: { label: 'Lendo', color: 'bg-blue-500/20 text-blue-300' },
  COMPLETED: { label: 'Concluído', color: 'bg-emerald-500/20 text-emerald-300' },
  ABANDONED: { label: 'Abandonado', color: 'bg-red-500/20 text-red-300' },
}

const COURSE_STATUS: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: 'Não Iniciado', color: 'bg-zinc-500/20 text-zinc-300' },
  IN_PROGRESS: { label: 'Em Progresso', color: 'bg-blue-500/20 text-blue-300' },
  COMPLETED: { label: 'Concluído', color: 'bg-emerald-500/20 text-emerald-300' },
  PAUSED: { label: 'Pausado', color: 'bg-yellow-500/20 text-yellow-300' },
}

const SKILL_LEVELS: Record<string, { label: string; value: number; color: string }> = {
  BEGINNER: { label: 'Iniciante', value: 25, color: 'bg-red-500' },
  INTERMEDIATE: { label: 'Intermediário', value: 50, color: 'bg-yellow-500' },
  ADVANCED: { label: 'Avançado', value: 75, color: 'bg-blue-500' },
  EXPERT: { label: 'Expert', value: 100, color: 'bg-emerald-500' },
}

const SKILL_LEVEL_KEYS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']

// ─── Types ────────────────────────────────────────────────────────────────────

interface Book {
  id: string
  title: string
  author: string | null
  status: string
  rating: number | null
  notes: string | null
  startedAt: string | null
  finishedAt: string | null
}

interface Course {
  id: string
  title: string
  platform: string | null
  status: string
  progress: number
  notes: string | null
  startedAt: string | null
  completedAt: string | null
}

interface Skill {
  id: string
  name: string
  category: string
  level: string
  targetLevel: string
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readonly }: { value: number | null; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          className={cn('transition-colors', readonly ? 'cursor-default' : 'hover:text-amber-400')}
        >
          <Star
            className={cn('w-4 h-4', (value ?? 0) >= n ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground')}
          />
        </button>
      ))}
    </div>
  )
}

// ─── AI Chat Panel ─────────────────────────────────────────────────────────────

function AIChatPanel({
  books,
  courses,
  skills,
  onClose,
}: {
  books: Book[]
  courses: Course[]
  skills: Skill[]
  onClose: () => void
}) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const thisYear = new Date().getFullYear()
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeRole: 'RD',
          messages: newMessages,
          moduleData: {
            booksReading: books.filter(b => b.status === 'READING').length,
            booksReadThisYear: books.filter(b => b.status === 'COMPLETED' && b.finishedAt && new Date(b.finishedAt).getFullYear() === thisYear).length,
            totalBooks: books.length,
            coursesInProgress: courses.filter(c => c.status === 'IN_PROGRESS').length,
            coursesCompleted: courses.filter(c => c.status === 'COMPLETED').length,
            skillsInProgress: skills.filter(s => s.level !== s.targetLevel).length,
            currentBooks: books.filter(b => b.status === 'READING').map(b => b.title),
            currentCourses: courses.filter(c => c.status === 'IN_PROGRESS').map(c => ({ title: c.title, progress: c.progress })),
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(m => [...m, { role: 'assistant', content: data.response }])
      }
    } catch {
      toast.error('Erro no chat com P&D')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l border-border/50 flex flex-col z-40 shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">P&D</p>
            <p className="text-xs text-muted-foreground">Diretora de Pesquisa & Dev.</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Bot className="w-10 h-10 text-amber-500/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Olá! Sou a diretora de P&D.</p>
            <p className="text-xs text-muted-foreground mt-1">Posso ajudar com seu plano de leitura, cursos e desenvolvimento de habilidades.</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-amber-500/20 text-amber-100'
                    : 'bg-muted text-foreground'
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
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground">
                Digitando...
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="p-3 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            placeholder="Mensagem para P&D..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            className="text-sm"
          />
          <Button size="icon-sm" onClick={sendMessage} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Book Card ─────────────────────────────────────────────────────────────────

function BookCard({ book, onUpdate, onDelete }: { book: Book; onUpdate: () => void; onDelete: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ status: book.status, rating: book.rating, notes: book.notes || '' })

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/desenvolvimento/books', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: book.id, ...form }),
    })
    if (res.ok) {
      toast.success('Livro atualizado!')
      setEditOpen(false)
      onUpdate()
    } else {
      toast.error('Erro ao atualizar livro.')
    }
  }

  async function handleDelete() {
    if (!confirm('Remover este livro?')) return
    const res = await fetch('/api/desenvolvimento/books', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: book.id }),
    })
    if (res.ok) {
      toast.success('Livro removido.')
      onDelete()
    }
  }

  const statusInfo = BOOK_STATUS[book.status] || BOOK_STATUS.WANT_TO_READ

  return (
    <Card className="group hover:border-amber-500/20 transition-colors">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{book.title}</p>
            {book.author && <p className="text-sm text-muted-foreground truncate">{book.author}</p>}
            {book.status === 'COMPLETED' && book.rating && (
              <StarRating value={book.rating} readonly />
            )}
            {book.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{book.notes}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger render={
                  <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                } />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar: {book.title}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleUpdate} className="space-y-4">
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v ?? f.status }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(BOOK_STATUS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(form.status === 'COMPLETED' || form.status === 'ABANDONED') && (
                      <div className="space-y-1">
                        <Label>Avaliação</Label>
                        <StarRating
                          value={form.rating}
                          onChange={(v) => setForm(f => ({ ...f, rating: v }))}
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Notas</Label>
                      <Textarea
                        placeholder="Suas anotações sobre o livro..."
                        value={form.notes}
                        onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <Button type="submit" className="w-full">Salvar</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={handleDelete}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseCard({ course, onUpdate, onDelete }: { course: Course; onUpdate: () => void; onDelete: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({
    status: course.status,
    progress: String(course.progress),
    notes: course.notes || '',
  })

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/desenvolvimento/courses', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: course.id, ...form, progress: parseInt(form.progress) }),
    })
    if (res.ok) {
      toast.success('Curso atualizado!')
      setEditOpen(false)
      onUpdate()
    } else {
      toast.error('Erro ao atualizar curso.')
    }
  }

  async function handleDelete() {
    if (!confirm('Remover este curso?')) return
    const res = await fetch('/api/desenvolvimento/courses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: course.id }),
    })
    if (res.ok) {
      toast.success('Curso removido.')
      onDelete()
    }
  }

  const statusInfo = COURSE_STATUS[course.status] || COURSE_STATUS.NOT_STARTED
  const progressNum = course.progress || 0

  return (
    <Card className="group hover:border-amber-500/20 transition-colors">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{course.title}</p>
            {course.platform && <p className="text-sm text-muted-foreground">{course.platform}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger render={
                  <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                } />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar: {course.title}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleUpdate} className="space-y-4">
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v ?? f.status }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(COURSE_STATUS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Progresso</Label>
                        <span className="text-sm text-muted-foreground">{form.progress}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={form.progress}
                        onChange={(e) => setForm(f => ({ ...f, progress: e.target.value }))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Notas</Label>
                      <Textarea
                        placeholder="Anotações sobre o curso..."
                        value={form.notes}
                        onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <Button type="submit" className="w-full">Salvar</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={handleDelete}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{progressNum}%</span>
          </div>
          <Progress value={progressNum} className="h-2" />
        </div>

        {course.notes && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{course.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Skill Card ───────────────────────────────────────────────────────────────

function SkillCard({ skill, onUpdate, onDelete }: { skill: Skill; onUpdate: () => void; onDelete: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ level: skill.level, targetLevel: skill.targetLevel })

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/desenvolvimento/skills', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: skill.id, ...form }),
    })
    if (res.ok) {
      toast.success('Habilidade atualizada!')
      setEditOpen(false)
      onUpdate()
    } else {
      toast.error('Erro ao atualizar habilidade.')
    }
  }

  async function handleDelete() {
    if (!confirm('Remover esta habilidade?')) return
    const res = await fetch('/api/desenvolvimento/skills', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: skill.id }),
    })
    if (res.ok) {
      toast.success('Habilidade removida.')
      onDelete()
    }
  }

  const currentLevel = SKILL_LEVELS[skill.level]
  const targetLevel = SKILL_LEVELS[skill.targetLevel]
  const isMaxed = skill.level === skill.targetLevel || skill.level === 'EXPERT'

  return (
    <Card className="group hover:border-amber-500/20 transition-colors">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-semibold">{skill.name}</p>
            <Badge variant="outline" className="text-xs mt-0.5">{skill.category}</Badge>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger render={
                <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                  <ChevronRight className="w-3 h-3" />
                </Button>
              } />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar: {skill.name}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="space-y-1">
                    <Label>Nível Atual</Label>
                    <Select value={form.level} onValueChange={(v) => setForm(f => ({ ...f, level: v ?? f.level }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SKILL_LEVEL_KEYS.map(k => (
                          <SelectItem key={k} value={k}>{SKILL_LEVELS[k].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Nível Meta</Label>
                    <Select value={form.targetLevel} onValueChange={(v) => setForm(f => ({ ...f, targetLevel: v ?? f.targetLevel }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SKILL_LEVEL_KEYS.map(k => (
                          <SelectItem key={k} value={k}>{SKILL_LEVELS[k].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">Salvar</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={handleDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Atual: <span className="text-foreground font-medium">{currentLevel?.label}</span>
            </span>
            <span className="text-muted-foreground">
              Meta: <span className="text-foreground font-medium">{targetLevel?.label}</span>
            </span>
          </div>

          {/* Level steps */}
          <div className="flex items-center gap-1">
            {SKILL_LEVEL_KEYS.map((key, idx) => {
              const currentIdx = SKILL_LEVEL_KEYS.indexOf(skill.level)
              const targetIdx = SKILL_LEVEL_KEYS.indexOf(skill.targetLevel)
              const isCurrent = key === skill.level
              const isTarget = key === skill.targetLevel
              const isCompleted = idx <= currentIdx
              const isInProgress = idx > currentIdx && idx <= targetIdx

              return (
                <div key={key} className="flex items-center flex-1">
                  <div
                    className={cn(
                      'w-full h-2 rounded-full transition-all',
                      isCompleted ? SKILL_LEVELS[key].color : isInProgress ? 'bg-muted-foreground/20' : 'bg-muted/30'
                    )}
                  />
                  {idx < SKILL_LEVEL_KEYS.length - 1 && <div className="w-1" />}
                </div>
              )
            })}
          </div>

          {isMaxed && (
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <Award className="w-3 h-3" />
              Meta alcançada!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DesenvolvimentoPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)

  // Dialog states
  const [bookOpen, setBookOpen] = useState(false)
  const [courseOpen, setCourseOpen] = useState(false)
  const [skillOpen, setSkillOpen] = useState(false)

  // Forms
  const [bookForm, setBookForm] = useState({ title: '', author: '', status: 'WANT_TO_READ', notes: '' })
  const [courseForm, setCourseForm] = useState({ title: '', platform: '', status: 'NOT_STARTED', notes: '' })
  const [skillForm, setSkillForm] = useState({ name: '', category: '', level: 'BEGINNER', targetLevel: 'ADVANCED' })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [bRes, cRes, sRes] = await Promise.all([
      fetch('/api/desenvolvimento/books'),
      fetch('/api/desenvolvimento/courses'),
      fetch('/api/desenvolvimento/skills'),
    ])
    if (bRes.ok) setBooks(await bRes.json())
    if (cRes.ok) setCourses(await cRes.json())
    if (sRes.ok) setSkills(await sRes.json())
    setLoading(false)
  }

  async function handleBookSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/desenvolvimento/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookForm),
    })
    if (res.ok) {
      toast.success('Livro adicionado!')
      setBookOpen(false)
      setBookForm({ title: '', author: '', status: 'WANT_TO_READ', notes: '' })
      fetchData()
    } else {
      toast.error('Erro ao adicionar livro.')
    }
  }

  async function handleCourseSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/desenvolvimento/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(courseForm),
    })
    if (res.ok) {
      toast.success('Curso adicionado!')
      setCourseOpen(false)
      setCourseForm({ title: '', platform: '', status: 'NOT_STARTED', notes: '' })
      fetchData()
    } else {
      toast.error('Erro ao adicionar curso.')
    }
  }

  async function handleSkillSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/desenvolvimento/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skillForm),
    })
    if (res.ok) {
      toast.success('Habilidade adicionada!')
      setSkillOpen(false)
      setSkillForm({ name: '', category: '', level: 'BEGINNER', targetLevel: 'ADVANCED' })
      fetchData()
    } else {
      toast.error('Erro ao adicionar habilidade.')
    }
  }

  // Stats
  const thisYear = new Date().getFullYear()
  const booksReadThisYear = books.filter(b => b.status === 'COMPLETED' && b.finishedAt && new Date(b.finishedAt).getFullYear() === thisYear).length
  const coursesCompleted = courses.filter(c => c.status === 'COMPLETED').length
  const skillsInProgress = skills.filter(s => s.level !== s.targetLevel && s.level !== 'EXPERT').length

  // Group books by status
  const booksByStatus = {
    READING: books.filter(b => b.status === 'READING'),
    WANT_TO_READ: books.filter(b => b.status === 'WANT_TO_READ'),
    COMPLETED: books.filter(b => b.status === 'COMPLETED'),
    ABANDONED: books.filter(b => b.status === 'ABANDONED'),
  }

  // Group skills by category
  const skillsByCategory = skills.reduce((acc: Record<string, Skill[]>, skill) => {
    if (!acc[skill.category]) acc[skill.category] = []
    acc[skill.category].push(skill)
    return acc
  }, {})

  return (
    <div className={cn('space-y-6 transition-all', chatOpen ? 'mr-80' : '')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Desenvolvimento</h1>
          <p className="text-muted-foreground text-sm">P&D — Aprendizado e crescimento</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setChatOpen(!chatOpen)}
          className={cn(chatOpen && 'bg-amber-500/10 border-amber-500/30 text-amber-400')}
        >
          <Bot className="w-4 h-4 mr-2" />
          P&D
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-muted-foreground">Livros este ano</p>
            </div>
            <p className="text-2xl font-bold">{booksReadThisYear}</p>
            <p className="text-xs text-muted-foreground">{booksByStatus.READING.length} lendo agora</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-muted-foreground">Cursos concluídos</p>
            </div>
            <p className="text-2xl font-bold">{coursesCompleted}</p>
            <p className="text-xs text-muted-foreground">
              {courses.filter(c => c.status === 'IN_PROGRESS').length} em progresso
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-muted-foreground">Skills em dev.</p>
            </div>
            <p className="text-2xl font-bold">{skillsInProgress}</p>
            <p className="text-xs text-muted-foreground">{skills.length} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="books">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="books">
              <BookMarked className="w-4 h-4 mr-1.5" />
              Livros ({books.length})
            </TabsTrigger>
            <TabsTrigger value="courses">
              <GraduationCap className="w-4 h-4 mr-1.5" />
              Cursos ({courses.length})
            </TabsTrigger>
            <TabsTrigger value="skills">
              <Zap className="w-4 h-4 mr-1.5" />
              Habilidades ({skills.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab-specific add buttons */}
          <div>
            <TabsContent value="books" className="mt-0">
              <Dialog open={bookOpen} onOpenChange={setBookOpen}>
                <DialogTrigger render={<Button size="sm"><Plus className="w-4 h-4 mr-2" />Adicionar Livro</Button>} />
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar Livro</DialogTitle></DialogHeader>
                  <form onSubmit={handleBookSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <Label>Título *</Label>
                      <Input placeholder="Nome do livro" value={bookForm.title} onChange={(e) => setBookForm(f => ({ ...f, title: e.target.value }))} required />
                    </div>
                    <div className="space-y-1">
                      <Label>Autor</Label>
                      <Input placeholder="Nome do autor" value={bookForm.author} onChange={(e) => setBookForm(f => ({ ...f, author: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={bookForm.status} onValueChange={(v) => setBookForm(f => ({ ...f, status: v ?? f.status }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(BOOK_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Notas</Label>
                      <Textarea placeholder="Por que quer ler este livro?" value={bookForm.notes} onChange={(e) => setBookForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                    </div>
                    <Button type="submit" className="w-full">Adicionar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="courses" className="mt-0">
              <Dialog open={courseOpen} onOpenChange={setCourseOpen}>
                <DialogTrigger render={<Button size="sm"><Plus className="w-4 h-4 mr-2" />Adicionar Curso</Button>} />
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar Curso</DialogTitle></DialogHeader>
                  <form onSubmit={handleCourseSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <Label>Título *</Label>
                      <Input placeholder="Nome do curso" value={courseForm.title} onChange={(e) => setCourseForm(f => ({ ...f, title: e.target.value }))} required />
                    </div>
                    <div className="space-y-1">
                      <Label>Plataforma</Label>
                      <Input placeholder="Ex: Udemy, Coursera, YouTube" value={courseForm.platform} onChange={(e) => setCourseForm(f => ({ ...f, platform: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={courseForm.status} onValueChange={(v) => setCourseForm(f => ({ ...f, status: v ?? f.status }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(COURSE_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Notas</Label>
                      <Textarea placeholder="Por que quer fazer este curso?" value={courseForm.notes} onChange={(e) => setCourseForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                    </div>
                    <Button type="submit" className="w-full">Adicionar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="skills" className="mt-0">
              <Dialog open={skillOpen} onOpenChange={setSkillOpen}>
                <DialogTrigger render={<Button size="sm"><Plus className="w-4 h-4 mr-2" />Adicionar Habilidade</Button>} />
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar Habilidade</DialogTitle></DialogHeader>
                  <form onSubmit={handleSkillSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Nome *</Label>
                        <Input placeholder="Ex: TypeScript" value={skillForm.name} onChange={(e) => setSkillForm(f => ({ ...f, name: e.target.value }))} required />
                      </div>
                      <div className="space-y-1">
                        <Label>Categoria *</Label>
                        <Input placeholder="Ex: Tecnologia" value={skillForm.category} onChange={(e) => setSkillForm(f => ({ ...f, category: e.target.value }))} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Nível Atual</Label>
                        <Select value={skillForm.level} onValueChange={(v) => setSkillForm(f => ({ ...f, level: v ?? f.level }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SKILL_LEVEL_KEYS.map(k => <SelectItem key={k} value={k}>{SKILL_LEVELS[k].label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Nível Meta</Label>
                        <Select value={skillForm.targetLevel} onValueChange={(v) => setSkillForm(f => ({ ...f, targetLevel: v ?? f.targetLevel }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SKILL_LEVEL_KEYS.map(k => <SelectItem key={k} value={k}>{SKILL_LEVELS[k].label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button type="submit" className="w-full">Adicionar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </TabsContent>
          </div>
        </div>

        {/* BOOKS TAB */}
        <TabsContent value="books" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="pt-4 h-24" /></Card>)}
            </div>
          ) : books.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Nenhum livro cadastrado</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione livros para acompanhar sua leitura.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Currently reading */}
              {booksByStatus.READING.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> Lendo Agora ({booksByStatus.READING.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {booksByStatus.READING.map(book => (
                      <BookCard key={book.id} book={book} onUpdate={fetchData} onDelete={fetchData} />
                    ))}
                  </div>
                </div>
              )}

              {/* Want to read */}
              {booksByStatus.WANT_TO_READ.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 mb-2 flex items-center gap-1.5">
                    <BookMarked className="w-4 h-4" /> Quero Ler ({booksByStatus.WANT_TO_READ.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {booksByStatus.WANT_TO_READ.map(book => (
                      <BookCard key={book.id} book={book} onUpdate={fetchData} onDelete={fetchData} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed */}
              {booksByStatus.COMPLETED.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Concluídos ({booksByStatus.COMPLETED.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {booksByStatus.COMPLETED.map(book => (
                      <BookCard key={book.id} book={book} onUpdate={fetchData} onDelete={fetchData} />
                    ))}
                  </div>
                </div>
              )}

              {/* Abandoned */}
              {booksByStatus.ABANDONED.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                    <X className="w-4 h-4" /> Abandonados ({booksByStatus.ABANDONED.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {booksByStatus.ABANDONED.map(book => (
                      <BookCard key={book.id} book={book} onUpdate={fetchData} onDelete={fetchData} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* COURSES TAB */}
        <TabsContent value="courses" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="pt-4 h-28" /></Card>)}
            </div>
          ) : courses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Nenhum curso cadastrado</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione cursos para acompanhar seu aprendizado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {courses.map(course => (
                <CourseCard key={course.id} course={course} onUpdate={fetchData} onDelete={fetchData} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* SKILLS TAB */}
        <TabsContent value="skills" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="pt-4 h-24" /></Card>)}
            </div>
          ) : skills.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Nenhuma habilidade cadastrada</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione habilidades para acompanhar seu crescimento.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    {category} ({categorySkills.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categorySkills.map(skill => (
                      <SkillCard key={skill.id} skill={skill} onUpdate={fetchData} onDelete={fetchData} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Chat panel */}
      {chatOpen && (
        <AIChatPanel books={books} courses={courses} skills={skills} onClose={() => setChatOpen(false)} />
      )}
    </div>
  )
}
