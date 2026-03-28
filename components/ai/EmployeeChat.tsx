'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, RefreshCw, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ChatRichText } from '@/components/ai/ChatRichText'
import { compressFlatHistory } from '@/lib/chat-history'
import { cn, EMPLOYEE_COLORS, EMPLOYEE_ROLE_LABELS, getInitials } from '@/lib/utils'

const MAX_HISTORY_MESSAGES = 30

interface Message {
  content: string
  id: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface EmployeeChatProps {
  open: boolean
  onClose: () => void
  employeeRole: string
  employeeName: string
  moduleData?: any
}

function getStorageKey(employeeRole: string) {
  return `vida-sa:employee-chat:${employeeRole}`
}

function createGreeting(employeeName: string, employeeRole: string): Message {
  return {
    id: `${employeeRole}-greeting`,
    role: 'assistant',
    content: `Ola! Sou ${employeeName}, seu ${EMPLOYEE_ROLE_LABELS[employeeRole] || employeeRole}. Como posso ajudar voce hoje?`,
    timestamp: new Date(),
  }
}

function buildRequestMessages(messages: Message[]) {
  return compressFlatHistory(
    messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    MAX_HISTORY_MESSAGES
  ).map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
  }))
}

function readStoredMessages(employeeRole: string): Message[] {
  try {
    const raw = localStorage.getItem(getStorageKey(employeeRole))
    if (!raw) return []

    const parsed = JSON.parse(raw) as Array<Omit<Message, 'timestamp'> & { timestamp: string }>
    return parsed.map((message) => ({
      ...message,
      timestamp: new Date(message.timestamp),
    }))
  } catch {
    return []
  }
}

export function EmployeeChat({
  open,
  onClose,
  employeeRole,
  employeeName,
  moduleData,
}: EmployeeChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const storedMessages = readStoredMessages(employeeRole)
    setMessages(storedMessages.length > 0 ? storedMessages : [createGreeting(employeeName, employeeRole)])
    setHydrated(true)
  }, [employeeName, employeeRole, open])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!open || !hydrated) return

    localStorage.setItem(
      getStorageKey(employeeRole),
      JSON.stringify(
        messages.map((message) => ({
          ...message,
          timestamp: message.timestamp.toISOString(),
        }))
      )
    )
  }, [employeeRole, hydrated, messages, open])

  function resetConversation() {
    const greeting = createGreeting(employeeName, employeeRole)
    setMessages([greeting])
    localStorage.removeItem(getStorageKey(employeeRole))
  }

  async function sendMessage() {
    const trimmedInput = input.trim()
    if (!trimmedInput || loading) return

    const userMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    }

    const nextHistory = [...messages, userMessage]
    const placeholder: Message = {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages([...nextHistory, placeholder])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeRole,
          messages: buildRequestMessages(nextHistory),
          moduleData,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Nao foi possivel falar com esse diretor agora')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        accumulated += decoder.decode(value, { stream: true })
        setMessages((previousMessages) => {
          const nextMessages = [...previousMessages]
          nextMessages[nextMessages.length - 1] = {
            ...nextMessages[nextMessages.length - 1],
            content: accumulated,
          }
          return nextMessages
        })
      }
    } catch (error) {
      setMessages((previousMessages) => {
        const nextMessages = [...previousMessages]
        nextMessages[nextMessages.length - 1] = {
          ...nextMessages[nextMessages.length - 1],
          content:
            error instanceof Error
              ? error.message
              : 'Desculpe, ocorreu um erro. Tente novamente.',
        }
        return nextMessages
      })
    } finally {
      setLoading(false)
    }
  }

  const colorClass = EMPLOYEE_COLORS[employeeRole] || 'bg-primary'

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="flex w-[420px] flex-col gap-0 p-0 sm:w-[520px]" side="right" showCloseButton>
        <SheetHeader className="shrink-0 border-b border-border/50 px-4 py-4">
          <SheetTitle className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className={cn(colorClass, 'text-sm text-white')}>
                  {getInitials(employeeName)}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-semibold">{employeeName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {EMPLOYEE_ROLE_LABELS[employeeRole] || employeeRole}
                  </Badge>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    Historico local
                  </Badge>
                </div>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={resetConversation} className="text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex gap-3', message.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
              >
                <Avatar className="mt-1 h-8 w-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      'text-xs',
                      message.role === 'user' ? 'bg-muted' : cn(colorClass, 'text-white')
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      getInitials(employeeName)
                    )}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    'max-w-[82%] rounded-[24px] px-4 py-3 text-sm shadow-sm',
                    message.role === 'user'
                      ? 'rounded-tr-sm bg-primary text-primary-foreground'
                      : 'rounded-tl-sm border border-border/50 bg-card/80'
                  )}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  ) : (
                    <ChatRichText content={message.content} />
                  )}
                  <p
                    className={cn(
                      'mt-1 text-xs',
                      message.role === 'user'
                        ? 'text-right text-primary-foreground/65'
                        : 'text-muted-foreground'
                    )}
                  >
                    {message.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.content === '' && (
              <div className="flex gap-3">
                <Avatar className="mt-1 h-8 w-8 shrink-0">
                  <AvatarFallback className={cn(colorClass, 'text-xs text-white')}>
                    <Bot className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-[24px] rounded-tl-sm border border-border/50 bg-card/80 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Processando e preparando a resposta final...
                  </div>
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border/50 p-4">
          <div className="flex gap-2">
            <Input
              placeholder={`Falar com ${employeeName}...`}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
              disabled={loading}
              className="h-12 flex-1 rounded-2xl"
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon" className="h-12 w-12 rounded-2xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
