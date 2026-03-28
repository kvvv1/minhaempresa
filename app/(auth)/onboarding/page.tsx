'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Building2, ChevronRight, ChevronLeft, Check, Loader2, Users, Target, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface EmployeeConfig {
  role: string
  name: string
  personality: string
}

const defaultEmployees: EmployeeConfig[] = [
  { role: 'CHIEF_OF_STAFF', name: 'Leo', personality: 'Proativo, visionário e sempre otimista. Coordena tudo com maestria.' },
  { role: 'CFO', name: 'Carlos', personality: 'Analítico, direto e não aceita desculpas sobre dinheiro.' },
  { role: 'COO', name: 'Ana', personality: 'Disciplinada, focada em resultados e amante de processos.' },
  { role: 'CHRO', name: 'Pedro', personality: 'Empático, atento e sempre lembrando das pessoas que importam.' },
  { role: 'RD', name: 'Sofia', personality: 'Curiosa, criativa e constantemente desafiando limites.' },
  { role: 'PERSONAL_TRAINER', name: 'Bruno', personality: 'Motivador, científico e focado em performance máxima.' },
  { role: 'MENTOR_ACADEMICO', name: 'Juliana', personality: 'Metódica, encorajadora e orientada a resultados acadêmicos.' },
  { role: 'PROJECT_MANAGER', name: 'Rafael', personality: 'Sistemático, orientado a entrega e não tolera bloqueios.' },
]

const roleLabels: Record<string, string> = {
  CHIEF_OF_STAFF: 'Chief of Staff',
  CFO: 'Diretor Financeiro',
  COO: 'Diretora de Operações',
  CHRO: 'Diretor de RH',
  RD: 'Diretora de P&D',
  PERSONAL_TRAINER: 'Personal Trainer',
  MENTOR_ACADEMICO: 'Mentora Acadêmica',
  PROJECT_MANAGER: 'Gerente de Projetos',
}

const suggestedValues = [
  'Saúde', 'Família', 'Liberdade', 'Crescimento', 'Aprendizado',
  'Dinheiro', 'Impacto', 'Disciplina', 'Criatividade', 'Espiritualidade',
  'Aventura', 'Segurança', 'Amor', 'Propósito', 'Excelência',
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { update } = useSession()

  const [companyName, setCompanyName] = useState('')
  const [mission, setMission] = useState('')
  const [selectedValues, setSelectedValues] = useState<string[]>([])
  const [employees, setEmployees] = useState<EmployeeConfig[]>(defaultEmployees)

  const totalSteps = 4
  const progress = (step / totalSteps) * 100

  function toggleValue(value: string) {
    setSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  function updateEmployee(index: number, field: keyof EmployeeConfig, value: string) {
    setEmployees((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)))
  }

  async function handleFinish() {
    setLoading(true)
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName || 'Minha Vida S.A.',
          mission,
          values: selectedValues,
          employees,
        }),
      })

      if (!res.ok) throw new Error()

      await update({ onboarded: true })
      router.push('/')
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Bem-vindo ao Vida S.A.</h1>
          <p className="text-muted-foreground">Vamos fundar sua empresa pessoal</p>
        </div>

        <Progress value={progress} className="h-2" />

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Sua Empresa
              </CardTitle>
              <CardDescription>Como será chamada a empresa da sua vida?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da empresa</Label>
                <Input
                  placeholder="João Silva S.A."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Pode ser seu nome, apelido, ou algo que te inspire</p>
              </div>
              <div className="space-y-2">
                <Label>Missão pessoal</Label>
                <Textarea
                  placeholder="Ex: Construir uma vida com propósito, impacto e liberdade financeira..."
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Seus Valores
              </CardTitle>
              <CardDescription>Escolha os valores que guiam sua vida (mínimo 3)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {suggestedValues.map((value) => (
                  <Badge
                    key={value}
                    variant={selectedValues.includes(value) ? 'default' : 'outline'}
                    className="cursor-pointer text-sm py-1 px-3"
                    onClick={() => toggleValue(value)}
                  >
                    {selectedValues.includes(value) && <Check className="w-3 h-3 mr-1" />}
                    {value}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {selectedValues.length} valor(es) selecionado(s)
              </p>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Seus Funcionários IA
              </CardTitle>
              <CardDescription>Conheça e personalize sua equipe de inteligência artificial</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {employees.map((emp, index) => (
                <div key={emp.role} className="p-4 rounded-lg border border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-primary uppercase tracking-wide">
                      {roleLabels[emp.role]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={emp.name}
                        onChange={(e) => updateEmployee(index, 'name', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Personalidade</Label>
                      <Input
                        value={emp.personality}
                        onChange={(e) => updateEmployee(index, 'personality', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Tudo pronto!
              </CardTitle>
              <CardDescription>Sua empresa está configurada. Vamos lançar!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-sm font-medium">{companyName || 'Minha Vida S.A.'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{mission || 'Missão a definir'}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map((v) => (
                    <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {employees.map((emp) => (
                    <div key={emp.role} className="p-2 rounded bg-muted/20 border border-border/30">
                      <p className="text-xs font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{roleLabels[emp.role]}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>

          {step < totalSteps ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 2 && selectedValues.length < 3}
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Lançar minha empresa!
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
