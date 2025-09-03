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
import { ArrowLeft, Zap, BarChart3, AlertTriangle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Chart } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar } from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/utils'
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

interface SimulationInputs {
  ebitda: number
  net_debt: number
  maintenance_capex: number
  tax_rate: number
  reinvestment_rate: number
  risk_free_rate: number
  market_risk_premium: number
  beta: number
  cost_of_debt: number

  // Volatility assumptions
  ebitda_volatility: number // standard deviation as percentage
  beta_volatility: number // beta uncertainty
  risk_premium_volatility: number // market risk premium uncertainty
  terminal_growth_volatility: number // terminal growth uncertainty

  // Simulation parameters
  num_simulations: number
  confidence_level: number // for VaR calculation
}

interface SimulationResult {
  epv: number
  dcf: number
  wacc: number
  ebitda: number
  beta: number
  terminal_growth: number
}

interface SimulationStats {
  epv_mean: number
  epv_std: number
  epv_min: number
  epv_max: number
  epv_median: number
  epv_var_95: number // Value at Risk at 95% confidence
  epv_var_99: number // Value at Risk at 99% confidence

  dcf_mean: number
  dcf_std: number
  dcf_min: number
  dcf_max: number
  dcf_median: number
  dcf_var_95: number
  dcf_var_99: number

  probability_positive_epv: number
  probability_positive_dcf: number
}

