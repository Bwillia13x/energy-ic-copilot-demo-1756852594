'use client'

import { Suspense, useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'

// Force dynamic rendering to avoid SSR context issues
export const dynamic = 'force-dynamic'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GitCompare, BarChart3, HelpCircle, Search, X, Star, StarOff, Copy, Download, Upload, CheckSquare, Square, Calculator, TrendingUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { LoadingCard, LoadingSkeleton, Skeleton, CompanyCardSkeleton } from '@/components/ui/loading'
import { fetchJsonWithRetry, HttpError } from '@/lib/http'
import { DemoTour } from '@/components/demo-tour'

interface Company {
  name: string
  ticker: string
  currency: string
  fiscal_year_end: string
  sector: string
  country: string
}

function HomePageContent() {
  const [companies, setCompanies] = useState<Record<string, Company>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState<{ text: string; type: 'company' | 'ticker' | 'sector' | 'country' | 'recent' }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'name' | 'ticker' | 'sector'>('name')
  const [sectors, setSectors] = useState<string[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  const [savedSets, setSavedSets] = useState<{ name: string; tickers: string[] }[]>([])
  const [newSetName, setNewSetName] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const importRef = useRef<HTMLInputElement | null>(null)
  const suggestionsRef = useRef<HTMLDivElement | null>(null)
  const { toast } = useToast()

  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  useEffect(() => {
    fetchCompanies()
  }, [])

  // Initialize state from URL query params (and localStorage fallback) on mount
  useEffect(() => {
    const initialQ = searchParams.get('q') || ''
    const initialSort = (searchParams.get('sort') || 'name') as 'name' | 'ticker' | 'sector'
    const initialSectors = (searchParams.get('sector') || '').split(',').filter(Boolean)
    const initialCountries = (searchParams.get('country') || '').split(',').filter(Boolean)
    const initialFav = searchParams.get('fav') === '1'
    const initialSel = (searchParams.get('sel') || '').split(',').filter(Boolean)
    setQuery(initialQ)
    if (['name', 'ticker', 'sector'].includes(initialSort)) {
      setSortBy(initialSort)
    } else if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('home-sort') as 'name' | 'ticker' | 'sector' | null
      if (saved && ['name', 'ticker', 'sector'].includes(saved)) {
        setSortBy(saved)
      }
    }
    setSelectedSectors(initialSectors)
    setSelectedCountries(initialCountries)
    setShowFavoritesOnly(initialFav)
    if (initialSel.length) setSelectedTickers(initialSel)

    // Load favorites from localStorage
    if (typeof window !== 'undefined') {
      const favs = JSON.parse(window.localStorage.getItem('home-favorites') || '[]') as string[]
      if (Array.isArray(favs)) setFavorites(favs)
      try {
        const raw = window.localStorage.getItem('compare-saved-sets')
        if (raw) setSavedSets(JSON.parse(raw))
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep URL in sync with UI state
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    if (query) params.set('q', query); else params.delete('q')
    params.set('sort', sortBy)
    if (selectedSectors.length) params.set('sector', selectedSectors.join(',')); else params.delete('sector')
    if (selectedCountries.length) params.set('country', selectedCountries.join(',')); else params.delete('country')
    if (showFavoritesOnly) params.set('fav', '1'); else params.delete('fav')
    if (selectedTickers.length) params.set('sel', selectedTickers.join(',')); else params.delete('sel')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [query, sortBy, selectedSectors, selectedCountries, showFavoritesOnly, selectedTickers])

  // Persist sort to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('home-sort', sortBy)
    }
  }, [sortBy])

  // Persist favorites
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('home-favorites', JSON.stringify(favorites))
    }
  }, [favorites])

  // Persist saved sets (shared key with Compare page)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('compare-saved-sets', JSON.stringify(savedSets))
    }
  }, [savedSets])

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('recent-searches')
        if (saved) setRecentSearches(JSON.parse(saved))
      } catch {}
    }
  }, [])

  // Generate fuzzy search suggestions
  const generateSuggestions = (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      // Show recent searches if no query
      return recentSearches.slice(0, 5).map(term => ({ text: term, type: 'recent' as const }));
    }

    const suggestions: { text: string; type: 'company' | 'ticker' | 'sector' | 'country' }[] = []

    // Fuzzy search through companies
    Object.values(companies).forEach(company => {
      const companyName = company.name.toLowerCase()
      const ticker = company.ticker.toLowerCase()
      const sector = company.sector.toLowerCase()
      const country = company.country.toLowerCase()
      const search = searchTerm.toLowerCase()

      // Simple fuzzy matching
      if (companyName.includes(search) || search.includes(companyName.slice(0, 3))) {
        suggestions.push({ text: company.name, type: 'company' })
      }
      if (ticker.includes(search) || search.includes(ticker)) {
        suggestions.push({ text: company.ticker, type: 'ticker' })
      }
      if (sector.includes(search)) {
        suggestions.push({ text: company.sector, type: 'sector' })
      }
      if (country.includes(search)) {
        suggestions.push({ text: company.country, type: 'country' })
      }
    })

    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions
      .filter((s, index, arr) =>
        arr.findIndex(x => x.text === s.text && x.type === s.type) === index
      )
      .slice(0, 8)

    return uniqueSuggestions
  }

  // Handle search input
  const handleSearchChange = (value: string) => {
    setQuery(value)

    if (value.trim()) {
      const suggestions = generateSuggestions(value.trim())
      setSearchSuggestions(suggestions)
      setShowSuggestions(suggestions.length > 0)
    } else {
      setSearchSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: { text: string; type: 'company' | 'ticker' | 'sector' | 'country' | 'recent' }) => {
    setQuery(suggestion.text)
    setShowSuggestions(false)

    // Add to recent searches
    const updated = [suggestion.text, ...recentSearches.filter(s => s !== suggestion.text)].slice(0, 10)
    setRecentSearches(updated)

    // Persist recent searches
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('recent-searches', JSON.stringify(updated))
    }

    // Focus on search input or clear for direct search
    inputRef.current?.focus()
  }

  // Handle search submission
  const handleSearchSubmit = () => {
    if (query.trim()) {
      // Add to recent searches
      const updated = [query.trim(), ...recentSearches.filter(s => s !== query.trim())].slice(0, 10)
      setRecentSearches(updated)

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('recent-searches', JSON.stringify(updated))
      }
    }
    setShowSuggestions(false)
  }

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchCompanies = async () => {
    try {
      const data = await fetchJsonWithRetry<Record<string, Company>>(
        `${process.env.NEXT_PUBLIC_API_URL}/companies`,
        undefined,
        { timeoutMs: 8000, retries: 2, backoffMs: 500 }
      )
      setCompanies(data)
      // build facets
      const sectorSet = new Set<string>()
      const countrySet = new Set<string>()
      Object.values(data).forEach(c => {
        if (c.sector) sectorSet.add(c.sector)
        if (c.country) countrySet.add(c.country)
      })
      setSectors(Array.from(sectorSet).sort())
      setCountries(Array.from(countrySet).sort())
    } catch (err) {
      const message = err instanceof HttpError && err.status === 408
        ? 'API request timed out. Please check the server and try again.'
        : err instanceof Error
          ? err.message
          : 'An error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = (ticker: string) => {
    setFavorites(prev => prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker])
  }

  const toggleSelect = (ticker: string) => {
    setSelectedTickers(prev => prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker])
  }

  const exportCSV = () => {
    const rows: string[] = []
    rows.push(['Ticker','Name','Sector','Country','Currency'].join(','))
    filteredEntries.forEach(([t, c]) => {
      rows.push([t, c.name, c.sector || '', c.country || '', c.currency || ''].join(','))
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `companies_${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast({ title: 'Exported CSV', description: 'Company list downloaded.' })
  }

  const copyShareLink = async () => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    params.set('sort', sortBy)
    if (selectedSectors.length) params.set('sector', selectedSectors.join(','))
    if (selectedCountries.length) params.set('country', selectedCountries.join(','))
    if (showFavoritesOnly) params.set('fav', '1')
    if (selectedTickers.length) params.set('sel', selectedTickers.join(','))
    const url = `${window.location.origin}${pathname}?${params.toString()}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied', description: 'Filters and selection copied to clipboard.' })
    } catch {}
  }

  const filteredEntries = useMemo(() => {
    const list = Object.entries(companies)
      .filter(([t, c]) => `${c.name} ${t}`.toLowerCase().includes(query.toLowerCase().trim()))
      .filter(([t, c]) => selectedSectors.length === 0 || (c.sector && selectedSectors.includes(c.sector)))
      .filter(([t, c]) => selectedCountries.length === 0 || (c.country && selectedCountries.includes(c.country)))
    return showFavoritesOnly ? list.filter(([t]) => favorites.includes(t)) : list
  }, [companies, query, selectedSectors, selectedCountries, showFavoritesOnly, favorites])

  const saveCurrentSet = () => {
    const name = newSetName.trim()
    if (!name || selectedTickers.length === 0) return
    setSavedSets(prev => {
      const idx = prev.findIndex(s => s.name === name)
      const next = [...prev]
      const payload = { name, tickers: [...selectedTickers] }
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
      const data = JSON.parse(text) as { name: string; tickers: string[] }[]
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
      <div className="container mx-auto px-4 py-10">
        <div className="text-center mb-12">
          <div className="mb-3">
            <Skeleton className="h-12 w-80 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <Skeleton className="h-8 w-32 mx-auto mt-8" />
        </div>

        {/* Quick Start Skeleton */}
        <div className="max-w-4xl mx-auto mb-10">
          <div className="p-6 border rounded-xl bg-gradient-to-br from-muted/40 to-background">
            <div className="flex items-start gap-3">
              <Skeleton className="w-5 h-5 mt-0.5" />
              <div className="text-left w-full">
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-4 w-96 mb-4" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-2 rounded-lg bg-background border flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className={`h-4 ${i % 2 === 0 ? 'w-16' : 'w-12'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filters Skeleton */}
        <div className="max-w-5xl mx-auto mb-8">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-2" />
                <div className="flex gap-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-6 w-16 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className={`h-8 ${i === 0 ? 'w-28' : 'w-24'}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Company Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CompanyCardSkeleton key={i} />
          ))}
        </div>

        {/* Comparison Section Skeleton */}
        <div className="mt-16 text-center">
          <Skeleton className="h-32 w-80 mx-auto" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-8">Energy IC Copilot</h1>
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Button onClick={fetchCompanies}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <DemoTour />
      <div className="text-center mb-12">
        <h1 className="mb-3 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70 text-4xl md:text-5xl font-semibold tracking-tight">
          Energy IC Copilot
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          AI-powered analysis and valuation for energy infrastructure companies
        </p>
        <Badge variant="secondary" className="mb-8">
          Sample Dataset Loaded
        </Badge>
      </div>

      {/* Quick Start */}
      <div className="max-w-4xl mx-auto mb-10">
        <div className="p-6 border rounded-xl bg-gradient-to-br from-muted/40 to-background">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 mt-0.5 text-muted-foreground" />
            <div className="text-left w-full">
              <h2 className="font-semibold mb-1">Quick start</h2>
              <p className="text-sm text-muted-foreground">Select a company, review KPIs, adjust scenario assumptions, then export a memo.</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                {[
                  {
                    label: 'Pick a company',
                    action: () => {
                      const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
                      input?.focus()
                    }
                  },
                  {
                    label: 'Explore KPIs',
                    action: () => {
                      const firstTicker = Object.keys(companies)[0]
                      if (firstTicker) router.push(`/company/${firstTicker}`)
                    }
                  },
                  {
                    label: 'Adjust assumptions',
                    action: () => router.push('/tools/valuation')
                  },
                  {
                    label: 'Export memo',
                    action: () => {
                      const firstTicker = Object.keys(companies)[0]
                      if (firstTicker) router.push(`/memo/${firstTicker}`)
                    }
                  },
                ].map((step, i) => (
                  <div key={i} className="p-2 rounded-lg bg-background border flex items-center gap-2 hover:bg-primary/5 transition-colors cursor-pointer"
                       onClick={() => {
                         if (step.action) step.action()
                         toast({ title: `Step ${i + 1}: ${step.label}`, description: 'Guide completed' })
                       }}>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-medium">{i + 1}</span>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Sort + Filters */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit()
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false)
                }
              }}
              placeholder="Search companies, tickers, sectors, or countries..."
              className="pl-9 pr-9"
              aria-label="Search companies"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setShowSuggestions(false)
                  inputRef.current?.focus()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Search Suggestions Dropdown */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-10 max-h-64 overflow-y-auto"
                role="listbox"
                aria-label="Search suggestions"
              >
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.text}-${suggestion.type}-${index}`}
                    type="button"
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-muted/50 focus:bg-muted/50 focus:outline-none flex items-center justify-between"
                    role="option"
                  >
                    <div className="flex items-center gap-2">
                      {suggestion.type === 'company' && <TrendingUp className="w-4 h-4 text-primary" />}
                      {suggestion.type === 'ticker' && <Search className="w-4 h-4 text-blue-500" />}
                      {suggestion.type === 'sector' && <BarChart3 className="w-4 h-4 text-green-500" />}
                      {suggestion.type === 'country' && <span className="w-4 h-4 text-center text-xs bg-muted rounded">🌍</span>}
                      {suggestion.type === 'recent' && <span className="w-4 h-4 text-center text-xs bg-muted rounded">🕒</span>}
                      <span className="truncate">{suggestion.text}</span>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {suggestion.type}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-muted-foreground">Sort by</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'ticker')}
              className="px-3 py-2 border rounded-md text-sm bg-background"
              aria-label="Sort companies by"
            >
              <option value="name">Name (A–Z)</option>
              <option value="ticker">Ticker (A–Z)</option>
              <option value="sector">Sector (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Faceted filters and controls */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              className={`px-3 py-1.5 border rounded text-sm ${showFavoritesOnly ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
              onClick={() => setShowFavoritesOnly(v => !v)}
              aria-pressed={showFavoritesOnly}
            >
              {showFavoritesOnly ? <Star className="inline w-4 h-4 mr-1" /> : <StarOff className="inline w-4 h-4 mr-1" />} Favorites Only
            </button>
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              <Copy className="w-4 h-4 mr-1" /> Share Link
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportSets}>
              <Download className="w-4 h-4 mr-1" /> Export Sets
            </Button>
            <input ref={importRef} type="file" accept="application/json" onChange={importSets} className="hidden" />
            <Button variant="outline" size="sm" onClick={handleImportClick}>
              <Upload className="w-4 h-4 mr-1" /> Import Sets
            </Button>
          </div>
      </div>

      {/* Selection Summary */}
      {selectedTickers.length > 0 && (
        <Card className="max-w-4xl mx-auto mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Selected {selectedTickers.length} companies</h3>
                <p className="text-sm text-muted-foreground">{selectedTickers.join(', ')}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/compare?sel=${encodeURIComponent(selectedTickers.join(','))}`}>
                  <Button>
                    <GitCompare className="w-4 h-4 mr-2" /> Compare Selected
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => setSelectedTickers([])}>Clear</Button>
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
                Save Set
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredEntries
          .sort((a, b) => {
            if (sortBy === 'name') {
              return a[1].name.localeCompare(b[1].name)
            }
            if (sortBy === 'ticker') {
              return a[0].localeCompare(b[0])
            }
            // sector
            const s = (a[1].sector || '').localeCompare(b[1].sector || '')
            return s !== 0 ? s : a[1].name.localeCompare(b[1].name)
          })
          .map(([ticker, company]) => (
          <Card key={ticker} className="group relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 border hover:border-primary/50">
            <CardHeader className="relative pb-3">
              <CardTitle className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{ticker.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="truncate font-semibold group-hover:text-primary transition-colors" title={company.name}>{company.name}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {company.sector}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="bg-background/50 font-mono">{ticker}</Badge>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted hover:scale-110 transition-all duration-200"
                    onClick={() => toggleFavorite(ticker)}
                    aria-label={favorites.includes(ticker) ? 'Unfavorite' : 'Favorite'}
                  >
                    {favorites.includes(ticker) ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> : <StarOff className="w-4 h-4" />}
                  </button>
                  <button
                    className={`inline-flex h-8 px-3 items-center justify-center rounded-md border text-xs font-medium transition-all duration-200 ${
                      selectedTickers.includes(ticker)
                        ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                        : 'hover:bg-muted hover:shadow-sm'
                    }`}
                    onClick={() => toggleSelect(ticker)}
                    aria-pressed={selectedTickers.includes(ticker)}
                  >
                    {selectedTickers.includes(ticker) ? '✓ Selected' : '+ Select'}
                  </button>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                {company.country}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-1 h-1 bg-muted-foreground/60 rounded-full"></span>
                    Currency
                  </span>
                  <Badge variant="secondary" className="text-xs">{company.currency}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-1 h-1 bg-muted-foreground/60 rounded-full"></span>
                    FY End
                  </span>
                  <span className="text-xs font-medium">{company.fiscal_year_end}</span>
                </div>
              </div>
              <Link href={`/company/${ticker}`}>
                <Button className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 group-hover:shadow-md">
                  <Calculator className="w-4 h-4 mr-2" />
                  Analyze {ticker}
                </Button>
              </Link>
            </CardContent>

            {/* Gradient overlay for visual enhancement */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            {/* Hover indicator */}
            <div className="absolute top-4 right-4 w-2 h-2 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </Card>
        ))}
      </div>

      {/* Saved Sets */}
      {savedSets.length > 0 && (
        <div className="max-w-5xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Saved Compare Sets</CardTitle>
              <CardDescription>Quickly load or open saved selections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {savedSets.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 border rounded-md px-2 py-1">
                    <button className="text-sm underline" onClick={() => loadSet(s.name)} title={s.tickers.join(', ')}>
                      {s.name}
                    </button>
                    <Link href={`/compare?sel=${encodeURIComponent(s.tickers.join(','))}`} className="text-sm underline">
                      Open in Compare
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => deleteSet(s.name)} aria-label={`Delete ${s.name}`}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {Object.keys(companies).length > 0 && filteredEntries.length === 0 && (
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold mb-2">No matches</h3>
          <p className="text-muted-foreground">Try a different search term or clear the query.</p>
        </div>
      )}

      {Object.keys(companies).length === 0 && (
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold mb-2">No companies available</h3>
          <p className="text-muted-foreground mb-4">Please verify the API is reachable and try again.</p>
          <Button onClick={fetchCompanies} variant="outline">Retry</Button>
        </div>
      )}

      {/* Comparison Section */}
      <div className="mt-16 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <GitCompare className="w-5 h-5" />
              Company Comparison
            </CardTitle>
            <CardDescription>
              Compare multiple companies side-by-side with interactive charts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/compare">
              <Button className="w-full">
                <BarChart3 className="w-4 h-4 mr-2" />
                Start Comparing
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-12">
        <p className="text-muted-foreground">
          Select a company to view KPIs, run valuations, and generate IC memos
        </p>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Energy IC Copilot</h1>
            <p className="text-muted-foreground">Loading companies...</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingCard key={i} title="Loading company" description="Fetching details..." />
            ))}
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}

