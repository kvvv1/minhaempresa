'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatRichText } from '@/components/ai/ChatRichText'
import { ChatButton } from '@/components/ai/ChatButton'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  FileText, RefreshCw, TrendingUp, TrendingDown,
  Target, Calendar, BookMarked, Sparkles, Download,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-4 border border-border/40">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export default function RelatoriosPage() {
  const [chiefOfStaff, setChiefOfStaff] = useState<{ name: string } | null>(null)
  const [weeklyReport, setWeeklyReport] = useState<any>(null)
  const [monthlyReport, setMonthlyReport] = useState<any>(null)
  const [loadingWeekly, setLoadingWeekly] = useState(false)
  const [loadingMonthly, setLoadingMonthly] = useState(false)

  useEffect(() => {
    fetch('/api/employees?role=CHIEF_OF_STAFF').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.[0]) setChiefOfStaff(d[0]) })
  }, [])

  async function loadWeekly() {
    setLoadingWeekly(true)
    try {
      const res = await fetch('/api/reports/weekly')
      if (res.ok) setWeeklyReport(await res.json())
      else toast.error('Erro ao gerar relatório semanal')
    } catch { toast.error('Erro ao gerar relatório semanal') }
    finally { setLoadingWeekly(false) }
  }

  async function loadMonthly() {
    setLoadingMonthly(true)
    try {
      const res = await fetch('/api/reports/monthly')
      if (res.ok) setMonthlyReport(await res.json())
      else toast.error('Erro ao gerar relatório mensal')
    } catch { toast.error('Erro ao gerar relatório mensal') }
    finally { setLoadingMonthly(false) }
  }

  function downloadReport(type: 'weekly' | 'monthly') {
    const data = type === 'weekly' ? weeklyReport : monthlyReport
    if (!data) return
    const blob = new Blob([data.report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-${type}-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/20">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Relatórios Executivos</h1>
            <p className="text-sm text-muted-foreground">Análises geradas pelo Chief of Staff</p>
          </div>
        </div>
        {chiefOfStaff && <ChatButton employeeRole="CHIEF_OF_STAFF" employeeName={chiefOfStaff.name} moduleData={{ weeklyReport, monthlyReport }} />}
      </div>

      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">Semanal</TabsTrigger>
          <TabsTrigger value="monthly">Mensal</TabsTrigger>
        </TabsList>

        {/* ── WEEKLY ────────────────────────────────────────────── */}
        <TabsContent value="weekly" className="space-y-4 mt-4">
          {!weeklyReport ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-10 h-10 text-primary/60 mx-auto mb-3" />
                <h3 className="font-medium mb-1">Relatório Semanal</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Resumo de transações, hábitos, tarefas e metas da semana atual
                </p>
                <Button onClick={loadWeekly} disabled={loadingWeekly}>
                  {loadingWeekly ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
                  ) : (
                    <><FileText className="w-4 h-4 mr-2" /> Gerar Relatório Semanal</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="outline">
                  {new Date(weeklyReport.period.start).toLocaleDateString('pt-BR')} –{' '}
                  {new Date(weeklyReport.period.end).toLocaleDateString('pt-BR')}
                </Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadReport('weekly')}>
                    <Download className="w-4 h-4 mr-1" /> Baixar
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadWeekly} disabled={loadingWeekly}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${loadingWeekly ? 'animate-spin' : ''}`} /> Atualizar
                  </Button>
                </div>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> Análise do Chief of Staff
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingWeekly ? (
                    <div className="space-y-2">
                      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                    </div>
                  ) : (
                    <ChatRichText content={weeklyReport.report} tone="muted" />
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── MONTHLY ───────────────────────────────────────────── */}
        <TabsContent value="monthly" className="space-y-4 mt-4">
          {!monthlyReport ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-10 h-10 text-primary/60 mx-auto mb-3" />
                <h3 className="font-medium mb-1">Relatório Mensal</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Análise completa com financeiro, hábitos, metas, diário e relacionamentos
                </p>
                <Button onClick={loadMonthly} disabled={loadingMonthly}>
                  {loadingMonthly ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
                  ) : (
                    <><FileText className="w-4 h-4 mr-2" /> Gerar Relatório Mensal</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{monthlyReport.period?.label}</Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadReport('monthly')}>
                    <Download className="w-4 h-4 mr-1" /> Baixar
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadMonthly} disabled={loadingMonthly}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${loadingMonthly ? 'animate-spin' : ''}`} /> Atualizar
                  </Button>
                </div>
              </div>

              {/* Financial summary cards */}
              {monthlyReport.data?.financial && (
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Receita"
                    value={formatCurrency(monthlyReport.data.financial.income)}
                    sub="no mês"
                  />
                  <StatCard
                    label="Despesas"
                    value={formatCurrency(monthlyReport.data.financial.expenses)}
                    sub="no mês"
                  />
                  <StatCard
                    label="Saldo"
                    value={formatCurrency(monthlyReport.data.financial.balance)}
                    sub={monthlyReport.data.financial.balance >= 0 ? '✅ positivo' : '⚠️ negativo'}
                  />
                </div>
              )}

              {/* Charts row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monthlyReport.data?.financial?.weeklySpending?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5" /> Gastos por semana
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={monthlyReport.data.financial.weeklySpending}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {monthlyReport.data?.financial?.expensesByCategory && Object.keys(monthlyReport.data.financial.expensesByCategory).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> Despesas por categoria
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={Object.entries(monthlyReport.data.financial.expensesByCategory).map(([name, value]) => ({ name, value }))}
                            cx="50%" cy="50%" outerRadius={60}
                            dataKey="value"
                          >
                            {Object.keys(monthlyReport.data.financial.expensesByCategory).map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {monthlyReport.data?.diary?.moodTrend?.length > 1 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <BookMarked className="w-3.5 h-3.5" /> Humor ao longo do mês
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={monthlyReport.data.diary.moodTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis domain={[1, 10]} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => `${v}/10`} />
                          <Line type="monotone" dataKey="mood" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {monthlyReport.data?.habits?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Taxa de conclusão de hábitos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {monthlyReport.data.habits.slice(0, 5).map((h: any) => (
                          <div key={h.name} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-24 truncate">{h.name}</span>
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${h.rate}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-8 text-right">{h.rate}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Goals */}
              {monthlyReport.data?.goals?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" /> Progresso das Metas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {monthlyReport.data.goals.map((g: any) => (
                        <div key={g.id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium truncate">{g.title}</span>
                            <span className="text-muted-foreground ml-2">{g.progress}%</span>
                          </div>
                          <div className="bg-muted rounded-full h-1.5">
                            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${g.progress}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Report */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> Análise Executiva do Chief of Staff
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingMonthly ? (
                    <div className="space-y-2">
                      {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                    </div>
                  ) : (
                    <ChatRichText content={monthlyReport.report} tone="muted" />
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
