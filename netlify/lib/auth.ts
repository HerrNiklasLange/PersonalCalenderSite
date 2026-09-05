import crypto from 'node:crypto'

const COOKIE_NAME = 'planner_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', requiredEnv('SESSION_SECRET')).update(payload).digest('base64url')
}

/** Compares two strings without leaking length or content through timing. */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

export function createToken(): string {
  const payload = b64url(JSON.stringify({ exp: Date.now() + MAX_AGE_SECONDS * 1000 }))
  return `${payload}.${sign(payload)}`
}

function verifyToken(token: string | null): boolean {
  if (!token) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  if (!safeEqual(sign(payload), signature)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim())
  }
  return null
}

export function isAuthenticated(req: Request): boolean {
  return verifyToken(readCookie(req, COOKIE_NAME))
}

/**
 * `Secure` is dropped for plain-http localhost so `netlify dev` can set the
 * cookie in browsers that refuse Secure over http.
 */
function isInsecureLocalhost(req: Request): boolean {
  try {
    const url = new URL(req.url)
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

export function sessionCookie(req: Request, token: string | null): string {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax']
  if (!isInsecureLocalhost(req)) attrs.push('Secure')
  attrs.push(`Max-Age=${token ? MAX_AGE_SECONDS : 0}`)
  return `${COOKIE_NAME}=${token ?? ''}; ${attrs.join('; ')}`
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(body), { ...init, headers })
}

export function unauthorized(): Response {
  return json({ error: 'unauthorized' }, { status: 401 })
}
