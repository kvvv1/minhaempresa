'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Utensils, History, ClipboardList, Trash2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ChatButton } from '@/components/ai/ChatButton'

type MealType = 'BREAKFAST' | 'MORNING_SNACK' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER' | 'SUPPER'

interface MealItem { id: string; name: string; quantityG?: number; calories?: number; proteinG?: number; carbsG?: number; fatG?: number }
interface Meal { id: string; name: string; type: MealType; date: string; calories?: number; proteinG?: number; carbsG?: number; fatG?: number; notes?: string; items: MealItem[] }
interface MealPlan { id: string; name: string; weekStart: string; isActive: boolean; targetCalories?: number; targetProteinG?: number; targetCarbsG?: number; targetFatG?: number; notes?: string }
interface DaySummary { calories: number; proteinG: number; carbsG: number; fatG: number }

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: '☀️ Café da manhã',
  MORNING_SNACK: '🍎 Lanche manhã',
  LUNCH: '🍽️ Almoço',
  AFTERNOON_SNACK: '🥪 Lanche tarde',
  DINNER: '🌙 Jantar',
  SUPPER: '🥛 Ceia',
}

const MEAL_TYPE_ORDER: MealType[] = ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'DINNER', 'SUPPER']

const MACRO_COLORS = { calories: '#f59e0b', proteinG: '#6366f1', carbsG: '#10b981', fatG: '#ef4444' }

