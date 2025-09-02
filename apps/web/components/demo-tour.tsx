"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const steps = [
  {
    id: 1,
    title: "Search & Filter",
    body: "Use the search bar and sector/country filters to narrow the list.",
  },
  {
    id: 2,
    title: "Select Companies",
    body: "Click Select on cards to build a comparison set. Save or share via link.",
  },
  {
    id: 3,
    title: "Compare & Export",
    body: "Open Compare to see charts/tables. Export CSV or saved sets.",
  },
]

export function DemoTour() {
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    // show once per session
    if (sessionStorage.getItem("demo-tour-shown") !== "1") {
      setOpen(true)
      sessionStorage.setItem("demo-tour-shown", "1")
    }
  }, [])

  if (!open) return null
  const step = steps[idx]

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-md rounded-lg border bg-background p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold">{step.title}</h3>
          <button className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>Skip</button>
        </div>
        <p className="text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
          {idx < steps.length - 1 ? (
            <Button size="sm" onClick={() => setIdx((i) => i + 1)}>Next</Button>
          ) : (
            <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
          )}
        </div>
      </div>
    </div>
  )
}

