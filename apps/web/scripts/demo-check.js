/* Minimal demo smoke check: requires dev server on :3000 */
async function main() {
  const base = process.env.DEMO_BASE || 'http://localhost:3000'
  const endpoints = [
    '/',
    '/api/demo/companies',
    '/api/demo/kpis/ENB',
  ]
  for (const p of endpoints) {
    const url = base + p
    const res = await fetch(url, { method: 'GET' }).catch(() => null)
    if (!res || !res.ok) {
      console.error('FAIL', url, res && res.status)
      process.exitCode = 1
    } else {
      console.log('OK  ', url, res.status)
    }
  }
}
main()
