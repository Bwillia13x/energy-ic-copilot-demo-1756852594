import { NextResponse } from 'next/server'
import { DEMO_COMPANIES } from '../_data'

export function GET() {
  return NextResponse.json(DEMO_COMPANIES)
}
