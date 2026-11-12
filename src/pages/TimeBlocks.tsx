import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '../components/Shell'
import { ColorPicker, Empty, Field, Modal, SaveIndicator, Segmented } from '../components/ui'
import {
  DAY_NAMES,
  DAY_NAMES_LONG,
  addDays,
  durationLabel,
  formatShort,
  fromMinutes,
  startOfWeek,
  toMinutes,
  todayISO,
  weekDates,
  weekdayIndex,
} from '../lib/date'
import { exportWeekPNG } from '../lib/exportWeek'
import { useDoc } from '../lib/useDoc'
import {
  emptyTimeBlocks,
  PALETTE,
  uid,
  type BlockStatus,
  type TimeBlock,
  type TimeBlocksDoc,
} from '../lib/types'

const HOUR_PX = 46
const SNAP_MINUTES = 15
const STATUS_WEIGHT: Record<BlockStatus, number> = { done: 1, partial: 0.5, missed: 0 }
const STATUS_MARK: Record<BlockStatus, string> = { done: '✓', partial: '~', missed: '✗' }

type Mode = 'plan' | 'review'
type Scope = 'series' | 'week'

interface EffectiveBlock extends TimeBlock {
  /** True when this isn't the recurring plan — a per-week swap or one-off addition. */
  exception?: boolean
}

function sortBlocks(a: TimeBlock, b: TimeBlock): number {
  return a.day - b.day || toMinutes(a.start) - toMinutes(b.start)
}

/** The recurring template with this week's swaps/skips/additions applied. */
function effectiveBlocks(
  template: TimeBlock[],
  overridesForWeek: Record<string, TimeBlock | null> | undefined,
): EffectiveBlock[] {
  const result: EffectiveBlock[] = []
  for (const block of template) {
    const override = overridesForWeek?.[block.id]
    if (override === null) continue // skipped this week
    result.push(override ? { ...override, exception: true } : block)
  }
  if (overridesForWeek) {
    const templateIds = new Set(template.map((b) => b.id))
    for (const [id, override] of Object.entries(overridesForWeek)) {
      if (override && !templateIds.has(id)) result.push({ ...override, exception: true })
    }
  }
  return result
}

