import { NextResponse } from 'next/server'
import { DEMO_COMPANIES } from '../../_data'

interface Params { params: { ticker: string } }

export function GET(_req: Request, { params }: Params) {
  const key = (params.ticker || '').toUpperCase()
  const c = (DEMO_COMPANIES as any)[key]
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(c)
}
