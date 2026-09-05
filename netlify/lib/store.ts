import { getStore } from '@netlify/blobs'

/** The documents the client is allowed to read and write. */
export const COLLECTIONS = ['calendar', 'habits', 'timeblocks', 'notes', 'workflow'] as const
export type Collection = (typeof COLLECTIONS)[number]

export function isCollection(value: string): value is Collection {
  return (COLLECTIONS as readonly string[]).includes(value)
}

function store() {
  // Strong consistency: a write must be visible to the next read, otherwise
  // switching pages could show stale data right after saving.
  return getStore({ name: 'planner', consistency: 'strong' })
}

export async function readDoc(key: Collection): Promise<unknown> {
  return (await store().get(key, { type: 'json' })) ?? null
}

export async function writeDoc(key: Collection, value: unknown): Promise<void> {
  await store().setJSON(key, value)
}

/** Login throttling state, kept in the same store so it survives cold starts. */
type Throttle = { failures: number; windowStart: number; lockedUntil: number }

const THROTTLE_KEY = 'auth-throttle'
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 8

export async function checkLockout(): Promise<number> {
  const state = (await store().get(THROTTLE_KEY, { type: 'json' })) as Throttle | null
  if (!state) return 0
  return state.lockedUntil > Date.now() ? state.lockedUntil - Date.now() : 0
}

export async function recordFailure(): Promise<void> {
  const now = Date.now()
  const previous = (await store().get(THROTTLE_KEY, { type: 'json' })) as Throttle | null
  const inWindow = previous && now - previous.windowStart < WINDOW_MS
  const failures = (inWindow ? previous.failures : 0) + 1
  await store().setJSON(THROTTLE_KEY, {
    failures,
    windowStart: inWindow ? previous.windowStart : now,
    lockedUntil: failures >= MAX_FAILURES ? now + WINDOW_MS : 0,
  } satisfies Throttle)
}

export async function clearFailures(): Promise<void> {
  await store().delete(THROTTLE_KEY)
}
