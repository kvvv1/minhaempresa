import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entries = await prisma.diaryEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    take: 30,
  })

  if (entries.length < 3) {
    return NextResponse.json({
      error: 'few_entries',
      message: `Escreva pelo menos 3 entradas para receber uma análise. Você tem ${entries.length}.`,
    })
  }

  // Deterministic stats
  const moods = entries.filter((e) => e.mood !== null).map((e) => e.mood as number)
  const avgMood = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null

  const recentMoods = moods.slice(0, 7)
  const olderMoods = moods.slice(7, 14)
  const recentAvg = recentMoods.length > 0 ? recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length : null
  const olderAvg = olderMoods.length > 0 ? olderMoods.reduce((a, b) => a + b, 0) / olderMoods.length : null
  let moodTrend: 'up' | 'down' | 'stable' = 'stable'
  if (recentAvg !== null && olderAvg !== null) {
    if (recentAvg > olderAvg + 0.5) moodTrend = 'up'
    else if (recentAvg < olderAvg - 0.5) moodTrend = 'down'
  }

  const tagCounts: Record<string, number> = {}
  entries.forEach((e) => {
    try {
      const tags = JSON.parse(e.tags || '[]') as string[]
      tags.forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1 })
    } catch {}
  })
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }))

  const dates = entries.map((e) => new Date(e.date).toDateString())
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (dates.includes(d.toDateString())) streak++
    else break
  }

  // AI structured analysis
  const entriesText = entries
    .slice(0, 15)
    .map((e) => `[${new Date(e.date).toLocaleDateString('pt-BR')}] Humor: ${e.mood ?? '?'}/10\n${e.content.slice(0, 300)}`)
    .join('\n---\n')

  let aiAnalysis = { themes: [] as string[], moodPattern: '', surprisingObservation: '', practicalSuggestion: '' }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Analise estas entradas de diário e responda SOMENTE com JSON válido:
{"themes":["tema1","tema2","tema3"],"moodPattern":"padrão de humor em 1 frase","surprisingObservation":"observação surpreendente em 1-2 frases","practicalSuggestion":"sugestão prática em 1-2 frases"}

Entradas:\n${entriesText}`,
      }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const match = text.match(/\{[\s\S]*\}/)
    if (match) aiAnalysis = { ...aiAnalysis, ...JSON.parse(match[0]) }
  } catch {}

  return NextResponse.json({
    stats: { totalEntries: entries.length, avgMood: avgMood !== null ? Math.round(avgMood * 10) / 10 : null, moodTrend, streak, topTags },
    ...aiAnalysis,
  })
}
