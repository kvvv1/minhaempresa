'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChatRichText } from '@/components/ai/ChatRichText'
import {
  Users,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Building2,
  Star,
  Mic,
  FileText,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface EmployeeReport {
  employee: {
    name: string
    role: string
    personality: string
  }
  report: string
}

interface Meeting {
  id: string
  topic: string | null
  reports: EmployeeReport[]
  startedAt: Date
  type: 'general' | 'quarterly'
}

const ROLE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string; icon: string; textColor: string }
> = {
  CHIEF_OF_STAFF: {
    label: 'Chief of Staff',
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    textColor: 'text-indigo-400',
    icon: '⚡',
  },
  CFO: {
    label: 'Diretor Financeiro',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    icon: '💰',
  },
  COO: {
    label: 'Diretora de Operações',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    icon: '⚙️',
  },
  CHRO: {
    label: 'Diretor de RH',
    color: 'bg-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    textColor: 'text-pink-400',
    icon: '👥',
  },
  RD: {
    label: 'Diretora de P&D',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
    icon: '🔬',
  },
  PERSONAL_TRAINER: {
    label: 'Personal Trainer',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    icon: '💪',
  },
  MENTOR_ACADEMICO: {
    label: 'Mentora Acadêmica',
    color: 'bg-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    textColor: 'text-violet-400',
    icon: '🎓',
  },
  PROJECT_MANAGER: {
    label: 'Gerente de Projetos',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    icon: '📋',
  },
}

function getRoleConfig(role: string) {
  return (
    ROLE_CONFIG[role] ?? {
      label: role,
      color: 'bg-slate-500',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      textColor: 'text-slate-400',
      icon: '👤',
    }
  )
}

// Order: COS first, then others
const ROLE_ORDER = ['CHIEF_OF_STAFF', 'CFO', 'COO', 'CHRO', 'RD', 'PERSONAL_TRAINER', 'MENTOR_ACADEMICO', 'PROJECT_MANAGER']

function sortReports(reports: EmployeeReport[]) {
  return [...reports].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.employee.role)
    const bi = ROLE_ORDER.indexOf(b.employee.role)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

