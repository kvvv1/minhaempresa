'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Save, Plus, X, Loader2, Bell, BellOff, User, Building2, Target, Users2 } from 'lucide-react'
import { toast } from 'sonner'
import { EMPLOYEE_COLORS, EMPLOYEE_ROLE_LABELS, getInitials, cn } from '@/lib/utils'

interface Employee {
  id: string
  name: string
  role: string
  personality: string
}

interface UserData {
  id: string
  name: string
  email: string
  companyName: string | null
  mission: string | null
  values: string[]
  employees: Employee[]
}

interface NotificationPrefs {
  dailyBriefing: boolean
  weeklyReport: boolean
  goalDeadlines: boolean
  followupReminders: boolean
  crisisAlerts: boolean
}

export default function ConfiguracoesPage() {
  const { data: session, update } = useSession()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingEmployee, setSavingEmployee] = useState<string | null>(null)

  // Profile fields
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [mission, setMission] = useState('')

  // Values
  const [values, setValues] = useState<string[]>([])
  const [newValue, setNewValue] = useState('')

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([])

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    dailyBriefing: true,
    weeklyReport: true,
    goalDeadlines: true,
    followupReminders: true,
    crisisAlerts: true,
  })

  useEffect(() => {
    fetchUserData()
    fetchNotifPrefs()
  }, [])

  async function fetchNotifPrefs() {
    try {
      const res = await fetch('/api/notifications/preferences')
      if (res.ok) setNotifPrefs(await res.json())
    } catch {}
  }

  async function fetchUserData() {
    setLoading(true)
    try {
      const res = await fetch('/api/user')
      if (res.ok) {
        const data: UserData = await res.json()
        setUserData(data)
        setName(data.name || '')
        setCompanyName(data.companyName || '')
        setMission(data.mission || '')
        setValues(Array.isArray(data.values) ? data.values : [])
        setEmployees(data.employees || [])
      }
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, companyName, mission, values }),
      })

      if (res.ok) {
        toast.success('Perfil salvo com sucesso')
        await update({ name })
      } else {
        toast.error('Erro ao salvar perfil')
      }
    } catch {
      toast.error('Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  async function saveEmployee(employee: Employee) {
    setSavingEmployee(employee.id)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: employee.name, personality: employee.personality }),
      })

      if (res.ok) {
        toast.success(`${employee.name} atualizado`)
      } else {
        toast.error('Erro ao salvar funcionário')
      }
    } catch {
      toast.error('Erro ao salvar funcionário')
    } finally {
      setSavingEmployee(null)
    }
  }

  function addValue() {
    const trimmed = newValue.trim()
    if (!trimmed || values.includes(trimmed)) return
    setValues(prev => [...prev, trimmed])
    setNewValue('')
  }

  function removeValue(value: string) {
    setValues(prev => prev.filter(v => v !== value))
  }

  function updateEmployee(id: string, field: 'name' | 'personality', value: string) {
    setEmployees(prev =>
      prev.map(emp => emp.id === id ? { ...emp, [field]: value } : emp)
    )
  }

  function toggleNotif(key: keyof NotificationPrefs) {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Gerencie seu perfil, funcionários e preferências</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-primary" />
            Perfil
          </CardTitle>
          <CardDescription>Informações pessoais e da sua empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {getInitials(name || session?.user?.email || 'U')}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{name || 'Sem nome'}</p>
              <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={session?.user?.email || ''}
                disabled
                className="opacity-60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName" className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Nome da empresa pessoal
            </Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Ex: João Silva S.A."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mission" className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Missão pessoal
            </Label>
            <Textarea
              id="mission"
              value={mission}
              onChange={e => setMission(e.target.value)}
              placeholder="Qual é sua missão de vida?"
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Values Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-primary" />
            Valores
          </CardTitle>
          <CardDescription>Os princípios que guiam suas decisões</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {values.map(value => (
              <Badge
                key={value}
                variant="outline"
                className="gap-1.5 px-3 py-1 text-sm font-normal group hover:border-destructive/50 hover:text-destructive transition-colors"
              >
                {value}
                <button
                  onClick={() => removeValue(value)}
                  className="opacity-40 group-hover:opacity-100 transition-opacity hover:text-destructive"
                  type="button"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {values.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum valor cadastrado ainda.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Adicionar valor (ex: Integridade)"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addValue()}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={addValue}
              disabled={!newValue.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Profile Button */}
      <div className="flex justify-end">
        <Button onClick={saveProfile} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar perfil e valores
        </Button>
      </div>

      <Separator />

      {/* Employees Section */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users2 className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold">Funcionários de IA</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Personalize o nome e a personalidade de cada funcionário
        </p>

        <div className="space-y-4">
          {employees.map(employee => {
            const colorClass = EMPLOYEE_COLORS[employee.role] || 'bg-primary'
            const roleLabel = EMPLOYEE_ROLE_LABELS[employee.role] || employee.role
            const isSaving = savingEmployee === employee.id

            return (
              <Card key={employee.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10 shrink-0 mt-1">
                      <AvatarFallback className={cn(colorClass, 'text-white text-sm font-semibold')}>
                        {getInitials(employee.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {roleLabel}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Nome</Label>
                          <Input
                            value={employee.name}
                            onChange={e => updateEmployee(employee.id, 'name', e.target.value)}
                            placeholder="Nome do funcionário"
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-1">
                          <Label className="text-xs text-muted-foreground">Personalidade</Label>
                          <Input
                            value={employee.personality}
                            onChange={e => updateEmployee(employee.id, 'personality', e.target.value)}
                            placeholder="Descreva a personalidade..."
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => saveEmployee(employee)}
                      disabled={isSaving}
                      className="shrink-0 mt-1"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {employees.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum funcionário cadastrado. Complete o onboarding para criar sua equipe.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Separator />

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4 text-primary" />
            Notificações
          </CardTitle>
          <CardDescription>Configure quais alertas e lembretes você quer receber</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            {
              key: 'dailyBriefing' as const,
              label: 'Briefing matinal',
              description: 'Resumo do dia preparado pelo seu Chief of Staff',
            },
            {
              key: 'weeklyReport' as const,
              label: 'Relatório semanal',
              description: 'Análise completa da semana',
            },
            {
              key: 'goalDeadlines' as const,
              label: 'Prazos de metas',
              description: 'Alertas quando metas estão próximas do prazo',
            },
            {
              key: 'followupReminders' as const,
              label: 'Lembretes de follow-up',
              description: 'Avisos sobre contatos que precisam de atenção',
            },
            {
              key: 'crisisAlerts' as const,
              label: 'Alertas de crise',
              description: 'Notificação quando múltiplas áreas estão críticas',
            },
          ].map((item, idx, arr) => (
            <div key={item.key}>
              <div className="flex items-center justify-between py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotif(item.key)}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    notifPrefs[item.key] ? 'bg-primary' : 'bg-muted'
                  )}
                  role="switch"
                  aria-checked={notifPrefs[item.key]}
                >
                  <span
                    className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
                      notifPrefs[item.key] ? 'translate-x-4.5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>
              {idx < arr.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button
          onClick={async () => {
            try {
              const res = await fetch('/api/notifications/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notifPrefs),
              })
              if (res.ok) toast.success('Preferências de notificação salvas')
              else toast.error('Erro ao salvar preferências')
            } catch {
              toast.error('Erro ao salvar preferências')
            }
          }}
          variant="outline"
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          Salvar preferências
        </Button>
      </div>
    </div>
  )
}
