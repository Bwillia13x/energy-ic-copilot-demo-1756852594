"use client"

import { AlertTriangle } from 'lucide-react'

export function DemoBanner() {
  const url = process.env.NEXT_PUBLIC_API_URL
  const demo = process.env.NEXT_PUBLIC_DEMO === '1' || (url && url.startsWith('/api/demo'))
  const repo = process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/'
  if (!demo) return null
  return (
    <div className="w-full border-b bg-amber-50 text-amber-900">
      <div className="container mx-auto px-4 py-2 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span className="flex-1">
          Demo Mode: using built-in sample data. No external API required.
        </span>
        <a className="underline" href={repo} target="_blank" rel="noreferrer">View Source</a>
      </div>
    </div>
  )
}
