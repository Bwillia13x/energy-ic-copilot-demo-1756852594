"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, BarChart3, TrendingUp, Target, AlertCircle, CheckCircle } from 'lucide-react'
import { Chart } from '@/components/ui/chart'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { fetchJsonWithRetry } from '@/lib/http'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface CompanyRatios {
  ticker: string
  name: string
  ratios: {
    profitability: {
      roa: number
      roe: number
      roic: number
      gross_margin: number
      operating_margin: number
      net_margin: number
    }
    liquidity: {
      current_ratio: number
      quick_ratio: number
      cash_ratio: number
    }
    leverage: {
      debt_to_equity: number
      debt_to_assets: number
      interest_coverage: number
    }
    efficiency: {
      asset_turnover: number
      inventory_turnover: number
      receivables_turnover: number
    }
    valuation: {
      pe_ratio: number
      pb_ratio: number
      ev_ebitda: number
      dividend_yield: number
    }
  }
}

interface IndustryBenchmarks {
  profitability: { roa: number, roe: number, roic: number }
  liquidity: { current_ratio: number, quick_ratio: number }
  leverage: { debt_to_equity: number, interest_coverage: number }
  efficiency: { asset_turnover: number }
  valuation: { pe_ratio: number, pb_ratio: number, ev_ebitda: number }
}

const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmarks> = {
  'energy': {
    profitability: { roa: 0.08, roe: 0.12, roic: 0.10 },
    liquidity: { current_ratio: 1.2, quick_ratio: 0.8 },
    leverage: { debt_to_equity: 0.8, interest_coverage: 4.0 },
    efficiency: { asset_turnover: 0.6 },
    valuation: { pe_ratio: 15, pb_ratio: 1.8, ev_ebitda: 8.5 }
  },
  'utilities': {
    profitability: { roa: 0.04, roe: 0.08, roic: 0.06 },
    liquidity: { current_ratio: 1.0, quick_ratio: 0.6 },
    leverage: { debt_to_equity: 1.2, interest_coverage: 3.5 },
    efficiency: { asset_turnover: 0.4 },
    valuation: { pe_ratio: 18, pb_ratio: 1.5, ev_ebitda: 9.2 }
  },
  'infrastructure': {
    profitability: { roa: 0.06, roe: 0.10, roic: 0.08 },
    liquidity: { current_ratio: 1.1, quick_ratio: 0.7 },
    leverage: { debt_to_equity: 1.0, interest_coverage: 3.8 },
    efficiency: { asset_turnover: 0.5 },
    valuation: { pe_ratio: 16, pb_ratio: 1.6, ev_ebitda: 8.8 }
  }
}