export default function TimeBlocksPage() {
  const { data, update, error, saveState } = useDoc<TimeBlocksDoc>('timeblocks', emptyTimeBlocks)
  const [mode, setMode] = useState<Mode>('plan')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()))
  const [reviewDay, setReviewDay] = useState(todayISO)
  const [editing, setEditing] = useState<EffectiveBlock | null>(null)
  const [isNew, setIsNew] = useState(false)

  const dates = useMemo(() => weekDates(weekStart), [weekStart])

  // Keep the reviewed day inside the visible week.
  useEffect(() => {
    if (!dates.includes(reviewDay)) {
      setReviewDay(dates.includes(todayISO()) ? todayISO() : weekStart)
    }
  }, [dates, reviewDay, weekStart])

  const dayStart = data?.dayStart ?? 6
  const dayEnd = data?.dayEnd ?? 22
  const hours = Math.max(1, dayEnd - dayStart)
  const overridesForWeek = data?.overrides[weekStart]
  const blocks = useMemo(
    () => effectiveBlocks(data?.template ?? [], overridesForWeek).sort(sortBlocks),
    [data, overridesForWeek],
  )

  const adherence = useMemo(() => {
    if (!data) return { pct: 0, planned: 0, kept: 0, reviewed: 0, total: 0 }
    const today = todayISO()
    let planned = 0
    let kept = 0
    let reviewed = 0
    let total = 0
    for (const date of dates) {
      const dayBlocks = blocks.filter((block) => block.day === weekdayIndex(date))
      total += dayBlocks.length
      if (date > today) continue
      for (const block of dayBlocks) {
        const minutes = toMinutes(block.end) - toMinutes(block.start)
        planned += minutes
        const status = data.log[date]?.[block.id]?.status
        if (status) {
          reviewed += 1
          kept += minutes * STATUS_WEIGHT[status]
        }
      }
    }
    return { pct: planned ? Math.round((kept / planned) * 100) : 0, planned, kept, reviewed, total }
  }, [data, dates, blocks])

  function saveBlock(block: TimeBlock, scope: Scope) {
    if (toMinutes(block.end) <= toMinutes(block.start)) return
    const clean: TimeBlock = {
      id: block.id,
      day: block.day,
      start: block.start,
      end: block.end,
      title: block.title.trim() || 'Untitled block',
      color: block.color,
    }
    update((doc) => {
      if (scope === 'series') {
        const template = isNew ? [...doc.template, clean] : doc.template.map((b) => (b.id === clean.id ? clean : b))
        // An edit to the recurring plan should win over a stale one-week swap for it.
        const weekOverrides = { ...(doc.overrides[weekStart] ?? {}) }
        delete weekOverrides[clean.id]
        return { ...doc, template, overrides: { ...doc.overrides, [weekStart]: weekOverrides } }
      }
      const weekOverrides = { ...(doc.overrides[weekStart] ?? {}), [clean.id]: clean }
      return { ...doc, overrides: { ...doc.overrides, [weekStart]: weekOverrides } }
    })
    setEditing(null)
  }

  function deleteBlock(id: string, scope: Scope) {
    update((doc) => {
      if (scope === 'series') {
        const log: TimeBlocksDoc['log'] = {}
        for (const [date, entries] of Object.entries(doc.log)) {
          const { [id]: _removed, ...rest } = entries
          if (Object.keys(rest).length) log[date] = rest
        }
        return { ...doc, template: doc.template.filter((b) => b.id !== id), log }
      }
      const isTemplateBlock = doc.template.some((b) => b.id === id)
      const weekOverrides = { ...(doc.overrides[weekStart] ?? {}) }
      if (isTemplateBlock) weekOverrides[id] = null
      else delete weekOverrides[id]
      return { ...doc, overrides: { ...doc.overrides, [weekStart]: weekOverrides } }
    })
    setEditing(null)
  }

  function review(date: string, blockId: string, status: BlockStatus | null, note?: string) {
    update((doc) => {
      const day = { ...(doc.log[date] ?? {}) }
      if (status === null) delete day[blockId]
      else day[blockId] = { status, note: note ?? day[blockId]?.note }
      const log = { ...doc.log }
      if (Object.keys(day).length) log[date] = day
      else delete log[date]
      return { ...doc, log }
    })
  }

  function createAt(day: number, minutes: number) {
    const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
    setEditing({
      id: uid(),
      day,
      start: fromMinutes(snapped),
      end: fromMinutes(Math.min(dayEnd * 60, snapped + 60)),
      title: '',
      color: PALETTE[0],
    })
    setIsNew(true)
  }

  const reviewBlocks = blocks.filter((block) => block.day === weekdayIndex(reviewDay))

  return (
    <>
      <TopBar title="This week">
        <SaveIndicator state={saveState} />
        <button
          className="btn"
          onClick={() =>
            data && exportWeekPNG(blocks, dayStart, dayEnd, `Weekly timetable · week of ${formatShort(weekStart)}`)
          }
        >
          PNG
        </button>
        <button className="btn" onClick={() => window.print()}>
          PDF
        </button>
      </TopBar>

      <div className="page stack">
        {error && <div className="banner">{error}</div>}

        <div className="spread no-print">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'plan', label: 'Plan' },
              { value: 'review', label: 'Review' },
            ]}
          />
          <div className="row">
            <button className="btn sm icon" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
              ‹
            </button>
            <span className="mono faint" style={{ minWidth: 108, textAlign: 'center' }}>
              {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
            </span>
            <button className="btn sm icon" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
              ›
            </button>
            <button className="btn sm" onClick={() => setWeekStart(startOfWeek(todayISO()))}>
              This week
            </button>
          </div>
        </div>

        {!data ? (
          <Empty>Loading…</Empty>
        ) : (
          <>
            <div className="card focus-card">
              <h2>This week's focus</h2>
              <textarea
                className="focus-input"
                placeholder="What matters most this week?"
                value={data.focus[weekStart] ?? ''}
                onChange={(e) =>
                  update((doc) => ({ ...doc, focus: { ...doc.focus, [weekStart]: e.target.value } }))
                }
              />
            </div>

            <div className="card">
              <div className="spread" style={{ marginBottom: 8 }}>
                <div>
                  <h2>Followed the plan: {adherence.pct}%</h2>
                  <div className="faint">
                    {durationLabel(Math.round(adherence.kept))} kept of {durationLabel(adherence.planned)} planned ·{' '}
                    {adherence.reviewed}/{adherence.total} blocks reviewed this week
                  </div>
                </div>
              </div>
              <div className="adherence-bar">
                <div style={{ width: `${adherence.pct}%` }} />
              </div>
            </div>

            <div className="week-scroll">
              <div className="week-grid">
                <div className="wg-corner" />
                {DAY_NAMES.map((name, day) => (
                  <div key={name} className={`wg-dayhead${dates[day] === todayISO() ? ' is-today' : ''}`}>
                    {name}
                    <small>{formatShort(dates[day])}</small>
                  </div>
                ))}

                <div className="wg-hours">
                  {Array.from({ length: hours }, (_, i) => (
                    <div className="wg-hour" key={i}>
                      {String(dayStart + i).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {DAY_NAMES.map((name, day) => (
                  <div
                    key={name}
                    className="wg-col"
                    onClick={(clickEvent) => {
                      if (clickEvent.target !== clickEvent.currentTarget) return
                      const bounds = clickEvent.currentTarget.getBoundingClientRect()
                      const offsetY = clickEvent.clientY - bounds.top
                      createAt(day, dayStart * 60 + (offsetY / HOUR_PX) * 60)
                    }}
                  >
                    {Array.from({ length: hours }, (_, i) => (
                      <div className="wg-slot" key={i} style={{ pointerEvents: 'none' }} />
                    ))}

                    {dates[day] === todayISO() && <NowLine dayStart={dayStart} dayEnd={dayEnd} />}

                    {blocks
                      .filter((block) => block.day === day)
                      .map((block) => {
                        const start = toMinutes(block.start)
                        const end = toMinutes(block.end)
                        const top = ((start - dayStart * 60) / 60) * HOUR_PX
                        const height = ((end - start) / 60) * HOUR_PX
                        const status = mode === 'review' ? data.log[dates[day]]?.[block.id]?.status : undefined
                        return (
                          <button
                            key={block.id}
                            className={`wg-block${status === 'missed' ? ' missed' : ''}`}
                            style={{
                              top: Math.max(0, top),
                              height: Math.max(16, height - 2),
                              background: block.color,
                            }}
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              setEditing(block)
                              setIsNew(false)
                            }}
                          >
                            {block.exception && (
                              <span className="wg-exception" title="Different this week" aria-label="Different this week" />
                            )}
                            {status && <span className="mark">{STATUS_MARK[status]}</span>}
                            <span className="bt">{block.title}</span>
                            {height > 32 && (
                              <span className="bs">
                                {block.start}–{block.end}
                              </span>
                            )}
                          </button>
                        )
                      })}
                  </div>
                ))}
              </div>
            </div>

            <div className="row wrap no-print">
              <span className="faint">Click an empty slot to add a block. Grid shows</span>
              <input
                type="number"
                min="0"
                max="23"
                value={dayStart}
                style={{ width: 68 }}
                onChange={(e) => update((doc) => ({ ...doc, dayStart: Math.min(Number(e.target.value), dayEnd - 1) }))}
              />
              <span className="faint">to</span>
              <input
                type="number"
                min="1"
                max="24"
                value={dayEnd}
                style={{ width: 68 }}
                onChange={(e) => update((doc) => ({ ...doc, dayEnd: Math.max(Number(e.target.value), dayStart + 1) }))}
              />
              <span className="faint">o'clock.</span>
            </div>

            {mode === 'review' && (
              <div className="card no-print">
                <div className="spread" style={{ marginBottom: 10 }}>
                  <h2>Did you follow it?</h2>
                  <select value={reviewDay} onChange={(e) => setReviewDay(e.target.value)} style={{ width: 'auto' }}>
                    {dates.map((date, index) => (
                      <option key={date} value={date}>
                        {DAY_NAMES_LONG[index]} · {formatShort(date)}
                      </option>
                    ))}
                  </select>
                </div>

                {reviewBlocks.length === 0 ? (
                  <Empty>No blocks planned for this day.</Empty>
                ) : (
                  reviewBlocks.map((block) => {
                    const entry = data.log[reviewDay]?.[block.id]
                    return (
                      <div key={block.id} className="review-row">
                        <span className="swatch" style={{ background: block.color, width: 10, height: 10 }} />
                        <div className="meta">
                          <div className="t">{block.title}</div>
                          <div className="faint mono">
                            {block.start}–{block.end} · {durationLabel(toMinutes(block.end) - toMinutes(block.start))}
                          </div>
                        </div>
                        <div className="status-group">
                          {(['done', 'partial', 'missed'] as BlockStatus[]).map((status) => (
                            <button
                              key={status}
                              data-s={status}
                              aria-pressed={entry?.status === status}
                              onClick={() => review(reviewDay, block.id, entry?.status === status ? null : status)}
                            >
                              {status === 'done' ? 'Done' : status === 'partial' ? 'Partly' : 'Missed'}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="What actually happened?"
                          defaultValue={entry?.note ?? ''}
                          style={{ flexBasis: 240, flexGrow: 1 }}
                          onBlur={(e) =>
                            review(reviewDay, block.id, entry?.status ?? 'partial', e.target.value.trim() || undefined)
                          }
                        />
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {editing && (
        <BlockModal
          block={editing}
          isNew={isNew}
          weekLabel={`${formatShort(weekStart)} – ${formatShort(addDays(weekStart, 6))}`}
          onClose={() => setEditing(null)}
          onSave={saveBlock}
          onDelete={(scope) => deleteBlock(editing.id, scope)}
        />
      )}
    </>
  )
}

function NowLine({ dayStart, dayEnd }: { dayStart: number; dayEnd: number }) {
  const [minutes, setMinutes] = useState(() => new Date().getHours() * 60 + new Date().getMinutes())
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date()
      setMinutes(now.getHours() * 60 + now.getMinutes())
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  if (minutes < dayStart * 60 || minutes > dayEnd * 60) return null
  return <div className="wg-now" style={{ top: ((minutes - dayStart * 60) / 60) * HOUR_PX }} />
}

function BlockModal({
  block,
  isNew,
  weekLabel,
  onClose,
  onSave,
  onDelete,
}: {
  block: EffectiveBlock
  isNew: boolean
  weekLabel: string
  onClose: () => void
  onSave: (block: TimeBlock, scope: Scope) => void
  onDelete: (scope: Scope) => void
}) {
  const [draft, setDraft] = useState<TimeBlock>(block)
  const [scope, setScope] = useState<Scope>(block.exception ? 'week' : 'series')
  const invalid = toMinutes(draft.end) <= toMinutes(draft.start)

  return (
    <Modal
      title={isNew ? 'New block' : 'Edit block'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button className="btn danger left" onClick={() => onDelete(scope)}>
              {scope === 'series' ? 'Remove from every week' : 'Skip just this week'}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={invalid} onClick={() => onSave(draft, scope)}>
            Save
          </button>
        </>
      }
    >
      <Field label="Applies to">
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'series', label: 'Every week' },
            { value: 'week', label: `Just ${weekLabel}` },
          ]}
        />
      </Field>

      <Field label="Title">
        <input
          type="text"
          value={draft.title}
          autoFocus
          placeholder="Deep work, gym, admin…"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </Field>

      <Field label="Day">
        <select value={draft.day} onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) })}>
          {DAY_NAMES_LONG.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid-2">
        <Field label="Start">
          <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
        </Field>
        <Field label="End">
          <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
        </Field>
      </div>

      {invalid && <div className="banner" style={{ marginBottom: 12 }}>End time must be after the start time.</div>}

      <Field label="Colour">
        <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
      </Field>

      <p className="faint" style={{ margin: 0 }}>
        {scope === 'series'
          ? 'Changes the recurring weekly plan, from this week on.'
          : "Only changes this one week — next week reverts to the recurring plan."}{' '}
        Use <strong>Review</strong> to record whether you actually followed it.
      </p>
    </Modal>
  )
}
