"use client"

import Link from "next/link"
import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  withText?: boolean
}

export function Logo({ className, withText = true }: LogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)} aria-label="Go to homepage">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary shadow-[inset_0_-1px_0_rgba(0,0,0,0.04)]">
        <Zap className="h-5 w-5" aria-hidden="true" />
      </span>
      {withText && (
        <span className="font-semibold tracking-tight">Energy IC Copilot</span>
      )}
    </Link>
  )
}
