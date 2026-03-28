'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  BookOpen,
  Save,
  Calendar,
  Sparkles,
  Tag,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Loader2,
  CheckCircle2,
  Hash,
  TrendingUp,
  FileText,
  Edit3,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ChatButton } from '@/components/ai/ChatButton'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getMonth, getYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface DiaryEntry {
  id: string
  date: string
  content: string
  mood: number | null
  tags: string[]
}

const MOOD_CONFIG = [
  { value: 1, label: 'Péssimo', color: 'bg-red-500', textColor: 'text-red-400', emoji: '😞' },
  { value: 2, label: 'Ruim', color: 'bg-orange-500', textColor: 'text-orange-400', emoji: '😕' },
  { value: 3, label: 'Regular', color: 'bg-yellow-500', textColor: 'text-yellow-400', emoji: '😐' },
  { value: 4, label: 'Bom', color: 'bg-lime-500', textColor: 'text-lime-400', emoji: '🙂' },
  { value: 5, label: 'Ótimo', color: 'bg-green-500', textColor: 'text-green-400', emoji: '😊' },
  { value: 6, label: 'Muito bom', color: 'bg-emerald-500', textColor: 'text-emerald-400', emoji: '😄' },
  { value: 7, label: 'Excelente', color: 'bg-teal-500', textColor: 'text-teal-400', emoji: '😁' },
  { value: 8, label: 'Incrível', color: 'bg-cyan-500', textColor: 'text-cyan-400', emoji: '🤩' },
  { value: 9, label: 'Fantástico', color: 'bg-blue-500', textColor: 'text-blue-400', emoji: '🥳' },
  { value: 10, label: 'Perfeito', color: 'bg-violet-500', textColor: 'text-violet-400', emoji: '🌟' },
]

