import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({ api: 'healthy', demo: true, ts: Date.now() })
}

