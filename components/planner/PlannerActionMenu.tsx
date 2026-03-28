'use client'

import { Calendar, CalendarDays, CheckCircle2, MoreHorizontal, RotateCcw, TimerReset } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { PlannerItem } from '@/lib/planner'

export type PlannerQuickAction = 'move-to-today' | 'move-to-week' | 'defer' | 'complete' | 'reopen'

function isTaskSource(item: PlannerItem) {
  return item.sourceType === 'gtdTask' || item.sourceType === 'routineTask' || item.sourceType === 'projectTask' || item.sourceType === 'assignment'
}

function canOpenSchedule(item: PlannerItem) {
  return isTaskSource(item) || item.sourceType === 'calendarEvent' || Boolean(item.scheduleEventId)
}

function getScheduleLabel(item: PlannerItem) {
  if (item.sourceType === 'calendarEvent' || item.scheduleMode === 'manual') return 'Editar bloco'
  if (item.scheduleEventId) return 'Reagendar bloco'
  return 'Agendar bloco'
}

function isCompletedTask(item: PlannerItem) {
  return item.status === 'COMPLETED' || item.status === 'DONE' || item.status === 'SUBMITTED' || item.status === 'GRADED'
}

export function PlannerActionMenu({
  item,
  onQuickAction,
  onSchedule,
}: {
  item: PlannerItem
  onQuickAction: (item: PlannerItem, action: PlannerQuickAction) => void
  onSchedule: (item: PlannerItem) => void
}) {
  const taskSource = isTaskSource(item)
  const quickPlanEnabled = taskSource && !item.scheduleEventId
  const completionEnabled = item.kind === 'task' && taskSource
  const scheduleEnabled = canOpenSchedule(item)
  const completed = isCompletedTask(item)

  if (!quickPlanEnabled && !scheduleEnabled && !completionEnabled) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {scheduleEnabled ? (
          <DropdownMenuItem onClick={() => onSchedule(item)}>
            <CalendarDays className="mr-2 h-4 w-4" />
            {getScheduleLabel(item)}
          </DropdownMenuItem>
        ) : null}

        {completionEnabled || quickPlanEnabled ? <DropdownMenuSeparator /> : null}

        {completionEnabled ? (
          <DropdownMenuItem onClick={() => onQuickAction(item, completed ? 'reopen' : 'complete')}>
            {completed ? <RotateCcw className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {completed ? 'Reabrir item' : 'Concluir item'}
          </DropdownMenuItem>
        ) : null}

        {completionEnabled && quickPlanEnabled ? <DropdownMenuSeparator /> : null}

        {quickPlanEnabled ? (
          <DropdownMenuItem onClick={() => onQuickAction(item, 'move-to-today')}>
            <Calendar className="mr-2 h-4 w-4" />
            Jogar para hoje
          </DropdownMenuItem>
        ) : null}

        {quickPlanEnabled ? (
          <DropdownMenuItem onClick={() => onQuickAction(item, 'move-to-week')}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Mover para semana
          </DropdownMenuItem>
        ) : null}

        {quickPlanEnabled ? (
          <DropdownMenuItem onClick={() => onQuickAction(item, 'defer')}>
            <TimerReset className="mr-2 h-4 w-4" />
            Adiar 1 dia
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
