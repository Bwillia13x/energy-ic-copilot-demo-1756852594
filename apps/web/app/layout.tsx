// Dynamic rendering configured via next.config.js

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ClientLayout } from './client-layout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Energy IC Copilot',
  description: 'AI-powered analysis and valuation for energy infrastructure companies',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Energy IC Copilot — Demo',
    description: 'Explore KPIs, comparisons and valuation in demo mode',
    url: '/',
    siteName: 'Energy IC Copilot',
    images: [
      {
        url: '/og.svg',
        width: 1200,
        height: 630,
        alt: 'Energy IC Copilot'
      }
    ],
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Energy IC Copilot — Demo',
    description: 'Explore KPIs, comparisons and valuation in demo mode',
    images: ['/og.svg']
  },
  robots: process.env.NEXT_PUBLIC_DEMO === '1' ? { index: false, follow: false } : undefined,
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
