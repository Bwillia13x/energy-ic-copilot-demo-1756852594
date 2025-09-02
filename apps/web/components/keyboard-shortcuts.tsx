"use client"

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

// Keyboard shortcuts component for power users
export function KeyboardShortcuts() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts if not typing in an input
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey

      // Global shortcuts
      if (isCtrlOrCmd) {
        switch (event.key.toLowerCase()) {
          case 'h':
            event.preventDefault()
            router.push('/')
            toast({ title: 'Home', description: 'Navigated to home page' })
            break

          case 'c':
            event.preventDefault()
            router.push('/compare')
            toast({ title: 'Compare', description: 'Opened company comparison' })
            break

          case '/':
            event.preventDefault()
            // Focus search input if on home page
            if (pathname === '/') {
              const searchInput = document.querySelector('input[placeholder*="search"]') as HTMLInputElement
              searchInput?.focus()
            }
            break

          case 'k':
            event.preventDefault()
            // Show keyboard shortcuts help
            showShortcutsHelp()
            break
        }
      }

      // Page-specific shortcuts
      if (!isCtrlOrCmd) {
        switch (event.key.toLowerCase()) {
          case 'escape':
            // Clear selections or close modals
            if (pathname === '/') {
              const selectedButtons = document.querySelectorAll('[aria-pressed="true"]')
              selectedButtons.forEach(button => {
                (button as HTMLElement).click()
              })
            }
            break

          case 'f':
            if (pathname === '/') {
              // Toggle favorites filter
              const favButton = document.querySelector('[aria-pressed]') as HTMLElement
              favButton?.click()
            }
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [router, pathname])

  const showShortcutsHelp = () => {
    const shortcuts = [
      { key: 'Ctrl/Cmd + H', action: 'Go to Home' },
      { key: 'Ctrl/Cmd + C', action: 'Open Compare' },
      { key: 'Ctrl/Cmd + /', action: 'Focus search (Home)' },
      { key: 'Ctrl/Cmd + K', action: 'Show this help' },
      { key: 'F', action: 'Toggle favorites (Home)' },
      { key: 'Escape', action: 'Clear selections' }
    ]

    const message = shortcuts.map(s => `${s.key}: ${s.action}`).join('\n')

    toast({
      title: 'Keyboard Shortcuts',
      description: message,
      duration: 8000
    })
  }

  return null // This component doesn't render anything
}
