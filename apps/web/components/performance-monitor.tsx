"use client"

import { useEffect, useState } from 'react'

// Performance monitoring component for tracking Core Web Vitals
interface PerformanceMetrics {
  [key: string]: {
    value: number;
    timestamp: number;
  };
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({})

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    // Track Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') continue

        const perfEntry = entry as PerformanceEntry & { value?: number }

        setMetrics((prev) => ({
          ...prev,
          [entry.name]: {
            value: perfEntry.value ?? 0,
            timestamp: Date.now()
          }
        }))

        // Store in localStorage for analysis
        try {
          const stored = JSON.parse(localStorage.getItem('performance') || '{}')
          stored[entry.name] = {
            value: perfEntry.value ?? 0,
            timestamp: Date.now(),
            url: window.location.href
          }
          localStorage.setItem('performance', JSON.stringify(stored))
        } catch (error) {
          console.warn('Performance storage failed:', error)
        }
      }
    })

    // Observe performance metrics
    try {
      observer.observe({ entryTypes: ['measure', 'navigation', 'paint', 'largest-contentful-paint'] })
    } catch (error) {
      console.warn('Performance observer not supported:', error)
    }

    // Track custom metrics
    const trackCustomMetrics = () => {
      // Time to interactive
      if (window.performance.timing.loadEventEnd) {
        const tti = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart
        setMetrics((prev) => ({ ...prev, TTI: { value: tti, timestamp: Date.now() } }))
      }

      // Memory usage (if available)
      if ('memory' in performance) {
        const memoryInfo = (performance as any).memory as { usedJSHeapSize: number }
        setMetrics((prev) => ({
          ...prev,
          memory: {
            value: memoryInfo.usedJSHeapSize,
            timestamp: Date.now()
          }
        }))
      }
    }

    // Track on page load and periodically
    window.addEventListener('load', trackCustomMetrics)
    const interval = setInterval(trackCustomMetrics, 30000) // Every 30 seconds

    return () => {
      observer.disconnect()
      window.removeEventListener('load', trackCustomMetrics)
      clearInterval(interval)
    }
  }, [])

  // Log metrics to console in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && Object.keys(metrics).length > 0) {
      console.log('📊 Performance Metrics:', metrics)
    }
  }, [metrics])

  return null // This component doesn't render anything
}

// Hook for manual performance tracking
export function usePerformanceTracker() {
  const trackMetric = (name: string, value: number, unit: string = 'ms') => {
    if (typeof window === 'undefined') return

    try {
      const metric = {
        name,
        value,
        unit,
        timestamp: Date.now(),
        url: window.location.href
      }

      // Store in localStorage
      const stored = JSON.parse(localStorage.getItem('custom-metrics') || '[]')
      stored.push(metric)

      // Keep only last 100 metrics
      if (stored.length > 100) {
        stored.splice(0, stored.length - 100)
      }

      localStorage.setItem('custom-metrics', JSON.stringify(stored))

      // Log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`📈 ${name}:`, value, unit)
      }
    } catch (error) {
      console.warn('Custom metric tracking failed:', error)
    }
  }

  const trackTiming = (name: string, startTime?: number) => {
    const start = startTime || performance.now()
    return {
      end: () => {
        const duration = performance.now() - start
        trackMetric(name, duration, 'ms')
        return duration
      }
    }
  }

  return { trackMetric, trackTiming }
}
