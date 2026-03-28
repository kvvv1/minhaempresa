'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { eachDayOfInterval, endOfMonth, endOfWeek, format, getHours, isSameDay, startOfMonth, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, CalendarDays, CheckCircle2, Inbox, Layers3, TimerReset } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  type PlannerHabit,
  type PlannerItem,
  type PlannerResponse,
  PLANNER_MODULE_CONFIG,
  PLANNER_PRIORITY_CONFIG,
  isPlannerItemOverdue,
} from '@/lib/planner'

function getPrimaryDate(item: PlannerItem) {
  return item.scheduledStart ?? item.dueDate
}

function formatTime(value?: string | null) {
  if (!value) return null
  return format(new Date(value), 'HH:mm')
}

function formatDayLabel(value?: string | null) {
  if (!value) return null
  return format(new Date(value), "d 'de' MMM", { locale: ptBR })
}

function groupItemsByDay(items: PlannerItem[]) {
  return items.reduce<Record<string, PlannerItem[]>>((acc, item) => {
    const key = getPrimaryDate(item)
    if (!key) return acc
    const dayKey = format(new Date(key), 'yyyy-MM-dd')
    acc[dayKey] ??= []
    acc[dayKey].push(item)
    return acc
  }, {})
}

function SummaryCard({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: {
  title: string
  value: number
  hint: string
  icon: React.ElementType
  className?: string
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className={cn('text-2xl font-semibold', className)}>{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
            <Icon className={cn('h-4 w-4', className)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PlannerSummaryCards({ summary }: { summary: PlannerResponse['summary'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
      <SummaryCard title="Inbox" value={summary.inboxCount} hint="capturas para processar" icon={Inbox} className="text-sky-400" />
      <SummaryCard title="Foco" value={summary.focusCount} hint="itens de execucao" icon={Layers3} className="text-blue-400" />
      <SummaryCard title="Agendado" value={summary.scheduledCount} hint="blocos no calendario" icon={CalendarDays} className="text-amber-400" />
      <SummaryCard title="Atrasadas" value={summary.overdueCount} hint="pedem decisao hoje" icon={AlertTriangle} className="text-red-400" />
      <SummaryCard title="Habitos" value={summary.habitsDueCount} hint="esperados para o dia" icon={TimerReset} className="text-violet-400" />
      <SummaryCard title="Feitos" value={summary.habitsCompletedCount} hint="habitos concluidos hoje" icon={CheckCircle2} className="text-emerald-400" />
    </div>
  )
}

function PlannerItemCard({ item, compact = false, actions }: { item: PlannerItem; compact?: boolean; actions?: ReactNode }) {
  const moduleConfig = PLANNER_MODULE_CONFIG[item.sourceModule]
  const priorityConfig = item.priority ? PLANNER_PRIORITY_CONFIG[item.priority] : null
  const primaryDate = getPrimaryDate(item)
  const overdue = isPlannerItemOverdue(item)
  const content = (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card/70 p-3 transition-colors hover:border-primary/40 hover:bg-card',
        compact && 'p-2.5',
        overdue && 'border-red-500/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {actions ? (
            <Link href={item.href} className="block transition-colors hover:text-primary">
              <p className={cn('font-medium leading-tight', compact ? 'text-xs' : 'text-sm')}>{item.title}</p>
            </Link>
          ) : (
            <p className={cn('font-medium leading-tight', compact ? 'text-xs' : 'text-sm')}>{item.title}</p>
          )}
          {(item.detail || item.description) && (
            <p className="truncate text-xs text-muted-foreground">{item.detail ?? item.description}</p>
          )}
        </div>
        <div className="flex items-start gap-2">
          {actions ? <div className="shrink-0">{actions}</div> : null}
          <Badge variant="outline" className={cn('h-5 shrink-0 text-[10px]', moduleConfig.className)}>
            {moduleConfig.label}
          </Badge>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {item.scheduledStart && (
          <span>{item.allDay ? 'Dia inteiro' : `${formatTime(item.scheduledStart)}${item.scheduledEnd ? ` - ${formatTime(item.scheduledEnd)}` : ''}`}</span>
        )}
        {!item.scheduledStart && primaryDate && <span>Prazo {formatDayLabel(primaryDate)}</span>}
        {item.scheduleMode === 'linked' ? <span className="text-sky-400">Bloco vinculado</span> : null}
        {item.scheduleMode === 'manual' ? <span className="text-amber-400">Bloco manual</span> : null}
        {priorityConfig && <span className={priorityConfig.className}>{priorityConfig.label}</span>}
        {item.estimatedMin ? <span>{item.estimatedMin} min</span> : null}
        {overdue ? <span className="text-red-400">Atrasada</span> : null}
      </div>
    </div>
  )

  if (actions) return content
  return <Link href={item.href} className="block">{content}</Link>
}

function HabitList({ habits }: { habits: PlannerHabit[] }) {
  if (habits.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum habito previsto para hoje.</p>
  }

  return (
    <div className="space-y-2">
      {habits.map((habit) => (
        <div key={habit.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 p-3">
          <div>
            <p className="text-sm font-medium">{habit.name}</p>
            <p className="text-xs text-muted-foreground">{habit.frequency} - streak {habit.streak}</p>
          </div>
          <Badge variant="outline" className={cn('h-6', habit.completedToday ? 'border-emerald-500/40 text-emerald-400' : 'border-border text-muted-foreground')}>
            {habit.completedToday ? 'Feito' : 'Pendente'}
          </Badge>
        </div>
      ))}
    </div>
  )
}

export function PlannerTimelineCard({
  title,
  description,
  scheduledItems,
  floatingItems = [],
  habits = [],
  renderItemActions,
}: {
  title: string
  description: string
  scheduledItems: PlannerItem[]
  floatingItems?: PlannerItem[]
  habits?: PlannerHabit[]
  renderItemActions?: (item: PlannerItem) => ReactNode
}) {
  const allDayItems = scheduledItems.filter((item) => item.allDay)
  const hourlyItems = scheduledItems.filter((item) => !item.allDay)
  const itemsByHour = hourlyItems.reduce<Record<number, PlannerItem[]>>((acc, item) => {
    const hour = getHours(new Date(item.scheduledStart!))
    acc[hour] ??= []
    acc[hour].push(item)
    return acc
  }, {})

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {allDayItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dia inteiro</p>
            <div className="space-y-2">
              {allDayItems.map((item) => (
                <PlannerItemCard key={item.id} item={item} compact actions={renderItemActions?.(item)} />
              ))}
            </div>
          </div>
        )}

        <ScrollArea className="h-[28rem] pr-3">
          <div className="space-y-2">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
                <div className="pt-1 text-xs text-muted-foreground">{`${String(hour).padStart(2, '0')}:00`}</div>
                <div className="rounded-xl border border-dashed border-border/60 px-3 py-2">
                  {itemsByHour[hour]?.length ? (
                    <div className="space-y-2">
                      {itemsByHour[hour].map((item) => (
                        <PlannerItemCard key={item.id} item={item} compact actions={renderItemActions?.(item)} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Livre</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {floatingItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sem horario</p>
            <div className="space-y-2">
              {floatingItems.slice(0, 6).map((item) => (
                <PlannerItemCard key={item.id} item={item} compact actions={renderItemActions?.(item)} />
              ))}
            </div>
          </div>
        )}

        {habits.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Habitos do dia</p>
            <HabitList habits={habits} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PlannerListCard({
  title,
  description,
  items,
  emptyText,
  renderItemActions,
}: {
  title: string
  description: string
  items: PlannerItem[]
  emptyText: string
  renderItemActions?: (item: PlannerItem) => ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <PlannerItemCard key={item.id} item={item} compact actions={renderItemActions?.(item)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PlannerTodayBoard({ data, renderItemActions }: { data: PlannerResponse; renderItemActions?: (item: PlannerItem) => ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <PlannerTimelineCard
        title="Agenda 24h"
        description="Blocos com horario e tarefas flutuantes do dia."
        scheduledItems={data.scheduledItems}
        floatingItems={data.focusItems}
        habits={data.habits}
        renderItemActions={renderItemActions}
      />
      <div className="space-y-4">
        <PlannerListCard
          title="Foco de hoje"
          description="Itens sem horario, mas que pedem decisao ou execucao."
          items={data.focusItems.slice(0, 8)}
          emptyText="Nenhuma tarefa em foco para hoje."
          renderItemActions={renderItemActions}
        />
        <PlannerListCard
          title="Atrasadas"
          description="Tudo o que ja passou do prazo e precisa ser resolvido."
          items={data.overdueItems.slice(0, 6)}
          emptyText="Nada atrasado agora."
          renderItemActions={renderItemActions}
        />
      </div>
    </div>
  )
}

export function PlannerWeekBoard({ data, renderItemActions }: { data: PlannerResponse; renderItemActions?: (item: PlannerItem) => ReactNode }) {
  const groupedItems = groupItemsByDay(data.items)
  const days = eachDayOfInterval({
    start: new Date(data.range.from),
    end: new Date(data.range.to),
  })

  return (
    <div className="grid gap-4 lg:grid-cols-7">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd')
        const dayItems = groupedItems[key] ?? []

        return (
          <Card key={key} className={cn(isSameDay(day, new Date()) && 'border-primary/40 bg-primary/5')}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{format(day, 'EEE d', { locale: ptBR })}</CardTitle>
              <p className="text-xs text-muted-foreground">{dayItems.length} item(ns)</p>
            </CardHeader>
            <CardContent>
              {dayItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem compromissos.</p>
              ) : (
                <div className="space-y-2">
                  {dayItems.slice(0, 5).map((item) => (
                    <PlannerItemCard key={item.id} item={item} compact actions={renderItemActions?.(item)} />
                  ))}
                  {dayItems.length > 5 ? (
                    <p className="text-xs text-muted-foreground">+{dayItems.length - 5} itens</p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function PlannerMonthBoard({ data, renderItemActions }: { data: PlannerResponse; renderItemActions?: (item: PlannerItem) => ReactNode }) {
  const rangeStart = startOfWeek(startOfMonth(new Date(data.range.from)), { weekStartsOn: 1 })
  const rangeEnd = endOfWeek(endOfMonth(new Date(data.range.from)), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  const groupedItems = groupItemsByDay(data.items)
  const monthDate = new Date(data.range.from)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{format(monthDate, 'MMMM yyyy', { locale: ptBR })}</CardTitle>
        <p className="text-sm text-muted-foreground">Visao mensal da carga operacional e dos blocos ja distribuidos.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayItems = groupedItems[key] ?? []
            const isCurrentMonth = day.getMonth() === monthDate.getMonth()

            return (
              <div
                key={key}
                className={cn(
                  'min-h-28 rounded-xl border border-border/70 p-2',
                  !isCurrentMonth && 'opacity-45',
                  isSameDay(day, new Date()) && 'border-primary/40 bg-primary/5',
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium">{format(day, 'd')}</span>
                  {dayItems.length > 0 ? <Badge variant="outline" className="h-5 text-[10px]">{dayItems.length}</Badge> : null}
                </div>
                <div className="space-y-1.5">
                  {dayItems.slice(0, 2).map((item) => (
                    <PlannerItemCard key={item.id} item={item} compact actions={renderItemActions?.(item)} />
                  ))}
                  {dayItems.length > 2 ? <p className="text-[11px] text-muted-foreground">+{dayItems.length - 2} itens</p> : null}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
