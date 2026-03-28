'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ChatRichText } from '@/components/ai/ChatRichText'
import {
  Users, Plus, Phone, Mail, Clock, MessageCircle, Send, X, Bot,
  Calendar, CheckCircle2, Circle, Trash2, Search, Filter,
  PhoneCall, MessageSquare, Video, AtSign, UserCheck, AlertCircle,
} from 'lucide-react'
import { formatDate, formatRelative, getInitials, cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'

// ─── Constants ────────────────────────────────────────────────────────────────

const RELATIONSHIP_TYPES = ['Família', 'Amigo', 'Colega', 'Mentor', 'Parceiro', 'Cliente', 'Outro']
const INTERACTION_TYPES = [
  { value: 'CALL', label: 'Ligação', icon: PhoneCall },
  { value: 'MESSAGE', label: 'Mensagem', icon: MessageSquare },
  { value: 'MEETING', label: 'Encontro', icon: Users },
  { value: 'EMAIL', label: 'Email', icon: AtSign },
  { value: 'VIDEO', label: 'Videochamada', icon: Video },
]

const INTERACTION_LABELS: Record<string, string> = {
  CALL: 'Ligação',
  MESSAGE: 'Mensagem',
  MEETING: 'Encontro',
  EMAIL: 'Email',
  VIDEO: 'Videochamada',
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function getDaysSinceContact(lastContact: string | null): number | null {
  if (!lastContact) return null
  return Math.floor((Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24))
}

function getHealthColor(days: number | null, followUpDays: number): string {
  if (days === null) return 'bg-zinc-500'
  if (days < 7) return 'bg-emerald-500'
  if (days < 30) return 'bg-yellow-500'
  if (days < 60) return 'bg-orange-500'
  return 'bg-red-500'
}

function getHealthTextColor(days: number | null, followUpDays: number): string {
  if (days === null) return 'text-zinc-400'
  if (days < 7) return 'text-emerald-400'
  if (days < 30) return 'text-yellow-400'
  if (days < 60) return 'text-orange-400'
  return 'text-red-400'
}

function needsFollowup(contact: any): boolean {
  if (!contact.lastContact) return true
  const days = getDaysSinceContact(contact.lastContact)
  return days !== null && days > contact.followUpDays
}

function getRelationshipColor(rel: string): string {
  const map: Record<string, string> = {
    'Família': 'bg-pink-500/20 text-pink-300',
    'Amigo': 'bg-blue-500/20 text-blue-300',
    'Colega': 'bg-purple-500/20 text-purple-300',
    'Mentor': 'bg-amber-500/20 text-amber-300',
    'Parceiro': 'bg-teal-500/20 text-teal-300',
    'Cliente': 'bg-emerald-500/20 text-emerald-300',
    'Outro': 'bg-zinc-500/20 text-zinc-300',
  }
  return map[rel] || 'bg-zinc-500/20 text-zinc-300'
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Interaction {
  id: string
  type: string
  notes: string | null
  date: string
}

interface Commitment {
  id: string
  description: string
  dueDate: string | null
  status: string
}

interface Contact {
  id: string
  name: string
  relationship: string
  email: string | null
  phone: string | null
  notes: string | null
  followUpDays: number
  lastContact: string | null
  interactions: Interaction[]
  commitments: Commitment[]
}

// ─── AI Chat Panel ─────────────────────────────────────────────────────────────

function AIChatPanel({ contacts, onClose }: { contacts: Contact[]; onClose: () => void }) {
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
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeRole: 'CHRO',
          messages: newMessages,
          moduleData: {
            totalContacts: contacts.length,
            needsFollowup: contacts.filter(needsFollowup).length,
            pendingCommitments: contacts.reduce((s, c) => s + (c.commitments?.length || 0), 0),
            recentContacts: contacts.slice(0, 5).map(c => ({
              name: c.name,
              relationship: c.relationship,
              lastContact: c.lastContact,
              pendingCommitments: c.commitments?.length || 0,
            })),
          },
        }),
      })
      const responseText = (await res.text()).trim()
      if (res.ok) {
        setMessages(m => [...m, { role: 'assistant', content: responseText || 'Nao consegui processar sua solicitacao. Tente novamente.' }])
      } else {
        toast.error(responseText || 'Erro no chat com CHRO')
      }
    } catch {
      toast.error('Erro no chat com CHRO')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l border-border/50 flex flex-col z-40 shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">CHRO</p>
            <p className="text-xs text-muted-foreground">Diretor de RH</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Bot className="w-10 h-10 text-pink-500/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Olá! Sou o CHRO, seu diretor de Recursos Humanos pessoais.</p>
            <p className="text-xs text-muted-foreground mt-1">Posso ajudar com seus relacionamentos, follow-ups e compromissos.</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-pink-500/20 text-pink-100'
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
            placeholder="Mensagem para o CHRO..."
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

// ─── Contact Detail Panel ──────────────────────────────────────────────────────

function ContactDetailPanel({
  contact,
  onClose,
  onRefresh,
}: {
  contact: Contact
  onClose: () => void
  onRefresh: () => void
}) {
  const [fullContact, setFullContact] = useState<Contact | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [commitmentOpen, setCommitmentOpen] = useState(false)
  const [interactionForm, setInteractionForm] = useState({ type: 'CALL', notes: '', date: new Date().toISOString().split('T')[0] })
  const [commitmentForm, setCommitmentForm] = useState({ description: '', dueDate: '' })

  useEffect(() => {
    fetchDetail()
  }, [contact.id])

  async function fetchDetail() {
    setLoadingDetail(true)
    const res = await fetch(`/api/relacionamentos/contacts/${contact.id}`)
    if (res.ok) setFullContact(await res.json())
    setLoadingDetail(false)
  }

  async function logInteraction(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/relacionamentos/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: contact.id, ...interactionForm }),
    })
    if (res.ok) {
      toast.success('Interação registrada!')
      setInteractionOpen(false)
      setInteractionForm({ type: 'CALL', notes: '', date: new Date().toISOString().split('T')[0] })
      fetchDetail()
      onRefresh()
    } else {
      toast.error('Erro ao registrar interação.')
    }
  }

  async function addCommitment(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/relacionamentos/commitments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: contact.id, ...commitmentForm }),
    })
    if (res.ok) {
      toast.success('Compromisso adicionado!')
      setCommitmentOpen(false)
      setCommitmentForm({ description: '', dueDate: '' })
      fetchDetail()
      onRefresh()
    } else {
      toast.error('Erro ao adicionar compromisso.')
    }
  }

  async function completeCommitment(id: string) {
    const res = await fetch('/api/relacionamentos/commitments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'DONE' }),
    })
    if (res.ok) {
      toast.success('Compromisso concluído!')
      fetchDetail()
      onRefresh()
    }
  }

  async function deleteContact() {
    if (!confirm(`Deletar ${contact.name}?`)) return
    const res = await fetch(`/api/relacionamentos/contacts/${contact.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Contato removido.')
      onClose()
      onRefresh()
    } else {
      toast.error('Erro ao remover contato.')
    }
  }

  const days = getDaysSinceContact(contact.lastContact)
  const c = fullContact || contact

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-background border-l border-border/50 flex flex-col z-30 shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-pink-500/20 text-pink-300 font-semibold">
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{contact.name}</h3>
            <Badge className={cn('text-xs', getRelationshipColor(contact.relationship))}>
              {contact.relationship}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={deleteContact} className="text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {/* Health indicator */}
        <div className="mb-4 p-3 rounded-lg bg-muted/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Saúde do relacionamento</span>
            <span className={cn('text-xs font-medium', getHealthTextColor(days, contact.followUpDays))}>
              {days === null ? 'Nunca contatado' : days === 0 ? 'Hoje' : `${days} dias atrás`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', getHealthColor(days, contact.followUpDays))}
              style={{ width: days === null ? '100%' : `${Math.max(5, 100 - (days / contact.followUpDays) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Follow-up a cada {contact.followUpDays} dias</p>
        </div>

        {/* Contact info */}
        <div className="space-y-2 mb-4">
          {contact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-foreground truncate">
                {contact.email}
              </a>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">{contact.phone}</span>
            </div>
          )}
          {contact.notes && (
            <p className="text-xs text-muted-foreground p-2 bg-muted/30 rounded-lg mt-2">{contact.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-4">
          <Dialog open={interactionOpen} onOpenChange={setInteractionOpen}>
            <DialogTrigger render={
              <Button size="sm" className="flex-1 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border-0">
                <MessageCircle className="w-4 h-4 mr-1" />
                Log Interação
              </Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Interação com {contact.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={logInteraction} className="space-y-4">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={interactionForm.type} onValueChange={(v) => setInteractionForm(f => ({ ...f, type: v ?? f.type }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERACTION_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={interactionForm.date}
                    onChange={(e) => setInteractionForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Notas</Label>
                  <Textarea
                    placeholder="O que foi discutido?"
                    value={interactionForm.notes}
                    onChange={(e) => setInteractionForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">Registrar</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={commitmentOpen} onOpenChange={setCommitmentOpen}>
            <DialogTrigger render={
              <Button size="sm" variant="outline" className="flex-1">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Compromisso
              </Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Compromisso</DialogTitle>
              </DialogHeader>
              <form onSubmit={addCommitment} className="space-y-4">
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Ex: Enviar apresentação, Marcar almoço..."
                    value={commitmentForm.description}
                    onChange={(e) => setCommitmentForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Data limite (opcional)</Label>
                  <Input
                    type="date"
                    value={commitmentForm.dueDate}
                    onChange={(e) => setCommitmentForm(f => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full">Adicionar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loadingDetail ? (
          <p className="text-xs text-muted-foreground">Carregando detalhes...</p>
        ) : (
          <>
            {/* Pending commitments */}
            {c.commitments && c.commitments.filter(cm => cm.status === 'PENDING').length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Compromissos Pendentes
                </h4>
                <div className="space-y-2">
                  {c.commitments
                    .filter(cm => cm.status === 'PENDING')
                    .map(cm => (
                      <div key={cm.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                        <button onClick={() => completeCommitment(cm.id)} className="mt-0.5 text-muted-foreground hover:text-emerald-400 transition-colors flex-shrink-0">
                          <Circle className="w-4 h-4" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{cm.description}</p>
                          {cm.dueDate && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {formatDate(cm.dueDate)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Interaction history */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Histórico de Interações
              </h4>
              {c.interactions && c.interactions.length > 0 ? (
                <div className="space-y-2">
                  {c.interactions.map(interaction => {
                    const itype = INTERACTION_TYPES.find(t => t.value === interaction.type)
                    const Icon = itype?.icon || MessageSquare
                    return (
                      <div key={interaction.id} className="flex items-start gap-2 py-2 border-b border-border/20 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{itype?.label || interaction.type}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(interaction.date)}</span>
                          </div>
                          {interaction.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{interaction.notes}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma interação registrada ainda.</p>
              )}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RelacionamentosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterRelationship, setFilterRelationship] = useState('all')
  const [filterFollowup, setFilterFollowup] = useState(false)
  const [form, setForm] = useState({
    name: '',
    relationship: 'Amigo',
    email: '',
    phone: '',
    notes: '',
    followUpDays: '30',
  })

  useEffect(() => {
    fetchContacts()
  }, [filterFollowup])

  async function fetchContacts() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterFollowup) params.set('needsFollowup', 'true')
    const res = await fetch(`/api/relacionamentos/contacts?${params}`)
    if (res.ok) setContacts(await res.json())
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/relacionamentos/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, followUpDays: parseInt(form.followUpDays) }),
    })
    if (res.ok) {
      toast.success('Contato adicionado!')
      setAddOpen(false)
      setForm({ name: '', relationship: 'Amigo', email: '', phone: '', notes: '', followUpDays: '30' })
      fetchContacts()
    } else {
      toast.error('Erro ao adicionar contato.')
    }
  }

  // Filtered contacts (client-side search + relationship filter)
  const filteredContacts = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const matchRel = filterRelationship === 'all' || c.relationship === filterRelationship
    return matchSearch && matchRel
  })

  const totalContacts = contacts.length
  const followupCount = contacts.filter(needsFollowup).length
  const pendingCommitmentsCount = contacts.reduce((s, c) => s + (c.commitments?.length || 0), 0)

  return (
    <div className={cn('space-y-6 transition-all', (selectedContact || chatOpen) ? 'mr-80' : '')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relacionamentos</h1>
          <p className="text-muted-foreground text-sm">CHRO — CRM pessoal</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setChatOpen(!chatOpen)
              setSelectedContact(null)
            }}
            className={cn(chatOpen && 'bg-pink-500/10 border-pink-500/30 text-pink-400')}
          >
            <Bot className="w-4 h-4 mr-2" />
            CHRO
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="w-4 h-4 mr-2" />Novo Contato</Button>} />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Contato</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nome *</Label>
                    <Input
                      placeholder="Nome completo"
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Relacionamento *</Label>
                    <Select value={form.relationship} onValueChange={(v) => setForm(f => ({ ...f, relationship: v ?? f.relationship }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_TYPES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={form.email}
                      onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input
                      placeholder="(11) 99999-9999"
                      value={form.phone}
                      onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Notas</Label>
                  <Textarea
                    placeholder="Informações importantes sobre este contato..."
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Follow-up a cada (dias)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={form.followUpDays}
                    onChange={(e) => setForm(f => ({ ...f, followUpDays: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full">Adicionar Contato</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-pink-400" />
              <p className="text-xs text-muted-foreground">Total de Contatos</p>
            </div>
            <p className="text-2xl font-bold">{totalContacts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <p className="text-xs text-muted-foreground">Precisam Follow-up</p>
            </div>
            <p className={cn('text-2xl font-bold', followupCount > 0 ? 'text-yellow-400' : '')}>
              {followupCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-orange-400" />
              <p className="text-xs text-muted-foreground">Compromissos Pendentes</p>
            </div>
            <p className={cn('text-2xl font-bold', pendingCommitmentsCount > 0 ? 'text-orange-400' : '')}>
              {pendingCommitmentsCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterRelationship} onValueChange={(value) => setFilterRelationship(value ?? 'all')}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {RELATIONSHIP_TYPES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={filterFollowup ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterFollowup(f => !f)}
          className={filterFollowup ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-yellow-500/30' : ''}
        >
          <Clock className="w-4 h-4 mr-2" />
          Follow-up pendente
        </Button>
      </div>

      {/* Contact grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4 h-28" />
            </Card>
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhum contato encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search || filterRelationship !== 'all' || filterFollowup
                ? 'Tente ajustar os filtros de busca.'
                : 'Adicione pessoas importantes para manter seus relacionamentos!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredContacts.map((contact) => {
            const days = getDaysSinceContact(contact.lastContact)
            const isSelected = selectedContact?.id === contact.id
            const isFollowup = needsFollowup(contact)

            return (
              <Card
                key={contact.id}
                className={cn(
                  'cursor-pointer transition-all hover:border-pink-500/30',
                  isFollowup && 'border-yellow-500/20',
                  isSelected && 'border-pink-500/50 bg-pink-500/5'
                )}
                onClick={() => {
                  setSelectedContact(isSelected ? null : contact)
                  setChatOpen(false)
                }}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {/* Health dot */}
                    <div className="relative flex-shrink-0 mt-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-muted text-sm font-semibold">
                          {getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background', getHealthColor(days, contact.followUpDays))} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{contact.name}</h3>
                        <Badge className={cn('text-xs flex-shrink-0', getRelationshipColor(contact.relationship))}>
                          {contact.relationship}
                        </Badge>
                        {isFollowup && (
                          <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/40 flex-shrink-0">
                            <Clock className="w-2.5 h-2.5 mr-1" />
                            Follow-up
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {contact.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </span>
                        )}
                        {contact.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <p className={cn('text-xs', getHealthTextColor(days, contact.followUpDays))}>
                          {days === null
                            ? 'Nunca contatado'
                            : days === 0
                            ? 'Contatado hoje'
                            : `Último contato há ${days} dia${days !== 1 ? 's' : ''}`}
                        </p>
                        {contact.commitments && contact.commitments.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {contact.commitments.length} pendente{contact.commitments.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      {/* Recent interactions preview */}
                      {contact.interactions && contact.interactions.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {contact.interactions.slice(0, 3).map(i => {
                            const itype = INTERACTION_TYPES.find(t => t.value === i.type)
                            const Icon = itype?.icon || MessageSquare
                            return (
                              <div key={i.id} title={itype?.label} className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                                <Icon className="w-2.5 h-2.5 text-muted-foreground" />
                              </div>
                            )
                          })}
                          <span className="text-xs text-muted-foreground ml-1">
                            {contact.interactions.length} interaç{contact.interactions.length !== 1 ? 'ões' : 'ão'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Contact detail panel */}
      {selectedContact && (
        <ContactDetailPanel
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onRefresh={fetchContacts}
        />
      )}

      {/* AI Chat panel */}
      {chatOpen && (
        <AIChatPanel contacts={contacts} onClose={() => setChatOpen(false)} />
      )}
    </div>
  )
}
