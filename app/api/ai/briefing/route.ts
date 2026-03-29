import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDailyBriefing, saveManualBriefing, setBriefingCollapsed } from '@/lib/briefing'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await getDailyBriefing(session.user.id)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar briefing' }, { status: 500 })
  }
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await getDailyBriefing(session.user.id, true)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar briefing' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!content) {
      return NextResponse.json({ error: 'Conteudo invalido' }, { status: 400 })
    }

    const result = await saveManualBriefing(session.user.id, content)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar briefing' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    if (typeof body?.collapsed !== 'boolean') {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }

    const result = await setBriefingCollapsed(session.user.id, body.collapsed)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar exibicao do briefing' }, { status: 500 })
  }
}
