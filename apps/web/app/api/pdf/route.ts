import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }

  try {
    // Launch browser
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()

    // Set viewport for PDF generation
    await page.setViewport({ width: 1200, height: 800 })

    // Navigate to the memo page
    await page.goto(url, { waitUntil: 'networkidle0' })

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in',
      },
    })

    await browser.close()

    // Return PDF
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="ic-memo.pdf"',
      },
    })

  } catch (error) {
    console.error('PDF generation error:', error)

    return NextResponse.json({
      error: 'Failed to generate PDF',
      message: 'PDF generation is not available in this environment. Please use "Print to PDF" in your browser.',
      fallback: 'print'
    }, { status: 500 })
  }
}