export default function FinancialRatiosPage() {
  const [companies, setCompanies] = useState<CompanyRatios[]>([])
  const [selectedTicker, setSelectedTicker] = useState<string>('')
  const [selectedIndustry, setSelectedIndustry] = useState<string>('energy')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'trends'>('overview')

  // Fetch companies data
  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      // Get all companies
      const companiesData = await fetchJsonWithRetry<Record<string, any>>(
        `${process.env.NEXT_PUBLIC_API_URL}/companies`,
        undefined,
        { timeoutMs: 10000, retries: 2, backoffMs: 1000 }
      )

      // Get ratios for each company
      const companiesWithRatios = await Promise.all(
        Object.entries(companiesData).slice(0, 5).map(async ([ticker, company]) => {
          try {
            const kpis = await fetchJsonWithRetry<any>(
              `${process.env.NEXT_PUBLIC_API_URL}/kpis/${ticker}`,
              undefined,
              { timeoutMs: 5000, retries: 1, backoffMs: 500 }
            )

            const ratios = calculateRatios(kpis.kpis || {})
            return {
              ticker,
              name: company.name,
              ratios
            }
          } catch (error) {
            console.warn(`Failed to get ratios for ${ticker}:`, error)
            return {
              ticker,
              name: company.name,
              ratios: getDefaultRatios()
            }
          }
        })
      )

      setCompanies(companiesWithRatios)
      if (companiesWithRatios.length > 0) {
        setSelectedTicker(companiesWithRatios[0].ticker)
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateRatios = (kpis: Record<string, any>) => {
    const ebitda = kpis.EBITDA?.value || 0
    const netIncome = kpis.NetIncome?.value || 0
    const totalAssets = (kpis.NetDebt?.value || 0) + (kpis.ShareholderEquity?.value || 10000)
    const totalEquity = kpis.ShareholderEquity?.value || 10000
    const netDebt = kpis.NetDebt?.value || 0
    const interestExpense = kpis.InterestExpense?.value || 0
    const ffo = kpis.FFO?.value || 0

    // More accurate estimates
    const currentAssets = totalAssets * 0.6 // Estimate
    const currentLiabilities = totalAssets * 0.4 // Estimate
    const cash = currentAssets * 0.3 // Estimate
    // const inventory = currentAssets * 0.2 // Estimate inventory as 20% of current assets
    const receivables = currentAssets * 0.3 // Estimate receivables

    // Use FFO if available, otherwise estimate revenue from EBITDA
    const revenue = ffo > 0 ? ffo * 1.5 : (ebitda > 0 ? ebitda / 0.25 : 0) // Estimate from EBITDA margin

    // Calculate NOPAT for ROIC
    const taxRate = 0.25 // Assume 25% tax rate
    const normalizedEBIT = ebitda - (kpis.MaintenanceCapex?.value || ebitda * 0.1)
    const nopat = normalizedEBIT * (1 - taxRate)

    // Invested capital = Total Assets - Current Liabilities (simplified)
    const investedCapital = totalAssets - currentLiabilities

    return {
      profitability: {
        roa: totalAssets > 0 ? netIncome / totalAssets : 0,
        roe: totalEquity > 0 ? netIncome / totalEquity : 0,
        roic: investedCapital > 0 ? nopat / investedCapital : 0,
        gross_margin: revenue > 0 ? (revenue - (kpis.MaintenanceCapex?.value || 0)) / revenue : 0,
        operating_margin: revenue > 0 ? ebitda / revenue : 0,
        net_margin: revenue > 0 ? netIncome / revenue : 0
      },
      liquidity: {
        current_ratio: currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
        quick_ratio: currentLiabilities > 0 ? (cash + receivables) / currentLiabilities : 0,
        cash_ratio: currentLiabilities > 0 ? cash / currentLiabilities : 0
      },
      leverage: {
        debt_to_equity: totalEquity > 0 ? netDebt / totalEquity : 0,
        debt_to_assets: totalAssets > 0 ? netDebt / totalAssets : 0,
        interest_coverage: interestExpense > 0 ? ebitda / interestExpense : 0
      },
      efficiency: {
        asset_turnover: totalAssets > 0 ? revenue / totalAssets : 0,
        inventory_turnover: 8, // Industry average for energy infrastructure
        receivables_turnover: 6 // Industry average for energy infrastructure
      },
      valuation: {
        pe_ratio: netIncome > 0 ? totalEquity / netIncome : 0,
        pb_ratio: totalEquity > 0 ? 1.0 : 0, // Book value per share approximation
        ev_ebitda: ebitda > 0 ? (totalAssets - cash) / ebitda : 0,
        dividend_yield: 0 // Would need actual dividend data
      }
    }
  }

  const getDefaultRatios = () => ({
    profitability: { roa: 0, roe: 0, roic: 0, gross_margin: 0, operating_margin: 0, net_margin: 0 },
    liquidity: { current_ratio: 0, quick_ratio: 0, cash_ratio: 0 },
    leverage: { debt_to_equity: 0, debt_to_assets: 0, interest_coverage: 0 },
    efficiency: { asset_turnover: 0, inventory_turnover: 0, receivables_turnover: 0 },
    valuation: { pe_ratio: 0, pb_ratio: 0, ev_ebitda: 0, dividend_yield: 0 }
  })

  const selectedCompany = companies.find(c => c.ticker === selectedTicker)
  const benchmarks = INDUSTRY_BENCHMARKS[selectedIndustry]

  const getRatioComparisonData = (category: string) => {
    if (!selectedCompany) return []

    const companyRatios = selectedCompany.ratios[category as keyof typeof selectedCompany.ratios]
    const benchmarkRatios = benchmarks[category as keyof typeof benchmarks]

    return Object.keys(companyRatios).map(key => ({
      ratio: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      company: (companyRatios as any)[key],
      benchmark: (benchmarkRatios as any)[key] || 0,
      difference: ((companyRatios as any)[key] - ((benchmarkRatios as any)[key] || 0))
    }))
  }

  const getRadarData = () => {
    if (!selectedCompany) return []

    return [
      { subject: 'ROA', company: selectedCompany.ratios.profitability.roa, benchmark: benchmarks.profitability.roa },
      { subject: 'ROE', company: selectedCompany.ratios.profitability.roe, benchmark: benchmarks.profitability.roe },
      { subject: 'ROIC', company: selectedCompany.ratios.profitability.roic, benchmark: benchmarks.profitability.roic },
      { subject: 'Current Ratio', company: selectedCompany.ratios.liquidity.current_ratio, benchmark: benchmarks.liquidity.current_ratio },
      { subject: 'Debt/Equity', company: selectedCompany.ratios.leverage.debt_to_equity, benchmark: benchmarks.leverage.debt_to_equity },
      { subject: 'Asset Turnover', company: selectedCompany.ratios.efficiency.asset_turnover, benchmark: benchmarks.efficiency.asset_turnover }
    ]
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
              <BarChart3 className="w-8 h-8 text-green-500" />
              Financial Ratios Analysis
            </h1>
            <p className="text-muted-foreground">
              Comprehensive ratio analysis with industry benchmarks and trends
            </p>
          </div>
        </div>
      </div>

      {/* Company Selection */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <Label htmlFor="company-select">Select Company:</Label>
          <Select value={selectedTicker} onValueChange={setSelectedTicker}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Choose company" />
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
          <Label htmlFor="industry-select">Industry Benchmark:</Label>
          <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Choose industry" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(INDUSTRY_BENCHMARKS).map(industry => (
                <SelectItem key={industry} value={industry}>
                  {industry.charAt(0).toUpperCase() + industry.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { id: 'overview', label: 'Overview', icon: Target },
          { id: 'comparison', label: 'Benchmark Comparison', icon: TrendingUp },
          { id: 'trends', label: 'Industry Trends', icon: BarChart3 }
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

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading financial ratios...</p>
        </div>
      ) : selectedCompany ? (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Financial Health Overview</CardTitle>
                  <CardDescription>Key ratios vs industry benchmarks</CardDescription>
                </CardHeader>
                <CardContent>
                  <Chart>
                    <RadarChart data={getRadarData()}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} />
                      <Radar name="Company" dataKey="company" stroke="#0A84FF" fill="#0A84FF" fillOpacity={0.3} />
                      <Radar name="Industry" dataKey="benchmark" stroke="#34C759" fill="#34C759" fillOpacity={0.3} />
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </Chart>
                </CardContent>
              </Card>

              {/* Ratio Categories */}
              <div className="space-y-4">
                {[
                  { key: 'profitability', title: 'Profitability Ratios', icon: TrendingUp },
                  { key: 'liquidity', title: 'Liquidity Ratios', icon: Target },
                  { key: 'leverage', title: 'Leverage Ratios', icon: AlertCircle },
                  { key: 'valuation', title: 'Valuation Ratios', icon: CheckCircle }
                ].map(({ key, title, icon: Icon }) => (
                  <Card key={key}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Icon className="w-5 h-5" />
                        {title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {Object.entries(selectedCompany.ratios[key as keyof typeof selectedCompany.ratios]).map(([ratio, value]) => (
                          <div key={ratio} className="flex justify-between">
                            <span className="text-muted-foreground">
                              {ratio.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                            </span>
                            <span className="font-mono">
                              {typeof value === 'number' ? formatNumber(value) : value}
                              {key === 'valuation' && ratio.includes('ratio') ? 'x' : ''}
                              {key === 'valuation' && ratio.includes('yield') ? '%' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Comparison Tab */}
          {activeTab === 'comparison' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {['profitability', 'liquidity', 'leverage', 'valuation'].map(category => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="capitalize">{category} Analysis</CardTitle>
                    <CardDescription>Company vs Industry Benchmarks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Chart>
                      <BarChart data={getRatioComparisonData(category)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <XAxis dataKey="ratio" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="company" fill="#0A84FF" name="Company" />
                        <Bar dataKey="benchmark" fill="#34C759" name="Industry Avg" />
                      </BarChart>
                    </Chart>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Industry Benchmark Summary</CardTitle>
                  <CardDescription>Key ratios for {selectedIndustry} industry</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(benchmarks).map(([category, ratios]) => (
                      <div key={category} className="space-y-2">
                        <h4 className="font-semibold capitalize">{category}</h4>
                        {Object.entries(ratios).map(([ratio, value]) => (
                          <div key={ratio} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {ratio.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                            </span>
                            <span className="font-mono">
                              {formatNumber(value as number)}
                              {ratio.includes('ratio') ? 'x' : ratio.includes('yield') ? '%' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Peer Company Comparison</CardTitle>
                  <CardDescription>How {selectedCompany.name} compares to industry peers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-border rounded-md">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border border-border p-2 text-left">Company</th>
                          <th className="border border-border p-2 text-right">ROE</th>
                          <th className="border border-border p-2 text-right">ROA</th>
                          <th className="border border-border p-2 text-right">Debt/Equity</th>
                          <th className="border border-border p-2 text-right">P/E</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((company, index) => (
                          <tr key={company.ticker} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                            <td className="border border-border p-2 font-medium">
                              {company.ticker}
                            </td>
                            <td className="border border-border p-2 text-right font-mono">
                              {formatNumber(company.ratios.profitability.roe * 100)}%
                            </td>
                            <td className="border border-border p-2 text-right font-mono">
                              {formatNumber(company.ratios.profitability.roa * 100)}%
                            </td>
                            <td className="border border-border p-2 text-right font-mono">
                              {formatNumber(company.ratios.leverage.debt_to_equity)}x
                            </td>
                            <td className="border border-border p-2 text-right font-mono">
                              {formatNumber(company.ratios.valuation.pe_ratio)}x
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
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-semibold mb-2">No Company Selected</h3>
            <p className="text-muted-foreground">
              Please select a company to view financial ratios analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          Financial ratios analysis with industry benchmarks. Values are calculated from available data
          and may not reflect actual company performance. For educational and analytical purposes only.
        </p>
      </div>
    </div>
  )
}
