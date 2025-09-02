'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Chart,
  ChartTooltip,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Cell
} from '@/components/ui/chart'
import { TrendingUp, DollarSign, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ValuationChartProps {
  baseValuation: {
    epv: number
    dcf_value: number
  }
  scenarioValuation?: {
    epv: number
    dcf_value: number
  }
  scenarioName?: string
  currency?: string
}

export function ValuationChart({
  baseValuation,
  scenarioValuation,
  scenarioName = "Scenario",
  currency = "CAD"
}: ValuationChartProps) {
  const chartData = [
    {
      name: 'EPV',
      base: baseValuation.epv,
      scenario: scenarioValuation?.epv || baseValuation.epv,
      difference: scenarioValuation ? scenarioValuation.epv - baseValuation.epv : 0
    },
    {
      name: 'DCF',
      base: baseValuation.dcf_value,
      scenario: scenarioValuation?.dcf_value || baseValuation.dcf_value,
      difference: scenarioValuation ? scenarioValuation.dcf_value - baseValuation.dcf_value : 0
    }
  ]

  const getDifferenceColor = (difference: number) => {
    if (difference > 0) return '#10b981' // green
    if (difference < 0) return '#ef4444' // red
    return '#6b7280' // gray
  }

  const getDifferenceText = (difference: number) => {
    if (difference === 0) return 'No change'
    const sign = difference > 0 ? '+' : ''
    const percentChange = baseValuation.epv !== 0 ? (difference / baseValuation.epv) * 100 : 0
    return `${sign}${formatCurrency(difference, currency)} (${percentChange.toFixed(1)}%)`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Valuation Comparison
        </CardTitle>
        <CardDescription>
          Compare base case vs {scenarioName.toLowerCase()} valuation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 mb-6">
          <Chart>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis
                tickFormatter={(value) => formatCurrency(value / 1000, currency) + 'B'}
              />
              <ChartTooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value, currency),
                  name === 'base' ? 'Base Case' : scenarioName
                ]}
              />
              <Bar dataKey="base" fill="#0A84FF" name="base" />
              {scenarioValuation && (
                <Bar dataKey="scenario" fill="#34C759" name="scenario" />
              )}
            </BarChart>
          </Chart>
        </div>

        {/* Valuation Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {chartData.map((item) => (
            <div key={item.name} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{item.name} Valuation</h3>
                <Badge variant={item.difference === 0 ? "secondary" : item.difference > 0 ? "default" : "destructive"}>
                  {item.difference === 0 ? "Base" : scenarioName}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Case:</span>
                  <span className="font-medium">{formatCurrency(item.base, currency)}</span>
                </div>

                {scenarioValuation && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{scenarioName}:</span>
                      <span className="font-medium">{formatCurrency(item.scenario, currency)}</span>
                    </div>

                    <div className="flex justify-between text-sm pt-1 border-t">
                      <span className="text-muted-foreground">Difference:</span>
                      <span
                        className="font-medium"
                        style={{ color: getDifferenceColor(item.difference) }}
                      >
                        {getDifferenceText(item.difference)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Key Metrics Summary */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Key Valuation Insights
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">EV/EBITDA:</span>
              <span className="ml-2 font-medium">
                {(baseValuation.epv / 3450).toFixed(1)}x
              </span>
            </div>

            <div>
              <span className="text-muted-foreground">DCF Premium:</span>
              <span className="ml-2 font-medium">
                {(((baseValuation.dcf_value - baseValuation.epv) / baseValuation.epv) * 100).toFixed(1)}%
              </span>
            </div>

            <div>
              <span className="text-muted-foreground">Valuation Range:</span>
              <span className="ml-2 font-medium">
                {formatCurrency(Math.min(baseValuation.epv, baseValuation.dcf_value), currency)} - {formatCurrency(Math.max(baseValuation.epv, baseValuation.dcf_value), currency)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
