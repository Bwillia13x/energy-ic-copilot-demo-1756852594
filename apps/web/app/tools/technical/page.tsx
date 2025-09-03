"use client"

import { useState, useEffect } from 'react'

// Force dynamic rendering to avoid SSR context issues
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, TrendingUp, BarChart3, LineChart, Activity, Target } from 'lucide-react'
import { Chart } from '@/components/ui/chart'
import { LineChart as RechartsLineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/utils'

// Mock technical data - in a real app, this would come from a financial data API
const generateMockPriceData = (ticker: string, days: number = 90) => {
  const basePrice = ticker === 'PPL' ? 45 : ticker === 'ENB' ? 40 : ticker === 'TRP' ? 50 : 35
  const volatility = 0.02 // 2% daily volatility

  const data = []
  let price = basePrice

  for (let i = days; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    // Add some trend and randomness
    const trend = i > days/2 ? 0.001 : -0.0005 // Slight upward trend in first half
    const randomChange = (Math.random() - 0.5) * volatility
    price = price * (1 + trend + randomChange)

    // Calculate technical indicators
    const sma20 = i < 20 ? null : price * (1 + (Math.random() - 0.5) * 0.01)
    const sma50 = i < 50 ? null : price * (1 + (Math.random() - 0.5) * 0.005)
    const rsi = 30 + Math.random() * 40 // Random RSI between 30-70

    data.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(price * 100) / 100,
      volume: Math.floor(Math.random() * 1000000) + 500000,
      sma20: sma20 ? Math.round(sma20 * 100) / 100 : null,
      sma50: sma50 ? Math.round(sma50 * 100) / 100 : null,
      rsi: Math.round(rsi * 100) / 100,
      macd: Math.round((price - (price * 0.98)) * 100) / 100,
      upperBB: Math.round(price * 1.05 * 100) / 100,
      lowerBB: Math.round(price * 0.95 * 100) / 100
    })
  }

  return data.reverse()
}

interface TechnicalIndicator {
  id: string
  name: string
  description: string
  type: 'overlay' | 'oscillator'
  color: string
}

const TECHNICAL_INDICATORS: TechnicalIndicator[] = [
  { id: 'sma20', name: 'SMA 20', description: '20-day Simple Moving Average', type: 'overlay', color: '#0A84FF' },
  { id: 'sma50', name: 'SMA 50', description: '50-day Simple Moving Average', type: 'overlay', color: '#34C759' },
  { id: 'bollinger', name: 'Bollinger Bands', description: 'Price volatility bands', type: 'overlay', color: '#FF9500' },
  { id: 'rsi', name: 'RSI', description: 'Relative Strength Index', type: 'oscillator', color: '#AF52DE' },
  { id: 'macd', name: 'MACD', description: 'Moving Average Convergence Divergence', type: 'oscillator', color: '#FF3B30' }
]

