import { useCallback, useEffect, useRef, useState } from 'react'
import { loadDoc, saveDoc, UnauthorizedError } from './api'
import type { Collection } from './types'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DEBOUNCE_MS = 700

/**
 * Loads one Blobs document and keeps it in sync: local edits apply instantly
 * and are flushed to the server on a short debounce.
 */
export function useDoc<T extends object>(collection: Collection, fallback: T) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<T | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadDoc<T>(collection)
      .then((remote) => {
        if (cancelled) return
        // Shallow-merge onto the fallback so documents written by an older
        // version of the app still get any newly added top-level fields.
        setData(remote ? { ...fallback, ...remote } : fallback)
      })
      .catch((cause) => {
        if (cancelled) return
        if (cause instanceof UnauthorizedError) {
          window.location.assign('/login')
          return
        }
        setError(cause instanceof Error ? cause.message : 'Could not load your data.')
      })
    return () => {
      cancelled = true
    }
    // `fallback` is a module-level constant per collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection])

  const flush = useCallback(async () => {
    const payload = pending.current
    if (!payload) return
    pending.current = null
    setSaveState('saving')
    try {
      await saveDoc(collection, payload)
      if (mounted.current) setSaveState('saved')
    } catch (cause) {
      if (cause instanceof UnauthorizedError) {
        window.location.assign('/login')
        return
      }
      if (mounted.current) {
        setSaveState('error')
        setError(cause instanceof Error ? cause.message : 'Could not save.')
      }
    }
  }, [collection])

  const update = useCallback(
    (recipe: (draft: T) => T) => {
      setData((current) => {
        if (!current) return current
        const next = recipe(current)
        pending.current = next
        setError(null)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS)
        return next
      })
    },
    [flush],
  )

  // Don't lose the last keystrokes when the tab is closed or backgrounded.
  useEffect(() => {
    const onHide = () => {
      if (!pending.current) return
      window.clearTimeout(timer.current)
      void flush()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flush])

  return { data, update, error, saveState }
}
