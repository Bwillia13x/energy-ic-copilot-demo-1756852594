"use client"

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchJsonWithTimeout } from '@/lib/http'

interface HealthResponse {
  api: string
  data_files: {
    companies: 'exists' | 'missing'
    mappings: 'exists' | 'missing'
    filings_dir: 'exists' | 'missing'
  }
  core_modules: {
    extract: 'loaded' | 'error'
    valuation: 'loaded' | 'error'
    cite: 'loaded' | 'error'
  }
}

export function ApiHealthBanner() {
  const [unhealthy, setUnhealthy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  const demo = process.env.NEXT_PUBLIC_DEMO === '1' || (process.env.NEXT_PUBLIC_API_URL || '').startsWith('/api/demo')

  const check = async () => {
    try {
      setChecking(true)
      const url = `${process.env.NEXT_PUBLIC_API_URL}/health`
      const res = await fetchJsonWithTimeout<HealthResponse>(url, undefined, 3000)
      const ok = res && res.api === 'healthy'
      setUnhealthy(!ok)
    } catch {
      setUnhealthy(true)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (demo || dismissed || !unhealthy) return null

  return (
    <div className="w-full border-b bg-destructive/5 text-destructive">
      <div className="container mx-auto px-4 py-2 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span className="flex-1">
          API unreachable or unhealthy. Some data may not load.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={check}
          disabled={checking}
          className="h-7"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          {checking ? 'Checking…' : 'Retry'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="h-7"
          aria-label="Dismiss API health banner"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
