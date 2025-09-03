'use client'

import React, { ReactNode, createContext, useContext } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query'
import { httpClient, HttpError } from './http'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof HttpError && error.status && error.status >= 400 && error.status < 500) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
})

// Context for accessing query client
const DataClientContext = createContext<QueryClient | null>(null)

export function DataClientProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

export function useDataClient() {
  const context = useContext(DataClientContext)
  return context || queryClient
}

// Typed hooks for common API operations
export interface Company {
  name: string
  ticker: string
  currency: string
  fiscal_year_end: string
  sector: string
  country: string
}

export interface KPI {
  value: number
  unit: string
  citation: {
    doc_id: string
    page: number
    span: [number, number]
    text_preview: string
  }
}

export interface KPISummary {
  ticker: string
  kpis: Record<string, KPI>
  extracted_at: string
}

export interface ValuationInputs {
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

export interface ValuationResults {
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
  dcf_components: Record<string, unknown>
}

// Companies hooks
export function useCompanies(options?: UseQueryOptions<Record<string, Company>, HttpError>) {
  return useQuery({
    queryKey: ['companies'],
    queryFn: () => httpClient.get<Record<string, Company>>('/companies'),
    ...options,
  })
}

export function useCompany(ticker: string, options?: UseQueryOptions<Company, HttpError>) {
  return useQuery({
    queryKey: ['companies', ticker],
    queryFn: () => httpClient.get<Company>(`/companies/${ticker}`),
    enabled: !!ticker,
    ...options,
  })
}

// KPIs hooks
export function useKPIs(ticker: string, options?: UseQueryOptions<KPISummary, HttpError>) {
  return useQuery({
    queryKey: ['kpis', ticker],
    queryFn: () => httpClient.get<KPISummary>(`/kpis/${ticker}`),
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000, // 10 minutes - KPIs don't change often
    ...options,
  })
}

// Valuation hooks
export function useValuationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      ticker,
      inputs,
      scenario
    }: {
      ticker: string
      inputs: ValuationInputs
      scenario?: Record<string, unknown>
    }) => {
      return httpClient.post<ValuationResults>(`/valuation/${ticker}`, {
        body: { ticker, inputs, scenario },
      })
    },
    onSuccess: (data, variables) => {
      // Cache the valuation result
      queryClient.setQueryData(['valuation', variables.ticker], data)
    },
  })
}

export function useValuation(ticker: string, inputs: ValuationInputs | null, scenario?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['valuation', ticker, inputs, scenario],
    queryFn: async () => {
      return httpClient.post<ValuationResults>(`/valuation/${ticker}`, {
        body: { ticker, inputs, scenario },
      })
    },
    enabled: !!ticker && !!inputs,
    staleTime: 60 * 1000, // 1 minute - valuations can be recalculated
  })
}

// XBRL hooks
export interface XbrlResponse {
  ticker: string
  cik: string
  metrics_millions: Record<string, number | null>
  facts_meta: Record<string, Record<string, unknown>>
  source: string
  retrieved_at: string
  period_preference?: string
}

export function useXBRL(ticker: string, period: string = 'any', options?: UseQueryOptions<XbrlResponse, HttpError>) {
  return useQuery({
    queryKey: ['xbrl', ticker, period],
    queryFn: () => httpClient.get<XbrlResponse>(`/xbrl/${ticker}?period=${period}`),
    enabled: !!ticker,
    staleTime: 30 * 60 * 1000, // 30 minutes - XBRL data updates quarterly
    ...options,
  })
}

// Health check hook
export function useHealth(options?: UseQueryOptions<Record<string, unknown>, HttpError>) {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => httpClient.get<Record<string, unknown>>('/health'),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  })
}

// Utility hooks
export function useInvalidateQueries() {
  const queryClient = useQueryClient()

  return {
    invalidateCompanies: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
    invalidateKPIs: (ticker?: string) =>
      queryClient.invalidateQueries({
        queryKey: ticker ? ['kpis', ticker] : ['kpis']
      }),
    invalidateValuation: (ticker?: string) =>
      queryClient.invalidateQueries({
        queryKey: ticker ? ['valuation', ticker] : ['valuation']
      }),
    invalidateXBRL: (ticker?: string) =>
      queryClient.invalidateQueries({
        queryKey: ticker ? ['xbrl', ticker] : ['xbrl']
      }),
  }
}

export { queryClient }
