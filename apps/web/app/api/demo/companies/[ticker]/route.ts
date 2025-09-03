import { NextResponse } from 'next/server'
import { DEMO_COMPANIES } from '../../_data'

export function GET(_req: Request, { params }: { params: { ticker: string } }) {
  const key = (params.ticker || '').toUpperCase()
  const c = DEMO_COMPANIES[key]
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(c)
}