function getMoodConfig(mood: number) {
  return MOOD_CONFIG[Math.min(Math.max(mood - 1, 0), 9)]
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export default function DiarioPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [chiefOfStaff, setChiefOfStaff] = useState<{ name: string } | null>(null)
  const [content, setContent] = useState('')
  const [mood, setMood] = useState(5)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null)
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editMood, setEditMood] = useState(5)
  const [editTags, setEditTags] = useState<string[]>([])
  const [editTagInput, setEditTagInput] = useState('')
  const [analysis, setAnalysis] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'insights'>('editor')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null)

  useEffect(() => {
    fetchEntries()
    fetch('/api/employees?role=CHIEF_OF_STAFF').then(r => r.ok ? r.json() : null).then(d => { if (d?.[0]) setChiefOfStaff(d[0]) })
  }, [])

  async function fetchEntries() {
    setLoading(true)
    const res = await fetch('/api/diario')
    if (res.ok) {
      const data: DiaryEntry[] = await res.json()
      setEntries(data)
      const today = data.find((e) => isSameDay(new Date(e.date), new Date()))
      if (today) {
        setTodayEntry(today)
        setContent(today.content)
        setMood(today.mood ?? 5)
        setTags(today.tags ?? [])
      }
    }
    setLoading(false)
  }

  const triggerAutoSave = useCallback(
    (newContent: string, newMood: number, newTags: string[]) => {
      if (!newContent.trim()) return
      setSaveStatus('saving')
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(async () => {
        await saveEntry(newContent, newMood, newTags, true)
      }, 1500)
    },
    []
  )

  function handleContentChange(val: string) {
    setContent(val)
    triggerAutoSave(val, mood, tags)
  }

  function handleMoodChange(val: number) {
    setMood(val)
    triggerAutoSave(content, val, tags)
  }

  async function saveEntry(
    c: string = content,
    m: number = mood,
    t: string[] = tags,
    silent = false
  ) {
    if (!c.trim()) return
    if (!silent) setSaveStatus('saving')

    const res = await fetch('/api/diario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: c, mood: m, tags: t }),
    })

    if (res.ok) {
      setSaveStatus('saved')
      if (!silent) toast.success('Entrada salva!')
      await fetchEntries()
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('idle')
      if (!silent) toast.error('Erro ao salvar.')
    }
  }

  function addTag(input: string = tagInput) {
    const trimmed = input.trim().toLowerCase().replace(/\s+/g, '-')
    if (trimmed && !tags.includes(trimmed)) {
      const newTags = [...tags, trimmed]
      setTags(newTags)
      triggerAutoSave(content, mood, newTags)
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    const newTags = tags.filter((t) => t !== tag)
    setTags(newTags)
    triggerAutoSave(content, mood, newTags)
  }

  function addEditTag(input: string = editTagInput) {
    const trimmed = input.trim().toLowerCase().replace(/\s+/g, '-')
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags([...editTags, trimmed])
    }
    setEditTagInput('')
  }

  async function saveEditEntry() {
    if (!editingEntry || !editContent.trim()) return
    const res = await fetch('/api/diario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent, mood: editMood, tags: editTags }),
    })
    if (res.ok) {
      toast.success('Entrada atualizada!')
      setEditingEntry(null)
      setSelectedEntry(null)
      await fetchEntries()
    } else {
      toast.error('Erro ao atualizar.')
    }
  }

  async function deleteEntry(id: string) {
    const res = await fetch('/api/diario', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      toast.success('Entrada removida.')
      setSelectedEntry(null)
      await fetchEntries()
    } else {
      toast.error('Erro ao remover.')
    }
  }

  async function fetchAnalysis() {
    setAnalyzing(true)
    setShowAnalysis(true)
    const res = await fetch('/api/diario/analyze')
    if (res.ok) {
      const data = await res.json()
      if (data.error === 'few_entries') {
        toast.error(data.message)
        setShowAnalysis(false)
      } else {
        setAnalysis(data)
      }
    } else {
      toast.error('Erro ao analisar.')
    }
    setAnalyzing(false)
  }

  // Calendar helpers
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth),
  })

  const entriesByDay = entries.reduce<Record<string, DiaryEntry>>((acc, e) => {
    const key = format(new Date(e.date), 'yyyy-MM-dd')
    acc[key] = e
    return acc
  }, {})

  const moodChartData = entries
    .filter((e) => e.mood !== null)
    .slice()
    .reverse()
    .slice(-30)
    .map((e) => ({
      date: format(new Date(e.date), 'dd/MM', { locale: ptBR }),
      mood: e.mood,
    }))

  // Tag cloud
  const tagCounts = entries.reduce<Record<string, number>>((acc, e) => {
    e.tags?.forEach((t) => {
      acc[t] = (acc[t] || 0) + 1
    })
    return acc
  }, {})

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  const firstDayOfMonth = startOfMonth(calendarMonth).getDay()

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-violet-400" />
            Diário CEO
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Suas reflexões, padrões e crescimento pessoal</p>
        </div>
        <div className="flex gap-2">
          {chiefOfStaff && (
            <ChatButton
              employeeRole="CHIEF_OF_STAFF"
              employeeName={chiefOfStaff.name}
              moduleData={{
                totalEntries: entries.length,
                averageMood: entries.filter(e => e.mood).length > 0
                  ? Math.round(entries.filter(e => e.mood).reduce((s, e) => s + (e.mood ?? 0), 0) / entries.filter(e => e.mood).length * 10) / 10
                  : null,
                topTags,
                recentEntries: entries.slice(0, 5).map(e => ({ date: e.date, mood: e.mood, tags: e.tags, preview: e.content.slice(0, 100) })),
              }}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalysis}
            disabled={analyzing}
            className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
          >
            {analyzing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Análise IA
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 p-1 rounded-lg w-fit">
        {[
          { key: 'editor', label: 'Editor', icon: Edit3 },
          { key: 'history', label: 'Histórico', icon: Calendar },
          { key: 'insights', label: 'Insights', icon: TrendingUp },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* AI Analysis Panel */}
      {showAnalysis && (
        <Card className="bg-slate-900 border-violet-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-violet-400">
                <Sparkles className="w-4 h-4" />
                Análise de Padrões — IA
              </CardTitle>
              <button onClick={() => setShowAnalysis(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {analyzing ? (
              <div className="flex items-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                <span className="text-sm">Analisando seus padrões...</span>
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                {/* Stats row */}
                {analysis.stats && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-violet-400">{analysis.stats.totalEntries}</p>
                      <p className="text-xs text-slate-500">entradas</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-violet-400">
                        {analysis.stats.avgMood ?? '—'}<span className="text-xs">/10</span>
                      </p>
                      <p className="text-xs text-slate-500">humor médio</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-violet-400">{analysis.stats.streak}d</p>
                      <p className="text-xs text-slate-500">sequência</p>
                    </div>
                  </div>
                )}
                {analysis.themes?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-2">TEMAS RECORRENTES</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.themes.map((t: string) => (
                        <span key={t} className="bg-violet-500/20 text-violet-300 px-3 py-1 rounded-full text-xs">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.moodPattern && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-400 mb-1">PADRÃO DE HUMOR</p>
                    <p className="text-sm text-slate-300">{analysis.moodPattern}</p>
                  </div>
                )}
                {analysis.surprisingObservation && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-400 mb-1">OBSERVAÇÃO SURPREENDENTE</p>
                    <p className="text-sm text-slate-300">{analysis.surprisingObservation}</p>
                  </div>
                )}
                {analysis.practicalSuggestion && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-emerald-400 mb-1">SUGESTÃO PRÁTICA</p>
                    <p className="text-sm text-slate-300">{analysis.practicalSuggestion}</p>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* EDITOR TAB */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Today's entry editor */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2 text-slate-200">
                    <FileText className="w-4 h-4 text-violet-400" />
                    {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {saveStatus === 'saving' && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Salvando...
                      </span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Salvo
                      </span>
                    )}
                    <span className="text-xs text-slate-600">
                      {wordCount(content)} palavras · {content.length} chars
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="O que aconteceu hoje? O que aprendi? O que quero melhorar? Quais foram os momentos mais significativos?"
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  rows={10}
                  className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 resize-none focus:border-violet-500/50 leading-relaxed"
                />

                {/* Tags input */}
                <div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 bg-violet-500/20 text-violet-300 text-xs px-2 py-1 rounded-full"
                      >
                        <Hash className="w-3 h-3" />
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-white ml-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Adicionar tag (Enter para confirmar)"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-sm px-3 py-1.5 rounded-md focus:outline-none focus:border-violet-500/50 placeholder:text-slate-600"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addTag()}
                      className="border-slate-700 text-slate-400"
                    >
                      <Tag className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => saveEntry()}
                  disabled={!content.trim() || saveStatus === 'saving'}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Entrada
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Mood selector sidebar */}
          <div className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300">Humor de Hoje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  {MOOD_CONFIG.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => handleMoodChange(m.value)}
                      title={m.label}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-lg transition-all border-2 ${
                        mood === m.value
                          ? `border-white/30 ${m.color} scale-105 shadow-lg`
                          : 'border-transparent bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      <span>{m.emoji}</span>
                    </button>
                  ))}
                </div>
                {mood && (
                  <div className="text-center">
                    <span className={`text-2xl font-bold ${getMoodConfig(mood).textColor}`}>
                      {mood}/10
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">{getMoodConfig(mood).label}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Calendar heatmap */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-slate-300">
                    {format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}
                  </CardTitle>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setCalendarMonth((d) => new Date(getYear(d), getMonth(d) - 1, 1))
                      }
                      className="text-slate-500 hover:text-slate-300 p-0.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setCalendarMonth((d) => new Date(getYear(d), getMonth(d) + 1, 1))
                      }
                      className="text-slate-500 hover:text-slate-300 p-0.5"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="text-xs text-slate-600 py-1">
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {calendarDays.map((day) => {
                    const key = format(day, 'yyyy-MM-dd')
                    const entry = entriesByDay[key]
                    const isToday = isSameDay(day, new Date())
                    return (
                      <button
                        key={key}
                        onClick={() => entry && setSelectedEntry(entry)}
                        title={entry ? `Humor: ${entry.mood}/10` : format(day, 'd MMM', { locale: ptBR })}
                        className={`aspect-square rounded text-xs flex items-center justify-center transition-all ${
                          isToday ? 'ring-1 ring-violet-500' : ''
                        } ${
                          entry
                            ? `${getMoodConfig(entry.mood ?? 5).color} text-white font-medium opacity-80 hover:opacity-100 cursor-pointer`
                            : 'bg-slate-800 text-slate-600'
                        }`}
                      >
                        {format(day, 'd')}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                  <span>Humor baixo</span>
                  <div className="flex gap-0.5">
                    {[1, 3, 5, 7, 10].map((v) => (
                      <div
                        key={v}
                        className={`w-3 h-3 rounded-sm ${getMoodConfig(v).color}`}
                      />
                    ))}
                  </div>
                  <span>Humor alto</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Entry list */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              {entries.length} entradas
            </h2>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : entries.length === 0 ? (
              <Card className="bg-slate-900 border-slate-800 border-dashed">
                <CardContent className="py-10 text-center">
                  <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Nenhuma entrada ainda.</p>
                </CardContent>
              </Card>
            ) : (
              entries.map((entry) => {
                const mc = getMoodConfig(entry.mood ?? 5)
                const isSelected = selectedEntry?.id === entry.id
                return (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setSelectedEntry(entry)
                      setEditingEntry(null)
                    }}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-violet-500/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {format(new Date(entry.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {wordCount(entry.content)} palavras
                        </p>
                      </div>
                      {entry.mood && (
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-full ${mc.color} text-white flex-shrink-0`}
                        >
                          {mc.emoji} {entry.mood}/10
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {entry.content}
                    </p>
                    {entry.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Entry detail / edit */}
          <div>
            {selectedEntry && !editingEntry && (
              <Card className="bg-slate-900 border-slate-800 sticky top-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm text-slate-200">
                        {format(new Date(selectedEntry.date), "d 'de' MMMM yyyy", { locale: ptBR })}
                      </CardTitle>
                      {selectedEntry.mood && (
                        <p className={`text-xs mt-0.5 ${getMoodConfig(selectedEntry.mood).textColor}`}>
                          {getMoodConfig(selectedEntry.mood).emoji}{' '}
                          {getMoodConfig(selectedEntry.mood).label} ({selectedEntry.mood}/10)
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingEntry(selectedEntry)
                          setEditContent(selectedEntry.content)
                          setEditMood(selectedEntry.mood ?? 5)
                          setEditTags(selectedEntry.tags ?? [])
                        }}
                        className="border-slate-700 text-slate-400 hover:text-slate-200"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteEntry(selectedEntry.id)}
                        className="border-slate-700 text-red-400 hover:text-red-300 hover:border-red-500/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    {selectedEntry.content}
                  </p>
                  {selectedEntry.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {selectedEntry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {editingEntry && (
              <Card className="bg-slate-900 border-violet-500/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-violet-400">Editando entrada</CardTitle>
                    <button
                      onClick={() => setEditingEntry(null)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    className="bg-slate-950 border-slate-800 text-slate-200 resize-none"
                  />
                  <div className="grid grid-cols-5 gap-1">
                    {MOOD_CONFIG.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setEditMood(m.value)}
                        className={`aspect-square rounded text-sm flex items-center justify-center transition-all ${
                          editMood === m.value ? `${m.color} scale-105` : 'bg-slate-800'
                        }`}
                      >
                        {m.emoji}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {editTags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 bg-violet-500/20 text-violet-300 text-xs px-2 py-1 rounded-full"
                        >
                          #{tag}
                          <button onClick={() => setEditTags(editTags.filter((t) => t !== tag))}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Tag (Enter)"
                      value={editTagInput}
                      onChange={(e) => setEditTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addEditTag()
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm px-3 py-1.5 rounded-md focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={saveEditEntry}
                      className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditingEntry(null)}
                      className="border-slate-700"
                    >
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedEntry && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-700">
                <FileText className="w-12 h-12 mb-3" />
                <p className="text-sm">Selecione uma entrada para visualizar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INSIGHTS TAB */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Mood chart */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-slate-200">
                <BarChart2 className="w-4 h-4 text-violet-400" />
                Histórico de Humor (últimos 30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {moodChartData.length < 2 ? (
                <div className="flex items-center justify-center h-40 text-slate-600 text-sm">
                  Registre mais entradas para ver o gráfico de humor
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={moodChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#475569', fontSize: 11 }}
                      axisLine={{ stroke: '#1e293b' }}
                    />
                    <YAxis
                      domain={[1, 10]}
                      tick={{ fill: '#475569', fontSize: 11 }}
                      axisLine={{ stroke: '#1e293b' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                        fontSize: '12px',
                      }}
                      formatter={(((val: number) => [
                        `${val}/10 — ${getMoodConfig(val).emoji} ${getMoodConfig(val).label}`,
                        'Humor',
                      ]) as any)}
                    />
                    <Line
                      type="monotone"
                      dataKey="mood"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', r: 4 }}
                      activeDot={{ r: 6, fill: '#a78bfa' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Total de Entradas',
                value: entries.length,
                suffix: '',
                icon: FileText,
                color: 'text-violet-400',
              },
              {
                label: 'Humor Médio',
                value:
                  entries.filter((e) => e.mood).length > 0
                    ? (
                        entries
                          .filter((e) => e.mood)
                          .reduce((s, e) => s + (e.mood ?? 0), 0) /
                        entries.filter((e) => e.mood).length
                      ).toFixed(1)
                    : '—',
                suffix: entries.filter((e) => e.mood).length > 0 ? '/10' : '',
                icon: TrendingUp,
                color: 'text-emerald-400',
              },
              {
                label: 'Palavras Escritas',
                value: entries.reduce((s, e) => s + wordCount(e.content), 0).toLocaleString('pt-BR'),
                suffix: '',
                icon: Hash,
                color: 'text-blue-400',
              },
              {
                label: 'Tags Únicas',
                value: Object.keys(tagCounts).length,
                suffix: '',
                icon: Tag,
                color: 'text-amber-400',
              },
            ].map(({ label, value, suffix, icon: Icon, color }) => (
              <Card key={label} className="bg-slate-900 border-slate-800">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${color}`}>
                    {value}
                    <span className="text-sm font-normal text-slate-500">{suffix}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tag cloud */}
          {topTags.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-slate-200">
                  <Tag className="w-4 h-4 text-amber-400" />
                  Nuvem de Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {topTags.map(([tag, count]) => {
                    const size =
                      count >= 5
                        ? 'text-lg font-semibold'
                        : count >= 3
                        ? 'text-base font-medium'
                        : 'text-sm'
                    const opacity = count >= 5 ? 'opacity-100' : count >= 2 ? 'opacity-75' : 'opacity-50'
                    return (
                      <span
                        key={tag}
                        className={`${size} ${opacity} text-violet-300 bg-violet-500/10 px-3 py-1 rounded-full cursor-default hover:bg-violet-500/20 transition-colors`}
                        title={`${count} ${count === 1 ? 'entrada' : 'entradas'}`}
                      >
                        #{tag}
                        <span className="text-xs text-violet-500 ml-1">({count})</span>
                      </span>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis CTA */}
          {!showAnalysis && (
            <Card className="bg-slate-900 border-violet-500/20 border-dashed">
              <CardContent className="py-8 text-center">
                <Sparkles className="w-10 h-10 text-violet-400 mx-auto mb-3" />
                <h3 className="text-slate-200 font-medium mb-1">Análise de Padrões com IA</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Descubra temas recorrentes, padrões de humor e insights sobre sua jornada
                </p>
                <Button
                  onClick={fetchAnalysis}
                  disabled={entries.length < 3}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {entries.length < 3
                    ? `Escreva mais ${3 - entries.length} entrada(s) para analisar`
                    : 'Analisar Meu Diário'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
