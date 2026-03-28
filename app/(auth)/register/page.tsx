'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Loader2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function getStrength(p: string) {
  const checks = [p.length >= 8, /[A-Z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)]
  return checks.filter(Boolean).length
}

const REQUIREMENTS = [
  { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Número', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Símbolo (!@#...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

const STRENGTH_LABELS = ['', 'Fraca', 'Razoável', 'Boa', 'Forte']
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500']

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const strength = getStrength(password)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error || 'Tente novamente.')
    } else {
      toast.success('Conta criada! Faça login para continuar.')
      router.push('/login?registered=true')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Vida S.A.</h1>
          <p className="text-muted-foreground text-sm">Funde sua empresa pessoal</p>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Criar conta</CardTitle>
            <CardDescription>Comece a gerenciar sua vida como uma empresa</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome (CEO)</Label>
                <Input
                  id="name"
                  placeholder="João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                {password.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-1 h-1.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex-1 rounded-full transition-all',
                            i <= strength ? STRENGTH_COLORS[strength] : 'bg-muted'
                          )}
                        />
                      ))}
                    </div>
                    <p className={cn('text-xs', strength >= 3 ? 'text-emerald-500' : strength >= 2 ? 'text-yellow-500' : 'text-red-500')}>
                      {STRENGTH_LABELS[strength]}
                    </p>
                    <ul className="space-y-1">
                      {REQUIREMENTS.map((r) => {
                        const ok = r.test(password)
                        return (
                          <li key={r.label} className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-emerald-500' : 'text-muted-foreground')}>
                            {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {r.label}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fundar minha empresa
              </Button>
              <p className="text-sm text-muted-foreground">
                Já tem conta?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Entrar
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
