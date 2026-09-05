import { createToken, json, safeEqual, sessionCookie } from '../lib/auth.js'
import { checkLockout, clearFailures, recordFailure } from '../lib/store.js'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 })

  const expected = process.env.PLANNER_PASSWORD
  if (!expected || !process.env.SESSION_SECRET) {
    return json({ error: 'Server is not configured: set PLANNER_PASSWORD and SESSION_SECRET.' }, { status: 500 })
  }

  const lockedForMs = await checkLockout()
  if (lockedForMs > 0) {
    return json(
      { error: `Too many attempts. Try again in ${Math.ceil(lockedForMs / 60000)} minute(s).` },
      { status: 429 },
    )
  }

  let password = ''
  try {
    password = String(((await req.json()) as { password?: unknown }).password ?? '')
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!safeEqual(password, expected)) {
    await recordFailure()
    return json({ error: 'Wrong password.' }, { status: 401 })
  }

  await clearFailures()
  return json({ ok: true }, { headers: { 'set-cookie': sessionCookie(req, createToken()) } })
}

export const config = { path: '/api/login' }
