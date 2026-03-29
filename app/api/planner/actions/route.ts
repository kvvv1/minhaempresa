import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncPlannerItemsFromOrigin } from '@/lib/planner-persistence'
import { applyPlannerOriginAction, canPlannerSourceMutate, getPlannerWritableSource, setPlannerOriginCompletion } from '@/lib/planner-origin'

type PlannerQuickAction = 'move-to-today' | 'move-to-week' | 'defer' | 'complete' | 'reopen'

function isPlannerQuickAction(value: unknown): value is PlannerQuickAction {
  return value === 'move-to-today' || value === 'move-to-week' || value === 'defer' || value === 'complete' || value === 'reopen'
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    if (!isPlannerQuickAction(data.action)) {
      return NextResponse.json({ error: 'Acao invalida' }, { status: 400 })
    }

    if (!canPlannerSourceMutate(data.sourceType) || typeof data.sourceId !== 'string') {
      return NextResponse.json({ error: 'Origem ainda nao suportada para mutacao' }, { status: 400 })
    }

    const source = await getPlannerWritableSource(data.sourceType, data.sourceId, session.user.id)

    if (!source) {
      return NextResponse.json({ error: 'Origem nao encontrada' }, { status: 404 })
    }

    if (data.action === 'complete' || data.action === 'reopen') {
      const updated = await setPlannerOriginCompletion({
        sourceType: source.sourceType,
        sourceId: source.id,
        userId: session.user.id,
        completed: data.action === 'complete',
      })

      if (!updated) {
        return NextResponse.json({ error: 'Origem nao encontrada' }, { status: 404 })
      }

      const refreshedSource = await getPlannerWritableSource(source.sourceType, source.id, session.user.id)
      if (refreshedSource) {
        await syncPlannerItemsFromOrigin({
          userId: session.user.id,
          source: refreshedSource,
        })
      }

      return NextResponse.json(updated)
    }

    const updated = await applyPlannerOriginAction({
      sourceType: source.sourceType,
      sourceId: source.id,
      userId: session.user.id,
      action: data.action,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Origem nao encontrada' }, { status: 404 })
    }

    const refreshedSource = await getPlannerWritableSource(source.sourceType, source.id, session.user.id)
    if (refreshedSource) {
      await syncPlannerItemsFromOrigin({
        userId: session.user.id,
        source: refreshedSource,
      })
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Erro ao executar acao do planner' }, { status: 500 })
  }
}
