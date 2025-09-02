'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { useLoading } from '@/lib/loading-context'

export function DemoLoading() {
  const { startLoading, stopLoading, updateProgress } = useLoading()

  const simulateLongOperation = async (message: string, duration: number) => {
    startLoading(message)

    for (let i = 0; i <= 100; i += 10) {
      updateProgress(i)
      await new Promise(resolve => setTimeout(resolve, duration / 10))
    }

    await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause at 100%
    stopLoading()
  }

  return (
    <div className="p-4 space-x-2">
      <Button
        onClick={() => simulateLongOperation('Processing data...', 2000)}
        variant="outline"
      >
        Simulate Data Processing (2s)
      </Button>
      <Button
        onClick={() => simulateLongOperation('Generating PDF...', 3000)}
        variant="outline"
      >
        Simulate PDF Generation (3s)
      </Button>
      <Button
        onClick={() => simulateLongOperation('Calculating valuation...', 1500)}
        variant="outline"
      >
        Simulate Valuation Calc (1.5s)
      </Button>
    </div>
  )
}
