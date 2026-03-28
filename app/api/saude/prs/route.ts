import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const exercises = await prisma.workoutExercise.findMany({
    where: { workout: { userId: session.user.id } },
    include: { workout: { select: { date: true } } },
  })

  // Group by exercise name and find PRs
  const prMap: Record<string, { maxLoadKg: number; maxReps: number; date: string; workoutDate: string }> = {}

  for (const ex of exercises) {
    let sets: { reps?: number; loadKg?: number }[] = []
    try { sets = JSON.parse(ex.sets) } catch {}

    for (const set of sets) {
      const load = set.loadKg ?? 0
      const reps = set.reps ?? 0
      const existing = prMap[ex.name]

      if (!existing || load > existing.maxLoadKg || (load === existing.maxLoadKg && reps > existing.maxReps)) {
        prMap[ex.name] = {
          maxLoadKg: load,
          maxReps: reps,
          date: ex.workout.date.toISOString(),
          workoutDate: ex.workout.date.toISOString(),
        }
      }
    }
  }

  const prs = Object.entries(prMap)
    .map(([name, pr]) => ({ name, ...pr }))
    .filter((pr) => pr.maxLoadKg > 0 || pr.maxReps > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json(prs)
}
