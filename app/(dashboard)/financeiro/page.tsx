'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Plus,
  Upload,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PiggyBank,
  Search,
  Trash2,
  Send,
  Bot,
  RefreshCw,
} from 'lucide-react'
import { ChatRichText } from '@/components/ai/ChatRichText'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Lazer',
  'Educação',
  'Vestuário',
  'Outros',
]

const INCOME_CATEGORIES = ['Salário', 'Freelance', 'Investimentos', 'Outros']

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: '#f97316',
  Moradia: '#8b5cf6',
  Transporte: '#3b82f6',
  Saúde: '#10b981',
  Lazer: '#ec4899',
  Educação: '#f59e0b',
  Vestuário: '#6366f1',
  Outros: '#6b7280',
  Salário: '#10b981',
  Freelance: '#3b82f6',
  Investimentos: '#8b5cf6',
  Importado: '#9ca3af',
}

const PIE_COLORS = [
  '#6366f1',
  '#f97316',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#6b7280',
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  description: string
  category: string
  date: string
  isRecurring: boolean
  recurringDay?: number
  budgetId?: string
  budget?: { name: string } | null
}

interface Budget {
  id: string
  name: string
  category: string
  limit: number
  month: number
  year: number
  transactions: Transaction[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  loading,
}: {
  title: string
  value: string
  icon: React.ElementType
  color: string
  subtitle?: string
  loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
            )}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-muted/40">
            <Icon className={cn('w-5 h-5', color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Transaction Item ─────────────────────────────────────────────────────────

function TransactionItem({
  transaction,
  onDelete,
}: {
  transaction: Transaction
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(transaction.id)
    setDeleting(false)
  }

  const categoryColor = CATEGORY_COLORS[transaction.category] || '#6b7280'

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 group transition-colors">
      <div
        className="w-1.5 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: categoryColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{transaction.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>
          <span
            className="text-[10px] px-1.5 py-0 h-4 rounded-full inline-flex items-center font-medium"
            style={{
              backgroundColor: categoryColor + '22',
              color: categoryColor,
            }}
          >
            {transaction.category}
          </span>
          {transaction.isRecurring && (
            <span className="text-[10px] px-1.5 py-0 h-4 rounded-full inline-flex items-center font-medium bg-blue-500/20 text-blue-400">
              Recorrente
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            transaction.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'
          )}
        >
          {transaction.type === 'INCOME' ? '+' : '-'}
          {formatCurrency(transaction.amount)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Add Transaction Dialog ───────────────────────────────────────────────────

function AddTransactionDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    amount: '',
    description: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    isRecurring: false,
    recurringDay: '',
  })

  const categories = form.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.description || !form.category) return
    setLoading(true)
    try {
      const res = await fetch('/api/financeiro/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          recurringDay: form.recurringDay ? parseInt(form.recurringDay) : undefined,
        }),
      })
      if (res.ok) {
        setOpen(false)
        setForm({
          type: 'EXPENSE',
          amount: '',
          description: '',
          category: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          isRecurring: false,
          recurringDay: '',
        })
        onAdded()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Transação
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, type: 'EXPENSE', category: '' }))}
              className={cn(
                'py-2 rounded-lg text-sm font-medium transition-colors border',
                form.type === 'EXPENSE'
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted/40'
              )}
            >
              <TrendingDown className="w-4 h-4 inline mr-1" />
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, type: 'INCOME', category: '' }))}
              className={cn(
                'py-2 rounded-lg text-sm font-medium transition-colors border',
                form.type === 'INCOME'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted/40'
              )}
            >
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Receita
            </button>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              placeholder="Ex: Supermercado, Salário..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.category}
              onValueChange={val => setForm(f => ({ ...f, category: val ?? f.category }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              required
            />
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.isRecurring}
              onClick={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
              className={cn(
                'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                form.isRecurring ? 'bg-indigo-500' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  form.isRecurring ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
            <Label
              className="text-sm cursor-pointer"
              onClick={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
            >
              Recorrente mensalmente
            </Label>
          </div>

          {form.isRecurring && (
            <div className="space-y-1.5">
              <Label>Dia do mês (1–31)</Label>
              <Input
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 5"
                value={form.recurringDay}
                onChange={e => setForm(f => ({ ...f, recurringDay: e.target.value }))}
              />
            </div>
          )}

          <div className="-mx-4 -mb-4 flex gap-2 justify-end rounded-b-xl border-t bg-muted/50 p-4 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── CFO Chat Panel ───────────────────────────────────────────────────────────

function CFOChatPanel({
  transactions,
  budgets,
}: {
  transactions: Transaction[]
  budgets: Budget[]
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const income = transactions
    .filter(t => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0)
  const expenses = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0)

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeRole: 'CFO',
          messages: newMessages,
          moduleData: {
            transactions: transactions.slice(0, 50),
            budgets,
            summary: {
              totalIncome: income,
              totalExpenses: expenses,
              balance: income - expenses,
              savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
            },
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      }
    } finally {
      setLoading(false)
    }
  }

  const suggestions = [
    'Como estão minhas finanças este mês?',
    'Onde estou gastando mais?',
    'Qual minha taxa de poupança?',
  ]

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            <Bot className="w-4 h-4 mr-1.5" />
            CFO
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            CFO — Diretor Financeiro
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Saldo do mês:{' '}
            <span
              className={cn(
                'font-semibold',
                income - expenses >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {formatCurrency(income - expenses)}
            </span>
          </p>
        </SheetHeader>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Bot className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Olá! Sou seu CFO. Pergunte sobre suas finanças.
              </p>
              <div className="space-y-1.5 mt-4 text-left">
                {suggestions.map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex gap-2',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-indigo-500/20 text-indigo-100'
                        : 'bg-muted/50 text-foreground'
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
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="bg-muted/50 px-3 py-2 rounded-xl">
                    <div className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-3 border-t">
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Pergunte ao seu CFO..."
              className="flex-1 text-sm"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (period !== 'all') params.set('period', period)
      const res = await fetch(`/api/financeiro/transactions?${params}`)
      if (res.ok) setTransactions(await res.json())
    } finally {
      setLoading(false)
    }
  }, [period])

  const fetchBudgets = useCallback(async () => {
    const now = new Date()
    const res = await fetch(
      `/api/financeiro/budgets?month=${now.getMonth() + 1}&year=${now.getFullYear()}`
    )
    if (res.ok) setBudgets(await res.json())
  }, [])

  useEffect(() => {
    fetchTransactions()
    fetchBudgets()
  }, [fetchTransactions, fetchBudgets])

  // ─── Computed ─────────────────────────────────────────────────────────────

  const income = transactions
    .filter(t => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0)
  const expenses = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0

  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'ALL' && t.type !== filterType) return false
    if (
      searchQuery &&
      !t.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false
    return true
  })

  // Category spending data for charts
  const categorySpendingData = Object.entries(
    transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce(
        (acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + t.amount
          return acc
        },
        {} as Record<string, number>
      )
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }))

  // Monthly evolution (last 6 months)
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date(),
  })

  const monthlyData = last6Months.map(month => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date)
      return d >= monthStart && d <= monthEnd
    })
    const mIncome = monthTx
      .filter(t => t.type === 'INCOME')
      .reduce((s, t) => s + t.amount, 0)
    const mExpenses = monthTx
      .filter(t => t.type === 'EXPENSE')
      .reduce((s, t) => s + t.amount, 0)
    return {
      name: format(month, 'MMM', { locale: ptBR }),
      Receitas: mIncome,
      Despesas: mExpenses,
      Saldo: mIncome - mExpenses,
    }
  })

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleDeleteTransaction(id: string) {
    const res = await fetch(`/api/financeiro/transactions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTransactions(prev => prev.filter(t => t.id !== id))
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/financeiro/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        alert(`${data.imported} transações importadas com sucesso!`)
        fetchTransactions()
      } else {
        alert(data.error || 'Erro ao importar')
      }
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm">Departamento Financeiro — CFO</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CFOChatPanel transactions={transactions} budgets={budgets} />

          {/* CSV import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1" />
            )}
            Importar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = `/api/financeiro/export?period=${period}` }}
          >
            <Download className="w-4 h-4 mr-1" />
            Exportar CSV
          </Button>

          <AddTransactionDialog onAdded={fetchTransactions} />
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { value: 'month', label: 'Este mês' },
          { value: 'last3months', label: 'Últimos 3 meses' },
          { value: 'year', label: 'Este ano' },
          { value: 'all', label: 'Tudo' },
        ].map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
              period === p.value
                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          title="Total de Receitas"
          value={formatCurrency(income)}
          icon={TrendingUp}
          color="text-emerald-400"
          loading={loading}
        />
        <SummaryCard
          title="Total de Despesas"
          value={formatCurrency(expenses)}
          icon={TrendingDown}
          color="text-red-400"
          loading={loading}
        />
        <SummaryCard
          title="Saldo"
          value={formatCurrency(balance)}
          icon={DollarSign}
          color={balance >= 0 ? 'text-emerald-400' : 'text-red-400'}
          loading={loading}
        />
        <SummaryCard
          title="Taxa de Poupança"
          value={`${savingsRate.toFixed(1)}%`}
          icon={PiggyBank}
          color={
            savingsRate >= 20
              ? 'text-emerald-400'
              : savingsRate >= 10
              ? 'text-yellow-400'
              : 'text-red-400'
          }
          subtitle={
            savingsRate >= 20 ? 'Excelente!' : savingsRate >= 10 ? 'Bom' : 'Precisa melhorar'
          }
          loading={loading}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="budgets">Orçamentos</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Monthly evolution area chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Evolução Mensal (6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={monthlyData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area
                      type="monotone"
                      dataKey="Receitas"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#colorReceitas)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Despesas"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#colorDespesas)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Category breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Donut chart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : categorySpendingData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    Sem despesas no período
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categorySpendingData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categorySpendingData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              CATEGORY_COLORS[entry.name] ||
                              PIE_COLORS[index % PIE_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value) => [formatCurrency(Number(value ?? 0)), '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Bar breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Top Categorias</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : categorySpendingData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    Sem despesas no período
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categorySpendingData.slice(0, 6).map(({ name, value }) => {
                      const pct = expenses > 0 ? (value / expenses) * 100 : 0
                      const color = CATEGORY_COLORS[name] || '#6b7280'
                      return (
                        <div key={name} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              {name}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {formatCurrency(value)}{' '}
                              <span className="opacity-60">({pct.toFixed(0)}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent transactions on overview */}
          {transactions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Últimas Transações</CardTitle>
              </CardHeader>
              <CardContent className="px-2">
                <div className="space-y-0.5">
                  {transactions.slice(0, 5).map(transaction => (
                    <TransactionItem
                      key={transaction.id}
                      transaction={transaction}
                      onDelete={handleDeleteTransaction}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Transactions ── */}
        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-sm">
                  Transações
                  {filteredTransactions.length > 0 && (
                    <span className="text-muted-foreground font-normal ml-1.5">
                      ({filteredTransactions.length})
                    </span>
                  )}
                </CardTitle>
                <div className="flex-1 min-w-[180px] relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-7 text-xs"
                    placeholder="Buscar descrição ou categoria..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-1">
                  {(
                    [
                      { value: 'ALL', label: 'Todos' },
                      { value: 'INCOME', label: 'Receitas' },
                      { value: 'EXPENSE', label: 'Despesas' },
                    ] as const
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setFilterType(value)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                        filterType === value
                          ? value === 'INCOME'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : value === 'EXPENSE'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-indigo-500/20 text-indigo-400'
                          : 'text-muted-foreground hover:bg-muted/40'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2">
              {loading ? (
                <div className="space-y-2 px-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma transação encontrada
                </div>
              ) : (
                <ScrollArea className="h-[560px]">
                  <div className="space-y-0.5">
                    {filteredTransactions.map(transaction => (
                      <TransactionItem
                        key={transaction.id}
                        transaction={transaction}
                        onDelete={handleDeleteTransaction}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Budgets ── */}
        <TabsContent value="budgets" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Orçamentos — {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {budgets.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <PiggyBank className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum orçamento definido para este mês.</p>
                  <p className="text-xs mt-1 opacity-70">
                    Defina orçamentos por categoria para controlar seus gastos.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {budgets.map(budget => {
                    const spent = budget.transactions
                      .filter(t => t.type === 'EXPENSE')
                      .reduce((s, t) => s + t.amount, 0)
                    const pct = budget.limit > 0 ? (spent / budget.limit) * 100 : 0
                    const over = pct > 100
                    const color = CATEGORY_COLORS[budget.category] || '#6b7280'

                    return (
                      <div key={budget.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium">{budget.name}</span>
                            <span
                              className="text-[10px] px-1.5 h-4 rounded-full inline-flex items-center font-medium bg-muted/60 text-muted-foreground"
                            >
                              {budget.category}
                            </span>
                          </div>
                          <div className="text-right tabular-nums">
                            <span
                              className={cn(
                                'font-semibold',
                                over ? 'text-red-400' : 'text-foreground'
                              )}
                            >
                              {formatCurrency(spent)}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {' '}/ {formatCurrency(budget.limit)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: over ? '#ef4444' : color,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{pct.toFixed(0)}% utilizado</span>
                          {over ? (
                            <span className="text-red-400 font-medium">
                              Excedido em {formatCurrency(spent - budget.limit)}
                            </span>
                          ) : (
                            <span>{formatCurrency(budget.limit - spent)} restante</span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Totals */}
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total orçado</span>
                      <span className="font-semibold">
                        {formatCurrency(budgets.reduce((s, b) => s + b.limit, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Total gasto</span>
                      <span className="font-semibold text-red-400">
                        {formatCurrency(
                          budgets.reduce(
                            (s, b) =>
                              s +
                              b.transactions
                                .filter(t => t.type === 'EXPENSE')
                                .reduce((ss, t) => ss + t.amount, 0),
                            0
                          )
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
