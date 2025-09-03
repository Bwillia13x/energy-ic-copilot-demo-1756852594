// Demo presets and cached results for offline/slow-network performance
// This provides a seamless experience even when APIs are slow or unavailable

export interface DemoScenario {
  id: string
  name: string
  description: string
  ticker: string
  inputs: {
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
  results: {
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
  }
  scenario?: {
    rate_bps_change: number
    throughput_pct_change: number
    ebitda_uplift: number
  }
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

// Pre-seeded demo scenarios with realistic data
export const demoScenarios: DemoScenario[] = [
  {
    id: 'ppl-baseline',
    name: 'Pembina Pipeline - Base Case',
    description: 'Conservative valuation using current market assumptions and company fundamentals.',
    ticker: 'PPL',
    inputs: {
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
      equity_weight: 0.6,
    },
    results: {
      epv: 31800,
      dcf_value: 31200,
      wacc: 0.068,
      cost_of_equity: 0.088,
      cost_of_debt_after_tax: 0.0375,
      ev_ebitda_ratio: 9.2,
      net_debt_ebitda_ratio: 5.4,
      roic: 0.085,
      roe: 0.112,
      payout_ratio: 0.65,
      dividend_yield: 0.051,
      debt_to_equity: 0.85,
      interest_coverage: 13.8,
    },
    tags: ['midstream', 'conservative', 'canadian'],
    difficulty: 'beginner',
  },
  {
    id: 'ppl-bull-case',
    name: 'Pembina Pipeline - Bull Case',
    description: 'Optimistic scenario with higher throughput and EBITDA growth.',
    ticker: 'PPL',
    inputs: {
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
      equity_weight: 0.6,
    },
    results: {
      epv: 35800,
      dcf_value: 34500,
      wacc: 0.068,
      cost_of_equity: 0.088,
      cost_of_debt_after_tax: 0.0375,
      ev_ebitda_ratio: 10.4,
      net_debt_ebitda_ratio: 5.4,
      roic: 0.092,
      roe: 0.125,
      payout_ratio: 0.58,
      dividend_yield: 0.045,
      debt_to_equity: 0.85,
      interest_coverage: 15.2,
    },
    scenario: {
      rate_bps_change: -50, // 50bps rate cut
      throughput_pct_change: 0.08, // 8% throughput increase
      ebitda_uplift: 0.05, // 5% EBITDA uplift
    },
    tags: ['midstream', 'optimistic', 'growth'],
    difficulty: 'intermediate',
  },
  {
    id: 'enb-conservative',
    name: 'Enbridge - Conservative',
    description: 'Stable valuation for Canada\'s largest energy infrastructure company.',
    ticker: 'ENB',
    inputs: {
      ebitda: 5200,
      net_debt: 28500,
      maintenance_capex: 350,
      tax_rate: 0.25,
      reinvestment_rate: 0.18,
      risk_free_rate: 0.04,
      market_risk_premium: 0.06,
      beta: 0.75,
      cost_of_debt: 0.048,
      debt_weight: 0.45,
      equity_weight: 0.55,
    },
    results: {
      epv: 45200,
      dcf_value: 43800,
      wacc: 0.065,
      cost_of_equity: 0.085,
      cost_of_debt_after_tax: 0.036,
      ev_ebitda_ratio: 8.7,
      net_debt_ebitda_ratio: 5.5,
      roic: 0.078,
      roe: 0.098,
      payout_ratio: 0.72,
      dividend_yield: 0.058,
      debt_to_equity: 0.95,
      interest_coverage: 14.9,
    },
    tags: ['pipeline', 'conservative', 'dividend'],
    difficulty: 'beginner',
  },
  {
    id: 'trp-growth',
    name: 'TC Energy - Growth Focus',
    description: 'Growth-oriented valuation emphasizing LNG and pipeline expansion.',
    ticker: 'TRP',
    inputs: {
      ebitda: 3800,
      net_debt: 22100,
      maintenance_capex: 280,
      tax_rate: 0.25,
      reinvestment_rate: 0.22,
      risk_free_rate: 0.04,
      market_risk_premium: 0.06,
      beta: 0.85,
      cost_of_debt: 0.052,
      debt_weight: 0.42,
      equity_weight: 0.58,
    },
    results: {
      epv: 33500,
      dcf_value: 34800,
      wacc: 0.071,
      cost_of_equity: 0.091,
      cost_of_debt_after_tax: 0.039,
      ev_ebitda_ratio: 9.8,
      net_debt_ebitda_ratio: 5.8,
      roic: 0.082,
      roe: 0.105,
      payout_ratio: 0.68,
      dividend_yield: 0.055,
      debt_to_equity: 0.88,
      interest_coverage: 12.3,
    },
    scenario: {
      rate_bps_change: 25, // 25bps rate increase
      throughput_pct_change: 0.12, // 12% throughput increase
      ebitda_uplift: 0.08, // 8% EBITDA uplift
    },
    tags: ['lng', 'growth', 'international'],
    difficulty: 'advanced',
  },
  {
    id: 'kmi-recovery',
    name: 'Kinder Morgan - Recovery Play',
    description: 'Post-pandemic recovery scenario with volume normalization.',
    ticker: 'KMI',
    inputs: {
      ebitda: 4100,
      net_debt: 23800,
      maintenance_capex: 310,
      tax_rate: 0.21,
      reinvestment_rate: 0.16,
      risk_free_rate: 0.04,
      market_risk_premium: 0.06,
      beta: 0.9,
      cost_of_debt: 0.055,
      debt_weight: 0.48,
      equity_weight: 0.52,
    },
    results: {
      epv: 36800,
      dcf_value: 35200,
      wacc: 0.074,
      cost_of_equity: 0.094,
      cost_of_debt_after_tax: 0.043,
      ev_ebitda_ratio: 9.0,
      net_debt_ebitda_ratio: 5.8,
      roic: 0.076,
      roe: 0.089,
      payout_ratio: 0.75,
      dividend_yield: 0.062,
      debt_to_equity: 1.05,
      interest_coverage: 11.7,
    },
    scenario: {
      rate_bps_change: -75, // 75bps rate cut
      throughput_pct_change: 0.15, // 15% recovery in volumes
      ebitda_uplift: 0.03, // 3% efficiency gains
    },
    tags: ['recovery', 'efficiency', 'us-focused'],
    difficulty: 'intermediate',
  },
]

// Demo company data for offline use
export const demoCompanies = [
  {
    name: 'Pembina Pipeline Corporation',
    ticker: 'PPL',
    currency: 'CAD',
    fiscal_year_end: 'December 31',
    sector: 'Midstream Energy',
    country: 'Canada',
  },
  {
    name: 'Enbridge Inc.',
    ticker: 'ENB',
    currency: 'CAD',
    fiscal_year_end: 'December 31',
    sector: 'Midstream Energy',
    country: 'Canada',
  },
  {
    name: 'TC Energy Corporation',
    ticker: 'TRP',
    currency: 'CAD',
    fiscal_year_end: 'December 31',
    sector: 'Midstream Energy',
    country: 'Canada',
  },
  {
    name: 'Kinder Morgan, Inc.',
    ticker: 'KMI',
    currency: 'USD',
    fiscal_year_end: 'December 31',
    sector: 'Midstream Energy',
    country: 'United States',
  },
  {
    name: 'ONEOK, Inc.',
    ticker: 'OKE',
    currency: 'USD',
    fiscal_year_end: 'December 31',
    sector: 'Midstream Energy',
    country: 'United States',
  },
]

// Demo KPI data for offline use
export const demoKPIs = {
  PPL: {
    EBITDA: { value: 3450, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 15, span: [100, 120] } },
    NetDebt: { value: 18750, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 23, span: [200, 220] } },
    MaintenanceCapex: { value: 220, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 18, span: [150, 170] } },
    FFO: { value: 2890, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 16, span: [130, 150] } },
  },
  ENB: {
    EBITDA: { value: 5200, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 12, span: [90, 110] } },
    NetDebt: { value: 28500, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 28, span: [180, 200] } },
    MaintenanceCapex: { value: 350, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 15, span: [120, 140] } },
    FFO: { value: 4150, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 13, span: [100, 120] } },
  },
  TRP: {
    EBITDA: { value: 3800, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 14, span: [110, 130] } },
    NetDebt: { value: 22100, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 25, span: [160, 180] } },
    MaintenanceCapex: { value: 280, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 17, span: [130, 150] } },
    FFO: { value: 3120, unit: 'CAD millions', citation: { doc_id: 'Q2_2024_MD&A.pdf', page: 15, span: [120, 140] } },
  },
  KMI: {
    EBITDA: { value: 4100, unit: 'USD millions', citation: { doc_id: 'Q2_2024_10Q.pdf', page: 8, span: [60, 80] } },
    NetDebt: { value: 23800, unit: 'USD millions', citation: { doc_id: 'Q2_2024_10Q.pdf', page: 22, span: [140, 160] } },
    MaintenanceCapex: { value: 310, unit: 'USD millions', citation: { doc_id: 'Q2_2024_10Q.pdf', page: 11, span: [80, 100] } },
    FFO: { value: 3380, unit: 'USD millions', citation: { doc_id: 'Q2_2024_10Q.pdf', page: 9, span: [70, 90] } },
  },
  OKE: {
    EBITDA: { value: 2950, unit: 'USD millions', citation: { doc_id: 'Q2_2024_10Q.pdf', page: 7, span: [50, 70] } },
    NetDebt: { value: 16200, unit: 'USD millions', citation: { doc_id: 'Q2_2024_10Q.pdf', page: 19, span: [120, 140] } },
    MaintenanceCapex: { value: 180, unit: 'USD millions', citation: { doc_id: 'Q2_2024_10Q.pdf', page: 10, span: [70, 90] } },
    FFO: { value: 2420, unit: 'USD millions', citation: { doc_id: 'Q2_2024_10Q.pdf', page: 8, span: [60, 80] } },
  },
}