function stripFormatting(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function ReportCard({
  report,
  index,
  visible,
}: {
  report: EmployeeReport
  index: number
  visible: boolean
}) {
  const [expanded, setExpanded] = useState(report.employee.role === 'CHIEF_OF_STAFF')
  const config = getRoleConfig(report.employee.role)

  if (!visible) return null

  return (
    <div
      className={`rounded-xl border ${config.borderColor} ${config.bgColor} transition-all duration-500 ease-out`}
      style={{
        animation: `fadeSlideIn 0.5s ease-out ${index * 0.15}s both`,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl ${config.color} flex items-center justify-center text-xl font-bold shadow-lg flex-shrink-0`}
            >
              {config.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-white">{report.employee.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${config.color} text-white font-medium`}
                >
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 italic">
                <span>&ldquo;{report.employee.personality}&rdquo;</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 flex-shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-1.5 mb-3">
              <Mic className="w-3.5 h-3.5 text-slate-600" />
              <span className={`text-xs font-medium ${config.textColor}`}>Relatório</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/6 bg-slate-950/35 px-4 py-4">
              <ChatRichText content={report.report} tone="slate" compact />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BoardMeetingPage() {
  const [topic, setTopic] = useState('')
  const [reports, setReports] = useState<EmployeeReport[]>([])
  const [visibleCount, setVisibleCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState('')
  const [meetingType, setMeetingType] = useState<'general' | 'quarterly'>('general')
  const [meetingStarted, setMeetingStarted] = useState(false)
  const [meetingHistory, setMeetingHistory] = useState<Meeting[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null)
  const revealIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('boardMeetingHistory')
      if (saved) setMeetingHistory(JSON.parse(saved))
    } catch {
      // ignore
    }
  }, [])

  function saveMeetingToHistory(meeting: Meeting) {
    setMeetingHistory((prev) => {
      const updated = [meeting, ...prev].slice(0, 10)
      try {
        localStorage.setItem('boardMeetingHistory', JSON.stringify(updated))
      } catch {
        // ignore
      }
      return updated
    })
  }

  async function startMeeting() {
    setLoading(true)
    setMeetingStarted(false)
    setReports([])
    setVisibleCount(0)

    const phases = [
      'Preparando a sala de reuniões...',
      'Convocando a diretoria...',
      'Coletando dados de todos os departamentos...',
      'Aguardando relatórios dos executivos...',
    ]
    let phaseIndex = 0
    setLoadingPhase(phases[0])
    const phaseInterval = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % phases.length
      setLoadingPhase(phases[phaseIndex])
    }, 2000)

    try {
      const quarterlyTopic =
        meetingType === 'quarterly'
          ? 'Revisão trimestral completa: avalie todas as áreas, identifique tendências, compare com metas e defina prioridades para os próximos 3 meses.'
          : undefined

      const res = await fetch('/api/ai/board-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim() || quarterlyTopic || undefined,
        }),
      })

      clearInterval(phaseInterval)

      if (!res.ok) {
        toast.error('Erro ao iniciar reunião. Tente novamente.')
        setLoading(false)
        return
      }

      const data = await res.json()
      const sorted = sortReports(data.reports)
      setReports(sorted)

      const meeting: Meeting = {
        id: Date.now().toString(),
        topic: topic.trim() || (meetingType === 'quarterly' ? 'Reunião Trimestral' : null),
        reports: sorted,
        startedAt: new Date(),
        type: meetingType,
      }
      setCurrentMeeting(meeting)
      saveMeetingToHistory(meeting)

      setLoading(false)
      setMeetingStarted(true)

      // Reveal reports one by one
      let count = 0
      const reveal = () => {
        count++
        setVisibleCount(count)
        if (count < sorted.length) {
          revealIntervalRef.current = setTimeout(reveal, 800)
        }
      }
      reveal()
    } catch {
      clearInterval(phaseInterval)
      toast.error('Erro de conexão.')
      setLoading(false)
    }
  }

  function resetMeeting() {
    setMeetingStarted(false)
    setReports([])
    setVisibleCount(0)
    setCurrentMeeting(null)
    setTopic('')
    setMeetingType('general')
    if (revealIntervalRef.current) clearTimeout(revealIntervalRef.current)
  }

  function loadHistoryMeeting(meeting: Meeting) {
    setCurrentMeeting(meeting)
    const sorted = sortReports(meeting.reports)
    setReports(sorted)
    setVisibleCount(sorted.length)
    setMeetingStarted(true)
    setShowHistory(false)
    setTopic(meeting.topic || '')
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* CSS animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 12px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            Board Meeting
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Reunião executiva com toda sua equipe de IA
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            className="border-slate-700 text-slate-400 hover:text-slate-200"
          >
            <History className="w-4 h-4 mr-1.5" />
            Histórico
            {meetingHistory.length > 0 && (
              <span className="ml-1.5 bg-indigo-500/20 text-indigo-400 text-xs px-1.5 py-0.5 rounded-full">
                {meetingHistory.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-indigo-400" />
              Reuniões Anteriores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {meetingHistory.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-4">Nenhuma reunião anterior.</p>
            ) : (
              <div className="space-y-2">
                {meetingHistory.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => loadHistoryMeeting(m)}
                    className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {m.type === 'quarterly' ? (
                        <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      ) : (
                        <Users className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 truncate">
                          {m.topic || 'Reunião Geral de Diretoria'}
                        </p>
                        <p className="text-xs text-slate-600">
                          {format(new Date(m.startedAt), "d 'de' MMM yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-slate-500">{m.reports.length} relatórios</span>
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Setup / Controls */}
      {!meetingStarted && !loading && (
        <div className="space-y-4">
          {/* Meeting room visual */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/20 p-8">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 text-center">
              <div className="w-20 h-20 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ animation: 'pulse-ring 2s infinite' }}
              >
                <Building2 className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Sala de Reuniões Executiva</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Convoque sua equipe de executivos IA para uma reunião estratégica. Cada diretor
                apresentará seu relatório e recomendações.
              </p>

              {/* Executive team preview */}
              <div className="flex justify-center gap-3 mt-6">
                {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
                  <div key={role} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-10 h-10 rounded-xl ${cfg.color} flex items-center justify-center text-lg shadow`}
                    >
                      {cfg.icon}
                    </div>
                    <span className="text-xs text-slate-600">{cfg.label.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Meeting type selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMeetingType('general')}
              className={`p-4 rounded-xl border text-left transition-all ${
                meetingType === 'general'
                  ? 'bg-indigo-500/10 border-indigo-500/40 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className={`w-5 h-5 ${meetingType === 'general' ? 'text-indigo-400' : 'text-slate-600'}`} />
                <span className="font-medium text-sm">Reunião Geral</span>
              </div>
              <p className="text-xs text-slate-500">Relatório de cada departamento sobre o estado atual</p>
            </button>

            <button
              onClick={() => setMeetingType('quarterly')}
              className={`p-4 rounded-xl border text-left transition-all ${
                meetingType === 'quarterly'
                  ? 'bg-amber-500/10 border-amber-500/40 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Star
                  className={`w-5 h-5 ${meetingType === 'quarterly' ? 'text-amber-400' : 'text-slate-600'}`}
                />
                <span className="font-medium text-sm">Reunião Trimestral</span>
              </div>
              <p className="text-xs text-slate-500">Revisão profunda com análise de tendências e próximos 3 meses</p>
            </button>
          </div>

          {/* Topic input */}
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-4">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Tópico Específico{' '}
                <span className="text-slate-600 font-normal">(opcional)</span>
              </label>
              <Input
                placeholder="Ex: Estratégia para dobrar minha renda, revisão dos hábitos, análise do progresso nas metas..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startMeeting()}
                className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/50"
              />
              <p className="text-xs text-slate-600 mt-1.5">
                Deixe vazio para que cada executivo apresente seu relatório geral de departamento
              </p>
            </CardContent>
          </Card>

          {/* Start button */}
          <Button
            onClick={startMeeting}
            className={`w-full py-6 text-base font-semibold shadow-lg transition-all ${
              meetingType === 'quarterly'
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {meetingType === 'quarterly' ? (
              <>
                <Star className="w-5 h-5 mr-2" />
                Iniciar Reunião Trimestral
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Convocar Board Meeting
              </>
            )}
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="relative">
            <div className="w-24 h-24 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
              <Building2 className="w-12 h-12 text-indigo-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            </div>
          </div>

          <div className="text-center">
            <p className="text-slate-200 font-medium">{loadingPhase}</p>
            <p className="text-slate-500 text-sm mt-1">Isso pode levar alguns segundos</p>
          </div>

          <div className="flex gap-3">
            {Object.entries(ROLE_CONFIG).map(([role, cfg], i) => (
              <div
                key={role}
                className={`w-10 h-10 rounded-xl ${cfg.color} flex items-center justify-center text-lg opacity-60`}
                style={{ animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite alternate` }}
              >
                {cfg.icon}
              </div>
            ))}
          </div>

          <style>{`
            @keyframes pulse {
              from { opacity: 0.3; transform: scale(0.95); }
              to { opacity: 0.9; transform: scale(1.05); }
            }
          `}</style>
        </div>
      )}

      {/* Meeting in progress */}
      {meetingStarted && reports.length > 0 && (
        <div className="space-y-6">
          {/* Meeting header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {currentMeeting?.type === 'quarterly' ? (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                    <Star className="w-3 h-3 mr-1" />
                    Reunião Trimestral
                  </Badge>
                ) : (
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                    <Users className="w-3 h-3 mr-1" />
                    Board Meeting
                  </Badge>
                )}
                <span className="text-xs text-slate-600">
                  {currentMeeting &&
                    format(new Date(currentMeeting.startedAt), "d 'de' MMM 'às' HH:mm", {
                      locale: ptBR,
                    })}
                </span>
              </div>
              {currentMeeting?.topic && (
                <p className="text-sm text-slate-400">
                  <span className="text-slate-600">Pauta: </span>
                  {currentMeeting.topic}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetMeeting}
              className="border-slate-700 text-slate-400 hover:text-slate-200"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Nova Reunião
            </Button>
          </div>

          {/* Progress bar */}
          {visibleCount < reports.length && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {ROLE_CONFIG[reports[visibleCount - 1]?.employee.role]?.label || 'Executivo'} apresentando...
                </span>
                <span>
                  {visibleCount}/{reports.length}
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${(visibleCount / reports.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Reports */}
          <div className="space-y-4">
            {reports.map((report, i) => (
              <ReportCard
                key={i}
                report={report}
                index={i}
                visible={i < visibleCount}
              />
            ))}
          </div>

          {/* Summary CTA - shown when all reports are visible */}
          {visibleCount >= reports.length && (
            <div
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center"
              style={{ animation: 'fadeSlideIn 0.5s ease-out both' }}
            >
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Reunião Concluída</h3>
              <p className="text-slate-400 text-sm mb-4">
                Todos os {reports.length} executivos apresentaram seus relatórios. A reunião foi
                registrada no histórico.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const chiefReport = reports.find((r) => r.employee.role === 'CHIEF_OF_STAFF')
                    if (chiefReport) {
                      const preview = stripFormatting(chiefReport.report).slice(0, 140)
                      toast.info(`Chief of Staff: ${preview}...`, {
                        duration: 8000,
                      })
                    }
                  }}
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <TrendingUp className="w-4 h-4 mr-1.5" />
                  Ver Síntese do Chief of Staff
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetMeeting}
                  className="border-slate-700 text-slate-400"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  Nova Reunião
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !meetingStarted && reports.length === 0 && meetingHistory.length > 0 && (
        <div className="text-center py-6">
          <p className="text-slate-600 text-sm">
            <button
              onClick={() => setShowHistory(true)}
              className="text-indigo-400 hover:underline"
            >
              Ver histórico de reuniões anteriores
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
