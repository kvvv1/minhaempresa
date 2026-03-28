'use client'

import { useEffect } from 'react'

export function EmployeeAutoSeed() {
  useEffect(() => {
    fetch('/api/employees/seed', { method: 'POST' }).catch(() => {})
  }, [])

  return null
}
