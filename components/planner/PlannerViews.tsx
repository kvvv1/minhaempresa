'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getHours,
  getMinutes,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, CalendarDays, CheckCircle2, Inbox, Layers3, TimerReset, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

// ─── Constants ────────────────────────────────────────────────────────────────
const CAL_HOUR_START = 6
const CAL_HOUR_END = 23
const CAL_ROW_H = 56 // px per hour in the time-grid

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

/** Returns { top, height } in px for an event in the time-grid, or null if outside range */
function getTimeGridPosition(item: PlannerItem): { top: number; height: number } | null {
  if (!item.scheduledStart || item.allDay) return null
  const start = new Date(item.scheduledStart)
  const startHourF = getHours(start) + getMinutes(start) / 60
  if (startHourF >= CAL_HOUR_END) return null

  const endHourF = item.scheduledEnd
    ? Math.min(getHours(new Date(item.scheduledEnd)) + getMinutes(new Date(item.scheduledEnd)) / 60, CAL_HOUR_END)
    : startHourF + 1

  const clampedStart = Math.max(startHourF, CAL_HOUR_START)
  const top = (clampedStart - CAL_HOUR_START) * CAL_ROW_H
  const height = Math.max(24, (endHourF - clampedStart) * CAL_ROW_H)
  return { top, height }
}

// ─── Event chip (month/week all-day) ──────────────────────────────────────────
function EventChip({ item, onClick }: { item: PlannerItem; onClick?: () => void }) {
  const cfg = PLANNER_MODULE_CONFIG[item.sourceModule]
  const time = !item.allDay ? formatTime(item.scheduledStart ?? item.dueDate) : null
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-tight truncate transition-opacity hover:opacity-80',
        cfg.chipCn,
      )}
    >
      {time && <span className="shrink-0 opacity-70">{time}</span>}
      <span className="truncate">{item.title}</span>
    </Link>
  )
}

// ─── Time-grid event block (week/day) ─────────────────────────────────────────
function TimeGridBlock({ item }: { item: PlannerItem }) {
  const cfg = PLANNER_MODULE_CONFIG[item.sourceModule]
  const pos = getTimeGridPosition(item)
  if (!pos) return null
  return (
    <Link
      href={item.href}
      style={{ top: pos.top, height: pos.height }}
      className={cn(
        'absolute left-0.5 right-0.5 z-10 overflow-hidden rounded border px-1.5 py-0.5 transition-opacity hover:opacity-80',
        cfg.chipCn,
      )}
    >
      <p className="truncate text-[11px] font-semibold leading-tight">{item.title}</p>
      <p className="text-[10px] opacity-70 leading-tight">
        {formatTime(item.scheduledStart)}
        {item.scheduledEnd ? ` – ${formatTime(item.scheduledEnd)}` : ''}
      </p>
    </Link>
  )
}

// ─── Day-details popover (used in month cells overflow) ───────────────────────
function DayPopover({
  day,
  items,
  onClose,
}: {
  day: Date
  items: PlannerItem[]
  onClose: () => void
}) {
  return (
    <div className="absolute z-50 left-0 top-full mt-1 w-64 rounded-xl border border-border bg-popover p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold">{format(day, "d 'de' MMMM", { locale: ptBR })}</span>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <EventChip key={item.id} item={item} onClick={onClose} />
        ))}
      </div>
    </div>
  )
}

// ─── Summary cards ────────────────────────────────────────────────────────────
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

// ─── Legacy item card (used inside Today/Focus/Overdue panels) ────────────────
function PlannerItemCard({
  item,
  compact = false,
  actions,
}: {
  item: PlannerItem
  compact?: boolean
  actions?: ReactNode
}) {
  const moduleConfig = PLANNER_MODULE_CONFIG[item.sourceModule]
  const priorityConfig = item.priority ? PLANNER_PRIORITY_CONFIG[item.priority] : null
  const primaryDate = getPrimaryDate(item)
  const overdue = isPlannerItemOverdue(item)
  const ownershipLabel =
    item.ownership === 'planner'
      ? 'Planner'
      : item.ownership === 'calendar'
        ? 'Calendario'
        : item.ownership === 'origin'
          ? 'Origem'
          : null

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
        {ownershipLabel ? <span>{ownershipLabel}</span> : null}
        {item.persisted ? <span className="text-emerald-400">Persistido</span> : null}
        {overdue ? <span className="text-red-400">Atrasada</span> : null}
      </div>
    </div>
  )

  if (actions) return content
  return (
    <Link href={item.href} className="block">
      {content}
    </Link>
  )
}

