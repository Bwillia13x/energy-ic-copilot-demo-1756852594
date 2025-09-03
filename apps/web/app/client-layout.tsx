"use client"

import React from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { ApiHealthBanner } from '@/components/api-health-banner'
import { DemoBanner } from '@/components/demo-banner'
import { TopProgress } from '@/components/top-progress'
import { LoadingProvider } from '@/lib/loading-context'
import { Analytics } from '@/components/analytics'
import { PerformanceMonitor } from '@/components/performance-monitor'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = React.useState(false)

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return null
  }

  return React.createElement(React.Fragment, null, children)
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(TopProgress, null),
    React.createElement(
      ThemeProvider,
      { defaultTheme: "system", storageKey: "energy-ic-theme" },
      React.createElement(
        LoadingProvider,
        null,
        React.createElement(
          ErrorBoundary,
          null,
          React.createElement(
            "a",
            {
              href: "#main",
              className: "sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-background border rounded px-3 py-1"
            },
            "Skip to content"
          ),
          React.createElement(DemoBanner, null),
          React.createElement(SiteHeader, null),
          React.createElement(
            ClientOnly,
            null,
            React.createElement(ApiHealthBanner, null),
            React.createElement(Toaster, null),
            React.createElement(Analytics, null),
            React.createElement(PerformanceMonitor, null),
            React.createElement(KeyboardShortcuts, null)
          ),
          React.createElement(
            "div",
            { id: "main", className: "min-h-screen bg-background" },
            children
          ),
          React.createElement(SiteFooter, null)
        )
      )
    )
  )
}
