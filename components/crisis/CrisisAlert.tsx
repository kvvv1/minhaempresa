'use client'

import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X } from 'lucide-react'
import Link from 'next/link'

interface CrisisAlertProps {
  scores: Record<string, number>
}

const areaLabels: Record<string, string> = {
  financeiro: 'Financeiro',
  rotina: 'Rotina',
  relacionamentos: 'Relacionamentos',
  desenvolvimento: 'Desenvolvimento',
  metas: 'Metas',
  saude: 'Saúde & Fitness',
  nutricao: 'Nutrição',
  faculdade: 'Faculdade',
  trabalho: 'Trabalho',
  tarefas: 'Tarefas',
  diario: 'Diário CEO',
}

export function CrisisAlert({ scores }: CrisisAlertProps) {
  const [dismissed, setDismissed] = useState(false)

  const redAreas = Object.entries(scores).filter(([_, score]) => score < 30)

  if (redAreas.length < 2 || dismissed) return null

  return (
    <Alert className="border-red-500/50 bg-red-500/10">
      <AlertTriangle className="h-4 w-4 text-red-400" />
      <AlertTitle className="text-red-400">
        <div className="flex items-center justify-between">
          <span>Modo Crise Ativado</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/20 -mr-1"
            onClick={() => setDismissed(true)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </AlertTitle>
      <AlertDescription className="text-sm space-y-2 mt-1">
        <p className="text-red-300/80">
          {redAreas.length} {redAreas.length === 1 ? 'área crítica detectada' : 'áreas críticas detectadas'}:{' '}
          <span className="font-medium text-red-300">
            {redAreas.map(([key]) => areaLabels[key] || key).join(', ')}
          </span>
        </p>
        <Link href="/board-meeting">
          <Button size="sm" variant="destructive" className="mt-2">
            Convocar reunião de emergência
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  )
}
