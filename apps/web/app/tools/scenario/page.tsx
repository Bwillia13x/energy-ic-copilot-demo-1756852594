"use client"

import { useState, useEffect } from 'react'

// Force dynamic rendering to avoid SSR context issues
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Calculator } from 'lucide-react'
import { Chart } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { fetchJsonWithRetry } from '@/lib/http'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface XbrlMeta { form?: string; end?: string; frame?: string; filed?: string; unit?: string; raw_value?: number | null }
interface XbrlResponse {
  ticker: string
  cik: string
  metrics_millions: Record<string, number | null>
  facts_meta: Record<string, XbrlMeta | null>
  source: string
  retrieved_at: string
  period_preference?: string
}

interface ScenarioInputs {
  ebitda: number
  net_debt: number
  maintenance_capex: number
  tax_rate: number
  reinvestment_rate: number
  risk_free_rate: number
  market_risk_premium: number
  beta: number
  cost_of_debt: number
  debt_weight: number
  equity_weight: number
  terminal_growth: number
  // Transparency additions
  cash_from_operations?: number
  fcf_mode?: 'standard' | 'use_cfo'
}

interface Scenario {
  id: string
  name: string
  description: string
  changes: {
    ebitda_change?: number // percentage
    risk_free_rate_change?: number // basis points
    beta_change?: number // absolute change
    terminal_growth_change?: number // percentage
    cost_of_debt_change?: number // basis points
    maintenance_capex_change?: number // percentage
  }
}

interface ScenarioResult {
  scenario: string
  base_epv: number
  scenario_epv: number
  base_dcf: number
  scenario_dcf: number
  change_epv: number
  change_dcf: number
  change_pct_epv: number
  change_pct_dcf: number
}

const PREDEFINED_SCENARIOS: Scenario[] = [
  {
    id: 'recession',
    name: 'Economic Recession',
    description: 'Severe downturn with reduced EBITDA and higher risk',
    changes: {
      ebitda_change: -0.25, // -25%
      risk_free_rate_change: -50, // -50bps
      beta_change: 0.3, // +0.3 beta
      terminal_growth_change: -0.01 // -1%
    }
  },
  {
    id: 'recovery',
    name: 'Economic Recovery',
    description: 'Strong growth with improved margins and lower risk',
    changes: {
      ebitda_change: 0.20, // +20%
      risk_free_rate_change: 75, // +75bps
      beta_change: -0.2, // -0.2 beta
      terminal_growth_change: 0.005 // +0.5%
    }
  },
  {
    id: 'high_inflation',
    name: 'High Inflation',
    description: 'Rising inflation with higher interest rates',
    changes: {
      risk_free_rate_change: 200, // +200bps
      cost_of_debt_change: 150, // +150bps
      terminal_growth_change: 0.005 // +0.5%
    }
  },
  {
    id: 'regulatory_change',
    name: 'Regulatory Changes',
    description: 'New regulations affecting capex and growth',
    changes: {
      maintenance_capex_change: 0.30, // +30% capex
      terminal_growth_change: -0.005, // -0.5%
      beta_change: 0.1 // +0.1 beta
    }
  },
  {
    id: 'commodity_boom',
    name: 'Commodity Price Boom',
    description: 'Favorable commodity prices boosting EBITDA',
    changes: {
      ebitda_change: 0.35, // +35%
      risk_free_rate_change: 50, // +50bps
      beta_change: -0.1 // -0.1 beta
    }
  }
]

