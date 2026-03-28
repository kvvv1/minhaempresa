'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { formatRelative } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

const typeColors: Record<string, string> = {
  INFO: 'bg-blue-500',
  WARNING: 'bg-yellow-500',
  ALERT: 'bg-red-500',
  SUCCESS: 'bg-emerald-500',
  AI_INSIGHT: 'bg-purple-500',
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchNotifications() {
    const res = await fetch('/api/notifications')
    if (res.ok) {
      const data = await res.json()
      setNotifications(data)
    }
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (!unreadIds.length) return

    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: unreadIds }),
    })

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markAllRead() }}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-primary">
                {unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">{unreadCount} não lidas</span>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'px-4 py-3 space-y-1',
                    !n.read && 'bg-muted/20'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', typeColors[n.type] || 'bg-primary')} />
                    <p className="text-sm font-medium">{n.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-4">{n.message}</p>
                  <p className="text-xs text-muted-foreground/60 pl-4">{formatRelative(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
