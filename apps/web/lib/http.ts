export class HttpError extends Error {
  status?: number
  url?: string
  method?: string
  constructor(message: string, status?: number, url?: string, method?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.url = url
    this.method = method
  }
}

// Enhanced HTTP client with better typing and error handling
export interface HttpClientConfig {
  baseURL?: string
  timeout?: number
  retries?: number
  backoffMs?: number
  headers?: Record<string, string>
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  params?: Record<string, string | number | boolean>
  timeout?: number
  retries?: number
}

export class HttpClient {
  private config: HttpClientConfig

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      baseURL: process.env.NEXT_PUBLIC_API_URL || '',
      timeout: 8000,
      retries: 2,
      backoffMs: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    }
  }

  private buildURL(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const baseURL = this.config.baseURL || ''
    let url = endpoint.startsWith('http') ? endpoint : `${baseURL}${endpoint}`

    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value))
        }
      })
      const paramString = searchParams.toString()
      if (paramString) {
        url += `?${paramString}`
      }
    }

    return url
  }

  private async request<T = unknown>(
    method: string,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      body,
      params,
      timeout = this.config.timeout,
      retries = this.config.retries,
      headers = {},
      ...rest
    } = options

    const url = this.buildURL(endpoint, params)

    // Track network activity
    netActivity.inc()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    let attempt = 0
    let lastError: Error = new Error('Unknown error')

    while (attempt <= retries!) {
      try {
        const response = await fetch(url, {
          method,
          signal: controller.signal,
          headers: {
            ...this.config.headers,
            ...headers,
          },
          body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
          ...rest,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          throw new HttpError(
            `HTTP ${response.status}: ${errorText}`,
            response.status,
            url,
            method
          )
        }

        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          return await response.json()
        } else {
          return (await response.text()) as T
        }

      } catch (error: unknown) {
        clearTimeout(timeoutId)
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on 4xx errors (except 408, 429)
        if (
          lastError instanceof HttpError &&
          lastError.status &&
          lastError.status >= 400 &&
          lastError.status < 500 &&
          lastError.status !== 408 &&
          lastError.status !== 429
        ) {
          break
        }

        // Don't retry on abort
        if (lastError.name === 'AbortError') {
          throw new HttpError('Request timed out', 408, url, method)
        }

        if (attempt === retries!) break

        // Exponential backoff with jitter
        const jitter = Math.random() * 0.3 + 0.85
        const delay = Math.round(this.config.backoffMs! * Math.pow(2, attempt) * jitter)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      attempt++
    }

    netActivity.dec()
    throw lastError
  }

  async get<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', endpoint, options)
  }

  async post<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', endpoint, options)
  }

  async put<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', endpoint, options)
  }

  async patch<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', endpoint, options)
  }

  async delete<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', endpoint, options)
  }
}

// Global HTTP client instance
export const httpClient = new HttpClient()

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
    toast({
      title: 'Request failed',
      description: message,
      variant: 'destructive' as const
    })
  } catch {
    // noop if toast not available in this environment
  }
}

export async function fetchJsonWithTimeout<T = unknown>(
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
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError'
    const httpErr = isAbort ? new HttpError('Request timed out', 408) : (err instanceof Error ? err : new Error(String(err)))
    // Don't await to avoid blocking the error throw
    notifyErrorOnce(isAbort ? 'Request timed out' : (httpErr.message || 'Network error'))
    throw httpErr
  } finally {
    clearTimeout(id)
    netActivity.dec()
  }
}

export async function fetchJsonWithRetry<T = unknown>(
  url: string,
  options: RequestInit = {},
  opts: { timeoutMs?: number; retries?: number; backoffMs?: number } = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 8000
  const retries = opts.retries ?? 2
  const backoffMs = opts.backoffMs ?? 500

  let attempt = 0
  let lastErr: Error = new Error('Unknown error')

  while (attempt <= retries) {
    try {
      return await fetchJsonWithTimeout<T>(url, options, timeoutMs)
    } catch (err: unknown) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      // Do not retry on 4xx (except 408 timeout) to avoid spamming server
      if (lastErr instanceof HttpError && lastErr.status && lastErr.status >= 400 && lastErr.status < 500 && lastErr.status !== 408) {
        throw lastErr
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
