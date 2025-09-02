#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/local/bin/chromium',
    '/opt/homebrew/bin/chromium',
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {}
  }
  return null
}

async function run() {
  const base = process.env.BASE_URL || 'http://localhost:3000'
  const executablePath = findChrome()
  if (!executablePath) {
    console.error('✖ Could not locate a Chrome/Chromium executable on this system.')
    process.exit(2)
  }
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
  })
  const page = await browser.newPage()

  const results = { home: null, compare: null, company: null }

  try {
    // Home page
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    // wait for any company cards to render
    await page.waitForSelector('a[href^="/company/"]', { timeout: 30000 })
    const links = await page.$$eval('a[href^="/company/"]', els => els.map(e => e.getAttribute('href')))
    results.home = { ok: true, companyLinks: links.slice(0, 6) }

    // Company page (first link)
    const first = links.find(Boolean)
    if (!first) throw new Error('No company links found on home page')
    await page.goto(base + first, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('h1#company-header', { timeout: 30000 })
    // Either KPI list items or loading fallback disappears
    await page.waitForSelector('article[role="listitem"]', { timeout: 30000 }).catch(() => {})
    const title = await page.$eval('#company-header', el => el.textContent?.trim())
    results.company = { ok: true, title }

    // Compare page
    await page.goto(base + '/compare', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('h1', { timeout: 30000 })
    // Wait for Radix checkbox roots to appear (role=checkbox)
    await page.waitForSelector('[role="checkbox"][id]', { timeout: 30000 }).catch(() => {})
    const boxes = await page.$$('[role="checkbox"][id]')
    let chartShown = false
    if (boxes.length >= 2) {
      await boxes[0].click()
      await boxes[1].click()
      // Wait for chart svg to appear
      await page.waitForSelector('svg', { timeout: 30000 }).catch(() => {})
      chartShown = await page.$$eval('svg', els => els.length > 0)
    }
    results.compare = { ok: true, checkboxes: boxes.length, chart: chartShown }

    console.log(JSON.stringify({ ok: true, results }, null, 2))
    await browser.close()
    process.exit(0)
  } catch (err) {
    console.error('✖ Spot check failed:', err?.message || err)
    try { await browser.close() } catch {}
    console.log(JSON.stringify({ ok: false, results }, null, 2))
    process.exit(1)
  }
}

run()