// Utility functions for demo mode
export function getDemoScenario(id: string): DemoScenario | undefined {
  return demoScenarios.find(scenario => scenario.id === id)
}

export function getScenariosByTicker(ticker: string): DemoScenario[] {
  return demoScenarios.filter(scenario => scenario.ticker === ticker)
}

export function getScenariosByTag(tag: string): DemoScenario[] {
  return demoScenarios.filter(scenario => scenario.tags.includes(tag))
}

export function getScenariosByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): DemoScenario[] {
  return demoScenarios.filter(scenario => scenario.difficulty === difficulty)
}

// Cache management for offline performance
class DemoCache {
  private cache = new Map<string, { data: unknown; timestamp: number }>()
  private readonly CACHE_PREFIX = 'demo_cache_'
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

  set(key: string, data: unknown): void {
    const cacheKey = this.CACHE_PREFIX + key
    const cacheEntry = {
      data,
      timestamp: Date.now(),
    }
    this.cache.set(key, cacheEntry!)
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry))
    } catch (e) {
      console.warn('Failed to store demo cache in localStorage:', e)
    }
  }

  get<T = unknown>(key: string): T | null {
    // First check memory cache
    let entry = this.cache.get(key)

    // If not in memory, check localStorage
    if (!entry) {
      try {
        const cacheKey = this.CACHE_PREFIX + key
        const stored = localStorage.getItem(cacheKey)
        if (stored) {
          const parsed = JSON.parse(stored) as { data: unknown; timestamp: number }
          entry = parsed
          // Restore to memory cache
          this.cache.set(key, entry)
        }
      } catch (e) {
        console.warn('Failed to load demo cache from localStorage:', e)
      }
    }

    // Check if entry is expired
    if (entry && (Date.now() - entry.timestamp) > this.CACHE_EXPIRY) {
      this.delete(key)
      return null
    }

    return entry ? (entry.data as T) : null
  }

  delete(key: string): void {
    this.cache.delete(key)
    try {
      localStorage.removeItem(this.CACHE_PREFIX + key)
    } catch (e) {
      console.warn('Failed to delete demo cache from localStorage:', e)
    }
  }

  clear(): void {
    // Clear memory cache
    this.cache.clear()

    // Clear localStorage
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key)
        }
      })
    } catch (e) {
      console.warn('Failed to clear demo cache from localStorage:', e)
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (entry && (Date.now() - entry.timestamp) > this.CACHE_EXPIRY) {
      this.delete(key)
      return false
    }
    return !!entry
  }
}

export const demoCache = new DemoCache()

// Demo mode detection and utilities
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO === '1' || typeof window !== 'undefined'
}

export function shouldUseDemoData(): boolean {
  return isDemoMode() && typeof window !== 'undefined'
}

// Prefetch demo data for better performance
export function prefetchDemoData(): void {
  if (!shouldUseDemoData()) return

  // Cache demo companies
  demoCache.set('companies', demoCompanies)

  // Cache demo KPIs
  Object.entries(demoKPIs).forEach(([ticker, kpis]) => {
    demoCache.set(`kpis_${ticker}`, {
      ticker,
      kpis,
      extracted_at: new Date().toISOString(),
    })
  })

  // Cache demo scenarios
  demoScenarios.forEach(scenario => {
    demoCache.set(`scenario_${scenario.id}`, scenario)
  })

  console.log('Demo data prefetched for offline performance')
}

// Auto-prefetch on module load
if (shouldUseDemoData()) {
  // Use setTimeout to avoid blocking initial render
  setTimeout(prefetchDemoData, 100)
}
