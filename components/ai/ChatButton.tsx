'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { EmployeeChat } from './EmployeeChat'

interface ChatButtonProps {
  employeeRole: string
  employeeName: string
  moduleData?: any
  variant?: 'default' | 'outline' | 'ghost'
}

export function ChatButton({ employeeRole, employeeName, moduleData, variant = 'outline' }: ChatButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        <MessageSquare className="w-4 h-4 mr-2" />
        Falar com {employeeName}
      </Button>
      <EmployeeChat
        open={open}
        onClose={() => setOpen(false)}
        employeeRole={employeeRole}
        employeeName={employeeName}
        moduleData={moduleData}
      />
    </>
  )
}
