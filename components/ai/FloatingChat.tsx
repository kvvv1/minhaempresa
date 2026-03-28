'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { EmployeeChat } from './EmployeeChat'
import { cn, EMPLOYEE_COLORS, EMPLOYEE_ROLE_LABELS } from '@/lib/utils'

const ROUTE_EMPLOYEE: Record<string, string> = {
  '/dashboard': 'CHIEF_OF_STAFF',
  '/financeiro': 'CFO',
  '/metas': 'CHIEF_OF_STAFF',
  '/rotina': 'COO',
  '/relacionamentos': 'CHRO',
  '/desenvolvimento': 'RD',
  '/diario': 'CHIEF_OF_STAFF',
}

interface EmployeeInfo {
  name: string
  role: string
}

export function FloatingChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null)

  const role = ROUTE_EMPLOYEE[pathname]

  useEffect(() => {
    if (!role) return
    fetch('/api/employees')
      .then((r) => r.json())
      .then((list: EmployeeInfo[]) => {
        const found = list.find((e) => e.role === role)
        if (found) setEmployee(found)
      })
      .catch(() => {})
  }, [role])

  if (!role || !employee) return null

  const colorClass = EMPLOYEE_COLORS[employee.role] ?? 'bg-primary'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2.5',
          'rounded-full px-4 py-3 shadow-xl text-white text-sm font-medium',
          'transition-all duration-200 hover:scale-105 hover:shadow-2xl active:scale-95',
          colorClass
        )}
        title={`Falar com ${employee.name} · ${EMPLOYEE_ROLE_LABELS[employee.role]}`}
      >
        <MessageSquare className="w-4 h-4" />
        <span>{employee.name}</span>
      </button>

      <EmployeeChat
        open={open}
        onClose={() => setOpen(false)}
        employeeRole={employee.role}
        employeeName={employee.name}
      />
    </>
  )
}
