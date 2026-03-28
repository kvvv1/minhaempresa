'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LogOut, User, Settings, Menu, LayoutDashboard, TrendingUp, Target, Calendar, Users, BookOpen, BookMarked, Swords, Building2, ChevronRight, Activity, Salad, GraduationCap, Briefcase, ListTodo, MessageSquareText, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getInitials, cn } from '@/lib/utils'
import { NotificationBell } from './NotificationBell'
import { GlobalSearch } from './GlobalSearch'

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
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
]

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="h-16 border-b border-border/40 bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-5 h-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>

        <h2 className="text-sm text-muted-foreground font-medium hidden sm:block">
          Bem-vindo de volta,{' '}
          <span className="text-foreground font-semibold">{session?.user?.name?.split(' ')[0]}</span>
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <GlobalSearch />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(session?.user?.name || session?.user?.email || 'U')}
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent className="w-56" align="end">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <Link href="/configuracoes">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col gap-0" showCloseButton={true}>
          <SheetHeader className="px-6 py-5 border-b border-border/40">
            <SheetTitle className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/20">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">Vida S.A.</p>
                <p className="text-xs text-muted-foreground">Painel Executivo</p>
              </div>
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <nav className="px-3 py-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
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

          <div className="p-4 border-t border-border/40">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getInitials(session?.user?.name || session?.user?.email || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
