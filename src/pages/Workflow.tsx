import { useMemo, useState } from 'react'
import { TopBar } from '../components/Shell'
import { Empty, Field, Modal, SaveIndicator, Segmented } from '../components/ui'
import { useDoc } from '../lib/useDoc'
import {
  BOARDS,
  emptyWorkflow,
  uid,
  type Board,
  type BoardId,
  type WorkflowDoc,
  type WorkflowItem,
} from '../lib/types'

export default function WorkflowPage() {
  const { data, update, error, saveState } = useDoc<WorkflowDoc>('workflow', emptyWorkflow)
  const [boardId, setBoardId] = useState<BoardId>('personal')
  const [editing, setEditing] = useState<WorkflowItem | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [newValue, setNewValue] = useState('')

  const board: Board | null = data?.boards?.[boardId] ?? null

  const areas = useMemo(() => {
    const set = new Set<string>()
    for (const b of Object.values(data?.boards ?? {})) {
      for (const item of b.items) if (item.area) set.add(item.area)
    }
    return [...set].sort()
  }, [data])

  function patchBoard(recipe: (board: Board) => Board) {
    update((doc) => ({ ...doc, boards: { ...doc.boards, [boardId]: recipe(doc.boards[boardId]) } }))
  }

  function saveItem(item: WorkflowItem) {
    const clean = { ...item, title: item.title.trim() || 'Untitled' }
    patchBoard((b) => ({
      ...b,
      items: isNew ? [...b.items, clean] : b.items.map((i) => (i.id === clean.id ? clean : i)),
    }))
    setEditing(null)
  }

  function deleteItem(id: string) {
    patchBoard((b) => ({ ...b, items: b.items.filter((i) => i.id !== id) }))
    setEditing(null)
  }

  function move(item: WorkflowItem, direction: -1 | 1) {
    if (!board) return
    const index = board.columns.findIndex((column) => column.id === item.columnId)
    const next = board.columns[index + direction]
    if (!next) return
    patchBoard((b) => ({
      ...b,
      items: b.items.map((i) => (i.id === item.id ? { ...i, columnId: next.id } : i)),
    }))
  }

  function addColumn() {
    patchBoard((b) => ({ ...b, columns: [...b.columns, { id: uid(), title: 'New area' }] }))
  }

  function renameColumn(columnId: string, title: string) {
    patchBoard((b) => ({ ...b, columns: b.columns.map((c) => (c.id === columnId ? { ...c, title } : c)) }))
  }

  function deleteColumn(columnId: string) {
    patchBoard((b) => {
      if (b.columns.length <= 1) return b
      const index = b.columns.findIndex((c) => c.id === columnId)
      const fallback = b.columns[index === 0 ? 1 : index - 1]
      return {
        ...b,
        columns: b.columns.filter((c) => c.id !== columnId),
        items: b.items.map((i) => (i.columnId === columnId ? { ...i, columnId: fallback.id } : i)),
      }
    })
  }

  function addValue() {
    const value = newValue.trim()
    if (!value) return
    patchBoard((b) => ({ ...b, values: [...b.values, value] }))
    setNewValue('')
  }

  return (
    <>
      <TopBar title="Workflow">
        <SaveIndicator state={saveState} />
        <button className="btn" onClick={addColumn}>
          + Column
        </button>
      </TopBar>

      <div className="page stack">
        {error && <div className="banner">{error}</div>}

        <Segmented<BoardId>
          value={boardId}
          onChange={setBoardId}
          options={BOARDS.map((entry) => ({ value: entry.id, label: entry.label }))}
        />

        {!data || !board ? (
          <Empty>Loading…</Empty>
        ) : (
          <>
            <div className="card">
              <h3 style={{ marginBottom: 8, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem' }}>
                {BOARDS.find((entry) => entry.id === boardId)?.label} values
              </h3>
              <div className="values-list" style={{ marginBottom: 10 }}>
                {board.values.length === 0 && <span className="faint">What matters here? Add a value.</span>}
                {board.values.map((value, index) => (
                  <span className="value-chip" key={`${value}-${index}`}>
                    {value}
                    <button
                      aria-label={`Remove ${value}`}
                      onClick={() => patchBoard((b) => ({ ...b, values: b.values.filter((_, i) => i !== index) }))}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="row">
                <input
                  type="text"
                  value={newValue}
                  placeholder="Add a guiding value…"
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addValue()}
                />
                <button className="btn" onClick={addValue} disabled={!newValue.trim()}>
                  Add
                </button>
              </div>
            </div>

            <div className="board">
              {board.columns.map((column, columnIndex) => {
                const items = board.items.filter((item) => item.columnId === column.id)
                return (
                  <div className="board-col" key={column.id}>
                    <header>
                      <input
                        className="title"
                        type="text"
                        value={column.title}
                        aria-label="Column name"
                        style={{ border: 0, background: 'transparent', padding: 0, minHeight: 0 }}
                        onChange={(e) => renameColumn(column.id, e.target.value)}
                      />
                      <span className="count">{items.length}</span>
                      {board.columns.length > 1 && (
                        <button
                          className="btn ghost sm icon"
                          aria-label={`Delete column ${column.title}`}
                          onClick={() => deleteColumn(column.id)}
                        >
                          ✕
                        </button>
                      )}
                    </header>

                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="wf-card"
                        onClick={() => {
                          setEditing(item)
                          setIsNew(false)
                        }}
                      >
                        <span className="t">{item.title}</span>
                        {item.notes && <span className="n">{item.notes}</span>}
                        {item.area && <span className="chip" style={{ alignSelf: 'flex-start' }}>{item.area}</span>}
                        <div className="wf-move" onClick={(e) => e.stopPropagation()}>
                          <button
                            aria-label="Move left"
                            disabled={columnIndex === 0}
                            onClick={() => move(item, -1)}
                          >
                            ‹
                          </button>
                          <button
                            aria-label="Move right"
                            disabled={columnIndex === board.columns.length - 1}
                            onClick={() => move(item, 1)}
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        setEditing({
                          id: uid(),
                          columnId: column.id,
                          title: '',
                          notes: '',
                          area: '',
                          createdAt: Date.now(),
                        })
                        setIsNew(true)
                      }}
                    >
                      + Add
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {editing && board && (
        <ItemModal
          item={editing}
          board={board}
          areas={areas}
          isNew={isNew}
          onClose={() => setEditing(null)}
          onSave={saveItem}
          onDelete={() => deleteItem(editing.id)}
        />
      )}
    </>
  )
}

function ItemModal({
  item,
  board,
  areas,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  item: WorkflowItem
  board: Board
  areas: string[]
  isNew: boolean
  onClose: () => void
  onSave: (item: WorkflowItem) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(item)

  return (
    <Modal
      title={isNew ? 'New item' : 'Edit item'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button className="btn danger left" onClick={onDelete}>
              Delete
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onSave(draft)}>
            Save
          </button>
        </>
      }
    >
      <Field label="Title">
        <input
          type="text"
          value={draft.title}
          autoFocus
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </Field>

      <div className="grid-2">
        <Field label="Status">
          <select value={draft.columnId} onChange={(e) => setDraft({ ...draft, columnId: e.target.value })}>
            {board.columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Area">
          <input
            type="text"
            list="workflow-areas"
            value={draft.area}
            placeholder="Health, Finance, Skills…"
            onChange={(e) => setDraft({ ...draft, area: e.target.value })}
          />
          <datalist id="workflow-areas">
            {areas.map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="Notes">
        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </Field>
    </Modal>
  )
}
