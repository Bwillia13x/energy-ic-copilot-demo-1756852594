"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchJsonWithRetry } from '@/lib/http'

interface XbrlMeta {
  form?: string
  end?: string
  frame?: string
  filed?: string
  unit?: string
  raw_value?: number | null
}

interface XbrlResponse {
  ticker: string
  cik: string
  metrics_millions: Record<string, number | null>
  facts_meta: Record<string, XbrlMeta | null>
  source: string
  retrieved_at: string
  period_preference?: string
}

export default function XbrlToolPage() {
  const [ticker, setTicker] = useState('KMI')
  const [period, setPeriod] = useState<'any'|'ytd'|'qtd'>('any')
  const [data, setData] = useState<XbrlResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!ticker) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetchJsonWithRetry<XbrlResponse>(
        `${process.env.NEXT_PUBLIC_API_URL}/xbrl/${ticker}?period=${period}`,
        undefined,
        { timeoutMs: 8000, retries: 2, backoffMs: 500 }
      )
      setData(res)
    } catch (e) {
      setData(null)
      setError('XBRL metrics unavailable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { load() }, [period])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">XBRL Viewer</h1>
        <p className="text-muted-foreground">Pull standardized GAAP facts (USD millions) from SEC companyfacts</p>
      </div>

      <Card className="max-w-5xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>SEC XBRL Metrics</CardTitle>
              <CardDescription>Enter a US ticker and adjust flow period preference</CardDescription>
            </div>
            <div className="flex items-center gap-2" role="group" aria-label="XBRL period selector">
              {(['any','ytd','qtd'] as const).map(p => (
                <Button key={p} size="sm" variant={period===p?'default':'outline'} onClick={() => setPeriod(p)} aria-pressed={period===p}>
                  {p.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="Ticker (e.g., KMI, OKE)" className="max-w-[160px]" />
            <Button onClick={load} disabled={loading}>Load</Button>
          </div>
          {data ? (
            <div className="overflow-x-auto">
              <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Ticker: {data.ticker}</span>
                  <span>•</span>
                  <span>Preference: {data.period_preference || 'ANY'}</span>
                  <span>•</span>
                  <span>Retrieved: {new Date(data.retrieved_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const cik10 = (data.cik || '').padStart(10, '0')
                    const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`
                    const filingsUrl = `https://www.sec.gov/edgar/browse/?CIK=${data.cik}&owner=exclude`
                    return (
                      <>
                        <a href={factsUrl} target="_blank" rel="noreferrer noopener" className="underline hover:no-underline">Companyfacts JSON</a>
                        <span>•</span>
                        <a href={filingsUrl} target="_blank" rel="noreferrer noopener" className="underline hover:no-underline">Filings</a>
                      </>
                    )
                  })()}
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Metric</th>
                    <th className="py-2 pr-4">Value (USD mm)</th>
                    <th className="py-2">Source / Verify</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['ebitda','EBITDA (proxy)'],
                    ['net_income','Net Income'],
                    ['interest_expense','Interest Expense'],
                    ['net_debt','Net Debt'],
                    ['shareholder_equity','Shareholder Equity'],
                    ['total_assets','Total Assets'],
                    ['cash','Cash & Equivalents'],
                    ['total_debt','Total Debt'],
                    ['shares_outstanding','Shares Outstanding (mm)'],
                  ].map(([key,label]) => {
                    const val = data.metrics_millions[key as keyof XbrlResponse['metrics_millions']] as number | null
                    const meta = data.facts_meta[key as keyof XbrlResponse['facts_meta']] as XbrlMeta | null
                    return (
                      <tr key={key} className="border-t">
                        <td className="py-2 pr-4 font-medium">{label}</td>
                        <td className="py-2 pr-4">{val != null ? val.toLocaleString() : '-'}</td>
                        <td className="py-2 text-muted-foreground">
                          {meta ? (
                            <span title={`filed ${meta.filed}; raw ${meta.raw_value} ${meta.unit || ''}`}>
                              {meta.form || '—'} / {meta.end || '—'} / {meta.frame || '—'}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{error || 'No structured metrics available'}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

