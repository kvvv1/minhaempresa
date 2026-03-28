import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "d 'de' MMMM", { locale: ptBR })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, "d MMM 'às' HH:mm", { locale: ptBR })
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR })
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

export function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 60) return 'bg-yellow-400'
  if (score >= 40) return 'bg-orange-400'
  return 'bg-red-400'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const EMPLOYEE_COLORS: Record<string, string> = {
  CFO: 'bg-blue-500',
  COO: 'bg-purple-500',
  CHRO: 'bg-pink-500',
  RD: 'bg-amber-500',
  CHIEF_OF_STAFF: 'bg-indigo-500',
  PERSONAL_TRAINER: 'bg-emerald-500',
  MENTOR_ACADEMICO: 'bg-violet-500',
  PROJECT_MANAGER: 'bg-orange-500',
}

export const EMPLOYEE_ROLE_LABELS: Record<string, string> = {
  CFO: 'Diretor Financeiro',
  COO: 'Diretora de Operações',
  CHRO: 'Diretor de RH',
  RD: 'Diretora de P&D',
  CHIEF_OF_STAFF: 'Chief of Staff',
  PERSONAL_TRAINER: 'Personal Trainer',
  MENTOR_ACADEMICO: 'Mentora Acadêmica',
  PROJECT_MANAGER: 'Gerente de Projetos',
}

export const MODULE_LABELS: Record<string, string> = {
  financeiro: 'Financeiro',
  metas: 'Metas',
  rotina: 'Rotina',
  relacionamentos: 'Relacionamentos',
  desenvolvimento: 'Desenvolvimento',
  diario: 'Diário',
  saude: 'Saúde & Fitness',
  nutricao: 'Nutrição',
  faculdade: 'Faculdade',
  trabalho: 'Trabalho',
  tarefas: 'Tarefas',
}
