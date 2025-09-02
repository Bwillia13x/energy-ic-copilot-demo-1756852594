"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"

interface ChartProps {
  className?: string
  children: React.ReactElement
}

const Chart = React.forwardRef<HTMLDivElement, ChartProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("w-full h-full min-h-[200px]", className)}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%" minHeight={200}>
        {React.cloneElement(children, {
          width: "100%",
          height: "100%"
        })}
      </ResponsiveContainer>
    </div>
  )
)
Chart.displayName = "Chart"

const ChartTooltip = Tooltip

export {
  Chart,
  ChartTooltip,
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
}
