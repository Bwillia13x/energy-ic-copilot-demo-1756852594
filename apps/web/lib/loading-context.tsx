'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'

interface LoadingState {
  isLoading: boolean
  message: string
  progress?: number
}

interface LoadingContextType {
  loadingState: LoadingState
  startLoading: (message: string, progress?: number) => void
  updateProgress: (progress: number) => void
  stopLoading: () => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: '',
    progress: undefined,
  })

  const startLoading = (message: string, progress?: number) => {
    setLoadingState({
      isLoading: true,
      message,
      progress,
    })
  }

  const updateProgress = (progress: number) => {
    setLoadingState(prev => ({
      ...prev,
      progress,
    }))
  }

  const stopLoading = () => {
    setLoadingState({
      isLoading: false,
      message: '',
      progress: undefined,
    })
  }

  return (
    <LoadingContext.Provider value={{ loadingState, startLoading, updateProgress, stopLoading }}>
      {children}
      <LoadingOverlay />
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}
