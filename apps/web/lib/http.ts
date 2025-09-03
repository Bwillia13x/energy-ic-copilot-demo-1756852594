export class HttpError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

// Simple global network activity tracker for UI progress bars
export const netActivity = {
  count: 0,
  listeners: new Set<(count: number) => void>(),
  inc() {
    this.count += 1
    this.emit()
  },
  dec() {
    this.count = Math.max(0, this.count - 1)
    this.emit()
  },
  on(fn: (count: number) => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  },
  emit() {
    this.listeners.forEach((fn) => fn(this.count))
  }
}

let lastToastAt = 0
async function notifyErrorOnce(message: string) {
  const now = Date.now()
  if (now - lastToastAt < 4000) return
  lastToastAt = now

  // Only show toast on client side
  if (typeof window === 'undefined') return

  try {
    const { toast } = await import('@/hooks/use-toast')
    toast({ title: 'Request failed', description: message, variant: 'destructive' as any })
  } catch {
    // noop if toast not available in this environment
  }
}

export async function fetchJsonWithTimeout<T = any>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<T> {
  netActivity.inc()
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) {
      throw new HttpError(`Request failed: ${res.status}`, res.status)
    }
    return (await res.json()) as T
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError'
    const httpErr = isAbort ? new HttpError('Request timed out', 408) : err
    // Don't await to avoid blocking the error throw
    notifyErrorOnce(isAbort ? 'Request timed out' : (httpErr?.message || 'Network error'))
    throw httpErr
  } finally {
    clearTimeout(id)
    netActivity.dec()
  }
}

export async function fetchJsonWithRetry<T = any>(
  url: string,
  options: RequestInit = {},
  opts: { timeoutMs?: number; retries?: number; backoffMs?: number } = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 8000
  const retries = opts.retries ?? 2
  const backoffMs = opts.backoffMs ?? 500

  let attempt = 0
  let lastErr: any

  while (attempt <= retries) {
    try {
      return await fetchJsonWithTimeout<T>(url, options, timeoutMs)
    } catch (err: any) {
      lastErr = err
      // Do not retry on 4xx (except 408 timeout) to avoid spamming server
      if (err instanceof HttpError && err.status && err.status >= 400 && err.status < 500 && err.status !== 408) {
        throw err
      }
      if (attempt === retries) break
      const jitter = Math.random() * 0.3 + 0.85
      const delay = Math.round(backoffMs * Math.pow(2, attempt) * jitter)
      await new Promise((r) => setTimeout(r, delay))
    }
    attempt += 1
  }

  throw lastErr
}
