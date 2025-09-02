'use client'

import React from 'react'
import { Loader2, FileText } from 'lucide-react'
import { useLoading } from '@/lib/loading-context'

export function LoadingOverlay() {
  const { loadingState } = useLoading()

  if (!loadingState.isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Animated loading icon */}
          <div className="relative">
            <div className="w-12 h-12 border-4 border-muted rounded-full animate-spin border-t-primary"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              {loadingState.message.includes('PDF') || loadingState.message.includes('memo') ? (
                <FileText className="w-6 h-6 text-primary" />
              ) : (
                <Loader2 className="w-6 h-6 text-primary" />
              )}
            </div>
          </div>

          {/* Loading message */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Processing...</h3>
            <p className="text-sm text-muted-foreground">
              {loadingState.message}
            </p>
          </div>

          {/* Progress bar (if progress is provided) */}
          {loadingState.progress !== undefined && (
            <div className="w-full space-y-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, loadingState.progress))}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round(loadingState.progress)}% complete
              </p>
            </div>
          )}

          {/* Additional context for long operations */}
          {(loadingState.message.includes('PDF') || loadingState.message.includes('memo')) && (
            <p className="text-xs text-muted-foreground">
              This may take a few moments...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
