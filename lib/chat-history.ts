import { EMPLOYEE_ROLE_LABELS } from './utils'

export interface FlatHistoryMessage {
  role: string
  content: string
  employeeRole?: string
}

const SUMMARY_LINE_LIMIT = 160
const SUMMARY_SAMPLE_SIZE = 12

function truncateText(value: string, limit: number) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1).trimEnd()}…`
}

function normalizeMessage(message: FlatHistoryMessage): FlatHistoryMessage | null {
  const content = message.content.trim()
  if (!content) return null

  return {
    role: message.role,
    content,
    employeeRole: message.employeeRole?.trim() || undefined,
  }
}

function getSpeakerLabel(message: FlatHistoryMessage) {
  if (message.role === 'user') return 'CEO'
  if (message.employeeRole) return EMPLOYEE_ROLE_LABELS[message.employeeRole] ?? message.employeeRole
  return 'Assistente'
}

function buildSummaryContent(messages: FlatHistoryMessage[]) {
  const sampled = messages.slice(-SUMMARY_SAMPLE_SIZE)
  const lines = sampled.map((message) => {
    const speaker = getSpeakerLabel(message)
    return `- ${speaker}: ${truncateText(message.content.replace(/\s+/g, ' '), SUMMARY_LINE_LIMIT)}`
  })

  return [
    'Resumo do contexto anterior desta conversa. Use isso como memoria e nao repita tudo literalmente.',
    ...lines,
  ].join('\n')
}

export function compressFlatHistory(messages: FlatHistoryMessage[], maxMessages: number) {
  const normalized = messages
    .map(normalizeMessage)
    .filter((message): message is FlatHistoryMessage => Boolean(message))

  if (normalized.length <= maxMessages) return normalized

  const recentWindow = Math.max(6, Math.floor(maxMessages * 0.6))
  const recentMessages = normalized.slice(-recentWindow)
  const omittedMessages = normalized.slice(0, -recentWindow)

  return [
    {
      role: 'user',
      content: buildSummaryContent(omittedMessages),
    },
    ...recentMessages,
  ].slice(-maxMessages)
}
