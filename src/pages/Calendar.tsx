import { useMemo, useState } from 'react'
import { TopBar } from '../components/Shell'
import { ColorPicker, Empty, Field, Modal, SaveIndicator } from '../components/ui'
import {
  DAY_NAMES,
  addMonths,
  formatDay,
  formatMonth,
  fromISO,
  monthGrid,
  sameMonth,
  todayISO,
} from '../lib/date'
import { useDoc } from '../lib/useDoc'
import { emptyCalendar, PALETTE, uid, type CalendarDoc, type CalendarEvent } from '../lib/types'

const MAX_CHIPS = 3

function sortEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (!a.start && b.start) return -1
  if (a.start && !b.start) return 1
  return (a.start ?? '').localeCompare(b.start ?? '') || a.title.localeCompare(b.title)
}

function blankEvent(date: string): CalendarEvent {
  return { id: uid(), date, title: '', color: PALETTE[0], start: '09:00', end: '10:00' }
}

export default function CalendarPage() {
  const { data, update, error, saveState } = useDoc<CalendarDoc>('calendar', emptyCalendar)
  const [cursor, setCursor] = useState(todayISO)
  const [selected, setSelected] = useState(todayISO)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [isNew, setIsNew] = useState(false)

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of data?.events ?? []) {
      const list = map.get(event.date)
      if (list) list.push(event)
      else map.set(event.date, [event])
    }
    for (const list of map.values()) list.sort(sortEvents)
    return map
  }, [data])

  const days = useMemo(() => monthGrid(cursor), [cursor])
  const selectedEvents = byDate.get(selected) ?? []

  function openNew(date: string) {
    setEditing(blankEvent(date))
    setIsNew(true)
  }

  function save(event: CalendarEvent) {
    const clean: CalendarEvent = {
      ...event,
      title: event.title.trim() || 'Untitled',
      notes: event.notes?.trim() || undefined,
    }
    update((doc) => ({
      ...doc,
      events: isNew ? [...doc.events, clean] : doc.events.map((e) => (e.id === clean.id ? clean : e)),
    }))
    setEditing(null)
  }

  function remove(id: string) {
    update((doc) => ({ ...doc, events: doc.events.filter((e) => e.id !== id) }))
    setEditing(null)
  }

  function toggleDone(id: string) {
    update((doc) => ({
      ...doc,
      events: doc.events.map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
    }))
  }

  return (
    <>
      <TopBar title="Calendar">
        <SaveIndicator state={saveState} />
        <button className="btn primary" onClick={() => openNew(selected)}>
          + Event
        </button>
      </TopBar>

      <div className="page stack">
        {error && <div className="banner">{error}</div>}

        <div className="spread">
          <div className="row">
            <button className="btn sm icon" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">
              ‹
            </button>
            <button className="btn sm icon" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
              ›
            </button>
            <h2 style={{ marginLeft: 6 }}>{formatMonth(cursor)}</h2>
          </div>
          <button
            className="btn sm"
            onClick={() => {
              setCursor(todayISO())
              setSelected(todayISO())
            }}
          >
            Today
          </button>
        </div>

        {!data ? (
          <Empty>Loading…</Empty>
        ) : (
          <div className="cal-layout">
            <div className="cal-grid">
              {DAY_NAMES.map((name) => (
                <div key={name} className="cal-head">
                  {name}
                </div>
              ))}
              {days.map((iso) => {
                const events = byDate.get(iso) ?? []
                const classes = [
                  'cal-cell',
                  sameMonth(iso, cursor) ? '' : 'outside',
                  iso === todayISO() ? 'today' : '',
                  iso === selected ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={iso}
                    className={classes}
                    onClick={() => setSelected(iso)}
                    onDoubleClick={() => openNew(iso)}
                    aria-label={formatDay(iso)}
                  >
                    <span className="cal-date">{fromISO(iso).getDate()}</span>
                    {events.slice(0, MAX_CHIPS).map((event) => (
                      <span key={event.id} className={`cal-chip${event.done ? ' done' : ''}`}>
                        <span className="swatch" style={{ background: event.color }} />
                        {event.start ? `${event.start} ` : ''}
                        {event.title}
                      </span>
                    ))}
                    {events.length > MAX_CHIPS && <span className="cal-more">+{events.length - MAX_CHIPS} more</span>}
                  </button>
                )
              })}
            </div>

            <div className="card">
              <div className="spread" style={{ marginBottom: 10 }}>
                <h2>{formatDay(selected)}</h2>
                <button className="btn sm" onClick={() => openNew(selected)}>
                  + Add
                </button>
              </div>

              {selectedEvents.length === 0 ? (
                <Empty>Nothing planned. Add what you need to do.</Empty>
              ) : (
                selectedEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`event-row${event.done ? ' done' : ''}`}
                    onClick={() => {
                      setEditing(event)
                      setIsNew(false)
                    }}
                  >
                    <span className="bar" style={{ background: event.color }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="title">{event.title}</div>
                      <div className="time">
                        {event.start ? `${event.start}${event.end ? `–${event.end}` : ''}` : 'All day'}
                      </div>
                      {event.notes && <div className="faint">{event.notes}</div>}
                    </div>
                    <input
                      type="checkbox"
                      checked={!!event.done}
                      style={{ width: 18, height: 18, minHeight: 0, flex: 'none' }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleDone(event.id)}
                      aria-label={`Mark ${event.title} done`}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EventModal
          event={editing}
          isNew={isNew}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={() => remove(editing.id)}
        />
      )}
    </>
  )
}

function EventModal({
  event,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  event: CalendarEvent
  isNew: boolean
  onClose: () => void
  onSave: (event: CalendarEvent) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(event)
  const allDay = !draft.start

  return (
    <Modal
      title={isNew ? 'New event' : 'Edit event'}
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
          placeholder="What is going on?"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </Field>

      <Field label="Date">
        <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
      </Field>

      <label className="row" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={allDay}
          style={{ width: 16, height: 16, minHeight: 0 }}
          onChange={(e) =>
            setDraft(
              e.target.checked
                ? { ...draft, start: undefined, end: undefined }
                : { ...draft, start: '09:00', end: '10:00' },
            )
          }
        />
        <span>All day / no fixed time</span>
      </label>

      {!allDay && (
        <div className="grid-2">
          <Field label="Start">
            <input type="time" value={draft.start ?? ''} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
          </Field>
          <Field label="End">
            <input type="time" value={draft.end ?? ''} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
          </Field>
        </div>
      )}

      <Field label="Notes">
        <textarea
          value={draft.notes ?? ''}
          style={{ minHeight: 70 }}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </Field>

      <Field label="Colour">
        <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
      </Field>
    </Modal>
  )
}
