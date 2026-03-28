import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().trim().max(255),
  password: z.string().min(8).max(72),
})

export async function POST(req: Request) {
  try {
    const parsed = registerSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }

    const { name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email ja cadastrado' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    await prisma.user.create({
      data: { name, email, password: hashed },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
