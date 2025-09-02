'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Chart,
  ChartTooltip,
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Cell
} from '@/components/ui/chart'
import { BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react'

interface KPIChartProps {
  kpis: Record<string, { value: number; unit: string }>
  title?: string
  description?: string
}

type ChartType = 'bar' | 'line' | 'area' | 'comparison'

export function KPIChart({ kpis, title = "KPI Overview", description }: KPIChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar')

  // Prepare data for charts
  const chartData = Object.entries(kpis).map(([key, data]) => ({
    name: key,
    value: data.value,
    unit: data.unit,
    displayValue: formatValue(data.value, data.unit)
  }))

  // Colors for different KPIs
  const colors = [
    '#0A84FF', // blue
    '#34C759', // green
    '#FF9500', // orange
    '#FF3B30', // red
    '#AF52DE', // purple
    '#30B0C7', // teal
    '#64D2FF', // light blue
    '#FFD60A', // yellow
  ]

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip
              formatter={(value: number, name: string, props: any) => [
                `${props.payload.displayValue} ${props.payload.unit}`,
                name
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0A84FF"
              strokeWidth={2}
              dot={{ fill: '#0A84FF', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip
              formatter={(value: number, name: string, props: any) => [
                `${props.payload.displayValue} ${props.payload.unit}`,
                name
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0A84FF"
              fill="#0A84FF40"
              strokeWidth={2}
            />
          </AreaChart>
        )

      case 'comparison':
        return (
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip
              formatter={(value: number, name: string, props: any) => [
                `${props.payload.displayValue} ${props.payload.unit}`,
                name
              ]}
            />
            {chartData.map((entry, index) => (
              <Bar key={entry.name} dataKey="value" fill={colors[index % colors.length]} />
            ))}
          </BarChart>
        )

      default: // bar
        return (
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip
              formatter={(value: number, name: string, props: any) => [
                `${props.payload.displayValue} ${props.payload.unit}`,
                name
              ]}
            />
            <Bar dataKey="value" fill="#0A84FF" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        )
    }
  }

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>No KPI data available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex gap-2">
            <Button
              variant={chartType === 'bar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('bar')}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
            >
              <TrendingUp className="w-4 h-4" />
            </Button>
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('area')}
            >
              <Activity className="w-4 h-4" />
            </Button>
            <Button
              variant={chartType === 'comparison' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('comparison')}
            >
              <PieChart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <Chart>
            {renderChart()}
          </Chart>
        </div>

        {/* KPI Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
          {chartData.map((kpi, index) => (
            <div key={kpi.name} className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">{kpi.name}</div>
              <div className="text-lg font-bold">{kpi.displayValue}</div>
              <Badge variant="outline" className="text-xs">
                {kpi.unit}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function formatValue(value: number, unit: string): string {
  if (unit.includes('million') || unit.includes('millions')) {
    return `$${(value / 1000).toFixed(1)}B`
  } else if (unit.includes('per share')) {
    return `$${value.toFixed(2)}`
  } else if (unit.includes('ratio') || unit.includes('rate')) {
    return `${(value * 100).toFixed(1)}%`
  } else {
    return value.toLocaleString()
  }
}