export default function NutricaoPage() {
  const [trainer, setTrainer] = useState<{ name: string } | null>(null)
  const [hydration, setHydration] = useState<{ mlTotal: number; goalMl: number } | null>(null)
  const [todayMeals, setTodayMeals] = useState<Meal[]>([])
  const [historyMeals, setHistoryMeals] = useState<Meal[]>([])
  const [plans, setPlans] = useState<MealPlan[]>([])
  const [summary, setSummary] = useState<{ todayTotals: DaySummary; activePlan: MealPlan | null; mealCount: number }>({
    todayTotals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    activePlan: null,
    mealCount: 0,
  })

  const [mealOpen, setMealOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0])

  const [mealForm, setMealForm] = useState({ name: '', type: 'LUNCH' as MealType, date: new Date().toISOString().split('T')[0], calories: '', proteinG: '', carbsG: '', fatG: '', notes: '' })
  const [planForm, setPlanForm] = useState({ name: '', weekStart: new Date().toISOString().split('T')[0], targetCalories: '', targetProteinG: '', targetCarbsG: '', targetFatG: '', notes: '' })

  const today = new Date().toISOString().split('T')[0]

  const fetchAll = useCallback(async () => {
    const [sumRes, todayRes, plansRes] = await Promise.all([
      fetch('/api/nutricao'),
      fetch(`/api/nutricao/meals?date=${today}`),
      fetch('/api/nutricao/meal-plans'),
    ])
    if (sumRes.ok) setSummary(await sumRes.json())
    if (todayRes.ok) setTodayMeals(await todayRes.json())
    if (plansRes.ok) setPlans(await plansRes.json())
    fetch('/api/saude/hydration').then(r => r.ok ? r.json() : null).then(d => setHydration(d))
  }, [today])

  const fetchHistory = useCallback(async (date: string) => {
    const res = await fetch(`/api/nutricao/meals?date=${date}`)
    if (res.ok) setHistoryMeals(await res.json())
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchHistory(historyDate) }, [historyDate, fetchHistory])
  useEffect(() => {
    fetch('/api/employees?role=PERSONAL_TRAINER').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.[0]) setTrainer(d[0]) })
  }, [])

  async function createMeal() {
    try {
      const res = await fetch('/api/nutricao/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mealForm,
          calories: mealForm.calories ? Number(mealForm.calories) : undefined,
          proteinG: mealForm.proteinG ? Number(mealForm.proteinG) : undefined,
          carbsG: mealForm.carbsG ? Number(mealForm.carbsG) : undefined,
          fatG: mealForm.fatG ? Number(mealForm.fatG) : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Refeição registrada!')
      setMealOpen(false)
      setMealForm({ name: '', type: 'LUNCH', date: today, calories: '', proteinG: '', carbsG: '', fatG: '', notes: '' })
      fetchAll()
    } catch { toast.error('Erro ao salvar refeição') }
  }

  async function deleteMeal(id: string) {
    try {
      await fetch(`/api/nutricao/meals/${id}`, { method: 'DELETE' })
      setTodayMeals((prev) => prev.filter((m) => m.id !== id))
      fetchAll()
    } catch { toast.error('Erro ao deletar') }
  }

  async function createPlan() {
    try {
      const res = await fetch('/api/nutricao/meal-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planForm,
          targetCalories: planForm.targetCalories ? Number(planForm.targetCalories) : undefined,
          targetProteinG: planForm.targetProteinG ? Number(planForm.targetProteinG) : undefined,
          targetCarbsG: planForm.targetCarbsG ? Number(planForm.targetCarbsG) : undefined,
          targetFatG: planForm.targetFatG ? Number(planForm.targetFatG) : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Plano criado!')
      setPlanOpen(false)
      setPlanForm({ name: '', weekStart: today, targetCalories: '', targetProteinG: '', targetCarbsG: '', targetFatG: '', notes: '' })
      fetchAll()
    } catch { toast.error('Erro ao criar plano') }
  }

  async function activatePlan(id: string) {
    try {
      await fetch(`/api/nutricao/meal-plans/${id}/activate`, { method: 'POST' })
      setPlans((prev) => prev.map((p) => ({ ...p, isActive: p.id === id })))
      setSummary((s) => ({ ...s, activePlan: plans.find((p) => p.id === id) ?? null }))
      toast.success('Plano ativado!')
    } catch { toast.error('Erro ao ativar plano') }
  }

  async function deletePlan(id: string) {
    try {
      await fetch(`/api/nutricao/meal-plans/${id}`, { method: 'DELETE' })
      setPlans((prev) => prev.filter((p) => p.id !== id))
      toast.success('Plano removido')
    } catch { toast.error('Erro ao deletar') }
  }

  const { todayTotals, activePlan } = summary
  const calPct = activePlan?.targetCalories ? Math.min(100, Math.round((todayTotals.calories / activePlan.targetCalories) * 100)) : null

  function MacroBar({ label, value, target, color }: { label: string; value: number; target?: number; color: string }) {
    const pct = target ? Math.min(100, Math.round((value / target) * 100)) : null
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{Math.round(value)}{label === 'Calorias' ? 'kcal' : 'g'}{target ? ` / ${target}` : ''}</span>
        </div>
        {pct !== null && <Progress value={pct} className="h-1.5" style={{ '--progress-color': color } as any} />}
      </div>
    )
  }

  const groupedMeals = MEAL_TYPE_ORDER.reduce((acc, type) => {
    const group = todayMeals.filter((m) => m.type === type)
    if (group.length) acc[type] = group
    return acc
  }, {} as Record<MealType, Meal[]>)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nutrição</h1>
          <p className="text-muted-foreground text-sm">Refeições, macros e planos alimentares</p>
        </div>
        <div className="flex items-center gap-2">
          {trainer && <ChatButton employeeRole="PERSONAL_TRAINER" employeeName={trainer.name} moduleData={{ summary, todayMeals, plans }} />}
          <Button size="sm" onClick={() => setMealOpen(true)}><Plus className="w-4 h-4 mr-2" />Registrar Refeição</Button>
        </div>
      </div>

      {/* Macros do dia */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Hoje — {summary.mealCount} refeição{summary.mealCount !== 1 ? 'ões' : ''}</CardTitle>
            {activePlan && <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />{activePlan.name}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <MacroBar label="Calorias" value={todayTotals.calories} target={activePlan?.targetCalories ?? undefined} color={MACRO_COLORS.calories} />
          <MacroBar label="Proteína" value={todayTotals.proteinG} target={activePlan?.targetProteinG ?? undefined} color={MACRO_COLORS.proteinG} />
          <MacroBar label="Carboidratos" value={todayTotals.carbsG} target={activePlan?.targetCarbsG ?? undefined} color={MACRO_COLORS.carbsG} />
          <MacroBar label="Gordura" value={todayTotals.fatG} target={activePlan?.targetFatG ?? undefined} color={MACRO_COLORS.fatG} />
        </CardContent>
      </Card>

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje"><Utensils className="w-4 h-4 mr-2" />Hoje</TabsTrigger>
          <TabsTrigger value="historico"><History className="w-4 h-4 mr-2" />Histórico</TabsTrigger>
          <TabsTrigger value="planos"><ClipboardList className="w-4 h-4 mr-2" />Planos</TabsTrigger>
        </TabsList>

        {/* Hoje */}
        <TabsContent value="hoje" className="mt-6 space-y-4">
          {hydration && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    💧 Hidratação
                  </p>
                  <span className={cn('text-sm font-bold', hydration.mlTotal >= hydration.goalMl ? 'text-emerald-400' : 'text-blue-400')}>
                    {hydration.mlTotal}ml / {hydration.goalMl}ml
                  </span>
                </div>
                <Progress value={Math.min(100, Math.round((hydration.mlTotal / hydration.goalMl) * 100))} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{Math.min(100, Math.round((hydration.mlTotal / hydration.goalMl) * 100))}% da meta diária</p>
              </CardContent>
            </Card>
          )}
          {Object.keys(groupedMeals).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Utensils className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhuma refeição registrada hoje</p></div>
          ) : (
            Object.entries(groupedMeals).map(([type, meals]) => (
              <div key={type}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{MEAL_TYPE_LABELS[type as MealType]}</p>
                <div className="space-y-2">
                  {meals.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="p-3 flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{m.name}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {m.calories && <span className="text-xs text-amber-400">{m.calories}kcal</span>}
                            {m.proteinG && <span className="text-xs text-indigo-400">{m.proteinG}g prot</span>}
                            {m.carbsG && <span className="text-xs text-emerald-400">{m.carbsG}g carb</span>}
                            {m.fatG && <span className="text-xs text-red-400">{m.fatG}g gord</span>}
                          </div>
                          {m.items.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{m.items.map((i) => i.name).join(', ')}</p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="w-7 h-7 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteMeal(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="historico" className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm">Data:</Label>
            <Input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="w-40 h-8 text-sm" />
          </div>
          {historyMeals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><History className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhuma refeição nesta data</p></div>
          ) : (
            <div className="space-y-2">
              {historyMeals.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{MEAL_TYPE_LABELS[m.type]}</Badge>
                      <p className="text-sm font-medium flex-1">{m.name}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {m.calories && <span className="text-xs text-amber-400">{m.calories}kcal</span>}
                      {m.proteinG && <span className="text-xs text-indigo-400">{m.proteinG}g prot</span>}
                      {m.carbsG && <span className="text-xs text-emerald-400">{m.carbsG}g carb</span>}
                      {m.fatG && <span className="text-xs text-red-400">{m.fatG}g gord</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Card className="border-border/40">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Total do dia</p>
                  <div className="flex flex-wrap gap-3">
                    {(() => {
                      const t = historyMeals.reduce((a, m) => ({ cal: a.cal + (m.calories ?? 0), prot: a.prot + (m.proteinG ?? 0), carb: a.carb + (m.carbsG ?? 0), fat: a.fat + (m.fatG ?? 0) }), { cal: 0, prot: 0, carb: 0, fat: 0 })
                      return <>
                        <span className="text-xs text-amber-400 font-medium">{t.cal}kcal</span>
                        <span className="text-xs text-indigo-400">{Math.round(t.prot)}g prot</span>
                        <span className="text-xs text-emerald-400">{Math.round(t.carb)}g carb</span>
                        <span className="text-xs text-red-400">{Math.round(t.fat)}g gord</span>
                      </>
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Planos */}
        <TabsContent value="planos" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)}><Plus className="w-4 h-4 mr-2" />Novo Plano</Button>
          </div>
          {plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum plano alimentar criado</p></div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {plans.map((p) => (
                <Card key={p.id} className={cn(p.isActive && 'border-emerald-500/40')}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {p.name}
                        {p.isActive && <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/40">Ativo</Badge>}
                      </CardTitle>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive" onClick={() => deletePlan(p.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {p.targetCalories && <span className="text-amber-400">{p.targetCalories}kcal</span>}
                      {p.targetProteinG && <span className="text-indigo-400">{p.targetProteinG}g prot</span>}
                      {p.targetCarbsG && <span className="text-emerald-400">{p.targetCarbsG}g carb</span>}
                      {p.targetFatG && <span className="text-red-400">{p.targetFatG}g gord</span>}
                    </div>
                    {!p.isActive && (
                      <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => activatePlan(p.id)}>Ativar este plano</Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Refeição */}
      <Dialog open={mealOpen} onOpenChange={setMealOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Refeição</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Nome</Label><Input placeholder="Ex: Frango com arroz" value={mealForm.name} onChange={(e) => setMealForm({ ...mealForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={mealForm.type} onValueChange={(v) => setMealForm({ ...mealForm, type: (v ?? 'LUNCH') as MealType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(MEAL_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Data</Label><Input type="date" value={mealForm.date} onChange={(e) => setMealForm({ ...mealForm, date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Calorias (kcal)</Label><Input type="number" placeholder="500" value={mealForm.calories} onChange={(e) => setMealForm({ ...mealForm, calories: e.target.value })} /></div>
              <div className="space-y-1"><Label>Proteína (g)</Label><Input type="number" placeholder="30" value={mealForm.proteinG} onChange={(e) => setMealForm({ ...mealForm, proteinG: e.target.value })} /></div>
              <div className="space-y-1"><Label>Carboidratos (g)</Label><Input type="number" placeholder="50" value={mealForm.carbsG} onChange={(e) => setMealForm({ ...mealForm, carbsG: e.target.value })} /></div>
              <div className="space-y-1"><Label>Gordura (g)</Label><Input type="number" placeholder="15" value={mealForm.fatG} onChange={(e) => setMealForm({ ...mealForm, fatG: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Notas</Label><Textarea rows={2} placeholder="Ingredientes, observações..." value={mealForm.notes} onChange={(e) => setMealForm({ ...mealForm, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={createMeal} disabled={!mealForm.name.trim()}>Salvar Refeição</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Plano */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Plano Alimentar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Nome</Label><Input placeholder="Cutting, Bulking, Manutenção..." value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Início da semana</Label><Input type="date" value={planForm.weekStart} onChange={(e) => setPlanForm({ ...planForm, weekStart: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Meta calorias</Label><Input type="number" placeholder="2000" value={planForm.targetCalories} onChange={(e) => setPlanForm({ ...planForm, targetCalories: e.target.value })} /></div>
              <div className="space-y-1"><Label>Meta proteína (g)</Label><Input type="number" placeholder="150" value={planForm.targetProteinG} onChange={(e) => setPlanForm({ ...planForm, targetProteinG: e.target.value })} /></div>
              <div className="space-y-1"><Label>Meta carboidratos (g)</Label><Input type="number" placeholder="200" value={planForm.targetCarbsG} onChange={(e) => setPlanForm({ ...planForm, targetCarbsG: e.target.value })} /></div>
              <div className="space-y-1"><Label>Meta gordura (g)</Label><Input type="number" placeholder="60" value={planForm.targetFatG} onChange={(e) => setPlanForm({ ...planForm, targetFatG: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Notas</Label><Textarea rows={2} value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={createPlan} disabled={!planForm.name.trim()}>Criar Plano</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
