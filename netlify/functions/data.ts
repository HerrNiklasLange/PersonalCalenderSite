import { isAuthenticated, json, unauthorized } from '../lib/auth.js'
import { isCollection, readDoc, writeDoc } from '../lib/store.js'

export default async (req: Request): Promise<Response> => {
  if (!isAuthenticated(req)) return unauthorized()

  const key = new URL(req.url).pathname.split('/').pop() ?? ''
  if (!isCollection(key)) return json({ error: 'unknown collection' }, { status: 404 })

  if (req.method === 'GET') {
    return json({ data: await readDoc(key) })
  }

  if (req.method === 'PUT') {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body.' }, { status: 400 })
    }
    await writeDoc(key, body)
    return json({ ok: true })
  }

  return json({ error: 'method not allowed' }, { status: 405 })
}

export const config = { path: '/api/data/:collection' }
