import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

interface LoadingSpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  }

  return (
    <div className={cn("animate-spin rounded-full border-2 border-muted border-t-primary", sizeClasses[size], className)} />
  )
}

interface LoadingCardProps {
  title?: string
  description?: string
  className?: string
}

export function LoadingCard({ title = "Loading...", description, className }: LoadingCardProps) {
  return (
    <div className={cn("p-6 border rounded-lg bg-muted/50", className)}>
      <div className="flex items-center space-x-4">
        <LoadingSpinner />
        <div>
          <h3 className="font-medium">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface LoadingSkeletonProps {
  className?: string
  lines?: number
}

export function LoadingSkeleton({ className, lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-muted rounded animate-pulse"
          style={{
            width: `${Math.random() * 40 + 60}%`,
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  )
}

interface LoadingChartProps {
  className?: string
  height?: string
}

export function LoadingChart({ className, height = "h-80" }: LoadingChartProps) {
  return (
    <div className={cn("w-full bg-muted/50 rounded-lg flex items-center justify-center", height, className)}>
      <div className="text-center">
        <LoadingSpinner className="mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Loading chart data...</p>
      </div>
    </div>
  )
}

// Enhanced skeleton components for consistent loading states
interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  )
}

// KPI Card Skeleton
export function KPICardSkeleton() {
  return (
    <div className="p-5 border rounded-xl bg-gradient-to-br from-background to-muted/5">
      <div className="flex justify-between items-start mb-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  )
}

// Company Card Skeleton
export function CompanyCardSkeleton() {
  return (
    <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-4 w-20 mb-4" />
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

// Valuation Section Skeleton
export function ValuationSkeleton() {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-lg">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="p-3 bg-muted/50 rounded-lg">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Skeleton className="h-3 w-12 mb-1" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>
    </div>
  )
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center space-x-4 py-3 border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? 'w-24' : 'w-16'}`} />
      ))}
    </div>
  )
}

// Progress overlay for long-running operations
interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
  progress?: number
}

export function LoadingOverlay({ isVisible, message = "Loading...", progress }: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-background border rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
        <div className="text-center">
          <LoadingSpinner className="mx-auto mb-4" size="lg" />
          <p className="text-sm font-medium mb-2">{message}</p>
          {progress !== undefined && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground">{progress}% complete</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
