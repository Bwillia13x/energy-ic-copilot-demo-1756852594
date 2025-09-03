'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface DataFreshnessBadgeProps {
  lastUpdated?: string | Date | null
  isLoading?: boolean
  onRefresh?: () => void
  className?: string
  showRefreshButton?: boolean
  compact?: boolean
}

export function DataFreshnessBadge({
  lastUpdated,
  isLoading = false,
  onRefresh,
  className,
  showRefreshButton = true,
  compact = false
}: DataFreshnessBadgeProps) {
  if (!lastUpdated) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="w-3 h-3 mr-1" />
          No data
        </Badge>
      </div>
    )
  }

  const updatedDate = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60))

  // Determine freshness status
  let status: 'fresh' | 'stale' | 'old' | 'very-old'
  let statusText: string
  let variant: 'default' | 'secondary' | 'destructive' | 'outline'

  if (diffInMinutes < 5) {
    status = 'fresh'
    statusText = 'Fresh'
    variant = 'default'
  } else if (diffInMinutes < 60) {
    status = 'stale'
    statusText = 'Recent'
    variant = 'secondary'
  } else if (diffInMinutes < 1440) { // 24 hours
    status = 'old'
    statusText = 'Outdated'
    variant = 'outline'
  } else {
    status = 'very-old'
    statusText = 'Stale'
    variant = 'destructive'
  }

  const timeAgo = formatDistanceToNow(updatedDate, { addSuffix: true })

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Badge variant={variant} className="text-xs">
          {status === 'fresh' && <CheckCircle className="w-3 h-3 mr-1" />}
          {status === 'stale' && <Clock className="w-3 h-3 mr-1" />}
          {(status === 'old' || status === 'very-old') && <AlertTriangle className="w-3 h-3 mr-1" />}
          {statusText}
        </Badge>
        {showRefreshButton && onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-2">
        <Badge variant={variant} className="flex items-center gap-1">
          {status === 'fresh' && <CheckCircle className="w-3 h-3" />}
          {status === 'stale' && <Clock className="w-3 h-3" />}
          {(status === 'old' || status === 'very-old') && <AlertTriangle className="w-3 h-3" />}
          {statusText}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Updated {timeAgo}
        </span>
      </div>

      {showRefreshButton && onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      )}
    </div>
  )
}

// Hook for managing data freshness
export function useDataFreshness(
  initialLastUpdated?: string | Date,
  staleTimeMinutes = 60
) {
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(
    initialLastUpdated ? new Date(initialLastUpdated) : null
  )
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const updateLastUpdated = React.useCallback((date?: string | Date) => {
    setLastUpdated(date ? new Date(date) : new Date())
  }, [])

  const refresh = React.useCallback(async (refreshFn?: () => Promise<void>) => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      if (refreshFn) {
        await refreshFn()
      }
      updateLastUpdated()
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, updateLastUpdated])

  const isStale = React.useMemo(() => {
    if (!lastUpdated) return true

    const now = new Date()
    const diffInMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60)
    return diffInMinutes > staleTimeMinutes
  }, [lastUpdated, staleTimeMinutes])

  return {
    lastUpdated,
    isRefreshing,
    isStale,
    updateLastUpdated,
    refresh,
  }
}

// Context for global data freshness management
interface DataFreshnessContextType {
  registerDataSource: (key: string, lastUpdated?: string | Date) => void
  updateDataSource: (key: string, lastUpdated: string | Date) => void
  getDataSource: (key: string) => { lastUpdated: Date | null; isStale: boolean } | null
  refreshDataSource: (key: string) => Promise<void>
}

const DataFreshnessContext = React.createContext<DataFreshnessContextType | null>(null)

export function DataFreshnessProvider({ children }: { children: React.ReactNode }) {
  const [dataSources, setDataSources] = React.useState<Record<string, Date | null>>({})

  const registerDataSource = React.useCallback((key: string, lastUpdated?: string | Date) => {
    setDataSources(prev => ({
      ...prev,
      [key]: lastUpdated ? new Date(lastUpdated) : null
    }))
  }, [])

  const updateDataSource = React.useCallback((key: string, lastUpdated: string | Date) => {
    setDataSources(prev => ({
      ...prev,
      [key]: new Date(lastUpdated)
    }))
  }, [])

  const getDataSource = React.useCallback((key: string) => {
    const lastUpdated = dataSources[key] || null
    const isStale = lastUpdated ? (Date.now() - lastUpdated.getTime()) > (60 * 60 * 1000) : true

    return { lastUpdated, isStale }
  }, [dataSources])

  const refreshDataSource = React.useCallback(async (key: string) => {
    // This would typically trigger a data refresh
    // For now, just update the timestamp
    updateDataSource(key, new Date())
  }, [updateDataSource])

  const value = React.useMemo(() => ({
    registerDataSource,
    updateDataSource,
    getDataSource,
    refreshDataSource,
  }), [registerDataSource, updateDataSource, getDataSource, refreshDataSource])

  return (
    <DataFreshnessContext.Provider value={value}>
      {children}
    </DataFreshnessContext.Provider>
  )
}

export function useDataFreshnessContext() {
  const context = React.useContext(DataFreshnessContext)
  if (!context) {
    throw new Error('useDataFreshnessContext must be used within a DataFreshnessProvider')
  }
  return context
}
