"use client"

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Simple analytics component for tracking page views and user interactions
export function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    // Track page views
    if (typeof window !== 'undefined') {
      // Simple page view tracking
      const pageView = {
        page: pathname,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        referrer: document.referrer
      }

      // Store in localStorage for demo purposes
      // In production, this would be sent to an analytics service
      try {
        const existing = JSON.parse(localStorage.getItem('analytics') || '[]')
        existing.push(pageView)
        // Keep only last 100 entries
        if (existing.length > 100) {
          existing.splice(0, existing.length - 100)
        }
        localStorage.setItem('analytics', JSON.stringify(existing))
      } catch (error) {
        console.warn('Analytics tracking failed:', error)
      }
    }
  }, [pathname])

  // Track user interactions
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const button = target.closest('button, a, [role="button"]')

      if (button) {
        const action = button.getAttribute('data-analytics-action') ||
                      button.textContent?.trim() ||
                      button.getAttribute('aria-label') ||
                      'unknown'

        trackEvent('click', action, {
          element: button.tagName.toLowerCase(),
          page: pathname
        })
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [pathname])

  return null // This component doesn't render anything
}

function trackEvent(eventType: string, action: string, data: any = {}) {
  if (typeof window === 'undefined') return

  try {
    const event = {
      type: eventType,
      action,
      data,
      timestamp: Date.now(),
      sessionId: getSessionId()
    }

    const existing = JSON.parse(localStorage.getItem('events') || '[]')
    existing.push(event)

    // Keep only last 500 events
    if (existing.length > 500) {
      existing.splice(0, existing.length - 500)
    }

    localStorage.setItem('events', JSON.stringify(existing))
  } catch (error) {
    console.warn('Event tracking failed:', error)
  }
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'

  try {
    let sessionId = sessionStorage.getItem('sessionId')
    if (!sessionId) {
      sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2)
      sessionStorage.setItem('sessionId', sessionId)
    }
    return sessionId
  } catch {
    return 'fallback-' + Date.now()
  }
}

// Export for use in other components
export { trackEvent }
