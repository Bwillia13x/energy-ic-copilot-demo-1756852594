"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { Checkbox } from '@/components/ui/checkbox'
import {
  Chart,
  ChartTooltip,
  Bar,
  BarChart,
  XAxis,
  YAxis
} from '@/components/ui/chart'
import { GitCompare, TrendingUp, BarChart3 } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface CompanyData {
  ticker: string
  name: string
  kpis: Record<string, { value: number; unit: string }>
  currency?: string
  valuation?: {
    epv: number
    dcf_value: number
    ev_ebitda_ratio: number
  }
}

interface CompanyComparisonProps {
  companies: CompanyData[]
  selectedTickers?: string[]
  onSelectionChange?: (tickers: string[]) => void
  chartType?: 'bar' | 'valuation'
  comparisonMetric?: string
  onChartTypeChange?: (type: 'bar' | 'valuation') => void
  onComparisonMetricChange?: (metric: string) => void
}

export function CompanyComparison({
  companies,
  selectedTickers = [],
  onSelectionChange,
  chartType: chartTypeProp,
  comparisonMetric: comparisonMetricProp,
  onChartTypeChange,
  onComparisonMetricChange,
}: CompanyComparisonProps) {
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(selectedTickers)
  const [comparisonMetric, setComparisonMetric] = useState<string>(comparisonMetricProp || 'EBITDA')
  const [chartType, setChartType] = useState<'bar' | 'valuation'>(chartTypeProp || 'bar')

  useEffect(() => {
    setSelectedCompanies(selectedTickers)
  }, [selectedTickers])

  useEffect(() => {
    if (chartTypeProp && chartTypeProp !== chartType) setChartType(chartTypeProp)
  }, [chartTypeProp])

  useEffect(() => {
    if (comparisonMetricProp && comparisonMetricProp !== comparisonMetric) setComparisonMetric(comparisonMetricProp)
  }, [comparisonMetricProp])

  const handleCompanyToggle = (ticker: string) => {
    try {
      const newSelection = selectedCompanies.includes(ticker)
        ? selectedCompanies.filter(t => t !== ticker)
        : [...selectedCompanies, ticker]

      setSelectedCompanies(newSelection)
      onSelectionChange?.(newSelection)
    } catch (error) {
      console.error('Error updating selection:', error)
      // Show a toast or fallback UI instead of crashing
    }
  }

  const selectedCompanyData = companies.filter(company =>
    selectedCompanies.includes(company.ticker)
  )

  // Determine a display currency from selected companies
  const displayCurrency = (() => {
    const currencies = new Set(
      selectedCompanyData
        .map((c) => c.currency)
        .filter((c): c is string => !!c)
    )
    if (currencies.size === 1) return Array.from(currencies)[0]
    return 'USD'
  })()

  // Prepare comparison data
  const getValuationComparisonData = () => {
    return selectedCompanyData.map(company => ({
      name: company.ticker,
      EPV: company.valuation?.epv || 0,
      DCF: company.valuation?.dcf_value || 0,
      'EV/EBITDA': company.valuation?.ev_ebitda_ratio || 0
    }))
  }

  const getKPIComparisonData = () => {
    return selectedCompanyData.map(company => {
      const kpi = company.kpis?.[currentMetric]
      return {
        name: company.ticker,
        value: kpi?.value || 0,
        unit: kpi?.unit || '',
        formatted: kpi ? formatValue(kpi.value, kpi.unit) : 'N/A'
      }
    })
  }

  const comparisonData = chartType === 'valuation'
    ? getValuationComparisonData()
    : getKPIComparisonData()

  // Debug logging (remove after testing)
  // console.log('Chart Debug:', {
  //   selectedCompanies: selectedCompanies.length,
  //   selectedCompanyData: selectedCompanyData.length,
  //   comparisonData: comparisonData,
  //   chartType,
  //   comparisonMetric,
  //   availableMetrics
  // })

  const availableMetrics = Array.from(
    new Set(
      selectedCompanyData.flatMap(company =>
        Object.keys(company.kpis || {})
      )
    )
  ).sort()

  // Ensure we have a default metric if none available
  const defaultMetric = availableMetrics.length > 0 ? availableMetrics[0] : 'EBITDA'
  const currentMetric = comparisonMetric && availableMetrics.includes(comparisonMetric)
    ? comparisonMetric
    : defaultMetric

  // Update comparisonMetric if it changed
  if (currentMetric !== comparisonMetric) {
    setComparisonMetric(currentMetric)
  }

  if (companies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company Comparison</CardTitle>
          <CardDescription>No companies available for comparison</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="w-5 h-5" />
          Company Comparison
        </CardTitle>
        <CardDescription>
          Compare key metrics across selected companies
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Company Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">Select Companies to Compare:</h3>
          <div className="flex flex-wrap gap-2">
            {companies.map(company => (
              <div key={company.ticker} className="flex items-center space-x-2">
                <Checkbox
                  id={company.ticker}
                  checked={selectedCompanies.includes(company.ticker)}
                  onCheckedChange={() => handleCompanyToggle(company.ticker)}
                />
                <label
                  htmlFor={company.ticker}
                  className="text-sm font-medium cursor-pointer"
                >
                  {company.ticker} - {company.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {selectedCompanies.length < 2 && (
          <div className="text-center py-8 text-muted-foreground">
            Select at least 2 companies to compare
          </div>
        )}

        {selectedCompanies.length >= 2 && (
          <>
            {/* Metric and Chart Type Selection */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Chart Type:</label>
                <div className="flex gap-2">
                  <Button
                    variant={chartType === 'bar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setChartType('bar'); onChartTypeChange?.('bar') }}
                  >
                    <BarChart3 className="w-4 h-4 mr-1" />
                    KPI Comparison
                  </Button>
                  <Button
                    variant={chartType === 'valuation' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setChartType('valuation'); onChartTypeChange?.('valuation') }}
                  >
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Valuation
                  </Button>
                </div>
              </div>

              {chartType === 'bar' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Metric:</label>
                  <select
                    value={currentMetric}
                    onChange={(e) => { setComparisonMetric(e.target.value); onComparisonMetricChange?.(e.target.value) }}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    {availableMetrics.map(metric => (
                      <option key={metric} value={metric}>{metric}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Comparison Chart */}
            <div className="w-full h-80 mb-6 border rounded-lg p-4 bg-background" style={{ minHeight: '320px' }}>
              {comparisonData.length > 0 && (
                chartType === 'valuation'
                  ? (comparisonData as any[]).some((d: any) => d.EPV !== 0 || d.DCF !== 0)
                  : (comparisonData as any[]).some((d: any) => d.value !== 0)
              ) ? (
                <Chart>
                  <BarChart
                    data={comparisonData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) =>
                        chartType === 'valuation'
                          ? formatCurrency(value, displayCurrency)
                          : value.toLocaleString()
                      }
                    />
                    <ChartTooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      formatter={(value: number, name: string, props: any) => {
                        if (chartType === 'valuation') {
                          return [formatCurrency(value, displayCurrency), name]
                        }
                        return [props.payload?.formatted || value.toLocaleString(), currentMetric]
                      }}
                    />
                    {chartType === 'valuation' ? (
                      <>
                        <Bar dataKey="EPV" fill="#0A84FF" name="EPV" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="DCF" fill="#34C759" name="DCF" radius={[2, 2, 0, 0]} />
                      </>
                    ) : (
                      <Bar dataKey="value" fill="#0A84FF" radius={[4, 4, 0, 0]} />
                    )}
                  </BarChart>
                </Chart>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>
                      {comparisonData.length === 0
                        ? "No data available for selected companies"
                        : "No data available for selected metric"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Detailed Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border rounded-md overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border p-2 text-left">Company</th>
                    {chartType === 'valuation' ? (
                      <>
                        <th className="border border-border p-2 text-right">EPV</th>
                        <th className="border border-border p-2 text-right">DCF</th>
                        <th className="border border-border p-2 text-right">EV/EBITDA</th>
                      </>
                    ) : (
                      <th className="border border-border p-2 text-right">{currentMetric}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((company, index) => (
                    <tr key={company.name} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                      <td className="border border-border p-2 font-medium">
                        {company.name}
                      </td>
                      {chartType === 'valuation' ? (
                        <>
                          <td className="border border-border p-2 text-right">
                            {formatCurrency((company as any).EPV, displayCurrency)}
                          </td>
                          <td className="border border-border p-2 text-right">
                            {formatCurrency((company as any).DCF, displayCurrency)}
                          </td>
                          <td className="border border-border p-2 text-right">
                            {formatNumber((company as any)['EV/EBITDA'])}x
                          </td>
                        </>
                      ) : (
                        <td className="border border-border p-2 text-right">
                          {(company as any).formatted}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function formatValue(value: number, unit: string): string {
  if (unit.includes('million') || unit.includes('millions')) {
    return `$${(value / 1000).toFixed(1)}B`
  } else if (unit.includes('per share')) {
    return `$${value.toFixed(2)}`
  } else {
    return value.toLocaleString()
  }
}