export default function TechnicalAnalysisPage() {
  const [companies] = useState([
    { ticker: 'PPL', name: 'Pembina Pipeline' },
    { ticker: 'ENB', name: 'Enbridge Inc.' },
    { ticker: 'TRP', name: 'TC Energy' },
    { ticker: 'KEY', name: 'Keyera Corp.' }
  ])

  const [selectedTicker, setSelectedTicker] = useState('PPL')
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(['sma20'])
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y'>('3M')
  const [chartType, setChartType] = useState<'price' | 'volume' | 'indicators'>('price')
  const [priceData, setPriceData] = useState<any[]>([])

  // Load data when ticker or timeframe changes
  useEffect(() => {
    const days = timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '6M' ? 180 : 365
    const data = generateMockPriceData(selectedTicker, days)
    setPriceData(data)
  }, [selectedTicker, timeframe])

  const toggleIndicator = (indicatorId: string) => {
    setSelectedIndicators(prev =>
      prev.includes(indicatorId)
        ? prev.filter(id => id !== indicatorId)
        : [...prev, indicatorId]
    )
  }

  const getLatestMetrics = () => {
    if (priceData.length === 0) return null

    const latest = priceData[priceData.length - 1]
    const previous = priceData[priceData.length - 2]

    const priceChange = previous ? ((latest.price - previous.price) / previous.price) * 100 : 0
    const volumeChange = previous ? ((latest.volume - previous.volume) / previous.volume) * 100 : 0

    return {
      price: latest.price,
      priceChange,
      volume: latest.volume,
      volumeChange,
      sma20: latest.sma20,
      sma50: latest.sma50,
      rsi: latest.rsi
    }
  }

  const metrics = getLatestMetrics()

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
              <BarChart3 className="w-8 h-8 text-orange-500" />
              Technical Analysis
            </h1>
            <p className="text-muted-foreground">
              Stock charts with technical indicators and price analysis
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <Label htmlFor="company-select">Company:</Label>
          <Select value={selectedTicker} onValueChange={setSelectedTicker}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {companies.map(company => (
                <SelectItem key={company.ticker} value={company.ticker}>
                  {company.ticker} - {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="timeframe-select">Timeframe:</Label>
          <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1M">1 Month</SelectItem>
              <SelectItem value="3M">3 Months</SelectItem>
              <SelectItem value="6M">6 Months</SelectItem>
              <SelectItem value="1Y">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Chart Type:</Label>
          <div className="flex gap-2 mt-1">
            <Button
              size="sm"
              variant={chartType === 'price' ? 'default' : 'outline'}
              onClick={() => setChartType('price')}
            >
              <LineChart className="w-4 h-4 mr-1" />
              Price
            </Button>
            <Button
              size="sm"
              variant={chartType === 'volume' ? 'default' : 'outline'}
              onClick={() => setChartType('volume')}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Volume
            </Button>
          </div>
        </div>

        <div>
          <Label>Active Indicators:</Label>
          <div className="text-sm text-muted-foreground mt-1">
            {selectedIndicators.length} selected
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Technical Indicators */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Indicators</CardTitle>
            <CardDescription>Select indicators to display</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {TECHNICAL_INDICATORS.map(indicator => (
              <div key={indicator.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={indicator.id}
                    checked={selectedIndicators.includes(indicator.id)}
                    onChange={() => toggleIndicator(indicator.id)}
                    className="rounded"
                  />
                  <div>
                    <Label htmlFor={indicator.id} className="text-sm font-medium cursor-pointer">
                      {indicator.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">{indicator.description}</p>
                  </div>
                </div>
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: indicator.color }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Main Chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{selectedTicker} Technical Analysis</CardTitle>
              <CardDescription>
                {timeframe} timeframe with {selectedIndicators.length} indicator{selectedIndicators.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                {chartType === 'price' ? (
                  <Chart>
                    <RechartsLineChart data={priceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis dataKey="date" />
                      <YAxis domain={['dataMin * 0.95', 'dataMax * 1.05']} />
                      <Tooltip
                        formatter={(value: any) => formatCurrency(value, 'CAD')}
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                      <Line type="monotone" dataKey="price" stroke="#0A84FF" strokeWidth={2} dot={false} />
                      {selectedIndicators.includes('sma20') && (
                        <Line type="monotone" dataKey="sma20" stroke="#34C759" strokeWidth={1} dot={false} />
                      )}
                      {selectedIndicators.includes('sma50') && (
                        <Line type="monotone" dataKey="sma50" stroke="#FF9500" strokeWidth={1} dot={false} />
                      )}
                    </RechartsLineChart>
                  </Chart>
                ) : (
                  <Chart>
                    <BarChart data={priceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: any) => value.toLocaleString()}
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                      <Bar dataKey="volume" fill="#0A84FF" />
                    </BarChart>
                  </Chart>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Key Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Key Metrics</CardTitle>
            <CardDescription>Latest technical data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">Price</span>
                    <span className="font-mono font-medium">{formatCurrency(metrics.price, 'CAD')}</span>
                  </div>
                  <div className="text-xs" style={{ color: metrics.priceChange >= 0 ? '#34C759' : '#FF3B30' }}>
                    {metrics.priceChange >= 0 ? '+' : ''}{formatNumber(metrics.priceChange)}%
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">Volume</span>
                    <span className="font-mono font-medium">{formatNumber(metrics.volume / 1000)}K</span>
                  </div>
                  <div className="text-xs" style={{ color: metrics.volumeChange >= 0 ? '#34C759' : '#FF3B30' }}>
                    {metrics.volumeChange >= 0 ? '+' : ''}{formatNumber(metrics.volumeChange)}%
                  </div>
                </div>

                {selectedIndicators.includes('sma20') && metrics.sma20 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-muted-foreground">SMA 20</span>
                      <span className="font-mono font-medium">{formatCurrency(metrics.sma20, 'CAD')}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {metrics.price > metrics.sma20 ? 'Above' : 'Below'} average
                    </div>
                  </div>
                )}

                {selectedIndicators.includes('rsi') && metrics.rsi && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-muted-foreground">RSI</span>
                      <span className="font-mono font-medium">{formatNumber(metrics.rsi)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {metrics.rsi > 70 ? 'Overbought' : metrics.rsi < 30 ? 'Oversold' : 'Neutral'}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Trading Signals */}
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Technical Signals</h4>
              <div className="space-y-2">
                {metrics?.sma20 && metrics?.sma50 && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${metrics.price > metrics.sma20 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>{metrics.price > metrics.sma20 ? 'Bullish' : 'Bearish'} (vs SMA20)</span>
                  </div>
                )}

                {metrics?.rsi && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${metrics.rsi < 70 && metrics.rsi > 30 ? 'bg-yellow-500' : metrics.rsi >= 70 ? 'bg-red-500' : 'bg-green-500'}`} />
                    <span>RSI: {metrics.rsi >= 70 ? 'Overbought' : metrics.rsi <= 30 ? 'Oversold' : 'Neutral'}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Price Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Price Statistics</CardTitle>
            <CardDescription>Statistical analysis of price movements</CardDescription>
          </CardHeader>
          <CardContent>
            {priceData.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">High (Period):</span>
                  <span className="font-mono">{formatCurrency(Math.max(...priceData.map(d => d.price)), 'CAD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Low (Period):</span>
                  <span className="font-mono">{formatCurrency(Math.min(...priceData.map(d => d.price)), 'CAD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Volume:</span>
                  <span className="font-mono">{formatNumber(priceData.reduce((sum, d) => sum + d.volume, 0) / priceData.length / 1000)}K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Volatility (Std Dev):</span>
                  <span className="font-mono">{formatNumber(2.5)}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Indicator Explanations */}
        <Card>
          <CardHeader>
            <CardTitle>Understanding Indicators</CardTitle>
            <CardDescription>What these technical indicators mean</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm">SMA (Simple Moving Average)</h4>
                <p className="text-xs text-muted-foreground">
                  Average price over a specific period. Used to identify trends and support/resistance levels.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-sm">RSI (Relative Strength Index)</h4>
                <p className="text-xs text-muted-foreground">
                  Momentum oscillator measuring speed and change of price movements. Above 70 = overbought, below 30 = oversold.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-sm">Volume</h4>
                <p className="text-xs text-muted-foreground">
                  Number of shares traded. High volume often confirms the strength of a price move.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          Technical analysis tools for stock price analysis and trading signals.
          This is for educational purposes and should not be considered investment advice.
        </p>
      </div>
    </div>
  )
}


