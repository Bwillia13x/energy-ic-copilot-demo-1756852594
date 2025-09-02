"use client"

import { Suspense, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X, Copy, Download, Upload, CheckSquare, Square, Calculator, TrendingUp, Target, BarChart3, Settings, Zap, Save, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { fetchJsonWithRetry } from '@/lib/http'

// Dynamically import CompanyComparison to avoid SSR issues
const CompanyComparison = dynamic(() => import('@/components/company-comparison').then(mod => ({ default: mod.CompanyComparison })), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Loading comparison tool...</div>
})

interface Company {
  name: string
  ticker: string
  currency: string
  fiscal_year_end: string
  sector: string
  country: string
}

interface CompanyData {
  ticker: string
  name: string
  sector?: string
  country?: string
  currency?: string
  kpis: Record<string, { value: number; unit: string }>
  valuation?: {
    epv: number
    dcf_value: number
    ev_ebitda_ratio: number
  }
}

function ComparePageContent() {
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'ticker' | 'sector'>('name')
  const [sectors, setSectors] = useState<string[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [chartType, setChartType] = useState<'bar' | 'valuation'>('bar')
  const [comparisonMetric, setComparisonMetric] = useState<string>('EBITDA')
  const [savedSets, setSavedSets] = useState<{ name: string; tickers: string[]; metric?: string; type?: 'bar' | 'valuation' }[]>([])
  const [newSetName, setNewSetName] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const importRef = useRef<HTMLInputElement | null>(null)
  const { toast } = useToast()

  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  useEffect(() => {
    fetchCompaniesData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initialize query, sort, selection, metric and chart type from URL/localStorage
  useEffect(() => {
    const initialQ = searchParams.get('q') || ''
    const initialSort = (searchParams.get('sort') || 'name') as 'name' | 'ticker' | 'sector'
    const initialSel = (searchParams.get('sel') || '').split(',').filter(Boolean)
    const initialMetric = searchParams.get('metric') || 'EBITDA'
    const initialType = (searchParams.get('type') || 'bar') as 'bar' | 'valuation'
    setQuery(initialQ)
    if (['name', 'ticker', 'sector'].includes(initialSort)) {
      setSortBy(initialSort)
    } else if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('compare-sort') as 'name' | 'ticker' | 'sector' | null
      if (saved && ['name', 'ticker', 'sector'].includes(saved)) {
        setSortBy(saved)
      }
    }
    if (initialSel.length) setSelectedTickers(initialSel)
    setComparisonMetric(initialMetric)
    setChartType(initialType)
    // Load saved sets
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('compare-saved-sets')
        if (raw) setSavedSets(JSON.parse(raw))
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep URL in sync
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    if (query) params.set('q', query); else params.delete('q')
    params.set('sort', sortBy)
    if (selectedTickers.length) params.set('sel', selectedTickers.join(',')); else params.delete('sel')
    params.set('metric', comparisonMetric)
    params.set('type', chartType)
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [query, sortBy, selectedTickers, comparisonMetric, chartType])

  // Persist saved sets
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('compare-saved-sets', JSON.stringify(savedSets))
    }
  }, [savedSets])

  // Persist sort to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('compare-sort', sortBy)
    }
  }, [sortBy])

  const fetchCompaniesData = async () => {
    try {
      setLoading(true)

      // Fetch all companies
      const companiesData = await fetchJsonWithRetry<Record<string, Company>>(
        `${process.env.NEXT_PUBLIC_API_URL}/companies`,
        undefined,
        { timeoutMs: 8000, retries: 2, backoffMs: 500 }
      )

      console.log('Fetched companies:', Object.keys(companiesData))

      // Process companies in smaller batches to avoid overwhelming the API
      const tickers = Object.keys(companiesData)
      const batchSize = 3
      const companiesWithData: CompanyData[] = []

      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize)
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}:`, batch)

        const batchPromises = batch.map(async (ticker) => {
          const company = companiesData[ticker]
          try {
            // Fetch KPIs with shorter timeout
            let kpiData: any = { kpis: {} }
            try {
              kpiData = await fetchJsonWithRetry<any>(
                `${process.env.NEXT_PUBLIC_API_URL}/kpis/${ticker}`,
                undefined,
                { timeoutMs: 5000, retries: 1, backoffMs: 500 }
              )
            } catch (e) {
              console.warn(`Failed to fetch KPIs for ${ticker}:`, e)
              kpiData = { kpis: {} }
            }

            // Calculate basic valuation with error handling
            let valuation
            try {
              valuation = await calculateBasicValuation(kpiData.kpis)
            } catch (e) {
              console.warn(`Failed to calculate valuation for ${ticker}:`, e)
              valuation = undefined
            }

            return {
              ticker,
              name: company.name,
              sector: company.sector,
              country: company.country,
              currency: company.currency,
              kpis: kpiData.kpis || {},
              valuation
            }
          } catch (err) {
            console.error(`Error processing ${ticker}:`, err)
            return {
              ticker,
              name: company.name,
              sector: company.sector,
              country: company.country,
              currency: company.currency,
              kpis: {},
              valuation: undefined
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        companiesWithData.push(...batchResults)

        // Small delay between batches to be API-friendly
        if (i + batchSize < tickers.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      console.log('Final companies data:', companiesWithData.length)
      setCompanies(companiesWithData)
      // Build filter facets
      const sectorSet = new Set<string>()
      const countrySet = new Set<string>()
      companiesWithData.forEach(c => {
        if (c.sector) sectorSet.add(c.sector)
        if (c.country) countrySet.add(c.country)
      })
      setSectors(Array.from(sectorSet).sort())
      setCountries(Array.from(countrySet).sort())

    } catch (err) {
      console.error('Error fetching companies data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load company data')
    } finally {
      setLoading(false)
    }
  }

  const calculateBasicValuation = async (kpis: Record<string, { value: number; unit: string }>) => {
    const ebitda = kpis.EBITDA?.value || 0
    const netDebt = kpis.NetDebt?.value || 0

    if (ebitda === 0) return undefined

    try {
      // Calculate basic EPV and DCF using default assumptions
      const valuationInputs = {
        ebitda,
        net_debt: netDebt,
        maintenance_capex: ebitda * 0.1, // Assume 10% of EBITDA
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
          `${process.env.NEXT_PUBLIC_API_URL}/valuation/TEST`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: 'TEST', inputs: valuationInputs }),
          },
          { timeoutMs: 8000, retries: 2, backoffMs: 500 }
        )
        return {
          epv: results.epv,
          dcf_value: results.dcf_value,
          ev_ebitda_ratio: results.ev_ebitda_ratio
        }
      } catch {}
    } catch (err) {
      console.error('Valuation calculation error:', err)
    }

    return undefined
  }

  const handleSelectionChange = (tickers: string[]) => {
    setSelectedTickers(tickers)
  }

  // Filter and sort companies for display/selection
  const filteredCompanies = companies
    .filter(c => `${c.name} ${c.ticker}`.toLowerCase().includes(query.toLowerCase().trim()))
    .filter(c => selectedSectors.length === 0 || (c.sector && selectedSectors.includes(c.sector)))
    .filter(c => selectedCountries.length === 0 || (c.country && selectedCountries.includes(c.country)))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker)
      const sa = (cSector(a)?.toLowerCase() || '')
      const sb = (cSector(b)?.toLowerCase() || '')
      const s = sa.localeCompare(sb)
      return s !== 0 ? s : a.name.localeCompare(b.name)
    })

  function cSector(c: CompanyData): string | undefined {
    return c.sector
  }

  // Utilities
  const copyShareLink = async () => {
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      params.set('sort', sortBy)
      if (selectedTickers.length) params.set('sel', selectedTickers.join(','))
      params.set('metric', comparisonMetric)
      params.set('type', chartType)
      const url = `${window.location.origin}${pathname}?${params.toString()}`
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied', description: 'Comparison link copied to clipboard.' })
    } catch {}
  }

  const exportCSV = () => {
    const rows: string[] = []
    if (chartType === 'valuation') {
      rows.push(['Ticker','EPV','DCF','EV/EBITDA'].join(','))
      filteredCompanies
        .filter(c => selectedTickers.includes(c.ticker))
        .forEach(c => {
          const epv = c.valuation?.epv ?? ''
          const dcf = c.valuation?.dcf_value ?? ''
          const ratio = c.valuation?.ev_ebitda_ratio ?? ''
          rows.push([c.ticker, String(epv), String(dcf), String(ratio)].join(','))
        })
    } else {
      rows.push(['Ticker', comparisonMetric, 'Unit'].join(','))
      filteredCompanies
        .filter(c => selectedTickers.includes(c.ticker))
        .forEach(c => {
          const k = c.kpis[comparisonMetric]
          rows.push([c.ticker, k?.value?.toString() || '', k?.unit || ''].join(','))
        })
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparison_${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast({ title: 'Exported CSV', description: 'Comparison data downloaded.' })
  }

  const toggleAllFiltered = () => {
    const allTickers = filteredCompanies.map(c => c.ticker)
    const allSelected = allTickers.every(t => selectedTickers.includes(t))
    setSelectedTickers(allSelected ? [] : allTickers)
  }

  const saveCurrentSet = () => {
    const name = newSetName.trim()
    if (!name || selectedTickers.length === 0) return
    setSavedSets(prev => {
      const idx = prev.findIndex(s => s.name === name)
      const next = [...prev]
      const payload = { name, tickers: [...selectedTickers], metric: comparisonMetric, type: chartType }
      if (idx >= 0) next[idx] = payload
      else next.push(payload)
      return next
    })
    setNewSetName('')
    toast({ title: 'Set saved', description: `Saved “${name}” (${selectedTickers.length} companies).` })
  }

  const loadSet = (name: string) => {
    const s = savedSets.find(x => x.name === name)
    if (!s) return
    setSelectedTickers(s.tickers)
    if (s.metric) setComparisonMetric(s.metric)
    if (s.type) setChartType(s.type)
    toast({ title: 'Set loaded', description: `Loaded “${name}”.` })
  }

  const deleteSet = (name: string) => {
    setSavedSets(prev => prev.filter(s => s.name !== name))
    toast({ title: 'Set deleted', description: `Deleted “${name}”.` })
  }

  const exportSets = () => {
    const blob = new Blob([JSON.stringify(savedSets, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compare_sets_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast({ title: 'Exported sets', description: 'Saved compare sets downloaded as JSON.' })
  }

  const handleImportClick = () => importRef.current?.click()

  const importSets = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text) as { name: string; tickers: string[]; metric?: string; type?: 'bar' | 'valuation' }[]
      if (!Array.isArray(data)) throw new Error('Invalid file')
      setSavedSets(prev => {
        const byName = new Map(prev.map(s => [s.name, s]))
        data.forEach(s => byName.set(s.name, s))
        return Array.from(byName.values())
      })
      toast({ title: 'Imported sets', description: `Imported ${data.length} set(s).` })
    } catch {
      toast({ title: 'Import failed', description: 'Could not import sets. Ensure valid JSON.', variant: 'destructive' as any })
    } finally {
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-8">Company Comparison</h1>
          <p>Loading company data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-8">Company Comparison</h1>
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Button onClick={fetchCompaniesData}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Company Comparison</h1>
            <p className="text-muted-foreground">
              Compare key metrics and valuations across energy infrastructure companies
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Financial Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-500" />
              Advanced Valuation
            </CardTitle>
            <CardDescription>
              DCF sensitivity analysis, scenario modeling, and comparative valuation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tools/valuation">
              <Button className="w-full" variant="outline">
                <TrendingUp className="w-4 h-4 mr-2" />
                Open Valuation Tool
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-500" />
              Financial Ratios
            </CardTitle>
            <CardDescription>
              Comprehensive ratio analysis with industry benchmarks and trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tools/ratios">
              <Button className="w-full" variant="outline">
                <Target className="w-4 h-4 mr-2" />
                Analyze Ratios
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-500" />
              Custom Metrics
            </CardTitle>
            <CardDescription>
              Create and calculate custom financial metrics and formulas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tools/custom">
              <Button className="w-full" variant="outline">
                <Zap className="w-4 h-4 mr-2" />
                Build Metrics
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Technical Analysis
            </CardTitle>
            <CardDescription>
              Stock charts with technical indicators and price analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tools/technical">
              <Button className="w-full" variant="outline">
                <BarChart3 className="w-4 h-4 mr-2" />
                View Charts
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-red-500" />
              Scenario Planning
            </CardTitle>
            <CardDescription>
              Stress test valuations under different economic conditions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tools/scenario">
              <Button className="w-full" variant="outline">
                <Calculator className="w-4 h-4 mr-2" />
                Run Scenarios
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-indigo-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-500" />
              Monte Carlo
            </CardTitle>
            <CardDescription>
              Probabilistic valuation analysis with uncertainty modeling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tools/monte-carlo">
              <Button className="w-full" variant="outline">
                <TrendingUp className="w-4 h-4 mr-2" />
                Run Simulation
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Search + Sort + Filters */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies (name or ticker)"
              className="pl-9 pr-9"
              aria-label="Search companies"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-muted-foreground">Sort by</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'ticker' | 'sector')}
              className="px-3 py-2 border rounded-md text-sm bg-background"
              aria-label="Sort companies by"
            >
              <option value="name">Name (A–Z)</option>
              <option value="ticker">Ticker (A–Z)</option>
              <option value="sector">Sector (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Faceted filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium mb-2">Filter by Sector</div>
            <div className="flex flex-wrap gap-2">
              {sectors.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  className={`px-2 py-1 rounded border text-sm ${selectedSectors.includes(s) ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                >
                  {selectedSectors.includes(s) ? <CheckSquare className="inline w-3.5 h-3.5 mr-1" /> : <Square className="inline w-3.5 h-3.5 mr-1" />} {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Filter by Country</div>
            <div className="flex flex-wrap gap-2">
              {countries.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                  className={`px-2 py-1 rounded border text-sm ${selectedCountries.includes(c) ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                >
                  {selectedCountries.includes(c) ? <CheckSquare className="inline w-3.5 h-3.5 mr-1" /> : <Square className="inline w-3.5 h-3.5 mr-1" />} {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selection Summary + Controls */}
      {selectedTickers.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  Comparing {selectedTickers.length} companies
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTickers.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleAllFiltered}>
                  {filteredCompanies.every(c => selectedTickers.includes(c.ticker)) ? 'Clear Selection' : 'Select All (filtered)'}
                </Button>
                <Button variant="outline" size="sm" onClick={copyShareLink}>
                  <Copy className="w-4 h-4 mr-1" /> Share Link
                </Button>
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
            </div>
            {/* Save set */}
            <div className="mt-4 flex items-center gap-2">
              <Input
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                placeholder="Name this selection (e.g., Pipelines)"
                className="max-w-xs"
              />
              <Button variant="default" size="sm" onClick={saveCurrentSet} disabled={!selectedTickers.length || !newSetName.trim()}>
                <Save className="w-4 h-4 mr-1" /> Save Set
              </Button>
              <Button variant="outline" size="sm" onClick={exportSets}>
                <Download className="w-4 h-4 mr-1" /> Export Sets
              </Button>
              <input ref={importRef} type="file" accept="application/json" onChange={importSets} className="hidden" />
              <Button variant="outline" size="sm" onClick={handleImportClick}>
                <Upload className="w-4 h-4 mr-1" /> Import Sets
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Component */}
      <CompanyComparison
        companies={filteredCompanies}
        selectedTickers={selectedTickers}
        onSelectionChange={handleSelectionChange}
        chartType={chartType}
        comparisonMetric={comparisonMetric}
        onChartTypeChange={setChartType}
        onComparisonMetricChange={setComparisonMetric}
      />

      {/* Saved Sets */}
      {savedSets.length > 0 && (
        <div className="max-w-5xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Saved Compare Sets</CardTitle>
              <CardDescription>Quickly load named company selections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {savedSets.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 border rounded-md px-2 py-1">
                    <button className="text-sm underline" onClick={() => loadSet(s.name)} title={s.tickers.join(', ')}>
                      {s.name}
                    </button>
                    <Button variant="ghost" size="sm" onClick={() => deleteSet(s.name)} aria-label={`Delete ${s.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          Select companies above to compare their financial metrics and valuations.
          All data is extracted from sample filings with page-level citations.
        </p>
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-8">Company Comparison</h1>
            <p>Loading company data...</p>
          </div>
        </div>
      }
    >
      <ComparePageContent />
    </Suspense>
  )
}
