import { NextResponse } from 'next/server'

const KPI_DOC = (ticker: string) => ({ doc_id: `${ticker}-MD&A-2024`, page: 12, span: [100, 160], text_preview: 'Sample extracted KPI from filing' })

function sampleKpis(ticker: string) {
  if (ticker === 'ENB') {
    return {
      EBITDA: { value: 15000, unit: 'CAD millions', citation: KPI_DOC(ticker) },
      NetDebt: { value: 70000, unit: 'CAD millions', citation: KPI_DOC(ticker) },
      MaintenanceCapex: { value: 1500, unit: 'CAD millions', citation: KPI_DOC(ticker) },
      FFO: { value: 9000, unit: 'CAD millions', citation: KPI_DOC(ticker) },
    }
  }
  if (ticker === 'TRP') {
    return {
      EBITDA: { value: 10000, unit: 'CAD millions', citation: KPI_DOC(ticker) },
      NetDebt: { value: 50000, unit: 'CAD millions', citation: KPI_DOC(ticker) },
      MaintenanceCapex: { value: 1200, unit: 'CAD millions', citation: KPI_DOC(ticker) },
      FFO: { value: 6000, unit: 'CAD millions', citation: KPI_DOC(ticker) },
    }
  }
  return {
    EBITDA: { value: 7000, unit: 'CAD millions', citation: KPI_DOC(ticker) },
    NetDebt: { value: 20000, unit: 'CAD millions', citation: KPI_DOC(ticker) },
    MaintenanceCapex: { value: 800, unit: 'CAD millions', citation: KPI_DOC(ticker) },
    FFO: { value: 4200, unit: 'CAD millions', citation: KPI_DOC(ticker) },
  }
}

interface Params { params: { ticker: string } }

export function GET(_req: Request, { params }: Params) {
  const key = (params.ticker || '').toUpperCase()
  return NextResponse.json({ ticker: key, kpis: sampleKpis(key), extracted_at: new Date().toISOString() })
}