export default function MonteCarloPage() {
  const [inputs, setInputs] = useState<SimulationInputs>({
    ebitda: 3450,
    net_debt: 18750,
    maintenance_capex: 220, // Fixed: Use $220M from PPL filing data
    tax_rate: 0.25,
    reinvestment_rate: 0.15,
    risk_free_rate: 0.04,
    market_risk_premium: 0.06,
    beta: 0.8,
    cost_of_debt: 0.05,

    ebitda_volatility: 0.15, // 15% volatility
    beta_volatility: 0.1, // 0.1 beta volatility
    risk_premium_volatility: 0.02, // 2% market risk premium volatility
    terminal_growth_volatility: 0.005, // 0.5% terminal growth volatility

    num_simulations: 1000,
    confidence_level: 0.95
  })

  const [results, setResults] = useState<SimulationResult[]>([])
  const [stats, setStats] = useState<SimulationStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [distributionData, setDistributionData] = useState<any[]>([])
  const [xbrl, setXbrl] = useState<XbrlResponse | null>(null)
  const [xbrlPeriod, setXbrlPeriod] = useState<'any'|'ytd'|'qtd'>('any')

  // Generate random normal distribution
  const randomNormal = (mean: number, std: number): number => {
    // Box-Muller transform
    const u1 = Math.random()
    const u2 = Math.random()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z0 * std
  }

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

  // Run Monte Carlo simulation
  const runSimulation = async () => {
    setLoading(true)
    const simulationResults: SimulationResult[] = []

    try {
      for (let i = 0; i < inputs.num_simulations; i++) {
        // Generate random inputs based on volatility assumptions
        const randomEbitda = randomNormal(inputs.ebitda, inputs.ebitda * inputs.ebitda_volatility)
        const randomBeta = Math.max(0.1, randomNormal(inputs.beta, inputs.beta_volatility))
        const randomRiskPremium = Math.max(0.02, randomNormal(inputs.market_risk_premium, inputs.market_risk_premium * inputs.risk_premium_volatility))
        const randomTerminalGrowth = Math.max(0.005, Math.min(0.06, randomNormal(0.02, inputs.terminal_growth_volatility)))

        const simulationInputs = {
          ...inputs,
          ebitda: randomEbitda,
          beta: randomBeta,
          market_risk_premium: randomRiskPremium,
          terminal_growth: randomTerminalGrowth
        }

        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/valuation/TEST`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: 'TEST', inputs: simulationInputs }),
          })

          if (response.ok) {
            const data = await response.json()
            simulationResults.push({
              epv: data.epv,
              dcf: data.dcf_value,
              wacc: data.wacc,
              ebitda: randomEbitda,
              beta: randomBeta,
              terminal_growth: randomTerminalGrowth
            })
          }
        } catch (error) {
          console.warn(`Simulation ${i + 1} failed:`, error)
        }

        // Progress update (optional - could add progress bar)
        if ((i + 1) % 100 === 0) {
          console.log(`Completed ${i + 1} simulations`)
        }
      }

      setResults(simulationResults)
      calculateStatistics(simulationResults)

    } catch (error) {
      console.error('Monte Carlo simulation error:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStatistics = (simulationResults: SimulationResult[]) => {
    if (simulationResults.length === 0) return

    // EPV statistics
    const epvValues = simulationResults.map(r => r.epv).sort((a, b) => a - b)
    const epv_mean = epvValues.reduce((sum, val) => sum + val, 0) / epvValues.length
    const epv_std = Math.sqrt(epvValues.reduce((sum, val) => sum + Math.pow(val - epv_mean, 2), 0) / epvValues.length)
    const epv_median = epvValues[Math.floor(epvValues.length / 2)]
    const epv_var_95 = epvValues[Math.floor(epvValues.length * 0.05)]
    const epv_var_99 = epvValues[Math.floor(epvValues.length * 0.01)]

    // DCF statistics
    const dcfValues = simulationResults.map(r => r.dcf).sort((a, b) => a - b)
    const dcf_mean = dcfValues.reduce((sum, val) => sum + val, 0) / dcfValues.length
    const dcf_std = Math.sqrt(dcfValues.reduce((sum, val) => sum + Math.pow(val - dcf_mean, 2), 0) / dcfValues.length)
    const dcf_median = dcfValues[Math.floor(dcfValues.length / 2)]
    const dcf_var_95 = dcfValues[Math.floor(dcfValues.length * 0.05)]
    const dcf_var_99 = dcfValues[Math.floor(dcfValues.length * 0.01)]

    // Probability calculations
    const probability_positive_epv = simulationResults.filter(r => r.epv > 0).length / simulationResults.length
    const probability_positive_dcf = simulationResults.filter(r => r.dcf > 0).length / simulationResults.length

    setStats({
      epv_mean,
      epv_std,
      epv_min: Math.min(...epvValues),
      epv_max: Math.max(...epvValues),
      epv_median,
      epv_var_95,
      epv_var_99,
      dcf_mean,
      dcf_std,
      dcf_min: Math.min(...dcfValues),
      dcf_max: Math.max(...dcfValues),
      dcf_median,
      dcf_var_95,
      dcf_var_99,
      probability_positive_epv,
      probability_positive_dcf
    })

    // Create distribution data for charts
    const epvBuckets: { [key: string]: number } = {}
    const dcfBuckets: { [key: string]: number } = {}

    epvValues.forEach(val => {
      const bucket = Math.floor(val / 1000) * 1000 // $1000 buckets
      epvBuckets[bucket] = (epvBuckets[bucket] || 0) + 1
    })

    dcfValues.forEach(val => {
      const bucket = Math.floor(val / 1000) * 1000
      dcfBuckets[bucket] = (dcfBuckets[bucket] || 0) + 1
    })

    const distributionChartData = Object.keys(epvBuckets).map(bucket => ({
      bucket: parseInt(bucket),
      epv: epvBuckets[bucket],
      dcf: dcfBuckets[bucket] || 0
    })).sort((a, b) => a.bucket - b.bucket)

    setDistributionData(distributionChartData)
  }

  const updateInput = (key: keyof SimulationInputs, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

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
              <Zap className="w-8 h-8 text-indigo-500" />
              Monte Carlo Simulation
            </h1>
            <p className="text-muted-foreground">
              Probabilistic valuation analysis with uncertainty modeling
            </p>
          </div>
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
        {/* Input Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Base Assumptions</CardTitle>
            <CardDescription>Core financial inputs and volatility parameters</CardDescription>
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
              <Label htmlFor="ebitda_volatility">EBITDA Volatility: {formatNumber(inputs.ebitda_volatility * 100)}%</Label>
              <Slider
                value={[inputs.ebitda_volatility]}
                onValueChange={([value]) => updateInput('ebitda_volatility', value)}
                min={0.05}
                max={0.40}
                step={0.01}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="beta_volatility">Beta Volatility: ±{formatNumber(inputs.beta_volatility)}</Label>
              <Slider
                value={[inputs.beta_volatility]}
                onValueChange={([value]) => updateInput('beta_volatility', value)}
                min={0.05}
                max={0.30}
                step={0.01}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="terminal_growth_volatility">Terminal Growth Volatility: ±{formatNumber(inputs.terminal_growth_volatility * 100)}%</Label>
              <Slider
                value={[inputs.terminal_growth_volatility]}
                onValueChange={([value]) => updateInput('terminal_growth_volatility', value)}
                min={0.001}
                max={0.01}
                step={0.001}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="num_simulations">Number of Simulations</Label>
              <Select value={inputs.num_simulations.toString()} onValueChange={(value) => updateInput('num_simulations', Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1,000</SelectItem>
                  <SelectItem value="2000">2,000</SelectItem>
                  <SelectItem value="5000">5,000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={runSimulation} disabled={loading} className="w-full">
              {loading ? 'Running Simulation...' : `Run ${inputs.num_simulations} Simulations`}
            </Button>
          </CardContent>
        </Card>

        {/* Statistics Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Simulation Statistics</CardTitle>
            <CardDescription>Key statistical measures from Monte Carlo analysis</CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-6">
                {/* EPV Statistics */}
                <div>
                  <h4 className="font-medium mb-3">Enterprise Present Value (EPV)</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Mean:</span>
                      <span className="font-mono">{formatCurrency(stats.epv_mean, 'CAD')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Median:</span>
                      <span className="font-mono">{formatCurrency(stats.epv_median, 'CAD')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Std Dev:</span>
                      <span className="font-mono">{formatCurrency(stats.epv_std, 'CAD')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VaR 95%:</span>
                      <span className="font-mono text-red-600">{formatCurrency(stats.epv_var_95, 'CAD')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VaR 99%:</span>
                      <span className="font-mono text-red-600">{formatCurrency(stats.epv_var_99, 'CAD')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Positive Probability:</span>
                      <span className="font-mono">{formatNumber(stats.probability_positive_epv * 100)}%</span>
                    </div>
                  </div>
                </div>

                {/* DCF Statistics */}
                <div>
                  <h4 className="font-medium mb-3">Discounted Cash Flow (DCF)</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Mean:</span>
                      <span className="font-mono">{formatCurrency(stats.dcf_mean, 'CAD')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Median:</span>
                      <span className="font-mono">{formatCurrency(stats.dcf_median, 'CAD')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Std Dev:</span>
                      <span className="font-mono">{formatCurrency(stats.dcf_std, 'CAD')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VaR 95%:</span>
                      <span className="font-mono text-red-600">{formatCurrency(stats.dcf_var_95, 'CAD')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Positive Probability:</span>
                      <span className="font-mono">{formatNumber(stats.probability_positive_dcf * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Run Monte Carlo simulation to see statistics</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Assessment</CardTitle>
            <CardDescription>Probability analysis and risk metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-4">
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Value at Risk (VaR)</h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    95% confidence that valuation won't fall below {formatCurrency(Math.min(stats.epv_var_95, stats.dcf_var_95), 'CAD')}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Probability of Positive EPV:</span>
                    <span className="font-mono">{formatNumber(stats.probability_positive_epv * 100)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Probability of Positive DCF:</span>
                    <span className="font-mono">{formatNumber(stats.probability_positive_dcf * 100)}%</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Interpretation</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Higher VaR indicates lower risk</p>
                    <p>• Higher positive probability indicates more stable valuation</p>
                    <p>• Consider confidence intervals for investment decisions</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Run simulation to see risk assessment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results Visualization */}
      {distributionData.length > 0 && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Valuation Distribution</CardTitle>
              <CardDescription>Frequency distribution of simulation results</CardDescription>
            </CardHeader>
            <CardContent>
              <Chart>
                <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="bucket" tickFormatter={(value) => formatCurrency(value, 'CAD')} />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => value}
                    labelFormatter={(value) => `Bucket: ${formatCurrency(Number(value), 'CAD')}`}
                  />
                  <Bar dataKey="epv" fill="#0A84FF" name="EPV Frequency" />
                  <Bar dataKey="dcf" fill="#34C759" name="DCF Frequency" />
                </BarChart>
              </Chart>
            </CardContent>
          </Card>

          {/* Scatter Plot */}
          <Card>
            <CardHeader>
              <CardTitle>EPV vs DCF Correlation</CardTitle>
              <CardDescription>Relationship between valuation methods</CardDescription>
            </CardHeader>
            <CardContent>
              <Chart>
                <ScatterChart data={results.slice(0, 500)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis
                    dataKey="epv"
                    name="EPV"
                    tickFormatter={(value) => formatCurrency(value, 'CAD')}
                  />
                  <YAxis
                    dataKey="dcf"
                    name="DCF"
                    tickFormatter={(value) => formatCurrency(value, 'CAD')}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value, 'CAD'), name]}
                  />
                  <Scatter dataKey="dcf" fill="#0A84FF" />
                </ScatterChart>
              </Chart>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Methodology */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Methodology</CardTitle>
          <CardDescription>How Monte Carlo simulation works</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Simulation Process</h4>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Generate random values for key inputs using normal distributions</li>
                <li>Calculate valuation for each random scenario</li>
                <li>Repeat thousands of times to build probability distribution</li>
                <li>Analyze results to understand valuation uncertainty</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium mb-2">Key Assumptions</h4>
              <ul className="text-sm space-y-2 list-disc list-inside">
                <li>Normal distribution for input variables</li>
                <li>Independent input variables</li>
                <li>Constant volatility parameters</li>
                <li>No correlation between scenarios</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">Important Notes</p>
                <p className="text-blue-700 dark:text-blue-300">
                  Monte Carlo results depend on input assumptions and volatility estimates.
                  Real-world outcomes may differ due to unforeseen events and correlations.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          Monte Carlo simulation for probabilistic valuation analysis.
          Results show valuation uncertainty and risk metrics for better investment decision making.
        </p>
      </div>
    </div>
  )
}
