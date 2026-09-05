import { isAuthenticated, json } from '../lib/auth.js'

export default async (req: Request): Promise<Response> => {
  return json({ authenticated: isAuthenticated(req) })
}

export const config = { path: '/api/session' }
