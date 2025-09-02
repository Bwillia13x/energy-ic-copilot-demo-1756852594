'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, Calculator, TrendingUp, BarChart3 } from 'lucide-react'
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils'
import { KPIChart } from '@/components/kpi-chart'
import { ValuationChart } from '@/components/valuation-chart'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoadingCard, LoadingChart } from '@/components/ui/loading'
import { useToast } from '@/hooks/use-toast'
import { useLoading } from '@/lib/loading-context'
import dynamic from 'next/dynamic'
import { fetchJsonWithRetry, HttpError } from '@/lib/http'

// Dynamically import ScenarioPresets to avoid SSR issues with localStorage
const ScenarioPresets = dynamic(() => import('@/components/scenario-presets').then(mod => ({ default: mod.ScenarioPresets })), {
  ssr: false,
  loading: () => <LoadingCard title="Loading scenario presets..." />
})

interface Company {
  name: string
  ticker: string
  currency: string
  fiscal_year_end: string
  sector: string
  country: string
}

interface KPI {
  value: number
  unit: string
  citation: {
    doc_id: string
    page: number
    span: [number, number]
    text_preview: string
  }
}

interface KPISummary {
  ticker: string
  kpis: Record<string, KPI>
  extracted_at: string
}

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
}

interface ValuationResults {
  epv: number
  dcf_value: number
  wacc: number
  cost_of_equity: number
  cost_of_debt_after_tax: number
  ev_ebitda_ratio: number
  net_debt_ebitda_ratio: number
  roic?: number
  roe?: number
  payout_ratio?: number
  dividend_yield?: number
  debt_to_equity?: number
  interest_coverage?: number
  scenario_epv?: number
  scenario_dcf?: number
  dcf_components: any
}

