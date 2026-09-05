import { useMemo, useState } from 'react'
import { TopBar } from '../components/Shell'
import { Empty, SaveIndicator, Segmented } from '../components/ui'
import { renderMarkdown } from '../lib/markdown'
import { useDoc } from '../lib/useDoc'
import { emptyNotes, uid, type Note, type NotesDoc } from '../lib/types'

type View = 'write' | 'read'

function preview(body: string): string {
  return body.replace(/[#*`>-]/g, '').split('\n').find((line) => line.trim()) ?? 'Empty note'
}

function timeAgo(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleDateString()
}

export default function NotesPage() {
  const { data, update, error, saveState } = useDoc<NotesDoc>('notes', emptyNotes)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('write')

  const sorted = useMemo(() => {
    const term = query.trim().toLowerCase()
    return [...(data?.notes ?? [])]
      .filter((note) =>
        !term ||
        note.title.toLowerCase().includes(term) ||
        note.body.toLowerCase().includes(term) ||
        note.tags.some((tag) => tag.toLowerCase().includes(term)),
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
  }, [data, query])

  const active = data?.notes.find((note) => note.id === activeId) ?? sorted[0] ?? null

  function patch(id: string, changes: Partial<Note>) {
    update((doc) => ({
      ...doc,
      notes: doc.notes.map((note) => (note.id === id ? { ...note, ...changes, updatedAt: Date.now() } : note)),
    }))
  }

  function create() {
    const now = Date.now()
    const note: Note = { id: uid(), title: '', body: '', tags: [], pinned: false, createdAt: now, updatedAt: now }
    update((doc) => ({ ...doc, notes: [note, ...doc.notes] }))
    setActiveId(note.id)
    setView('write')
  }

  function remove(id: string) {
    update((doc) => ({ ...doc, notes: doc.notes.filter((note) => note.id !== id) }))
    setActiveId(null)
  }

  return (
    <>
      <TopBar title="Notes">
        <SaveIndicator state={saveState} />
        <button className="btn primary" onClick={create}>
          + Note
        </button>
      </TopBar>

      <div className="page stack">
        {error && <div className="banner">{error}</div>}
        {!data ? (
          <Empty>Loading…</Empty>
        ) : (
          <div className="notes-layout">
            <div className="col">
              <input
                type="search"
                placeholder="Search notes and tags…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="note-list">
                {sorted.length === 0 ? (
                  <Empty>{query ? 'No matches.' : 'No notes yet.'}</Empty>
                ) : (
                  sorted.map((note) => (
                    <button
                      key={note.id}
                      className={`note-item${note.id === active?.id ? ' active' : ''}`}
                      onClick={() => setActiveId(note.id)}
                    >
                      <span className="t">
                        {note.pinned && <span aria-label="Pinned">📌</span>}
                        {note.title.trim() || 'Untitled'}
                      </span>
                      <span className="p">{preview(note.body)}</span>
                      <span className="faint" style={{ fontSize: '0.7rem' }}>
                        {timeAgo(note.updatedAt)}
                        {note.tags.length > 0 && ` · ${note.tags.map((tag) => `#${tag}`).join(' ')}`}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {!active ? (
              <div className="card">
                <Empty>Select a note, or create a new one.</Empty>
              </div>
            ) : (
              <div className="card note-editor stack">
                <input
                  type="text"
                  value={active.title}
                  placeholder="Title"
                  style={{ fontSize: '1.05rem', fontWeight: 650, border: 0, padding: '4px 0' }}
                  onChange={(e) => patch(active.id, { title: e.target.value })}
                />

                <div className="row wrap">
                  <Segmented<View>
                    value={view}
                    onChange={setView}
                    options={[
                      { value: 'write', label: 'Write' },
                      { value: 'read', label: 'Preview' },
                    ]}
                  />
                  <input
                    type="text"
                    value={active.tags.join(', ')}
                    placeholder="tags, comma separated"
                    style={{ flex: 1, minWidth: 140 }}
                    onChange={(e) =>
                      patch(active.id, {
                        tags: e.target.value
                          .split(',')
                          .map((tag) => tag.trim().replace(/^#/, ''))
                          .filter(Boolean),
                      })
                    }
                  />
                  <button
                    className="btn sm"
                    aria-pressed={active.pinned}
                    onClick={() => patch(active.id, { pinned: !active.pinned })}
                  >
                    {active.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button className="btn sm danger" onClick={() => remove(active.id)}>
                    Delete
                  </button>
                </div>

                {view === 'write' ? (
                  <textarea
                    value={active.body}
                    placeholder={'Write anything.\n\n# Heading\n- a list item\n- [ ] a task\n**bold**, *italic*, `code`'}
                    onChange={(e) => patch(active.id, { body: e.target.value })}
                  />
                ) : (
                  <div className="note-preview">
                    {active.body.trim() ? renderMarkdown(active.body) : <Empty>Nothing to preview.</Empty>}
                  </div>
                )}

                <div className="faint">Last edited {timeAgo(active.updatedAt)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
