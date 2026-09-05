import type { Collection } from './types'

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized')
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { credentials: 'same-origin', ...init })
  if (response.status === 401) throw new UnauthorizedError()
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload
}

export async function checkSession(): Promise<boolean> {
  const result = (await request('/api/session')) as { authenticated: boolean }
  return result.authenticated
}

export async function login(password: string): Promise<void> {
  const response = await fetch('/api/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Login failed.')
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
}

export async function loadDoc<T>(collection: Collection): Promise<T | null> {
  const result = (await request(`/api/data/${collection}`)) as { data: T | null }
  return result.data
}

export async function saveDoc<T>(collection: Collection, data: T): Promise<void> {
  await request(`/api/data/${collection}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}
