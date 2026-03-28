'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp, Target, Users, Calendar, BookOpen, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<string, React.ElementType> = {
  transaction: TrendingUp,
  goal: Target,
  contact: Users,
  habit: Calendar,
  book: BookOpen,
}

const TYPE_LABELS: Record<string, string> = {
  transaction: 'Transação',
  goal: 'Meta',
  contact: 'Contato',
  habit: 'Hábito',
  book: 'Livro',
}

interface Result {
  type: string
  id: string
  title: string
  subtitle: string
  href: string
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
    }
  }, [open])

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        if (res.ok) setResults(await res.json())
      } catch {}
      finally { setLoading(false) }
    }, 300)
  }, [])

  useEffect(() => { search(query) }, [query, search])

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[activeIndex]) navigate(results[activeIndex].href)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground bg-muted/40 border border-border/40 hover:bg-muted/70 transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Buscar...</span>
        <kbd className="ml-2 text-xs bg-background px-1.5 py-0.5 rounded border border-border/60 font-mono">⌘K</kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={handleKey}
            placeholder="Buscar transações, metas, contatos, hábitos..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {!loading && query && (
            <button onClick={() => setQuery('')}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="py-2 max-h-80 overflow-y-auto">
            {results.map((r, i) => {
              const Icon = TYPE_ICONS[r.type] ?? Search
              return (
                <li key={r.id + r.type}>
                  <button
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      i === activeIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                    )}
                    onClick={() => navigate(r.href)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {TYPE_LABELS[r.type]}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum resultado para "{query}"
          </div>
        )}

        {query.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Digite para buscar em todos os módulos
          </div>
        )}

        <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>Esc fechar</span>
        </div>
      </div>
    </div>
  )
}
