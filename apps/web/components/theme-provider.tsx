'use client'

import * as React from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'energy-ic-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(defaultTheme)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    // Only access localStorage on the client side
    if (typeof window !== 'undefined') {
      try {
        const storedTheme = localStorage.getItem(storageKey) as Theme
        if (storedTheme && ['dark', 'light', 'system'].includes(storedTheme)) {
          setTheme(storedTheme)
        }
      } catch (error) {
        // localStorage might not be available in some environments
        console.warn('Unable to access localStorage:', error)
      }
    }
  }, [storageKey])

  React.useEffect(() => {
    if (!mounted || typeof window === 'undefined') return

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme, mounted])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      setTheme(newTheme)
      if (mounted && typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, newTheme)
        } catch (error) {
          console.warn('Unable to save theme to localStorage:', error)
        }
      }
    },
  }

  // Always return the same structure to avoid hydration mismatches
  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
