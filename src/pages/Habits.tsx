import { useMemo, useState } from 'react'
import { TopBar } from '../components/Shell'
import { ColorPicker, Empty, Field, Modal, SaveIndicator } from '../components/ui'
import {
  DAY_NAMES,
  MONTH_NAMES,
  addDays,
  formatDay,
  fromISO,
  relativeLabel,
  startOfWeek,
  todayISO,
  weekdayIndex,
} from '../lib/date'
import { useDoc } from '../lib/useDoc'
import { emptyHabits, PALETTE, uid, type Habit, type HabitsDoc } from '../lib/types'

const WEEKS = 53
const LEVEL_MIX = [0, 28, 50, 74, 100]

/** 0 = no data, 1–4 = increasingly good. */
function level(habit: Habit, value: number | undefined): number {
  if (value === undefined) return 0
  const ratio = habit.target > 0 ? value / habit.target : value
  if (habit.goal === 'atMost') {
    if (ratio <= 0.5) return 4
    if (ratio <= 1) return 3
    if (ratio <= 1.5) return 2
    return 1
  }
  if (value <= 0) return 0
  if (ratio >= 1.5) return 4
  if (ratio >= 1) return 3
  if (ratio >= 0.5) return 2
  return 1
}

function metGoal(habit: Habit, value: number | undefined): boolean {
  if (value === undefined) return false
  return habit.goal === 'atMost' ? value <= habit.target : value >= habit.target
}

function cellColor(habit: Habit, lvl: number): string {
  if (lvl === 0) return 'var(--surface-3)'
  return `color-mix(in srgb, ${habit.color} ${LEVEL_MIX[lvl]}%, var(--surface-3))`
}

function lastNDates(n: number): string[] {
  const today = todayISO()
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)))
}

function streaks(habit: Habit, log: HabitsDoc['log']) {
  const today = todayISO()
  let current = 0
  // A streak stays alive until today is actually missed, so start from
  // yesterday if today has not been logged yet.
  let cursor = metGoal(habit, log[today]?.[habit.id]) ? today : addDays(today, -1)
  while (metGoal(habit, log[cursor]?.[habit.id])) {
    current += 1
    cursor = addDays(cursor, -1)
  }

  let best = 0
  let run = 0
  const dates = Object.keys(log).sort()
  let previous: string | null = null
  for (const date of dates) {
    if (!metGoal(habit, log[date]?.[habit.id])) {
      run = 0
      previous = date
      continue
    }
    run = previous && addDays(previous, 1) === date ? run + 1 : 1
    best = Math.max(best, run)
    previous = date
  }

  let hits = 0
  for (let i = 0; i < 30; i += 1) {
    if (metGoal(habit, log[addDays(today, -i)]?.[habit.id])) hits += 1
  }

  return { current, best: Math.max(best, current), rate: Math.round((hits / 30) * 100) }
}

