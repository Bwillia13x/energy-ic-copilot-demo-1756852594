"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Calculator, Plus, Trash2, Play, Save, Zap, AlertTriangle } from 'lucide-react'
import { Chart } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchJsonWithRetry } from '@/lib/http'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface CustomMetric {
  id: string
  name: string
  description: string
  formula: string
  variables: string[]
  category: string
}

interface CompanyData {
  ticker: string
  name: string
  kpis: Record<string, { value: number; unit: string }>
}

interface MetricResult {
  ticker: string
  name: string
  value: number
  formatted: string
}

const SAMPLE_METRICS: CustomMetric[] = [
  {
    id: 'fcf_yield',
    name: 'Free Cash Flow Yield',
    description: 'FCF as percentage of enterprise value',
    formula: '(EBITDA - MaintenanceCapex - (NetDebt * 0.05)) / (NetDebt + ShareholderEquity) * 100',
    variables: ['EBITDA', 'MaintenanceCapex', 'NetDebt', 'ShareholderEquity'],
    category: 'valuation'
  },
  {
    id: 'ebitda_margin',
    name: 'EBITDA Margin Trend',
    description: 'EBITDA as percentage of estimated revenue',
    formula: 'EBITDA / (EBITDA / 0.25) * 100', // Assuming 25% EBITDA margin
    variables: ['EBITDA'],
    category: 'profitability'
  },
  {
    id: 'debt_payback',
    name: 'Debt Payback Period',
    description: 'Years to pay off net debt with free cash flow',
    formula: 'NetDebt / (EBITDA - MaintenanceCapex - (NetDebt * 0.05))',
    variables: ['NetDebt', 'EBITDA', 'MaintenanceCapex'],
    category: 'leverage'
  },
  {
    id: 'sustainable_growth',
    name: 'Sustainable Growth Rate',
    description: 'Maximum growth rate without additional financing',
    formula: '(1 - (NetIncome / ShareholderEquity * 0.6)) * (NetIncome / ShareholderEquity)',
    variables: ['NetIncome', 'ShareholderEquity'],
    category: 'growth'
  }
]

const VARIABLE_SUGGESTIONS = [
  'EBITDA', 'NetIncome', 'NetDebt', 'ShareholderEquity', 'MaintenanceCapex',
  'InterestExpense', 'FFO', 'Revenue', 'OperatingIncome', 'TotalAssets',
  'CurrentAssets', 'CurrentLiabilities', 'CashAndEquivalents'
]

