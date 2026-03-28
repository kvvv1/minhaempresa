'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, Target, Calendar,
  Users, BookOpen, BookMarked, Swords, Building2,
  ChevronRight, Settings, Activity, Salad, GraduationCap,
  Briefcase, ListTodo, MessageSquareText, FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

const navigation = [
  { name: 'Dashboard CEO', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Financeiro', href: '/financeiro', icon: TrendingUp },
  { name: 'Metas', href: '/metas', icon: Target },
  { name: 'Rotina', href: '/rotina', icon: Calendar },
  { name: 'Relacionamentos', href: '/relacionamentos', icon: Users },
  { name: 'Desenvolvimento', href: '/desenvolvimento', icon: BookOpen },
  { name: 'Diário CEO', href: '/diario', icon: BookMarked },
  { name: 'Saúde & Fitness', href: '/saude', icon: Activity },
  { name: 'Nutrição', href: '/nutricao', icon: Salad },
  { name: 'Faculdade', href: '/faculdade', icon: GraduationCap },
  { name: 'Trabalho', href: '/trabalho', icon: Briefcase },
  { name: 'Tarefas', href: '/tarefas', icon: ListTodo },
  { name: 'Board Meeting', href: '/board-meeting', icon: Swords },
  { name: 'Chat com o Board', href: '/chat', icon: MessageSquareText },
  { name: 'Relatórios', href: '/relatorios', icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden md:flex w-64 flex-col bg-sidebar border-r border-border/40 h-screen">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border/40">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/20">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Vida S.A.</p>
          <p className="text-xs text-muted-foreground">Painel Executivo</p>
        </div>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                )}
              >
                <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : '')} />
                <span className="flex-1">{item.name}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-primary" />}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="p-3 border-t border-border/40 space-y-1">
        <Link
          href="/configuracoes"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
            pathname === '/configuracoes'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
          )}
        >
          <Settings className={cn('w-4 h-4 flex-shrink-0', pathname === '/configuracoes' ? 'text-primary' : '')} />
          <span className="flex-1">Configurações</span>
          {pathname === '/configuracoes' && <ChevronRight className="w-3 h-3 text-primary" />}
        </Link>
        <div className="px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium">CEO Mode</p>
          <p className="text-muted-foreground/60">Gerenciando sua vida</p>
        </div>
      </div>
    </div>
  )
}