export default function HabitsPage() {
  const { data, update, error, saveState } = useDoc<HabitsDoc>('habits', emptyHabits)
  const [selected, setSelected] = useState(todayISO)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())

  function toggleHistory(id: string) {
    setExpandedHistory((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const columns = useMemo(() => {
    const firstMonday = addDays(startOfWeek(todayISO()), -(WEEKS - 1) * 7)
    return Array.from({ length: WEEKS }, (_, week) =>
      Array.from({ length: 7 }, (_, day) => addDays(firstMonday, week * 7 + day)),
    )
  }, [])

  const habits = (data?.habits ?? []).filter((habit) => !habit.archived)

  function setValue(date: string, habitId: string, value: number | undefined) {
    update((doc) => {
      const day = { ...(doc.log[date] ?? {}) }
      if (value === undefined) delete day[habitId]
      else day[habitId] = value
      const log = { ...doc.log }
      if (Object.keys(day).length) log[date] = day
      else delete log[date]
      return { ...doc, log }
    })
  }

  function saveHabit(habit: Habit) {
    const clean = { ...habit, name: habit.name.trim() || 'Untitled habit' }
    update((doc) => ({
      ...doc,
      habits: isNew ? [...doc.habits, clean] : doc.habits.map((h) => (h.id === clean.id ? clean : h)),
    }))
    setEditing(null)
  }

  function deleteHabit(id: string) {
    update((doc) => {
      const log: HabitsDoc['log'] = {}
      for (const [date, entries] of Object.entries(doc.log)) {
        const { [id]: _removed, ...rest } = entries
        if (Object.keys(rest).length) log[date] = rest
      }
      return { habits: doc.habits.filter((h) => h.id !== id), log }
    })
    setEditing(null)
  }

  return (
    <>
      <TopBar title="Habits">
        <SaveIndicator state={saveState} />
        <button
          className="btn primary"
          onClick={() => {
            setEditing({
              id: uid(),
              name: '',
              kind: 'binary',
              goal: 'atLeast',
              target: 1,
              unit: '',
              color: PALETTE[2],
            })
            setIsNew(true)
          }}
        >
          + Habit
        </button>
      </TopBar>

      <div className="page stack">
        {error && <div className="banner">{error}</div>}
        {!data ? (
          <Empty>Loading…</Empty>
        ) : (
          <>
            <div className="card">
              <div className="spread" style={{ marginBottom: 6 }}>
                <h2>{relativeLabel(selected) === formatDay(selected) ? formatDay(selected) : `${relativeLabel(selected)} · ${formatDay(selected)}`}</h2>
                <input
                  type="date"
                  value={selected}
                  max={todayISO()}
                  style={{ width: 'auto' }}
                  onChange={(e) => e.target.value && setSelected(e.target.value)}
                />
              </div>

              {habits.length === 0 ? (
                <Empty>No habits yet — add one to start tracking.</Empty>
              ) : (
                habits.map((habit) => {
                  const value = data.log[selected]?.[habit.id]
                  return (
                    <div key={habit.id} className="today-row">
                      <span className="swatch" style={{ background: habit.color, width: 10, height: 10 }} />
                      <span className="name">
                        {habit.name}
                        <span className="faint">
                          {' '}
                          · {habit.goal === 'atMost' ? '≤' : '≥'} {habit.target}
                          {habit.unit}
                        </span>
                      </span>
                      {habit.kind === 'binary' ? (
                        <button
                          className="toggle"
                          aria-pressed={!!value}
                          aria-label={`Toggle ${habit.name}`}
                          onClick={() => setValue(selected, habit.id, value ? undefined : 1)}
                        />
                      ) : (
                        <div className="stepper">
                          <button
                            className="btn sm icon"
                            aria-label="Decrease"
                            onClick={() => setValue(selected, habit.id, Math.max(0, (value ?? 0) - 0.5))}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={value ?? ''}
                            placeholder="–"
                            onChange={(e) =>
                              setValue(selected, habit.id, e.target.value === '' ? undefined : Number(e.target.value))
                            }
                          />
                          <button
                            className="btn sm icon"
                            aria-label="Increase"
                            onClick={() => setValue(selected, habit.id, (value ?? 0) + 0.5)}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {habits.map((habit) => {
              const stats = streaks(habit, data.log)
              const expanded = expandedHistory.has(habit.id)
              return (
                <div key={habit.id} className="card habit-card">
                  <div className="habit-head">
                    <span className="swatch" style={{ background: habit.color, width: 10, height: 10 }} />
                    <span className="name">{habit.name}</span>
                    <span className="chip">
                      {habit.goal === 'atMost' ? 'at most' : 'at least'} {habit.target}
                      {habit.unit} / day
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        setEditing(habit)
                        setIsNew(false)
                      }}
                    >
                      Edit
                    </button>
                  </div>

                  <div className="habit-hero">
                    <div className="streak-hero">
                      <span className="streak-number">{stats.current}</span>
                      <span className="streak-label">day streak</span>
                    </div>
                    <div className="faint">
                      Best {stats.best} · {stats.rate}% last 30 days
                    </div>
                  </div>

                  <WeekStrip habit={habit} log={data.log} selected={selected} onSelect={setSelected} />

                  <button className="btn ghost sm history-toggle" onClick={() => toggleHistory(habit.id)}>
                    {expanded ? 'Hide full history' : 'Show full history'}
                  </button>

                  {expanded && (
                    <Heatmap
                      habit={habit}
                      columns={columns}
                      log={data.log}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {editing && (
        <HabitModal
          habit={editing}
          isNew={isNew}
          onClose={() => setEditing(null)}
          onSave={saveHabit}
          onDelete={() => deleteHabit(editing.id)}
        />
      )}
    </>
  )
}

function WeekStrip({
  habit,
  log,
  selected,
  onSelect,
}: {
  habit: Habit
  log: HabitsDoc['log']
  selected: string
  onSelect: (date: string) => void
}) {
  const today = todayISO()
  const dates = lastNDates(7)
  return (
    <div className="week-strip">
      {dates.map((date) => {
        const value = log[date]?.[habit.id]
        const label = `${date} · ${value === undefined ? 'no entry' : `${value}${habit.unit}`}`
        return (
          <div className="week-strip-col" key={date}>
            <span className="week-cell-day">{DAY_NAMES[weekdayIndex(date)][0]}</span>
            <button
              className={`week-cell${date === today ? ' today' : ''}`}
              title={label}
              aria-label={label}
              style={{
                background: cellColor(habit, level(habit, value)),
                outline: date === selected ? `1.5px solid var(--accent)` : undefined,
              }}
              onClick={() => onSelect(date)}
            />
          </div>
        )
      })}
    </div>
  )
}

function Heatmap({
  habit,
  columns,
  log,
  selected,
  onSelect,
}: {
  habit: Habit
  columns: string[][]
  log: HabitsDoc['log']
  selected: string
  onSelect: (date: string) => void
}) {
  const today = todayISO()
  return (
    <div className="heatmap-scroll" ref={(el) => { if (el) el.scrollLeft = el.scrollWidth }}>
      <div className="heatmap">
        {columns.map((week, index) => (
          <div className="heatmap-col" key={index}>
            {week.map((date) => {
              const future = date > today
              const value = log[date]?.[habit.id]
              return (
                <button
                  key={date}
                  className={`heat-cell${future ? ' blank' : ''}${date === today ? ' today' : ''}`}
                  disabled={future}
                  title={`${date} · ${value === undefined ? 'no entry' : `${value}${habit.unit}`}`}
                  aria-label={`${date}: ${value === undefined ? 'no entry' : `${value}${habit.unit}`}`}
                  style={{
                    background: cellColor(habit, level(habit, value)),
                    outline: date === selected ? `1.5px solid var(--accent)` : undefined,
                  }}
                  onClick={() => onSelect(date)}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="heat-labels">
        {columns.map((week, index) => {
          const first = fromISO(week[0])
          const previous = index > 0 ? fromISO(columns[index - 1][0]) : null
          const show = !previous || previous.getMonth() !== first.getMonth()
          return (
            <span className="heat-month" key={index}>
              {show ? MONTH_NAMES[first.getMonth()].slice(0, 3) : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function HabitModal({
  habit,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  habit: Habit
  isNew: boolean
  onClose: () => void
  onSave: (habit: Habit) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(habit)

  return (
    <Modal
      title={isNew ? 'New habit' : 'Edit habit'}
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
      <Field label="Name">
        <input
          type="text"
          value={draft.name}
          autoFocus
          placeholder="e.g. Read 20 pages"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </Field>

      <div className="grid-2">
        <Field label="Type">
          <select
            value={draft.kind}
            onChange={(e) => {
              const kind = e.target.value as Habit['kind']
              setDraft({ ...draft, kind, target: kind === 'binary' ? 1 : draft.target || 1 })
            }}
          >
            <option value="binary">Yes / no</option>
            <option value="count">Amount</option>
          </select>
        </Field>
        <Field label="Goal">
          <select
            value={draft.goal}
            onChange={(e) => setDraft({ ...draft, goal: e.target.value as Habit['goal'] })}
          >
            <option value="atLeast">More is better</option>
            <option value="atMost">Less is better</option>
          </select>
        </Field>
      </div>

      {draft.kind === 'count' && (
        <div className="grid-2">
          <Field label="Daily target">
            <input
              type="number"
              step="0.5"
              min="0"
              value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })}
            />
          </Field>
          <Field label="Unit">
            <input
              type="text"
              value={draft.unit}
              placeholder="h, km, pages…"
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            />
          </Field>
        </div>
      )}

      <Field label="Colour">
        <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
      </Field>
    </Modal>
  )
}
