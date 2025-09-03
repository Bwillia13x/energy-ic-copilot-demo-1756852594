'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Lightbulb,
  Target,
  TrendingUp,
  FileText,
  BarChart3,
  GitCompare,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TourStep {
  id: string
  title: string
  description: string
  content?: React.ReactNode
  target?: string // CSS selector for the element to highlight
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  required?: boolean
  actionLabel?: string
}

interface TourContextType {
  currentStep: number
  steps: TourStep[]
  isActive: boolean
  isCompleted: boolean
  startTour: (tourId?: string) => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  completeTour: () => void
  goToStep: (stepIndex: number) => void
}

const TourContext = createContext<TourContextType | null>(null)

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour must be used within a TourProvider')
  }
  return context
}

// Predefined tour configurations
const tours = {
  homepage: [
    {
      id: 'welcome',
      title: 'Welcome to Energy IC Copilot',
      description: 'Your AI-powered financial analysis platform for energy infrastructure companies.',
      placement: 'center' as const,
      required: true,
    },
    {
      id: 'search-filter',
      title: 'Search & Filter Companies',
      description: 'Use the search bar to find companies by name or ticker. Filter by sector and country to narrow down your selection.',
      target: '[data-tour="search-section"]',
      placement: 'bottom' as const,
      actionLabel: 'Try searching for "Pembina"',
    },
    {
      id: 'company-selection',
      title: 'Select Companies',
      description: 'Click the star to favorite companies or use the Select button to add them to your comparison list.',
      target: '[data-tour="company-card"]',
      placement: 'top' as const,
      actionLabel: 'Try selecting a company',
    },
    {
      id: 'comparison',
      title: 'Compare Multiple Companies',
      description: 'Once you have selected companies, use the Compare button to analyze them side-by-side.',
      target: '[data-tour="compare-button"]',
      placement: 'top' as const,
      actionLabel: 'Start comparing companies',
    },
  ],
  company: [
    {
      id: 'company-overview',
      title: 'Company Overview',
      description: 'View key company information, sector, and currency details.',
      target: '[data-tour="company-header"]',
      placement: 'bottom' as const,
    },
    {
      id: 'kpis',
      title: 'Key Performance Indicators',
      description: 'Review extracted financial metrics with document citations and source references.',
      target: '[data-tour="kpi-section"]',
      placement: 'top' as const,
    },
    {
      id: 'valuation',
      title: 'Valuation Analysis',
      description: 'Adjust valuation parameters and view Enterprise Present Value (EPV) and DCF calculations.',
      target: '[data-tour="valuation-section"]',
      placement: 'top' as const,
    },
    {
      id: 'scenario-analysis',
      title: 'Scenario Analysis',
      description: 'Test different assumptions and see how they impact valuation outcomes.',
      target: '[data-tour="scenario-presets"]',
      placement: 'left' as const,
    },
  ],
  comparison: [
    {
      id: 'comparison-intro',
      title: 'Company Comparison',
      description: 'Compare multiple companies side-by-side with interactive charts and analysis.',
      placement: 'center' as const,
    },
    {
      id: 'comparison-controls',
      title: 'Comparison Controls',
      description: 'Add or remove companies from your comparison and save comparison sets.',
      target: '[data-tour="comparison-controls"]',
      placement: 'bottom' as const,
    },
    {
      id: 'comparison-charts',
      title: 'Interactive Charts',
      description: 'View comparative analysis with interactive charts and detailed breakdowns.',
      target: '[data-tour="comparison-charts"]',
      placement: 'top' as const,
    },
  ],
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [currentTour, setCurrentTour] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [completedTours, setCompletedTours] = useState<Set<string>>(new Set())

  // Load completed tours from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tour-completed')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCompletedTours(new Set(parsed))
      } catch (e) {
        console.warn('Failed to parse completed tours:', e)
      }
    }
  }, [])

  // Save completed tours to localStorage
  useEffect(() => {
    localStorage.setItem('tour-completed', JSON.stringify(Array.from(completedTours)))
  }, [completedTours])

  const steps = currentTour ? tours[currentTour as keyof typeof tours] || [] : []

  const startTour = (tourId: string = 'homepage') => {
    if (tours[tourId as keyof typeof tours]) {
      setCurrentTour(tourId)
      setCurrentStep(0)
      setIsActive(true)
    }
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeTour()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipTour = () => {
    setIsActive(false)
    setCurrentTour(null)
    setCurrentStep(0)
  }

  const completeTour = () => {
    if (currentTour) {
      setCompletedTours(prev => new Set(Array.from(prev).concat(currentTour)))
    }
    setIsActive(false)
    setCurrentTour(null)
    setCurrentStep(0)
  }

  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex)
    }
  }

  const isCompleted = currentTour ? completedTours.has(currentTour) : false

  const value: TourContextType = {
    currentStep,
    steps,
    isActive,
    isCompleted,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    goToStep,
  }

  return (
    <TourContext.Provider value={value}>
      {children}
      {isActive && <TourOverlay />}
    </TourContext.Provider>
  )
}