export default function ScenarioAnalysisPage() {
  const [baseInputs, setBaseInputs] = useState<ScenarioInputs>({
    ebitda: 3450,
    net_debt: 18750,
    maintenance_capex: 345,
    tax_rate: 0.25,
    reinvestment_rate: 0.15,
    risk_free_rate: 0.04,
    market_risk_premium: 0.06,
    beta: 0.8,
    cost_of_debt: 0.05,
    debt_weight: 0.4,
    equity_weight: 0.6,
    terminal_growth: 0.02
  })

  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['recession', 'recovery'])
  const [scenarioResults, setScenarioResults] = useState<ScenarioResult[]>([])
  const [loading, setLoading] = useState(false)
  const [baseValuation, setBaseValuation] = useState<{ epv: number; dcf: number } | null>(null)
  const [lastValuationRaw, setLastValuationRaw] = useState<any | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<'PSX'|'SU'|'TRP'>('PSX')
  const [currentCurrency, setCurrentCurrency] = useState<'USD'|'CAD'>('USD')
  const [displayCurrency, setDisplayCurrency] = useState<'local'|'USD'>('local')
  const [audited, setAudited] = useState<any | null>(null)
  const [xbrl, setXbrl] = useState<XbrlResponse | null>(null)
  const [xbrlPeriod, setXbrlPeriod] = useState<'any'|'ytd'|'qtd'>('any')

  // Load audited inputs for selected ticker and calculate
  useEffect(() => {
    ;(async () => {
      try {
        const needsUsd = (selectedTicker === 'TRP' || selectedTicker === 'SU') && displayCurrency === 'USD'
        const q = needsUsd ? '?to=USD&method=fyavg&date=2024-12-31' : ''
        const res = await fetchJsonWithRetry<any>(`/api/demo/financials/${selectedTicker}${q}`)
        setAudited(res)
        const currency = (res.audited?.currency || 'USD') as 'USD'|'CAD'
        setCurrentCurrency(currency)
        const cfo = res.audited?.cash_from_operations ?? null
        const netDebt = res.derived?.net_debt_excl_leases ?? null
        if (cfo != null && netDebt != null) {
          setBaseInputs(prev => ({
            ...prev,
            ebitda: cfo, // placeholder; EPV/DCF will use CFO via fcf_mode
            net_debt: netDebt,
            maintenance_capex: 0,
            cash_from_operations: cfo,
            fcf_mode: 'use_cfo'
          }))
        }
        setTimeout(calculateBaseValuation, 0)
      } catch (e) {
        console.warn('Failed to load audited inputs', e)
        calculateBaseValuation()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicker, displayCurrency])

  // Default currency behavior when switching tickers
  useEffect(() => {
    // Make TRP default to USD on first switch from non-TRP (if still local)
    if (selectedTicker === 'TRP' && displayCurrency === 'local') {
      setDisplayCurrency('USD')
    }
    // Keep SU default as Local (CAD); leave user choice if already changed
  }, [selectedTicker])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetchJsonWithRetry<XbrlResponse>(
          `${process.env.NEXT_PUBLIC_API_URL}/xbrl/KMI?period=${xbrlPeriod}`,
          undefined,
          { timeoutMs: 8000, retries: 2, backoffMs: 500 }
        )
        setXbrl(res)
      } catch {
        setXbrl(null)
      }
    })()
  }, [xbrlPeriod])

  const calculateBaseValuation = async () => {
    try {
      const response = await fetchJsonWithRetry<any>(
        `${process.env.NEXT_PUBLIC_API_URL}/valuation/TEST`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: 'TEST', inputs: baseInputs }),
        },
        { timeoutMs: 10000, retries: 2, backoffMs: 1000 }
      )

      setBaseValuation({
        epv: response.epv,
        dcf: response.dcf_value
      })
      setLastValuationRaw(response)
    } catch (error) {
      console.error('Error calculating base valuation:', error)
    }
  }

  const applyScenarioChanges = (scenario: Scenario): ScenarioInputs => {
    const adjusted = { ...baseInputs }

    if (scenario.changes.ebitda_change !== undefined) {
      adjusted.ebitda *= (1 + scenario.changes.ebitda_change)
    }

    if (scenario.changes.maintenance_capex_change !== undefined) {
      adjusted.maintenance_capex *= (1 + scenario.changes.maintenance_capex_change)
    }

    if (scenario.changes.risk_free_rate_change !== undefined) {
      adjusted.risk_free_rate += (scenario.changes.risk_free_rate_change / 10000) // Convert bps to decimal
    }

    if (scenario.changes.beta_change !== undefined) {
      adjusted.beta += scenario.changes.beta_change
    }

    if (scenario.changes.cost_of_debt_change !== undefined) {
      adjusted.cost_of_debt += (scenario.changes.cost_of_debt_change / 10000) // Convert bps to decimal
    }

    if (scenario.changes.terminal_growth_change !== undefined) {
      adjusted.terminal_growth += scenario.changes.terminal_growth_change
    }

    return adjusted
  }

  const runScenarioAnalysis = async () => {
    if (!baseValuation) return

    setLoading(true)
    const results: ScenarioResult[] = []

    try {
      for (const scenarioId of selectedScenarios) {
        const scenario = PREDEFINED_SCENARIOS.find(s => s.id === scenarioId)
        if (!scenario) continue

        const adjustedInputs = applyScenarioChanges(scenario)

        try {
          const response = await fetchJsonWithRetry<any>(
            `${process.env.NEXT_PUBLIC_API_URL}/valuation/TEST`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker: 'TEST', inputs: adjustedInputs }),
            },
            { timeoutMs: 8000, retries: 1, backoffMs: 500 }
          )

          const scenario_epv = response.epv
          const scenario_dcf = response.dcf_value

          const change_epv = scenario_epv - baseValuation.epv
          const change_dcf = scenario_dcf - baseValuation.dcf
          const change_pct_epv = (change_epv / baseValuation.epv) * 100
          const change_pct_dcf = (change_dcf / baseValuation.dcf) * 100

          results.push({
            scenario: scenario.name,
            base_epv: baseValuation.epv,
            scenario_epv,
            base_dcf: baseValuation.dcf,
            scenario_dcf,
            change_epv,
            change_dcf,
            change_pct_epv,
            change_pct_dcf
          })
        } catch (error) {
          console.warn(`Failed to calculate scenario ${scenario.name}:`, error)
        }
      }

      setScenarioResults(results)
    } catch (error) {
      console.error('Error running scenario analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev =>
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    )
  }

  const updateBaseInput = (key: keyof ScenarioInputs, value: number) => {
    setBaseInputs(prev => ({ ...prev, [key]: value }))
    // Recalculate base valuation when inputs change
    setTimeout(calculateBaseValuation, 500)
  }

  const getScenarioChartData = () => {
    return scenarioResults.map(result => ({
      scenario: result.scenario.length > 15 ? result.scenario.substring(0, 15) + '...' : result.scenario,
      'Base EPV': result.base_epv,
      'Scenario EPV': result.scenario_epv,
      'Base DCF': result.base_dcf,
      'Scenario DCF': result.scenario_dcf
    }))
  }

  const getImpactSummary = () => {
    if (scenarioResults.length === 0) return null

    const avg_epv_change = scenarioResults.reduce((sum, r) => sum + r.change_pct_epv, 0) / scenarioResults.length
    const avg_dcf_change = scenarioResults.reduce((sum, r) => sum + r.change_pct_dcf, 0) / scenarioResults.length
    const max_epv_impact = Math.max(...scenarioResults.map(r => Math.abs(r.change_pct_epv)))
    const max_dcf_impact = Math.max(...scenarioResults.map(r => Math.abs(r.change_pct_dcf)))

    return {
      avg_epv_change,
      avg_dcf_change,
      max_epv_impact,
      max_dcf_impact,
      volatility_epv: Math.sqrt(scenarioResults.reduce((sum, r) => sum + Math.pow(r.change_pct_epv - avg_epv_change, 2), 0) / scenarioResults.length),
      volatility_dcf: Math.sqrt(scenarioResults.reduce((sum, r) => sum + Math.pow(r.change_pct_dcf - avg_dcf_change, 2), 0) / scenarioResults.length)
    }
  }

  const impact = getImpactSummary()

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/compare">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Compare
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Target className="w-8 h-8 text-red-500" />
              Scenario Analysis
            </h1>
            <p className="text-muted-foreground">
              Stress test valuations under different economic conditions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Company</label>
          <Select value={selectedTicker} onValueChange={(v) => setSelectedTicker(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PSX">PSX — Phillips 66</SelectItem>
              <SelectItem value="SU">SU — Suncor</SelectItem>
              <SelectItem value="TRP">TRP — TC Energy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Currency</label>
          {(selectedTicker === 'TRP' || selectedTicker === 'SU') ? (
            <Select value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local (CAD)</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-muted-foreground">{currentCurrency}</div>
          )}
        </div>
      </div>

      {/* Compact XBRL Sidebar */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>SEC XBRL (KMI)</CardTitle>
            <div className="flex items-center gap-1" role="group" aria-label="XBRL period selector">
              {(['any','ytd','qtd'] as const).map(p => (
                <Button key={p} size="sm" variant={xbrlPeriod===p?'default':'outline'} onClick={() => setXbrlPeriod(p)} aria-pressed={xbrlPeriod===p}>{p.toUpperCase()}</Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {xbrl ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(['ebitda','net_income','interest_expense','net_debt'] as const).map(key => {
                const val = xbrl.metrics_millions[key]
                const meta = xbrl.facts_meta[key]
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-muted-foreground capitalize">{key.replace('_',' ')}</span>
                    <span className="font-mono" title={`${meta?.form||'—'} / ${meta?.end||'—'} / ${meta?.frame||'—'}`}>{val!=null ? val.toLocaleString() : '-'}</span>
                  </div>
                )
              })}
              <div className="col-span-2 text-xs text-muted-foreground pt-1">Pref: {xbrl.period_preference||'ANY'} • <a className="underline" href={`https://data.sec.gov/api/xbrl/companyfacts/CIK${(xbrl.cik||'').padStart(10,'0')}.json`} target="_blank" rel="noreferrer noopener">Companyfacts</a></div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Structured metrics unavailable</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Base Assumptions */}
        <Card>
          <CardHeader>
            <CardTitle>Base Assumptions</CardTitle>
            <CardDescription>Current market conditions and company metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ebitda">EBITDA (CAD millions)</Label>
              <Input
                id="ebitda"
                type="number"
                value={baseInputs.ebitda}
                onChange={(e) => updateBaseInput('ebitda', Number(e.target.value))}
              />
            </div>

            <div>
              <Label htmlFor="risk_free_rate">Risk-Free Rate: {formatNumber(baseInputs.risk_free_rate * 100)}%</Label>
              <Slider
                value={[baseInputs.risk_free_rate]}
                onValueChange={([value]) => updateBaseInput('risk_free_rate', value)}
                min={0.01}
                max={0.08}
                step={0.005}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="beta">Beta: {formatNumber(baseInputs.beta)}</Label>
              <Slider
                value={[baseInputs.beta]}
                onValueChange={([value]) => updateBaseInput('beta', value)}
                min={0.5}
                max={1.5}
                step={0.1}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="terminal_growth">Terminal Growth: {formatNumber(baseInputs.terminal_growth * 100)}%</Label>
              <Slider
                value={[baseInputs.terminal_growth]}
                onValueChange={([value]) => updateBaseInput('terminal_growth', value)}
                min={0.005}
                max={0.04}
                step={0.005}
                className="mt-2"
              />
            </div>

            {baseValuation && (
              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Base EPV:</span>
                  <span className="font-mono">{formatCurrency(baseValuation.epv, currentCurrency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Base DCF:</span>
                  <span className="font-mono">{formatCurrency(baseValuation.dcf, currentCurrency)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scenario Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Scenario Selection</CardTitle>
            <CardDescription>Choose scenarios to analyze</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PREDEFINED_SCENARIOS.map(scenario => (
              <div key={scenario.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={scenario.id}
                  checked={selectedScenarios.includes(scenario.id)}
                  onChange={() => toggleScenario(scenario.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor={scenario.id} className="font-medium cursor-pointer">
                    {scenario.name}
                  </Label>
                  <p className="text-sm text-muted-foreground">{scenario.description}</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    {Object.entries(scenario.changes).map(([key, value]) => {
                      const label = key.replace('_change', '').replace('_', ' ')
                      const formatted = key.includes('rate') || key.includes('debt')
                        ? `${value > 0 ? '+' : ''}${value}bps`
                        : `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`
                      return `${label}: ${formatted}`
                    }).join(', ')}
                  </div>
                </div>
              </div>
            ))}

            <Button
              onClick={runScenarioAnalysis}
              disabled={loading || selectedScenarios.length === 0 || !baseValuation}
              className="w-full mt-4"
            >
              {loading ? 'Running Analysis...' : `Run ${selectedScenarios.length} Scenarios`}
            </Button>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Impact Summary</CardTitle>
            <CardDescription>Overall scenario analysis results</CardDescription>
          </CardHeader>
          <CardContent>
            {impact ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Average Impact</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>EPV Change:</span>
                      <span className={`font-mono ${impact.avg_epv_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {impact.avg_epv_change >= 0 ? '+' : ''}{formatNumber(impact.avg_epv_change)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>DCF Change:</span>
                      <span className={`font-mono ${impact.avg_dcf_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {impact.avg_dcf_change >= 0 ? '+' : ''}{formatNumber(impact.avg_dcf_change)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Maximum Impact</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>EPV:</span>
                      <span className="font-mono">±{formatNumber(impact.max_epv_impact)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DCF:</span>
                      <span className="font-mono">±{formatNumber(impact.max_dcf_impact)}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Volatility</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>EPV:</span>
                      <span className="font-mono">{formatNumber(impact.volatility_epv)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DCF:</span>
                      <span className="font-mono">{formatNumber(impact.volatility_dcf)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Run scenario analysis to see impact summary</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scenario Results */}
      {scenarioResults.length > 0 && (
        <div className="mt-8 space-y-6">
          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Scenario Comparison</CardTitle>
              <CardDescription>Valuation impact across different scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <Chart>
                <BarChart data={getScenarioChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="scenario" angle={-45} textAnchor="end" height={80} />
                  <YAxis tickFormatter={(value) => formatCurrency(value, currentCurrency)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value, currentCurrency)} />
                  <Legend />
                  <Bar dataKey="Base EPV" fill="#0A84FF" name="Base EPV" />
                  <Bar dataKey="Scenario EPV" fill="#34C759" name="Scenario EPV" />
                </BarChart>
              </Chart>
            </CardContent>
          </Card>

          {/* Detailed Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Scenario Results</CardTitle>
              <CardDescription>Complete breakdown of valuation changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border rounded-md">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border p-3 text-left">Scenario</th>
                      <th className="border border-border p-3 text-right">Base EPV</th>
                      <th className="border border-border p-3 text-right">Scenario EPV</th>
                      <th className="border border-border p-3 text-right">Change</th>
                      <th className="border border-border p-3 text-right">% Change</th>
                      <th className="border border-border p-3 text-right">Base DCF</th>
                      <th className="border border-border p-3 text-right">Scenario DCF</th>
                      <th className="border border-border p-3 text-right">Change</th>
                      <th className="border border-border p-3 text-right">% Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioResults.map((result, index) => (
                      <tr key={result.scenario} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                        <td className="border border-border p-3 font-medium">{result.scenario}</td>
                        <td className="border border-border p-3 text-right font-mono">
                          {formatCurrency(result.base_epv, currentCurrency)}
                        </td>
                        <td className="border border-border p-3 text-right font-mono">
                          {formatCurrency(result.scenario_epv, currentCurrency)}
                        </td>
                        <td className="border border-border p-3 text-right font-mono">
                          <span className={result.change_epv >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {result.change_epv >= 0 ? '+' : ''}{formatCurrency(result.change_epv, currentCurrency)}
                          </span>
                        </td>
                        <td className="border border-border p-3 text-right font-mono">
                          <span className={result.change_pct_epv >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {result.change_pct_epv >= 0 ? '+' : ''}{formatNumber(result.change_pct_epv)}%
                          </span>
                        </td>
                        <td className="border border-border p-3 text-right font-mono">
                          {formatCurrency(result.base_dcf, currentCurrency)}
                        </td>
                        <td className="border border-border p-3 text-right font-mono">
                          {formatCurrency(result.scenario_dcf, currentCurrency)}
                        </td>
                        <td className="border border-border p-3 text-right font-mono">
                          <span className={result.change_dcf >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {result.change_dcf >= 0 ? '+' : ''}{formatCurrency(result.change_dcf, currentCurrency)}
                          </span>
                        </td>
                        <td className="border border-border p-3 text-right font-mono">
                          <span className={result.change_pct_dcf >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {result.change_pct_dcf >= 0 ? '+' : ''}{formatNumber(result.change_pct_dcf)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk Assessment */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Risk Assessment
          </CardTitle>
          <CardDescription>Understanding scenario analysis implications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Interpretation Guidelines</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Positive Impact:</strong> Scenarios that increase valuation</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span><strong>High Volatility:</strong> Large valuation swings indicate sensitivity</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Downside Risk:</strong> Maximum negative impact scenarios</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Key Insights</h4>
              <div className="text-sm space-y-2">
                <p>
                  <strong>Valuation Sensitivity:</strong> Shows how changes in economic conditions
                  affect the company's valuation.
                </p>
                <p>
                  <strong>Risk Management:</strong> Helps identify scenarios that could significantly
                  impact investment returns.
                </p>
                <p>
                  <strong>Decision Support:</strong> Provides quantitative analysis for strategic
                  planning and risk assessment.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculation Trace (Transparency) */}
      {lastValuationRaw && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-500" />
              Calculation Trace
            </CardTitle>
            <CardDescription>Discrete steps, formulas, and inputs used in valuation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {(lastValuationRaw.calculation_trace || []).map((step: any, idx: number) => (
                <div key={idx} className="p-3 rounded border">
                  <div className="font-medium">{step.name}</div>
                  {step.formula && (
                    <div className="text-muted-foreground">{step.formula}</div>
                  )}
                  {step.inputs && (
                    <div className="mt-1 text-xs grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(step.inputs).map(([k,v]) => (
                        <div key={k} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-mono">{typeof v === 'number' ? v.toLocaleString() : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {typeof step.value === 'number' && (
                    <div className="mt-1">
                      <span className="text-muted-foreground">Result:</span>{' '}
                      <span className="font-mono">{step.value.toLocaleString()}</span>
                    </div>
                  )}
                  {step.rationale && (
                    <div className="mt-1 text-xs text-muted-foreground">{step.rationale}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          Scenario analysis tool for stress testing valuations under different economic conditions.
          Results are for analytical purposes and should be considered alongside other factors.
        </p>
      </div>
    </div>
  )
}
