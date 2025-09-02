import { NextResponse } from 'next/server'

function calc(inputs: any) {
  const rf = inputs.risk_free_rate ?? 0.04
  const mrp = inputs.market_risk_premium ?? 0.06
  const beta = inputs.beta ?? 0.8
  const cod = inputs.cost_of_debt ?? 0.05
  const tax = inputs.tax_rate ?? 0.25
  const dw = inputs.debt_weight ?? 0.4
  const ew = inputs.equity_weight ?? 0.6

  const coe = rf + beta * mrp
  const codAfter = cod * (1 - tax)
  const wacc = ew * coe + dw * codAfter

  const ebitda = inputs.ebitda ?? 5000
  const maint = inputs.maintenance_capex ?? ebitda * 0.1
  const fcf = Math.max(0, ebitda - maint)

  const epv = Math.round((fcf / Math.max(0.06, wacc)) / 100) * 100 // rough
  const dcf_value = Math.round((fcf * 8) / 100) * 100
  const ev_ebitda_ratio = +(epv / Math.max(1, ebitda)).toFixed(2)
  const net_debt_ebitda_ratio = +((inputs.net_debt ?? 0) / Math.max(1, ebitda)).toFixed(2)

  return { epv, dcf_value, wacc, cost_of_equity: coe, cost_of_debt_after_tax: codAfter, ev_ebitda_ratio, net_debt_ebitda_ratio }
}

interface Params { params: { ticker: string } }

export async function POST(req: Request, { params }: Params) {
  const body = await req.json().catch(() => ({}))
  const inputs = body?.inputs || {}
  return NextResponse.json(calc(inputs))
}

