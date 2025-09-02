"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  const pathname = usePathname()

  const nav = [
    { href: "/", label: "Home" },
    { href: "/compare", label: "Compare" },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Logo />
        <nav className="mx-6 hidden gap-4 md:flex" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative text-sm transition-colors hover:text-foreground/90",
                pathname === item.href ? "text-foreground" : "text-foreground/60",
              )}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <span className="px-1">
                {item.label}
                <span
                  className={cn(
                    "absolute left-1 right-1 -bottom-1 h-px origin-center scale-x-0 bg-foreground/30 transition-transform",
                    pathname === item.href && "scale-x-100 bg-foreground/70"
                  )}
                />
              </span>
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="About this demo">Demo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>About this Demo</DialogTitle>
                <DialogDescription>
                  A sampler of Energy IC Copilot — explore KPIs, comparisons, and valuation without any backend.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <Badge variant="secondary">Zero‑setup</Badge>
                  <p className="mt-1 text-muted-foreground">Runs on built‑in API routes under <code>/api/demo/*</code>.</p>
                </div>
                <div>
                  <Badge variant="secondary">Shareable</Badge>
                  <p className="mt-1 text-muted-foreground">Save compare sets, import/export JSON, and share deep links.</p>
                </div>
                <div>
                  <Badge variant="secondary">Tech</Badge>
                  <p className="mt-1 text-muted-foreground">Next.js 14 App Router, Radix UI, Recharts, Tailwind.</p>
                </div>
                <div className="pt-1">
                  <Link href="/compare?sel=ENB,TRP,PPL&type=valuation&metric=EBITDA">
                    <Button size="sm" className="mr-2">Load Sample Compare</Button>
                  </Link>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <a href={process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/'} target="_blank" rel="noreferrer" className="underline">View Source</a>
                  <button
                    className="text-sm underline"
                    onClick={() => {
                      try {
                        const keys = ['home-favorites','compare-saved-sets','home-sort','compare-sort','demo-tour-shown','energy-ic-theme']
                        keys.forEach(k => localStorage.removeItem(k))
                        sessionStorage.clear()
                        location.reload()
                      } catch {}
                    }}
                  >Reset Demo</button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Link href="/compare" className="hidden sm:block">
            <Button variant="outline" size="sm">Start Comparing</Button>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
