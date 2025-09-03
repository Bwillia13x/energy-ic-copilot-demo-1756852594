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
import { ArrowLeft, Calculator, TrendingUp, BarChart3, Target, Zap, AlertTriangle } from 'lucide-react'
import { fetchJsonWithRetry } from '@/lib/http'

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
import { Chart } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface ValuationInputs {
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
}

interface ValuationResults {
  epv: number
  dcf_value: number
  wacc: number
  cost_of_equity: number
  cost_of_debt_after_tax: number
  ev_ebitda_ratio: number
  net_debt_ebitda_ratio: number
}

interface SensitivityData {
  parameter: string
  value: number
  epv: number
  dcf: number
  wacc: number
}

export default function AdvancedValuationPage() {
  const [inputs, setInputs] = useState<ValuationInputs>({
    ebitda: 3450,
    net_debt: 18750,
    maintenance_capex: 220, // Fixed: Use $220M from PPL filing data
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

  const [results, setResults] = useState<ValuationResults | null>(null)
  const [sensitivityData, setSensitivityData] = useState<SensitivityData[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'inputs' | 'results' | 'sensitivity'>('inputs')
  const [xbrl, setXbrl] = useState<XbrlResponse | null>(null)
  const [xbrlPeriod, setXbrlPeriod] = useState<'any'|'ytd'|'qtd'>('any')

  // Calculate valuation
  const calculateValuation = async () => {
    setLoading(true)
    try {
      const response = await fetchJsonWithRetry<any>(
        `${process.env.NEXT_PUBLIC_API_URL}/valuation/TEST`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: 'TEST', inputs }),
        },
        { timeoutMs: 10000, retries: 2, backoffMs: 1000 }
      )

      setResults({
        epv: response.epv,
        dcf_value: response.dcf_value,
        wacc: response.wacc,
        cost_of_equity: response.cost_of_equity,
        cost_of_debt_after_tax: response.cost_of_debt_after_tax,
        ev_ebitda_ratio: response.ev_ebitda_ratio,
        net_debt_ebitda_ratio: response.net_debt_ebitda_ratio
      })
    } catch (error) {
      console.error('Valuation calculation error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate sensitivity analysis
  const calculateSensitivity = async () => {
    setLoading(true)
    const sensitivityResults: SensitivityData[] = []

    // Sensitivity for beta
    for (let beta = 0.5; beta <= 1.2; beta += 0.1) {
      try {
        const testInputs = { ...inputs, beta }
        const response = await fetchJsonWithRetry<any>(
          `${process.env.NEXT_PUBLIC_API_URL}/valuation/TEST`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: 'TEST', inputs: testInputs }),
          },
          { timeoutMs: 5000, retries: 1, backoffMs: 500 }
        )

        sensitivityResults.push({
          parameter: 'Beta',
          value: beta,
          epv: response.epv,
          dcf: response.dcf_value,
          wacc: response.wacc
        })
      } catch (error) {
        console.warn(`Sensitivity calculation failed for beta ${beta}:`, error)
      }
    }

    // Sensitivity for risk-free rate
    for (let rate = 0.02; rate <= 0.06; rate += 0.01) {
      try {
        const testInputs = { ...inputs, risk_free_rate: rate }
        const response = await fetchJsonWithRetry<any>(
          `${process.env.NEXT_PUBLIC_API_URL}/valuation/TEST`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: 'TEST', inputs: testInputs }),
          },
          { timeoutMs: 5000, retries: 1, backoffMs: 500 }
        )

        sensitivityResults.push({
          parameter: 'Risk-Free Rate',
          value: rate,
          epv: response.epv,
          dcf: response.dcf_value,
          wacc: response.wacc
        })
      } catch (error) {
        console.warn(`Sensitivity calculation failed for rate ${rate}:`, error)
      }
    }

    setSensitivityData(sensitivityResults)
    setLoading(false)
  }

  // Load sample data on mount
  useEffect(() => {
    calculateValuation()
    ;(async () => {
      try {
        const res = await fetchJsonWithRetry<XbrlResponse>(
          `${process.env.NEXT_PUBLIC_API_URL}/xbrl/KMI?period=${xbrlPeriod}`,
          undefined,
          { timeoutMs: 8000, retries: 2, backoffMs: 500 }
        )
        setXbrl(res)
      } catch {}
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetchJsonWithRetry<XbrlResponse>(
          `${process.env.NEXT_PUBLIC_API_URL}/xbrl/KMI?period=${xbrlPeriod}`,
          undefined,
          { timeoutMs: 8000, retries: 2, backoffMs: 500 }
        )
        setXbrl(res)
      } catch {}
    })()
  }, [xbrlPeriod])

  const updateInput = (key: keyof ValuationInputs, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  const betaSensitivity = sensitivityData.filter(d => d.parameter === 'Beta')
  const rateSensitivity = sensitivityData.filter(d => d.parameter === 'Risk-Free Rate')

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
              <Calculator className="w-8 h-8 text-blue-500" />
              Advanced Valuation
            </h1>
            <p className="text-muted-foreground">
              DCF sensitivity analysis, scenario modeling, and comparative valuation
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { id: 'inputs', label: 'Input Parameters', icon: Target },
          { id: 'results', label: 'Valuation Results', icon: TrendingUp },
          { id: 'sensitivity', label: 'Sensitivity Analysis', icon: BarChart3 }
        ].map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activeTab === id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(id as any)}
            className="flex items-center gap-2"
          >
            <Icon className="w-4 h-4" />
            {label}
          </Button>
        ))}
      </div>

      {/* Input Parameters Tab */}
      {activeTab === 'inputs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Metrics</CardTitle>
              <CardDescription>Core financial inputs for valuation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ebitda">EBITDA (CAD millions)</Label>
                <Input
                  id="ebitda"
                  type="number"
                  value={inputs.ebitda}
                  onChange={(e) => updateInput('ebitda', Number(e.target.value))}
                />
              </div>

              <div>
                <Label htmlFor="net_debt">Net Debt (CAD millions)</Label>
                <Input
                  id="net_debt"
                  type="number"
                  value={inputs.net_debt}
                  onChange={(e) => updateInput('net_debt', Number(e.target.value))}
                />
              </div>

              <div>
                <Label htmlFor="maintenance_capex">Maintenance Capex (CAD millions)</Label>
                <Input
                  id="maintenance_capex"
                  type="number"
                  value={inputs.maintenance_capex}
                  onChange={(e) => updateInput('maintenance_capex', Number(e.target.value))}
                />
              </div>

              <div>
                <Label htmlFor="tax_rate">Tax Rate: {formatNumber(inputs.tax_rate * 100)}%</Label>
                <Slider
                  value={[inputs.tax_rate]}
                  onValueChange={([value]) => updateInput('tax_rate', value)}
                  min={0.15}
                  max={0.35}
                  step={0.01}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="reinvestment_rate">Reinvestment Rate: {formatNumber(inputs.reinvestment_rate * 100)}%</Label>
                <Slider
                  value={[inputs.reinvestment_rate]}
                  onValueChange={([value]) => updateInput('reinvestment_rate', value)}
                  min={0.05}
                  max={0.25}
                  step={0.01}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk & Cost Parameters</CardTitle>
              <CardDescription>WACC components and risk assumptions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="risk_free_rate">Risk-Free Rate: {formatNumber(inputs.risk_free_rate * 100)}%</Label>
                <Slider
                  value={[inputs.risk_free_rate]}
                  onValueChange={([value]) => updateInput('risk_free_rate', value)}
                  min={0.01}
                  max={0.08}
                  step={0.005}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="market_risk_premium">Market Risk Premium: {formatNumber(inputs.market_risk_premium * 100)}%</Label>
                <Slider
                  value={[inputs.market_risk_premium]}
                  onValueChange={([value]) => updateInput('market_risk_premium', value)}
                  min={0.04}
                  max={0.08}
                  step={0.005}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="beta">Beta: {formatNumber(inputs.beta)}</Label>
                <Slider
                  value={[inputs.beta]}
                  onValueChange={([value]) => updateInput('beta', value)}
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="cost_of_debt">Cost of Debt: {formatNumber(inputs.cost_of_debt * 100)}%</Label>
                <Slider
                  value={[inputs.cost_of_debt]}
                  onValueChange={([value]) => updateInput('cost_of_debt', value)}
                  min={0.03}
                  max={0.08}
                  step={0.005}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="terminal_growth">Terminal Growth: {formatNumber(inputs.terminal_growth * 100)}%</Label>
                <Slider
                  value={[inputs.terminal_growth]}
                  onValueChange={([value]) => updateInput('terminal_growth', value)}
                  min={0.005}
                  max={0.04}
                  step={0.005}
                  className="mt-2"
                />
              </div>

              <Button onClick={calculateValuation} disabled={loading} className="w-full">
                {loading ? 'Calculating...' : 'Calculate Valuation'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && results && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Valuation Results</CardTitle>
              <CardDescription>Enterprise and equity valuations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(results.epv, 'CAD')}
                  </div>
                  <div className="text-sm text-muted-foreground">Enterprise Present Value</div>
                </div>

                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(results.dcf_value, 'CAD')}
                  </div>
                  <div className="text-sm text-muted-foreground">Discounted Cash Flow</div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2">Key Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>WACC:</span>
                    <span className="font-mono">{formatNumber(results.wacc * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost of Equity:</span>
                    <span className="font-mono">{formatNumber(results.cost_of_equity * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>EV/EBITDA:</span>
                    <span className="font-mono">{formatNumber(results.ev_ebitda_ratio)}x</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valuation Comparison</CardTitle>
              <CardDescription>EPV vs DCF analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <Chart>
                <BarChart
                  data={[
                    { method: 'EPV', value: results.epv },
                    { method: 'DCF', value: results.dcf_value }
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="method" />
                  <YAxis tickFormatter={(value) => formatCurrency(value, 'CAD')} />
                  <Tooltip formatter={(value: number) => formatCurrency(value, 'CAD')} />
                  <Bar dataKey="value" fill="#0A84FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </Chart>
            </CardContent>
          </Card>

          {/* Compact XBRL Sidebar */}
          <Card>
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
                <div className="space-y-2 text-sm">
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
                  <div className="text-xs text-muted-foreground pt-2">Pref: {xbrl.period_preference||'ANY'} • <a className="underline" href={`https://data.sec.gov/api/xbrl/companyfacts/CIK${(xbrl.cik||'').padStart(10,'0')}.json`} target="_blank" rel="noreferrer noopener">Companyfacts</a></div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Structured metrics unavailable</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sensitivity Analysis Tab */}
      {activeTab === 'sensitivity' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Sensitivity Analysis</h3>
              <p className="text-muted-foreground">How valuation changes with key assumptions</p>
            </div>
            <Button onClick={calculateSensitivity} disabled={loading}>
              {loading ? 'Running Analysis...' : 'Run Sensitivity Analysis'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Beta Sensitivity */}
            {betaSensitivity.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Beta Sensitivity</CardTitle>
                  <CardDescription>Impact of systematic risk on valuation</CardDescription>
                </CardHeader>
                <CardContent>
                  <Chart>
                    <LineChart data={betaSensitivity} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis dataKey="value" />
                      <YAxis tickFormatter={(value) => formatCurrency(value, 'CAD')} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value, 'CAD')}
                        labelFormatter={(value) => `Beta: ${value}`}
                      />
                      <Line type="monotone" dataKey="epv" stroke="#0A84FF" name="EPV" strokeWidth={2} />
                      <Line type="monotone" dataKey="dcf" stroke="#34C759" name="DCF" strokeWidth={2} />
                    </LineChart>
                  </Chart>
                </CardContent>
              </Card>
            )}

            {/* Risk-Free Rate Sensitivity */}
            {rateSensitivity.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Risk-Free Rate Sensitivity</CardTitle>
                  <CardDescription>Impact of interest rates on valuation</CardDescription>
                </CardHeader>
                <CardContent>
                  <Chart>
                    <LineChart data={rateSensitivity} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis dataKey="value" tickFormatter={(value) => `${(value * 100).toFixed(1)}%`} />
                      <YAxis tickFormatter={(value) => formatCurrency(value, 'CAD')} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value, 'CAD')}
                        labelFormatter={(value) => `Risk-Free Rate: ${(Number(value) * 100).toFixed(1)}%`}
                      />
                      <Line type="monotone" dataKey="epv" stroke="#0A84FF" name="EPV" strokeWidth={2} />
                      <Line type="monotone" dataKey="dcf" stroke="#34C759" name="DCF" strokeWidth={2} />
                    </LineChart>
                  </Chart>
                </CardContent>
              </Card>
            )}
          </div>

          {!loading && sensitivityData.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <h3 className="text-lg font-semibold mb-2">No Sensitivity Data</h3>
                <p className="text-muted-foreground mb-4">
                  Click &ldquo;Run Sensitivity Analysis&rdquo; to see how valuation changes with different assumptions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          Advanced valuation tool with sensitivity analysis and scenario modeling.
          Results are for educational purposes and should not be considered investment advice.
        </p>
      </div>
    </div>
  )
}
