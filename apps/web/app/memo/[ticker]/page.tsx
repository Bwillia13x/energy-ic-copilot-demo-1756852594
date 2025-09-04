'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download } from 'lucide-react'
import { fetchJsonWithRetry } from '@/lib/http'
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils'
import { useLoading } from '@/lib/loading-context'

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

interface ValuationResults {
  epv: number
  dcf_value: number
  wacc: number
  cost_of_equity: number
  cost_of_debt_after_tax: number
  ev_ebitda_ratio: number
  net_debt_ebitda_ratio: number
}

export default function MemoPage() {
  const params = useParams()
  const ticker = params.ticker as string
  const { startLoading, stopLoading, updateProgress } = useLoading()

  const [company, setCompany] = useState<Company | null>(null)
  const [kpis, setKpis] = useState<Record<string, KPI>>({})
  const [valuationResults, setValuationResults] = useState<ValuationResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ticker) {
      fetchMemoData()
    }
  }, [ticker])

  const fetchMemoData = async () => {
    try {
      setLoading(true)

      // Fetch company info
      const companyData = await fetchJsonWithRetry<Company>(
        `${process.env.NEXT_PUBLIC_API_URL}/companies/${ticker}`,
        undefined,
        { timeoutMs: 8000, retries: 2, backoffMs: 500 }
      )
      setCompany(companyData)

      // Fetch KPIs
      const kpiData = await fetchJsonWithRetry<any>(
        `${process.env.NEXT_PUBLIC_API_URL}/kpis/${ticker}`,
        undefined,
        { timeoutMs: 8000, retries: 2, backoffMs: 500 }
      )
      setKpis(kpiData.kpis)

      // Calculate valuation (simplified - in real app would fetch from valuation endpoint)
      await calculateValuation(kpiData.kpis)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const calculateValuation = async (kpiData: Record<string, KPI>) => {
    const ebitda = kpiData.EBITDA?.value || 3450
    const netDebt = kpiData.NetDebt?.value || 18750
    const maintenanceCapex = kpiData.MaintenanceCapex?.value || 220

    const inputs = {
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

    try {
      const results = await fetchJsonWithRetry<any>(
        `${process.env.NEXT_PUBLIC_API_URL}/valuation/${ticker}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, inputs }),
        },
        { timeoutMs: 8000, retries: 2, backoffMs: 500 }
      )
      setValuationResults(results)
    } catch (err) {
      console.error('Valuation calculation error:', err)
    }
  }

  const handleExportPDF = async () => {
    startLoading('Generating PDF memo...')

    try {
      // Simulate progress updates
      updateProgress(10)
      await new Promise(resolve => setTimeout(resolve, 500))
      updateProgress(30)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/pdf?url=${encodeURIComponent(window.location.href)}`)
      updateProgress(60)

      if (response.ok) {
        updateProgress(80)
        const blob = await response.blob()
        updateProgress(90)

        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${ticker}_IC_Memo.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        updateProgress(100)
        await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause to show 100%
      } else {
        // Fallback: print to PDF
        console.warn('PDF generation failed, using print fallback')
        window.print()
      }
    } catch (err) {
      console.error('PDF export error:', err)
      // Fallback: print to PDF
      window.print()
    } finally {
      stopLoading()
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-8">Generating Memo for {ticker}...</h1>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-8">Error</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <Link href={`/company/${ticker}`} prefetch={false}>
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analysis
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href={`/company/${ticker}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analysis
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">IC Investment Memo</h1>
            <p className="text-muted-foreground">{company.name} ({ticker})</p>
          </div>
        </div>
        <Button onClick={handleExportPDF}>
          <Download className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Memo Content */}
      <Card className="mb-8">
        <CardContent className="p-8">
          {/* Thesis */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Thesis</h2>
            <p className="text-foreground/90 leading-relaxed">
              {company.name} represents an attractive investment opportunity in the energy infrastructure sector,
              offering stable cash flows, defensive characteristics, and attractive valuation metrics.
              The company&apos;s diversified asset base and long-term contracted revenues provide visibility
              into future earnings power.
            </p>
          </div>

          {/* Key Metrics */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Key Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis.EBITDA && (
                <div className="p-3 rounded-lg border bg-primary/5">
                  <div className="text-sm text-muted-foreground">EBITDA</div>
                  <div className="text-lg font-bold">
                    {formatCurrency(kpis.EBITDA.value, company.currency)}M
                  </div>
                  <div className="text-xs text-muted-foreground">
                    [{kpis.EBITDA.citation.doc_id}, p.{kpis.EBITDA.citation.page}]
                  </div>
                </div>
              )}

              {kpis.NetDebt && (
                <div className="p-3 rounded-lg border bg-destructive/5">
                  <div className="text-sm text-muted-foreground">Net Debt</div>
                  <div className="text-lg font-bold">
                    {formatCurrency(kpis.NetDebt.value, company.currency)}M
                  </div>
                  <div className="text-xs text-muted-foreground">
                    [{kpis.NetDebt.citation.doc_id}, p.{kpis.NetDebt.citation.page}]
                  </div>
                </div>
              )}

              {kpis.FFO && (
                <div className="p-3 rounded-lg border bg-green-500/5">
                  <div className="text-sm text-muted-foreground">FFO</div>
                  <div className="text-lg font-bold">
                    {formatCurrency(kpis.FFO.value, company.currency)}M
                  </div>
                  <div className="text-xs text-muted-foreground">
                    [{kpis.FFO.citation.doc_id}, p.{kpis.FFO.citation.page}]
                  </div>
                </div>
              )}

              {valuationResults && (
                <div className="p-3 rounded-lg border bg-purple-500/5">
                  <div className="text-sm text-muted-foreground">EV/EBITDA</div>
                  <div className="text-lg font-bold">
                    {formatNumber(valuationResults.ev_ebitda_ratio)}x
                  </div>
                  <div className="text-xs text-muted-foreground">Valuation</div>
                </div>
              )}
            </div>
          </div>

          {/* Valuation Summary */}
          {valuationResults && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-3">Valuation Summary</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border rounded-md overflow-hidden">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border p-2 text-left">Metric</th>
                      <th className="border border-border p-2 text-right">Value</th>
                      <th className="border border-border p-2 text-right">Per Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-border p-2">Enterprise Value</td>
                      <td className="border border-border p-2 text-right">
                        {formatCurrency(valuationResults.epv, company.currency)}M
                      </td>
                      <td className="border border-border p-2 text-right">-</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-2">DCF Value</td>
                      <td className="border border-border p-2 text-right">
                        {formatCurrency(valuationResults.dcf_value, company.currency)}M
                      </td>
                      <td className="border border-border p-2 text-right">-</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-2">WACC</td>
                      <td className="border border-border p-2 text-right">
                        {formatPercentage(valuationResults.wacc)}
                      </td>
                      <td className="border border-border p-2 text-right">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scenarios */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Scenario Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg bg-muted/30">
                <h3 className="font-medium mb-2">Base Case</h3>
                <p className="text-sm text-muted-foreground">
                  Current valuation assumes stable commodity prices and normal operating conditions.
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-muted/30">
                <h3 className="font-medium mb-2">Stress Case (-10% Throughput)</h3>
                <p className="text-sm text-muted-foreground">
                  Reduced throughput could pressure EBITDA by ~10%, impacting valuation.
                </p>
              </div>
            </div>
          </div>

          {/* Risks and Mitigations */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Risks & Mitigations</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Commodity Price Volatility</h3>
                <p className="text-sm text-muted-foreground">
                  Long-term contracts and diversified customer base provide revenue stability.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Regulatory Changes</h3>
                <p className="text-sm text-muted-foreground">
                  Strong regulatory track record and constructive engagement with policymakers.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Environmental Concerns</h3>
                <p className="text-sm text-muted-foreground">
                  Active ESG initiatives and transition planning reduce long-term risks.
                </p>
              </div>
            </div>
          </div>

          {/* Sources */}
          <div>
            <h2 className="text-xl font-bold mb-3">Sources</h2>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Q2 2024 Management Discussion & Analysis</li>
              <li>• Company investor presentations</li>
              <li>• Industry analyst reports</li>
              <li>• Regulatory filings and disclosures</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        <p>Generated by Energy IC Copilot • {new Date().toLocaleDateString()}</p>
        <Badge variant="outline" className="mt-2">Sample Analysis</Badge>
      </div>
    </div>
  )
}
