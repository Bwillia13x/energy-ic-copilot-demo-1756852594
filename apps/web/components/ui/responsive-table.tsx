"use client"

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

interface ResponsiveTableProps {
  children: React.ReactNode
  className?: string
  stickyHeader?: boolean
  maxHeight?: string
  compact?: boolean
}

export function ResponsiveTable({
  children,
  className,
  stickyHeader = false,
  maxHeight,
  compact = false
}: ResponsiveTableProps) {
  return (
    <div
      className={cn(
        "w-full overflow-auto border rounded-md",
        maxHeight && `max-h-${maxHeight}`,
        className
      )}
    >
      <table
        className={cn(
          "w-full caption-bottom text-sm",
          stickyHeader && "relative",
          compact && "text-xs"
        )}
      >
        {children}
      </table>
    </div>
  )
}

interface ResponsiveTableHeaderProps {
  children: React.ReactNode
  className?: string
  sticky?: boolean
}

export function ResponsiveTableHeader({
  children,
  className,
  sticky = false
}: ResponsiveTableHeaderProps) {
  return (
    <thead className={cn(sticky && "sticky top-0 bg-background z-10 border-b")}>
      <tr className={cn("border-b transition-colors hover:bg-muted/50", className)}>
        {children}
      </tr>
    </thead>
  )
}

interface ResponsiveTableHeadProps {
  children: React.ReactNode
  className?: string
  hideOnMobile?: boolean
  priority?: number // Lower numbers hide first on mobile
}

export function ResponsiveTableHead({
  children,
  className,
  hideOnMobile = false,
  priority = 0
}: ResponsiveTableHeadProps) {
  return (
    <th
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground",
        hideOnMobile && "hidden md:table-cell",
        className
      )}
      data-priority={priority}
    >
      {children}
    </th>
  )
}

interface ResponsiveTableBodyProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveTableBody({ children, className }: ResponsiveTableBodyProps) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)}>
      {children}
    </tbody>
  )
}

interface ResponsiveTableRowProps {
  children: React.ReactNode
  className?: string
  expandable?: boolean
  expandedContent?: React.ReactNode
}

export function ResponsiveTableRow({
  children,
  className,
  expandable = false,
  expandedContent
}: ResponsiveTableRowProps) {
  const [expanded, setExpanded] = useState(false)

  if (expandable && expandedContent) {
    return (
      <>
        <tr
          className={cn(
            "border-b transition-colors hover:bg-muted/50 cursor-pointer",
            className
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <td className="p-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </td>
          {children}
        </tr>
        {expanded && (
          <tr>
            <td colSpan={React.Children.count(children) + 1} className="bg-muted/30">
              <div className="p-4">
                {expandedContent}
              </div>
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    <tr className={cn("border-b transition-colors hover:bg-muted/50", className)}>
      {children}
    </tr>
  )
}

interface ResponsiveTableCellProps {
  children: React.ReactNode
  className?: string
  hideOnMobile?: boolean
  label?: string // For mobile card view
}

export function ResponsiveTableCell({
  children,
  className,
  hideOnMobile = false,
  label
}: ResponsiveTableCellProps) {
  return (
    <td
      className={cn(
        "p-4 align-middle",
        hideOnMobile && "hidden md:table-cell",
        className
      )}
      data-label={label}
    >
      {children}
    </td>
  )
}

// Mobile-optimized card view for table rows
interface TableCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function TableCard({ title, subtitle, children, actions, className }: TableCardProps) {
  return (
    <div className={cn("border rounded-lg p-4 space-y-3 md:hidden", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

// Table actions dropdown for mobile
interface TableActionsProps {
  children: React.ReactNode
  className?: string
}

export function TableActions({ children, className }: TableActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("md:hidden", className)}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TableActionsItem({
  children,
  onClick,
  className
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <DropdownMenuItem onClick={onClick} className={className}>
      {children}
    </DropdownMenuItem>
  )
}

// Utility hook for responsive table behavior
export function useResponsiveTable() {
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const isMobile = containerWidth < 768
  const isTablet = containerWidth >= 768 && containerWidth < 1024
  const isDesktop = containerWidth >= 1024

  return {
    containerRef,
    containerWidth,
    isMobile,
    isTablet,
    isDesktop,
  }
}

// Column visibility utilities
export function useColumnVisibility(defaultVisible: Record<string, boolean> = {}) {
  const [visibleColumns, setVisibleColumns] = useState(defaultVisible)

  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }))
  }

  const showColumn = (columnId: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: true
    }))
  }

  const hideColumn = (columnId: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: false
    }))
  }

  return {
    visibleColumns,
    toggleColumn,
    showColumn,
    hideColumn,
    setVisibleColumns,
  }
}

// Export all components
export {
  ResponsiveTable as Table,
  ResponsiveTableHeader as TableHeader,
  ResponsiveTableBody as TableBody,
  ResponsiveTableRow as TableRow,
  ResponsiveTableHead as TableHead,
  ResponsiveTableCell as TableCell,
}
