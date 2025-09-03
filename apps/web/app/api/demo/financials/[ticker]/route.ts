import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Params { params: { ticker: string } }

function loadInputs(): any {
  // Next app runs with cwd at apps/web; project data lives at ../../data
  const filePath = path.resolve(process.cwd(), '..', '..', 'data', 'demo_initial_inputs.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

async function fetchFxRate(base: string, to: string, method: string, date?: string) {
  // method: 'spot' or 'fyavg' (spot default)
  try {
    if (method === 'fyavg') {
      // Compute simple average over FY (Jan 1 to Dec 31) of the provided date year
      const year = (date || '').slice(0, 4)
      const start = `${year}-01-01`
      const end = `${year}-12-31`
      const url = `https://api.exchangerate.host/timeseries?start_date=${start}&end_date=${end}&base=${base}&symbols=${to}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error(`FX timeseries fetch failed: ${res.status}`)
      const data: any = await res.json()
      const rates = data?.rates || {}
      const vals: number[] = Object.values(rates).map((r: any) => r?.[to]).filter((x: any) => typeof x === 'number') as number[]
      if (!vals.length) throw new Error('No FX data points')
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      return { rate: avg, method: 'fyavg', source: 'exchangerate.host', start, end }
    } else {
      const d = date || new Date().toISOString().slice(0, 10)
      const url = `https://api.exchangerate.host/${d}?base=${base}&symbols=${to}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error(`FX daily fetch failed: ${res.status}`)
      const data: any = await res.json()
      const rate = data?.rates?.[to]
      if (typeof rate !== 'number') throw new Error('Invalid FX rate')
      return { rate, method: 'spot', source: 'exchangerate.host', date: d }
    }
  } catch (e) {
    return null
  }
}

export async function GET(req: Request, { params }: Params) {
  const key = (params.ticker || '').toUpperCase()
  const data = loadInputs()
  const item = data[key]
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const trace: any[] = []

  // Derived metrics: gross debt and net debt (with and without leases when applicable)
  let grossDebtExclLeases: number | null = null
  let grossDebtInclLeases: number | null = null
  let netDebtExclLeases: number | null = null
  let netDebtInclLeases: number | null = null

  const cash = item.cash_and_equivalents ?? null

  if (key === 'PSX') {
    const short = item.short_term_debt ?? null
    const long = item.long_term_debt ?? null
    if (short != null && long != null) {
      grossDebtExclLeases = short + long
      trace.push({
        name: 'Gross debt (excl. leases)',
        formula: 'short_term_debt + long_term_debt',
        inputs: { short_term_debt: short, long_term_debt: long },
        value: grossDebtExclLeases,
        units: `${item.currency} ${item.units}`,
        rationale: 'PSX reports debt in current and long-term portions; no lease liabilities provided.'
      })
    }
  }

  if (key === 'SU') {
    const currentPortion = item.current_portion_long_term_debt ?? 0
    const long = item.long_term_debt ?? 0
    const leases = item.long_term_lease_liabilities ?? 0
    grossDebtExclLeases = (currentPortion != null && long != null) ? (currentPortion + long) : null
    grossDebtInclLeases = (grossDebtExclLeases != null) ? (grossDebtExclLeases + (leases || 0)) : null

    if (grossDebtExclLeases != null) {
      trace.push({
        name: 'Gross debt (excl. leases)',
        formula: 'current_portion_long_term_debt + long_term_debt',
        inputs: { current_portion_long_term_debt: currentPortion, long_term_debt: long },
        value: grossDebtExclLeases,
        units: `${item.currency} ${item.units}`,
        rationale: 'IFRS: using interest-bearing borrowings; excludes lease liabilities for comparability.'
      })
    }
    if (grossDebtInclLeases != null) {
      trace.push({
        name: 'Gross debt (incl. leases)',
        formula: 'gross_debt_excl_leases + long_term_lease_liabilities',
        inputs: { gross_debt_excl_leases: grossDebtExclLeases, long_term_lease_liabilities: leases },
        value: grossDebtInclLeases,
        units: `${item.currency} ${item.units}`,
        rationale: 'IFRS: lease liabilities included when analyzing total obligations.'
      })
    }
  }

  // TRP: use total_debt if present (companyfacts us-gaap:DebtInstrumentCarryingAmount)
  if (key === 'TRP') {
    const tDebt = item.total_debt ?? null
    const st = item.short_term_debt ?? null
    const lt = item.long_term_debt ?? null
    if (tDebt != null) {
      grossDebtExclLeases = tDebt
      trace.push({
        name: 'Gross debt (total carrying amount)',
        formula: 'total_debt (DebtInstrumentCarryingAmount)',
        inputs: { total_debt: tDebt },
        value: grossDebtExclLeases,
        units: `${item.currency} ${item.units}`,
        rationale: 'Total debt per companyfacts us-gaap:DebtInstrumentCarryingAmount as at fiscal year-end.'
      })
      if (st != null) {
        trace.push({
          name: 'Current portion of long-term debt',
          formula: 'short_term_debt (LongTermDebtCurrent)',
          inputs: { short_term_debt: st },
          value: st,
          units: `${item.currency} ${item.units}`,
          rationale: 'Per companyfacts us-gaap:LongTermDebtCurrent.'
        })
      }
      if (lt != null) {
        trace.push({
          name: 'Long-term debt (non-current)',
          formula: 'as reported (if available)',
          inputs: { long_term_debt: lt },
          value: lt,
          units: `${item.currency} ${item.units}`,
          rationale: 'uses provided long_term_debt when explicitly available.'
        })
      }
    }
  }

  // Net debt calculations where possible
  if (cash != null && grossDebtExclLeases != null) {
    netDebtExclLeases = grossDebtExclLeases - cash
    trace.push({
      name: 'Net debt (excl. leases)',
      formula: 'gross_debt_excl_leases - cash_and_equivalents',
      inputs: { gross_debt_excl_leases: grossDebtExclLeases, cash_and_equivalents: cash },
      value: netDebtExclLeases,
      units: `${item.currency} ${item.units}`,
      rationale: 'Standard definition: interest-bearing debt less cash/equivalents.'
    })
  }

  if (cash != null && grossDebtInclLeases != null) {
    netDebtInclLeases = grossDebtInclLeases - cash
    trace.push({
      name: 'Net debt (incl. leases)',
      formula: 'gross_debt_incl_leases - cash_and_equivalents',
      inputs: { gross_debt_incl_leases: grossDebtInclLeases, cash_and_equivalents: cash },
      value: netDebtInclLeases,
      units: `${item.currency} ${item.units}`,
      rationale: 'Debt including lease liabilities less cash/equivalents.'
    })
  }

  const derived = {
    gross_debt_excl_leases: grossDebtExclLeases,
    gross_debt_incl_leases: grossDebtInclLeases,
    net_debt_excl_leases: netDebtExclLeases,
    net_debt_incl_leases: netDebtInclLeases,
  }

  // Optional FX conversion
  const url = new URL(req.url)
  const to = (url.searchParams.get('to') || '').toUpperCase()
  const fxOverride = url.searchParams.get('fx')
  const method = (url.searchParams.get('method') || 'fyavg').toLowerCase()
  const date = url.searchParams.get('date') || (item.fiscal_year_end || '')

  let fx: any = null
  let auditedOut: any = { ...item }
  let derivedOut: any = { ...derived }

  const convertNumeric = (obj: any, rate: number) => {
    const numericKeys = new Set<string>([
      'revenues_total', 'net_income_attrib_parent', 'net_earnings', 'cash_from_operations',
      'capital_expenditures_additions', 'capital_and_exploration_expenditures', 'total_assets',
      'total_liabilities', 'short_term_debt', 'long_term_debt', 'total_debt', 'cash_and_equivalents',
      'equity', 'total_current_liabilities', 'current_portion_long_term_debt', 'long_term_lease_liabilities'
    ])
    const out: any = Array.isArray(obj) ? [] : { ...obj }
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k]
      if (v == null) { out[k] = v; continue }
      if (numericKeys.has(k) && typeof v === 'number') {
        out[k] = v * rate
      } else {
        out[k] = v
      }
    }
    return out
  }

  const convertDerived = (obj: any, rate: number) => {
    const out: any = {}
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      out[k] = (typeof v === 'number') ? v * rate : v
    }
    return out
  }

  if (to && to !== item.currency) {
    let rate: number | null = null
    if (fxOverride && !Number.isNaN(Number(fxOverride))) {
      rate = Number(fxOverride)
      fx = { rate, method: 'override', source: 'query', to, from: item.currency }
    } else {
      const fetched = await fetchFxRate(item.currency, to, method, date)
      if (fetched) {
        rate = fetched.rate
        fx = { ...fetched, to, from: item.currency }
      }
    }
    if (rate) {
      auditedOut = convertNumeric(item, rate)
      auditedOut.currency = to
      derivedOut = convertDerived(derived, rate)
      trace.push({
        name: 'FX conversion',
        formula: `${item.currency} → ${to}: multiply values by rate`,
        inputs: { from: item.currency, to, rate, method: fx.method },
        rationale: 'Converted audited and derived figures for display parity.'
      })
    }
  }

  return NextResponse.json({
    ticker: key,
    audited: auditedOut,
    derived: derivedOut,
    fx,
    calculation_trace: trace
  })
}