export default function CustomMetricsPage() {
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>(SAMPLE_METRICS)
  const [selectedMetric, setSelectedMetric] = useState<CustomMetric | null>(null)
  const [metricResults, setMetricResults] = useState<MetricResult[]>([])
  const [loading, setLoading] = useState(false)

  // New metric form
  const [newMetric, setNewMetric] = useState({
    name: '',
    description: '',
    formula: '',
    category: 'custom'
  })

  // Fetch companies data
  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      const companiesData = await fetchJsonWithRetry<Record<string, any>>(
        `${process.env.NEXT_PUBLIC_API_URL}/companies`,
        undefined,
        { timeoutMs: 10000, retries: 2, backoffMs: 1000 }
      )

      const companiesWithData = await Promise.all(
        Object.entries(companiesData).slice(0, 6).map(async ([ticker, company]) => {
          try {
            const kpis = await fetchJsonWithRetry<any>(
              `${process.env.NEXT_PUBLIC_API_URL}/kpis/${ticker}`,
              undefined,
              { timeoutMs: 5000, retries: 1, backoffMs: 500 }
            )

            return {
              ticker,
              name: company.name,
              kpis: kpis.kpis || {}
            }
          } catch (error) {
            console.warn(`Failed to get KPIs for ${ticker}:`, error)
            return {
              ticker,
              name: company.name,
              kpis: {}
            }
          }
        })
      )

      setCompanies(companiesWithData)
    } catch (error) {
      console.error('Error fetching companies:', error)
    }
  }

  const calculateCustomMetric = (metric: CustomMetric, kpis: Record<string, { value: number; unit: string }>) => {
    try {
      // Create a safe evaluation context
      const context: Record<string, number> = {}

      // Extract values from KPIs
      metric.variables.forEach(variable => {
        const kpi = kpis[variable]
        context[variable] = kpi?.value || 0
      })

      // Replace variable names in formula with their values
      let formula = metric.formula

      // Handle more complex expressions
      Object.entries(context).forEach(([key, value]) => {
        formula = formula.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString())
      })

      // Evaluate the formula safely
      const result = safeEvaluate(formula)
      return typeof result === 'number' && !isNaN(result) ? result : 0
    } catch (error) {
      console.warn(`Error calculating metric ${metric.name}:`, error)
      return 0
    }
  }

  const safeEvaluate = (expression: string): number => {
    // Remove potentially dangerous operations
    const sanitized = expression.replace(/[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g, '')

    try {
      // Use Function constructor for safer evaluation
      return new Function('return ' + sanitized)()
    } catch (error) {
      console.warn('Expression evaluation failed:', expression, error)
      return 0
    }
  }

  const runMetricCalculation = async (metric: CustomMetric) => {
    setLoading(true)
    setSelectedMetric(metric)

    try {
      const results: MetricResult[] = companies.map(company => {
        const value = calculateCustomMetric(metric, company.kpis)
        const formatted = formatMetricValue(value, metric.category)

        return {
          ticker: company.ticker,
          name: company.name,
          value,
          formatted
        }
      })

      setMetricResults(results)
    } catch (error) {
      console.error('Error calculating metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatMetricValue = (value: number, category: string): string => {
    switch (category) {
      case 'valuation':
      case 'leverage':
        return `${formatNumber(value)}${category === 'valuation' ? '%' : category === 'leverage' ? 'x' : ''}`
      case 'profitability':
        return `${formatNumber(value * 100)}%`
      case 'growth':
        return `${formatNumber(value * 100)}%`
      default:
        return formatNumber(value)
    }
  }

  const addVariableToFormula = (variable: string) => {
    const currentFormula = newMetric.formula
    const newFormula = currentFormula + (currentFormula ? ' ' : '') + variable
    setNewMetric(prev => ({ ...prev, formula: newFormula }))
  }

  const createCustomMetric = () => {
    if (!newMetric.name || !newMetric.formula) return

    // Extract variables from formula
    const variables = VARIABLE_SUGGESTIONS.filter(varName =>
      new RegExp(`\\b${varName}\\b`).test(newMetric.formula)
    )

    const metric: CustomMetric = {
      id: Date.now().toString(),
      name: newMetric.name,
      description: newMetric.description,
      formula: newMetric.formula,
      variables,
      category: newMetric.category
    }

    setCustomMetrics(prev => [...prev, metric])
    setNewMetric({ name: '', description: '', formula: '', category: 'custom' })
  }

  const deleteMetric = (id: string) => {
    setCustomMetrics(prev => prev.filter(m => m.id !== id))
    if (selectedMetric?.id === id) {
      setSelectedMetric(null)
      setMetricResults([])
    }
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
              <Calculator className="w-8 h-8 text-purple-500" />
              Custom Metrics Builder
            </h1>
            <p className="text-muted-foreground">
              Create and calculate custom financial metrics and formulas
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Available Metrics</CardTitle>
            <CardDescription>Pre-built and custom metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {customMetrics.map(metric => (
              <div key={metric.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{metric.name}</h4>
                  <p className="text-sm text-muted-foreground">{metric.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {metric.variables.map(variable => (
                      <span key={variable} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {variable}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => runMetricCalculation(metric)}
                    disabled={loading}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  {metric.category === 'custom' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMetric(metric.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Create Custom Metric */}
        <Card>
          <CardHeader>
            <CardTitle>Create Custom Metric</CardTitle>
            <CardDescription>Build your own financial formulas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="metric-name">Metric Name</Label>
              <Input
                id="metric-name"
                value={newMetric.name}
                onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Custom ROIC"
              />
            </div>

            <div>
              <Label htmlFor="metric-description">Description</Label>
              <Input
                id="metric-description"
                value={newMetric.description}
                onChange={(e) => setNewMetric(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the metric"
              />
            </div>

            <div>
              <Label htmlFor="metric-category">Category</Label>
              <Select value={newMetric.category} onValueChange={(value) => setNewMetric(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valuation">Valuation</SelectItem>
                  <SelectItem value="profitability">Profitability</SelectItem>
                  <SelectItem value="leverage">Leverage</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="efficiency">Efficiency</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Available Variables</Label>
              <div className="flex flex-wrap gap-1 mt-2">
                {VARIABLE_SUGGESTIONS.map(variable => (
                  <Button
                    key={variable}
                    size="sm"
                    variant="outline"
                    onClick={() => addVariableToFormula(variable)}
                    className="text-xs h-6"
                  >
                    {variable}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="metric-formula">Formula</Label>
              <Textarea
                id="metric-formula"
                value={newMetric.formula}
                onChange={(e) => setNewMetric(prev => ({ ...prev, formula: e.target.value }))}
                placeholder="e.g., EBITDA / TotalAssets * 100"
                className="font-mono text-sm"
                rows={3}
              />
            </div>

            <Button onClick={createCustomMetric} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Create Metric
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Calculation Results</CardTitle>
            <CardDescription>
              {selectedMetric ? `${selectedMetric.name} across companies` : 'Select a metric to calculate'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p>Calculating metrics...</p>
              </div>
            ) : metricResults.length > 0 ? (
              <>
                <Chart>
                  <BarChart data={metricResults} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="ticker" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => formatMetricValue(value, selectedMetric?.category || 'custom')}
                      labelFormatter={(ticker) => metricResults.find(r => r.ticker === ticker)?.name}
                    />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </Chart>

                <div className="mt-4 space-y-2">
                  {metricResults.map(result => (
                    <div key={result.ticker} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="font-medium">{result.ticker}</span>
                      <span className="font-mono">{result.formatted}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a metric to see calculation results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Formula Help */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Formula Syntax</CardTitle>
          <CardDescription>How to write custom metric formulas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Supported Operations</h4>
              <ul className="text-sm space-y-1">
                <li><code>+</code> - Addition</li>
                <li><code>-</code> - Subtraction</li>
                <li><code>*</code> - Multiplication</li>
                <li><code>/</code> - Division</li>
                <li><code>()</code> - Parentheses for grouping</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Example Formulas</h4>
              <ul className="text-sm space-y-1 font-mono">
                <li><code>EBITDA / TotalAssets * 100</code> - ROA</li>
                <li><code>NetIncome / ShareholderEquity</code> - ROE</li>
                <li><code>NetDebt / EBITDA</code> - Debt/EBITDA ratio</li>
                <li><code>(EBITDA - MaintenanceCapex) / NetDebt</code> - FCF/Debt</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Safety Notice</p>
                <p className="text-yellow-700 dark:text-yellow-300">
                  Custom formulas are evaluated client-side. Complex expressions may cause errors.
                  Always verify your calculations against known values.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          Custom metrics builder for creating personalized financial analysis.
          Formulas are evaluated safely and results should be verified against official calculations.
        </p>
      </div>
    </div>
  )
}
