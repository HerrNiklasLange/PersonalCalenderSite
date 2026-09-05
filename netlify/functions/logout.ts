import { json, sessionCookie } from '../lib/auth.js'

export default async (req: Request): Promise<Response> => {
  return json({ ok: true }, { headers: { 'set-cookie': sessionCookie(req, null) } })
}

export const config = { path: '/api/logout' }
