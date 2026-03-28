'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatRichText } from '@/components/ai/ChatRichText'
import { compressFlatHistory } from '@/lib/chat-history'
import { cn, EMPLOYEE_COLORS, EMPLOYEE_ROLE_LABELS, getInitials } from '@/lib/utils'
import { toast } from 'sonner'

const BOARD_CHAT_STORAGE_KEY = 'vida-sa:board-chat:v2'
const MAX_HISTORY_MESSAGES = 60

type ResponseMode = 'orchestrated' | 'full-board'

interface EmployeeInfo {
  id: string
  name: string
  role: string
}

interface ConsultedResponse {
  employeeRole: string
  employeeName: string
  response: string
}

interface UserChatMessage {
  content: string
  id: string
  kind: 'user'
  timestamp: Date
  imageData?: string
  imageMimeType?: string
  imagePreview?: string  // data URL para exibição (não persiste no localStorage)
}

interface BoardChatMessage {
  consulted: ConsultedResponse[]
  content: string
  id: string
  kind: 'board'
  leadName: string
  leadRole: string
  mode: ResponseMode
  timestamp: Date
}

type ChatMessage = UserChatMessage | BoardChatMessage

interface StoredBoardChatState {
  activeRoles: string[]
  messages: Array<
    | (Omit<UserChatMessage, 'timestamp'> & { timestamp: string })
    | (Omit<BoardChatMessage, 'timestamp'> & { timestamp: string })
  >
  responseMode: ResponseMode
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isBoardMessage(message: ChatMessage): message is BoardChatMessage {
  return message.kind === 'board'
}

function readStoredState(): StoredBoardChatState | null {
  try {
    const raw = localStorage.getItem(BOARD_CHAT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredBoardChatState
  } catch {
    return null
  }
}

function deserializeMessages(
  storedMessages: StoredBoardChatState['messages'] | undefined
): ChatMessage[] {
  if (!storedMessages?.length) return []

  return storedMessages.map((message) =>
    message.kind === 'user'
      ? {
          ...message,
          timestamp: new Date(message.timestamp),
        }
      : {
          ...message,
          timestamp: new Date(message.timestamp),
        }
  )
}

function buildRequestMessages(history: ChatMessage[]) {
  type FlatEntry = { role: string; content: string; employeeRole?: string; imageData?: string; imageMimeType?: string }
  const flatHistory: FlatEntry[] = []
  for (const message of history) {
    if (!isBoardMessage(message)) {
      flatHistory.push({ role: 'user', content: message.content, imageData: message.imageData, imageMimeType: message.imageMimeType })
    } else {
      flatHistory.push({ role: 'employee', content: message.content, employeeRole: message.leadRole })
      for (const entry of message.consulted) {
        flatHistory.push({ role: 'employee', content: entry.response, employeeRole: entry.employeeRole })
      }
    }
  }

  const compressed = compressFlatHistory(
    flatHistory.map((m) => ({ role: m.role as 'user' | 'employee', content: m.content, employeeRole: m.employeeRole })),
    MAX_HISTORY_MESSAGES
  )

  // Reanexa imageData nas mensagens comprimidas correspondentes
  return compressed.map((m, i) => ({
    ...m,
    imageData: flatHistory[i]?.imageData,
    imageMimeType: flatHistory[i]?.imageMimeType,
  }))
}

function validateConsultedResponses(payload: unknown): ConsultedResponse[] {
  if (!Array.isArray(payload)) return []

  return payload.filter(
    (item): item is ConsultedResponse =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as ConsultedResponse).employeeRole === 'string' &&
      typeof (item as ConsultedResponse).employeeName === 'string' &&
      typeof (item as ConsultedResponse).response === 'string' &&
      (item as ConsultedResponse).response.trim().length > 0
  )
}

export function GlobalChat() {
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const [activeRoles, setActiveRoles] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [responseMode, setResponseMode] = useState<ResponseMode>('orchestrated')
  const [statusText, setStatusText] = useState('')
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set())
  const [panelOpen, setPanelOpen] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadBoardState() {
      try {
        const response = await fetch('/api/employees')
        const list = (await response.json()) as EmployeeInfo[]
        if (cancelled) return

        const storedState = readStoredState()
        const availableRoles = new Set(list.map((employee) => employee.role))
        const restoredRoles = storedState?.activeRoles.filter((role) => availableRoles.has(role)) ?? []

        setEmployees(list)
        setMessages(deserializeMessages(storedState?.messages))
        setResponseMode(storedState?.responseMode ?? 'orchestrated')
        setActiveRoles(new Set(restoredRoles.length > 0 ? restoredRoles : list.map((employee) => employee.role)))
      } catch {
        if (!cancelled) toast.error('Erro ao carregar funcionarios')
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }

    loadBoardState()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusText])

  useEffect(() => {
    if (!hydrated) return

    const payload: StoredBoardChatState = {
      activeRoles: Array.from(activeRoles),
      responseMode,
      messages: messages.map((message) => ({
        ...message,
        timestamp: message.timestamp.toISOString(),
      })),
    }

    localStorage.setItem(BOARD_CHAT_STORAGE_KEY, JSON.stringify(payload))
  }, [activeRoles, hydrated, messages, responseMode])

  function toggleRole(role: string) {
    setActiveRoles((previousRoles) => {
      const nextRoles = new Set(previousRoles)
      if (nextRoles.has(role)) {
        if (nextRoles.size === 1) return previousRoles
        nextRoles.delete(role)
        return nextRoles
      }

      nextRoles.add(role)
      return nextRoles
    })
  }

  function resetConversation() {
    setMessages([])
    setExpandedRounds(new Set())
    setStatusText('')
    localStorage.removeItem(BOARD_CHAT_STORAGE_KEY)
    setResponseMode('orchestrated')
  }

  function toggleRound(roundId: string) {
    setExpandedRounds((previousRounds) => {
      const nextRounds = new Set(previousRounds)
      if (nextRounds.has(roundId)) nextRounds.delete(roundId)
      else nextRounds.add(roundId)
      return nextRounds
    })
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1200
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setPendingImage({ data: dataUrl.split(',')[1], mimeType: 'image/jpeg', preview: dataUrl })
    }
    img.src = objectUrl
  }

  async function sendMessage() {
    const trimmedInput = input.trim()
    if ((!trimmedInput && !pendingImage) || loading) return

    const userMessage: UserChatMessage = {
      id: createMessageId(),
      kind: 'user',
      content: trimmedInput || 'Analise esta imagem.',
      timestamp: new Date(),
      imageData: pendingImage?.data,
      imageMimeType: pendingImage?.mimeType,
      imagePreview: pendingImage?.preview,
    }
    setPendingImage(null)

    const nextHistory = [...messages, userMessage]
    setMessages(nextHistory)
    setInput('')
    setLoading(true)
    setStatusText(
      responseMode === 'orchestrated'
        ? 'Chief of Staff alinhando o board e consultando quem importa agora.'
        : 'Board completo montando seus pareceres para esta rodada.'
    )

    try {
      const response = await fetch('/api/ai/chat/multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: buildRequestMessages(nextHistory),
          activeRoles: Array.from(activeRoles),
          responseMode,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error ?? 'Erro ao consultar o board')
      }

      const lead = data?.lead
      if (
        typeof lead?.employeeRole !== 'string' ||
        typeof lead?.employeeName !== 'string' ||
        typeof lead?.response !== 'string' ||
        lead.response.trim().length === 0
      ) {
        throw new Error('O board nao conseguiu montar uma resposta valida')
      }

      const consulted = validateConsultedResponses(data?.consulted)
      const boardMessage: BoardChatMessage = {
        id: createMessageId(),
        kind: 'board',
        content: lead.response.trim(),
        leadRole: lead.employeeRole,
        leadName: lead.employeeName,
        mode: data?.mode === 'full-board' ? 'full-board' : 'orchestrated',
        consulted,
        timestamp: new Date(),
      }

      setMessages((previousMessages) => [...previousMessages, boardMessage])
      if (consulted.length <= 1) {
        setExpandedRounds((previousRounds) => new Set(previousRounds).add(boardMessage.id))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar mensagem')
    } finally {
      setLoading(false)
      setStatusText('')
      inputRef.current?.focus()
    }
  }

  const activeEmployees = employees.filter((employee) => activeRoles.has(employee.role))

  return (
    <div className="flex h-full max-h-[calc(100vh-7rem)] flex-col gap-2">
      {/* ── Toolbar compacta ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-card/60 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Modo */}
          <button
            onClick={() => setResponseMode('orchestrated')}
            disabled={loading}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
              responseMode === 'orchestrated'
                ? 'border-primary/40 bg-primary text-primary-foreground'
                : 'border-border/60 text-muted-foreground hover:border-border'
            )}
          >
            Chief conduz
          </button>
          <button
            onClick={() => setResponseMode('full-board')}
            disabled={loading}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
              responseMode === 'full-board'
                ? 'border-primary/40 bg-primary text-primary-foreground'
                : 'border-border/60 text-muted-foreground hover:border-border'
            )}
          >
            Board completo
          </button>

          <div className="mx-1 h-4 w-px bg-border/50" />

          {/* Avatares dos participantes ativos */}
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {employees.map((employee) => {
                const active = activeRoles.has(employee.role)
                return (
                  <button
                    key={employee.role}
                    onClick={() => toggleRole(employee.role)}
                    disabled={loading}
                    title={`${employee.name} · ${EMPLOYEE_ROLE_LABELS[employee.role]}`}
                    className={cn(
                      'h-6 w-6 rounded-full border-2 border-background text-[9px] font-bold text-white transition-all',
                      active
                        ? (EMPLOYEE_COLORS[employee.role] ?? 'bg-primary')
                        : 'bg-muted opacity-40 grayscale'
                    )}
                  >
                    {employee.name.slice(0, 2).toUpperCase()}
                  </button>
                )
              })}
            </div>
            <span className="text-xs text-muted-foreground">{activeEmployees.length} ativos</span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary py-0 text-[10px]">
              <Sparkles className="mr-1 h-2.5 w-2.5" />
              Local
            </Badge>
            <Button variant="ghost" size="sm" onClick={resetConversation} className="h-7 px-2 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPanelOpen((v) => !v)}
              className="h-7 px-2 text-muted-foreground"
              title="Expandir opções"
            >
              {panelOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Painel expandido */}
        {panelOpen && (
          <div className="mt-3 border-t border-border/40 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Participantes:
              </span>
              {employees.map((employee) => {
                const active = activeRoles.has(employee.role)
                const color = EMPLOYEE_COLORS[employee.role] ?? 'bg-primary'
                return (
                  <button
                    key={employee.role}
                    onClick={() => toggleRole(employee.role)}
                    disabled={loading}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                      active
                        ? cn(color, 'border-transparent text-white')
                        : 'border-border/60 text-muted-foreground hover:border-border'
                    )}
                  >
                    {employee.name}
                    <span className="opacity-70">· {EMPLOYEE_ROLE_LABELS[employee.role]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden rounded-3xl border border-border/50 bg-background/80 shadow-sm">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-5">
            {messages.length === 0 && (
              <div className="overflow-hidden rounded-[28px] border border-border/50 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.15),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.06),transparent)] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-xl space-y-2">
                    <p className="text-sm font-semibold text-foreground">Sala do board pronta</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Fale normalmente. O Chief of Staff organiza a conversa, consulta especialistas
                      quando necessario e devolve uma resposta unica em vez de uma transcricao caotica.
                    </p>
                  </div>
                  <div className="flex -space-x-2">
                    {employees.slice(0, 5).map((employee) => (
                      <Avatar key={employee.role} className="h-11 w-11 border-2 border-background">
                        <AvatarFallback
                          className={cn(EMPLOYEE_COLORS[employee.role] ?? 'bg-primary', 'text-xs text-white')}
                        >
                          {getInitials(employee.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.kind === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <div className="flex max-w-[78%] flex-row-reverse gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-muted text-xs">
                        <User className="h-3.5 w-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-[24px] rounded-tr-sm bg-primary px-4 py-3 text-primary-foreground shadow-sm">
                      {message.imagePreview && (
                        <img src={message.imagePreview} alt="anexo" className="mb-2 max-h-48 rounded-xl object-cover" />
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                      <p className="mt-1 text-right text-xs text-primary-foreground/65">
                        {message.timestamp.toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex gap-3">
                  <Avatar className="mt-1 h-9 w-9 shrink-0">
                    <AvatarFallback
                      className={cn(
                        EMPLOYEE_COLORS[message.leadRole] ?? 'bg-primary',
                        'text-xs text-white'
                      )}
                    >
                      {getInitials(message.leadName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 rounded-[28px] border border-border/50 bg-card/80 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{message.leadName}</span>
                          <Badge variant="outline" className="border-border/60">
                            {EMPLOYEE_ROLE_LABELS[message.leadRole] ?? message.leadRole}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              message.mode === 'orchestrated'
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                            )}
                          >
                            {message.mode === 'orchestrated' ? 'Chief conduz' : 'Board completo'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {message.consulted.length > 0
                            ? `${message.consulted.length} especialista(s) consultado(s) nesta rodada`
                            : 'Resposta direta sem consulta adicional'}
                        </p>
                      </div>

                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl bg-muted/50 px-4 py-3">
                      <ChatRichText content={message.content} />
                    </div>

                    {message.consulted.length > 0 && (
                      <div className="mt-4">
                        <button
                          onClick={() => toggleRound(message.id)}
                          className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {expandedRounds.has(message.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          Ver consultas internas
                        </button>

                        {expandedRounds.has(message.id) && (
                          <div className="mt-3 space-y-3">
                            {message.consulted.map((entry) => (
                              <div
                                key={`${message.id}-${entry.employeeRole}`}
                                className="rounded-2xl border border-border/50 bg-background/70 p-3"
                              >
                                <div className="mb-2 flex items-center gap-2">
                                  <Avatar className="h-7 w-7">
                                    <AvatarFallback
                                      className={cn(
                                        EMPLOYEE_COLORS[entry.employeeRole] ?? 'bg-primary',
                                        'text-[10px] text-white'
                                      )}
                                    >
                                      {getInitials(entry.employeeName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-xs font-semibold text-foreground">{entry.employeeName}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {EMPLOYEE_ROLE_LABELS[entry.employeeRole] ?? entry.employeeRole}
                                    </p>
                                  </div>
                                </div>
                                <ChatRichText content={entry.response} tone="muted" compact />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {loading && (
              <div className="flex gap-3">
                <Avatar className="mt-1 h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-[28px] border border-border/50 bg-card/80 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {statusText}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    O historico desta conversa continua sendo levado em conta.
                  </p>
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="flex flex-col gap-2">
        {pendingImage && (
          <div className="relative w-fit">
            <img src={pendingImage.preview} alt="preview" className="h-20 rounded-xl object-cover border border-border/50" />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="h-12 w-12 shrink-0 rounded-2xl"
            title="Anexar imagem"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            placeholder={
              pendingImage
                ? 'Descreva o que quer fazer com a imagem (opcional)...'
                : responseMode === 'orchestrated'
                  ? 'Fale com o board. O Chief of Staff coordena a resposta...'
                  : 'Abra a mesa toda para discutir esta pauta...'
            }
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
            disabled={loading}
            className="h-12 flex-1 rounded-2xl"
          />
          <Button onClick={sendMessage} disabled={loading || (!input.trim() && !pendingImage)} size="icon" className="h-12 w-12 rounded-2xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
