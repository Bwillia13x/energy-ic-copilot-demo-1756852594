"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { netActivity } from '@/lib/http'

export function TopProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<number | null>(null)
  const delayRef = useRef<number | null>(null)

  const clearTimers = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (delayRef.current) {
      window.clearTimeout(delayRef.current)
      delayRef.current = null
    }
  }

  const kick = (target = 70, minDelay = 120) => {
    clearTimers()
    // avoid flicker: delay showing if it completes super fast
    delayRef.current = window.setTimeout(() => {
      setActive(true)
      setProgress(10)
      timerRef.current = window.setTimeout(() => setProgress(target), 100)
    }, minDelay) as unknown as number
  }

  const finish = () => {
    clearTimers()
    setProgress(100)
    // allow bar to reach 100% then hide
    timerRef.current = window.setTimeout(() => {
      setActive(false)
      setProgress(0)
    }, 250) as unknown as number
  }

  // Route change cue
  useEffect(() => {
    kick(80, 80)
    // finish shortly after path updates (hydration complete)
    const id = window.setTimeout(finish, 400)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Network activity cue
  useEffect(() => {
    const off = netActivity.on((count) => {
      if (count > 0) {
        kick(70, 120)
      } else {
        finish()
      }
    })
    return off
  }, [])

  if (!active) return null

  return (
    <div className="fixed left-0 right-0 top-0 z-[60]">
      <div
        className="h-0.5 bg-gradient-to-r from-primary via-primary/70 to-primary/40 transition-all duration-200"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