export default function CompanyPage() {
  const params = useParams()
  const ticker = params.ticker as string
  const { toast } = useToast()
  const { startLoading, stopLoading, updateProgress } = useLoading()

  const [company, setCompany] = useState<Company | null>(null)
  const [kpis, setKpis] = useState<KPISummary | null>(null)
  const [valuationInputs, setValuationInputs] = useState<ValuationInputs | null>(null)
  const [valuationResults, setValuationResults] = useState<ValuationResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ticker) {
      fetchCompanyData()
    }
  }, [ticker])

  const fetchCompanyData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch company info
      const companyData = await fetchJsonWithRetry<Company>(
        `${process.env.NEXT_PUBLIC_API_URL}/companies/${ticker}`,
        undefined,
        { timeoutMs: 8000, retries: 2, backoffMs: 500 }
      )
      setCompany(companyData)

      // Fetch KPIs with better error handling
      try {
        try {
          const kpiData = await fetchJsonWithRetry<KPISummary>(
            `${process.env.NEXT_PUBLIC_API_URL}/kpis/${ticker}`,
            undefined,
            { timeoutMs: 8000, retries: 2, backoffMs: 500 }
          )
          setKpis(kpiData)

          // Initialize valuation inputs from KPIs if available
          initializeValuationInputs(kpiData)

          toast({
            title: "✅ Data Loaded Successfully",
            description: `Found ${Object.keys(kpiData.kpis).length} KPIs for ${companyData.name}`,
          })
        } catch (kpiError: any) {
          if (kpiError instanceof HttpError && kpiError.status === 404) {
            console.warn(`No KPIs found for ${ticker}`)
            setKpis(null)
          } else {
            throw kpiError
          }
        }
      } catch (kpiError) {
        console.warn('KPI loading failed:', kpiError)
        // Don't fail the entire load if KPIs can't be loaded
        setKpis(null)
      }

      // Always show success for company data
      if (!kpis) {
        toast({
          title: "Company data loaded",
          description: `${companyData.name} data loaded successfully`,
        })
      }

    } catch (err) {
      let errorMessage = 'An unexpected error occurred'

      if (err instanceof Error) {
        errorMessage = err.message
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Network connection error - please check your internet connection'
      }

      setError(errorMessage)

      toast({
        title: "❌ Loading Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [ticker])

  // Memoize expensive computations
  const formattedKPIs = useMemo(() => {
    if (!kpis?.kpis) return []

    return Object.entries(kpis.kpis).map(([key, kpi]) => ({
      key,
      kpi,
      formattedValue: key.includes('Ratio') || key.includes('Rate')
        ? formatPercentage(kpi.value)
        : formatCurrency(kpi.value, company?.currency || 'USD'),
      isPercentage: key.includes('Ratio') || key.includes('Rate')
    }))
  }, [kpis, company?.currency])

  const initializeValuationInputs = useCallback((kpiData: KPISummary) => {
    const ebitda = kpiData.kpis.EBITDA?.value || 3450
    const netDebt = kpiData.kpis.NetDebt?.value || 18750
    const maintenanceCapex = kpiData.kpis.MaintenanceCapex?.value || 220

    const inputs: ValuationInputs = {
      ebitda,
      net_debt: netDebt,
      maintenance_capex: maintenanceCapex,
      tax_rate: 0.25,
      reinvestment_rate: 0.15,
      risk_free_rate: 0.04,
      market_risk_premium: 0.06,
      beta: 0.8,
      cost_of_debt: 0.05,
      debt_weight: 0.4,
      equity_weight: 0.6
    }

    setValuationInputs(inputs)
    calculateValuation(inputs)
  }, [])

  const calculateValuation = async (inputs: ValuationInputs) => {
    startLoading('Calculating valuation...')

    try {
      updateProgress(20)

      const results = await fetchJsonWithRetry<ValuationResults>(
        `${process.env.NEXT_PUBLIC_API_URL}/valuation/${ticker}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, inputs }),
        },
        { timeoutMs: 8000, retries: 2, backoffMs: 500 }
      )

      updateProgress(90)
      setValuationResults(results)
      updateProgress(100)

      // Brief pause to show completion
      await new Promise(resolve => setTimeout(resolve, 300))
    } catch (err) {
      console.error('Valuation calculation error:', err)
      toast({
        title: "Calculation Error",
        description: "Failed to calculate valuation. Please try again.",
        variant: "destructive",
      })
    } finally {
      stopLoading()
    }
  }

  const handleInputChange = (field: keyof ValuationInputs, value: number) => {
    if (!valuationInputs) return

    const updatedInputs = { ...valuationInputs, [field]: value }
    setValuationInputs(updatedInputs)
    calculateValuation(updatedInputs)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-8">Loading {ticker}...</h1>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Unable to Load Company</h1>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            {error
              ? `We're having trouble loading data for ${ticker}. ${error}`
              : `Company ${ticker} could not be found in our database.`
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => window.location.reload()} variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Link href="/">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Companies
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <header
        className="bg-gradient-to-r from-background to-muted/20 rounded-lg p-6 mb-8 border"
        role="banner"
        aria-labelledby="company-header"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Navigate back to companies list">
              <Button
                variant="outline"
                size="sm"
                className="hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-describedby="back-button-description"
              >
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                Back to Companies
              </Button>
            </Link>
            <span id="back-button-description" className="sr-only">
              Return to the main companies selection page
            </span>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1
                  id="company-header"
                  className="text-3xl font-bold tracking-tight"
                  tabIndex={-1}
                >
                  {company.name}
                </h1>
                <Badge
                  variant="outline"
                  className="font-mono text-sm"
                  aria-label={`Stock ticker: ${ticker}`}
                >
                  {ticker}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1" aria-label={`Sector: ${company.sector}`}>
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  {company.sector}
                </span>
                <span aria-hidden="true">•</span>
                <span aria-label={`Country: ${company.country}`}>{company.country}</span>
                <span aria-hidden="true">•</span>
                <span className="flex items-center gap-1" aria-label={`Currency: ${company.currency}`}>
                  <Calculator className="w-4 h-4" aria-hidden="true" />
                  {company.currency}
                </span>
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-3" role="navigation" aria-label="Page actions">
            <Link href={`/memo/${ticker}`} aria-label={`Generate investment committee memo for ${company.name}`}>
              <Button
                className="bg-primary hover:bg-primary/90 transition-colors"
                aria-describedby="memo-button-description"
              >
                <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
                Generate Memo
              </Button>
            </Link>
            <span id="memo-button-description" className="sr-only">
              Create a professional investment committee memo with extracted KPIs and valuation analysis
            </span>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPIs Section */}
        <section className="lg:col-span-2" aria-labelledby="kpi-section-heading">
          <Card role="region" aria-labelledby="kpi-section-heading">
            <CardHeader>
              <CardTitle id="kpi-section-heading" className="flex items-center gap-2">
                <FileText className="w-5 h-5" aria-hidden="true" />
                Key Performance Indicators
              </CardTitle>
              <CardDescription>
                Latest financial metrics with document citations and source references
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <LoadingCard key={i} title="Loading KPI..." className="h-24" />
                  ))}
                </div>
              ) : formattedKPIs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list" aria-label="Key performance indicators">
                  {formattedKPIs.map(({ key, kpi, formattedValue, isPercentage }) => (
                    <article
                      key={key}
                      className="group relative p-5 border rounded-xl hover:shadow-lg hover:border-primary/20 transition-all duration-300 bg-gradient-to-br from-background to-muted/5"
                      role="listitem"
                      tabIndex={0}
                      aria-label={`${key}: ${formattedValue} ${kpi.unit}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          // Could add focus management or additional interactions here
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {key}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs bg-background/50 group-hover:bg-primary/10 transition-colors"
                          aria-label={`Unit: ${kpi.unit}`}
                        >
                          {kpi.unit}
                        </Badge>
                      </div>
                      <div
                        className="text-2xl font-bold mb-2 group-hover:scale-105 transition-transform duration-300"
                        aria-label={`Value: ${formattedValue}`}
                      >
                        {formattedValue}
                      </div>
                      <div
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                        aria-label={`Source: ${kpi.citation.doc_id}, page ${kpi.citation.page}`}
                      >
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        <span className="truncate" title={kpi.citation.doc_id}>
                          {kpi.citation.doc_id}
                        </span>
                        <span className="text-muted-foreground/60" aria-hidden="true">•</span>
                        <span>Page {kpi.citation.page}</span>
                      </div>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No KPIs Available</h3>
                  <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                    We couldn't extract any key performance indicators from the available documents for {ticker}.
                  </p>
                  <Button
                    variant="outline"
                    onClick={fetchCompanyData}
                    className="hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Retry Extraction
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Scenario Presets */}
        <div className="lg:col-span-1">
          <ScenarioPresets
            currentInputs={valuationInputs || {
              ebitda: 3450,
              net_debt: 18750,
              maintenance_capex: 220,
              tax_rate: 0.25,
              reinvestment_rate: 0.15,
              risk_free_rate: 0.04,
              market_risk_premium: 0.06,
              beta: 0.8,
              cost_of_debt: 0.05,
              debt_weight: 0.4,
              equity_weight: 0.6
            }}
            onLoadPreset={(inputs) => {
              setValuationInputs(inputs)
              calculateValuation(inputs)
            }}
          />
        </div>

        {/* Valuation Section */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Valuation Model
              </CardTitle>
              <CardDescription>
                Enterprise Present Value & DCF Analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {valuationResults && (
                <div className="space-y-3">
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <div className="text-sm text-muted-foreground">Enterprise Value</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(valuationResults.epv, company.currency)}
                    </div>
                  </div>

                  <div className="p-3 bg-secondary/5 rounded-lg">
                    <div className="text-sm text-muted-foreground">DCF Value</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(valuationResults.dcf_value, company.currency)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">WACC</div>
                      <div className="font-medium">{formatPercentage(valuationResults.wacc)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">EV/EBITDA</div>
                      <div className="font-medium">{formatNumber(valuationResults.ev_ebitda_ratio)}</div>
                    </div>
                  </div>
                </div>
              )}

              {valuationInputs && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium">Key Assumptions</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="text-muted-foreground">Risk-Free Rate</label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={valuationInputs.risk_free_rate}
                        onChange={(e) => handleInputChange('risk_free_rate', parseFloat(e.target.value))}
                        className="text-center"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground">Beta</label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={valuationInputs.beta}
                        onChange={(e) => handleInputChange('beta', parseFloat(e.target.value))}
                        className="text-center"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generate Memo Button */}
          <div className="mt-6">
            <Link href={`/memo/${ticker}`}>
              <Button className="w-full" size="lg">
                <TrendingUp className="w-4 h-4 mr-2" />
                Generate IC Memo
              </Button>
            </Link>
          </div>
        </div>

        {/* Charts Section */}
        <div className="mt-8 space-y-6">
        {/* KPI Charts */}
        {loading ? (
          <LoadingChart className="h-96" />
        ) : kpis && Object.keys(kpis.kpis).length > 0 ? (
          <KPIChart
            kpis={Object.fromEntries(
              Object.entries(kpis.kpis).map(([key, kpi]) => [key, kpi])
            )}
            title={`${company.name} - Key Performance Indicators`}
            description="Financial metrics extracted from latest filings with page-level citations"
          />
        ) : null}

        {/* Valuation Charts */}
        {loading ? (
          <LoadingChart className="h-96" />
        ) : valuationResults ? (
          <ValuationChart
            baseValuation={{
              epv: valuationResults.epv,
              dcf_value: valuationResults.dcf_value
            }}
            scenarioValuation={valuationResults.scenario_epv ? {
              epv: valuationResults.scenario_epv,
              dcf_value: valuationResults.scenario_dcf || valuationResults.dcf_value
            } : undefined}
            scenarioName="Current Scenario"
            currency={company.currency}
          />
        ) : null}

        {/* Additional Metrics */}
        {valuationResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Additional Valuation Metrics
              </CardTitle>
              <CardDescription>
                Advanced financial ratios and performance indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {valuationResults.roic && (
                  <div className="group relative p-5 border rounded-xl hover:shadow-lg hover:border-green-500/20 transition-all duration-300 bg-gradient-to-br from-background to-green-50/5 dark:to-green-950/5">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <div className="text-sm font-medium text-muted-foreground">Return on Invested Capital</div>
                    </div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400 group-hover:scale-105 transition-transform duration-300">
                      {formatPercentage(valuationResults.roic)}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                )}

                {valuationResults.roe && (
                  <div className="group relative p-5 border rounded-xl hover:shadow-lg hover:border-blue-500/20 transition-all duration-300 bg-gradient-to-br from-background to-blue-50/5 dark:to-blue-950/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="w-4 h-4 text-blue-600" />
                      <div className="text-sm font-medium text-muted-foreground">Return on Equity</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 group-hover:scale-105 transition-transform duration-300">
                      {formatPercentage(valuationResults.roe)}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                )}

                {valuationResults.payout_ratio && (
                  <div className="group relative p-5 border rounded-xl hover:shadow-lg hover:border-purple-500/20 transition-all duration-300 bg-gradient-to-br from-background to-purple-50/5 dark:to-purple-950/5">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-purple-600" />
                      <div className="text-sm font-medium text-muted-foreground">Dividend Payout Ratio</div>
                    </div>
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 group-hover:scale-105 transition-transform duration-300">
                      {formatPercentage(valuationResults.payout_ratio)}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                )}

                {valuationResults.dividend_yield && (
                  <div className="group relative p-5 border rounded-xl hover:shadow-lg hover:border-orange-500/20 transition-all duration-300 bg-gradient-to-br from-background to-orange-50/5 dark:to-orange-950/5">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-orange-600" />
                      <div className="text-sm font-medium text-muted-foreground">Dividend Yield</div>
                    </div>
                    <div className="text-2xl font-bold text-orange-700 dark:text-orange-400 group-hover:scale-105 transition-transform duration-300">
                      {formatPercentage(valuationResults.dividend_yield)}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                )}

                {valuationResults.debt_to_equity && (
                  <div className="group relative p-5 border rounded-xl hover:shadow-lg hover:border-red-500/20 transition-all duration-300 bg-gradient-to-br from-background to-red-50/5 dark:to-red-950/5">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-red-600" />
                      <div className="text-sm font-medium text-muted-foreground">Debt-to-Equity Ratio</div>
                    </div>
                    <div className="text-2xl font-bold text-red-700 dark:text-red-400 group-hover:scale-105 transition-transform duration-300">
                      {formatNumber(valuationResults.debt_to_equity)}x
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                )}

                {valuationResults.interest_coverage && (
                  <div className="group relative p-5 border rounded-xl hover:shadow-lg hover:border-indigo-500/20 transition-all duration-300 bg-gradient-to-br from-background to-indigo-50/5 dark:to-indigo-950/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="w-4 h-4 text-indigo-600" />
                      <div className="text-sm font-medium text-muted-foreground">Interest Coverage Ratio</div>
                    </div>
                    <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 group-hover:scale-105 transition-transform duration-300">
                      {formatNumber(valuationResults.interest_coverage)}x
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </main>
    </div>
  )
}