function TourOverlay() {
  const { currentStep, steps, nextStep, prevStep, skipTour, completeTour } = useTour()
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const step = steps[currentStep]

  useEffect(() => {
    if (!step?.target) return

    const updatePosition = () => {
      const element = document.querySelector(step.target!)
      if (element) {
        const rect = element.getBoundingClientRect()
        setPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [step?.target])

  if (!step) return null

  const isCenterPlacement = step.placement === 'center'

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      {/* Highlight overlay */}
      {!isCenterPlacement && (
        <div
          className="absolute border-2 border-primary rounded-lg bg-primary/10 animate-pulse"
          style={{
            top: position.top - 4,
            left: position.left - 4,
            width: position.width + 8,
            height: position.height + 8,
          }}
        />
      )}

      {/* Tour card */}
      <div
        className={cn(
          "absolute bg-background border rounded-lg shadow-lg max-w-sm",
          isCenterPlacement && "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
          !isCenterPlacement && step.placement === 'top' && "bottom-full mb-2 left-1/2 transform -translate-x-1/2",
          !isCenterPlacement && step.placement === 'bottom' && "top-full mt-2 left-1/2 transform -translate-x-1/2",
          !isCenterPlacement && step.placement === 'left' && "right-full mr-2 top-1/2 transform -translate-y-1/2",
          !isCenterPlacement && step.placement === 'right' && "left-full ml-2 top-1/2 transform -translate-y-1/2"
        )}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {currentStep + 1} / {steps.length}
                </Badge>
                <Lightbulb className="w-4 h-4 text-primary" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardTitle className="text-lg">{step.title}</CardTitle>
            <CardDescription>{step.description}</CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            {step.content && (
              <div className="mb-4 p-3 bg-muted/50 rounded-md">
                {step.content}
              </div>
            )}

            {step.actionLabel && (
              <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-md">
                <p className="text-sm font-medium text-primary mb-1">💡 Try this:</p>
                <p className="text-sm">{step.actionLabel}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextStep}
                  disabled={currentStep === steps.length - 1}
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Complete
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>

              <Button variant="ghost" size="sm" onClick={skipTour}>
                Skip Tour
              </Button>
            </div>

            {/* Progress indicators */}
            <div className="mt-4 flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    index === currentStep
                      ? "bg-primary flex-1"
                      : index < currentStep
                      ? "bg-primary/50 flex-1"
                      : "bg-muted flex-1"
                  )}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Tour trigger button component
interface TourTriggerProps {
  tourId?: string
  children?: React.ReactNode
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export function TourTrigger({
  tourId = 'homepage',
  children,
  className,
  variant = 'outline',
  size = 'sm'
}: TourTriggerProps) {
  const { startTour, isCompleted } = useTour()

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => startTour(tourId)}
      className={cn("flex items-center gap-2", className)}
    >
      <Play className="w-4 h-4" />
      {children || (isCompleted ? 'Restart Tour' : 'Take Tour')}
    </Button>
  )
}

// Contextual empty state component
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
  className?: string
  tourId?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  tourId
}: EmptyStateProps) {
  const { startTour } = useTour()

  return (
    <div className={cn("text-center py-12", className)}>
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        {icon || <Target className="w-8 h-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        {action}
        {tourId && (
          <TourTrigger tourId={tourId} variant="ghost">
            Take a quick tour
          </TourTrigger>
        )}
      </div>
    </div>
  )
}

// Specific empty states for different contexts
export function CompaniesEmptyState() {
  return (
    <EmptyState
      icon={<TrendingUp className="w-8 h-8" />}
      title="No companies found"
      description="Try adjusting your search terms or filters to find the energy infrastructure companies you're looking for."
      action={
        <Button onClick={() => {
          // Clear filters logic would go here
          window.location.href = '/'
        }}>
          Clear Filters
        </Button>
      }
      tourId="homepage"
    />
  )
}

export function KPIsEmptyState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<FileText className="w-8 h-8" />}
      title="No KPIs available"
      description="We couldn't extract any key performance indicators from the available documents. This might be due to missing filings or processing errors."
      action={
        onRetry && (
          <Button onClick={onRetry} variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Retry Extraction
          </Button>
        )
      }
    />
  )
}

export function ValuationEmptyState() {
  return (
    <EmptyState
      icon={<BarChart3 className="w-8 h-8" />}
      title="Valuation data unavailable"
      description="Unable to calculate valuation at this time. Please check your connection and try again, or contact support if the issue persists."
      action={
        <Button onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      }
    />
  )
}

export function ComparisonEmptyState() {
  return (
    <EmptyState
      icon={<GitCompare className="w-8 h-8" />}
      title="No companies selected"
      description="Select companies from the homepage to compare them side-by-side with interactive charts and detailed analysis."
      action={
        <Button onClick={() => window.location.href = '/'}>
          <GitCompare className="w-4 h-4 mr-2" />
          Select Companies
        </Button>
      }
      tourId="comparison"
    />
  )
}