function HabitList({ habits }: { habits: PlannerHabit[] }) {
  if (habits.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum habito previsto para hoje.</p>
  }
  return (
    <div className="space-y-2">
      {habits.map((habit) => (
        <div
          key={habit.id}
          className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 p-3"
        >
          <div>
            <p className="text-sm font-medium">{habit.name}</p>
            <p className="text-xs text-muted-foreground">
              {habit.frequency} · streak {habit.streak}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'h-6',
              habit.completedToday
                ? 'border-emerald-500/40 text-emerald-400'
                : 'border-border text-muted-foreground',
            )}
          >
            {habit.completedToday ? 'Feito' : 'Pendente'}
          </Badge>
        </div>
      ))}
    </div>
  )
}

// ─── Timeline (Agenda 24h) ────────────────────────────────────────────────────
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

// ─── Today board ──────────────────────────────────────────────────────────────
export function PlannerTodayBoard({
  data,
  renderItemActions,
}: {
  data: PlannerResponse
  renderItemActions?: (item: PlannerItem) => ReactNode
}) {
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

// ─── WEEK CALENDAR (time-grid) ────────────────────────────────────────────────
export function CalendarWeekView({
  data,
  renderItemActions,
}: {
  data: PlannerResponse
  renderItemActions?: (item: PlannerItem) => ReactNode
}) {
  const days = eachDayOfInterval({
    start: new Date(data.range.from),
    end: new Date(data.range.to),
  })

  // Split items per day
  const allItems = data.items
  const byDay = days.reduce<Record<string, { timed: PlannerItem[]; allDay: PlannerItem[] }>>(
    (acc, day) => {
      const key = format(day, 'yyyy-MM-dd')
      const dayItems = allItems.filter((item) => {
        const d = getPrimaryDate(item)
        return d ? format(new Date(d), 'yyyy-MM-dd') === key : false
      })
      acc[key] = {
        timed: dayItems.filter((i) => i.scheduledStart && !i.allDay),
        allDay: dayItems.filter((i) => i.allDay || (!i.scheduledStart && i.dueDate)),
      }
      return acc
    },
    {},
  )

  const totalH = (CAL_HOUR_END - CAL_HOUR_START) * CAL_ROW_H

  return (
    <Card>
      <CardContent className="p-0 overflow-hidden rounded-xl">
        {/* Header row */}
        <div className="flex border-b border-border/60">
          <div className="w-12 shrink-0" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                'flex-1 border-l border-border/40 py-2 text-center',
                isSameDay(day, new Date()) && 'bg-primary/10',
              )}
            >
              <p className="text-[11px] uppercase text-muted-foreground">{format(day, 'EEE', { locale: ptBR })}</p>
              <p
                className={cn(
                  'text-sm font-semibold mt-0.5',
                  isSameDay(day, new Date()) && 'text-primary',
                )}
              >
                {format(day, 'd')}
              </p>
            </div>
          ))}
        </div>

        {/* All-day row */}
        <div className="flex border-b border-border/60 min-h-[2.5rem]">
          <div className="w-12 shrink-0 flex items-center justify-center">
            <p className="text-[10px] text-muted-foreground rotate-[-90deg] whitespace-nowrap">Dia todo</p>
          </div>
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const items = byDay[key]?.allDay ?? []
            return (
              <div
                key={key}
                className={cn('flex-1 border-l border-border/40 p-1 space-y-0.5', isSameDay(day, new Date()) && 'bg-primary/5')}
              >
                {items.slice(0, 3).map((item) => (
                  <EventChip key={item.id} item={item} />
                ))}
                {items.length > 3 && (
                  <p className="text-[10px] text-muted-foreground px-1">+{items.length - 3}</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <ScrollArea className="h-[560px]">
          <div className="flex">
            {/* Time labels */}
            <div className="w-12 shrink-0" style={{ height: totalH }}>
              {Array.from({ length: CAL_HOUR_END - CAL_HOUR_START }, (_, i) => (
                <div
                  key={i}
                  style={{ height: CAL_ROW_H }}
                  className="flex items-start justify-end pr-2 pt-1"
                >
                  <span className="text-[10px] text-muted-foreground">
                    {String(CAL_HOUR_START + i).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const timedItems = byDay[key]?.timed ?? []

              return (
                <div
                  key={key}
                  className={cn(
                    'flex-1 relative border-l border-border/40',
                    isSameDay(day, new Date()) && 'bg-primary/[0.03]',
                  )}
                  style={{ height: totalH }}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: CAL_HOUR_END - CAL_HOUR_START }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-border/30"
                      style={{ top: i * CAL_ROW_H }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {isSameDay(day, new Date()) && (() => {
                    const now = new Date()
                    const nowH = now.getHours() + now.getMinutes() / 60
                    if (nowH >= CAL_HOUR_START && nowH < CAL_HOUR_END) {
                      return (
                        <div
                          className="absolute left-0 right-0 z-20 flex items-center"
                          style={{ top: (nowH - CAL_HOUR_START) * CAL_ROW_H }}
                        >
                          <div className="h-2 w-2 rounded-full bg-red-500 -ml-1" />
                          <div className="h-px flex-1 bg-red-500" />
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Timed events */}
                  {timedItems.map((item) => {
                    if (renderItemActions) {
                      const pos = getTimeGridPosition(item)
                      if (!pos) return null
                      const cfg = PLANNER_MODULE_CONFIG[item.sourceModule]
                      return (
                        <div
                          key={item.id}
                          style={{ top: pos.top, height: pos.height }}
                          className={cn(
                            'absolute left-0.5 right-0.5 z-10 overflow-hidden rounded border px-1.5 py-0.5',
                            cfg.chipCn,
                          )}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold leading-tight">{item.title}</p>
                              <p className="text-[10px] opacity-70 leading-tight">
                                {formatTime(item.scheduledStart)}
                                {item.scheduledEnd ? ` – ${formatTime(item.scheduledEnd)}` : ''}
                              </p>
                            </div>
                            <div className="shrink-0">{renderItemActions(item)}</div>
                          </div>
                        </div>
                      )
                    }
                    return <TimeGridBlock key={item.id} item={item} />
                  })}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

/** Backwards-compatible wrapper used in Dashboard/Tarefas */
export function PlannerWeekBoard({
  data,
  renderItemActions,
}: {
  data: PlannerResponse
  renderItemActions?: (item: PlannerItem) => ReactNode
}) {
  return <CalendarWeekView data={data} renderItemActions={renderItemActions} />
}

// ─── MONTH CALENDAR ────────────────────────────────────────────────────────────
export function CalendarMonthView({
  data,
  renderItemActions,
}: {
  data: PlannerResponse
  renderItemActions?: (item: PlannerItem) => ReactNode
}) {
  const [popoverDay, setPopoverDay] = useState<string | null>(null)

  const rangeStart = startOfWeek(startOfMonth(new Date(data.range.from)), { weekStartsOn: 0 })
  const rangeEnd = endOfWeek(endOfMonth(new Date(data.range.from)), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  const groupedItems = groupItemsByDay(data.items)
  const monthDate = new Date(data.range.from)

  const MAX_VISIBLE = 3

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {format(monthDate, 'MMMM yyyy', { locale: ptBR })}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Visao mensal — tudo que voce tem agendado, metas com prazo, habitos e tarefas.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((label) => (
            <div key={label} className="py-1">{label}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayItems = groupedItems[key] ?? []
            const isCurrentMonth = isSameMonth(day, monthDate)
            const isToday = isSameDay(day, new Date())
            const visible = dayItems.slice(0, MAX_VISIBLE)
            const overflow = dayItems.length - MAX_VISIBLE
            const isOpen = popoverDay === key

            return (
              <div
                key={key}
                className={cn(
                  'relative min-h-[7rem] bg-card p-1.5',
                  !isCurrentMonth && 'bg-muted/20',
                  isToday && 'bg-primary/[0.07]',
                )}
              >
                {/* Date number */}
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      isToday && 'bg-primary text-primary-foreground',
                      !isToday && !isCurrentMonth && 'text-muted-foreground/40',
                      !isToday && isCurrentMonth && 'text-foreground',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Event chips */}
                <div className="space-y-0.5">
                  {visible.map((item) =>
                    renderItemActions ? (
                      <div key={item.id} className="flex items-center gap-0.5">
                        <div className="flex-1 min-w-0">
                          <EventChip item={item} />
                        </div>
                        <div className="shrink-0">{renderItemActions(item)}</div>
                      </div>
                    ) : (
                      <EventChip key={item.id} item={item} />
                    ),
                  )}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => setPopoverDay(isOpen ? null : key)}
                      className="w-full rounded px-1 py-0.5 text-left text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      +{overflow} mais
                    </button>
                  )}
                </div>

                {/* Overflow popover */}
                {isOpen && (
                  <DayPopover
                    day={day}
                    items={dayItems}
                    onClose={() => setPopoverDay(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/** Backwards-compatible wrapper */
export function PlannerMonthBoard({
  data,
  renderItemActions,
}: {
  data: PlannerResponse
  renderItemActions?: (item: PlannerItem) => ReactNode
}) {
  return <CalendarMonthView data={data} renderItemActions={renderItemActions} />
}
